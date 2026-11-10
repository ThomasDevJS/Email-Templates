import { AppError, ErrorCode } from "../errors/codes";
import type { Folder } from "./data";

/** Field rules of spec section 5 and the ADR-0004 body size cap. Every failure is a VALIDATION error. */
export const FOLDER_NAME_MAX = 80;
/** Grant principal key (email, domain or OU path): 254, the email address limit, fits all 4 types. */
export const PRINCIPAL_KEY_MAX = 254;
/** Folder levels counted from the top (top level = 1). Slice 6a assumption: spec 5.1 names no number yet. */
export const FOLDER_DEPTH_MAX = 5;
/** Days a soft-deleted template stays in the trash before the daily purge (spec section 16). */
export const TRASH_DAYS = 30;
export const TITLE_MAX = 120;
export const TAGS_MAX = 10;
export const TAG_MAX = 30;
export const BODY_MAX_BYTES = 100 * 1024;

function fail(message: string): never {
  throw new AppError(ErrorCode.VALIDATION, message);
}

function lengthBetween(value: string, max: number, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max)
    fail(`${field} must be 1 to ${String(max)} characters`);
  return trimmed;
}

export function folderName(value: string): string {
  return lengthBetween(value, FOLDER_NAME_MAX, "Folder name");
}

export function templateTitle(value: string): string {
  return lengthBetween(value, TITLE_MAX, "Title");
}

export function tagList(values: readonly string[]): string[] {
  if (values.length > TAGS_MAX) fail(`At most ${String(TAGS_MAX)} tags`);
  const tags = values.map((tag) => lengthBetween(tag, TAG_MAX, "Tag"));
  return [...new Set(tags)];
}

/**
 * Names are unique among live siblings, case-insensitive. Private folders (D11) are compared only with
 * other private folders of the same owner, so every user can have "My templates".
 */
export function uniqueSiblingName(
  folders: readonly Folder[],
  candidate: Pick<Folder, "id" | "parentId" | "name" | "kind" | "ownerEmail">,
): void {
  const name = candidate.name.toLowerCase();
  const clash = folders.some(
    (folder) =>
      folder.id !== candidate.id &&
      folder.deletedAt === "" &&
      folder.parentId === candidate.parentId &&
      folder.kind === candidate.kind &&
      folder.ownerEmail === candidate.ownerEmail &&
      folder.name.toLowerCase() === name,
  );
  if (clash) fail(`A folder named ${candidate.name} already exists here`);
}
