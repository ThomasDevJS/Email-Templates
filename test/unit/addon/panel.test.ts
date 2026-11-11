import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import { ErrorCode } from "../../../src/shared/errors/codes";
import { PERSONAL_OFF_TEXT } from "../../../src/shared/model/settings";
import type { CardSpec, Reply } from "../../../src/addon/cards/spec";
import type { ServerCall } from "../../../src/addon/client/serverClient";
import { draftInfo, type AddonEvent } from "../../../src/addon/event";
import {
  homeFlow,
  insertFlow,
  previewFlow,
  promptInsertFlow,
  type Ports,
} from "../../../src/addon/flows";
import {
  COUNTS_CHANGED,
  DRAFT_NOT_OPENED,
  LISTS_CHANGED,
  NO_MESSAGE,
  PANEL_DENIED,
  PANEL_NOT_FOUND,
  TEMPLATE_CHANGED,
  TOO_LONG,
  UNREADABLE,
  composeFlow,
  failureText,
  WRONG,
  panelAnswer,
  promptComposeFlow,
  type PanelReply,
} from "../../../src/addon/panel";
import { readView } from "../../../src/addon/view";
import { readBuffer } from "../../../src/server/audit/buffer";
import { FakeCache } from "../../fakes/cache";
import { createRecordingGmail, type FakeHeaders } from "../../fakes/gmail";
import type { RecordedCall } from "../../fakes/output";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

/** Side-panel actions (spec 4.1a, 7.2, 13.11; ADR-0007 A3 to A8) against the real server. */
const ANA = "ana@example.com";
const BOB = "bob@example.com";
const TO = "payroll@example.com";
const CC = "safety@example.com";
const BCC = "records@example.com";
const OUT = "partner@outside.example";
let world: World;
let cache: FakeCache;
let sent: { op: string; args: unknown }[];
let gmailCalls: RecordedCall[];
let sales: Folder;

beforeEach(() => {
  world = setupWorld();
  cache = new FakeCache(() => world.clock.now);
  sent = [];
  gmailCalls = [];
  sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
  world.ok(OWNER, "grant.add", {
    folderId: sales.id,
    principalType: "user",
    principalKey: ANA,
    level: "use",
  });
  world.directory.users.set(ANA, { name: { fullName: "Ana Lima" } });
  world.directory.users.set(BOB, { name: { givenName: "Bob" } });
});

const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

/** Ports on the real server; the Gmail fake answers with `headers` (null: no message) and throws at `fail`. */
function ports(
  entry: "inbox" | "message" | "compose" = "inbox",
  headers: FakeHeaders | null = {},
  fail = "",
): Ports {
  const fake = createRecordingGmail(headers, fail);
  gmailCalls = fake.calls;
  return {
    call: (op, args): ServerCall => {
      sent.push({ op, args });
      return {
        requestId: `REQ-${op}`,
        response: world.call(ANA, op, args, "addon"),
      };
    },
    cache,
    nowMs: () => world.clock.now,
    userEmail: ANA,
    execUrl: "https://script.google.com/macros/s/TEST/exec",
    entry,
    hash,
    gmail: fake.gmail,
  };
}

function create(fields: Partial<Item> & { html: string }): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId: sales.id,
    title: "T",
    ...fields,
  });
}

const inbox: AddonEvent = { gmail: { accessToken: "tok" } };
const opened: AddonEvent = { gmail: { accessToken: "tok", messageId: "m1" } };
const withForm = (
  event: AddonEvent,
  values: Record<string, string>,
): AddonEvent => ({
  ...event,
  commonEventObject: {
    formInputs: Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        { stringInputs: { value: [value] } },
      ]),
    ),
  },
});

const methods = () => gmailCalls.map((c) => c.method);
const draftCall = () =>
  gmailCalls.find((c) => c.method.startsWith("createDraft"));
const applies = () =>
  readBuffer(world.cache).events.filter((event) => event.kind === "apply");
const notice = (text: string): Reply => ({ kind: "notify", text });

function cardOf(reply: Reply): CardSpec {
  if (reply.kind === "push") return reply.card;
  throw new Error(`expected a card, got ${reply.kind}`);
}

