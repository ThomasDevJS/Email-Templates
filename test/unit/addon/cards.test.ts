import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../../src/shared/errors/codes";
import { ENTRY_POINTS } from "../../../src/shared/entryPoints";
import { template, view } from "./fixtures";
import { S4_FIXTURES } from "../../../src/shared/spike/s4Fixtures";
import {
  PAGE_SIZE,
  clampPage,
  fieldsLabel,
  folderCard,
  folderPath,
} from "../../../src/addon/cards/folder";
import { homeCard } from "../../../src/addon/cards/home";
import { previewCard } from "../../../src/addon/cards/preview";
import { promptCard, tooManyFieldsCard } from "../../../src/addon/cards/prompt";
import {
  CALLBACKS,
  type CardSpec,
  type Widget,
} from "../../../src/addon/cards/spec";
import { spikeCard, timingLine } from "../../../src/addon/cards/spike";
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
  it("lists top-level folders with counts and opens a folder card on tap", () => {
    const card = homeCard(view());
    expect(card.title).toBe("Migway Templates");
    expect(card.sections[0]).toMatchObject({ header: "Folders" });
    expect(texts(card)).toEqual(["Sales (3)", "My templates (0)"]);
    expect(widgets(card)[0]).toMatchObject({
      onClick: { fn: "onOpenFolder", params: { folderId: "F1", page: "1" } },
    });
    expect(buttons(card).map((b) => b.text)).toEqual(["Open library"]);
    expectNoEmptySection(card);
  });

  it("shows the empty state of wireframe 07 A", () => {
    const card = homeCard(view({ folders: [], subfolders: [], templates: [] }));
    expect(texts(card)).toEqual([
      "No templates shared with you yet.",
      "Your private folder is ready: open the library to create one.",
    ]);
    expect(buttons(card)[0]).toMatchObject({
      text: "Open library",
      action: { fn: "onOpenLink" },
    });
  });

  it("adds the temporary spike S4 entry for admins only", () => {
    const label = (card: CardSpec) => buttons(card).map((b) => b.text);
    expect(label(homeCard(view()))).not.toContain("Insert test fixtures");
    const admin = homeCard(view({ isAdmin: true }));
    expect(label(admin)).toContain("Insert test fixtures");
    expect(buttons(admin).at(-1)?.action.fn).toBe("onSpikeCard");
  });
});

