import { AppError, ErrorCode } from "../../shared/errors/codes";
import { HANDLERS, type Caller, type HandlerTable } from "./handlers";
import { POLICY, type PolicyRow, type PolicyTable } from "./policy";

export interface DispatchTables {
  readonly policy: PolicyTable;
  readonly handlers: HandlerTable;
}

export const DEFAULT_TABLES: DispatchTables = {
  policy: POLICY,
  handlers: HANDLERS,
};

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

/** Slice 1 has no permission layer, so every level above `none` is denied (default deny). */
function authorize(row: PolicyRow, op: string): void {
  if (row.requiredLevel !== "none") {
    throw new AppError(ErrorCode.DENIED, `Access denied for ${op}`);
  }
}

/** The one server entry for ops (ADR-0003 Part C): identify caller, look up policy, authorize, then handle. */
export function dispatch(
  caller: Caller,
  op: string,
  args: unknown,
  tables: DispatchTables = DEFAULT_TABLES,
): unknown {
  requireIdentifiedCaller(caller);
  const row = ownEntry(tables.policy, op);
  if (row === undefined)
    throw new AppError(ErrorCode.UNKNOWN_OP, `Unknown op: ${op}`);
  authorize(row, op);
  const handler = ownEntry(tables.handlers, op);
  if (handler === undefined)
    throw new AppError(ErrorCode.INTERNAL, `No handler for op: ${op}`);
  return handler({ caller, args });
}
