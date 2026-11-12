import type { SidebarHome, SidebarTemplate } from "../../shared/model/sidebar";
import type { Entry } from "../event";
import {
  LIST_MAX,
  capped,
  folderItem,
  folderPath,
  listSection,
  templateItem,
} from "./folder";
import { sidePanelHint } from "./sidePanel";
import {
  LIBRARY_FOOTER,
  SEARCH_INPUT,
  action,
  type CardSpec,
  type IconName,
  type SectionSpec,
  type Widget,
} from "./spec";

/**
 * Home card (wireframe 01): Search, Favorites, Recent without the favorites, Folders, and Open library in the fixed
 * footer. No header:
 * Gmail's bar already names the add-on. Typing in Search replaces the card with the results card (`onSearch`); an
 * empty query brings Home back.
 */
export const HOME_CARD = "home";

const openLibraryButton = {
  kind: "buttons",
  buttons: [{ text: "Open library", action: action("onOpenLink") }],
} as const satisfies Widget;

/** Wireframe 07 A; A2 while personal templates are off (D29). */
function emptySection(view: SidebarHome): SectionSpec {
  if (view.personalTemplates === "off")
    return {
      widgets: [
        {
          kind: "text",
          text: "No templates shared with you yet. Ask your admin for access to a folder.",
        },
      ],
    };
  return {
    widgets: [
      { kind: "text", text: "No templates shared with you yet." },
      {
        kind: "text",
        text: 'Your folder "My templates" is ready. Open the library to create a template.',
      },
      openLibraryButton,
    ],
  };
}

/** The box and the Search button: one row in the compose dialog, stacked in the side panel (no Columns there). */
function searchSection(query: string, entry: Entry): SectionSpec {
  const box = {
    kind: "input",
    name: SEARCH_INPUT,
    title: "Search templates",
    value: query,
    multiline: false,
    onChange: action("onSearch"),
  } as const;
  // Enter or leaving the box also searches (`onChange`); the button makes that visible (D36).
  const button = {
    kind: "buttons",
    buttons: [
      {
        text: "Search",
        icon: "search",
        alt: "Search templates",
        style: "outlined",
        action: action("onSearch"),
      },
    ],
  } as const;
  return {
    widgets:
      entry === "compose"
        ? [{ kind: "columns", fill: box, fit: button }]
        : [box, button],
  };
}

/** A template row of Favorites, Recent or search results, with its hints and folder path below the title. */
function listed(
  view: SidebarHome,
  entry: Entry,
  icon: IconName,
): (template: SidebarTemplate) => Widget[] {
  return (template) =>
    templateItem(template, entry, folderPath(view, template.folderId), icon);
}

function byIds(view: SidebarHome, ids: readonly string[]): SidebarTemplate[] {
  const byId = new Map(view.templates.map((t) => [t.id, t]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

function homeSections(view: SidebarHome, entry: Entry): SectionSpec[] {
  // Spec section 7 "no visible templates": an empty private folder still counts as empty.
  if (view.templates.length === 0) return [emptySection(view)];
  // Each template once (spec 7.4): Recent drops the favorites.
  const recent = view.recent.filter((id) => !view.favorites.includes(id));
  return [
    searchSection("", entry),
    ...listSection(
      "Favorites",
      capped(
        byIds(view, view.favorites).map(listed(view, entry, "star")),
        LIST_MAX.favorites,
        "favorites",
      ),
    ),
    ...listSection(
      "Recent",
      capped(
        byIds(view, recent).map(listed(view, entry, "schedule")),
        LIST_MAX.recent,
        "recent templates",
      ),
    ),
    ...listSection(
      "Folders",
      capped(view.folders.map(folderItem), LIST_MAX.folders, "folders"),
    ),
  ];
}

export function homeCard(view: SidebarHome, entry: Entry): CardSpec {
  return {
    name: HOME_CARD,
    sections: [...homeSections(view, entry), ...sidePanelHint(entry)],
    // The empty state carries its own Open library button.
    ...(view.templates.length === 0 ? {} : { footer: LIBRARY_FOOTER }),
  };
}

/** Characters of the query the no-match text repeats. */
export const ECHO_MAX = 60;

/** "No templates match ...": what was searched and how to widen it (spec section 7). */
export function noMatchText(query: string): string {
  // By code point, so an emoji is never split into a lone surrogate.
  const chars = Array.from(query);
  const shown =
    chars.length > ECHO_MAX ? `${chars.slice(0, ECHO_MAX).join("")}...` : query;
  return `No templates match "${shown}". Try fewer words, or remove folder: and tag: from the search.`;
}

/** Search results in place of Home (spec 4.4): the server's top 20, or the empty state of spec section 7. */
export function searchCard(
  view: SidebarHome,
  query: string,
  results: readonly SidebarTemplate[],
  entry: Entry,
): CardSpec {
  // Results stay expanded: the user asked for them.
  const list: SectionSpec =
    results.length === 0
      ? { widgets: [{ kind: "text", text: noMatchText(query) }] }
      : {
          header: "Results",
          widgets: capped(
            results.map(listed(view, entry, "description")),
            LIST_MAX.results,
            "results",
          ).flat(),
        };
  return {
    name: HOME_CARD,
    sections: [searchSection(query, entry), list, ...sidePanelHint(entry)],
    footer: LIBRARY_FOOTER,
  };
}
