import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIELDS_LINE,
  SIGNATURE_LINE,
  detailsCard,
  panelDetailsCard,
} from "../../../src/addon/cards/details";
import { TOOLBAR_HINT } from "../../../src/addon/cards/sidePanel";
import { folderCard } from "../../../src/addon/cards/folder";
import { homeCard, searchCard } from "../../../src/addon/cards/home";
import { SLATE, renderCard } from "../../../src/addon/cards/render";
import {
  CALLBACKS,
  action,
  type CardSpec,
} from "../../../src/addon/cards/spec";
import { stateCard } from "../../../src/addon/cards/states";
import { ErrorCode } from "../../../src/shared/errors/codes";
import {
  createRecordingCardService,
  type RecordedCall,
} from "../../fakes/output";
import { details, template, view } from "./fixtures";

/** Slice 21 (D35): load spinner on every action, slate on every filled button, red on error lines only. */
let calls: RecordedCall[];

beforeEach(() => {
  const cards = createRecordingCardService();
  calls = cards.calls;
  vi.stubGlobal("CardService", cards.service);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const argsOf = (method: string) =>
  calls.filter((c) => c.method === method).map((c) => c.args[0]);

const data = view({
  templates: [template("T1", { rc: [0, 1, 0] }), template("T2")],
  favorites: ["T1"],
  recent: ["T2"],
});

const problem =
  "The recipients of this template changed. Check them and press Insert again.";

/** One card of every kind, for every entry. */
const CARDS: CardSpec[] = [
  ...(["compose", "inbox", "message"] as const).flatMap((entry) => [
    homeCard(data, entry),
    searchCard(data, "x", data.templates, entry),
    searchCard(data, "zz", [], entry),
    ...[folderCard(data, "F1", "1", entry) ?? []].flat(),
  ]),
  homeCard(view({ templates: [] }), "inbox"),
  detailsCard(
    details({ template: template("T1", { level: "edit" }), problem }),
  ),
  panelDetailsCard(
    details({ template: template("T1", { level: "edit" }) }),
    "inbox",
  ),
  panelDetailsCard(details(), "message"),
  ...Object.values(ErrorCode).flatMap((code) =>
    [true, false].map((canGoBack) =>
      stateCard(
        { code, message: "m", requestId: "R1" },
        { retry: action("onRefresh"), canGoBack, nowMs: 0 },
      ),
    ),
  ),
];

describe("slate", () => {
  it("every filled button on every card kind, footers included, is slate", () => {
    for (const card of CARDS) renderCard(card);
    const filled = argsOf("setTextButtonStyle").filter((s) => s === "FILLED");
    expect(filled.length).toBeGreaterThan(CARDS.length / 2);
    expect(argsOf("setBackgroundColor")).toEqual(filled.map(() => SLATE));
  });
});

describe("load indicator", () => {
  it("every action of every card kind shows the spinner, except Back and the library link", () => {
    for (const card of CARDS) renderCard(card);
    const fns = argsOf("setFunctionName");
    const indicators = argsOf("setLoadIndicator");
    expect(indicators).toHaveLength(fns.length);
    expect(new Set(fns)).toEqual(new Set(CALLBACKS));
    fns.forEach((fn, n) => {
      expect([fn, indicators[n]]).toEqual([
        fn,
        fn === "onBack" || fn === "onOpenLink" ? "NONE" : "SPINNER",
      ]);
    });
  });
});

describe("red for errors only", () => {
  const red = (text: string) => `<font color="#b32025">${text}</font>`;

  it("colors the details problem line and each state card's error sentence, nothing else", () => {
    for (const card of CARDS) renderCard(card);
    const colored = argsOf("setText").filter((t) =>
      String(t).includes("#b32025"),
    );
    expect(new Set(colored)).toEqual(
      new Set([
        red(problem),
        red("Cannot identify your Migway account."),
        red("Migway Templates is not set up yet."),
        red("You don't have access to this template. Ask a folder manager."),
        red(
          "This template was deleted or moved. Press Refresh to update the list.",
        ),
        red("The library is busy. Try again in a few seconds."),
        red("Service is busy. Try again in a minute."),
        red("Something went wrong. Press Retry."),
      ]),
    );
    expect(argsOf("setText")).toContain("Request ID R1");
    expect(argsOf("setText")).toContain(
      "Ask your admin to finish setup, then press Retry.",
    );
  });

  it("adds only the wrapper tag: the text inside stays escaped", () => {
    renderCard(detailsCard(details({ problem: 'Shorten <b>"x"</b> & y' })));
    expect(argsOf("setText")).toContain(
      red('Shorten &lt;b&gt;"x"&lt;/b&gt; &amp; y'),
    );
  });

  it("an error line is a wrapped DecoratedText with the error icon, alt text Error, and no (!) on screen", () => {
    renderCard(detailsCard(details({ problem })));
    expect(argsOf("newTextParagraph")).not.toContainEqual(
      expect.stringContaining("(!)"),
    );
    expect(argsOf("setText").join(" ")).not.toContain("(!)");
    expect(argsOf("setName")).toContain("error");
    expect(argsOf("setAltText")).toContain("Error");
    calls.length = 0;
    renderCard(CARDS.at(-1) ?? { name: "x", sections: [] });
    expect(argsOf("newDecoratedText")).toHaveLength(1);
    expect(argsOf("setStartIcon")).toHaveLength(1);
    expect(argsOf("setWrapText")).toEqual([true]);
    expect(argsOf("setAltText")).toEqual(["Error"]);
  });
});

describe("hints look like hints (D36)", () => {
  const grey = (text: string) => `<font color="#5f6368">${text}</font>`;

  it("a hint is a wrapped DecoratedText with the info icon and grey escaped text", () => {
    renderCard({
      name: "h",
      sections: [
        { widgets: [{ kind: "text", text: "Use <b> & go", tone: "hint" }] },
      ],
    });
    expect(argsOf("newDecoratedText")).toHaveLength(1);
    expect(argsOf("newTextParagraph")).toHaveLength(0);
    expect(argsOf("setName")).toContain("info");
    expect(argsOf("setWrapText")).toEqual([true]);
    expect(argsOf("setText")).toEqual([grey("Use &lt;b&gt; &amp; go")]);
  });

  it("marks the toolbar hint, the cut line, the fields line and the signature line, nothing else", () => {
    const many = view({
      folders: Array.from({ length: 41 }, (_, n) => ({
        id: `F${String(n)}`,
        name: "f",
        parentId: "",
        count: 1,
      })),
      templates: [template("T1", { folderId: "F0" })],
    });
    const plan = {
      added: { to: ["a@example.com"], cc: [], bcc: [] },
      notAdded: [],
      unknown: { to: [], cc: [], bcc: [] },
    };
    const field = {
      key: "date",
      label: "Date",
      implicit: false,
      type: "text" as const,
      options: [],
    };
    const hints = [
      homeCard(many, "inbox"),
      detailsCard(details({ plan, fields: [field], order: [0] })),
      panelDetailsCard(details(), "inbox"),
    ].flatMap((card) =>
      card.sections.flatMap((s) =>
        s.widgets.flatMap((w) =>
          w.kind === "text" && w.tone === "hint" ? [w.text] : [],
        ),
      ),
    );
    expect(hints).toEqual([
      "Showing 40 of 41 folders. Use Search or Open library for the rest.",
      TOOLBAR_HINT,
      FIELDS_LINE,
      SIGNATURE_LINE,
      TOOLBAR_HINT,
    ]);
  });
});

describe("Search button (D36)", () => {
  it("home and results cards: an outlined Search button with the search icon under the box, same action as the box", () => {
    for (const card of [
      homeCard(data, "compose"),
      searchCard(data, "x", data.templates, "message"),
      searchCard(data, "zz", [], "inbox"),
    ]) {
      const first = card.sections[0]?.widgets ?? [];
      const [box, button] = first.flatMap((w) =>
        w.kind === "columns" ? [w.fill, w.fit] : [w],
      );
      expect(box?.kind === "input" && box.onChange).toEqual({ fn: "onSearch" });
      expect(button).toEqual({
        kind: "buttons",
        buttons: [
          {
            text: "Search",
            icon: "search",
            alt: "Search templates",
            style: "outlined",
            action: { fn: "onSearch" },
          },
        ],
      });
    }
  });

  it("renders the icon on the button and the spinner on its action", () => {
    renderCard(homeCard(data, "inbox"));
    expect(argsOf("setName")).toContain("search");
    const fns = argsOf("setFunctionName");
    const at = fns.lastIndexOf("onSearch");
    expect(fns.filter((fn) => fn === "onSearch")).toHaveLength(2);
    expect(argsOf("setLoadIndicator")[at]).toBe("SPINNER");
  });

  it("compose: box and button in one row of 2 columns; side panel: stacked", () => {
    const row = homeCard(data, "compose").sections[0]?.widgets;
    expect(row?.map((w) => w.kind)).toEqual(["columns"]);
    expect(
      row?.[0]?.kind === "columns" && [row[0].fill.kind, row[0].fit.kind],
    ).toEqual(["input", "buttons"]);
    for (const entry of ["inbox", "message"] as const)
      expect(
        homeCard(data, entry).sections[0]?.widgets.map((w) => w.kind),
      ).toEqual(["input", "buttons"]);
    renderCard(homeCard(data, "compose"));
    expect(argsOf("newColumns")).toHaveLength(1);
    expect(argsOf("addColumn")).toHaveLength(2);
    expect(argsOf("setHorizontalSizeStyle")).toEqual([
      "FILL_AVAILABLE_SPACE",
      "FILL_MINIMUM_SPACE",
    ]);
    expect(argsOf("setVerticalAlignment")).toEqual(["CENTER", "CENTER"]);
  });

  it("a Columns build that throws falls back to the stacked box and button", () => {
    const base = createRecordingCardService();
    calls = base.calls;
    vi.stubGlobal(
      "CardService",
      new Proxy(base.service, {
        get: (target, method) =>
          method === "newColumns"
            ? () => {
                throw new Error("Columns not supported");
              }
            : (Reflect.get(target, method) as unknown),
      }),
    );
    expect(() => renderCard(homeCard(data, "compose"))).not.toThrow();
    expect(argsOf("addColumn")).toHaveLength(0);
    expect(argsOf("setTitle")).toContain("Search templates");
    expect(argsOf("setText")).toContain("Search");
    expect(argsOf("build")).toHaveLength(1);
  });

  it("a button icon that throws leaves the card whole, the button without its icon", () => {
    const throwing: object = new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args: unknown[]) => {
            if (method === "setMaterialIcon") throw new Error("not supported");
            calls.push({ method: String(method), args });
            return throwing;
          },
      },
    );
    const base = createRecordingCardService();
    calls = base.calls;
    vi.stubGlobal(
      "CardService",
      new Proxy(base.service, {
        get: (target, method) =>
          method === "newTextButton"
            ? () => throwing
            : (Reflect.get(target, method) as unknown),
      }),
    );
    expect(() => renderCard(homeCard(data, "inbox"))).not.toThrow();
    expect(argsOf("setText")).toContain("Search");
    expect(argsOf("build")).toHaveLength(1);
  });
});