/** The details card of `item` in the panel, then its footer and section buttons by `as`. */
function detailsParams(
  item: Item,
  entry: "inbox" | "message",
  as: string,
): Record<string, string> {
  const card = cardOf(previewFlow(ports(entry), inbox, { id: item.id }));
  const all = [
    card.footer?.primary,
    card.footer?.secondary,
    ...card.sections.flatMap((s) =>
      s.widgets.flatMap((w) => (w.kind === "buttons" ? w.buttons : [])),
    ),
  ];
  const found = all.find((b) => b?.action.params?.["as"] === as);
  return { ...found?.action.params };
}

describe("New email from a row (AC 3)", () => {
  it("token first, one apply without followUp, then createDraft with To joined, subject, cc only when not empty", () => {
    const item = create({
      subject: "Hello {{sender.name}}",
      html: "<p>Hi</p>",
      to: [TO, BOB],
      cc: [CC],
    });
    const reply = composeFlow(ports(), inbox, {
      id: item.id,
      as: "new",
      rc: "2,1,0",
    });
    expect(reply).toEqual({ kind: "compose", draft: { draft: "createDraft" } });
    expect(gmailCalls).toEqual([
      { method: "setCurrentMessageAccessToken", args: ["tok"] },
      {
        method: "createDraft",
        args: [
          `${TO},${BOB}`,
          "Hello Ana Lima",
          "",
          { htmlBody: "<p>Hi</p>", cc: CC },
        ],
      },
    ]);
    expect(sent).toEqual([
      {
        op: "template.apply",
        args: { id: item.id, knownVersion: 0, recipientEmailIfInternal: "" },
      },
    ]);
    expect(applies()).toHaveLength(1);
  });

  it("a template without recipients or subject gives an empty To, subject and no cc or bcc key", () => {
    const item = create({ html: "<p>x</p>" });
    composeFlow(ports(), inbox, { id: item.id, as: "new" });
    expect(draftCall()?.args).toEqual(["", "", "", { htmlBody: "<p>x</p>" }]);
  });
});

describe("Reply from a row (AC 4)", () => {
  it("reads the message, sends the internal reply-to as recipientEmailIfInternal, drops the template To and the present Cc", () => {
    const item = create({
      subject: "New subject",
      html: "<p>Hi {{recipient.first_name|there}}</p>",
      to: [TO],
      cc: [BOB, CC],
      bcc: [BCC],
    });
    const reply = composeFlow(
      ports("message", {
        from: "Someone <someone@example.com>",
        replyTo: '"Bob B" <Bob@Example.com>',
      }),
      opened,
      { id: item.id, as: "reply", rc: "1,2,1" },
    );
    expect(reply.kind).toBe("compose");
    expect(methods()).toEqual([
      "setCurrentMessageAccessToken",
      "getMessageById",
      "getReplyTo",
      "createDraftReply",
    ]);
    expect(gmailCalls[1]?.args).toEqual(["m1"]);
    expect(draftCall()?.args).toEqual([
      "",
      { htmlBody: "<p>Hi Bob</p>", cc: CC, bcc: BCC },
    ]);
    expect(JSON.stringify(gmailCalls)).not.toContain(TO);
    expect(sent[0]?.args).toEqual({
      id: item.id,
      knownVersion: 0,
      recipientEmailIfInternal: BOB,
    });
  });

  it("no reply-to: From decides; an outside sender sends an empty recipientEmailIfInternal", () => {
    const item = create({ html: "<p>Hi {{recipient.first_name|there}}</p>" });
    composeFlow(ports("message", { from: `Max <${OUT}>` }), opened, {
      id: item.id,
      as: "reply",
    });
    expect(draftCall()?.args).toEqual(["", { htmlBody: "<p>Hi there</p>" }]);
    expect(JSON.stringify(sent)).not.toContain("outside.example");
    composeFlow(ports("message", { from: `Bob <${BOB}>` }), opened, {
      id: item.id,
      as: "reply",
    });
    expect(draftCall()?.args).toEqual(["", { htmlBody: "<p>Hi Bob</p>" }]);
  });
});

describe("Reply all from the details card (AC 5)", () => {
  it("adds only template Cc absent from reply-to, To and Cc; display names with commas parse; no first name", () => {
    const item = create({
      html: "<p>Hi {{recipient.first_name|all}}</p>",
      cc: ["ann@example.com", "new@example.com", ANA],
      bcc: [BCC],
    });
    const params = detailsParams(item, "message", "replyAll");
    const reply = promptComposeFlow(
      ports("message", {
        from: `Bob <${BOB}>`,
        to: `"Doe, Ann" <ann@example.com>, ${ANA}`,
        cc: "carl@example.com",
      }),
      withForm(opened, { rcpt: "on" }),
      params,
    );
    expect(reply.kind).toBe("compose");
    expect(draftCall()).toEqual({
      method: "createDraftReplyAll",
      args: [
        "",
        { htmlBody: "<p>Hi all</p>", cc: "new@example.com", bcc: BCC },
      ],
    });
    expect(sent.at(-1)?.args).toEqual({
      id: item.id,
      knownVersion: 1,
      recipientEmailIfInternal: "",
    });
  });
});

