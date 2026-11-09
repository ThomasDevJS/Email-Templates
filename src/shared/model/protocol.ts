import { isErrorCode, type ErrorBody } from "../errors/codes";

/** Add-on and web app request to the server (ADR-0003 Part A). */
export interface RpcRequest {
  readonly op: string;
  readonly args: unknown;
  readonly requestId: string;
  readonly clientVersion: string;
}

interface ResponseMeta {
  readonly serverVersion: string;
  readonly durationMs: number;
}

export type RpcResponse =
  | (ResponseMeta & { readonly ok: true; readonly data: unknown })
  | (ResponseMeta & { readonly ok: false; readonly error: ErrorBody });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Returns the request when `value` has the required shape, otherwise `null`. Missing `args` becomes `{}`. */
export function parseRpcRequest(value: unknown): RpcRequest | null {
  if (!isRecord(value)) return null;
  const { op, args, requestId, clientVersion } = value;
  if (
    !isNonEmptyString(op) ||
    !isNonEmptyString(requestId) ||
    typeof clientVersion !== "string"
  ) {
    return null;
  }
  return { op, args: args ?? {}, requestId, clientVersion };
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    isRecord(value) &&
    isErrorCode(value.code) &&
    typeof value.message === "string" &&
    typeof value.retryable === "boolean"
  );
}

/** Returns the response when `value` has the documented shape, otherwise `null`. */
export function parseRpcResponse(value: unknown): RpcResponse | null {
  if (!isRecord(value)) return null;
  const { ok, serverVersion, durationMs } = value;
  if (typeof serverVersion !== "string" || typeof durationMs !== "number")
    return null;
  if (ok === true) return { ok, data: value.data, serverVersion, durationMs };
  if (ok === false && isErrorBody(value.error))
    return { ok, error: value.error, serverVersion, durationMs };
  return null;
}
