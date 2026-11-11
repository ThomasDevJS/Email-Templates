import { BUILD_INFO } from "../../shared/buildInfo";
import type { SidebarHome, SidebarTemplate } from "../../shared/model/sidebar";
import type { Entry } from "../event";
import { s7Sections } from "../spikeS7";
import { folderItem, folderPath, listSection, templateItem } from "./folder";
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
 * Home card (wireframe 01): Search, Favorites, Recent, Folders, and Open library in the fixed footer. No header:
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

/** The search hint, in plain words (wireframe 01 showed the bare syntax). */
export const SEARCH_HINT =
  "Tip: add folder:Sales or tag:pricing to narrow the search.";

function searchSection(query: string): SectionSpec {
  return {
    widgets: [
      {
        kind: "input",
        name: SEARCH_INPUT,
        title: "Search templates",
        value: query,
        multiline: false,
        hint: SEARCH_HINT,
        onChange: action("onSearch"),
      },
    ],
  };
}

/** A template row of Favorites, Recent or search results, with its folder path below the title (wireframe 01). */
function listed(
  view: SidebarHome,
  entry: Entry,
  icon: IconName,
): (template: SidebarTemplate) => Widget {
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
  return [
    searchSection(""),
    ...listSection(
      "Favorites",
      byIds(view, view.favorites).map(listed(view, entry, "star")),
    ),
    ...listSection(
      "Recent",
      byIds(view, view.recent).map(listed(view, entry, "schedule")),
    ),
    ...listSection("Folders", view.folders.map(folderItem)),
  ];
}

export function homeCard(view: SidebarHome, entry: Entry): CardSpec {
  return {
    name: HOME_CARD,
    sections: [
      ...homeSections(view, entry),
      ...sidePanelHint(entry),
      // TEMPORARY (spike S7): dev build only.
      ...s7Sections(BUILD_INFO.env, entry),
    ],
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
          widgets: results.map(listed(view, entry, "description")),
        };
  return {
    name: HOME_CARD,
    sections: [searchSection(query), list, ...sidePanelHint(entry)],
    footer: LIBRARY_FOOTER,
  };
}
