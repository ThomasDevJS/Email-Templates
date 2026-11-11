import type { PrincipalType } from "../../shared/model/data";
import { FOLDER_NAME_MAX, TRASH_DAYS } from "../../shared/model/validate";
import { folderPath, subtreeIds } from "../library/model";
import type {
  SettingEntry,
  SettingName,
  SettingValue,
} from "../../shared/model/settings";
import type { FolderRow, GrantRow } from "../rpc/api";
import { formatTime } from "../ui/dom";

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
  ou: "org unit",
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
      ? grant.sourcePath === ""
        ? "a parent folder"
        : `${displayPath(grant.sourcePath)} (parent folder)`
      : "this folder",
    note: grant.active
      ? ""
      : "Not active yet. Org units do not give access in this version.",
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

/** Spec 7.3 texts of one admin setting (D29); `domain` is Script Property `DOMAIN`. */
export interface SettingTexts {
  readonly legend: string;
  readonly explanation: string;
  readonly options: readonly (readonly [SettingValue, string])[];
  readonly saved: (value: SettingValue) => string;
  /** The value whose Save asks first (it takes something away from users), with the dialog texts. */
  readonly confirm: {
    readonly value: SettingValue;
    readonly title: string;
    readonly body: string;
    readonly action: string;
  };
}

export function settingTexts(name: SettingName, domain: string): SettingTexts {
  if (name === "personalTemplates")
    return {
      legend: "Personal templates",
      explanation:
        "Users can create their own templates in My templates. When off, users keep and can insert the personal templates they have, but cannot create, change or delete them.",
      options: [
        ["on", "On"],
        ["off", "Off"],
      ],
      saved: (value) =>
        `Saved. Personal templates are ${value} for every user from their next action.`,
      confirm: {
        value: "off",
        title: "Turn off personal templates?",
        body: "Users can no longer create, change or delete templates in My templates. Nothing is deleted: their templates stay, can still be inserted, and can be changed again when you turn this on.",
        action: "Turn off",
      },
    };
  return {
    legend: "Outside recipients",
    explanation: `Templates can add addresses outside ${domain} to To, Cc and Bcc. With "${domain} only", a template with an outside address cannot be saved and Insert skips the address.`,
    options: [
      ["allow", "Allowed"],
      ["deny", `${domain} only`],
    ],
    saved: (value) =>
      value === "deny"
        ? `Saved. Only ${domain} recipients are allowed.`
        : "Saved. Outside recipients are allowed.",
    confirm: {
      value: "deny",
      title: `Allow only ${domain} recipients?`,
      body: "Templates keep their outside addresses, but Insert no longer adds them. A template with an outside address cannot be saved until the address is removed.",
      action: `Allow only ${domain}`,
    },
  };
}

const namePart = (email: string): string => email.split("@")[0] ?? "";

/** "Last change: ana on Nov 10, 2:05 PM." or "Default, never changed." (spec 7.3). */
export function lastChangeText(entry: SettingEntry, now?: Date): string {
  return entry.updatedAt === ""
    ? "Default, never changed."
    : `Last change: ${namePart(entry.updatedBy)} on ${formatTime(entry.updatedAt, "date", now)}.`;
}

/** "ana changed this setting on Nov 10, 2:05 PM. The page now shows the current value." (spec 7.3). */
export function conflictText(entry: SettingEntry, now?: Date): string {
  return `${namePart(entry.updatedBy)} changed this setting on ${formatTime(entry.updatedAt, "date", now)}. The page now shows the current value.`;
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
  const head = report.dryRun ? "Checked. Import would create" : "Imported";
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
      return "Org unit path, for example /Field. Saved, but not active yet.";
  }
}
