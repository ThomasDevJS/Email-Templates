import { displayPath } from "./model";

/**
 * Audit log wording (design system "Admin"): operation names in words, results as one word. The raw name stays in
 * the details drawer; an unknown name shows as it is.
 */
const ACTION_WORDS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    "template.create": "Template created",
    "template.update": "Template updated",
    "template.duplicate": "Template duplicated",
    "template.move": "Template moved",
    "template.delete": "Template deleted",
    "template.restoreFromTrash": "Template restored from trash",
    "template.apply": "Template inserted",
    "template.get": "Template opened",
    "template.getBody": "Template text read",
    "template.list": "Templates listed",
    "version.list": "Versions listed",
    "version.get": "Version opened",
    "version.restore": "Version restored",
    "folder.create": "Folder created",
    "folder.rename": "Folder renamed",
    "folder.move": "Folder moved",
    "folder.delete": "Folder deleted",
    "folder.list": "Folders listed",
    "grant.add": "Access given",
    "grant.remove": "Access removed",
    "grant.list": "Access list viewed",
    "favorite.set": "Favorite added",
    "favorite.unset": "Favorite removed",
    "trash.purge": "Trash emptied",
    "backup.restore": "Backup restored",
    "backup.list": "Backups listed",
    "export.folder": "Folder export started",
    "export.library": "Library export started",
    import: "Templates imported",
    "membership.refresh": "Groups refreshed",
    "membership.status": "Groups viewed",
    "config.get": "Settings viewed",
    "config.set": "Setting changed",
    "admin.add": "Admin added",
    "admin.remove": "Admin removed",
    "audit.query": "Audit log viewed",
    "audit.dropped": "Audit entries lost",
    "usage.report": "Usage viewed",
    "admin.folders": "Admin opened",
    "sidebar.home": "Gmail panel opened",
    search: "Templates searched",
    "search.body": "Template text searched",
    "web.open": "Library opened",
    "triggers.ensure": "Background jobs set up",
  }),
);

export function actionWords(action: string): string {
  return ACTION_WORDS.get(action) ?? action;
}

/**
 * Action words of an audit row; an export start adds its count and, for a folder, the path: "Library export
 * started, 25 templates", "Folder export started: Sales / Quotes, 12 templates".
 */
export function rowActionWords(row: {
  readonly action: string;
  readonly targetPath: string;
  readonly exportTemplates?: number;
}): string {
  const words = actionWords(row.action);
  if (row.exportTemplates === undefined) return words;
  const path = row.targetPath === "" ? "" : `: ${displayPath(row.targetPath)}`;
  return `${words}${path}, ${plural(row.exportTemplates, "template")}`;
}

/** The access a user had, in the words of the access table: "admin", "Can manage", "no access". */
const ROLE_WORDS: ReadonlyMap<string, string> = new Map([
  ["admin", "admin"],
  ["use", "Can use"],
  ["edit", "Can edit"],
  ["manage", "Can manage"],
]);

export function roleWords(role: string): string {
  return ROLE_WORDS.get(role) ?? "no access";
}

/** Result word and tint: the word is the tag, the tint repeats it. */
export type Tone = "ok" | "warn" | "bad" | "plain";

export function resultTag(result: string): { word: string; tone: Tone } {
  switch (result) {
    case "ok":
      return { word: "OK", tone: "ok" };
    case "denied":
      return { word: "Denied", tone: "bad" };
    case "error":
      return { word: "Error", tone: "bad" };
    case "conflict":
      return { word: "Conflict", tone: "warn" };
    default:
      return { word: result, tone: "plain" };
  }
}

/** "1 template", "2 templates". */
export function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** The "Empty trash" confirmation for the `count` templates in the list. */
export function emptyTrashQuestion(count: number): string {
  const what =
    count === 1
      ? "The 1 template in it is"
      : `All ${plural(count, "template")} in it are`;
  return `Empty the trash? ${what} deleted for good, and so are deleted folders. This cannot be undone.`;
}

/** "Empty trash" result from the server's counts (`trash.purge` `templates`, `folders`). */
export function purgeText(templates: number, folders: number): string {
  return folders === 0
    ? `Emptied the trash: ${plural(templates, "template")} deleted for good.`
    : `Emptied the trash: ${plural(templates, "template")} and ${plural(folders, "deleted folder")} deleted for good.`;
}
