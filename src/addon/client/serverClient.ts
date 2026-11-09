/**
 * Add-on to server client (ADR-0003 Part A, Pattern A). Calls this project's own web app deployment
 * with the user's OAuth token. The server identifies the caller from Google's session, never from the body.
 */
import { APP_VERSION, BUILD_INFO } from "../../shared/buildInfo";
import {
  ErrorCode,
  isRetryable,
  type ErrorCode as Code,
} from "../../shared/errors/codes";
import {
  parseRpcResponse,
  type RpcRequest,
  type RpcResponse,
} from "../../shared/model/protocol";

const HTTP_OK = 200;

export function localError(code: Code, message: string): RpcResponse {
  return {
    ok: false,
    error: { code, message, retryable: isRetryable(code) },
    serverVersion: "",
    durationMs: 0,
  };
}

/** Turns an HTTP status and body into a response envelope. Anything unexpected becomes a NETWORK error. */
export function readResponse(status: number, body: string): RpcResponse {
  if (status !== HTTP_OK)
    return localError(
      ErrorCode.NETWORK,
      `Server returned HTTP ${String(status)}`,
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return localError(ErrorCode.NETWORK, "Server reply is not JSON");
  }
  return (
    parseRpcResponse(parsed) ??
    localError(ErrorCode.NETWORK, "Server reply has an unknown shape")
  );
}

function fetchServer(
  request: RpcRequest,
): GoogleAppsScript.URL_Fetch.HTTPResponse {
  return UrlFetchApp.fetch(BUILD_INFO.execUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(request),
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true,
    followRedirects: true,
  });
}

export function callServer(op: string, args: unknown): RpcResponse {
  if (BUILD_INFO.execUrl === "") {
    return localError(
      ErrorCode.NETWORK,
      "Server URL missing in this build. Set execUrl in deploy/<env>.json and redeploy.",
    );
  }
  const request: RpcRequest = {
    op,
    args,
    requestId: Utilities.getUuid(),
    clientVersion: APP_VERSION,
  };
  try {
    const response = fetchServer(request);
    return readResponse(response.getResponseCode(), response.getContentText());
  } catch {
    return localError(ErrorCode.NETWORK, "Server unreachable");
  }
}
