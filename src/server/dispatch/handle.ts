import {
  AppError,
  ErrorCode,
  toErrorBody,
  type ErrorBody,
} from "../../shared/errors/codes";
import type { Logger, LogResult, Surface } from "../../shared/log/logger";
import { parseRpcRequest, type RpcResponse } from "../../shared/model/protocol";
import { DEFAULT_TABLES, dispatch, type DispatchTables } from "./dispatch";
import type { Caller } from "./handlers";

export interface HandleDeps {
  readonly logger: Logger;
  readonly nowMs: () => number;
  readonly serverVersion: string;
  readonly tables?: DispatchTables;
}

const DENIAL_CODES: ReadonlySet<string> = new Set<string>([
  ErrorCode.AUTH_NO_USER,
  ErrorCode.DENIED,
]);

function resultOf(error: ErrorBody): LogResult {
  return DENIAL_CODES.has(error.code) ? "denied" : "error";
}

function runDispatch(
  caller: Caller,
  raw: unknown,
  tables: DispatchTables | undefined,
): unknown {
  const request = parseRpcRequest(raw);
  if (request === null)
    throw new AppError(ErrorCode.BAD_REQUEST, "Malformed request");
  return dispatch(caller, request.op, request.args, tables ?? DEFAULT_TABLES);
}

function requestField(raw: unknown, key: "op" | "requestId"): string {
  if (typeof raw !== "object" || raw === null) return "";
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/**
 * Runs one request through dispatch and wraps the result in the response envelope.
 * Never throws: every failure becomes `{ ok: false, error }` and one log line.
 */
export function handleRpc(
  caller: Caller,
  raw: unknown,
  surface: Surface,
  deps: HandleDeps,
): RpcResponse {
  const started = deps.nowMs();
  const base = {
    surface,
    action: requestField(raw, "op"),
    requestId: requestField(raw, "requestId"),
    actor: caller.email,
  };
  try {
    const data = runDispatch(caller, raw, deps.tables);
    const durationMs = deps.nowMs() - started;
    deps.logger.info({ ...base, result: "ok", durationMs });
    return { ok: true, data, serverVersion: deps.serverVersion, durationMs };
  } catch (error: unknown) {
    const body = toErrorBody(error);
    const durationMs = deps.nowMs() - started;
    const level = body.code === ErrorCode.INTERNAL ? "error" : "warn";
    deps.logger[level]({
      ...base,
      result: resultOf(body),
      errorCode: body.code,
      durationMs,
      error,
    });
    return {
      ok: false,
      error: body,
      serverVersion: deps.serverVersion,
      durationMs,
    };
  }
}
