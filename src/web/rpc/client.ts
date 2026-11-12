import {
  ErrorCode,
  isRetryable,
  type ErrorDetails,
} from "../../shared/errors/codes";
import { parseRpcResponse } from "../../shared/model/protocol";

/**
 * The web app's only server call path: `google.script.run.rpc(op, args, requestId)` (ADR-0003 Part A).
 * At most 4 calls run at once; the rest wait in order. Every call gets a request ID that the server logs and
 * the error toast shows. Every failure becomes an `RpcError` with a code from the spec section 7 table.
 */
export interface Runner {
  run(
    op: string,
    args: unknown,
    requestId: string,
    onReply: (value: unknown) => void,
    onFailure: (error: unknown) => void,
  ): void;
}

export class RpcError extends Error {
  override readonly name = "RpcError";

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly requestId: string,
    readonly retryable: boolean,
    readonly details?: ErrorDetails,
  ) {
    super(message);
  }
}

export interface RpcClient {
  call(op: string, args?: unknown): Promise<unknown>;
}

export const MAX_CONCURRENT = 4;

/** Turns one reply into data or an RpcError. */
export function settle(value: unknown, requestId: string): unknown {
  const response = parseRpcResponse(value);
  if (response === null)
    throw new RpcError(
      ErrorCode.INTERNAL,
      "Unexpected reply from the server",
      requestId,
      true,
    );
  if (response.ok) return response.data;
  const { code, message, retryable, details } = response.error;
  throw new RpcError(code, message, requestId, retryable, details);
}

/** `google.script.run` failure (network, script error, quota page): retryable. */
export function transportError(error: unknown, requestId: string): RpcError {
  const message = error instanceof Error ? error.message : String(error);
  const quota = /too many|quota|simultaneous/i.test(message);
  const code = quota ? ErrorCode.QUOTA : ErrorCode.NETWORK;
  return new RpcError(
    code,
    message || "Network error",
    requestId,
    isRetryable(code),
  );
}

export function createClient(
  runner: Runner,
  newId: () => string,
  maxConcurrent = MAX_CONCURRENT,
): RpcClient {
  let running = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    running -= 1;
    waiting.shift()?.();
  };
  const slot = (): Promise<void> => {
    if (running < maxConcurrent) {
      running += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) =>
      waiting.push(() => {
        running += 1;
        resolve();
      }),
    );
  };
  const send = (op: string, args: unknown, requestId: string) =>
    new Promise<unknown>((resolve, reject) => {
      runner.run(op, args, requestId, resolve, (error) => {
        reject(transportError(error, requestId));
      });
    });
  return {
    async call(op: string, args: unknown = {}): Promise<unknown> {
      await slot();
      const requestId = newId();
      try {
        return settle(await send(op, args, requestId), requestId);
      } finally {
        release();
      }
    },
  };
}
