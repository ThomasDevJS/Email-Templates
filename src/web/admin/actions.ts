import type { ExportPageCounts } from "../../shared/model/data";

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
    "template.delete": "Template moved to trash",
    "template.restoreFromTrash": "Template restored from trash",
    "template.apply": "Template inserted",
    "template.get": "Template opened",
    "template.getBody": "Template body read",
    "template.list": "Templates listed",
    "version.list": "Versions listed",
    "version.get": "Version opened",
    "version.restore": "Version restored",
    "folder.create": "Folder created",
    "folder.rename": "Folder renamed",
    "folder.move": "Folder moved",
    "folder.delete": "Folder deleted",
    "folder.list": "Folders listed",
    "grant.add": "Grant added",
    "grant.remove": "Grant removed",
    "grant.list": "Grants listed",
    "favorite.set": "Favorite added",
    "favorite.unset": "Favorite removed",
    "trash.purge": "Removed from trash for good",
    "backup.restore": "Backup restored",
    "backup.list": "Backups listed",
    "export.folder": "Folder exported",
    "export.library": "Library exported",
    import: "Templates imported",
    "membership.refresh": "Memberships refreshed",
    "membership.status": "Memberships viewed",
    "config.get": "Config viewed",
    "config.set": "Setting changed",
    "audit.query": "Audit log viewed",
    "audit.dropped": "Audit events dropped",
    "usage.report": "Usage viewed",
    "admin.folders": "Admin view opened",
    "sidebar.home": "Gmail sidebar opened",
    search: "Templates searched",
    "search.body": "Template text searched",
    "web.open": "Web app opened",
    "triggers.ensure": "Triggers installed",
  }),
);

export function actionWords(action: string): string {
  return ACTION_WORDS.get(action) ?? action;
}

/** "templates 1 to 20 of 25", "all 3 templates", "no templates (offset 30 of 25)": one export page in words. */
export function exportPageText(page: ExportPageCounts): string {
  const { offset, templates, total } = page;
  if (templates === 0)
    return `no templates (from ${String(offset + 1)} of ${String(total)})`;
  if (offset === 0 && templates === total)
    return `all ${plural(total, "template")}`;
  return `templates ${String(offset + 1)} to ${String(offset + templates)} of ${String(total)}`;
}

/** Action words of an audit row; an export page adds its range ("Library exported, templates 21 to 25 of 25"). */
export function rowActionWords(row: {
  readonly action: string;
  readonly exportPage?: ExportPageCounts;
}): string {
  const words = actionWords(row.action);
  return row.exportPage === undefined
    ? words
    : `${words}, ${exportPageText(row.exportPage)}`;
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
  return `Empty the trash? ${what} removed for good, and deleted folders go too. This cannot be undone.`;
}

/** "Empty trash" result from the server's counts (`trash.purge` `templates`, `folders`). */
export function purgeText(templates: number, folders: number): string {
  return folders === 0
    ? `Emptied the trash: ${plural(templates, "template")} removed for good.`
    : `Emptied the trash: ${plural(templates, "template")} and ${plural(folders, "deleted folder")} removed for good.`;
}
