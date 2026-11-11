import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../../src/shared/errors/codes";
import { ENTRY_POINTS } from "../../../src/shared/entryPoints";
import { template, view } from "./fixtures";
import {
  PAGE_SIZE,
  VISIBLE_ROWS,
  clampPage,
  listSection,
  templateItem,
  fieldsLabel,
  folderCard,
  folderPath,
} from "../../../src/addon/cards/folder";
import {
  ECHO_MAX,
  SEARCH_HINT,
  homeCard,
  noMatchText,
  searchCard,
} from "../../../src/addon/cards/home";
import { TOOLBAR_HINT } from "../../../src/addon/cards/sidePanel";
import { previewCard } from "../../../src/addon/cards/preview";
import { NO_RECIPIENTS } from "../../../src/shared/model/recipients";

const NONE = {
  plan: { added: NO_RECIPIENTS, notAdded: [], unknown: NO_RECIPIENTS },
  rh: "RH",
  domain: "migway.com",
  changed: false,
};
const NO_RCPT = {
  rh: "",
  recipients: null,
  domain: "migway.com",
  addRecipients: false,
};
import { promptCard, tooManyFieldsCard } from "../../../src/addon/cards/prompt";
import {
  CALLBACKS,
  type CardSpec,
  type Widget,
} from "../../../src/addon/cards/spec";
import {
  NOT_BEFORE,
  QUOTA_WAIT_MS,
  stateCard,
  waitSeconds,
} from "../../../src/addon/cards/states";

/** Every widget of a card, footer buttons excluded. */
function widgets(card: CardSpec): Widget[] {
  return card.sections.flatMap((section) => section.widgets);
}

function texts(card: CardSpec): string[] {
  return widgets(card).flatMap((w) =>
    w.kind === "text" || w.kind === "item" ? [w.text] : [],
  );
}

function buttons(card: CardSpec) {
  return widgets(card).flatMap((w) =>
    w.kind === "buttons"
      ? [...w.buttons]
      : w.kind === "item" && w.button
        ? [w.button]
        : [],
  );
}

function expectNoEmptySection(card: CardSpec): void {
  for (const section of card.sections)
    expect(section.widgets.length).toBeGreaterThan(0);
}

describe("callbacks", () => {
  it("names only top-level add-on entry points", () => {
    for (const name of CALLBACKS)
      expect(ENTRY_POINTS[name as keyof typeof ENTRY_POINTS]).toBe("addon");
  });
});

