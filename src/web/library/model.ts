import { atLeast } from "../../shared/permissions/levels";
import type { FolderRow, ItemRow } from "../rpc/api";

/** Pure library logic: folder tree, folder paths and the client-side filter (spec 4.4 web app). */

export interface TreeNode {
  readonly folder: FolderRow;
  readonly depth: number;
  readonly children: TreeNode[];
}

function byOrder(a: FolderRow, b: FolderRow): number {
  if (a.kind !== b.kind) return a.kind === "shared" ? -1 : 1;
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/** Visible folders as a forest. A folder whose parent is not visible shows at the top level. */
export function buildTree(folders: readonly FolderRow[]): TreeNode[] {
  const ids = new Set(folders.map((folder) => folder.id));
  const build = (parentId: string, depth: number): TreeNode[] =>
    folders
      .filter((folder) =>
        parentId === ""
          ? folder.parentId === "" || !ids.has(folder.parentId)
          : folder.parentId === parentId,
      )
      .sort(byOrder)
      .map((folder) => ({
        folder,
        depth,
        children: build(folder.id, depth + 1),
      }));
  return build("", 1);
}

/** Tree nodes in display order, skipping children of collapsed nodes. */
export function visibleNodes(
  roots: readonly TreeNode[],
  expanded: ReadonlySet<string>,
): TreeNode[] {
  return roots.flatMap((node) => [
    node,
    ...(expanded.has(node.folder.id)
      ? visibleNodes(node.children, expanded)
      : []),
  ]);
}

/** "Sales / Quotes" for a folder, from visible ancestors. */
export function folderPath(
  folders: readonly FolderRow[],
  folderId: string,
): string {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  const seen = new Set<string>();
  for (
    let folder = byId.get(folderId);
    folder !== undefined && !seen.has(folder.id);
    folder = byId.get(folder.parentId)
  ) {
    seen.add(folder.id);
    names.unshift(folder.name);
  }
  return names.join(" / ");
}

/** IDs of a folder and every visible descendant. */
export function subtreeIds(
  folders: readonly FolderRow[],
  folderId: string,
): Set<string> {
  const ids = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Lower case without accents, for matching. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Items whose title, folder path or tags contain every query word (case and accent insensitive). Slice 5 adds
 * the `folder:` and `tag:` operators, ranking and body matches.
 */
export function filterItems(
  items: readonly ItemRow[],
  folders: readonly FolderRow[],
  query: string,
): ItemRow[] {
  const words = fold(query)
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const haystack = fold(
      [item.title, folderPath(folders, item.folderId), ...item.tags].join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}

export type RowAction = "edit" | "duplicate" | "move" | "history" | "delete";

/** Folders other than the template's own where the caller holds edit: the targets the Move dialog offers. */
export function moveTargets(
  item: ItemRow,
  folders: readonly FolderRow[],
): { id: string; label: string }[] {
  return editableFolders(folders).filter(
    (option) => option.id !== item.folderId,
  );
}

/** Row menu entries the caller's level allows (wireframe 03). The server checks every one again. */
export function rowActions(
  item: ItemRow,
  folders: readonly FolderRow[],
): RowAction[] {
  if (!atLeast(item.level, "edit")) return [];
  return moveTargets(item, folders).length > 0
    ? ["edit", "duplicate", "move", "history", "delete"]
    : ["edit", "duplicate", "history", "delete"];
}

/** Folders where the caller may save a template (level edit or more), as select options. */
export function editableFolders(
  folders: readonly FolderRow[],
): { id: string; label: string }[] {
  return folders
    .filter((folder) => atLeast(folder.level, "edit"))
    .map((folder) => ({ id: folder.id, label: folderPath(folders, folder.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
