import { AppError, ErrorCode } from "../../shared/errors/codes";
import {
  adminEntriesOf,
  ADMINS_MAX,
  isAdminAddress,
  type AdminEntry,
} from "../../shared/model/admins";
import type { IndexDoc } from "../../shared/model/data";
import { isAddress, RCPT_ADDRESS_MAX } from "../../shared/model/recipients";
import { auditEvent, type EventSource } from "../audit/events";
import { loadIndexForWrite } from "../cache/indexCache";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { DOMAIN_KEY } from "../guards";
import { WRITE_LOCK_MS, withLock } from "../lock";
import { nowIso, type Services } from "../services";
import { commitLocked } from "../storage/writer";

/**
 * In-app admins (D32, spec 5.8, 6, 7.3; ADR-0003 Amendment 2026-11-11). `admin.add` and `admin.remove` are deltas on
 * the `admins` list of the index read inside the lock, after the dispatch admin re-check on that same index. Refusals
 * are VALIDATION with `details.reason` (the spec code) and the spec 7.3 text; none of them writes.
 */
export type AdminReason =
  | "ADMIN_FORMAT"
  | "ADMIN_OUTSIDE"
  | "ADMIN_NO_ACCOUNT"
  | "ADMIN_TOO_MANY"
  | "ADMIN_SELF";

export interface AdminsResult {
  readonly admins: AdminEntry[];
  readonly changed: boolean;
}

function refusal(reason: AdminReason, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message, { reason });
}

function domainOf(services: Services): string {
  return (services.props.getProperty(DOMAIN_KEY) ?? "").trim().toLowerCase();
}

/** `{ email }` and nothing else; the address trimmed and lower case. */
function emailArg(args: unknown): string {
  const record = (
    typeof args === "object" && args !== null ? args : {}
  ) as Readonly<Record<string, unknown>>;
  const email = record["email"];
  if (typeof email !== "string" || Object.keys(record).length !== 1)
    throw new AppError(ErrorCode.VALIDATION, "Send one email address.");
  return email.trim().toLowerCase();
}

function requireForm(email: string, domain: string): void {
  if (email.length > RCPT_ADDRESS_MAX || !isAddress(email))
    throw refusal(
      "ADMIN_FORMAT",
      `Enter an email address, for example name@${domain}.`,
    );
}

const outside = (domain: string) =>
  refusal("ADMIN_OUTSIDE", `Only ${domain} addresses can be admins.`);

/**
 * The account's primary address from the Directory (`domain_public`, `basic`, the scope `lookupProfile` uses). Not
 * found (also a group address): ADMIN_NO_ACCOUNT. Any other failure: INTERNAL, nothing written.
 */
function primaryAddress(services: Services, email: string, domain: string) {
  const noAccount = refusal(
    "ADMIN_NO_ACCOUNT",
    `No ${domain} account has this address. A group goes in the admin group the owner sets.`,
  );
  let raw: unknown;
  try {
    raw = services
      .directoryUsers()
      .get(email, { viewType: "domain_public", projection: "basic" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (/not found/i.test(message)) throw noAccount;
    throw new AppError(
      ErrorCode.INTERNAL,
      "The address could not be checked. Try again.",
    );
  }
  const primary = (raw as { primaryEmail?: unknown } | null)?.primaryEmail;
  if (typeof primary !== "string") throw noAccount;
  const address = primary.trim().toLowerCase();
  // An alias of a user whose primary address sits in another domain of the Workspace.
  if (!isAdminAddress(address, domain)) throw outside(domain);
  return address;
}

function change(
  context: HandlerContext,
  source: EventSource,
  edit: (entries: AdminEntry[]) => AdminEntry[] | null,
  event: { action: string; email: string; admin: boolean },
): AdminsResult {
  const { services } = context;
  const domain = domainOf(services);
  return withLock(services.lock, WRITE_LOCK_MS, () => {
    const current = loadIndexForWrite(services);
    context.recheck(current);
    const entries = adminEntriesOf(current.admins, domain);
    if (edit(entries) === null) return { admins: entries, changed: false };
    return commitLocked(services, (latest: IndexDoc) => {
      const admins = edit(adminEntriesOf(latest.admins, domain)) ?? [];
      return {
        doc: { ...latest, admins },
        events: [
          auditEvent(source, {
            action: event.action,
            targetType: "admin",
            targetId: event.email,
            before: { email: event.email, admin: !event.admin },
            after: { email: event.email, admin: event.admin },
          }),
        ],
        result: { admins, changed: true },
      };
    });
  });
}

/** `admin.add { email }`: form, domain and Directory checks before the lock; listed, cap and append inside it. */
export function adminAdd(context: HandlerContext): AdminsResult {
  const { services } = context;
  const domain = domainOf(services);
  const typed = emailArg(context.args);
  requireForm(typed, domain);
  if (!isAdminAddress(typed, domain)) throw outside(domain);
  const email = primaryAddress(services, typed, domain);
  const entry: AdminEntry = {
    email,
    addedAt: nowIso(services),
    addedBy: context.caller.email.trim().toLowerCase(),
  };
  return change(
    context,
    eventSource(context),
    (entries) => {
      if (entries.some((listed) => listed.email === email)) return null;
      if (entries.length >= ADMINS_MAX)
        throw refusal(
          "ADMIN_TOO_MANY",
          `The list holds ${String(ADMINS_MAX)} admins. Remove one first.`,
        );
      return [...entries, entry];
    },
    { action: "admin.add", email, admin: true },
  );
}

/** `admin.remove { email }`: never the caller; only the in-app list changes, break-glass and group admins stay. */
export function adminRemove(context: HandlerContext): AdminsResult {
  const { services } = context;
  const email = emailArg(context.args);
  requireForm(email, domainOf(services));
  if (email === context.caller.email.trim().toLowerCase())
    throw refusal(
      "ADMIN_SELF",
      "You cannot remove yourself. Ask another admin.",
    );
  return change(
    context,
    eventSource(context),
    (entries) =>
      entries.some((listed) => listed.email === email)
        ? entries.filter((listed) => listed.email !== email)
        : null,
    { action: "admin.remove", email, admin: false },
  );
}