describe("home card (wireframe 01)", () => {
  it("has no header, Search, Folders with icons and counts, and Open library in the footer; no empty Favorites", () => {
    const card = homeCard(view(), "compose");
    expect(card.title).toBeUndefined();
    expect(card.sections.map((s) => s.header)).toEqual([undefined, "Folders"]);
    expect(widgets(card)[0]).toEqual({
      kind: "input",
      name: "q",
      title: "Search templates",
      value: "",
      multiline: false,
      hint: SEARCH_HINT,
      onChange: { fn: "onSearch" },
    });
    expect(SEARCH_HINT).toBe(
      "Tip: add folder:Sales or tag:pricing to narrow the search.",
    );
    expect(card.sections[1]?.widgets).toEqual([
      {
        kind: "item",
        icon: "folder",
        text: "Sales",
        bottomLabel: "3 templates",
        onClick: { fn: "onOpenFolder", params: { folderId: "F1", page: "1" } },
      },
      expect.objectContaining({
        text: "My templates",
        bottomLabel: "0 templates",
      }),
    ]);
    expect(buttons(card)).toEqual([]);
    expect(card.footer).toEqual({
      primary: {
        text: "Open library",
        action: { fn: "onOpenLink" },
        style: "outlined",
      },
    });
    expectNoEmptySection(card);
  });

  it("lists Favorites and Recent in their order with the folder path and Insert; unknown IDs drop", () => {
    const card = homeCard(
      view({ favorites: ["T3", "GONE", "T1"], recent: ["T2"] }),
      "compose",
    );
    expect(card.sections.map((s) => s.header)).toEqual([
      undefined,
      "Favorites",
      "Recent",
      "Folders",
    ]);
    expect(card.sections[1]?.widgets).toEqual([
      expect.objectContaining({
        icon: "star",
        text: "Template T3",
        bottomLabel: "Sales / Quotes",
      }),
      expect.objectContaining({
        icon: "star",
        text: "Template T1",
        bottomLabel: "Sales · 2 fields to fill",
      }),
    ]);
    expect(card.sections[2]?.widgets).toEqual([
      expect.objectContaining({ icon: "schedule", text: "Template T2" }),
    ]);
    expect(buttons(card)[0]).toEqual({
      text: "Insert",
      alt: "Insert Template T3",
      style: "filled",
      action: { fn: "onInsert", params: { id: "T3" } },
    });
  });

  it("shows the empty state of wireframe 07 A", () => {
    const card = homeCard(
      view({ folders: [], subfolders: [], templates: [] }),
      "compose",
    );
    expect(texts(card)).toEqual([
      "No templates shared with you yet.",
      'Your folder "My templates" is ready. Open the library to create a template.',
    ]);
    expect(buttons(card)[0]).toMatchObject({
      text: "Open library",
      action: { fn: "onOpenLink" },
    });
    expect(card).not.toHaveProperty("footer");
  });

  it("shows the empty state of wireframe 07 A2 while personal templates are off", () => {
    const card = homeCard(
      view({
        folders: [],
        subfolders: [],
        templates: [],
        personalTemplates: "off",
      }),
      "compose",
    );
    expect(texts(card)).toEqual([
      "No templates shared with you yet. Ask your admin for access to a folder.",
    ]);
    expect(buttons(card)).toEqual([]);
  });

  it("shows the empty state when the only folder is the caller's empty private folder", () => {
    const card = homeCard(
      view({
        folders: [{ id: "MY", name: "My templates", parentId: "", count: 0 }],
        subfolders: [],
        templates: [],
      }),
      "compose",
    );
    expect(texts(card)[0]).toBe("No templates shared with you yet.");
    expect(texts(card)).not.toContain("My templates");
    expect(buttons(card).map((b) => b.text)).toEqual(["Open library"]);
  });
});

describe("search card (spec 4.4)", () => {
  it("keeps the query in the input and lists results with their folder path", () => {
    const v = view();
    const card = searchCard(
      v,
      "quo",
      [v.templates[2] ?? template("X")],
      "compose",
    );
    expect(widgets(card)[0]).toMatchObject({ kind: "input", value: "quo" });
    expect(card.title).toBeUndefined();
    expect(card.sections[1]).toEqual({
      header: "Results",
      widgets: [
        expect.objectContaining({
          icon: "description",
          text: "Template T3",
          bottomLabel: "Sales / Quotes",
        }),
      ],
    });
    expect(card.footer?.primary.text).toBe("Open library");
  });

  it("repeats at most 60 characters of the query in the no-match text", () => {
    const long = "x".repeat(ECHO_MAX + 1);
    expect(texts(searchCard(view(), long, [], "compose"))).toEqual([
      `No templates match "${"x".repeat(ECHO_MAX)}...". Try fewer words, or remove folder: and tag: from the search.`,
    ]);
    expect(noMatchText("y".repeat(ECHO_MAX))).toContain(
      `"${"y".repeat(ECHO_MAX)}"`,
    );
  });

  it("cuts the echoed query by characters, so an emoji is never split", () => {
    const text = noMatchText(`${"a".repeat(ECHO_MAX - 1)}😀😀`);
    expect(text).toContain(`"${"a".repeat(ECHO_MAX - 1)}😀..."`);
    // No high surrogate without its low half.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(text)).toBe(false);
    expect(noMatchText("😀".repeat(ECHO_MAX))).toContain(
      `"${"😀".repeat(ECHO_MAX)}"`,
    );
  });

  it("says what was searched and how to widen it when nothing matches", () => {
    expect(texts(searchCard(view(), "zzz", [], "compose"))).toEqual([
      'No templates match "zzz". Try fewer words, or remove folder: and tag: from the search.',
    ]);
  });
});

