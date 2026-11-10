import type { PrincipalType } from "../../shared/model/data";
import { FOLDER_NAME_MAX, TRASH_DAYS } from "../../shared/model/validate";
import { folderPath, subtreeIds } from "../library/model";
import type { FolderRow, GrantRow } from "../rpc/api";

/** Pure logic of the admin view (wireframe 06) and the trash (wireframe 07 H). The server checks every action. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until the daily purge removes a template deleted at `deletedAt`; 0 when due. */
export function daysLeft(deletedAt: string, nowMs: number): number {
  const deleted = Date.parse(deletedAt);
  if (Number.isNaN(deleted)) return 0;
  return Math.max(
    0,
    Math.ceil((deleted + TRASH_DAYS * DAY_MS - nowMs) / DAY_MS),
  );
}

/** Error text for a folder name, "" when valid (spec 5.1: 1 to 80 characters). */
export function folderNameProblem(value: string): string {
  const length = value.trim().length;
  return length >= 1 && length <= FOLDER_NAME_MAX
    ? ""
    : `Folder name must be 1 to ${String(FOLDER_NAME_MAX)} characters.`;
}

/**
 * Parents a folder may move under: shared folders outside its own subtree, other than its current parent, and
 * "Top level" for admins. Private folders never move and never take shared folders (D11).
 */
export function folderMoveTargets(
  folders: readonly FolderRow[],
  folder: FolderRow,
  isAdmin: boolean,
): { id: string; label: string }[] {
  const inside = subtreeIds(folders, folder.id);
  const options = folders
    .filter((candidate) => candidate.kind === "shared")
    .filter((candidate) => !inside.has(candidate.id))
    .filter((candidate) => candidate.id !== folder.parentId)
    .map((candidate) => ({
      id: candidate.id,
      label: folderPath(folders, candidate.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return isAdmin && folder.parentId !== ""
    ? [{ id: "", label: "Top level" }, ...options]
    : options;
}

const PRINCIPAL_LABEL: Readonly<Record<PrincipalType, string>> = {
  group: "group",
  user: "user",
  domain: "domain",
  ou: "OU",
};

export interface AccessRow {
  readonly grant: GrantRow;
  readonly principal: string;
  readonly source: string;
  /** Text for an OU grant: stored, but the resolver cannot apply it (D17, Q4). */
  readonly note: string;
}

/** `/Sales/Quotes` as "Sales / Quotes". */
export function displayPath(path: string): string {
  return path.replace(/^\//, "").split("/").join(" / ");
}

/** Effective access table rows: principal, level and source ("this folder" or the ancestor path). */
export function accessRows(grants: readonly GrantRow[]): AccessRow[] {
  return grants.map((grant) => ({
    grant,
    principal: `${PRINCIPAL_LABEL[grant.principalType]} ${grant.principalKey}`,
    source: grant.inherited
      ? `${displayPath(grant.sourcePath)} (inherited)`
      : "this folder",
    note: grant.active
      ? ""
      : "Inactive: OU resolution needs the Directory resolver",
  }));
}

/** What the principal field asks for, per type. */
export function principalHint(type: PrincipalType): string {
  switch (type) {
    case "group":
      return "Group email, for example sales@migway.com";
    case "user":
      return "User email";
    case "domain":
      return "Domain, for example migway.com";
    case "ou":
      return "OU path, for example /Field. Stored, inactive in v1";
  }
}
