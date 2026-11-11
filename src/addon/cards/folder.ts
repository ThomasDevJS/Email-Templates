import type {
  SidebarFolder,
  SidebarHome,
  SidebarTemplate,
} from "../../shared/model/sidebar";
import type { Entry } from "../event";
import { rowHint } from "./recipients";
import {
  action,
  type ButtonSpec,
  type CardSpec,
  type SectionSpec,
  type Widget,
} from "./spec";

/** Folder card (wireframe 01): subfolders, then templates 20 per page with Prev and Next. */
export const PAGE_SIZE = 20;

export function fieldsLabel(count: number): string {
  return `${String(count)} field${count === 1 ? "" : "s"} to fill`;
}

export function insertButton(template: SidebarTemplate): ButtonSpec {
  return {
    text: "Insert",
    alt: `Insert ${template.title}`,
    action: action("onInsert", { id: template.id }),
  };
}

/**
 * Row button (spec 5.7): a template with recipients never inserts in one click. "Review" opens the preview card,
 * or the prompt card (through Insert) when the template has prompts; either card lists every address.
 */
export function rowButton(template: SidebarTemplate): ButtonSpec {
  if (rowHint(template.rc) === "") return insertButton(template);
  return {
    text: "Review",
    alt: `Review ${template.title}`,
    action:
      template.prompts.length > 0
        ? action("onInsert", { id: template.id })
        : action("onPreview", { id: template.id }),
  };
}

export function folderItem(folder: SidebarFolder): Widget {
  return {
    kind: "item",
    text: `${folder.name} (${String(folder.count)})`,
    onClick: action("onOpenFolder", { folderId: folder.id, page: "1" }),
  };
}

/**
 * Title, "n fields to fill", a line below (the recipient hint "Adds Cc 1" when the template has recipients, else the
 * snippet in folders and the folder path elsewhere), and Insert or Review in the compose toolbar only: from the side
 * panel a draft response does nothing (ADR-0007, interim fix of spec 13.7).
 */
export function templateItem(
  template: SidebarTemplate,
  entry: Entry,
  below = template.snippet,
): Widget {
  const prompts = template.prompts.length;
  const bottom = rowHint(template.rc) || below;
  return {
    kind: "item",
    text: template.title,
    ...(prompts > 0 ? { topLabel: fieldsLabel(prompts) } : {}),
    ...(bottom === "" ? {} : { bottomLabel: bottom }),
    onClick: action("onPreview", { id: template.id }),
    ...(entry === "compose" ? { button: rowButton(template) } : {}),
  };
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
          { text: "< Prev", action: to(page - 1), disabled: page <= 1 },
          { text: "Next >", action: to(page + 1), disabled: page >= pages },
        ],
      },
    ],
  };
}

function subfolderSection(children: SidebarFolder[]): SectionSpec[] {
  return children.length === 0
    ? []
    : [{ header: "Folders", widgets: children.map(folderItem) }];
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
    widgets: shown.map((template) => templateItem(template, entry)),
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
    sections: [...subfolderSection(children), ...list],
  };
}
