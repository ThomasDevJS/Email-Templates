import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { Surface } from "../../shared/log/logger";
import type { IndexDoc } from "../../shared/model/data";
import {
  ancestry,
  folderMap,
  levelResolver,
  type Subject,
} from "../../shared/permissions/effective";
import {
  checkNeed,
  needOf,
  ROOT,
  type PolicyAction,
} from "../../shared/permissions/matrix";
import { auditEvent, type EventSource } from "../audit/events";
import { bufferEvent } from "../audit/buffer";
import { requireDomain } from "../guards";
import { nowIso, type Services } from "../services";
import {
  createContext,
  type Access,
  type Caller,
  type HandlerContext,
  type HandlerTable,
} from "./context";
import { HANDLERS } from "./handlers";
import { POLICY, type PolicyRow, type PolicyTable } from "./policy";

export interface DispatchTables {
  readonly policy: PolicyTable;
  readonly handlers: HandlerTable;
}

export const DEFAULT_TABLES: DispatchTables = {
  policy: POLICY,
  handlers: HANDLERS,
};

export interface DispatchRequest {
  readonly caller: Caller;
  readonly op: string;
  readonly args: unknown;
  readonly surface: Surface;
  readonly requestId: string;
}

/** Own-property lookup, so `toString` or `__proto__` never resolve to a row. */
function ownEntry<T>(
  table: Readonly<Record<string, T>>,
  key: string,
): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? table[key]
    : undefined;
}

function requireIdentifiedCaller(caller: Caller): void {
  if (caller.email.trim() === "") {
    throw new AppError(ErrorCode.AUTH_NO_USER, "Cannot identify your account");
  }
}

function deniedSource(
  request: DispatchRequest,
  services: Services,
  roles: string,
): EventSource {
  return {
    actor: request.caller.email,
    actorRoles: roles,
    surface: request.surface,
    requestId: request.requestId,
    appVersion: services.appVersion,
    nowIso: () => nowIso(services),
    newId: services.newId,
  };
}

/** Denied requests go to the `evt:*` buffer; `tick` moves them into `pendingAudit` (ADR-0002 Audit storage). */
function recordDenied(
  request: DispatchRequest,
  services: Services,
  code: ErrorCode,
  targets: readonly string[],
  roles: string,
): void {
  const event = auditEvent(deniedSource(request, services, roles), {
    action: request.op,
    targetType: targets.length === 0 ? "library" : "folder",
    targetId: targets.join(","),
    result: "denied",
    errorCode: code,
  });
  bufferEvent(services.cache, services.lock, { kind: "denied", event });
}

function deny(
  request: DispatchRequest,
  services: Services,
  targets: readonly string[],
  roles: string,
): never {
  recordDenied(request, services, ErrorCode.DENIED, targets, roles);
  throw new AppError(
    ErrorCode.DENIED,
    "You don't have access to this. Ask a folder manager.",
  );
}

function actionOf(row: PolicyRow, args: unknown): PolicyAction {
  return typeof row.action === "function" ? row.action(args) : row.action;
}

function rolesOf(access: Access, targets: readonly string[]): string {
  if (access.subject.isAdmin) return "admin";
  return targets
    .filter((t) => t !== ROOT)
    .map(access.levelOf)
    .join(",");
}

/**
 * Resolves targets, computes levels and denies before the handler runs (ADR-0003 Part C). Admin rows read only
 * the membership snapshot. Returns the placement of the authorized targets for the in-lock recheck.
 */
function authorize(
  row: PolicyRow,
  context: HandlerContext,
  request: DispatchRequest,
): string {
  if (row.surface === "web" && request.surface === "addon")
    deny(request, context.services, [], "");
  const need = needOf(actionOf(row, request.args));
  if (need.kind === "any") return "";
  if (need.kind === "admin") {
    if (!context.subject().isAdmin) deny(request, context.services, [], "");
    return "";
  }
  const access = context.access();
  const targets = row.targets?.(request.args, access.index) ?? [];
  if (!checkNeed(need, access.subject.isAdmin, access.levelOf, targets))
    deny(request, context.services, targets, rolesOf(access, targets));
  return placement(access.index, targets);
}

/** Target folders with their ancestor chains: any move of a target or of one of its ancestors changes it. */
function placement(index: IndexDoc, targets: readonly string[]): string {
  const byId = folderMap(index.folders);
  return targets
    .map(
      (target) =>
        ancestry(target, byId)
          .map((folder) => folder.id)
          .join(">") || target,
    )
    .join(",");
}

/**
 * Same check on the index read inside the lock (save step 4). A concurrent move changes the resolved targets:
 * CONFLICT, so the caller reloads. Unchanged targets with a lower level (grant removed): DENIED.
 */
function recheck(
  row: PolicyRow,
  request: DispatchRequest,
  subject: Subject,
  authorized: string,
  index: IndexDoc,
): void {
  const need = needOf(actionOf(row, request.args));
  if (need.kind !== "level") return;
  const fresh = row.targets?.(request.args, index) ?? [];
  if (placement(index, fresh) !== authorized) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "This was moved by someone else while you worked. Reload and try again.",
      {
        reason: "moved",
      },
    );
  }
  if (!checkNeed(need, subject.isAdmin, levelResolver(subject, index), fresh))
    throw new AppError(
      ErrorCode.DENIED,
      "You don't have access to this. Ask a folder manager.",
    );
}

function checkDomain(request: DispatchRequest, services: Services): void {
  try {
    requireDomain(request.caller.email, services.props);
  } catch (error: unknown) {
    recordDenied(request, services, ErrorCode.AUTH_DOMAIN, [], "");
    throw error;
  }
}

/** The one server entry for ops: identify caller, check domain, look up policy, authorize, then handle. */
export function dispatch(
  request: DispatchRequest,
  services: Services,
  tables: DispatchTables = DEFAULT_TABLES,
): unknown {
  requireIdentifiedCaller(request.caller);
  checkDomain(request, services);
  const row = ownEntry(tables.policy, request.op);
  if (row === undefined)
    throw new AppError(ErrorCode.UNKNOWN_OP, `Unknown op: ${request.op}`);
  const handler = ownEntry(tables.handlers, request.op);
  if (handler === undefined)
    throw new AppError(ErrorCode.INTERNAL, `No handler for op: ${request.op}`);
  let authorized = "";
  const context = createContext({
    ...request,
    services,
    recheck: (index) => {
      recheck(row, request, context.subject(), authorized, index);
    },
  });
  authorized = authorize(row, context, request);
  return handler(context);
}
