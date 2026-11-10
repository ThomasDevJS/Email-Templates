// TEMPORARY (spike S7): removed with src/addon/spikeS7.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCard, renderReply } from "../../../src/addon/cards/render";
import type { ButtonSpec, CardSpec } from "../../../src/addon/cards/spec";
import type { AddonEvent } from "../../../src/addon/event";
import {
  S7_BCC,
  S7_CC,
  S7_HTML,
  S7_SUBJECT,
  S7_TO,
  s7Call,
  s7Card,
  s7CardFlow,
  s7ComposeFlow,
  s7Failure,
  s7NotifyFlow,
  s7Run,
  s7Sections,
  s7Shape,
  s7Visible,
} from "../../../src/addon/spikeS7";
import { createRecordingGmail } from "../../fakes/gmail";
import {
  createRecordingCardService,
  type RecordedCall,
} from "../../fakes/output";

const TOKEN = "token-value-not-shown";
const INBOX: AddonEvent = { gmail: { accessToken: TOKEN } };
const MESSAGE: AddonEvent = {
  gmail: { accessToken: TOKEN, messageId: "msg-value-not-shown" },
};
const OPTIONS = { htmlBody: S7_HTML, cc: S7_CC, bcc: S7_BCC };

function buttonsOf(card: CardSpec): ButtonSpec[] {
  return card.sections
    .flatMap((s) => s.widgets)
    .flatMap((w) => (w.kind === "buttons" ? [...w.buttons] : []));
}

