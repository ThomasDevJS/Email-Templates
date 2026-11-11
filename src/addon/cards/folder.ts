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
 * The row's one filled button per entry (spec 7.2): compose "Insert"; side panel "New email" with no message open,
 * "Reply" with one open, as compose actions (`onCompose`). Q74 fallback, if a row compose button fails in Gmail:
 * no button in the side panel, so rows keep only the tap to the details card.
 */
function rowButton(template: SidebarTemplate, entry: Entry): ButtonSpec {
  if (entry === "compose") return insertButton(template);
  return composeButton(
    entry === "message" ? "reply" : "new",
    template.title,
    "onCompose",
    rowParams(template),
    "filled",
  );
}

export function folderItem(folder: SidebarFolder): Widget {
  return {
    kind: "item",
    icon: "folder",
    text: folder.name,
    bottomLabel: templatesLabel(folder.count),
    onClick: action("onOpenFolder", { folderId: folder.id, page: "1" }),
  };
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
 * One row layout in every list: the icon of its section, the title, the hints and folder path ("" on a folder card)
 * below, a tap that opens the details card, and the row button of the entry.
 */
export function templateItem(
  template: SidebarTemplate,
  entry: Entry,
  path: string,
  icon: IconName,
): Widget {
  const bottom = rowLabel(template, path);
  return {
    kind: "item",
    icon,
    text: template.title,
    ...(bottom === "" ? {} : { bottomLabel: bottom }),
    onClick: action("onPreview", { id: template.id }),
    button: rowButton(template, entry),
  };
}

/** A list section; none without rows (Card Service rejects an empty section), collapsible past `VISIBLE_ROWS`. */
export function listSection(
  header: string,
  rows: readonly Widget[],
): SectionSpec[] {
  if (rows.length === 0) return [];
  return [
    rows.length > VISIBLE_ROWS
      ? { header, widgets: rows, collapseAfter: VISIBLE_ROWS }
      : { header, widgets: rows },
  ];
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
    widgets: shown.map((template) =>
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
      ...listSection("Folders", children.map(folderItem)),
      ...list,
      ...sidePanelHint(entry),
    ],
    footer: LIBRARY_FOOTER,
  };
}
