import type {
  SidebarFolder,
  SidebarHome,
  SidebarTemplate,
} from "../../shared/model/sidebar";
import type { Entry } from "../event";
import { rowHint } from "./recipients";
import { composeButton, sidePanelHint } from "./sidePanel";
import {
  LIBRARY_FOOTER,
  action,
  hint,
  type ButtonSpec,
  type CardSpec,
  type IconName,
  type SectionSpec,
  type Widget,
} from "./spec";

/** Folder card (wireframe 01): subfolders, then templates 20 per page with Previous and Next. */
export const PAGE_SIZE = 20;
/** Rows shown while a long list section is collapsed. */
export const VISIBLE_ROWS = 5;
/**
 * Rows a list shows at most (Gmail: 100 widgets per card). With an email open a template row is 2 widgets. Worst
 * home card: search box and button 2 + Favorites 21 + Recent 11 + Folders 41 + hint 1 = 76; worst folder card:
 * Folders 41 + page 40 + pager 2 + hint 1 = 84; search 2 + 41 + 1 = 44. In compose the search row is Columns with
 * 2 widgets, counted as 3 to be safe; compose rows are 1 widget, so the compose home stays at 62 or less.
 * Favorites, Recent and search match the server's own caps.
 */
export const LIST_MAX = {
  favorites: 10,
  recent: 5,
  folders: 40,
  results: 20,
} as const;

export function fieldsLabel(count: number): string {
  return `${String(count)} field${count === 1 ? "" : "s"} to fill`;
}

export function templatesLabel(count: number): string {
  return `${String(count)} template${count === 1 ? "" : "s"}`;
}

/**
 * The row's one filled button (spec 7.4): Insert in one click. With a recipient hint it carries `rc`, the counts the
 * row showed; Insert compares them with the lists at insert time (ADR-0006 Amendment 2026-11-11).
 */
export function insertButton(template: SidebarTemplate): ButtonSpec {
  return {
    text: "Insert",
    alt: `Insert ${template.title}`,
    style: "filled",
    action: action("onInsert", rowParams(template)),
  };
}

/** `id`, plus `rc` when the row shows a recipient hint. */
function rowParams(template: SidebarTemplate): Record<string, string> {
  return rowHint(template.rc) === ""
    ? { id: template.id }
    : { id: template.id, rc: (template.rc ?? []).join(",") };
}

/**
 * The row's buttons per entry (spec 7.2, D33): compose "Insert"; side panel "New email" with no message open;
 * "Reply" (filled) and "Reply all" (outlined) with one open. Side-panel buttons are compose actions (`onCompose`).
 */
function rowButtons(
  template: SidebarTemplate,
  entry: Entry,
): [ButtonSpec, ...ButtonSpec[]] {
  if (entry === "compose") return [insertButton(template)];
  const params = rowParams(template);
  if (entry === "inbox")
    return [
      composeButton("new", template.title, "onCompose", params, "filled"),
    ];
  return [
    composeButton("reply", template.title, "onCompose", params, "filled"),
    composeButton("replyAll", template.title, "onCompose", params, "outlined"),
  ];
}

export function folderItem(folder: SidebarFolder): Widget[] {
  return [
    {
      kind: "item",
      icon: "folder",
      text: folder.name,
      bottomLabel: templatesLabel(folder.count),
      onClick: action("onOpenFolder", { folderId: folder.id, page: "1" }),
    },
  ];
}

/**
 * One plain-text line (spec 7.4): recipient hint, fields hint, folder path ("Adds Cc 1 · 2 fields to fill · Sales").
 * The recipient hint goes first so a cut label keeps it.
 */
