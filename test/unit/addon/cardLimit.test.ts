import { describe, expect, it } from "vitest";
import { folderCard } from "../../../src/addon/cards/folder";
import { homeCard, searchCard } from "../../../src/addon/cards/home";
import type { CardSpec, Widget } from "../../../src/addon/cards/spec";
import type { Entry } from "../../../src/addon/event";
import type { SidebarFolder } from "../../../src/shared/model/sidebar";
import { template, view } from "./fixtures";

/** Gmail refuses a card with more than 100 widgets or 100 sections (docs/research/r4-platform-constraints.md). */
const CARD_LIMIT = 100;
const ENTRIES: readonly Entry[] = ["compose", "inbox", "message"];

function widgets(card: CardSpec): Widget[] {
  return card.sections.flatMap((section) => section.widgets);
}

function folders(count: number, parentId: string): SidebarFolder[] {
  return Array.from({ length: count }, (_, n) => ({
    id: `${parentId}F${String(n)}`,
    name: `Folder ${String(n)}`,
    parentId,
    count: 1,
  }));
}

/** 200 top-level folders, a folder with 100 subfolders, 25 templates in it (one full page and more), 40 others. */
function largest() {
  const top = folders(200, "");
  const inTop = Array.from({ length: 25 }, (_, n) =>
    template(`A${String(n)}`, {
      folderId: top[0]?.id ?? "",
      prompts: ["Driver"],
      rc: [1, 1, 1],
    }),
  );
  const others = Array.from({ length: 40 }, (_, n) =>
    template(`B${String(n)}`, { folderId: top[1]?.id ?? "", rc: [0, 2, 0] }),
  );
  const all = [...inTop, ...others];
  return view({
    folders: top,
    subfolders: folders(100, top[0]?.id ?? ""),
    templates: all,
    favorites: all.slice(0, 20).map((t) => t.id),
    recent: all.slice(20, 40).map((t) => t.id),
  });
}

/** Every template row with an email open: the item, then its Reply button set right after it. */
function expectRowsWhole(card: CardSpec): void {
  for (const section of card.sections)
    section.widgets.forEach((widget, n) => {
      if (widget.kind === "item" && widget.onClick?.fn === "onPreview")
        expect(section.widgets[n + 1]?.kind).toBe("buttons");
    });
}

describe("card size limit (slice 20b item 1)", () => {
  const data = largest();
  const topId = data.folders[0]?.id ?? "";
  for (const entry of ENTRIES) {
    const cards: [string, CardSpec | null][] = [
      ["home", homeCard(data, entry)],
      ["folder page 1", folderCard(data, topId, "1", entry)],
      ["search", searchCard(data, "x", data.templates, entry)],
    ];
    for (const [name, card] of cards)
      it(`${entry} ${name}: under ${String(CARD_LIMIT)} widgets and sections, rows whole`, () => {
        if (card === null) throw new Error("no card");
        expect(widgets(card).length).toBeLessThan(CARD_LIMIT);
        expect(card.sections.length).toBeLessThan(CARD_LIMIT);
        if (entry === "message") expectRowsWhole(card);
      });
  }

  it("ends a cut list with one line that says how to reach the rest", () => {
    const card = homeCard(data, "message");
    const lists = card.sections.filter((s) => s.header !== undefined);
    expect(lists.map((s) => s.header)).toEqual([
      "Favorites",
      "Recent",
      "Folders",
    ]);
    expect(lists.map((s) => s.widgets.at(-1))).toEqual([
      {
        kind: "text",
        text: "Showing 10 of 20 favorites. Use Search or Open library for the rest.",
      },
      {
        kind: "text",
        text: "Showing 5 of 20 recent templates. Use Search or Open library for the rest.",
      },
      {
        kind: "text",
        text: "Showing 40 of 200 folders. Use Search or Open library for the rest.",
      },
    ]);
  });

  it("cuts subfolders and search results the same way", () => {
    const sub = folderCard(data, topId, "1", "inbox");
    expect(sub?.sections[0]?.widgets.at(-1)).toEqual({
      kind: "text",
      text: "Showing 40 of 100 folders. Use Search or Open library for the rest.",
    });
    const found = searchCard(data, "x", data.templates, "message");
    expect(found.sections[1]?.widgets.at(-1)).toEqual({
      kind: "text",
      text: "Showing 20 of 65 results. Use Search or Open library for the rest.",
    });
  });

  it("adds no line to a list under its cap", () => {
    const small = view();
    const card = homeCard(small, "message");
    expect(
      widgets(card).some(
        (w) => w.kind === "text" && w.text.startsWith("Showing"),
      ),
    ).toBe(false);
  });
});
