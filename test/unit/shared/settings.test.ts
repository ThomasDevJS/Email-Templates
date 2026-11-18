import { describe, expect, it } from "vitest";
import { emptyIndex } from "../../../src/shared/model/data";
import {
  allowedWords,
  isSettingName,
  isSettingValue,
  personalTemplatesOn,
  settingsOf,
  settingsProblem,
  settingValue,
} from "../../../src/shared/model/settings";
import { indexProblem } from "../../../src/shared/model/shape";

/** Admin settings (D29, spec 5.8): fixed list, defaults, shape check. */
const entry = (value: string) => ({
  value,
  updatedAt: "2026-11-10T14:05:00.000Z",
  updatedBy: "ana@example.com",
});

describe("fixed list and defaults", () => {
  it("reads an absent object or entry as the defaults off and allow", () => {
    const defaults = {
      personalTemplates: { value: "off", updatedAt: "", updatedBy: "" },
      recipientsExternal: { value: "allow", updatedAt: "", updatedBy: "" },
      rowButton: { value: "insert", updatedAt: "", updatedBy: "" },
    };
    expect(settingsOf(undefined)).toEqual(defaults);
    expect(settingsOf({})).toEqual(defaults);
    expect(personalTemplatesOn(undefined)).toBe(false);
    expect(settingValue(undefined, "recipientsExternal")).toBe("allow");
  });

  it("reads a stored entry", () => {
    const stored = { personalTemplates: entry("on") as never };
    expect(settingsOf(stored).personalTemplates).toEqual(entry("on"));
    expect(settingsOf(stored).recipientsExternal.value).toBe("allow");
    expect(personalTemplatesOn(stored)).toBe(true);
  });

  it("knows the names and values, own properties only", () => {
    expect(isSettingName("personalTemplates")).toBe(true);
    expect(isSettingName("toString")).toBe(false);
    expect(isSettingName(1)).toBe(false);
    expect(isSettingValue("personalTemplates", "on")).toBe(true);
    expect(isSettingValue("personalTemplates", "allow")).toBe(false);
    expect(isSettingValue("recipientsExternal", "deny")).toBe(true);
    expect(allowedWords("personalTemplates")).toBe("on or off or hidden");
    expect(allowedWords("recipientsExternal")).toBe("allow or deny");
  });
});

describe("shape check", () => {
  const index = (settings: unknown) => ({
    ...emptyIndex("2026-11-10T00:00:00.000Z"),
    settings,
  });

  it("accepts absence and valid entries", () => {
    expect(indexProblem(emptyIndex("2026-11-10T00:00:00.000Z"))).toBe("");
    expect(indexProblem(index(undefined))).toBe("");
    expect(indexProblem(index({}))).toBe("");
    expect(
      indexProblem(
        index({
          personalTemplates: entry("on"),
          recipientsExternal: entry("deny"),
        }),
      ),
    ).toBe("");
  });

  it("rejects unknown names, values and bad entries", () => {
    expect(settingsProblem([])).toBe("settings must be a record");
    expect(settingsProblem(null)).toBe("settings must be a record");
    expect(indexProblem(index({ imgHosts: entry("on") }))).toBe(
      "settings has an unknown name imgHosts",
    );
    expect(indexProblem(index({ personalTemplates: entry("yes") }))).toBe(
      "settings personalTemplates has a bad entry",
    );
    expect(indexProblem(index({ recipientsExternal: entry("on") }))).toBe(
      "settings recipientsExternal has a bad entry",
    );
    expect(settingsProblem({ personalTemplates: null })).toBe(
      "settings personalTemplates has a bad entry",
    );
    expect(
      settingsProblem({ personalTemplates: { value: "on", updatedAt: "" } }),
    ).toBe("settings personalTemplates has a bad entry");
  });
});
