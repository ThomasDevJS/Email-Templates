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
): unknown {
  const request = parseRpcRequest(raw);
  if (request === null)
    throw new AppError(ErrorCode.BAD_REQUEST, "Malformed request");
  return dispatch(
    {
      caller,
      op: request.op,
      args: request.args,
      surface,
      requestId: request.requestId,
    },
    deps.services,
    deps.tables ?? DEFAULT_TABLES,
  );
}

function requestField(raw: unknown, key: "op" | "requestId"): string {
  if (typeof raw !== "object" || raw === null) return "";
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
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
  const base = {
    surface,
    action: requestField(raw, "op"),
    requestId: requestField(raw, "requestId"),
    actor: caller.email,
    targetId: targetOf(raw),
  };
  try {
    const data = runDispatch(caller, raw, surface, deps);
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
