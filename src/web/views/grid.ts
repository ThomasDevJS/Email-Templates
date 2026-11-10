import { folderPath } from "../library/model";
import type { FolderRow, ItemRow } from "../rpc/api";
import { formatTime, h } from "../ui/dom";
import { openMenu, type MenuItem } from "../ui/menu";

/**
 * Template list (spec section 8): `role="grid"`, one tab stop on a cell. Arrow keys move between cells,
 * Home and End go to the row's first and last cell, Enter opens the editor. The row menu (wireframe 03) opens
 * with Enter on the Actions cell, Shift+F10 or the context menu key on any cell, or a click on Actions; Esc
 * closes it and focus returns to the cell. Enter or Space on the Favorite cell, or a click on the star, toggles
 * the favorite (wireframe 03).
 */
export interface GridActions {
  open(item: ItemRow): void;
  /** Menu entries the caller's level allows; empty hides the Actions button. */
  menu(item: ItemRow): MenuItem[];
  isFavorite(item: ItemRow): boolean;
  toggleFavorite(item: ItemRow): void;
}

const COLUMNS = ["Favorite", "Title", "Folder", "Updated", "By", "Actions"];
const STAR_CELL = 0;
const ACTIONS_CELL = COLUMNS.length - 1;

/** Star button text and name: the name says what a press does (spec section 8). */
function starButton(item: ItemRow, favorite: boolean): HTMLButtonElement {
  return h(
    "button",
    {
      type: "button",
      class: "star",
      tabindex: "-1",
      "aria-pressed": String(favorite),
      "aria-label": `${favorite ? "Remove from" : "Add to"} favorites: ${item.title}`,
    },
    favorite ? "★" : "☆",
  );
}

/** Moves the grid's one tab stop to `cell` and focuses it. */
export function focusCell(cell: HTMLTableCellElement): void {
  const table = cell.closest("table");
  for (const other of table?.querySelectorAll("td") ?? []) other.tabIndex = -1;
  cell.tabIndex = 0;
  cell.focus();
}

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

const opensMenu = (event: KeyboardEvent): boolean =>
  (event.key === "F10" && event.shiftKey) || event.key === "ContextMenu";

function itemRow(
  item: ItemRow,
  folders: readonly FolderRow[],
  actions: GridActions,
  first: boolean,
): HTMLTableRowElement {
  const cell = (index: number, ...children: (Node | string | null)[]) =>
    h(
      "td",
      { role: "gridcell", tabindex: first && index === 1 ? "0" : "-1" },
      ...children,
    );
  const open = () => {
    actions.open(item);
  };
  const entries = actions.menu(item);
  const menuButton =
    entries.length === 0
      ? null
      : h(
          "button",
          {
            type: "button",
            tabindex: "-1",
            class: "link",
            "aria-haspopup": "menu",
            "aria-expanded": "false",
            "aria-label": `Actions for ${item.title}`,
          },
          "Actions",
        );
  const showMenu = (returnTo: HTMLTableCellElement) => {
    if (menuButton === null) return;
    openMenu({
      label: `Actions for ${item.title}`,
      anchor: menuButton,
      items: entries,
      returnFocus: () => {
        focusCell(returnTo);
      },
    });
  };
  const star = starButton(item, actions.isFavorite(item));
  const toggle = () => {
    actions.toggleFavorite(item);
  };
  star.addEventListener("click", toggle);
  const row = h(
    "tr",
    { role: "row" },
    cell(STAR_CELL, star),
    cell(1, item.title),
    cell(2, folderPath(folders, item.folderId)),
    cell(3, formatTime(item.updatedAt)),
    cell(4, item.updatedBy),
    cell(ACTIONS_CELL, menuButton),
  );
  row.dataset["id"] = item.id;
  menuButton?.addEventListener("click", () => {
    showMenu(row.cells[ACTIONS_CELL] as HTMLTableCellElement);
  });
  row.addEventListener("keydown", (event) => {
    const cell = (event.target as HTMLElement).closest("td");
    if (cell === null) return;
    if (opensMenu(event)) {
      event.preventDefault();
      showMenu(cell);
    } else if (
      cell.cellIndex === STAR_CELL &&
      [" ", "Enter"].includes(event.key)
    ) {
      event.preventDefault();
      toggle();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (cell.cellIndex === ACTIONS_CELL) showMenu(cell);
      else open();
    }
  });
  row.addEventListener("dblclick", open);
  row.cells[1]?.addEventListener("click", open);
  return row;
}

export function templateGrid(
  items: readonly ItemRow[],
  folders: readonly FolderRow[],
  actions: GridActions,
  label = "Templates",
): HTMLTableElement {
  const table = h(
    "table",
    {
      role: "grid",
      "aria-label": label,
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
