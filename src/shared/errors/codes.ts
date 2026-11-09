/** Error codes returned in `error.code` of every server response (ADR-0003 Part A). */
export const ErrorCode = {
  /** Caller email is blank: the server cannot identify the account. */
  AUTH_NO_USER: "AUTH_NO_USER",
  /** Request body is not a valid `{ op, args, requestId, clientVersion }` object. */
  BAD_REQUEST: "BAD_REQUEST",
  /** Caller lacks the level the policy table requires. Default deny. */
  DENIED: "DENIED",
  /** `op` has no entry in the policy table. */
  UNKNOWN_OP: "UNKNOWN_OP",
  /** Unexpected failure inside the server. */
  INTERNAL: "INTERNAL",
  /** Add-on could not reach the server or read its reply. */
  NETWORK: "NETWORK",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  ErrorCode.INTERNAL,
  ErrorCode.NETWORK,
]);

export interface ErrorBody {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

/** An error with a code the client can act on. Thrown by server and add-on code, caught at entry points. */
export class AppError extends Error {
  override readonly name = "AppError";

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const CODES: ReadonlySet<string> = new Set<string>(Object.values(ErrorCode));

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && CODES.has(value);
}

export function isRetryable(code: ErrorCode): boolean {
  return RETRYABLE.has(code);
}

/** Converts any thrown value to the response error body. Unknown errors become INTERNAL with a fixed message. */
export function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: isRetryable(error.code),
    };
  }
  return {
    code: ErrorCode.INTERNAL,
    message: "Internal error",
    retryable: true,
  };
}
