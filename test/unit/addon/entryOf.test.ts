import { describe, expect, it } from "vitest";
import {
  addressesOf,
  entryOf,
  internalAddress,
  messageIdOf,
  tokenOf,
} from "../../../src/addon/event";

describe("entryOf (ADR-0007 section 4)", () => {
  it("compose: draftMetadata present, even with a message ID", () => {
    expect(entryOf({ draftMetadata: {} })).toBe("compose");
    expect(entryOf({ draftMetadata: {}, gmail: { messageId: "m1" } })).toBe(
      "compose",
    );
  });

  it("message: gmail.messageId, or the deprecated messageMetadata.messageId", () => {
    expect(entryOf({ gmail: { messageId: "m1", accessToken: "t" } })).toBe(
      "message",
    );
    expect(entryOf({ messageMetadata: { messageId: "m2" } })).toBe("message");
  });

  it("inbox: side panel with no message ID (the spike S6 event shape)", () => {
    expect(entryOf({ gmail: { accessToken: "t" }, messageMetadata: {} })).toBe(
      "inbox",
    );
    expect(entryOf({ gmail: { messageId: " " } })).toBe("inbox");
    expect(entryOf({ gmail: { messageId: 7 } })).toBe("inbox");
  });

  it("an undefined or empty event is the inbox", () => {
    expect(entryOf(undefined)).toBe("inbox");
    expect(entryOf({})).toBe("inbox");
  });

  it("messageIdOf prefers gmail over messageMetadata", () => {
    expect(
      messageIdOf({
        gmail: { messageId: "a" },
        messageMetadata: { messageId: "b" },
      }),
    ).toBe("a");
    expect(messageIdOf(undefined)).toBe("");
  });
});

describe("side-panel event and header readers (slice 18)", () => {
  it("tokenOf: gmail.accessToken, else messageMetadata.accessToken, else empty", () => {
    expect(tokenOf({ gmail: { accessToken: "a" } })).toBe("a");
    expect(tokenOf({ messageMetadata: { accessToken: "b" } })).toBe("b");
    expect(tokenOf({ gmail: { accessToken: 5 } })).toBe("");
    expect(tokenOf(undefined)).toBe("");
  });

  it("addressesOf: bare lower-case addresses; a display name with a comma does not split one (AC 5)", () => {
    expect(
      addressesOf('"Doe, Ann" <Ann@Example.com>, carl@example.com; <d@x.org>'),
    ).toEqual(["ann@example.com", "carl@example.com", "d@x.org"]);
    expect(addressesOf("")).toEqual([]);
    expect(addressesOf("Undisclosed recipients")).toEqual([]);
  });

  it("internalAddress: only the caller's domain, trimmed and lower case", () => {
    expect(internalAddress(" Bob@Example.com ", "ana@example.com")).toBe(
      "bob@example.com",
    );
    expect(internalAddress("max@outside.example", "ana@example.com")).toBe("");
    expect(internalAddress("", "ana@example.com")).toBe("");
    expect(internalAddress("bob@example.com", "")).toBe("");
  });
});
