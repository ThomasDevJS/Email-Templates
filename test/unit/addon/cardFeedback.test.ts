import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detailsCard,
  panelDetailsCard,
} from "../../../src/addon/cards/details";
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

  it("colors the (!) line and each state card's error sentence, nothing else", () => {
    for (const card of CARDS) renderCard(card);
    const colored = argsOf("setText").filter((t) =>
      String(t).includes("<font"),
    );
    expect(new Set(colored)).toEqual(
      new Set([
        red(`(!) ${problem}`),
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
      red('(!) Shorten &lt;b&gt;"x"&lt;/b&gt; &amp; y'),
    );
  });
});
