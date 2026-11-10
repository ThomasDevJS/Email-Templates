/**
 * Request IDs for both surfaces (spec section 11): 8 base-36 characters of the time in milliseconds, a dash and
 * 6 random base-36 characters, for example `MH9X4K2A-0F3ZQ1`. Short enough to read aloud from a toast or card.
 */
export function newRequestId(now: number, random: () => number): string {
  const time = Math.max(0, Math.floor(now))
    .toString(36)
    .toUpperCase()
    .padStart(8, "0");
  const tail = Math.floor(random() * 36 ** 6)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0");
  return `${time}-${tail}`;
}

/** The one accepted format. The server logs a client ID only when it matches. */
export const REQUEST_ID_PATTERN = /^[0-9A-Z]{8}-[0-9A-Z]{6}$/;

export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

/** Request ID from the runtime clock and `Math.random`. */
export function requestIdNow(): string {
  return newRequestId(Date.now(), Math.random);
}