describe("Reply all from a row (D33)", () => {
  it("one apply without a first name, then createDraftReplyAll with the new Cc only", () => {
    const item = create({
      html: "<p>Hi {{recipient.first_name|all}}</p>",
      to: [TO],
      cc: [CC, "ann@example.com"],
    });
    const reply = composeFlow(
      ports("message", { from: `Bob <${BOB}>`, cc: "ann@example.com" }),
      opened,
      { id: item.id, as: "replyAll", rc: "1,2,0" },
    );
    expect(reply.kind).toBe("compose");
    expect(draftCall()).toEqual({
      method: "createDraftReplyAll",
      args: ["", { htmlBody: "<p>Hi all</p>", cc: CC }],
    });
    expect(sent).toEqual([
      {
        op: "template.apply",
        args: { id: item.id, knownVersion: 0, recipientEmailIfInternal: "" },
      },
    ]);
    expect(applies()).toHaveLength(1);
  });
});

describe("rendering (AC 6): the compose pipeline", () => {
  const T2 = {
    subject: "Load {{ask:Load number}}",
    html: "<p>Hi {{ask:Driver name}}, load {{ask:Load number}} is ready. {{sender.phone}}</p>",
  };

  it("T2 by row: subject Load, the blanks removed with the gap rules", () => {
    const item = create(T2);
    composeFlow(ports(), inbox, { id: item.id, as: "new" });
    expect(draftCall()?.args.slice(1, 2)).toEqual(["Load"]);
    expect(draftCall()?.args[3]).toEqual({
      htmlBody: "<p>Hi, load is ready.</p>",
    });
  });

  it("the same template and values give the same HTML and subject on compose and panel paths", () => {
    world.directory.users.set(ANA, {
      name: { fullName: "Ana <Lima> & Co" },
      phones: [{ value: "555 0100", type: "work" }],
    });
    const item = create({
      subject: "From {{sender.name}} {{ask:Topic}}",
      html: '<p>Hi {{recipient.first_name|there}}, <b>{{sender.name}}</b> {{ask:Topic}} {{sender.phone}} <a href="https://example.com">x</a></p>',
    });
    const compose = insertFlow(ports("compose"), undefined, { id: item.id });
    if (compose.kind !== "insert") throw new Error(compose.kind);
    composeFlow(ports(), inbox, { id: item.id, as: "new" });
    expect(draftCall()?.args[1]).toBe(compose.subject);
    expect(draftCall()?.args[3]).toEqual({ htmlBody: compose.html });
    const card = cardOf(
      previewFlow(ports("compose"), undefined, { id: item.id }),
    );
    const typed = promptInsertFlow(
      ports("compose"),
      withForm(inbox, { "p-1": "Q3 <plan>", subj: "on" }),
      card.footer?.primary.action.params ?? {},
    );
    if (typed.kind !== "insert") throw new Error(typed.kind);
    const params = detailsParams(item, "inbox", "new");
    promptComposeFlow(ports(), withForm(inbox, { "p-1": "Q3 <plan>" }), params);
    expect(draftCall()?.args[1]).toBe(typed.subject);
    expect(draftCall()?.args[3]).toEqual({ htmlBody: typed.html });
  });

  it("blocked addresses reach no Gmail argument", () => {
    const item = create({
      html: "<p>x</p>",
      to: [OUT],
      cc: [CC],
      bcc: ["other@outside.example"],
    });
    setSetting(world, "recipientsExternal", "deny");
    composeFlow(ports(), inbox, { id: item.id, as: "new", rc: "0,1,0" });
    expect(draftCall()?.args).toEqual([
      "",
      "",
      "",
      { htmlBody: "<p>x</p>", cc: CC },
    ]);
    expect(JSON.stringify(gmailCalls)).not.toContain("outside.example");
  });
});

