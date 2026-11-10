import { folderPath } from "../library/model";
import type { FolderRow, ItemRow } from "../rpc/api";
import { formatTime, h } from "../ui/dom";
import { icon } from "../ui/icons";
import { openMenu, type MenuItem } from "../ui/menu";
import { person } from "../ui/person";
import { subjectAsMe } from "./preview";

/**
 * Template list (spec section 8): `role="grid"`, one tab stop on a cell. Arrow keys move between cells,
 * Home and End go to the row's first and last cell, Enter opens the editor. The row menu (wireframe 03) opens
 * with Enter on the Actions cell, Shift+F10 or the context menu key on any cell, or a click on Actions; Esc
 * closes it and focus returns to the cell. Enter or Space on the Favorite cell, or a click on the star, toggles
 * the favorite (wireframe 03). Columns hidden by the narrow layout (under 860 px) are skipped by the arrow keys.
 */
export interface GridActions {
  open(item: ItemRow): void;
  /** Menu entries the caller's level allows; empty hides the Actions button. */
  menu(item: ItemRow): MenuItem[];
  isFavorite(item: ItemRow): boolean;
  toggleFavorite(item: ItemRow): void;
}

const COLUMNS = [
  "Favorite",
  "Template",
  "Folder",
  "Tags",
  "Updated",
  "By",
  "Actions",
];
const STAR_CELL = 0;
const ACTIONS_CELL = COLUMNS.length - 1;
/** Columns whose head shows no text; the name stays for assistive technology. */
const QUIET_HEADS = new Set([STAR_CELL, ACTIONS_CELL]);

/** Star button text and name: the name says what a press does (spec section 8). */
function starButton(item: ItemRow, favorite: boolean): HTMLButtonElement {
  return h(
    "button",
    {
      type: "button",
      class: "icon-button star",
      tabindex: "-1",
      "aria-pressed": String(favorite),
      "aria-label": `${favorite ? "Remove from" : "Add to"} favorites: ${item.title}`,
    },
    icon("star"),
  );
}

/**
 * Title in weight 600, the subject under it with placeholders as "[Label]", or the snippet when the template has
 * no subject.
 */
export function titleBlock(item: ItemRow): HTMLElement {
  const second = subjectAsMe(
    item.subject === "" ? item.snippet : item.subject,
    null,
  );
  return h(
    "div",
    { class: "title-block" },
    h("span", { class: "row-title" }, item.title),
    second === "" ? null : h("span", { class: "row-sub" }, second),
  );
}

/** "Sales / Quotes" with quiet separators; the text stays the plain path. */
export function pathBlock(path: string): HTMLElement {
  return h(
    "span",
    { class: "path" },
    ...path
      .split(" / ")
      .flatMap((part, i) =>
        i === 0 ? [part] : [h("span", { class: "sep" }, " / "), part],
      ),
  );
}

function tagList(tags: readonly string[]): HTMLElement {
  return h(
    "span",
    { class: "tag-list" },
    ...tags.map((tag) => h("span", { class: "tag" }, tag)),
  );
}

const shown = (cell: Element | undefined): boolean =>
  cell !== undefined && getComputedStyle(cell).display !== "none";

/** Index of the first shown cell from `from` on in steps of `step`, or -1 when there is none. */
function shownCell(
  row: HTMLTableRowElement,
  from: number,
  step: number,
): number {
  for (let c = from; c >= 0 && c < row.cells.length; c += step)
    if (shown(row.cells[c])) return c;
  return -1;
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
      ArrowRight: [r, shownCell(row, c + 1, 1)],
      ArrowLeft: [r, shownCell(row, c - 1, -1)],
      Home: [r, shownCell(row, 0, 1)],
      End: [r, shownCell(row, COLUMNS.length - 1, -1)],
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
            class: "icon-button",
            "aria-haspopup": "menu",
            "aria-expanded": "false",
            "aria-label": `Actions for ${item.title}`,
          },
          icon("more"),
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
    cell(1, titleBlock(item)),
    cell(2, pathBlock(folderPath(folders, item.folderId))),
    cell(3, tagList(item.tags)),
    cell(4, formatTime(item.updatedAt)),
    cell(5, person(item.updatedBy)),
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
        ...COLUMNS.map((name, index) =>
          h(
            "th",
            { role: "columnheader", scope: "col" },
            QUIET_HEADS.has(index)
              ? h("span", { class: "sr-only" }, name)
              : name,
          ),
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
