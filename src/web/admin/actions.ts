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

/**
 * "Empty trash" result in the unit of its dialog: templates, then the deleted folders that went with them.
 * `purged` counts both (server `trash.purge`); `before` and `after` are the trash rows around the purge.
 */
export function purgeText(
  before: number,
  after: number,
  purged: number,
): string {
  const templates = Math.min(purged, Math.max(0, before - after));
  const folders = purged - templates;
  const plural = (n: number, word: string) =>
    `${String(n)} ${word}${n === 1 ? "" : "s"}`;
  return folders === 0
    ? `Emptied the trash: ${plural(templates, "template")} removed for good.`
    : `Emptied the trash: ${plural(templates, "template")} and ${plural(folders, "deleted folder")} removed for good.`;
}