describe("folder card (wireframe 01)", () => {
  it("shows the path, subfolders, then templates with Insert and preview on tap", () => {
    const card = folderCard(view(), "F1", "1", "compose");
    expect(card?.title).toBe("Sales");
    expect(card?.sections[0]).toMatchObject({ header: "Folders" });
    const items = card === null ? [] : widgets(card);
    expect(items[0]).toMatchObject({
      icon: "folder",
      text: "Quotes",
      bottomLabel: "1 template",
    });
    expect(items[1]).toEqual({
      kind: "item",
      icon: "description",
      text: "Template T1",
      bottomLabel: "2 fields to fill",
      onClick: { fn: "onPreview", params: { id: "T1" } },
      button: {
        text: "Insert",
        alt: "Insert Template T1",
        style: "filled",
        action: { fn: "onInsert", params: { id: "T1" } },
      },
    });
    // The header shows the path; a row without hints has no label.
    expect(items[2]).not.toHaveProperty("bottomLabel");
    expect(items[2]).not.toHaveProperty("topLabel");
    expect(card?.footer?.primary.text).toBe("Open library");
    expect(folderCard(view(), "F2", "1", "compose")?.title).toBe(
      "Sales / Quotes",
    );
  });

  it("pages 20 templates at a time with Previous and Next", () => {
    const many = Array.from({ length: 45 }, (_, n) =>
      template(`X${String(n)}`),
    );
    const big = view({ templates: many });
    const first = folderCard(big, "F1", "1", "compose");
    const last = folderCard(big, "F1", "3", "compose");
    if (first === null || last === null) throw new Error("no card");
    const items = (card: CardSpec) =>
      widgets(card).filter(
        (w) => w.kind === "item" && w.onClick?.fn === "onPreview",
      );
    expect(items(first)).toHaveLength(PAGE_SIZE);
    expect(items(last)).toHaveLength(5);
    expect(texts(first)).toContain("Page 1 of 3");
    const nav = (card: CardSpec) =>
      buttons(card).filter(
        (b) => b.text.includes("Prev") || b.text.includes("Next"),
      );
    expect(nav(first).map((b) => [b.text, b.disabled])).toEqual([
      ["Previous", true],
      ["Next", false],
    ]);
    expect(nav(first)[1]?.action).toEqual({
      fn: "onOpenFolder",
      params: { folderId: "F1", page: "2", nav: "page" },
    });
    expect(nav(last).map((b) => b.disabled)).toEqual([false, true]);
    expect(folderCard(view(), "F1", "1", "compose")?.sections).toHaveLength(2);
  });

  it("clamps pages and handles empty and unknown folders", () => {
    expect(clampPage("9", 3)).toBe(3);
    expect(clampPage("0", 3)).toBe(1);
    expect(clampPage("abc", 3)).toBe(1);
    const empty = folderCard(view(), "MY", "1", "compose");
    expect(empty && texts(empty)).toEqual(["No templates in My templates."]);
    expect(folderCard(view(), "GONE", "1", "compose")).toBeNull();
    const parentOnly = view({
      templates: [template("T3", { folderId: "F2" })],
    });
    const card = folderCard(parentOnly, "F1", "1", "compose");
    expect(card && texts(card)).toEqual(["Quotes"]);
  });

  it("stops at a parent cycle in the path", () => {
    const cyclic = view({
      folders: [],
      subfolders: [
        { id: "A", name: "A", parentId: "B", count: 0 },
        { id: "B", name: "B", parentId: "A", count: 0 },
      ],
    });
    expect(folderPath(cyclic, "A")).toBe("B / A");
  });

  it("labels field counts", () => {
    expect(fieldsLabel(1)).toBe("1 field to fill");
    expect(fieldsLabel(3)).toBe("3 fields to fill");
  });
});

