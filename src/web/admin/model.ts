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
  /** "group", "user", "domain" or "OU": read before the key, the icon shows it. */
  readonly typeLabel: string;
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
    typeLabel: PRINCIPAL_LABEL[grant.principalType],
    principal: `${PRINCIPAL_LABEL[grant.principalType]} ${grant.principalKey}`,
    source: grant.inherited
      ? `${displayPath(grant.sourcePath) || "a parent folder"} (inherited)`
      : "this folder",
    note: grant.active
      ? ""
      : "Inactive: OU resolution needs the Directory resolver",
  }));
}

/** Folders outside every private tree: the import targets (the server refuses private ones, review 6b minor 3). */
export function sharedFolders(folders: readonly FolderRow[]): FolderRow[] {
  const inside = new Set(
    folders
      .filter((folder) => folder.kind === "private")
      .flatMap((folder) => [...subtreeIds(folders, folder.id)]),
  );
  return folders.filter((folder) => !inside.has(folder.id));
}

/** "Sales Quotes!" as "sales-quotes"; "folder" when nothing is left. */
function slug(name: string): string {
  const cut = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return cut === "" ? "folder" : cut;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DD` of the browser's local day. */
export function localDate(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `migway-templates-<scope>-<date>.json` (spec 4.5): scope "library" or the folder name. */
export function exportFileName(
  scope: { readonly kind: "library" | "folder"; readonly name: string },
  now: Date,
): string {
  const name = scope.kind === "library" ? "library" : slug(scope.name);
  return `migway-templates-${name}-${localDate(now)}.json`;
}

/**
 * ISO instant of local midnight at the start of `day` (`YYYY-MM-DD` from a date input), or of the next day with
 * `nextDay`, so "date to" includes the whole day. "" for an empty or bad value.
 */
export function localDayStart(day: string, nextDay = false): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (match === null) return "";
  const [year, month, date] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, date + (nextDay ? 1 : 0)).toISOString();
}

/**
 * Config row "Outside recipients" (spec 5.7, `RECIPIENTS_EXTERNAL`): null while `config.get` does not return the
 * value, so the tab shows no row.
 */
export function recipientsText(
  value: "allow" | "deny" | undefined,
  domain: string,
): string | null {
  if (value === undefined) return null;
  const shown = value === "deny" ? `${domain} only` : "allowed";
  return `${shown} (set by the owner in Script Properties, RECIPIENTS_EXTERNAL)`;
}

/** "850 KB" or "3.10 MB". */
export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${String(Math.ceil(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export interface ImportCounts {
  readonly dryRun: boolean;
  readonly created: number;
  readonly skipped: number;
  readonly failed: number;
  readonly foldersCreated: number;
  readonly foldersReused: number;
  readonly subjectsFlattened: number;
}

/** Report sentence of Validate ("would create") and Import (wireframe 06: "40 ok, 2 skipped, 1 failed"). */
export function importSummary(report: ImportCounts): string {
  const head = report.dryRun ? "Validate: would create" : "Imported:";
  const flattened =
    report.subjectsFlattened === 0
      ? ""
      : ` ${String(report.subjectsFlattened)} subjects had line breaks, replaced by a space.`;
  return `${head} ${String(report.created)} templates, ${String(report.skipped)} skipped, ${String(report.failed)} failed. Folders: ${String(report.foldersCreated)} new, ${String(report.foldersReused)} existing.${flattened}`;
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