describe("folder card (wireframe 01)", () => {
  it("shows the path, subfolders, then templates with Insert and preview on tap", () => {
    const card = folderCard(view(), "F1", "1");
    expect(card?.title).toBe("Sales");
    expect(card?.sections[0]).toMatchObject({ header: "Folders" });
    const items = card === null ? [] : widgets(card);
    expect(items[0]).toMatchObject({ text: "Quotes (1)" });
    expect(items[1]).toEqual({
      kind: "item",
      text: "Template T1",
      topLabel: "2 fields to fill",
      bottomLabel: "Snippet T1",
      onClick: { fn: "onPreview", params: { id: "T1" } },
      button: {
        text: "Insert",
        alt: "Insert Template T1",
        action: { fn: "onInsert", params: { id: "T1" } },
      },
    });
    expect(items[2]).not.toHaveProperty("bottomLabel");
    expect(items[2]).not.toHaveProperty("topLabel");
    expect(folderCard(view(), "F2", "1")?.title).toBe("Sales / Quotes");
  });

  it("pages 20 templates at a time with Prev and Next", () => {
    const many = Array.from({ length: 45 }, (_, n) =>
      template(`X${String(n)}`),
    );
    const big = view({ templates: many });
    const first = folderCard(big, "F1", "1");
    const last = folderCard(big, "F1", "3");
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
      ["< Prev", true],
      ["Next >", false],
    ]);
    expect(nav(first)[1]?.action).toEqual({
      fn: "onOpenFolder",
      params: { folderId: "F1", page: "2", nav: "page" },
    });
    expect(nav(last).map((b) => b.disabled)).toEqual([false, true]);
    expect(folderCard(view(), "F1", "1")?.sections).toHaveLength(2);
  });

  it("clamps pages and handles empty and unknown folders", () => {
    expect(clampPage("9", 3)).toBe(3);
    expect(clampPage("0", 3)).toBe(1);
    expect(clampPage("abc", 3)).toBe(1);
    const empty = folderCard(view(), "MY", "1");
    expect(empty && texts(empty)).toEqual(["No templates in My templates."]);
    expect(folderCard(view(), "GONE", "1")).toBeNull();
    const parentOnly = view({
      templates: [template("T3", { folderId: "F2" })],
    });
    const card = folderCard(parentOnly, "F1", "1");
    expect(card && texts(card)).toEqual(["Quotes (1)"]);
  });

  it("stops at a parent cycle in the path", () => {
    const cyclic = view({
      folders: [],
      subfolders: [
        { id: "A", name: "A", parentId: "B", count: 0, own: false },
        { id: "B", name: "B", parentId: "A", count: 0, own: false },
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
    const card = previewCard(t, "Hi [Recipient first name]");
    expect(card.title).toBe("Template T1");
    expect(texts(card)).toEqual([
      "Hi [Recipient first name]",
      "Fields to fill: Meeting date",
    ]);
    expect(buttons(card).map((b) => b.text)).toEqual(["Insert"]);
    expect(buttons(card)[0]).toMatchObject({ filled: true });
    for (const level of ["edit", "manage"] as const) {
      const editable = previewCard({ ...t, level }, "x");
      expect(buttons(editable)[1]).toMatchObject({
        text: "Edit in library",
        action: { fn: "onOpenLink", params: { id: "T1" } },
      });
    }
    expect(texts(previewCard(template("T2"), ""))).toEqual([
      "(Empty template)",
    ]);
  });
});

describe("prompt card (wireframe 02)", () => {
  const fields = [
    { key: "meeting date", label: "Meeting date", implicit: false },
    { key: "{var}sender.phone", label: "Your phone", implicit: true },
  ];

  it("has one input per field in the given order, the error line, Insert and Cancel", () => {
    const card = promptCard({
      id: "T1",
      title: "Quote",
      version: 4,
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
      action: {
        fn: "onPromptInsert",
        params: {
          id: "T1",
          title: "Quote",
          version: "4",
          values: '{"sender.name":"Ana"}',
        },
      },
    });
    expect(card.footer?.secondary).toMatchObject({
      text: "Cancel",
      action: { fn: "onBack" },
    });
  });

  it("skips unknown indexes and omits an empty error line", () => {
    const card = promptCard({
      id: "T1",
      title: "Quote",
      version: 1,
      values: {},
      fields,
      entered: [],
      order: [0, 7],
      problem: "",
    });
    expect(widgets(card)).toHaveLength(2);
  });

  it("refuses more than 20 fields with a Back button", () => {
    const card = tooManyFieldsCard("Big", 23);
    expect(texts(card)[0]).toContain("needs 23 fields");
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
    expect(texts(card)[0]).toBe("Migway Templates is not set up yet.");
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
      "This template was removed or moved.",
    ]);
    expect(buttons(at(ErrorCode.NOT_FOUND))[0]?.action.fn).toBe("onRefresh");
  });

  it.each([
    [ErrorCode.BUSY, ["Busy, try again."]],
    [ErrorCode.NETWORK, ["Something went wrong.", "Network: m"]],
    [ErrorCode.INTERNAL, ["Something went wrong."]],
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
    expect(texts(card)).toEqual(["Something went wrong."]);
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

describe("spike S4 card (TEMPORARY)", () => {
  it("lists F1 to F9 with one Insert each", () => {
    const card = spikeCard();
    const inserts = buttons(card);
    expect(inserts).toHaveLength(9);
    expect(inserts.map((b) => b.action.params?.["fixture"])).toEqual([
      ...S4_FIXTURES,
    ]);
    expect(inserts.every((b) => b.action.fn === "onSpikeInsert")).toBe(true);
  });

  it("formats the timing line", () => {
    expect(timingLine("F6", 51200, 812, 300)).toBe(
      "<p>[S4 F6: 51200 bytes, add-on callback 812 ms, server 300 ms]</p>",
    );
  });
});