describe("row counts (AC 7)", () => {
  it("other counts than the row showed: the notification, the view cleared, no draft", () => {
    const item = create({ html: "<p>x</p>", cc: [CC] });
    homeFlow(ports());
    const reply = composeFlow(ports(), inbox, { id: item.id, as: "new" });
    expect(reply).toEqual(notice(COUNTS_CHANGED));
    expect(readView(cache)).toBeNull();
    expect(methods()).toEqual(["setCurrentMessageAccessToken"]);
    expect(applies()).toHaveLength(1);
  });
});

describe("details card press (AC 8, 9)", () => {
  let item: Item;
  beforeEach(() => {
    item = create({
      subject: "Load {{ask:Load number}}",
      html: "<p>Hi {{ask:Driver name}}, {{sender.name}} {{recipient.first_name}}</p>",
      to: [TO],
      cc: [CC],
    });
  });

  it("opening the card counts no use and calls no Gmail method", () => {
    detailsParams(item, "inbox", "new");
    expect(applies()).toHaveLength(0);
    expect(gmailCalls).toEqual([]);
  });

  it("typed values win, blank fields are removed; one use per press", () => {
    const params = detailsParams(item, "inbox", "new");
    promptComposeFlow(
      ports(),
      withForm(inbox, { "p-1": "77", "p-2": "Ann", rcpt: "on" }),
      params,
    );
    expect(draftCall()?.args).toEqual([
      TO,
      "Load 77",
      "",
      { htmlBody: "<p>Hi Ann, Ana Lima</p>", cc: CC },
    ]);
    expect(applies()).toHaveLength(1);
  });

  it("Add recipients off: an empty To and no cc or bcc", () => {
    const params = detailsParams(item, "inbox", "new");
    promptComposeFlow(ports(), withForm(inbox, { "p-1": "77" }), params);
    expect(draftCall()?.args).toEqual([
      "",
      "Load 77",
      "",
      { htmlBody: "<p>Hi, Ana Lima</p>" },
    ]);
  });

  it("a box over 500 characters: the notification, no server or Gmail call", () => {
    const params = detailsParams(item, "inbox", "new");
    sent = [];
    const reply = promptComposeFlow(
      ports(),
      withForm(inbox, { "p-2": "x".repeat(501) }),
      params,
    );
    expect(reply).toEqual(notice(TOO_LONG));
    expect(TOO_LONG).toBe(
      "Each box takes up to 500 characters. Shorten the long one and try again.",
    );
    expect(sent).toEqual([]);
    expect(gmailCalls).toEqual([]);
  });

  it("a new version or other lists: the notification and no draft", () => {
    const params = detailsParams(item, "inbox", "new");
    expect(
      promptComposeFlow(ports(), inbox, { ...params, version: "9" }),
    ).toEqual(notice(TEMPLATE_CHANGED));
    expect(promptComposeFlow(ports(), inbox, { ...params, rh: "x" })).toEqual(
      notice(LISTS_CHANGED),
    );
    expect(draftCall()).toBeUndefined();
  });
});

describe("server failures (AC 10)", () => {
  it("DENIED after access was lost: the template text, the view cleared, no Gmail draft", () => {
    const item = create({ html: "<p>x</p>" });
    homeFlow(ports());
    const grantId = world.services
      .store()
      .readIndex()
      .grants.find((g) => g.principalKey === ANA)?.id;
    world.ok(OWNER, "grant.remove", { grantId });
    expect(composeFlow(ports(), inbox, { id: item.id, as: "new" })).toEqual(
      notice(PANEL_DENIED),
    );
    expect(readView(cache)).toBeNull();
    expect(draftCall()).toBeUndefined();
  });

  it("NOT_FOUND for a deleted template: the panel text, the view cleared", () => {
    const item = create({ html: "<p>x</p>" });
    homeFlow(ports());
    world.ok(OWNER, "template.delete", { id: item.id });
    expect(composeFlow(ports(), inbox, { id: item.id, as: "new" })).toEqual(
      notice(PANEL_NOT_FOUND),
    );
    expect(readView(cache)).toBeNull();
    expect(draftCall()).toBeUndefined();
  });

  const failure = (code: ErrorCode, message = "m", requestId = "R1") => ({
    code,
    message,
    requestId,
  });

  it.each([
    [ErrorCode.QUOTA, "Service is busy. Try again in a minute."],
    [ErrorCode.BUSY, "The library is busy. Try again in a few seconds."],
    [ErrorCode.INTERNAL, WRONG],
    [ErrorCode.VALIDATION, WRONG],
    [ErrorCode.NETWORK, WRONG],
    [
      ErrorCode.NOT_CONFIGURED,
      "Migway Templates is not set up yet. Ask your admin to finish setup, then press Retry.",
    ],
    [
      ErrorCode.AUTH_NO_USER,
      "Cannot identify your Migway account. This app does not work when several Google accounts are signed in. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account.",
    ],
    [ErrorCode.DENIED, PANEL_DENIED],
    [ErrorCode.NOT_FOUND, PANEL_NOT_FOUND],
  ])(
    "%s gives its sentence, no request ID or technical message",
    (code, text) => {
      expect(failureText(failure(code))).toBe(text);
    },
  );

  it("the personal templates text passes through", () => {
    expect(failureText(failure(ErrorCode.DENIED, PERSONAL_OFF_TEXT))).toBe(
      PERSONAL_OFF_TEXT,
    );
  });

  it("a server failure on a press makes no Gmail draft", () => {
    const down: Ports = {
      ...ports(),
      call: () => ({
        requestId: "R9",
        response: {
          ok: false,
          error: { code: ErrorCode.QUOTA, message: "", retryable: true },
          serverVersion: "",
          durationMs: 0,
        },
      }),
    };
    expect(composeFlow(down, inbox, { id: "T", as: "new" })).toEqual(
      notice("Service is busy. Try again in a minute."),
    );
    expect(draftCall()).toBeUndefined();
  });
});