describe("preview card (wireframe 01)", () => {
  it("shows text, fields to fill, Insert, and Edit only for edit or manage", () => {
    const t = template("T1", { prompts: ["Meeting date"] });
    const card = previewCard(
      t,
      "Hi [Recipient first name]",
      "",
      false,
      "compose",
      NONE,
    );
    expect(card.title).toBe("Template T1");
    expect(texts(card)).toEqual([
      "Hi [Recipient first name]",
      "Fields to fill: Meeting date",
    ]);
    expect(buttons(card).map((b) => b.text)).toEqual(["Insert"]);
    expect(buttons(card)[0]).toMatchObject({ style: "filled" });
    for (const level of ["edit", "manage"] as const) {
      const editable = previewCard(
        { ...t, level },
        "x",
        "",
        false,
        "compose",
        NONE,
      );
      expect(buttons(editable)[1]).toMatchObject({
        text: "Edit in library",
        action: { fn: "onOpenLink", params: { id: "T1" } },
      });
    }
    expect(
      texts(previewCard(template("T2"), "", "", false, "compose", NONE)),
    ).toEqual(["This template has no text."]);
  });

  it("shows the subject, the replace note and Insert body only when the template has a subject", () => {
    const card = previewCard(
      template("T1"),
      "Body",
      "Quote for [Product]",
      false,
      "compose",
      NONE,
    );
    expect(widgets(card)[0]).toEqual({
      kind: "item",
      topLabel: "Subject",
      text: "Quote for [Product]",
    });
    expect(texts(card)).toContain("Sets the draft subject.");
    expect(buttons(card).map((b) => b.action)).toEqual([
      { fn: "onInsert", params: { id: "T1", rh: "RH" } },
      { fn: "onInsert", params: { id: "T1", subject: "skip" } },
    ]);
    expect(buttons(card)[1]?.text).toBe("Insert body only");
  });

  it("with a draft subject: says it is kept and offers Insert with subject (D24)", () => {
    const card = previewCard(
      template("T1"),
      "Body",
      "Quote",
      true,
      "compose",
      NONE,
    );
    expect(texts(card)).toContain(
      "The draft already has a subject. It is kept.",
    );
    expect(buttons(card).map((b) => [b.text, b.action.params])).toEqual([
      ["Insert", { id: "T1", rh: "RH" }],
      ["Insert with subject", { id: "T1", subject: "use", rh: "RH" }],
    ]);
    expect(
      buttons(previewCard(template("T1"), "Body", "", true, "compose", NONE)),
    ).toHaveLength(1);
  });
});

describe.each(["inbox", "message"] as const)(
  "side panel, entry %s (interim fix, spec 13.7)",
  (entry) => {
    const full = view({ favorites: ["T1"], recent: ["T2"] });
    const insertTexts = (card: CardSpec | null) =>
      (card === null ? [] : buttons(card))
        .map((b) => b.text)
        .filter((text) => text.startsWith("Insert"));

    it("home: rows keep preview but lose Insert; the toolbar hint is the last section", () => {
      const card = homeCard(full, entry);
      expect(insertTexts(card)).toEqual([]);
      expect(card.sections.at(-1)?.widgets).toEqual([
        { kind: "text", text: TOOLBAR_HINT },
      ]);
      expect(TOOLBAR_HINT).toBe(
        "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar.",
      );
      expect(card.sections[1]?.widgets[0]).toMatchObject({
        text: "Template T1",
        onClick: { fn: "onPreview", params: { id: "T1" } },
      });
      const empty = homeCard(view({ templates: [] }), entry);
      expect(texts(empty).at(-1)).toBe(TOOLBAR_HINT);
      expectNoEmptySection(card);
    });

    it("folder and search: rows without Insert, the toolbar hint last", () => {
      const folder = folderCard(full, "F1", "1", entry);
      expect(insertTexts(folder)).toEqual([]);
      expect(folder?.sections.at(-1)?.widgets).toEqual([
        { kind: "text", text: TOOLBAR_HINT },
      ]);
      expect(texts(searchCard(full, "t", [], entry)).at(-1)).toBe(TOOLBAR_HINT);
      expect(insertTexts(searchCard(full, "t", full.templates, entry))).toEqual(
        [],
      );
      expect(texts(searchCard(full, "t", full.templates, entry))).toContain(
        "Template T3",
      );
    });

    it("preview: no Insert, no draft subject note; Edit in library stays", () => {
      const card = previewCard(
        template("T1"),
        "Body",
        "Quote",
        false,
        entry,
        NONE,
      );
      expect(buttons(card)).toEqual([]);
      expect(card.sections).toHaveLength(2);
      expect(texts(card).at(-1)).toBe(TOOLBAR_HINT);
      expect(texts(card)).not.toContain("Sets the draft subject.");
      const editable = previewCard(
        template("T1", { level: "edit", prompts: ["Date"] }),
        "Body",
        "",
        true,
        entry,
        NONE,
      );
      expect(buttons(editable).map((b) => b.text)).toEqual(["Edit in library"]);
      expect(texts(editable)).toContain("Fields to fill: Date");
    });
  },
);

