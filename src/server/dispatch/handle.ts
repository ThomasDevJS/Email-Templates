import {
  AppError,
  ErrorCode,
  toErrorBody,
  type ErrorBody,
} from "../../shared/errors/codes";
import type { LogResult, Surface } from "../../shared/log/logger";
import { parseRpcRequest, type RpcResponse } from "../../shared/model/protocol";
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
  };
  try {
    const data = runDispatch(caller, raw, surface, deps);
    const durationMs = services.nowMs() - started;
    services.logger.info({
      ...base,
      result: "ok",
      durationMs,
      cache: services.stats.cache,
    });
    return { ok: true, data, serverVersion: services.appVersion, durationMs };
  } catch (error: unknown) {
    const body = toErrorBody(error);
    const durationMs = services.nowMs() - started;
    const level = body.code === ErrorCode.INTERNAL ? "error" : "warn";
    services.logger[level]({
      ...base,
      result: resultOf(body),
      errorCode: body.code,
      durationMs,
      cache: services.stats.cache,
      error,
    });
    return {
      ok: false,
      error: body,
      serverVersion: services.appVersion,
      durationMs,
    };
  }
}
