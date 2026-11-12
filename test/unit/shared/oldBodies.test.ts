import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { oldBodies, oldBodyDigests } from "../../fixtures/oldBodies";

describe("bodies stored before slice 26 (choice field, brace rule)", () => {
  it("parse, render and scan as on the base build 047394e", () => {
    const expected = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../../fixtures/oldBodies.expected.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    expect(oldBodies().length).toBeGreaterThan(80);
    expect(oldBodyDigests()).toEqual(expected);
  });
});