describe("compose entry keeps Insert everywhere", () => {
  it("home, folder, search and preview show Insert and no toolbar hint", () => {
    const full = view({ favorites: ["T1"] });
    const home = homeCard(full, "compose");
    expect(buttons(home).map((b) => b.text)).toContain("Insert");
    expect(texts(home)).not.toContain(TOOLBAR_HINT);
    const folder = folderCard(full, "F1", "1", "compose");
    expect(folder && buttons(folder).map((b) => b.text)).toContain("Insert");
    const search = searchCard(full, "t", full.templates, "compose");
    expect(buttons(search).map((b) => b.text)).toContain("Insert");
    const preview = previewCard(
      template("T1"),
      "x",
      "",
      false,
      "compose",
      NONE,
    );
    expect(buttons(preview).map((b) => b.text)).toEqual(["Insert"]);
  });
});

describe("prompt card (wireframe 02)", () => {
  const fields = [
    { key: "meeting date", label: "Meeting date", implicit: false },
    { key: "{var}sender.phone", label: "Your phone", implicit: true },
  ];

  it("has one input per field in the given order, the error line, Insert and Cancel", () => {
    const card = promptCard({
      ...NO_RCPT,
      id: "T1",
      title: "Quote",
      version: 4,
      subject: "",
      replaceSubject: true,
      values: { "sender.name": "Ana" },
      fields,
      entered: ["12 Nov", ""],
      order: [1, 0],
      problem: "Fill 1 field: Your phone",
    });
    expect(widgets(card)).toEqual([
      { kind: "text", text: "Fill these fields to insert" },
      {
        kind: "input",
        name: "p-2",
        title: "Your phone *",
        value: "",
        multiline: true,
      },
      {
        kind: "input",
        name: "p-1",
        title: "Meeting date *",
        value: "12 Nov",
        multiline: true,
      },
      { kind: "text", text: "(!) Fill 1 field: Your phone" },
    ]);
    expect(card.footer?.primary).toMatchObject({
      text: "Insert",
      style: "filled",
      action: {
        fn: "onPromptInsert",
        params: {
          id: "T1",
          title: "Quote",
          version: "4",
          values: '{"sender.name":"Ana"}',
          subject: "skip",
        },
      },
    });
    expect(card.footer?.secondary).toEqual({
      text: "Cancel",
      action: { fn: "onBack" },
    });
  });

  it("skips unknown indexes and omits an empty error line", () => {
    const card = promptCard({
      ...NO_RCPT,
      id: "T1",
      title: "Quote",
      version: 1,
      subject: "",
      replaceSubject: true,
      values: {},
      fields,
      entered: [],
      order: [0, 7],
      problem: "",
    });
    expect(widgets(card)).toHaveLength(2);
  });

  it("adds the Replace the subject switch with the subject preview when there is a subject", () => {
    const card = promptCard({
      ...NO_RCPT,
      id: "T1",
      title: "Quote",
      version: 1,
      subject: "Quote for {{ask:Product}}",
      replaceSubject: false,
      values: {},
      fields,
      entered: [],
      order: [0],
      problem: "",
    });
    expect(widgets(card)[2]).toEqual({
      kind: "item",
      text: "Replace the subject",
      bottomLabel: "Quote for [Product]",
      toggle: { name: "subj", selected: false },
    });
    expect(card.footer?.primary.action.params).not.toHaveProperty("subject");
  });

  it("refuses more than 20 fields with a Back button", () => {
    const card = tooManyFieldsCard("Big", 23);
    expect(texts(card)).toEqual([
      "This template needs 23 fields. The panel fills at most 20. Ask an editor to remove some fields.",
    ]);
    expect(buttons(card)[0]?.action.fn).toBe("onBack");
  });
});

