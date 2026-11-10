import { describe, expect, it } from "vitest";
import {
  formValue,
  internalRecipient,
  paramsOf,
} from "../../../src/addon/event";
import {
  answersByKey,
  checkAnswers,
  displayOrder,
  inputName,
  isClean,
  problemText,
} from "../../../src/addon/prompts";
import {
  BODY_TTL_S,
  clearView,
  readBody,
  readView,
  writeBody,
  writeView,
} from "../../../src/addon/view";
import { FakeCache } from "../../fakes/cache";
import { template, view } from "./fixtures";

const FIELDS = [
  { key: "a", label: "Alpha", implicit: false },
  { key: "b", label: "Beta", implicit: false },
  { key: "{var}sender.phone", label: "Your phone", implicit: true },
];

describe("prompt rules (wireframe 02)", () => {
  it("names inputs p-1 upwards", () => {
    expect([0, 19].map(inputName)).toEqual(["p-1", "p-20"]);
  });

  it("flags blank and over-long values and words the error line", () => {
    const check = checkAnswers(FIELDS, ["x", " ", "y".repeat(501)]);
    expect(check).toEqual({ blank: [1], tooLong: [2] });
    expect(isClean(check)).toBe(false);
    expect(problemText(FIELDS, check)).toBe(
      "Fill 1 field: Beta\nShorten to 500 characters: Your phone",
    );
    expect(problemText(FIELDS, checkAnswers(FIELDS, []))).toBe(
      "Fill 3 fields: Alpha, Beta, Your phone",
    );
    expect(isClean(checkAnswers(FIELDS, ["a", "b", "y".repeat(500)]))).toBe(
      true,
    );
  });

  it("orders flagged fields first, the rest in template order", () => {
    expect(displayOrder(3, { blank: [2], tooLong: [1] })).toEqual([1, 2, 0]);
    expect(displayOrder(3, { blank: [], tooLong: [] })).toEqual([0, 1, 2]);
  });

  it("keys answers by prompt identity", () => {
    expect(answersByKey(FIELDS, ["1", "2"])).toEqual({
      a: "1",
      b: "2",
      "{var}sender.phone": "",
    });
  });
});

describe("event object", () => {
  it("reads parameters and form inputs from commonEventObject, then the legacy fields", () => {
    expect(
      paramsOf({ commonEventObject: { parameters: { id: "1" } } }),
    ).toEqual({ id: "1" });
    expect(paramsOf({ parameters: { id: "2" } })).toEqual({ id: "2" });
    expect(paramsOf(undefined)).toEqual({});
    expect(
      formValue(
        {
          commonEventObject: {
            formInputs: { "p-1": { stringInputs: { value: ["v"] } } },
          },
        },
        "p-1",
      ),
    ).toBe("v");
    expect(formValue({ formInput: { "p-1": "w" } }, "p-1")).toBe("w");
    expect(formValue(undefined, "p-1")).toBe("");
  });

  it("returns the one To recipient only when it is in the caller's domain", () => {
    const to = (...toRecipients: string[]) => ({
      draftMetadata: { toRecipients },
    });
    const me = "me@example.com";
    expect(internalRecipient(to("Bob@Example.com"), me)).toBe(
      "bob@example.com",
    );
    expect(internalRecipient(to("x@other.example"), me)).toBe("");
    expect(internalRecipient(to("a@example.com", "b@example.com"), me)).toBe(
      "",
    );
    expect(internalRecipient(to(), me)).toBe("");
    expect(internalRecipient(undefined, me)).toBe("");
    expect(internalRecipient(to("a@example.com"), "")).toBe("");
  });
});

describe("User Cache view and bodies", () => {
  it("round-trips the view in chunks and clears it", () => {
    const cache = new FakeCache(() => 0);
    const big = view({
      templates: Array.from({ length: 600 }, (_, n) => ({
        ...template("T"),
        id: `T${String(n)}`,
        snippet: "s".repeat(80),
      })),
    });
    writeView(cache, big, 5);
    expect(readView(cache)?.templates).toHaveLength(600);
    clearView(cache);
    expect(readView(cache)).toBeNull();
  });

  it("caches bodies up to one entry and ignores malformed entries", () => {
    const cache = new FakeCache(() => 0);
    writeBody(cache, "T1", { version: 2, html: "<p>x</p>" });
    expect(readBody(cache, "T1")).toEqual({ version: 2, html: "<p>x</p>" });
    writeBody(cache, "T2", { version: 1, html: "x".repeat(95_000) });
    expect(readBody(cache, "T2")).toBeNull();
    cache.put("body:T3", JSON.stringify({ version: "1" }), BODY_TTL_S);
    expect(readBody(cache, "T3")).toBeNull();
  });
});
