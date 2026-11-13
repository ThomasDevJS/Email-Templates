/**
 * Front door of `doPost` (spec section 5.11, ADR-0010 Decision 1). Runs before `JSON.parse` and before dispatch.
 * A cross-site HTML form can send only `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`,
 * so requiring `application/json` stops a page from posting ops as the signed-in user.
 */

/** Largest body `doPost` reads, in bytes. Add-on bodies are under 2 KB; a full `extension.sync` is about 45 KB. */
export const MAX_POST_BYTES = 262_144;

export const UNSUPPORTED_TYPE = "Unsupported content type";
export const TOO_LARGE = "Request too large";

/** The `event.postData` fields the check reads, typed loosely: Apps Script fills them, a caller shapes them. */
export interface PostData {
  readonly type?: unknown;
  readonly length?: unknown;
  readonly contents?: unknown;
}

/** Media type of a Content-Type value: lower case, cut at the first `;`, trimmed. A non-string gives "". */
export function mediaType(type: unknown): string {
  if (typeof type !== "string") return "";
  return (type.toLowerCase().split(";")[0] ?? "").trim();
}

/** `postData.length` when it is a finite whole number >= 0, else 0. */
function declaredLength(length: unknown): number {
  return typeof length === "number" && Number.isInteger(length) && length >= 0
    ? length
    : 0;
}

/**
 * Size for the cap: the larger of a valid `length` and `contents.length`, so a negative or small `length` cannot
 * hide a long body. Infinity is no whole number; a long `contents` still refuses.
 */
export function bodyLength(length: unknown, contents: string): number {
  return Math.max(declaredLength(length), contents.length);
}

/**
 * The refusal message for a request, or null when it may go on to `JSON.parse` and dispatch. Reads `type`,
 * `contents` and `length`; a getter on them can throw, so the caller treats a throw as UNSUPPORTED_TYPE.
 */
export function frontDoorRefusal(
  postData: PostData | null | undefined,
): string | null {
  if (postData === undefined || postData === null) return UNSUPPORTED_TYPE;
  if (mediaType(postData.type) !== "application/json") return UNSUPPORTED_TYPE;
  const { contents } = postData;
  if (typeof contents !== "string") return UNSUPPORTED_TYPE;
  return bodyLength(postData.length, contents) > MAX_POST_BYTES
    ? TOO_LARGE
    : null;
}
