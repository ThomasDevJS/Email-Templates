import { describe, expect, it } from "vitest";
import { generateStubs } from "../../../scripts/lib/stubs.mjs";

describe("generateStubs", () => {
  it("emits one sorted top-level function per export that forwards every argument", () => {
    expect(generateStubs(["rpc", "doPost"], "App")).toBe(
      "function doPost(...args) {\n  return App.doPost(...args);\n}\n" +
        "function rpc(...args) {\n  return App.rpc(...args);\n}\n",
    );
  });

  it("produces working forwarders", () => {
    const source = `${generateStubs(["add"], "App")}\nreturn add(2, 3);`;
    // Evaluates generated build output, the code under test; the input is a fixed string.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function("App", source) as (app: {
      add: (a: number, b: number) => number;
    }) => number;
    expect(run({ add: (a, b) => a + b })).toBe(5);
  });

  it("returns an empty string for no exports", () => {
    expect(generateStubs([], "App")).toBe("");
  });

  it.each([
    [["default"], "App", /named export/],
    [["helper_"], "App", /ends with "_"/],
    [["App"], "App", /collides/],
    [["a", "a"], "App", /appears twice/],
    [["bad-name"], "App", /plain identifier/],
    [["1st"], "App", /plain identifier/],
  ])("rejects %j", (names, globalName, message) => {
    expect(() => generateStubs(names, globalName)).toThrow(message);
  });
});
