import { BUILD_INFO } from "../../shared/buildInfo";
import type { SidebarHome, SidebarTemplate } from "../../shared/model/sidebar";
import { s6Sections } from "../spikeS6";
import { folderItem, folderPath, templateItem } from "./folder";
import {
  SEARCH_INPUT,
  action,
  type CardSpec,
  type SectionSpec,
  type Widget,
} from "./spec";

/**
 * Home card (wireframe 01): Search, Favorites, Recent, Folders, Open library. Typing in Search replaces the card
 * with the results card (`onSearch`); an empty query brings Home back.
 */
export const HOME_TITLE = "Migway Templates";
export const HOME_CARD = "home";

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

function searchSection(query: string): SectionSpec {
  return {
    widgets: [
      {
        kind: "input",
        name: SEARCH_INPUT,
        title: "Search templates",
        value: query,
        multiline: false,
        hint: "folder:Sales  tag:pricing",
        onChange: action("onSearch"),
      },
    ],
  };
}

/** A template row with its folder path below the title (wireframe 01, Favorites and Recent). */
function listed(view: SidebarHome, template: SidebarTemplate): Widget {
  return templateItem(template, folderPath(view, template.folderId));
}

function byIds(view: SidebarHome, ids: readonly string[]): SidebarTemplate[] {
  const byId = new Map(view.templates.map((t) => [t.id, t]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

function favoritesSection(view: SidebarHome): SectionSpec {
  const favorites = byIds(view, view.favorites);
  return {
    header: "Favorites",
    widgets:
      favorites.length === 0
        ? [
            {
              kind: "text",
              text: "Star templates in the library to pin them here.",
            },
          ]
        : favorites.map((template) => listed(view, template)),
  };
}

function recentSections(view: SidebarHome): SectionSpec[] {
  const recent = byIds(view, view.recent);
  return recent.length === 0
    ? []
    : [
        {
          header: "Recent",
          widgets: recent.map((template) => listed(view, template)),
        },
      ];
}

function homeSections(view: SidebarHome): SectionSpec[] {
  // Spec section 7 "no visible templates": an empty private folder still counts as empty.
  if (view.templates.length === 0) return [emptySection()];
  return [
    searchSection(""),
    favoritesSection(view),
    ...recentSections(view),
    { header: "Folders", widgets: view.folders.map(folderItem) },
    { widgets: [openLibraryButton] },
  ];
}

export function homeCard(view: SidebarHome): CardSpec {
  return {
    name: HOME_CARD,
    title: HOME_TITLE,
    // TEMPORARY (spike S6): dev build only.
    sections: [...homeSections(view), ...s6Sections(BUILD_INFO.env)],
  };
}

/** Search results in place of Home (spec 4.4): the server's top 20, or the empty state of spec section 7. */
export function searchCard(
  view: SidebarHome,
  query: string,
  results: readonly SidebarTemplate[],
): CardSpec {
  const list: SectionSpec =
    results.length === 0
      ? {
          widgets: [
            {
              kind: "text",
              text: `No templates match ${query}. Try folder: or tag:.`,
            },
          ],
        }
      : {
          header: "Results",
          widgets: results.map((template) => listed(view, template)),
        };
  return {
    name: HOME_CARD,
    title: HOME_TITLE,
    sections: [searchSection(query), list, { widgets: [openLibraryButton] }],
  };
}
