import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** The v1 documents (BRIEF 10) and the README: every relative link must point to a path in the repository. */
const DOCS = [
  "README.md",
  "docs/guide/user-quick-start.md",
  "docs/guide/editor-guide.md",
  "docs/guide/admin-guide.md",
  "docs/ops/runbook.md",
  "docs/ops/test-round-1.md",
];

const ROOT = resolve(import.meta.dirname, "../../..");
const LINK = /\]\(([^)\s]+)\)/g;

/** Relative link targets of a markdown text, without anchors; absolute URLs and pure anchors are skipped. */
function relativeTargets(markdown: string): string[] {
  return [...markdown.matchAll(LINK)]
    .map((match) => (match[1] ?? "").split("#")[0] ?? "")
    .filter((target) => target !== "" && !/^[a-z]+:/i.test(target));
}

describe("documentation links", () => {
  it("extracts relative targets and skips URLs and anchors", () => {
    expect(
      relativeTargets(
        "[a](x.md) [b](../y.md#part) [c](https://e.com) [d](#top) [e](mailto:n@x)",
      ),
    ).toEqual(["x.md", "../y.md"]);
  });

  it.each(DOCS)("%s links only to existing paths", (doc) => {
    const file = resolve(ROOT, doc);
    const missing = relativeTargets(readFileSync(file, "utf8")).filter(
      (target) => !existsSync(resolve(dirname(file), target)),
    );
    expect(missing).toEqual([]);
  });
});
