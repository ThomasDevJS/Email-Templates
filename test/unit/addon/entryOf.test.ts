import { describe, expect, it } from "vitest";
import { entryOf, messageIdOf } from "../../../src/addon/event";

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
