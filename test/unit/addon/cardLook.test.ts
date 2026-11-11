import { describe, expect, it } from "vitest";
import {
  detailsCard,
  panelDetailsCard,
} from "../../../src/addon/cards/details";
import { folderCard } from "../../../src/addon/cards/folder";
import { homeCard, searchCard } from "../../../src/addon/cards/home";
import type { CardSpec, Widget } from "../../../src/addon/cards/spec";
import { action } from "../../../src/addon/cards/spec";
import { stateCard } from "../../../src/addon/cards/states";
import { ErrorCode } from "../../../src/shared/errors/codes";
import { details, template, view } from "./fixtures";

/**
 * D34 freeze: the standard cards keep their widgets and texts. The snapshot was written on the base of slice 21
 * (a807c54) and must not change with the spinner and colors.
 */
function look(widget: Widget): string {
  switch (widget.kind) {
    case "text":
      return `text: ${widget.text}`;
    case "item":
      return `item: ${widget.text} | ${widget.bottomLabel ?? ""} | ${widget.button?.text ?? ""}`;
    case "buttons":
      return `buttons: ${widget.buttons.map((b) => b.text).join(", ")}`;
    case "input":
      return `input: ${widget.title}`;
    case "columns":
      return `columns: ${look(widget.fill)} | ${look(widget.fit)}`;
  }
}

function shape(card: CardSpec | null) {
  if (card === null) return null;
  return {
    title: card.title,
    sections: card.sections.map((s) => [
      s.header ?? "",
      ...s.widgets.map(look),
    ]),
    footer: [card.footer?.primary.text, card.footer?.secondary?.text],
  };
}

const data = view({
  templates: [
    template("T1", { prompts: ["Date"], rc: [1, 1, 0] }),
    template("T2"),
    template("T3", { folderId: "F2" }),
  ],
  favorites: ["T1"],
  recent: ["T2"],
});
const problem = details({
  problem:
    "The recipients of this template changed. Check them and press Insert again.",
});
const state = (code: ErrorCode) =>
  stateCard(
    { code, message: "m", requestId: "R1" },
    { retry: action("onRefresh"), canGoBack: false, nowMs: 0 },
  );

describe("card look is frozen (D34)", () => {
  for (const entry of ["compose", "inbox", "message"] as const)
    it(`${entry}: home, folder, search, no match`, () => {
      expect(
        [
          homeCard(data, entry),
          folderCard(data, "F1", "1", entry),
          searchCard(data, "x", data.templates, entry),
          searchCard(data, "zz", [], entry),
        ].map(shape),
      ).toMatchSnapshot();
    });

  it("details cards", () => {
    expect(
      [
        detailsCard(problem),
        panelDetailsCard(problem, "inbox"),
        panelDetailsCard(problem, "message"),
      ].map(shape),
    ).toMatchSnapshot();
  });

  it("state cards", () => {
    expect(
      [
        ErrorCode.AUTH_NO_USER,
        ErrorCode.NOT_CONFIGURED,
        ErrorCode.DENIED,
        ErrorCode.NOT_FOUND,
        ErrorCode.BUSY,
        ErrorCode.QUOTA,
        ErrorCode.NETWORK,
        ErrorCode.INTERNAL,
      ].map((code) => shape(state(code))),
    ).toMatchSnapshot();
  });
});