describe("refused before the server (AC 11)", () => {
  const item = () => create({ html: "<p>x</p>" });

  it.each([
    ["no message", null, ""],
    ["getMessageById throws", {}, "getMessageById"],
    ["getReplyTo throws", {}, "getReplyTo"],
    ["getTo throws", {}, "getTo"],
  ] as const)(
    "%s: the unreadable text and no template.apply",
    (_name, headers, fail) => {
      const id = item().id;
      const reply = promptComposeFlow(ports("message", headers, fail), opened, {
        id,
        as: "replyAll",
        version: "1",
        values: "{}",
        rh: "x",
      });
      expect(reply).toEqual(notice(UNREADABLE));
      expect(sent).toEqual([]);
    },
  );

  it("Reply or Reply all without a message ID: the text and no call", () => {
    for (const as of ["reply", "replyAll"]) {
      expect(composeFlow(ports(), inbox, { id: "T", as })).toEqual(
        notice(NO_MESSAGE),
      );
    }
    expect(sent).toEqual([]);
    expect(gmailCalls).toEqual([]);
  });

  it("an unknown as: the SERVER text and no call", () => {
    for (const as of [undefined, "forward", "toString"]) {
      const params: Record<string, string> =
        as === undefined ? { id: "T" } : { id: "T", as };
      expect(composeFlow(ports(), opened, params)).toEqual(
        notice("Something went wrong. Try again."),
      );
    }
    expect(sent).toEqual([]);
    expect(gmailCalls).toEqual([]);
  });
});

