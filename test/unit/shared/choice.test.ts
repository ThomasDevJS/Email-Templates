import { describe, expect, it } from "vitest";
import {
  chosenOption,
  typedPosition,
} from "../../../src/shared/placeholders/choice";

const TWENTY = Array.from({ length: 20 }, (_, n) => `Option ${String(n + 1)}`);

describe("chosenOption (spec 5.10)", () => {
  it.each([
    ["0", ""],
    ["", ""],
    ["1", "Option 1"],
    ["20", "Option 20"],
    ["21", null],
    ["-1", null],
    ["1.5", null],
    ["01", null],
    ["abc", null],
    [" 1", null],
    ["1e1", null],
  ])("%j gives %j", (raw, option) => {
    expect(chosenOption(raw, TWENTY)).toBe(option);
  });

  it("reads a number, an array and nothing", () => {
    expect(chosenOption(2, TWENTY)).toBe("Option 2");
    expect(chosenOption(0, TWENTY)).toBe("");
    expect(chosenOption(["3"], TWENTY)).toBe("Option 3");
    expect(chosenOption([], TWENTY)).toBe("");
    expect(chosenOption(undefined, TWENTY)).toBe("");
    expect(chosenOption(null, TWENTY)).toBe("");
    expect(chosenOption({}, TWENTY)).toBeNull();
    expect(chosenOption(NaN, TWENTY)).toBeNull();
    expect(chosenOption("3", ["a", "b"])).toBeNull();
  });
});

describe("typedPosition (the text-box fallback)", () => {
  it("accepts an option as written, trimmed; empty is not chosen", () => {
    expect(typedPosition(" Rejected ", ["Approved", "Rejected"])).toBe("2");
    expect(typedPosition("  ", ["Approved", "Rejected"])).toBe("0");
    expect(typedPosition("rejected", ["Approved", "Rejected"])).toBeNull();
    expect(typedPosition("2", ["Approved", "Rejected"])).toBeNull();
    expect(typedPosition("2", ["1", "2"])).toBe("2");
  });
});
