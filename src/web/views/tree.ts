import { buildTree, visibleNodes, type TreeNode } from "../library/model";
import type { FolderRow } from "../rpc/api";
import { h, replace } from "../ui/dom";

/**
 * Folder tree (spec section 8): `role="tree"`, one tab stop. Up and Down move, Right expands or enters,
 * Left collapses or goes to the parent, Home and End jump, Enter or Space opens the folder.
 * The first row, `rootLabel` ("All templates" in the library), has the empty folder ID.
 */
export interface FolderTree {
  readonly element: HTMLElement;
  render(folders: readonly FolderRow[], selected: string): void;
}

interface Row {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly parentId: string;
  readonly hasChildren: boolean;
}

function rowsOf(
  roots: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  rootLabel: string,
): Row[] {
  return [
    {
      id: "",
      name: rootLabel,
      depth: 1,
      parentId: "",
      hasChildren: false,
    },
    ...visibleNodes(roots, expanded).map((node) => ({
      id: node.folder.id,
      name: node.folder.name,
      depth: node.depth,
      parentId: node.depth === 1 ? "" : node.folder.parentId,
      hasChildren: node.children.length > 0,
    })),
  ];
}

export function createFolderTree(
  onOpen: (folderId: string) => void,
  rootLabel = "All templates",
): FolderTree {
  const list = h("ul", {
    role: "tree",
    "aria-label": "Folders",
    class: "tree",
  });
  const expanded = new Set<string>();
  let roots: TreeNode[] = [];
  let selected = "";
  let focused = "";

  const draw = (focus: boolean) => {
    const rows = rowsOf(roots, expanded, rootLabel);
    if (!rows.some((row) => row.id === focused)) focused = selected;
    replace(list, ...rows.map((row) => item(row)));
    if (focus) list.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  };

  const item = (row: Row) => {
    const li = h(
      "li",
      {
        role: "treeitem",
        "aria-level": row.depth,
        "aria-selected": String(row.id === selected),
        "aria-expanded": row.hasChildren
          ? String(expanded.has(row.id))
          : undefined,
        tabindex: row.id === focused ? "0" : "-1",
        class: "tree-item",
        style: `padding-left: ${String(row.depth * 12)}px`,
        onclick: () => {
          li.focus();
          focused = row.id;
          if (row.hasChildren) expanded.add(row.id);
          onOpen(row.id);
        },
      },
      row.hasChildren
        ? h(
            "span",
            { class: "twisty", "aria-hidden": "true" },
            expanded.has(row.id) ? "▾" : "▸",
          )
        : null,
      row.name,
    );
    li.dataset["id"] = row.id;
    return li;
  };

  const keyAction = (
    key: string,
    rows: Row[],
    index: number,
  ): (() => void) | null => {
    const row = rows[index];
    if (row === undefined) return null;
    const moveTo = (target: Row | undefined) => () => {
      if (target !== undefined) focused = target.id;
    };
    switch (key) {
      case "ArrowDown":
        return moveTo(rows[index + 1]);
      case "ArrowUp":
        return moveTo(rows[index - 1]);
      case "Home":
        return moveTo(rows[0]);
      case "End":
        return moveTo(rows[rows.length - 1]);
      case "ArrowRight":
        if (!row.hasChildren) return null;
        return expanded.has(row.id)
          ? moveTo(rows[index + 1])
          : () => {
              expanded.add(row.id);
            };
      case "ArrowLeft":
        if (row.hasChildren && expanded.has(row.id))
          return () => {
            expanded.delete(row.id);
          };
        return moveTo(
          rows.find(
            (candidate) => candidate.id === row.parentId && row.depth > 1,
          ),
        );
      default:
        return null;
    }
  };

  list.addEventListener("keydown", (event) => {
    const rows = rowsOf(roots, expanded, rootLabel);
    const index = rows.findIndex((row) => row.id === focused);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(focused);
      return;
    }
    const action = keyAction(event.key, rows, index);
    if (action === null) return;
    event.preventDefault();
    action();
    draw(true);
  });

  return {
    element: list,
    render: (folders, folderId) => {
      roots = buildTree(folders);
      selected = folderId;
      focused = folderId;
      for (const id of ancestorsOf(folders, folderId)) expanded.add(id);
      // Redrawing replaces the rows; a tree that had focus keeps it on the selected row.
      draw(list.contains(document.activeElement));
    },
  };
}

/** IDs of the selected folder's ancestors, expanded so the selection is visible. */
function ancestorsOf(
  folders: readonly FolderRow[],
  folderId: string,
): string[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: string[] = [];
  let folder = byId.get(folderId);
  while (
    folder !== undefined &&
    folder.parentId !== "" &&
    !path.includes(folder.parentId)
  ) {
    path.push(folder.parentId);
    folder = byId.get(folder.parentId);
  }
  return path;
}