describe("every failure throws one plain sentence (AC 12, Follow-up 1)", () => {
  /** Runs a flow as entry.ts does; returns the thrown message, or "" when a draft came back. */
  function thrown(run: () => PanelReply, render = (r: PanelReply) => r) {
    try {
      panelAnswer(run, render);
      return "";
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      return (error as Error).message;
    }
  }
  const drafts = () =>
    gmailCalls.filter((c) => c.method.startsWith("createDraft")).length;
  /** No address, request ID, subject, Gmail message or stack line in the text. */
  const plain = (text: string) => {
    expect(text).not.toMatch(/@|REQ|R9|Gmail says no|Secret|\n|\bat /);
  };
  const quota: Ports["call"] = () => ({
    requestId: "R9",
    response: {
      ok: false,
      error: { code: ErrorCode.QUOTA, message: "quota", retryable: true },
      serverVersion: "",
      durationMs: 0,
    },
  });

  it("NOT_FOUND, DENIED, QUOTA: the sentence and no createDraft call", () => {
    const item = create({ subject: "Secret", html: "<p>x</p>" });
    const press = { id: item.id, as: "new" };
    world.ok(OWNER, "template.delete", { id: item.id });
    const gone = thrown(() => composeFlow(ports(), inbox, press));
    expect(gone).toBe(PANEL_NOT_FOUND);
    expect(drafts()).toBe(0);
    const kept = create({ html: "<p>x</p>" });
    const grantId = world.services
      .store()
      .readIndex()
      .grants.find((g) => g.principalKey === ANA)?.id;
    world.ok(OWNER, "grant.remove", { grantId });
    const denied = thrown(() =>
      composeFlow(ports(), inbox, { id: kept.id, as: "new" }),
    );
    expect(denied).toBe(PANEL_DENIED);
    expect(drafts()).toBe(0);
    const busy = thrown(() =>
      composeFlow({ ...ports(), call: quota }, inbox, press),
    );
    expect(busy).toBe("Service is busy. Try again in a minute.");
    expect(drafts()).toBe(0);
    for (const text of [gone, denied, busy]) plain(text);
  });

  it("an unreadable email: the sentence, no server call, no draft", () => {
    const text = thrown(() =>
      composeFlow(ports("message", null), opened, { id: "T", as: "reply" }),
    );
    expect(text).toBe(UNREADABLE);
    expect(sent).toEqual([]);
    expect(drafts()).toBe(0);
  });

  it.each([
    "setCurrentMessageAccessToken",
    "createDraft",
    "createDraftReply",
    "createDraftReplyAll",
  ])("a throw at %s: the generic sentence, the Gmail text dropped", (fail) => {
    const id = create({ html: "<p>x</p>" }).id;
    const as = { createDraft: "new", createDraftReplyAll: "replyAll" }[fail];
    const text = thrown(() =>
      composeFlow(ports("message", { from: `Bob <${BOB}>` }, fail), opened, {
        id,
        as: as ?? "reply",
      }),
    );
    expect(text).toBe(WRONG);
    plain(text);
    // The only createDraft* call is the failed one itself.
    expect(drafts()).toBe(fail.startsWith("createDraft") ? 1 : 0);
  });

  it("a throw inside the flow (a broken server port) gives the generic sentence", () => {
    const broken: Ports = {
      ...ports(),
      call: () => {
        throw new Error(`down for ${BOB}`);
      },
    };
    const text = thrown(() =>
      composeFlow(broken, inbox, { id: "T", as: "new" }),
    );
    expect(text).toBe(WRONG);
    plain(text);
    expect(drafts()).toBe(0);
  });

  it("a render problem after the draft exists names Drafts; a draft that renders throws nothing", () => {
    const draft: PanelReply = { kind: "compose", draft: {} as never };
    const text = thrown(
      () => draft,
      () => {
        throw new Error(`no window\n    at render (${BOB})`);
      },
    );
    expect(text).toBe(DRAFT_NOT_OPENED);
    plain(text);
    expect(
      panelAnswer(
        () => draft,
        (r) => r,
      ),
    ).toBe(draft);
  });

  it("every sentence it can throw is in docs/design/wording.md", () => {
    const wording = readFileSync(
      join(import.meta.dirname, "../../../docs/design/wording.md"),
      "utf8",
    );
    for (const text of [
      NO_MESSAGE,
      UNREADABLE,
      TOO_LONG,
      TEMPLATE_CHANGED,
      LISTS_CHANGED,
      COUNTS_CHANGED,
      DRAFT_NOT_OPENED,
      PANEL_NOT_FOUND,
      WRONG,
    ])
      expect(wording).toContain(text);
  });
});

describe("server arguments and logs (AC 15)", () => {
  it("every panel call sends only id, knownVersion and recipientEmailIfInternal or followUp; no value in any log line", () => {
    const item = create({
      subject: "Secret subject {{ask:A}}",
      html: "<p>{{ask:A}} {{recipient.first_name}}</p>",
      cc: [CC],
    });
    world.lines.length = 0;
    const params = detailsParams(item, "message", "reply");
    promptComposeFlow(
      ports("message", { from: `Bob <${BOB}>` }),
      withForm(opened, { "p-1": "typed value", rcpt: "on" }),
      params,
    );
    composeFlow(ports("message", { from: `Bob <${BOB}>` }), opened, {
      id: item.id,
      as: "reply",
      rc: "0,1,0",
    });
    const allowed = [
      "id",
      "knownVersion",
      "recipientEmailIfInternal",
      "followUp",
    ];
    for (const { args } of sent)
      for (const key of Object.keys(args as object))
        expect(allowed).toContain(key);
    const logs = world.lines.join("\n");
    for (const secret of [
      "typed value",
      "Secret subject",
      CC,
      BOB,
      "m1",
      "tok",
    ])
      expect(logs).not.toContain(secret);
    expect(Object.keys(draftInfo(opened)).sort()).toEqual([
      "bcc",
      "cc",
      "fields",
      "hasSubject",
      "to",
    ]);
    expect(applies()).toHaveLength(2);
  });
});
