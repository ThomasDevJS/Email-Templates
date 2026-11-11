/** Error codes returned in `error.code` of every server response (ADR-0003 Part A, spec section 7). */
export const ErrorCode = {
  /** Caller email is blank: the server cannot identify the account. */
  AUTH_NO_USER: "AUTH_NO_USER",
  /** Caller email is outside the domain in Script Property `DOMAIN`, or `DOMAIN` is unset. */
  AUTH_DOMAIN: "AUTH_DOMAIN",
  /** Request body is not a valid `{ op, args, requestId, clientVersion }` object. */
  BAD_REQUEST: "BAD_REQUEST",
  /** Caller lacks the level the policy table requires. Default deny. */
  DENIED: "DENIED",
  /** `op` has no entry in the policy table. */
  UNKNOWN_OP: "UNKNOWN_OP",
  /** Target folder, template or grant does not exist or was deleted. */
  NOT_FOUND: "NOT_FOUND",
  /** `baseVersion` is stale; `details` carries the current version, author and time. */
  CONFLICT: "CONFLICT",
  /** Script lock not acquired within 10 s. */
  BUSY: "BUSY",
  /** Apps Script quota or simultaneous execution limit. */
  QUOTA: "QUOTA",
  /** Arguments fail validation (names, sizes, folder rules). */
  VALIDATION: "VALIDATION",
  /** Op has a policy row but its handler arrives in a later slice. */
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  /** Configured option (resolver) is not available in this build. */
  NOT_CONFIGURED: "NOT_CONFIGURED",
  /** Unexpected failure inside the server. */
  INTERNAL: "INTERNAL",
  /** Add-on could not reach the server or read its reply. */
  NETWORK: "NETWORK",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  ErrorCode.BUSY,
  ErrorCode.QUOTA,
  ErrorCode.INTERNAL,
  ErrorCode.NETWORK,
]);

export type ErrorDetails = Readonly<Record<string, unknown>>;

export interface ErrorBody {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: ErrorDetails;
}

/** An error with a code the client can act on. Thrown by server and add-on code, caught at entry points. */
export class AppError extends Error {
  override readonly name = "AppError";

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetails,
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

const QUOTA_MESSAGES = [
  "too many simultaneous invocations",
  "service invoked too many times",
];

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return QUOTA_MESSAGES.some((text) => message.includes(text));
}

function appErrorBody(error: AppError): ErrorBody {
  const body = {
    code: error.code,
    message: error.message,
    retryable: isRetryable(error.code),
  };
  return error.details === undefined
    ? body
    : { ...body, details: error.details };
}

/**
 * "<code> <error name>" of any thrown value. Stored and shown in place of the message, because a platform message
 * can carry file text (a Drive media error quoted a whole audit file, slice 19).
 */
export function errorSummary(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  return `${toErrorBody(error).code} ${name}`;
}

/** Converts any thrown value to the response error body. Unknown errors become INTERNAL with a fixed message. */
export function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof AppError) return appErrorBody(error);
  if (isQuotaError(error)) {
    return {
      code: ErrorCode.QUOTA,
      message: "Service is busy. Try again in a minute.",
      retryable: true,
    };
  }
  return {
    code: ErrorCode.INTERNAL,
    message: "Internal error",
    retryable: true,
  };
}
