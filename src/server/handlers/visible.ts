import type { Folder, Item, Level } from "../../shared/model/data";
import { ancestry, folderMap } from "../../shared/permissions/effective";
import type { HandlerContext } from "../dispatch/context";

/**
 * Visible set (spec 5.11, ADR-0010 Decision 3): the one filter behind `sidebar.home` and `search`. A list op lets
 * every caller in, so this function keeps only what the caller holds `use` on.
 */

export interface VisibleFolder {
  readonly id: string;
  readonly name: string;
  /** Nearest visible ancestor, or "" when no ancestor is visible. */
  readonly parentId: string;
}

export interface VisibleTemplate {
  readonly item: Item;
  readonly folder: VisibleFolder;
  /** The caller's level on the template's folder. */
  readonly level: Level;
}

export interface VisibleLibrary {
  /** Display order of `sidebar.home`: shared folders by sort order and name, the caller's private tree last. */
  readonly folders: readonly VisibleFolder[];
  /** Live templates in visible folders, by title. */
  readonly templates: readonly VisibleTemplate[];
  /** The entries of `folders` by ID. */
  readonly folderById: ReadonlyMap<string, VisibleFolder>;
}

interface Candidate {
  readonly folder: Folder;
  readonly own: boolean;
  readonly level: Level;
}

/** Owner of the private tree the folder sits in, or "" for a shared folder. */
function privateOwner(folder: Folder, byId: ReadonlyMap<string, Folder>) {
  const top = ancestry(folder.id, byId).find((f) => f.kind === "private");
  return top?.ownerEmail.toLowerCase() ?? "";
}

/**
 * Live folders the caller can use. Other users' private folders stay out even for admins: the sidebar applies
 * templates, and every private folder is named "My templates".
 */
function candidates(context: HandlerContext): Map<string, Candidate> {
  const { index, levelOf } = context.access();
  const byId = folderMap(index.folders);
  const me = context.caller.email.toLowerCase();
  const visible = new Map<string, Candidate>();
  for (const folder of index.folders) {
    const level = levelOf(folder.id);
    if (folder.deletedAt !== "" || level === "none") continue;
    const owner = privateOwner(folder, byId);
    if (owner !== "" && owner !== me) continue;
    visible.set(folder.id, { folder, own: owner === me, level });
  }
  return visible;
}

/** Shared folders first by sort order and name, the caller's private folder last (wireframe 01). */
function folderOrder(a: Candidate, b: Candidate) {
  if (a.own !== b.own) return a.own ? 1 : -1;
  return (
    a.folder.sortOrder - b.folder.sortOrder ||
    a.folder.name.localeCompare(b.folder.name)
  );
}

export function visibleLibrary(context: HandlerContext): VisibleLibrary {
  const visible = candidates(context);
  const entries = [...visible.values()]
    .sort(folderOrder)
    .map(({ folder, level }) => ({
      level,
      folder: {
        id: folder.id,
        name: folder.name,
        parentId: visible.has(folder.parentId) ? folder.parentId : "",
      },
    }));
  const entryOf = new Map(entries.map((entry) => [entry.folder.id, entry]));
  const templates = context
    .access()
    .index.items.flatMap((item) => {
      const entry = entryOf.get(item.folderId);
      return item.deletedAt === "" && entry !== undefined
        ? [{ item, ...entry }]
        : [];
    })
    .sort((a, b) => a.item.title.localeCompare(b.item.title));
  const folders = entries.map((entry) => entry.folder);
  return {
    folders,
    templates,
    folderById: new Map(folders.map((folder) => [folder.id, folder])),
  };
}