function rowLabel(template: SidebarTemplate, path: string): string {
  const prompts = template.prompts.length;
  return [rowHint(template.rc), prompts > 0 ? fieldsLabel(prompts) : "", path]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * One row in every list: the icon of its section, the title, the hints and folder path ("" on a folder card) below,
 * a tap that opens the details card. One button sits in the row; two (Reply, Reply all) go in a button set right
 * under it, because a `DecoratedText` holds one button. So a row is 1 or 2 widgets.
 */
export function templateItem(
  template: SidebarTemplate,
  entry: Entry,
  path: string,
  icon: IconName,
): Widget[] {
  const bottom = rowLabel(template, path);
  const item = {
    kind: "item",
    icon,
    text: template.title,
    ...(bottom === "" ? {} : { bottomLabel: bottom }),
    onClick: action("onPreview", { id: template.id }),
  } as const;
  const [first, ...more] = rowButtons(template, entry);
  return more.length === 0
    ? [{ ...item, button: first }]
    : [item, { kind: "buttons", buttons: [first, ...more] }];
}

/**
 * A list section of rows (each 1 or 2 widgets); none without rows (Card Service rejects an empty section),
 * collapsible past `VISIBLE_ROWS` rows.
 */
export function listSection(
  header: string,
  rows: readonly (readonly Widget[])[],
): SectionSpec[] {
  if (rows.length === 0) return [];
  const widgets = rows.flat();
  const shown = rows.slice(0, VISIBLE_ROWS).flat().length;
  return [
    rows.length > VISIBLE_ROWS
      ? { header, widgets, collapseAfter: shown }
      : { header, widgets },
  ];
}

/** The last row of a cut list: how many show, and where the rest is. */
function moreLine(shown: number, total: number, noun: string): Widget {
  return hint(
    `Showing ${String(shown)} of ${String(total)} ${noun}. Use Search or Open library for the rest.`,
  );
}

/** At most `max` whole rows (a row is never split from its buttons), then `moreLine` when rows were cut. */
export function capped(
  rows: readonly (readonly Widget[])[],
  max: number,
  noun: string,
): (readonly Widget[])[] {
  return rows.length <= max
    ? [...rows]
    : [...rows.slice(0, max), [moreLine(max, rows.length, noun)]];
}

/** "Sales / Quotes": names from the top visible folder down. */
export function folderPath(view: SidebarHome, folderId: string): string {
  const all = [...view.folders, ...view.subfolders];
  const names: string[] = [];
  const seen = new Set<string>();
  let current = all.find((folder) => folder.id === folderId);
  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    const parentId = current.parentId;
    current = all.find((folder) => folder.id === parentId);
  }
  return names.join(" / ");
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** Page number from a callback parameter, clamped to 1..pages. */
export function clampPage(raw: string, pages: number): number {
  const page = Number.parseInt(raw, 10);
  return Number.isFinite(page) ? Math.min(Math.max(page, 1), pages) : 1;
}

function pager(folderId: string, page: number, pages: number): SectionSpec {
  const to = (target: number): ButtonSpec["action"] =>
    action("onOpenFolder", {
      folderId,
      page: String(target),
      nav: "page",
    });
  return {
    widgets: [
      { kind: "text", text: `Page ${String(page)} of ${String(pages)}` },
      {
        kind: "buttons",
        buttons: [
          { text: "Previous", action: to(page - 1), disabled: page <= 1 },
          { text: "Next", action: to(page + 1), disabled: page >= pages },
        ],
      },
    ],
  };
}

function templateSections(
  path: string,
  folderId: string,
  templates: SidebarTemplate[],
  page: number,
  entry: Entry,
): SectionSpec[] {
  if (templates.length === 0)
    return [{ widgets: [{ kind: "text", text: `No templates in ${path}.` }] }];
  const pages = pageCount(templates.length);
  const shown = templates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const list: SectionSpec = {
    widgets: shown.flatMap((template) =>
      // The card header already shows the path: rows show their hints only.
      templateItem(template, entry, "", "description"),
    ),
  };
  return pages > 1 ? [list, pager(folderId, page, pages)] : [list];
}

/** Null when the folder is not in the view (removed, or access lost since the view was cached). */
export function folderCard(
  view: SidebarHome,
  folderId: string,
  rawPage: string,
  entry: Entry,
): CardSpec | null {
  const path = folderPath(view, folderId);
  if (path === "") return null;
  const children = view.subfolders.filter((f) => f.parentId === folderId);
  const templates = view.templates.filter((t) => t.folderId === folderId);
  const page = clampPage(rawPage, pageCount(templates.length));
  const list =
    templates.length === 0 && children.length > 0
      ? []
      : templateSections(path, folderId, templates, page, entry);
  return {
    name: `folder-${folderId}`,
    title: path,
    sections: [
      ...listSection(
        "Folders",
        capped(children.map(folderItem), LIST_MAX.folders, "folders"),
      ),
      ...list,
      ...sidePanelHint(entry),
    ],
    footer: LIBRARY_FOOTER,
  };
}
