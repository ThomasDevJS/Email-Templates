import { AppError, ErrorCode } from "../shared/errors/codes";
import { domainOf } from "../shared/permissions/principals";
import type { PropertyStore, SessionInfo, TriggerApp } from "./services";

/**
 * Guards for top-level functions (ADR-0003 Part C, revised in slice 2). Any top-level function is callable through
 * `google.script.run` from the web app, where it runs as the owner: the effective user is the owner for every caller,
 * so it proves nothing alone. The active user is the real caller there, and only Google sets `triggerUid` values
 * that match an installed project trigger.
 */
export const OWNER_EMAIL_KEY = "OWNER_EMAIL";
export const DOMAIN_KEY = "DOMAIN";

const norm = (email: string): string => email.trim().toLowerCase();

export interface TriggerEvent {
  readonly triggerUid?: unknown;
}

function isProjectTrigger(
  app: TriggerApp,
  name: string,
  event: TriggerEvent | undefined,
): boolean {
  const uid = event?.triggerUid;
  if (typeof uid !== "string" || uid === "") return false;
  return app
    .getProjectTriggers()
    .some(
      (trigger) =>
        trigger.getUniqueId() === uid && trigger.getHandlerFunction() === name,
    );
}

/**
 * A job runs when the effective user is `OWNER_EMAIL` and either the owner is also the active user (editor run)
 * or the call carries the `triggerUid` of this project's trigger for the job and no other active user.
 */
export function triggerAllowed(
  name: string,
  event: TriggerEvent | undefined,
  session: SessionInfo,
  props: PropertyStore,
  app: TriggerApp,
): boolean {
  const owner = norm(props.getProperty(OWNER_EMAIL_KEY) ?? "");
  if (owner === "" || norm(session.effectiveEmail()) !== owner) return false;
  const active = norm(session.activeEmail());
  if (active === owner) return true;
  return active === "" && isProjectTrigger(app, name, event);
}

/** `setup` runs from the editor: active equals effective, and once set, only the recorded owner may rerun it. */
export function setupAllowed(
  session: SessionInfo,
  props: PropertyStore,
): boolean {
  const active = norm(session.activeEmail());
  const effective = norm(session.effectiveEmail());
  const owner = norm(props.getProperty(OWNER_EMAIL_KEY) ?? "");
  return (
    active !== "" &&
    active === effective &&
    (owner === "" || owner === effective)
  );
}

/**
 * Caller email must end with `@` plus Script Property `DOMAIN`. An unset `DOMAIN` (setup not run) denies everyone
 * with NOT_CONFIGURED, so the sidebar can show its "not set up" state.
 */
export function requireDomain(email: string, props: PropertyStore): void {
  const domain = norm(props.getProperty(DOMAIN_KEY) ?? "");
  if (domain === "")
    throw new AppError(
      ErrorCode.NOT_CONFIGURED,
      "Migway Templates is not set up yet. Ask your admin to finish setup.",
    );
  if (domainOf(email) !== domain) {
    throw new AppError(
      ErrorCode.AUTH_DOMAIN,
      "This is not a Migway account. Sign in with your Migway account.",
    );
  }
}

export function refuse(name: string): AppError {
  return new AppError(
    ErrorCode.DENIED,
    `${name} may run only as the owner or from its trigger`,
  );
}
