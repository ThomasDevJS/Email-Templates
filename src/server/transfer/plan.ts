import type { Folder, IndexDoc } from "../../shared/model/data";
import { FOLDER_DEPTH_MAX, folderName } from "../../shared/model/validate";
import { ancestry, folderMap } from "../../shared/permissions/effective";
import type { ExportFolder, Parsed } from "./format";

/**
 * Pure placement of an import into the index (wireframe 06 Import). Folders of the file go under the target folder:
 * a folder whose name a live sibling already has is reused, so importing the same file twice adds nothing.
 * Templates go to their mapped folder (the target when the file names none); a template whose title is already in
 * that folder is skipped. Nothing here writes; the handler runs it before the lock (Validate) and inside it (Import).
 */
/** `imported`: placed with a change the report names (dropped recipient addresses, spec 5.7). */
export type Outcome = "created" | "imported" | "skipped" | "failed";

export interface ReportLine {
  readonly kind: "folder" | "template";
  readonly name: string;
  readonly outcome: Exclude<Outcome, "created">;
  readonly reason: string;
}

/** Builds a new shared folder record; the handler supplies ID and stamps. */
export type MakeFolder = (
  parentId: string,
  name: string,
  sortOrder: number,
) => Folder;

export interface FolderPlan {
  /** File folder ID to index folder ID, for every placed folder. */
  readonly mapping: ReadonlyMap<string, string>;
  /** File folder IDs that could not be placed; their templates fail. */
  readonly failed: ReadonlySet<string>;
  readonly created: readonly Folder[];
  readonly reused: number;
  readonly lines: readonly ReportLine[];
}

const lower = (text: string) => text.trim().toLowerCase();

function liveChildren(folders: readonly Folder[], parentId: string): Folder[] {
  return folders.filter((f) => f.parentId === parentId && f.deletedAt === "");
}

function nameProblem(name: string): string {
  try {
    folderName(name);
    return "";
  } catch (error: unknown) {
    return error instanceof Error
      ? error.message
      : "The folder name is not valid.";
  }
}

/** Parents first: a folder is placed once its parent is placed or is not in the file (then the target). */
export function planFolders(
  index: IndexDoc,
  targetId: string,
  records: readonly Parsed<ExportFolder>[],
  make: MakeFolder,
): FolderPlan {
  const folders: Folder[] = [...index.folders];
  const created: Folder[] = [];
  const mapping = new Map<string, string>();
  const failed = new Set<string>();
  const lines: ReportLine[] = [];
  const depth = new Map<string, number>([
    [targetId, ancestry(targetId, folderMap(index.folders)).length],
  ]);
  const fail = (label: string, reason: string, id = "") => {
    if (id !== "") failed.add(id);
    lines.push({ kind: "folder", name: label, outcome: "failed", reason });
  };
  const valid = records.flatMap((record) => {
    if (record.ok) return [record];
    fail(record.label, record.reason);
    return [];
  });
  const inFile = new Set(valid.map((record) => record.value.id));
  let pending = valid;
  let reused = 0;
  for (let progress = true; progress && pending.length > 0;) {
    progress = false;
    const later: typeof pending = [];
    for (const record of pending) {
      const { id, parentId, name } = record.value;
      const fromFile = inFile.has(parentId) && parentId !== id;
      if (fromFile && failed.has(parentId)) {
        fail(record.label, "Its parent folder was not imported.", id);
        progress = true;
        continue;
      }
      const parent = fromFile ? mapping.get(parentId) : targetId;
      if (parent === undefined) {
        later.push(record);
        continue;
      }
      progress = true;
      const problem = nameProblem(name);
      const level = (depth.get(parent) ?? 0) + 1;
      if (problem !== "") fail(record.label, problem, id);
      else if (level > FOLDER_DEPTH_MAX)
        fail(
          record.label,
          `A folder can be at most ${String(FOLDER_DEPTH_MAX)} levels deep.`,
          id,
        );
      else {
        const siblings = liveChildren(folders, parent);
        const same = siblings.find(
          (f) => f.kind === "shared" && lower(f.name) === lower(name),
        );
        const folder = same ?? make(parent, name.trim(), siblings.length);
        if (same === undefined) {
          folders.push(folder);
          created.push(folder);
        } else reused += 1;
        mapping.set(id, folder.id);
        depth.set(folder.id, level);
      }
    }
    pending = later;
  }
  for (const record of pending)
    fail(
      record.label,
      "Its parent folders form a loop in the file.",
      record.value.id,
    );
  return { mapping, failed, created, reused, lines };
}

/** Index folder of a template: its mapped folder, the target when the file names none, null when that folder failed. */
export function folderFor(
  plan: FolderPlan,
  targetId: string,
  fileFolderId: string,
): string | null {
  if (plan.failed.has(fileFolderId)) return null;
  return plan.mapping.get(fileFolderId) ?? targetId;
}

/** Titles (lower case) of live templates per folder, to skip a template already present. */
export function titlesByFolder(index: IndexDoc): Map<string, Set<string>> {
  const titles = new Map<string, Set<string>>();
  for (const item of index.items) {
    if (item.deletedAt !== "") continue;
    const set = titles.get(item.folderId) ?? new Set<string>();
    set.add(lower(item.title));
    titles.set(item.folderId, set);
  }
  return titles;
}

/** True when the title is new in the folder; records it, so a second copy in the same file is skipped. */
export function claimTitle(
  titles: Map<string, Set<string>>,
  folderId: string,
  title: string,
): boolean {
  const set = titles.get(folderId) ?? new Set<string>();
  titles.set(folderId, set);
  if (set.has(lower(title))) return false;
  set.add(lower(title));
  return true;
}
