// TEMPORARY (spike S6): removed with src/addon/spikeS6.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderReply } from "../../../src/addon/cards/render";
import {
  S6_BODY,
  S6_SUBJECT,
  s6ApplyFlow,
  s6Card,
  s6CardFlow,
  s6Draft,
  s6Recipients,
  s6Sections,
  s6Summary,
  s6Timed,
  type S6Recipients,
} from "../../../src/addon/spikeS6";
import {
  createRecordingCardService,
  type RecordedCall,
} from "../../fakes/output";

const NONE: S6Recipients = { to: undefined, cc: undefined, bcc: undefined };
const TYPED: S6Recipients = {
  to: ["A <a@example.com>"],
  cc: ["b@example.com", "c@example.com"],
  bcc: [],
};
const TEST = {
  to: ["s6-to@migway.com"],
  cc: ["s6-cc@migway.com"],
  bcc: ["s6-bcc@migway.com"],
};

describe("s6Draft", () => {
  it("New only: body, subject and the three test addresses, whatever the draft holds", () => {
    expect(s6Draft("new", TYPED)).toEqual({
      body: S6_BODY,
      subject: S6_SUBJECT,
      ...TEST,
    });
  });

  it("Draft plus new: the draft list as received, then the test address", () => {
    expect(s6Draft("plus", TYPED)).toEqual({
      body: S6_BODY,
      subject: S6_SUBJECT,
      to: ["A <a@example.com>", "s6-to@migway.com"],
      cc: ["b@example.com", "c@example.com", "s6-cc@migway.com"],
      bcc: ["s6-bcc@migway.com"],
    });
  });

  it("Draft plus new with missing fields sends the test addresses only", () => {
    expect(s6Draft("plus", NONE)).toEqual(s6Draft("new", NONE));
  });

  it("Raw Cc again: one Cc action and nothing else", () => {
    expect(s6Draft("raw", TYPED)).toEqual({
      body: null,
      subject: null,
      to: null,
      cc: ["s6-cc@migway.com"],
      bcc: null,
    });
  });

  it("Recipients only: the three recipient actions, no body or subject", () => {
    expect(s6Draft("rcpt", TYPED)).toEqual({
      body: null,
      subject: null,
      ...TEST,
    });
  });
});

describe("s6Recipients", () => {
  it("reads draftMetadata first, then gmail, values unchanged", () => {
    expect(
      s6Recipients({
        draftMetadata: { toRecipients: ["X <x@example.com>"] },
        gmail: { toRecipients: ["other"], ccRecipients: [" c@example.com "] },
      }),
    ).toEqual({
      to: ["X <x@example.com>"],
      cc: [" c@example.com "],
      bcc: undefined,
    });
  });

  it("treats a missing event or a non-list value as missing", () => {
    expect(s6Recipients(undefined)).toEqual(NONE);
    expect(
      s6Recipients({
        gmail: { toRecipients: "a@example.com", ccRecipients: [1] },
      }),
    ).toEqual(NONE);
  });
});

describe("summary and timing", () => {
  it("names each action with its address count", () => {
    expect(s6Summary(s6Draft("plus", TYPED))).toBe(
      "body, subject, To 2, Cc 3, Bcc 1",
    );
    expect(s6Summary(s6Draft("raw", TYPED))).toBe("Cc 1");
  });

  it("adds the action list and callback ms to the body; a draft without body is unchanged", () => {
    expect(s6Timed(s6Draft("new", NONE), "new", 12).body).toBe(
      "S6 body<br>S6 New only: body, subject, To 1, Cc 1, Bcc 1. Callback 12 ms.",
    );
    const rcpt = s6Draft("rcpt", NONE);
    expect(s6Timed(rcpt, "rcpt", 12)).toBe(rcpt);
  });
});

describe("dev gate", () => {
  it("shows the home section in dev only", () => {
    expect(s6Sections("prod")).toEqual([]);
    expect(s6Sections("test")).toEqual([]);
    expect(s6Sections("dev")).toEqual([
      expect.objectContaining({ header: "Spike S6 (temporary)" }),
    ]);
  });

  it("flows outside dev return a pop and build no draft response", () => {
    const event = { commonEventObject: { parameters: { b: "new" } } };
    expect(s6CardFlow("prod", event)).toEqual({ kind: "pop" });
    expect(s6ApplyFlow("prod", event, { b: "new" }, 0, () => 5)).toEqual({
      kind: "pop",
    });
  });

  it("dev flows push the card and answer with the timed draft", () => {
    expect(s6CardFlow("dev", undefined)).toMatchObject({ kind: "push" });
    expect(s6ApplyFlow("dev", undefined, { b: "raw" }, 100, () => 107)).toEqual(
      { kind: "s6", draft: s6Draft("raw", NONE) },
    );
    expect(
      s6ApplyFlow("dev", undefined, { b: "toString" }, 0, () => 0),
    ).toEqual({ kind: "pop" });
  });
});

describe("s6Card", () => {
  it("shows the event strings exactly and one button per action set", () => {
    const card = s6Card({ ...TYPED, bcc: undefined });
    expect(card.sections[0]?.widgets[0]).toEqual({
      kind: "text",
      text: 'To: ["A <a@example.com>"]\nCc: ["b@example.com","c@example.com"]\nBcc: (missing)',
    });
    const items = card.sections[1]?.widgets.filter((w) => w.kind === "item");
    expect(
      items?.map((w) => [
        w.button?.text,
        w.button?.action.params,
        w.bottomLabel,
      ]),
    ).toEqual([
      ["New only", { b: "new" }, "body, subject, To 1, Cc 1, Bcc 1"],
      ["Draft plus new", { b: "plus" }, "body, subject, To 2, Cc 3, Bcc 1"],
      ["Raw Cc again", { b: "raw" }, "Cc 1"],
      ["Recipients only", { b: "rcpt" }, "To 1, Cc 1, Bcc 1"],
    ]);
  });
});

describe("s6 render", () => {
  let calls: RecordedCall[];
  beforeEach(() => {
    const cards = createRecordingCardService();
    calls = cards.calls;
    vi.stubGlobal("CardService", cards.service);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets one action per part in one response and never a send status", () => {
    renderReply({ kind: "s6", draft: s6Draft("plus", TYPED) });
    const methods = calls.map((c) => c.method);
    expect(
      methods.filter((m) => m === "newUpdateDraftActionResponseBuilder"),
    ).toHaveLength(1);
    for (const setter of [
      "setUpdateDraftBodyAction",
      "setUpdateDraftSubjectAction",
      "setUpdateDraftToRecipientsAction",
      "setUpdateDraftCcRecipientsAction",
      "setUpdateDraftBccRecipientsAction",
    ])
      expect(methods).toContain(setter);
    expect(methods).not.toContain("setSendStatus");
    expect(
      calls.find((c) => c.method === "addUpdateCcRecipients")?.args[0],
    ).toEqual(["b@example.com", "c@example.com", "s6-cc@migway.com"]);
  });

  it("Recipients only sets no body or subject action", () => {
    renderReply({ kind: "s6", draft: s6Draft("rcpt", NONE) });
    const methods = calls.map((c) => c.method);
    expect(methods).not.toContain("setUpdateDraftBodyAction");
    expect(methods).not.toContain("setUpdateDraftSubjectAction");
    expect(methods).toContain("setUpdateDraftBccRecipientsAction");
  });
});