describe("state cards (wireframe 07, spec section 7)", () => {
  const retry = { fn: "onInsert", params: { id: "T1" } } as const;
  const failure = (code: ErrorCode, requestId = "REQ-1") => ({
    code,
    message: "m",
    requestId,
  });
  const at = (code: ErrorCode, canGoBack = true) =>
    stateCard(failure(code), { retry, canGoBack, nowMs: 1000 });

  it("shows the account text without buttons for AUTH_NO_USER and AUTH_DOMAIN", () => {
    for (const code of [ErrorCode.AUTH_NO_USER, ErrorCode.AUTH_DOMAIN]) {
      expect(texts(at(code))[0]).toBe("Cannot identify your Migway account.");
      expect(buttons(at(code))).toEqual([]);
    }
  });

  it("shows not set up with Retry", () => {
    const card = at(ErrorCode.NOT_CONFIGURED);
    expect(texts(card)).toEqual([
      "Migway Templates is not set up yet.",
      "Ask your admin to finish setup, then press Retry.",
    ]);
    expect(card.title).toBeUndefined();
    expect(buttons(card)[0]?.action).toEqual(retry);
  });

  it("shows DENIED with Back, or Refresh on the root card", () => {
    expect(texts(at(ErrorCode.DENIED))).toEqual([
      "You don't have access to this template. Ask a folder manager.",
    ]);
    expect(buttons(at(ErrorCode.DENIED))[0]?.text).toBe("Back");
    expect(buttons(at(ErrorCode.DENIED, false))[0]?.action.fn).toBe(
      "onRefresh",
    );
  });

  it("shows NOT_FOUND with Refresh", () => {
    expect(texts(at(ErrorCode.NOT_FOUND))).toEqual([
      "This template was deleted or moved. Press Refresh to update the list.",
    ]);
    expect(buttons(at(ErrorCode.NOT_FOUND))[0]?.action.fn).toBe("onRefresh");
  });

  it.each([
    [ErrorCode.BUSY, ["The library is busy. Try again in a few seconds."]],
    [
      ErrorCode.NETWORK,
      ["Something went wrong. Press Retry.", "Details for your admin: m"],
    ],
    [ErrorCode.INTERNAL, ["Something went wrong. Press Retry."]],
  ])("shows %s with the request ID, Retry and Back", (code, lines) => {
    const card = at(code);
    const [head, ...rest] = lines;
    expect(texts(card)).toEqual([head, "Request ID REQ-1", ...rest]);
    expect(buttons(card).map((b) => b.text)).toEqual(["Retry", "Back"]);
    expect(buttons(card)[0]?.action).toEqual(retry);
    expect(buttons(at(code, false)).map((b) => b.text)).toEqual(["Retry"]);
  });

  it("omits a blank request ID", () => {
    const card = stateCard(failure(ErrorCode.INTERNAL, ""), {
      retry,
      canGoBack: true,
      nowMs: 0,
    });
    expect(texts(card)).toEqual(["Something went wrong. Press Retry."]);
  });

  it("makes a QUOTA Retry wait 60 s", () => {
    const card = at(ErrorCode.QUOTA);
    expect(texts(card)[0]).toBe("Service is busy. Try again in a minute.");
    const params = buttons(card)[0]?.action.params ?? {};
    expect(params).toEqual({
      id: "T1",
      [NOT_BEFORE]: String(1000 + QUOTA_WAIT_MS),
    });
    expect(waitSeconds(params, 1000)).toBe(60);
    expect(waitSeconds(params, 1000 + QUOTA_WAIT_MS - 1)).toBe(1);
    expect(waitSeconds(params, 1000 + QUOTA_WAIT_MS)).toBe(0);
    expect(waitSeconds({}, 5)).toBe(0);
    expect(waitSeconds({ [NOT_BEFORE]: "x" }, 5)).toBe(0);
  });
});

