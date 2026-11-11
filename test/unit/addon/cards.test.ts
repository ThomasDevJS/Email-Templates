import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../../src/shared/errors/codes";
import { ENTRY_POINTS } from "../../../src/shared/entryPoints";
import { details, template, view } from "./fixtures";
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
  homeCard,
  noMatchText,
  searchCard,
} from "../../../src/addon/cards/home";
import { TOOLBAR_HINT } from "../../../src/addon/cards/sidePanel";
import {
  EMPTY_TEMPLATE,
  FIELDS_LINE,
  FIRST_NAME_HINT,
  REPLY_FIRST_NAME_HINT,
  REPLY_TO_LINE,
  SIGNATURE_LINE,
  detailsCard,
  panelDetailsCard,
} from "../../../src/addon/cards/details";
import { FINISH_TYPING } from "../../../src/addon/cards/recipients";
import { NO_RECIPIENTS } from "../../../src/shared/model/recipients";

const SEARCH_BUTTON = {
  text: "Search",
  icon: "search",
  alt: "Search templates",
  style: "outlined",
  action: { fn: "onSearch" },
};
const NO_PLAN = { added: NO_RECIPIENTS, notAdded: [], unknown: NO_RECIPIENTS };
import {
  hint,
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
  it("has no header, Search without a hint, Folders with icons and counts, and a filled Open library in the footer", () => {
    const card = homeCard(view(), "compose");
    expect(card.title).toBeUndefined();
    expect(card.sections.map((s) => s.header)).toEqual([undefined, "Folders"]);
    expect(widgets(card)[0]).toEqual({
      kind: "input",
      name: "q",
      title: "Search templates",
      value: "",
      multiline: false,
      onChange: { fn: "onSearch" },
    });
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
    expect(buttons(card)).toEqual([SEARCH_BUTTON]);
    expect(card.footer).toEqual({
      primary: {
        text: "Open library",
        action: { fn: "onOpenLink" },
        style: "filled",
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
        bottomLabel: "2 fields to fill · Sales",
      }),
    ]);
    expect(card.sections[2]?.widgets).toEqual([
      expect.objectContaining({ icon: "schedule", text: "Template T2" }),
    ]);
    expect(buttons(card)[1]).toEqual({
      text: "Insert",
      alt: "Insert Template T3",
      style: "filled",
      action: { fn: "onInsert", params: { id: "T3" } },
    });
  });

  it("lists a template once: Recent drops every favorite and hides when that leaves it empty (spec 7.4)", () => {
    const both = homeCard(
      view({ favorites: ["T1"], recent: ["T1", "T2"] }),
      "compose",
    );
    expect(both.sections[2]).toMatchObject({ header: "Recent" });
    expect(both.sections[2]?.widgets).toEqual([
      expect.objectContaining({ text: "Template T2" }),
    ]);
    const only = homeCard(
      view({ favorites: ["T1", "T2"], recent: ["T2", "T1"] }),
      "compose",
    );
    expect(only.sections.map((s) => s.header)).toEqual([
      undefined,
      "Favorites",
      "Folders",
    ]);
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
    expect(card.footer?.primary).toMatchObject({
      text: "Open library",
      style: "filled",
    });
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
    expect(card?.footer?.primary).toMatchObject({
      text: "Open library",
      style: "filled",
    });
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

describe("details card (spec 7.4 Flow B, wireframe 02)", () => {
  const fields = [
    { key: "meeting date", label: "Meeting date", implicit: false },
    {
      key: "{var}recipient.first_name",
      label: "Recipient first name",
      implicit: true,
    },
  ];

  it("shows Fields with optional inputs, the preview, Insert filled and Edit only for edit or manage", () => {
    const card = detailsCard(
      details({ fields, entered: ["12 Nov", ""], order: [0, 1] }),
    );
    expect(card.title).toBe("Template T1");
    expect(card.sections[0]).toEqual({
      header: "Fields",
      widgets: [
        hint(FIELDS_LINE),
        {
          kind: "input",
          name: "p-1",
          title: "Meeting date",
          value: "12 Nov",
          multiline: true,
        },
        {
          kind: "input",
          name: "p-2",
          title: "Recipient first name",
          value: "",
          multiline: true,
          hint: FIRST_NAME_HINT,
        },
      ],
    });
    expect(FIELDS_LINE).toBe(
      "Fill in now, or leave blank and type in the draft.",
    );
    expect(FIRST_NAME_HINT).toBe(
      "Leave blank to use the To recipient's first name, when known.",
    );
    expect(texts(card).at(-1)).toBe("Body");
    expect(card.footer).toEqual({
      primary: {
        text: "Insert",
        alt: "Insert Template T1",
        style: "filled",
        action: {
          fn: "onPromptInsert",
          params: { id: "T1", version: "1", values: "{}", rh: "RH" },
        },
      },
    });
    for (const level of ["edit", "manage"] as const)
      expect(
        detailsCard(details({ template: template("T1", { level }) })).footer
          ?.secondary,
      ).toEqual({
        text: "Edit in library",
        alt: "Edit Template T1 in the library",
        style: "outlined",
        action: { fn: "onOpenLink", params: { id: "T1" } },
      });
    expect(texts(detailsCard(details({ text: "" })))).toEqual([EMPTY_TEMPLATE]);
    expectNoEmptySection(card);
  });

  it("has no Fields section, no subject switch and no Recipients section when there is nothing to show", () => {
    const card = detailsCard(details());
    expect(card.sections).toEqual([
      { widgets: [{ kind: "text", text: "Body" }] },
    ]);
    expect(buttons(card)).toEqual([]);
  });

  it("shows at most 20 inputs, then the more-than-20 line; problem fields first", () => {
    const many = Array.from({ length: 23 }, (_, n) => ({
      key: `f${String(n)}`,
      label: `F${String(n)}`,
      implicit: false,
    }));
    const card = detailsCard(
      details({
        fields: many,
        order: [5, ...many.map((_, n) => n).filter((n) => n !== 5)],
        problem: "Shorten to 500 characters: F5",
      }),
    );
    const inputs = widgets(card).filter((w) => w.kind === "input");
    expect(inputs).toHaveLength(20);
    expect(inputs[0]).toMatchObject({ name: "p-6", title: "F5" });
    expect(texts(card)[0]).toBe("(!) Shorten to 500 characters: F5");
    expect(texts(card)).toContain(
      "This template has 23 fields. The first 20 are here. The rest are left out of the draft.",
    );
    expect(
      widgets(card).every((w) => w.kind !== "input" || !w.title.includes("*")),
    ).toBe(true);
  });

  it("shows the subject switch with the subject preview, at the state given", () => {
    for (const selected of [true, false]) {
      const card = detailsCard(
        details({ subject: "Quote for [Product]", replaceSubject: selected }),
      );
      expect(widgets(card)[0]).toEqual({
        kind: "item",
        text: "Replace the subject",
        bottomLabel: "Quote for [Product]",
        toggle: { name: "subj", selected },
      });
    }
  });

  it("re-rendered cards carry counted=1", () => {
    expect(
      detailsCard(details({ counted: true })).footer?.primary.action.params,
    ).toMatchObject({ counted: "1" });
  });
});

describe.each([
  ["inbox", "New email", "New email from", "new", "STANDALONE_DRAFT"],
  ["message", "Reply", "Reply with", "reply", "REPLY_AS_DRAFT"],
] as const)(
  "side panel, entry %s (spec 7.2, slice 18 AC 1, 2, 8, 13)",
  (entry, text, alt, as, compose) => {
    const full = view({
      favorites: ["T1"],
      recent: ["T2"],
      templates: [
        template("T1", { prompts: ["Meeting date", "Product"] }),
        template("T2", { rc: [1, 1, 0] }),
        template("T3", { folderId: "F2" }),
      ],
    });
    /** The filled button of each row; with a message open each row also has an outlined "Reply all" (D33). */
    const rowButtons = (card: CardSpec | null) =>
      card === null ? [] : buttons(card).filter((b) => b.style === "filled");
    const replyAll = (card: CardSpec | null) =>
      card === null
        ? []
        : buttons(card).flatMap((b) =>
            b.style === "outlined" && b.action.fn === "onCompose"
              ? [[b.text, b.compose, b.action.params?.["as"]]]
              : [],
          );

    it("home: every row has one filled compose button; the hint is the last section", () => {
      const card = homeCard(full, entry);
      expect(rowButtons(card)).toEqual([
        {
          text,
          alt: `${alt} Template T1`,
          style: "filled",
          action: { fn: "onCompose", params: { id: "T1", as } },
          compose,
        },
        {
          text,
          alt: `${alt} Template T2`,
          style: "filled",
          action: { fn: "onCompose", params: { id: "T2", rc: "1,1,0", as } },
          compose,
        },
      ]);
      expect(card.sections.at(-1)?.widgets).toEqual([hint(TOOLBAR_HINT)]);
      expect(TOOLBAR_HINT).toBe(
        "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar.",
      );
      expect(card.sections[1]?.widgets[0]).toMatchObject({
        text: "Template T1",
        onClick: { fn: "onPreview", params: { id: "T1" } },
      });
      expect(replyAll(card)).toEqual(
        entry === "message"
          ? [
              ["Reply all", "REPLY_AS_DRAFT", "replyAll"],
              ["Reply all", "REPLY_AS_DRAFT", "replyAll"],
            ]
          : [],
      );
      const empty = homeCard(view({ templates: [] }), entry);
      expect(texts(empty).at(-1)).toBe(TOOLBAR_HINT);
      expectNoEmptySection(card);
    });

    it("folder and search: the same row button, the hint last", () => {
      const folder = folderCard(full, "F1", "1", entry);
      expect(rowButtons(folder).map((b) => [b.text, b.compose])).toEqual([
        [text, compose],
        [text, compose],
      ]);
      expect(folder?.sections.at(-1)?.widgets).toEqual([hint(TOOLBAR_HINT)]);
      const search = searchCard(full, "t", full.templates, entry);
      expect(rowButtons(search)).toHaveLength(3);
      expect(rowButtons(search).every((b) => b.text === text)).toBe(true);
      expect(replyAll(search)).toHaveLength(entry === "message" ? 3 : 0);
      expect(texts(searchCard(full, "t", [], entry)).at(-1)).toBe(TOOLBAR_HINT);
    });
  },
);

describe("side panel details card (spec 7.2, ADR-0007 A2, slice 18 AC 8)", () => {
  const firstName = {
    key: "{var}recipient.first_name",
    label: "Recipient first name",
    implicit: true,
  };
  const state = details({
    template: template("T1", { level: "edit" }),
    subject: "Quote",
    fields: [{ key: "Date", label: "Date", implicit: false }, firstName],
    entered: ["", ""],
    order: [0, 1],
    values: { "sender.name": "Ana" },
    plan: {
      ...NO_PLAN,
      added: { to: ["a@migway.com"], cc: ["c@migway.com"], bcc: [] },
    },
  });
  const params = {
    id: "T1",
    version: "1",
    values: JSON.stringify({ "sender.name": "Ana" }),
    rh: "RH",
  };
  const press = (
    label: string,
    as: string,
    style: "filled" | "outlined",
    compose: string,
  ) => ({
    text: label,
    alt: `${label === "New email" ? "New email from" : `${label} with`} Template T1`,
    style,
    action: { fn: "onPromptCompose", params: { ...params, as } },
    compose,
  });
  const edit = {
    text: "Edit in library",
    alt: "Edit Template T1 in the library",
    style: "outlined",
    action: { fn: "onOpenLink", params: { id: "T1" } },
  };

  it("message: inputs with the reply hint, Add recipients, the To line, no finish-typing, Reply and Reply all in the footer", () => {
    const card = panelDetailsCard(state, "message");
    expect(
      widgets(card).flatMap((w) =>
        w.kind === "input" ? [[w.name, w.title, w.hint]] : [],
      ),
    ).toEqual([
      ["p-1", "Date", undefined],
      ["p-2", "Recipient first name", REPLY_FIRST_NAME_HINT],
    ]);
    expect(texts(card)).toEqual([
      FIELDS_LINE,
      "Add recipients",
      "a@migway.com",
      "c@migway.com",
      REPLY_TO_LINE,
      SIGNATURE_LINE,
      "Body",
      TOOLBAR_HINT,
    ]);
    expect(texts(card)).not.toContain(FINISH_TYPING);
    expect(texts(card)).not.toContain("Replace the subject");
    expect(card.footer).toEqual({
      primary: press("Reply", "reply", "filled", "REPLY_AS_DRAFT"),
      secondary: press("Reply all", "replyAll", "outlined", "REPLY_AS_DRAFT"),
    });
    expect(buttons(card)).toEqual([
      press("New email", "new", "outlined", "STANDALONE_DRAFT"),
      edit,
    ]);
    expect(card.sections.at(-1)?.widgets).toEqual([hint(TOOLBAR_HINT)]);
    expect(card.footer?.primary.action.params).not.toHaveProperty("counted");
  });

  it("the Add recipients count follows the press: a reply leaves out the template To, New email adds it", () => {
    const adds = (card: CardSpec) =>
      widgets(card).flatMap((w) =>
        w.kind === "item" && w.text === "Add recipients" ? [w.bottomLabel] : [],
      );
    expect(adds(panelDetailsCard(state, "message"))).toEqual([
      "A reply adds 1 recipient.",
    ]);
    expect(adds(panelDetailsCard(state, "inbox"))).toEqual([
      "Adds 2 recipients.",
    ]);
  });

  it("inbox: no hint under the first name, no To line, footer New email and Edit in library, no button section", () => {
    const card = panelDetailsCard(state, "inbox");
    expect(
      widgets(card).flatMap((w) => (w.kind === "input" ? [w.hint] : [])),
    ).toEqual([undefined, undefined]);
    expect(texts(card)).not.toContain(REPLY_TO_LINE);
    expect(texts(card)).toContain(SIGNATURE_LINE);
    expect(card.footer).toEqual({
      primary: press("New email", "new", "filled", "STANDALONE_DRAFT"),
      secondary: edit,
    });
    expect(buttons(card)).toEqual([]);
    expect(texts(card).at(-1)).toBe(TOOLBAR_HINT);
  });

  it("use level, no recipients: no Edit in library, no Add recipients; inbox has no secondary", () => {
    const plain = details({ template: template("T1") });
    const inbox = panelDetailsCard(plain, "inbox");
    expect(inbox.footer?.secondary).toBeUndefined();
    expect(texts(inbox)).not.toContain("Add recipients");
    const message = panelDetailsCard(plain, "message");
    expect(buttons(message).map((b) => b.text)).toEqual(["New email"]);
    expectNoEmptySection(message);
  });
});

describe("compose entry keeps Insert everywhere", () => {
  it("home, folder, search and details show Insert and no toolbar hint", () => {
    const full = view({ favorites: ["T1"] });
    const home = homeCard(full, "compose");
    expect(buttons(home).map((b) => b.text)).toContain("Insert");
    expect(texts(home)).not.toContain(TOOLBAR_HINT);
    const folder = folderCard(full, "F1", "1", "compose");
    expect(folder && buttons(folder).map((b) => b.text)).toContain("Insert");
    const search = searchCard(full, "t", full.templates, "compose");
    expect(buttons(search).map((b) => b.text)).toContain("Insert");
    const card = detailsCard(details());
    expect(card.footer?.primary.text).toBe("Insert");
    expect(texts(card)).not.toContain(TOOLBAR_HINT);
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

  it("drops an empty list section and collapses one past VISIBLE_ROWS rows", () => {
    expect(listSection("Recent", [])).toEqual([]);
    const five = Array.from({ length: VISIBLE_ROWS }, (_, n) => [row(n)]);
    expect(listSection("Recent", five)).toEqual([
      { header: "Recent", widgets: five.flat() },
    ]);
    const six = [...five, [row(6)]];
    expect(listSection("Folders", six)).toEqual([
      { header: "Folders", widgets: six.flat(), collapseAfter: VISIBLE_ROWS },
    ]);
    // Rows of 2 widgets (D33): the collapsed section still shows 5 whole rows.
    const pairs = Array.from({ length: 6 }, (_, n) => [row(n), row(n + 10)]);
    expect(listSection("Recent", pairs)[0]?.collapseAfter).toBe(
      2 * VISIBLE_ROWS,
    );
  });

  it("puts the recipient hint, the fields hint and the path on one line, and drops empty parts (spec 7.4)", () => {
    const rc = template("T9", { prompts: ["A"], rc: [0, 1, 1] });
    expect(templateItem(rc, "compose", "HR", "star")[0]).toMatchObject({
      bottomLabel: "Adds Cc 1, Bcc 1 · 1 field to fill · HR",
      button: {
        text: "Insert",
        alt: "Insert Template T9",
        style: "filled",
        action: { fn: "onInsert", params: { id: "T9", rc: "0,1,1" } },
      },
    });
    expect(
      templateItem(template("T7", { rc: [1, 0, 0] }), "compose", "", "star")[0],
    ).toMatchObject({ bottomLabel: "Adds To 1" });
    expect(templateItem(template("T8"), "inbox", "", "star")).toEqual([
      {
        kind: "item",
        icon: "star",
        text: "Template T8",
        onClick: { fn: "onPreview", params: { id: "T8" } },
        button: {
          text: "New email",
          alt: "New email from Template T8",
          style: "filled",
          action: { fn: "onCompose", params: { id: "T8", as: "new" } },
          compose: "STANDALONE_DRAFT",
        },
      },
    ]);
  });

  it("message entry (D33): the row without a button, then Reply (filled) and Reply all (outlined) right under it", () => {
    const t = template("T8", { rc: [0, 1, 0] });
    const compose = (as: string, text: string, alt: string, style: string) => ({
      text,
      alt: `${alt} Template T8`,
      style,
      action: { fn: "onCompose", params: { id: "T8", rc: "0,1,0", as } },
      compose: "REPLY_AS_DRAFT",
    });
    expect(templateItem(t, "message", "Sales", "star")).toEqual([
      {
        kind: "item",
        icon: "star",
        text: "Template T8",
        bottomLabel: "Adds Cc 1 · Sales",
        onClick: { fn: "onPreview", params: { id: "T8" } },
      },
      {
        kind: "buttons",
        buttons: [
          compose("reply", "Reply", "Reply with", "filled"),
          compose("replyAll", "Reply all", "Reply all with", "outlined"),
        ],
      },
    ]);
    expect(templateItem(t, "compose", "", "star")).toHaveLength(1);
    expect(templateItem(t, "inbox", "", "star")).toHaveLength(1);
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
    // Widgets: search box and button 2, Favorites 10 rows, Recent 5 rows, Folders 30, hint 1 (panel); a row is 2
    // with a message open.
    for (const [entry, perRow, total] of [
      ["compose", 1, 47],
      ["inbox", 1, 48],
      ["message", 2, 63],
    ] as const) {
      const card = homeCard(big, entry);
      expect(widgets(card)).toHaveLength(total);
      expect(
        Math.max(...card.sections.map((s) => s.widgets.length)),
      ).toBeLessThan(100);
      expect(card.sections.map((section) => section.collapseAfter)).toEqual([
        undefined,
        perRow * VISIBLE_ROWS,
        undefined,
        VISIBLE_ROWS,
        ...(entry === "compose" ? [] : [undefined]),
      ]);
    }
  });

  it("a folder page of 20 and 20 search results stay under 100 widgets with a message open (D33)", () => {
    const templates = Array.from({ length: 25 }, (_, n) =>
      template(`T${String(n)}`),
    );
    const big = view({ templates });
    const folder = folderCard(big, "F1", "1", "message");
    // 20 rows of 2 widgets in one section; the pager is its own section.
    expect(folder?.sections[1]?.widgets).toHaveLength(40);
    const search = searchCard(big, "t", templates.slice(0, 20), "message");
    expect(search.sections[1]?.widgets).toHaveLength(40);
    expect(widgets(search)).toHaveLength(43);
  });

  it("has one filled button per details card, in the footer", () => {
    const t = template("T1", { level: "edit" });
    const card = detailsCard(
      details({
        template: t,
        subject: "S",
        plan: { ...NO_PLAN, added: { to: ["a@migway.com"], cc: [], bcc: [] } },
      }),
    );
    expect(buttons(card)).toEqual([]);
    expect(card.footer?.primary.style).toBe("filled");
    expect(card.footer?.secondary?.style).toBe("outlined");
  });
});
