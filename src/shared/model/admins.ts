import { isAddress, isOutside, RCPT_ADDRESS_MAX } from "./recipients";

/**
 * In-app admin list (D32, spec 5.8, ADR-0008 Amendment 2026-11-11): optional `admins` field of `index.json`,
 * changed only by `admin.add` and `admin.remove`. Absent reads as `[]`; nothing is written on read.
 */
export const ADMINS_MAX = 20;

export interface AdminEntry {
  readonly email: string;
  readonly addedAt: string;
  readonly addedBy: string;
}

/** Trimmed, lower case, spec 5.7 form, at most 254 characters, inside `domain`. */
export function isAdminAddress(email: string, domain: string): boolean {
  return (
    email.length <= RCPT_ADDRESS_MAX &&
    isAddress(email) &&
    !isOutside(email, domain)
  );
}

function wellFormed(entry: unknown, domain: string): entry is AdminEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const { email, addedAt, addedBy } = entry as Record<string, unknown>;
  return (
    typeof email === "string" &&
    isAdminAddress(email.trim().toLowerCase(), domain) &&
    typeof addedAt === "string" &&
    typeof addedBy === "string"
  );
}

/** The well-formed entries of a stored `admins` value. A malformed entry or list grants nothing and fails nothing. */
export function adminEntriesOf(stored: unknown, domain: string): AdminEntry[] {
  if (!Array.isArray(stored) || domain.trim() === "") return [];
  return stored
    .filter((entry) => wellFormed(entry, domain))
    .map(({ email, addedAt, addedBy }: AdminEntry) => ({
      email: email.trim().toLowerCase(),
      addedAt,
      addedBy,
    }));
}

/** Lower-case addresses of the in-app admins of `index` (spec 5.8). */
export function appAdminsOf(
  index: { readonly admins?: unknown },
  domain: string,
): string[] {
  return adminEntriesOf(index.admins, domain).map((entry) => entry.email);
}
