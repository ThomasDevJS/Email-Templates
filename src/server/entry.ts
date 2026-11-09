/**
 * Web app and trigger entry points. They run as the owner (`executeAs: USER_DEPLOYING`).
 * Every op goes through `handleRpc`, which identifies the caller and checks policy before any handler runs.
 */
import { APP_VERSION } from "../shared/buildInfo";
import { ErrorCode } from "../shared/errors/codes";
import type { RpcResponse } from "../shared/model/protocol";
import { handleRpc } from "./dispatch/handle";
import { CANNOT_IDENTIFY_TITLE, cannotIdentifyPageHtml } from "./pages";
import { currentCaller, handleDeps, serverLogger } from "./runtime";

const APP_TITLE = "Migway Templates";

/** Serves the app shell, or the "Cannot identify your account" page when the caller email is blank (ADR-0001). */
export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  const caller = currentCaller();
  const logger = serverLogger();
  if (caller.email.trim() === "") {
    logger.warn({
      surface: "webapp",
      action: "web.open",
      result: "denied",
      errorCode: ErrorCode.AUTH_NO_USER,
    });
    return HtmlService.createHtmlOutput(cannotIdentifyPageHtml()).setTitle(
      CANNOT_IDENTIFY_TITLE,
    );
  }
  logger.info({
    surface: "webapp",
    action: "web.open",
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

/** Add-on to server call: JSON `{ op, args, requestId, clientVersion }` in, JSON envelope out. */
export function doPost(
  event: GoogleAppsScript.Events.DoPost,
): GoogleAppsScript.Content.TextOutput {
  const response = handleRpc(
    currentCaller(),
    parseJsonBody(event),
    "addon",
    handleDeps(),
  );
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** Web app `google.script.run.rpc(op, args)`. The server assigns the request ID. */
export function rpc(op: unknown, args: unknown): RpcResponse {
  const request = {
    op,
    args,
    requestId: Utilities.getUuid(),
    clientVersion: APP_VERSION,
  };
  return handleRpc(currentCaller(), request, "webapp", handleDeps());
}

function logTriggerRun(action: string): void {
  serverLogger().info({
    surface: "trigger",
    action,
    result: "ok",
    durationMs: 0,
  });
}

/** Run once per environment from the editor. Slice 2 installs the 3 time-driven triggers here. */
export function setup(): void {
  logTriggerRun("setup");
}

/** Every 5 min from slice 2: flush apply events, re-put cache chunks. */
export function tick(): void {
  logTriggerRun("tick");
}

/** Every 15 min from slice 2: membership snapshot. */
export function refreshMembers(): void {
  logTriggerRun("refreshMembers");
}

/** Daily from slice 2: audit roll, purge, backup, job health. */
export function daily(): void {
  logTriggerRun("daily");
}
