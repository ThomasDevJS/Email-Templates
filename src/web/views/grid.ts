import { folderPath } from "../library/model";
import type { FolderRow, ItemRow } from "../rpc/api";
import { formatTime, h } from "../ui/dom";

/**
 * Template list (spec section 8): `role="grid"`, one tab stop on a cell. Arrow keys move between cells,
 * Home and End go to the row's first and last cell, Enter opens the editor (History in the last column).
 * The favorite star is disabled until slice 5 adds `favorite.set`.
 */
export interface GridActions {
  open(item: ItemRow): void;
  history(item: ItemRow): void;
}

const COLUMNS = ["Favorite", "Title", "Folder", "Updated", "By", "History"];

function cellKeys(table: HTMLTableElement): void {
  table.addEventListener("keydown", (event) => {
    const cell = (event.target as HTMLElement).closest("td");
    if (cell === null) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const rows = [...(table.tBodies[0]?.rows ?? [])];
    const r = rows.indexOf(row);
    const c = cell.cellIndex;
    const targets: Record<string, [number, number]> = {
      ArrowDown: [Math.min(r + 1, rows.length - 1), c],
      ArrowUp: [Math.max(r - 1, 0), c],
      ArrowRight: [r, Math.min(c + 1, COLUMNS.length - 1)],
      ArrowLeft: [r, Math.max(c - 1, 0)],
      Home: [r, 0],
      End: [r, COLUMNS.length - 1],
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = rows[target[0]]?.cells[target[1]];
    if (next === undefined) return;
    cell.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });
}

function itemRow(
  item: ItemRow,
  folders: readonly FolderRow[],
  actions: GridActions,
  first: boolean,
): HTMLTableRowElement {
  const cell = (index: number, ...children: (Node | string)[]) =>
    h(
      "td",
      { role: "gridcell", tabindex: first && index === 1 ? "0" : "-1" },
      ...children,
    );
  const open = () => {
    actions.open(item);
  };
  const row = h(
    "tr",
    { role: "row" },
    cell(
      0,
      h(
        "button",
        {
          type: "button",
          class: "star",
          disabled: true,
          tabindex: "-1",
          "aria-label": `Add to favorites: ${item.title}`,
          title: "Slice 5",
        },
        "☆",
      ),
    ),
    cell(1, item.title),
    cell(2, folderPath(folders, item.folderId)),
    cell(3, formatTime(item.updatedAt)),
    cell(4, item.updatedBy),
    cell(
      5,
      h(
        "button",
        {
          type: "button",
          tabindex: "-1",
          class: "link",
          "aria-label": `History of ${item.title}`,
          onclick: () => {
            actions.history(item);
          },
        },
        "History",
      ),
    ),
  );
  row.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if ((event.target as HTMLTableCellElement).cellIndex === 5)
      actions.history(item);
    else open();
  });
  row.addEventListener("dblclick", open);
  row.cells[1]?.addEventListener("click", open);
  return row;
}

export function templateGrid(
  items: readonly ItemRow[],
  folders: readonly FolderRow[],
  actions: GridActions,
): HTMLTableElement {
  const table = h(
    "table",
    {
      role: "grid",
      "aria-label": "Templates",
      class: "grid",
      "aria-rowcount": items.length + 1,
    },
    h(
      "thead",
      {},
      h(
        "tr",
        { role: "row" },
        ...COLUMNS.map((name) =>
          h("th", { role: "columnheader", scope: "col" }, name),
        ),
      ),
    ),
    h(
      "tbody",
      {},
      ...items.map((item, i) => itemRow(item, folders, actions, i === 0)),
    ),
  );
  cellKeys(table);
  return table;
}