describe("layout (slice 12)", () => {
  const row = (n: number): Widget => ({ kind: "text", text: String(n) });

  it("drops an empty list section and collapses one past VISIBLE_ROWS", () => {
    expect(listSection("Recent", [])).toEqual([]);
    const five = Array.from({ length: VISIBLE_ROWS }, (_, n) => row(n));
    expect(listSection("Recent", five)).toEqual([
      { header: "Recent", widgets: five },
    ]);
    const six = [...five, row(6)];
    expect(listSection("Folders", six)).toEqual([
      { header: "Folders", widgets: six, collapseAfter: VISIBLE_ROWS },
    ]);
  });

  it("puts the path first and the hints after it on one line, and drops empty parts", () => {
    const rc = template("T9", { prompts: ["A"], rc: [0, 1, 1] });
    expect(templateItem(rc, "compose", "HR", "star")).toMatchObject({
      bottomLabel: "HR · 1 field to fill · Adds Cc 1, Bcc 1",
      button: { text: "Review", style: "filled" },
    });
    expect(templateItem(template("T8"), "inbox", "", "star")).toEqual({
      kind: "item",
      icon: "star",
      text: "Template T8",
      onClick: { fn: "onPreview", params: { id: "T8" } },
    });
  });

  it("keeps the home card under 100 widgets with 10 favorites, 5 recent and 30 folders", () => {
    const templates = Array.from({ length: 15 }, (_, n) =>
      template(`T${String(n)}`, { prompts: ["A"], rc: [1, 0, 0] }),
    );
    const folders = Array.from({ length: 30 }, (_, n) => ({
      id: `F${String(n)}`,
      name: `Folder ${String(n)}`,
      parentId: "",
      count: n,
    }));
    const big = view({
      folders,
      templates,
      favorites: templates.slice(0, 10).map((t) => t.id),
      recent: templates.slice(10).map((t) => t.id),
    });
    for (const entry of ["compose", "inbox"] as const) {
      const card = homeCard(big, entry);
      // Each row is one widget; its button is part of it. The footer button adds 1.
      expect(widgets(card).length + 1).toBeLessThan(100);
      expect(card.sections.map((section) => section.collapseAfter)).toEqual([
        undefined,
        VISIBLE_ROWS,
        undefined,
        VISIBLE_ROWS,
        ...(entry === "compose" ? [] : [undefined]),
      ]);
    }
  });

  it("never puts two filled buttons side by side", () => {
    const filled = (card: CardSpec) =>
      card.sections.flatMap((section) =>
        section.widgets.filter(
          (w) =>
            w.kind === "buttons" &&
            w.buttons.filter((b) => b.style === "filled").length > 1,
        ),
      );
    const t = template("T1", { level: "edit" });
    for (const draftHasSubject of [false, true]) {
      const card = previewCard(t, "x", "S", draftHasSubject, "compose", {
        ...NONE,
        plan: {
          ...NONE.plan,
          added: { to: ["a@migway.com"], cc: [], bcc: [] },
        },
      });
      expect(buttons(card).length).toBeGreaterThan(2);
      expect(filled(card)).toEqual([]);
      expect(buttons(card).filter((b) => b.style === "filled")).toHaveLength(1);
    }
  });
});
