/**
 * Web app and trigger entry points. They run as the owner (`executeAs: USER_DEPLOYING`). Every export is in the
 * ENTRY_POINTS allowlist (src/shared/entryPoints.ts) with its surface and guard:
 * `doGet` and `rpc` (webapp_rpc) and `doPost` go through `dispatch`; `setup`, `tick`, `refreshMembers` and `daily`
 * (trigger) refuse to run for anyone but the owner or their own project trigger.
 */
import { APP_VERSION } from "../shared/buildInfo";
import { AppError, ErrorCode, toErrorBody } from "../shared/errors/codes";
import type { RpcResponse } from "../shared/model/protocol";
import { requestIdNow } from "../shared/requestId";
import { loadIndex } from "./cache/indexCache";
import { handleRpc } from "./dispatch/handle";
import { frontDoorRefusal, UNSUPPORTED_TYPE } from "./frontDoor";
import {
  OWNER_EMAIL_KEY,
  refuse,
  requireDomain,
  setupAllowed,
  triggerAllowed,
  type TriggerEvent,
} from "./guards";
import { runDaily } from "./jobs/daily";
import { runJob } from "./jobs/health";
import { runSetup, type SetupResult } from "./jobs/setup";
import { runTick, type TickResult } from "./jobs/tick";
import { ensureTriggers } from "./jobs/triggers";
import { refreshSnapshot } from "./membership/snapshot";
import { CANNOT_IDENTIFY_TITLE, cannotIdentifyPageHtml } from "./pages";
import { createServices, currentCaller } from "./runtime";
import type { Services } from "./services";

const APP_TITLE = "Migway Templates";

/**
 * The first web app page load after a deploy reinstalls triggers when `TRIGGERS_VERSION` changed (spec section 16).
 * `doGet` and `tick` run it; ops (`rpc`, `doPost`) skip the check and its property reads.
 */
function maintain(services: Services): void {
  if ((services.props.getProperty(OWNER_EMAIL_KEY) ?? "") === "") return;
  try {
    ensureTriggers(services, PropertiesService.getScriptProperties());
  } catch (error: unknown) {
    services.logger.error({
      surface: services.stats.surface,
      action: "triggers.ensure",
      result: "error",
      error,
    });
  }
}

function identified(email: string, services: Services): boolean {
  if (email.trim() === "") return false;
  try {
    requireDomain(email, services.props);
    return true;
  } catch {
    return false;
  }
}

/** Serves the app shell, or the "Cannot identify your account" page for a blank or non-domain caller (ADR-0001). */
export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  const services = createServices("webapp");
  const caller = currentCaller();
  const requestId = requestIdNow();
  if (!identified(caller.email, services)) {
    services.logger.warn({
      surface: "webapp",
      action: "web.open",
      requestId,
      result: "denied",
      actor: caller.email,
      errorCode:
        caller.email.trim() === ""
          ? ErrorCode.AUTH_NO_USER
          : ErrorCode.AUTH_DOMAIN,
    });
    return HtmlService.createHtmlOutput(cannotIdentifyPageHtml()).setTitle(
      CANNOT_IDENTIFY_TITLE,
    );
  }
  maintain(services);
  services.logger.info({
    surface: "webapp",
    action: "web.open",
    requestId,
    result: "ok",
    actor: caller.email,
  });
  const template = HtmlService.createTemplateFromFile("index");
  template["email"] = caller.email;
  template["appVersion"] = APP_VERSION;
  return template
    .evaluate()
    .setTitle(APP_TITLE)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function parseJsonBody(
  event: GoogleAppsScript.Events.DoPost | undefined,
): unknown {
  try {
    return JSON.parse(event?.postData.contents ?? "") as unknown;
  } catch {
    return undefined;
  }
}

/**
 * A front-door refusal (spec section 5.11): BAD_REQUEST envelope and one warn line. No audit row, because in a
 * cross-site case the actor is the victim; no buffered event, no dispatch, no Drive or index read.
 */
function refuseAtDoor(services: Services, message: string): RpcResponse {
  const started = services.nowMs();
  const error = toErrorBody(new AppError(ErrorCode.BAD_REQUEST, message));
  services.logger.warn({
    surface: "addon",
    action: "",
    requestId: requestIdNow(),
    result: "error",
    actor: currentCaller().email,
    targetId: "",
    errorCode: error.code,
  });
  return {
    ok: false,
    error,
    serverVersion: services.appVersion,
    durationMs: services.nowMs() - started,
  };
}

/** The front-door check on the event. A throwing getter on the event refuses as UNSUPPORTED_TYPE (default deny). */
function doorRefusal(
  event: GoogleAppsScript.Events.DoPost | undefined,
): string | null {
  try {
    return frontDoorRefusal(event?.postData);
  } catch {
    return UNSUPPORTED_TYPE;
  }
}

/**
 * Add-on to server call: JSON `{ op, args, requestId, clientVersion }` in, JSON envelope out. The front door
 * (content type, size) runs before `JSON.parse` and before dispatch.
 */
export function doPost(
  event: GoogleAppsScript.Events.DoPost | undefined,
): GoogleAppsScript.Content.TextOutput {
  const services = createServices("addon");
  const refusal = doorRefusal(event);
  const response =
    refusal === null
      ? handleRpc(currentCaller(), parseJsonBody(event), "addon", {
          services,
        })
      : refuseAtDoor(services, refusal);
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * Web app `google.script.run.rpc(op, args, requestId)`. The web app sends its own request ID so the error toast
 * and the server log line show the same value; `handleRpc` answers VALIDATION to a missing or malformed ID and logs a server ID instead.
 */
export function rpc(
  op: unknown,
  args: unknown,
  requestId?: unknown,
): RpcResponse {
  const services = createServices("webapp");
  const request = {
    op,
    args,
    requestId,
    clientVersion: APP_VERSION,
  };
  return handleRpc(currentCaller(), request, "webapp", { services });
}

function logRefused(services: Services, name: string): never {
  const error: AppError = refuse(name);
  services.logger.warn({
    surface: "trigger",
    action: name,
    result: "denied",
    actor: services.session.activeEmail(),
    errorCode: toErrorBody(error).code,
  });
  throw error;
}

function guardedJob<T>(
  name: string,
  event: TriggerEvent | undefined,
  work: (services: Services) => T,
): T {
  const services = createServices("trigger");
  if (
    !triggerAllowed(
      name,
      event,
      services.session,
      services.props,
      services.triggers,
    )
  )
    logRefused(services, name);
  return runJob(services, name, () => work(services));
}

/** Run once per environment from the editor by the owner: data folder, Script Properties, 3 triggers. */
export function setup(): SetupResult {
  const services = createServices("trigger");
  if (!setupAllowed(services.session, services.props))
    logRefused(services, "setup");
  return runJob(services, "setup", () => runSetup(services));
}

/** Every 5 min: flush buffered events, early audit roll, cache upkeep. */
export function tick(event?: TriggerEvent): TickResult {
  return guardedJob("tick", event, runTick);
}

/** Every 15 min: membership snapshot. */
export function refreshMembers(event?: TriggerEvent): { groups: number } {
  return guardedJob("refreshMembers", event, (services) => ({
    groups: Object.keys(refreshSnapshot(services, loadIndex(services)).groups)
      .length,
  }));
}

/** Daily: audit roll, purge, orphans, backup, audit retention. */
export function daily(event?: TriggerEvent): ReturnType<typeof runDaily> {
  return guardedJob("daily", event, runDaily);
}
