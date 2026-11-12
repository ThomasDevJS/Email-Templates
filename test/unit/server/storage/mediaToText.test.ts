import { describe, expect, it } from "vitest";
import { mediaToText } from "../../../../src/server/storage/advancedDrive";

describe("mediaToText (spike S2 (e))", () => {
  it("passes strings through", () => {
    expect(mediaToText('{"a":1}')).toBe('{"a":1}');
  });
  it("decodes byte arrays", () => {
    expect(mediaToText([123, 125])).toBe("{}");
  });
  it("reads blobs", () => {
    expect(mediaToText({ getDataAsString: () => "x" })).toBe("x");
  });
  it("re-serializes a parsed JSON object", () => {
    expect(mediaToText({ rev: 3, items: [] })).toBe('{"rev":3,"items":[]}');
  });
  it("rejects a file resource returned instead of media", () => {
    expect(() =>
      mediaToText({
        kind: "drive#file",
        id: "1",
        mimeType: "application/json",
        name: "index.json",
      }),
    ).toThrow(/alt=media ignored/);
  });
  it("rejects primitives that are not text", () => {
    expect(() => mediaToText(42)).toThrow(/type=number/);
  });
});
