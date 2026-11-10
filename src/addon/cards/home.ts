import type { SidebarFolder, SidebarHome } from "../../shared/model/sidebar";
import { action, type CardSpec, type SectionSpec, type Widget } from "./spec";

/**
 * Home card (wireframe 01). Slice 5 adds Search, Favorites and Recent sections above Folders; `homeSections`
 * keeps the order in one list for that.
 */
export const HOME_TITLE = "Migway Templates";
export const HOME_CARD = "home";

export function folderItem(folder: SidebarFolder): Widget {
  return {
    kind: "item",
    text: `${folder.name} (${String(folder.count)})`,
    onClick: action("onOpenFolder", { folderId: folder.id, page: "1" }),
  };
}

export const openLibraryButton = {
  kind: "buttons",
  buttons: [{ text: "Open library", action: action("onOpenLink") }],
} as const satisfies Widget;

/** Wireframe 07 A. */
function emptySection(): SectionSpec {
  return {
    widgets: [
      { kind: "text", text: "No templates shared with you yet." },
      {
        kind: "text",
        text: "Your private folder is ready: open the library to create one.",
      },
      openLibraryButton,
    ],
  };
}

/** TEMPORARY (spike S4): admin-only entry to the insert fixtures. */
function spikeSection(): SectionSpec {
  return {
    header: "Spike S4 (temporary, admins)",
    widgets: [
      {
        kind: "buttons",
        buttons: [
          { text: "Insert test fixtures", action: action("onSpikeCard") },
        ],
      },
    ],
  };
}

function homeSections(view: SidebarHome): SectionSpec[] {
  // Spec section 7 "no visible templates": an empty private folder still counts as empty.
  const empty = view.templates.length === 0;
  const sections: SectionSpec[] = empty
    ? [emptySection()]
    : [
        { header: "Folders", widgets: view.folders.map(folderItem) },
        { widgets: [openLibraryButton] },
      ];
  return view.isAdmin ? [...sections, spikeSection()] : sections;
}

export function homeCard(view: SidebarHome): CardSpec {
  return { name: HOME_CARD, title: HOME_TITLE, sections: homeSections(view) };
}
