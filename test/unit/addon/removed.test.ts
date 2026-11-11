import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Spec 13.9 AC 15 and spec 7.4 "Removed texts": names and texts of the old preview and prompt cards are gone. */
const ADDON = join(import.meta.dirname, "..", "..", "..", "src", "addon");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : [readFileSync(join(dir, entry.name), "utf8")],
  );
}

describe("removed in slice 15", () => {
  it.each([
    '"Review',
    "`Review",
    "'Review",
    "The draft already has a subject. It is kept.",
    "This template needs",
    "Cancel",
    "Tip: add folder:Sales",
    "insertButtons",
    "withSubjectButton",
    "bodyOnlyButton",
    "tooManyFieldsCard",
    "needsReview",
    "SEARCH_HINT",
    "Fill these fields to insert",
    "Fields to fill:",
    "Insert with subject",
    "Insert body only",
    "Sets the draft subject.",
  ])("src/addon holds no %s", (name) => {
    for (const text of sources(ADDON)) expect(text).not.toContain(name);
  });
});
