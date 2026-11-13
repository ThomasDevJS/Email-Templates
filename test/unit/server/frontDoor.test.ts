import { describe, expect, it } from "vitest";
import {
  bodyLength,
  frontDoorRefusal,
  MAX_POST_BYTES,
  mediaType,
  TOO_LARGE,
  UNSUPPORTED_TYPE,
} from "../../../src/server/frontDoor";

const json = (type: unknown, length: unknown = 10) => ({
  type,
  length,
  contents: "{}",
});

describe("frontDoorRefusal (spec section 5.11, slice 29)", () => {
  it.each([
    ["application/json", "passes"],
    ["application/json; charset=utf-8", "passes"],
    ["Application/JSON", "passes"],
    ["application/json;charset=UTF-8", "passes"],
    [" application/json ", "passes"],
    ["application/jsonx", "refuses"],
    ["text/plain;application/json", "refuses"],
    ["application/json, text/plain", "refuses"],
    ["text/plain", "refuses"],
    ["application/x-www-form-urlencoded", "refuses"],
    ["multipart/form-data", "refuses"],
    ["multipart/form-data; boundary=x", "refuses"],
    ["", "refuses"],
    [undefined, "refuses"],
    [null, "refuses"],
    [42, "refuses"],
  ])("type %j %s", (type, result) => {
    expect(frontDoorRefusal(json(type))).toBe(
      result === "passes" ? null : UNSUPPORTED_TYPE,
    );
  });

  it.each([undefined, null])(
    "postData %j refuses with the content type message",
    (postData) => {
      expect(frontDoorRefusal(postData)).toBe(UNSUPPORTED_TYPE);
    },
  );

  it("length 262,144 passes, 262,145 refuses as too large", () => {
    expect(MAX_POST_BYTES).toBe(262_144);
    expect(frontDoorRefusal(json("application/json", 262_144))).toBeNull();
    expect(frontDoorRefusal(json("application/json", 262_145))).toBe(TOO_LARGE);
  });

  it("checks the type before the size: a large text/plain body gets the content type message", () => {
    expect(frontDoorRefusal(json("text/plain", 1_000_000))).toBe(
      UNSUPPORTED_TYPE,
    );
  });

  it("Infinity as length refuses as too large", () => {
    expect(frontDoorRefusal(json("application/json", Infinity))).toBe(
      TOO_LARGE,
    );
  });
});

describe("mediaType", () => {
  it("lower-cases, cuts at the first semicolon and trims", () => {
    expect(mediaType("  Application/JSON ; charset=utf-8; x=y")).toBe(
      "application/json",
    );
    expect(mediaType(undefined)).toBe("");
  });
});

describe("bodyLength (fallback when postData.length is absent or no number)", () => {
  it("uses postData.length when it is a number", () => {
    expect(bodyLength({ length: 7, contents: "a" })).toBe(7);
  });

  it.each([
    ["absent", undefined],
    ["a string", "262145"],
    ["NaN", Number.NaN],
  ])("uses contents.length when length is %s", (_name, length) => {
    const contents = "x".repeat(MAX_POST_BYTES + 1);
    expect(bodyLength({ length, contents })).toBe(MAX_POST_BYTES + 1);
    expect(
      frontDoorRefusal({ type: "application/json", length, contents }),
    ).toBe(TOO_LARGE);
  });

  it("is 0 with neither a number length nor string contents", () => {
    expect(bodyLength({})).toBe(0);
  });
});
