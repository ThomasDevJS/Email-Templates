import { isErrorCode, type ErrorBody } from "../errors/codes";

/** Add-on and web app request to the server (ADR-0003 Part A). */
export interface RpcRequest {
  readonly op: string;
  readonly args: unknown;
  readonly requestId: string;
  readonly clientVersion: string;
  /** Add-on phase times; the server copies them into its log line. */
  readonly timing?: ClientTiming;
  /** Add-on only: which Gmail event fields the call's event carried (Q21); the server logs them. */
  readonly draft?: DraftInfo;
}

/**
 * Gmail event fields the add-on reports as present (Q21, slice 5b). Names only, never values; the server accepts
 * no other name.
 */
export const DRAFT_FIELDS = [
  "messageId",
  "threadId",
  "draftMetadata",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "subject",
] as const;
export type DraftField = (typeof DRAFT_FIELDS)[number];
/** Largest recipient count the server accepts; the add-on caps its counts at this value. */
export const DRAFT_COUNT_MAX = 1000;

/** Present event fields, in `DRAFT_FIELDS` order, the To, Cc and Bcc counts, and whether the draft has a subject. */
export interface DraftInfo {
  readonly fields: readonly DraftField[];
  readonly to: number;
  readonly cc: number;
  readonly bcc: number;
  readonly hasSubject: boolean;
}

function isDraftCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= DRAFT_COUNT_MAX
  );
}

function isDraftField(value: unknown): value is DraftField {
  return (DRAFT_FIELDS as readonly unknown[]).includes(value);
}

/**
 * The request's draft diagnostics: `undefined` when the request has none, `null` when they break the contract
 * (a name outside `DRAFT_FIELDS`, a repeated name, another key, a count that is not a whole number from 0 to
 * 1,000, or a `hasSubject` that is not a boolean). The server answers `null` with VALIDATION and logs nothing from it.
 */
export function requestDraft(raw: unknown): DraftInfo | null | undefined {
  const draft = isRecord(raw) ? raw["draft"] : undefined;
  if (draft === undefined) return undefined;
  if (!isRecord(draft)) return null;
  const { fields, to, cc, bcc, hasSubject } = draft;
  const keys = Object.keys(draft).sort().join(",");
  if (
    keys !== "bcc,cc,fields,hasSubject,to" ||
    typeof hasSubject !== "boolean" ||
    !Array.isArray(fields) ||
    !fields.every(isDraftField) ||
    new Set(fields).size !== fields.length ||
    !isDraftCount(to) ||
    !isDraftCount(cc) ||
    !isDraftCount(bcc)
  )
    return null;
  return {
    fields: DRAFT_FIELDS.filter((name) => fields.includes(name)),
    to,
    cc,
    bcc,
    hasSubject,
  };
}

/**
 * Add-on phase times in ms (slice 4b): add-on start to the fetch, the OAuth token call, and the fetch and total of
 * the previous server call in the same execution.
 */
export const CLIENT_TIMING_KEYS = [
  "addonPreMs",
  "addonTokenMs",
  "prevFetchMs",
  "prevTotalMs",
] as const;
export type ClientTiming = Partial<
  Record<(typeof CLIENT_TIMING_KEYS)[number], number>
>;
const TIMING_MAX_MS = 600000;

/** The known timing keys of a raw request whose values are whole ms from 0 to 10 min; anything else is dropped. */
export function requestTiming(raw: unknown): ClientTiming {
  const timing = isRecord(raw) ? raw["timing"] : undefined;
  if (!isRecord(timing)) return {};
  const out: Record<string, number> = {};
  for (const key of CLIENT_TIMING_KEYS) {
    const value = timing[key];
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= TIMING_MAX_MS
    )
      out[key] = value;
  }
  return out;
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