describe("s7Call: one Gmail call per button", () => {
  it("New email: createDraft(To, subject, empty body, htmlBody, Cc, Bcc)", () => {
    expect(s7Call("new", "")).toEqual({
      method: "createDraft",
      args: ["s7-to@migway.com", "S7 test", "", OPTIONS],
    });
    expect([S7_TO, S7_SUBJECT]).toEqual(["s7-to@migway.com", "S7 test"]);
    expect([S7_CC, S7_BCC]).toEqual(["s7-cc@migway.com", "s7-bcc@migway.com"]);
  });

  it("Reply and Reply all: the open message, empty body, no To and no subject option", () => {
    expect(s7Call("reply", "m1")).toEqual({
      method: "createDraftReply",
      messageId: "m1",
      args: ["", OPTIONS],
    });
    expect(s7Call("replyAll", "m1")).toEqual({
      method: "createDraftReplyAll",
      messageId: "m1",
      args: ["", OPTIONS],
    });
    expect(OPTIONS).not.toHaveProperty("subject");
  });

  it("the body holds bold text, a 2-item list, a link to google.com and an https gstatic image", () => {
    expect(S7_HTML).toContain("<b>");
    expect(S7_HTML.match(/<li>/g)).toHaveLength(2);
    expect(S7_HTML).toContain('href="https://www.google.com"');
    expect(S7_HTML).toMatch(/<img src="https:\/\/www\.gstatic\.com\//);
  });
});

describe("s7Run", () => {
  it("sets the access token first, then makes the one call; never a send method", () => {
    for (const button of ["new", "reply", "replyAll"] as const) {
      const fake = createRecordingGmail();
      const call = s7Call(button, "m1");
      expect(s7Run(call, fake.gmail, "tok")).toEqual({ draft: call.method });
      expect(fake.calls[0]).toEqual({
        method: "setCurrentMessageAccessToken",
        args: ["tok"],
      });
      expect(fake.calls.at(-1)).toEqual({
        method: call.method,
        args: [...call.args],
      });
      expect(fake.calls.map((c) => c.method).join()).not.toMatch(/send/i);
    }
  });

  it("replies look the message up by ID", () => {
    const fake = createRecordingGmail();
    s7Run(s7Call("reply", "m9"), fake.gmail, "tok");
    expect(fake.calls.map((c) => [c.method, c.args[0]])).toEqual([
      ["setCurrentMessageAccessToken", "tok"],
      ["getMessageById", "m9"],
      ["createDraftReply", ""],
    ]);
  });
});

describe("s7ComposeFlow", () => {
  it("New email from the inbox returns the draft", () => {
    const fake = createRecordingGmail();
    expect(s7ComposeFlow("dev", INBOX, { b: "new" }, fake.gmail)).toEqual({
      kind: "s7",
      draft: { draft: "createDraft" },
    });
  });

  it("Reply all with a message open uses its ID", () => {
    const fake = createRecordingGmail();
    s7ComposeFlow("dev", MESSAGE, { b: "replyAll" }, fake.gmail);
    expect(fake.calls[1]).toEqual({
      method: "getMessageById",
      args: ["msg-value-not-shown"],
    });
  });

  it.each([
    [
      "prod build",
      "prod",
      MESSAGE,
      { b: "new" },
      "S7: the harness is off in this build.",
    ],
    [
      "no button",
      "dev",
      MESSAGE,
      { x: "1" },
      "S7: no button parameter. Parameters: x",
    ],
    [
      "unknown button",
      "dev",
      MESSAGE,
      {},
      "S7: no button parameter. Parameters: (none)",
    ],
    [
      "compose toolbar",
      "dev",
      { ...MESSAGE, draftMetadata: {} },
      { b: "new" },
      "S7 New email: run the harness from the side panel, not from a draft's toolbar.",
    ],
    [
      "no token",
      "dev",
      { gmail: { messageId: "m1" } },
      { b: "new" },
      "S7 New email: the event has no gmail.accessToken.",
    ],
    [
      "reply without a message",
      "dev",
      INBOX,
      { b: "reply" },
      "S7 Reply: no message is open. Open a message, then the harness.",
    ],
  ] as const)(
    "%s: refuses with a reason and calls nothing",
    (_, env, event, params, text) => {
      const fake = createRecordingGmail();
      expect(s7ComposeFlow(env, event, params, fake.gmail)).toEqual({
        kind: "notify",
        text,
      });
      expect(fake.calls).toEqual([]);
    },
  );

  it("reads the deprecated messageMetadata token and message ID", () => {
    const fake = createRecordingGmail();
    s7ComposeFlow(
      "dev",
      { messageMetadata: { accessToken: "old", messageId: "m2" } },
      { b: "reply" },
      fake.gmail,
    );
    expect(fake.calls.map((c) => c.args[0])).toEqual(["old", "m2", ""]);
  });
});

describe("dev gate", () => {
  it("prod: no home section, the card and Notify callbacks say the harness is off", () => {
    expect(s7Sections("prod", "message")).toEqual([]);
    expect(s7CardFlow("prod", MESSAGE)).toEqual(s7NotifyFlow("prod"));
    expect(s7NotifyFlow("prod")).toEqual({
      kind: "notify",
      text: "S7: the harness is off in this build.",
    });
  });

  it("dev: the section only in the side panel", () => {
    expect(s7Sections("dev", "compose")).toEqual([]);
    for (const entry of ["inbox", "message"] as const)
      expect(s7Sections("dev", entry)).toEqual([
        {
          header: "Spike S7 (temporary)",
          widgets: [
            {
              kind: "buttons",
              buttons: [
                { text: "Open S7 harness", action: { fn: "onS7Card" } },
              ],
            },
          ],
        },
      ]);
  });

  it("dev Notify returns a notification", () => {
    expect(s7NotifyFlow("dev")).toEqual({
      kind: "notify",
      text: "S7 Notify: the callback ran. No draft was made.",
    });
  });
});

describe("s7Card", () => {
  it("all four buttons are compose actions; Reply and Reply all are off without a message", () => {
    const inbox = buttonsOf(s7Card(INBOX, "dev"));
    expect(inbox.map((b) => [b.text, b.compose, b.disabled ?? false])).toEqual([
      ["New email", "STANDALONE_DRAFT", false],
      ["Reply", "REPLY_AS_DRAFT", true],
      ["Reply all", "REPLY_AS_DRAFT", true],
      ["Notify", "STANDALONE_DRAFT", false],
    ]);
    expect(inbox.map((b) => b.action)).toEqual([
      { fn: "onS7Compose", params: { b: "new" } },
      { fn: "onS7Compose", params: { b: "reply" } },
      { fn: "onS7Compose", params: { b: "replyAll" } },
      { fn: "onS7Notify" },
    ]);
    expect(
      buttonsOf(s7Card(MESSAGE, "dev")).map((b) => b.disabled ?? false),
    ).toEqual([false, false, false, false]);
  });

  it("dev card flow pushes the card", () => {
    expect(s7CardFlow("dev", MESSAGE)).toEqual({
      kind: "push",
      card: s7Card(MESSAGE, "dev"),
    });
  });
});

describe("s7Shape", () => {
  it("names and types only, never a value", () => {
    const shape = s7Shape("dev", {
      ...MESSAGE,
      messageMetadata: { accessToken: TOKEN, list: ["a@b.example"], n: null },
      commonEventObject: { parameters: { b: "x" } },
    });
    expect(shape.split("\n")).toEqual([
      "env: dev",
      "entry: message",
      "message ID present: yes",
      "access token present: yes",
      "event: gmail object, messageMetadata object, commonEventObject object",
      "gmail: accessToken string, messageId string",
      "messageMetadata: accessToken string, list array, n null",
      "commonEventObject: parameters object",
    ]);
    for (const value of [TOKEN, "msg-value-not-shown", "a@b.example"])
      expect(shape).not.toContain(value);
  });

  it("an empty or missing event", () => {
    expect(s7Shape("dev", undefined)).toContain("event: (none)");
    expect(s7Shape("dev", {})).toContain("event: (empty)");
    expect(s7Shape("dev", {})).toContain("message ID present: no");
  });
});

describe("visible failures", () => {
  it("an exception becomes a notification and a card with its message", () => {
    const reply = s7Visible(() => {
      throw new Error("Access denied: GmailApp");
    }, s7Failure);
    expect(reply).toMatchObject({
      kind: "s7Error",
      text: "S7 failed: Access denied: GmailApp",
      card: { title: "Spike S7 failed" },
    });
    expect(s7Failure("plain")).toMatchObject({ text: "S7 failed: plain" });
    expect(
      s7Visible(
        () => 1,
        () => 2,
      ),
    ).toBe(1);
  });
});

describe("render (spike S7)", () => {
  let calls: RecordedCall[];
  beforeEach(() => {
    const cards = createRecordingCardService();
    calls = cards.calls;
    vi.stubGlobal("CardService", cards.service);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const methods = () => calls.map((c) => c.method);

  it("a compose button uses setComposeAction with its email type, not setOnClickAction", () => {
    renderCard(s7Card(MESSAGE, "dev"));
    const compose = calls.filter((c) => c.method === "setComposeAction");
    expect(compose.map((c) => c.args[1])).toEqual([
      "STANDALONE_DRAFT",
      "REPLY_AS_DRAFT",
      "REPLY_AS_DRAFT",
      "STANDALONE_DRAFT",
    ]);
    expect(methods()).not.toContain("setOnClickAction");
  });

  it("s7 returns a ComposeActionResponse with the draft", () => {
    const draft = {} as GoogleAppsScript.Gmail.GmailDraft;
    renderReply({ kind: "s7", draft });
    expect(methods()).toEqual([
      "newComposeActionResponseBuilder",
      "setGmailDraft",
      "build",
    ]);
    expect(calls[1]?.args[0]).toBe(draft);
  });

  it("s7Error shows a notification and pushes the error card", () => {
    renderReply(s7Failure(new Error("boom")));
    expect(methods()).toContain("setNotification");
    expect(methods()).toContain("pushCard");
    expect(
      calls.filter((c) => c.method === "setText").map((c) => c.args[0]),
    ).toContain("S7 failed: boom");
  });
});
