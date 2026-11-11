import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Spec 13.9 AC 15 and spec 7.4 "Removed texts": names and texts of the old preview and prompt cards are gone. */
const ROOT = join(import.meta.dirname, "..", "..", "..");
const ADDON = join(ROOT, "src", "addon");

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

/** Spec 13.11 AC 14: the spike S7 harness is gone; the manifest keeps its 10 scopes and 3 triggers. */
describe("removed in slice 18", () => {
  it.each(["onS7", "spikeS7", "Spike S7", 'kind: "s7', "s7Visible", "S7_"])(
    "src holds no %s",
    (name) => {
      for (const text of sources(join(ROOT, "src")))
        expect(text).not.toContain(name);
    },
  );

  it("has no harness file", () => {
    expect(existsSync(join(ADDON, "spikeS7.ts"))).toBe(false);
  });

  it("keeps the manifest's scopes and triggers", () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "appsscript.json"), "utf8"),
    ) as {
      oauthScopes: string[];
      addOns: {
        common: { homepageTrigger: { runFunction: string } };
        gmail: {
          contextualTriggers: { onTriggerFunction: string }[];
          composeTrigger: { selectActions: { runFunction: string }[] };
        };
      };
    };
    expect(manifest.oauthScopes).toHaveLength(10);
    expect(manifest.oauthScopes).not.toContain("https://mail.google.com/");
    const { common, gmail } = manifest.addOns;
    expect([
      common.homepageTrigger.runFunction,
      ...gmail.contextualTriggers.map((t) => t.onTriggerFunction),
      ...gmail.composeTrigger.selectActions.map((a) => a.runFunction),
    ]).toEqual(["onHomepage", "onMessageOpen", "onComposeOpen"]);
  });
});
