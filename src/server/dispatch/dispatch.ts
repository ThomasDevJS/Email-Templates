import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { Surface } from "../../shared/log/logger";
import { checkNeed, needOf, ROOT } from "../../shared/permissions/matrix";
import { auditEvent, type EventSource } from "../audit/events";
import { bufferEvent } from "../audit/buffer";
import { requireDomain } from "../guards";
import { nowIso, type Services } from "../services";
import {
  createContext,
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

/** Resolves targets, computes levels and denies before the handler runs (ADR-0003 Part C). */
function authorize(
  row: PolicyRow,
  context: HandlerContext,
  request: DispatchRequest,
): void {
  if (row.surface === "web" && request.surface === "addon")
    deny(request, context.services, [], "");
  const action =
    typeof row.action === "function" ? row.action(request.args) : row.action;
  const need = needOf(action);
  if (need.kind === "any") return;
  const access = context.access();
  const targets = row.targets?.(request.args, access.index) ?? [];
  if (!checkNeed(need, access.subject.isAdmin, access.levelOf, targets)) {
    const roles = access.subject.isAdmin
      ? "admin"
      : targets
          .filter((t) => t !== ROOT)
          .map(access.levelOf)
          .join(",");
    deny(request, context.services, targets, roles);
  }
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
  const context = createContext({ ...request, services });
  authorize(row, context, request);
  return handler(context);
}
