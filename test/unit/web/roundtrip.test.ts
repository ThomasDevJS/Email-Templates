// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { textRuns } from "../../../src/shared/html/escape";
import { parseText } from "../../../src/shared/placeholders/grammar";
import { sanitize } from "../../../src/shared/sanitize/sanitize";
import { parseHtml } from "../../../src/web/editor/load";
import { serializeDoc } from "../../../src/web/editor/serialize";
import { EDITOR_BODIES } from "../../fixtures/editor/bodies";

function tokenCount(html: string): number {
  return textRuns(html)
    .flatMap((run) => parseText(run.text))
    .filter(
      (segment) => segment.kind === "variable" || segment.kind === "prompt",
    ).length;
}

describe("editor round trip (ADR-0004 slice 3 fixture)", () => {
  it("has 20 bodies", () => {
    expect(EDITOR_BODIES).toHaveLength(20);
  });

  it.each(EDITOR_BODIES)(
    "%s: serialize(parse(html)) equals sanitize(html)",
    (_name, html) => {
      const out = serializeDoc(parseHtml(html));
      expect(out).toBe(sanitize(html));
      expect(tokenCount(out)).toBe(tokenCount(html));
    },
  );
});
