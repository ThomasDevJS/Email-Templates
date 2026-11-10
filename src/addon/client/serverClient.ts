/**
 * Add-on to server client (ADR-0003 Part A, Pattern A). Calls this project's own web app deployment
 * with the user's OAuth token. The server identifies the caller from Google's session, never from the body.
 */
import { APP_VERSION, BUILD_INFO } from "../../shared/buildInfo";
import {
  ErrorCode,
  isRetryable,
  type ErrorBody,
  type ErrorCode as Code,
} from "../../shared/errors/codes";
import {
  parseRpcResponse,
  type ClientTiming,
  type DraftInfo,
  type RpcRequest,
  type RpcResponse,
} from "../../shared/model/protocol";
import { requestIdNow } from "../../shared/requestId";

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

const HTTP_FOUND = 302;

interface Hop {
  readonly status: number;
  readonly body: string;
  readonly location: string;
}

function readHop(response: GoogleAppsScript.URL_Fetch.HTTPResponse): Hop {
  const headers = response.getHeaders() as Record<string, string | undefined>;
  return {
    status: response.getResponseCode(),
    body: response.getContentText(),
    location: headers["Location"] ?? headers["location"] ?? "",
  };
}

/**
 * Apps Script answers a web app call with a 302 to script.googleusercontent.com, whose URL carries a
 * one-time key. The redirect is followed by hand so the first hop's status is visible in errors and
 * the bearer token is never forwarded to the second host.
 */
function fetchServer(request: RpcRequest, token: string): Hop {
  const first = readHop(
    UrlFetchApp.fetch(BUILD_INFO.execUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(request),
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
      followRedirects: false,
    }),
  );
  if (first.status !== HTTP_FOUND || first.location === "") return first;
  const second = readHop(
    UrlFetchApp.fetch(first.location, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
    }),
  );
  return second.status === HTTP_OK
    ? second
    : { ...second, body: `${String(second.status)} after redirect` };
}

/** One server call: the response and the request ID the error states show (wireframe 07 C). */
export interface ServerCall {
  readonly requestId: string;
  readonly response: RpcResponse;
}

/** A failed call as the sidebar states use it. */
export interface Failure {
  readonly code: Code;
  readonly message: string;
  readonly requestId: string;
}

export function failureOf(requestId: string, error: ErrorBody): Failure {
  return { code: error.code, message: error.message, requestId };
}

/** Clock value when this execution evaluated the bundle: the add-on's start as far as code can see it. */
const LOADED_MS = Date.now();

/** Fetch and total ms of the previous server call in this execution, sent with the next call. */
let previous: ClientTiming = {};

/**
 * One request with the add-on's phase times (slice 4b): start to this call, the token call, and the previous
 * call's fetch and total. The server writes them into its log line, because add-on executions show no logs.
 */
function send(
  op: string,
  args: unknown,
  requestId: string,
  draft: DraftInfo | undefined,
): RpcResponse {
  if (BUILD_INFO.execUrl === "") {
    return localError(
      ErrorCode.NOT_CONFIGURED,
      "Server URL missing in this build. Set execUrl in deploy/<env>.json and redeploy.",
    );
  }
  const started = Date.now();
  try {
    const token = ScriptApp.getOAuthToken();
    const tokenDone = Date.now();
    const timing: ClientTiming = {
      addonPreMs: started - LOADED_MS,
      addonTokenMs: tokenDone - started,
      ...previous,
    };
    const request: RpcRequest = {
      op,
      args,
      requestId,
      clientVersion: APP_VERSION,
      timing,
      ...(draft === undefined ? {} : { draft }),
    };
    const hop = fetchServer(request, token);
    const done = Date.now();
    previous = { prevFetchMs: done - tokenDone, prevTotalMs: done - started };
    return readResponse(hop.status, hop.body);
  } catch {
    return localError(ErrorCode.NETWORK, "Server unreachable");
  }
}

/** One server call; `draft` carries the Q21 event diagnostics of the callback that makes it. */
export function callServer(
  op: string,
  args: unknown,
  draft?: DraftInfo,
): ServerCall {
  const requestId = requestIdNow();
  return { requestId, response: send(op, args, requestId, draft) };
}
