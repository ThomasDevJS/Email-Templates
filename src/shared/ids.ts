/**
 * 26-character time-sortable IDs (spec section 5): 10 Crockford base32 characters of milliseconds,
 * then 16 random characters. IDs made in the same millisecond sort by their random part.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_CHARS = 10;
const RANDOM_CHARS = 16;

/** `randomIndex(n)` returns an integer in `[0, n)`. */
export type RandomIndex = (n: number) => number;

/**
 * A RandomIndex for 16 characters of a 32-character alphabet from a SHA-256 hex digest of a fresh UUID (Apps Script
 * draws UUIDs from a secure generator; `Math.random` is not one). Each call reads the next byte; 32 divides 256.
 */
export function digestIndex(digestHex: string): RandomIndex {
  let at = 0;
  return (n) => {
    const byte = parseInt(digestHex.slice(at, at + 2), 16);
    at += 2;
    return byte % n;
  };
}

function encodeTime(ms: number): string {
  let rest = Math.max(0, Math.floor(ms));
  let out = "";
  for (let i = 0; i < TIME_CHARS; i++) {
    out = ALPHABET.charAt(rest % 32) + out;
    rest = Math.floor(rest / 32);
  }
  return out;
}

export function makeId(nowMs: number, randomIndex: RandomIndex): string {
  let random = "";
  for (let i = 0; i < RANDOM_CHARS; i++) {
    random += ALPHABET.charAt(randomIndex(ALPHABET.length));
  }
  return encodeTime(nowMs) + random;
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}
