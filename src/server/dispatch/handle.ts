import {
  AppError,
  ErrorCode,
  toErrorBody,
  type ErrorBody,
} from "../../shared/errors/codes";
import { isId } from "../../shared/ids";
import type { LogResult, Surface } from "../../shared/log/logger";
import {
  parseRpcRequest,
  requestTiming,
  type RpcResponse,
} from "../../shared/model/protocol";
import { isRequestId, requestIdNow } from "../../shared/requestId";
import type { Services } from "../services";
import type { Caller } from "./context";
import { DEFAULT_TABLES, dispatch, type DispatchTables } from "./dispatch";

export interface HandleDeps {
  readonly services: Services;
  readonly tables?: DispatchTables;
}

const DENIAL_CODES: ReadonlySet<string> = new Set<string>([
  ErrorCode.AUTH_NO_USER,
  ErrorCode.AUTH_DOMAIN,
  ErrorCode.DENIED,
]);

function resultOf(error: ErrorBody): LogResult {
  if (DENIAL_CODES.has(error.code)) return "denied";
  return error.code === ErrorCode.CONFLICT ? "conflict" : "error";
}

function runDispatch(
  caller: Caller,
  raw: unknown,
  surface: Surface,
  deps: HandleDeps,
  requestId: string,
): unknown {
  if (
    typeof raw === "object" &&
    raw !== null &&
    !isRequestId(requestField(raw, "requestId"))
  )
    throw new AppError(
      ErrorCode.VALIDATION,
      "Request ID must have the format XXXXXXXX-XXXXXX",
    );
  const request = parseRpcRequest(raw);
  if (request === null)
    throw new AppError(ErrorCode.BAD_REQUEST, "Malformed request");
  return dispatch(
    {
      caller,
      op: request.op,
      args: request.args,
      surface,
      requestId,
    },
    deps.services,
    deps.tables ?? DEFAULT_TABLES,
  );
}

function requestField(raw: unknown, key: "op" | "requestId"): unknown {
  if (typeof raw !== "object" || raw === null) return undefined;
  return (raw as Record<string, unknown>)[key];
}

/** The client's request ID when it has the shared format, else a new server ID; client text never reaches the log. */
function requestIdOf(raw: unknown): string {
  const sent = requestField(raw, "requestId");
  return isRequestId(sent) ? sent : requestIdNow();
}

/** The op name for the log line, only when the policy table knows it. */
function actionOf(raw: unknown, tables: DispatchTables): string {
  const op = requestField(raw, "op");
  return typeof op === "string" &&
    Object.prototype.hasOwnProperty.call(tables.policy, op)
    ? op
    : "";
}

/** Template ID (`id`), else folder ID (`folderId`) of the request, for the log's `targetId`. Well-formed IDs only. */
function targetOf(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  const args = (raw as Record<string, unknown>)["args"];
  if (typeof args !== "object" || args === null) return "";
  const { id, folderId } = args as Record<string, unknown>;
  if (isId(id)) return id;
  return isId(folderId) ? folderId : "";
}

/**
 * Measured part of the log line: how the index was served, service call counts, and phase times. `startupMs`
 * runs from script load to handler start, `totalMs` from script load to now; the add-on adds its own phases.
 */
function measured(services: Services, started: number, raw: unknown) {
  const now = services.nowMs();
  return {
    durationMs: now - started,
    cache: services.stats.cache,
    calls: services.stats.calls,
    timing: {
      startupMs: started - services.startedMs,
      totalMs: now - services.startedMs,
      ...services.stats.ms,
      ...requestTiming(raw),
    },
  };
}

/**
 * Runs one request through dispatch and wraps the result in the response envelope.
 * Never throws: every failure becomes `{ ok: false, error }` and one log line. The log line has the closed
 * field list of spec section 11, so args (bodies, prompt values, recipients) never reach it.
 */
export function handleRpc(
  caller: Caller,
  raw: unknown,
  surface: Surface,
  deps: HandleDeps,
): RpcResponse {
  const { services } = deps;
  const started = services.nowMs();
  const requestId = requestIdOf(raw);
  const base = {
    surface,
    action: actionOf(raw, deps.tables ?? DEFAULT_TABLES),
    requestId,
    actor: caller.email,
    targetId: targetOf(raw),
  };
  try {
    const data = runDispatch(caller, raw, surface, deps, requestId);
    const metrics = measured(services, started, raw);
    services.logger.info({ ...base, result: "ok", ...metrics });
    return {
      ok: true,
      data,
      serverVersion: services.appVersion,
      durationMs: metrics.durationMs,
    };
  } catch (error: unknown) {
    const body = toErrorBody(error);
    const metrics = measured(services, started, raw);
    const level = body.code === ErrorCode.INTERNAL ? "error" : "warn";
    services.logger[level]({
      ...base,
      result: resultOf(body),
      errorCode: body.code,
      ...metrics,
      error,
    });
    return {
      ok: false,
      error: body,
      serverVersion: services.appVersion,
      durationMs: metrics.durationMs,
    };
  }
}
