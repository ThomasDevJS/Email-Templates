import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import { ErrorCode } from "../../../src/shared/errors/codes";
import type { CardSpec, Reply, Widget } from "../../../src/addon/cards/spec";
import type { ServerCall } from "../../../src/addon/client/serverClient";
import type { AddonEvent, Entry } from "../../../src/addon/event";
import {
  folderFlow,
  homeFlow,
  insertFlow,
  openLinkFlow,
  previewFlow,
  promptInsertFlow,
  refreshFlow,
  searchFlow,
  type Ports,
} from "../../../src/addon/flows";
import { readBody, readView } from "../../../src/addon/view";
import { FIELDS_LINE, FIRST_NAME_HINT } from "../../../src/addon/cards/details";
import { readBuffer } from "../../../src/server/audit/buffer";
import { FakeCache } from "../../fakes/cache";
import { createRecordingGmail } from "../../fakes/gmail";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
const EXEC = "https://script.google.com/macros/s/TEST/exec";
let world: World;
let cache: FakeCache;
let sent: { op: string; args: unknown }[];
let sales: Folder;

beforeEach(() => {
  world = setupWorld();
  cache = new FakeCache(() => world.clock.now);
  sent = [];
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

/** Ports wired to the real server through `handleRpc` on the add-on surface. */
function ports(email = ANA, entry: Entry = "compose"): Ports {
  return {
    call: (op, args): ServerCall => {
      sent.push({ op, args });
      return {
        requestId: `req-${op}`,
        response: world.call(email, op, args, "addon"),
      };
    },
    cache,
    nowMs: () => world.clock.now,
    userEmail: email,
    execUrl: EXEC,
    entry,
    signature: () => "",
    hash: (text) =>
      createHash("sha256").update(text).digest("hex").slice(0, 16),
    gmail: createRecordingGmail().gmail,
  };
}

function create(title: string, html: string): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId: sales.id,
    title,
    html,
  });
}

function cardOf(reply: Reply): CardSpec {
  if (reply.kind === "push" || reply.kind === "update" || reply.kind === "root")
    return reply.card;
  throw new Error(`expected a card, got ${reply.kind}`);
}

function htmlOf(reply: Reply): string {
  if (reply.kind !== "insert")
    throw new Error(`expected insert, got ${reply.kind}`);
  return reply.html;
}

function widgets(card: CardSpec): Widget[] {
  return card.sections.flatMap((section) => section.widgets);
}

function texts(card: CardSpec): string[] {
  return widgets(card).flatMap((w) =>
    w.kind === "text" || w.kind === "item" ? [w.text] : [],
  );
}

function inputs(card: CardSpec) {
  return widgets(card).flatMap((w) => (w.kind === "input" ? [w] : []));
}

function formEvent(values: Record<string, string>): AddonEvent {
  return {
    commonEventObject: {
      formInputs: Object.fromEntries(
        Object.entries(values).map(([name, value]) => [
          name,
          { stringInputs: { value: [value] } },
        ]),
      ),
    },
  };
}

const EMPTY_RH = createHash("sha256")
  .update(JSON.stringify([[], [], [], []]))
  .digest("hex")
  .slice(0, 16);

const toBob: AddonEvent = { draftMetadata: { toRecipients: [BOB] } };

const applies = () =>
  readBuffer(world.cache).events.filter((event) => event.kind === "apply");

describe("home (spec 4.1 steps 1 and 2)", () => {
  it("calls sidebar.home on a cache miss and reads the User Cache after that", () => {
    create("Welcome", "<p>Hi</p>");
    expect(texts(homeFlow(ports()))).toContain("Sales");
    expect(homeFlow(ports()).title).toBeUndefined();
    expect(sent.map((s) => s.op)).toEqual(["sidebar.home"]);
    expect(readView(cache)?.templates).toHaveLength(1);
  });

  it("expires the cached view after 10 minutes", () => {
    homeFlow(ports());
    world.clock.now += 600_000;
    homeFlow(ports());
    expect(sent.map((s) => s.op)).toEqual(["sidebar.home", "sidebar.home"]);
  });

  it("shows the error state with the request ID and Retry, no Back, on the root card", () => {
    const down: Ports = {
      ...ports(),
      call: () => ({
        requestId: "REQ-9",
        response: {
          ok: false,
          error: {
            code: ErrorCode.NETWORK,
            message: "Server returned HTTP 401",
            retryable: true,
          },
          serverVersion: "",
          durationMs: 0,
        },
      }),
    };
    const card = homeFlow(down);
    expect(texts(card)).toEqual([
      "Something went wrong. Press Retry.",
      "Request ID REQ-9",
      "Details for your admin: Server returned HTTP 401",
    ]);
    expect(readView(cache)).toBeNull();
  });

  it("refresh drops the cached view and replaces the root card", () => {
    homeFlow(ports());
    create("Late", "<p>x</p>");
    const reply = refreshFlow(ports());
    expect(reply.kind).toBe("root");
    expect(texts(cardOf(reply))).toContain("Sales");
  });
});

describe("folder card flow", () => {
  it("pushes the folder card, updates it for paging, and reports a folder no longer visible", () => {
    create("Welcome", "<p>Hi</p>");
    expect(folderFlow(ports(), { folderId: sales.id, page: "1" }).kind).toBe(
      "push",
    );
    expect(
      folderFlow(ports(), { folderId: sales.id, page: "1", nav: "page" }).kind,
    ).toBe("update");
    const gone = folderFlow(ports(), { folderId: "GONE" });
    expect(texts(cardOf(gone))).toEqual([
      "This template was deleted or moved. Press Refresh to update the list.",
    ]);
    expect(readView(cache)).toBeNull();
  });

  it("opens a folder from the view the home card cached, with no second sidebar.home", () => {
    create("Welcome", "<p>Hi</p>");
    homeFlow(ports());
    folderFlow(ports(), { folderId: sales.id, page: "1" });
    expect(sent.map((s) => s.op)).toEqual(["sidebar.home"]);
  });

  it("pushes the error state when the view cannot load", () => {
    const reply = folderFlow(ports("eve@other.example"), {
      folderId: sales.id,
    });
    expect(texts(cardOf(reply))[0]).toBe(
      "Cannot identify your Migway account.",
    );
  });
});

describe("details card flow (spec 7.4 Flow B)", () => {
  it("opens with template.apply followUp, no getBody and no apply event; caches the body", () => {
    const item = create(
      "Quote",
      "<p>Hi {{recipient.first_name|there}},</p><p>Date: {{ask:Meeting date}}</p>",
    );
    const card = cardOf(previewFlow(ports(), toBob, { id: item.id }));
    expect(card.sections[0]?.header).toBe("Fields");
    expect(inputs(card).map((i) => [i.name, i.title])).toEqual([
      ["p-1", "Meeting date"],
    ]);
    expect(texts(card)).toEqual([FIELDS_LINE]);
    expect(sent).toEqual([
      { op: "sidebar.home", args: {} },
      {
        op: "template.apply",
        args: { id: item.id, knownVersion: 0, followUp: true },
      },
    ]);
    expect(applies()).toHaveLength(0);
    expect(readBody(cache, item.id)?.version).toBe(1);
  });

  it("shows an input only for fields without a value; the recipient first name gets the hint", () => {
    const item = create(
      "Quote",
      "<p>{{sender.name}} {{sender.phone}} {{recipient.first_name}}</p>",
    );
    const card = cardOf(previewFlow(ports(), toBob, { id: item.id }));
    expect(inputs(card).map((i) => [i.title, i.hint])).toEqual([
      ["Your phone", undefined],
      ["Recipient first name", FIRST_NAME_HINT],
    ]);
  });

  it("reports a template outside the view as removed", () => {
    expect(
      texts(cardOf(previewFlow(ports(), undefined, { id: "NOPE" }))),
    ).toEqual([
      "This template was deleted or moved. Press Refresh to update the list.",
    ]);
  });

  it("shows DENIED when access was lost after the view was cached", () => {
    const item = create("Quote", "<p>x</p>");
    homeFlow(ports());
    const grantId = world.services
      .store()
      .readIndex()
      .grants.find((g) => g.principalKey === ANA)?.id;
    world.ok(OWNER, "grant.remove", { grantId });
    const card = cardOf(previewFlow(ports(), undefined, { id: item.id }));
    expect(texts(card)).toEqual([
      "You don't have access to this template. Ask a folder manager.",
    ]);
    expect(readView(cache)).toBeNull();
  });
});

describe("row Insert (spec 7.4 Flow A)", () => {
  it("inserts in one click when nothing needs asking, with escaped values", () => {
    world.directory.users.set(ANA, { name: { fullName: "Ana <Lima> & Co" } });
    const item = create(
      "Welcome",
      "<p>Hi {{recipient.first_name|there}}, <b>{{sender.name}}</b> &amp; team</p>",
    );
    expect(htmlOf(insertFlow(ports(), undefined, { id: item.id }))).toBe(
      "<p>Hi there, <b>Ana &lt;Lima&gt; &amp; Co</b> &amp; team</p>",
    );
    expect(readBuffer(world.cache).events).toMatchObject([
      { kind: "apply", itemId: item.id, actor: ANA },
    ]);
  });

  it("sends the cached version, so the body travels only once", () => {
    const item = create("Welcome", "<p>Hi</p>");
    insertFlow(ports(), undefined, { id: item.id });
    expect(htmlOf(insertFlow(ports(), undefined, { id: item.id }))).toBe(
      "<p>Hi</p>",
    );
    expect(sent.map((s) => s.args)).toEqual([
      { id: item.id, knownVersion: 0, recipientEmailIfInternal: "" },
      { id: item.id, knownVersion: 1, recipientEmailIfInternal: "" },
    ]);
  });

  it("uses the internal recipient's first name and never sends an external address", () => {
    const item = create("Welcome", "<p>Hi {{recipient.first_name|there}}</p>");
    expect(htmlOf(insertFlow(ports(), toBob, { id: item.id }))).toBe(
      "<p>Hi Bob</p>",
    );
    const external: AddonEvent = {
      draftMetadata: { toRecipients: ["max@outside.example"] },
    };
    expect(htmlOf(insertFlow(ports(), external, { id: item.id }))).toBe(
      "<p>Hi there</p>",
    );
    expect(JSON.stringify(sent)).not.toContain("outside.example");
  });

  it("removes fields without a value with the gap rules, no card (AC 2)", () => {
    const item = world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "Load",
      subject: "Load {{ask:Load number}}",
      html: "<p>Hi {{ask:Driver name}}, load {{ask:Load number}} is ready. {{sender.phone}}</p>",
    });
    const done = insertFlow(ports(), undefined, { id: item.id });
    expect(done).toEqual({
      kind: "insert",
      html: "<p>Hi, load is ready.</p>",
      subject: "Load",
      recipients: {},
    });
    expect(JSON.stringify(done)).not.toMatch(/\{\{|Driver name|Load number/);
    expect(applies()).toHaveLength(1);
  });

  it("inserts a template with more than 20 fields in one click", () => {
    const asks = Array.from({ length: 20 }, (_, n) => `{{ask:Q${String(n)}}}`);
    const item = create("Big", `<p>${asks.join(" ")} {{sender.title}} x</p>`);
    expect(htmlOf(insertFlow(ports(), undefined, { id: item.id }))).toBe(
      "<p>x</p>",
    );
  });

  it("pushes DENIED and drops the view for a caller without use", () => {
    const item = create("Welcome", "<p>Hi</p>");
    homeFlow(ports("eve@example.com"));
    const card = cardOf(
      insertFlow(ports("eve@example.com"), undefined, { id: item.id }),
    );
    expect(texts(card)[0]).toContain("You don't have access");
    expect(readView(cache)).toBeNull();
  });

  it("reports a removed template when the server omits a body the cache lost", () => {
    const item = create("Welcome", "<p>Hi</p>");
    const stale: Ports = {
      ...ports(),
      call: (op, args) => {
        const call = ports().call(op, { ...(args as object), knownVersion: 1 });
        return call;
      },
    };
    const card = cardOf(insertFlow(stale, undefined, { id: item.id }));
    expect(texts(card)).toEqual([
      "This template was deleted or moved. Press Refresh to update the list.",
    ]);
  });
});

describe("search, favorites and recent (spec 4.4, wireframe 01)", () => {
  it("search calls the server op and shows its results; an empty query shows Home again", () => {
    create("Quote reply", "<p>x</p>");
    create("Welcome", "<p>x</p>");
    const results = cardOf(searchFlow(ports(), formEvent({ q: " quote " })));
    expect(texts(results)).toEqual(["Quote reply"]);
    expect(sent.map((s) => s.op)).toEqual(["sidebar.home", "search"]);
    expect(sent[1]?.args).toEqual({ query: "quote" });
    const home = searchFlow(ports(), formEvent({ q: "" }));
    expect(home.kind).toBe("update");
    expect(texts(cardOf(home))).toContain("Sales");
    expect(sent).toHaveLength(2);
  });

  it("search shows the error state when the server fails", () => {
    homeFlow(ports());
    const reply = searchFlow(ports("eve@other.example"), formEvent({ q: "x" }));
    expect(reply.kind).toBe("push");
    expect(cardOf(reply).footer).toBeUndefined();
    expect(sent.map((s) => s.op)).toEqual(["sidebar.home", "search"]);
  });

  it("home lists the caller's favorites", () => {
    const item = create("Welcome", "<p>x</p>");
    world.ok(ANA, "favorite.set", { id: item.id });
    const card = homeFlow(ports());
    expect(card.sections[1]).toMatchObject({
      header: "Favorites",
      widgets: [expect.objectContaining({ text: "Welcome" })],
    });
  });
});

describe("subject (spec 5.6, wireframe 02)", () => {
  function withSubject(subject: string, html: string): Item {
    return world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "Quote",
      subject,
      html,
    });
  }

  function insertOf(reply: Reply) {
    if (reply.kind !== "insert")
      throw new Error(`expected insert, got ${reply.kind}`);
    return reply;
  }

  it("one-click Insert sets body and rendered subject; values stay plain text", () => {
    world.directory.users.set(ANA, { name: { fullName: "Ana <Lima> & Co" } });
    const item = withSubject("From {{sender.name}}", "<p>Hi</p>");
    expect(insertOf(insertFlow(ports(), undefined, { id: item.id }))).toEqual({
      kind: "insert",
      html: "<p>Hi</p>",
      subject: "From Ana <Lima> & Co",
      recipients: {},
    });
    expect(readBody(cache, item.id)?.subject).toBe("From {{sender.name}}");
    expect(
      insertOf(insertFlow(ports(), undefined, { id: item.id })).subject,
    ).toBe("From Ana <Lima> & Co");
  });

  it("an empty subject sends no subject action", () => {
    const item = create("Plain", "<p>Hi</p>");
    expect(
      insertOf(insertFlow(ports(), undefined, { id: item.id })).subject,
    ).toBeNull();
  });

  it("a subject of fields without a value only sends no subject action; a template double space stays (AC 5)", () => {
    const item = withSubject("{{ask:Topic}}", "<p>Hi  team {{ask:Name}}</p>");
    expect(insertOf(insertFlow(ports(), undefined, { id: item.id }))).toEqual({
      kind: "insert",
      html: "<p>Hi  team</p>",
      subject: null,
      recipients: {},
    });
  });

  it("the details card shows the subject with [Label] on the switch", () => {
    const item = withSubject("Quote for {{ask:Product}}", "<p>Hi</p>");
    const card = cardOf(previewFlow(ports(), undefined, { id: item.id }));
    expect(widgets(card)).toContainEqual({
      kind: "item",
      text: "Replace the subject",
      bottomLabel: "Quote for [Product]",
      toggle: { name: "subj", selected: true },
    });
    expect(readBody(cache, item.id)?.subject).toBe(item.subject);
  });

  it("asks a label shared by subject and body once and fills both; the switch decides the subject", () => {
    const item = withSubject(
      "Quote for {{ask:Product}}",
      "<p>{{ask:product}} {{ask:Date}}</p>",
    );
    const card = cardOf(previewFlow(ports(), undefined, { id: item.id }));
    expect(inputs(card).map((i) => i.title)).toEqual(["Product", "Date"]);
    const params = card.footer?.primary.action.params ?? {};
    const submit = (form: Record<string, string>) =>
      insertOf(promptInsertFlow(ports(), formEvent(form), params));
    expect(submit({ "p-1": "Pen\nred", "p-2": "Mon", subj: "on" })).toEqual({
      kind: "insert",
      html: "<p>Pen<br>red Mon</p>",
      subject: "Quote for Pen red",
      recipients: {},
    });
    expect(submit({ "p-1": "Pen", "p-2": "Mon" }).subject).toBeNull();
    expect(submit({ subj: "on" })).toMatchObject({
      html: "<p></p>",
      subject: "Quote for",
    });
  });

  it("a blocked details Insert keeps the switch state", () => {
    const item = withSubject("{{ask:Product}}", "<p>x</p>");
    const params =
      cardOf(previewFlow(ports(), undefined, { id: item.id })).footer?.primary
        .action.params ?? {};
    const card = cardOf(
      promptInsertFlow(ports(), formEvent({ "p-1": "y".repeat(501) }), params),
    );
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({ toggle: { name: "subj", selected: false } }),
    );
  });
});

describe("draft subject rule (D24)", () => {
  const reply: AddonEvent = { draftMetadata: { subject: "Re: Price" } };
  const newDraft: AddonEvent = { draftMetadata: { subject: " " } };
  const replyForm = (form: Record<string, string>): AddonEvent => ({
    ...formEvent(form),
    ...reply,
  });

  function withSubject(subject: string, html: string): Item {
    return world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "Quote",
      subject,
      html,
    });
  }

  function subjectOf(result: Reply): string | null {
    if (result.kind !== "insert")
      throw new Error(`expected insert, got ${result.kind}`);
    return result.subject;
  }

  it("an empty draft subject: one-click Insert sets the subject", () => {
    const item = withSubject("Quote 7", "<p>Hi</p>");
    expect(subjectOf(insertFlow(ports(), newDraft, { id: item.id }))).toBe(
      "Quote 7",
    );
  });

  it("no readable draft subject: sets the subject, as in build 32a446c", () => {
    const item = withSubject("Quote 7", "<p>Hi</p>");
    for (const event of [
      undefined,
      { draftMetadata: {} },
      { draftMetadata: { subject: 5 } },
      { gmail: { subject: null } },
    ])
      expect(subjectOf(insertFlow(ports(), event, { id: item.id }))).toBe(
        "Quote 7",
      );
  });

  it("an empty draft subject: the details switch starts on; turned off it sends no subject", () => {
    const item = withSubject("Quote for {{ask:Product}}", "<p>Hi</p>");
    const card = cardOf(previewFlow(ports(), newDraft, { id: item.id }));
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({ toggle: { name: "subj", selected: true } }),
    );
    const params = card.footer?.primary.action.params ?? {};
    expect(
      subjectOf(
        promptInsertFlow(
          ports(),
          { ...formEvent({ "p-1": "Pen" }), ...newDraft },
          params,
        ),
      ),
    ).toBeNull();
  });

  it("a draft subject: one-click Insert keeps it and inserts the body", () => {
    const item = withSubject("Quote 7", "<p>Hi</p>");
    expect(insertFlow(ports(), reply, { id: item.id })).toEqual({
      kind: "insert",
      html: "<p>Hi</p>",
      subject: null,
      recipients: {},
    });
  });

  it("a draft subject: the details switch starts off; turning it on replaces the subject", () => {
    const item = withSubject(
      "Quote for {{ask:Product}}",
      "<p>{{ask:Product}}</p>",
    );
    const card = cardOf(previewFlow(ports(), reply, { id: item.id }));
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({ toggle: { name: "subj", selected: false } }),
    );
    const params = card.footer?.primary.action.params ?? {};
    expect(
      subjectOf(promptInsertFlow(ports(), replyForm({ "p-1": "Pen" }), params)),
    ).toBeNull();
    expect(
      subjectOf(
        promptInsertFlow(
          ports(),
          replyForm({ "p-1": "Pen", subj: "on" }),
          params,
        ),
      ),
    ).toBe("Quote for Pen");
  });

  it("a draft subject: a template changed under the details card keeps the switch off", () => {
    const item = withSubject(
      "Quote for {{ask:Product}}",
      "<p>{{ask:Product}}</p>",
    );
    const params =
      cardOf(previewFlow(ports(), reply, { id: item.id })).footer?.primary
        .action.params ?? {};
    world.ok(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "Quote",
      subject: "Quote for {{ask:Product}}",
      folderId: sales.id,
      tags: [],
      html: "<p>{{ask:Product}}!</p>",
    });
    const card = cardOf(
      promptInsertFlow(
        ports(),
        replyForm({ "p-1": "Pen", subj: "on" }),
        params,
      ),
    );
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({ toggle: { name: "subj", selected: false } }),
    );
  });
});

describe("details Insert (spec 7.4 Flow C)", () => {
  let item: Item;
  const values = JSON.stringify({ "sender.name": "Ana Lima" });

  beforeEach(() => {
    item = create(
      "Quote",
      "<p>{{sender.name}}: {{ask:Topic}} / {{ask:Notes}} / {{ask:topic}}</p>",
    );
    previewFlow(ports(), undefined, { id: item.id });
    sent = [];
  });

  const submit = (
    form: Record<string, string>,
    version = "1",
    extra: Record<string, string> = {},
  ) =>
    promptInsertFlow(ports(), formEvent(form), {
      id: item.id,
      version,
      values,
      rh: EMPTY_RH,
      ...extra,
    });

  it("inserts escaped values, newlines as <br>; one template.apply without followUp, one apply event", () => {
    expect(
      htmlOf(submit({ "p-1": 'Q3 <plan> & "x"', "p-2": "one\ntwo" })),
    ).toBe(
      "<p>Ana Lima: Q3 &lt;plan&gt; &amp; &quot;x&quot; / one<br>two / Q3 &lt;plan&gt; &amp; &quot;x&quot;</p>",
    );
    expect(sent).toEqual([
      {
        op: "template.apply",
        args: { id: item.id, knownVersion: 1, recipientEmailIfInternal: "" },
      },
    ]);
    expect(applies()).toHaveLength(1);
  });

  it("call log of one user path: open, a blocked Insert, a fixed Insert give one apply event (AC 8)", () => {
    const blocked = cardOf(submit({ "p-1": "x".repeat(501), "p-2": "ok" }));
    const params = blocked.footer?.primary.action.params ?? {};
    expect(params["counted"]).toBe("1");
    expect(
      htmlOf(promptInsertFlow(ports(), formEvent({ "p-1": "a" }), params)),
    ).toBe("<p>Ana Lima: a / / a</p>");
    expect(sent.map((s) => s.args)).toEqual([
      { id: item.id, knownVersion: 1, recipientEmailIfInternal: "" },
      { id: item.id, knownVersion: 1, followUp: true },
    ]);
    expect(sent.map((s) => s.op)).not.toContain("template.getBody");
    expect(applies()).toHaveLength(1);
  });

  it("blocks the insert with DENIED when the grant was removed while the card was open", () => {
    const grantId = world.services
      .store()
      .readIndex()
      .grants.find((g) => g.principalKey === ANA)?.id;
    world.ok(OWNER, "grant.remove", { grantId });
    const reply = submit({ "p-1": "a", "p-2": "b" });
    expect(reply.kind).toBe("push");
    expect(texts(cardOf(reply))[0]).toContain("You don't have access");
  });

  it("a blank field is removed with the gap rules; a typed value wins", () => {
    expect(htmlOf(submit({ "p-1": "Pricing", "p-2": "  " }))).toBe(
      "<p>Ana Lima: Pricing / / Pricing</p>",
    );
    expect(htmlOf(submit({}))).toBe("<p>Ana Lima: / /</p>");
  });

  it("blocks values over 500 characters: shorten line first, those fields first, counted=1", () => {
    const reply = submit({ "p-1": "ok", "p-2": "x".repeat(501) });
    expect(reply.kind).toBe("update");
    const card = cardOf(reply);
    expect(texts(card)[0]).toBe("Shorten to 500 characters: Notes");
    expect(inputs(card).map((i) => i.name)).toEqual(["p-2", "p-1"]);
    expect(card.footer?.primary.action.params?.["counted"]).toBe("1");
  });

  it("re-renders when the template changed since the card opened", () => {
    world.ok(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "Quote",
      html: "<p>{{ask:Topic}}</p>",
    });
    cache.removeAll([`body:${item.id}`]);
    const card = cardOf(submit({ "p-1": "a", "p-2": "b" }));
    expect(texts(card)[0]).toBe(
      "The template changed. Check the fields and press Insert again.",
    );
    expect(sent.map((s) => s.op)).toEqual(["template.apply"]);
    expect(card.footer?.primary.action.params).toMatchObject({
      version: "2",
      counted: "1",
    });
  });

  it("loads the body when the cache lost it; broken values become an implicit field", () => {
    cache.removeAll([`body:${item.id}`]);
    const reply = promptInsertFlow(
      ports(),
      formEvent({ "p-1": "N", "p-2": "a", "p-3": "b" }),
      { id: item.id, version: "1", values: "{broken", rh: EMPTY_RH },
    );
    expect(htmlOf(reply)).toBe("<p>N: a / b / a</p>");
    expect(sent).toMatchObject([
      {
        op: "template.apply",
        args: { knownVersion: 0, recipientEmailIfInternal: "" },
      },
    ]);
  });

  it("a blank implicit field takes the value the Insert call resolves", () => {
    const named = create("Hello", "<p>Hi {{recipient.first_name}}</p>");
    refreshFlow(ports());
    const card = cardOf(previewFlow(ports(), toBob, { id: named.id }));
    expect(inputs(card).map((i) => i.title)).toEqual(["Recipient first name"]);
    const params = card.footer?.primary.action.params ?? {};
    const at = (form: Record<string, string>) =>
      htmlOf(
        promptInsertFlow(ports(), { ...formEvent(form), ...toBob }, params),
      );
    expect(at({})).toBe("<p>Hi Bob</p>");
    expect(at({ "p-1": "Robert" })).toBe("<p>Hi Robert</p>");
  });

  it("reports a removed template when the server omits a body the cache lost", () => {
    cache.removeAll([`body:${item.id}`]);
    const stale: Ports = {
      ...ports(),
      call: (op, args) =>
        ports().call(op, { ...(args as object), knownVersion: 1 }),
    };
    const reply = promptInsertFlow(stale, formEvent({}), {
      id: item.id,
      version: "1",
      values,
    });
    expect(texts(cardOf(reply))).toEqual([
      "This template was deleted or moved. Press Refresh to update the list.",
    ]);
  });

  it("shows the error state when the body cannot load", () => {
    cache.removeAll([`body:${item.id}`]);
    const card = cardOf(
      promptInsertFlow(ports("eve@example.com"), formEvent({}), {
        id: item.id,
        version: "1",
        values: "[]",
      }),
    );
    expect(texts(card)[0]).toContain("You don't have access");
  });
});

describe("one result on every insert path (review follow-up 1)", () => {
  it("row Insert, first details Insert and a re-rendered details Insert give the same body and subject", () => {
    const item = world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "Load",
      subject: "Load {{ask:N}} for {{recipient.first_name}}",
      html: "<p>Hi {{recipient.first_name}}, {{ask:N}} 7 {{sender.name}}</p>",
    });
    const at = (form: Record<string, string>) => ({
      ...formEvent(form),
      ...toBob,
    });
    const footer = (reply: Reply) =>
      cardOf(reply).footer?.primary.action.params ?? {};
    const row = insertFlow(ports(), toBob, { id: item.id });
    const opened = previewFlow(ports(), toBob, { id: item.id });
    const first = promptInsertFlow(ports(), at({ subj: "on" }), footer(opened));
    const field =
      inputs(cardOf(opened)).find((i) => i.title === "N")?.name ?? "";
    const blocked = promptInsertFlow(
      ports(),
      at({ [field]: "x".repeat(501), subj: "on" }),
      footer(opened),
    );
    expect(footer(blocked)["counted"]).toBe("1");
    const again = promptInsertFlow(
      ports(),
      at({ subj: "on" }),
      footer(blocked),
    );
    const expected = {
      kind: "insert",
      html: "<p>Hi Bob, 7 Ana Lima</p>",
      subject: "Load for Bob",
      recipients: {},
    };
    expect([row, first, again]).toEqual([expected, expected, expected]);
    // The recipient address reaches the server only as recipientEmailIfInternal.
    const args = sent.map((s) => ({
      ...(s.args as object),
      recipientEmailIfInternal: null,
    }));
    expect(JSON.stringify(args)).not.toContain(BOB);
  });
});

describe("links", () => {
  it("opens the library or the editor and drops the cached view", () => {
    homeFlow(ports());
    expect(openLinkFlow(ports(), {})).toEqual({ kind: "open", url: EXEC });
    expect(openLinkFlow(ports(), { id: "A B" })).toEqual({
      kind: "open",
      url: `${EXEC}?view=editor&id=A%20B`,
    });
    expect(readView(cache)).toBeNull();
  });
});

describe("date fields (spec 5.9)", () => {
  /** 12 Nov 2026 and 5 Jan 2027 at 00:00 UTC (examples 1 and 3). */
  const NOV_12 = 1794441600000;
  const JAN_5 = 1799107200000;

  const picked = (inputs: Record<string, unknown>): AddonEvent => ({
    commonEventObject: {
      formInputs: Object.fromEntries(
        Object.entries(inputs).map(([name, ms]) => [
          name,
          { dateInput: { msSinceEpoch: ms } },
        ]),
      ),
    },
  });

  function open(item: Item) {
    const card = cardOf(previewFlow(ports(), undefined, { id: item.id }));
    return { card, params: card.footer?.primary.action.params ?? {} };
  }

  const dates = (card: CardSpec) =>
    widgets(card).flatMap((w) => (w.kind === "date" ? [w] : []));

  it("example 1: a picker in field order, no hint, no start date; the pick inserts as MM/DD/YYYY", () => {
    const item = create(
      "Pickup",
      "<p>{{ask:Driver}} pickup on {{date:Pickup date}}.</p>",
    );
    const { card, params } = open(item);
    expect(
      widgets(card).flatMap((w) =>
        w.kind === "input" || w.kind === "date" ? [`${w.kind} ${w.name}`] : [],
      ),
    ).toEqual(["input p-1", "date p-2"]);
    expect(dates(card)).toEqual([
      { kind: "date", name: "p-2", title: "Pickup date", valueMs: null },
    ]);
    expect(
      htmlOf(promptInsertFlow(ports(), picked({ "p-2": NOV_12 }), params)),
    ).toBe("<p>pickup on 11/12/2026.</p>");
  });

  it.each([
    ["a number", NOV_12, "<p>Pickup on 11/12/2026.</p>"],
    ["a numeric string", String(NOV_12), "<p>Pickup on 11/12/2026.</p>"],
    ["an array of a number", [NOV_12], "<p>Pickup on 11/12/2026.</p>"],
    ["an array of a string", [String(NOV_12)], "<p>Pickup on 11/12/2026.</p>"],
    ["absent", undefined, "<p>Pickup on.</p>"],
    ["not a number", "soon", "<p>Pickup on.</p>"],
    ["an empty array", [], "<p>Pickup on.</p>"],
  ])("reads msSinceEpoch as %s", (_, ms, html) => {
    const { params } = open(
      create("P", "<p>Pickup on {{date:Pickup date}}.</p>"),
    );
    expect(
      htmlOf(promptInsertFlow(ports(), picked({ "p-1": ms }), params)),
    ).toBe(html);
  });

  it("an untouched picker that sends no input: the field is removed", () => {
    const { params } = open(
      create("P", "<p>Pickup on {{date:Pickup date}}.</p>"),
    );
    expect(htmlOf(promptInsertFlow(ports(), formEvent({}), params))).toBe(
      "<p>Pickup on.</p>",
    );
  });

  it("example 2: row Insert removes the date with the gap rules; the row counts it as a field", () => {
    const item = create("P", "<p>Pickup on {{date:Pickup date}}.</p>");
    create("Q", "<p>{{ask:Driver}} {{date:Pickup}}</p>");
    expect(htmlOf(insertFlow(ports(), undefined, { id: item.id }))).toBe(
      "<p>Pickup on.</p>",
    );
    const folder = JSON.stringify(
      cardOf(folderFlow(ports(), { folderId: sales.id, page: "1" })),
    );
    expect(folder).toContain("1 field to fill");
    expect(folder).toContain("2 fields to fill");
  });

  it("example 3: the subject gets the picked date as plain text", () => {
    const item = world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "Pickup",
      subject: "Load ready {{date:Pickup date}}",
      html: "<p>Hi</p>",
    });
    const { card, params } = open(item);
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({ bottomLabel: "Load ready [Pickup date]" }),
    );
    const event: AddonEvent = {
      commonEventObject: {
        formInputs: {
          "p-1": { dateInput: { msSinceEpoch: JAN_5 } },
          subj: { stringInputs: { value: ["on"] } },
        },
      },
    };
    expect(promptInsertFlow(ports(), event, params)).toMatchObject({
      kind: "insert",
      subject: "Load ready 01/05/2027",
    });
  });

  it("example 4: one label twice is one picker and one value", () => {
    const { card, params } = open(
      create("P", "<p>{{date:Pickup}} and {{date: pickup }}</p>"),
    );
    expect(dates(card)).toHaveLength(1);
    const march9 = picked({ "p-1": Date.UTC(2027, 2, 9) });
    expect(htmlOf(promptInsertFlow(ports(), march9, params))).toBe(
      "<p>03/09/2027 and 03/09/2027</p>",
    );
  });

  it("example 8: an escaped date token inserts as text, no picker", () => {
    const item = create("P", "<p>\\{{date:Pickup}}</p>");
    expect(dates(open(item).card)).toEqual([]);
    expect(htmlOf(insertFlow(ports(), undefined, { id: item.id }))).toBe(
      "<p>{{date:Pickup}}</p>",
    );
  });

  it("a blocked Insert sets the picked date back; the 500-character check skips the date", () => {
    const { params } = open(
      create("P", "<p>{{ask:Notes}} {{date:Pickup}}</p>"),
    );
    const event: AddonEvent = {
      commonEventObject: {
        formInputs: {
          "p-1": { stringInputs: { value: ["x".repeat(501)] } },
          "p-2": { dateInput: { msSinceEpoch: NOV_12 } },
        },
      },
    };
    const card = cardOf(promptInsertFlow(ports(), event, params));
    expect(texts(card)[0]).toBe("Shorten to 500 characters: Notes");
    expect(dates(card)).toEqual([
      { kind: "date", name: "p-2", title: "Pickup", valueMs: NOV_12 },
    ]);
  });

  it("text-box fallback: a typed date inserts; a wrong one is refused and the picker comes back empty", () => {
    const { params } = open(create("P", "<p>On {{date:Pickup date}}</p>"));
    const typed = (text: string) =>
      promptInsertFlow(ports(), formEvent({ "p-1": text }), params);
    expect(htmlOf(typed("2/29/2028"))).toBe("<p>On 02/29/2028</p>");
    const card = cardOf(typed("02/30/2028"));
    expect(texts(card)[0]).toBe("Enter a date as MM/DD/YYYY: Pickup date");
    expect(dates(card)).toEqual([
      { kind: "date", name: "p-1", title: "Pickup date", valueMs: null },
    ]);
    expect(card.footer?.primary.action.params?.["counted"]).toBe("1");
  });
});

describe("choice fields (spec 5.10)", () => {
  const STATUS = "<p>Status: {{choice:Status|Approved|Rejected|On hold}}</p>";

  const chosen = (inputs: Record<string, unknown>): AddonEvent => ({
    commonEventObject: {
      formInputs: Object.fromEntries(
        Object.entries(inputs).map(([name, value]) => [
          name,
          { stringInputs: { value: value as string[] } },
        ]),
      ),
    },
  });

  function open(item: Item) {
    const card = cardOf(previewFlow(ports(), undefined, { id: item.id }));
    return { card, params: card.footer?.primary.action.params ?? {} };
  }

  const selects = (card: CardSpec) =>
    widgets(card).flatMap((w) => (w.kind === "select" ? [w] : []));

  it("a dropdown in field order: Choose... (0) selected, then the options as positions", () => {
    const { card } = open(
      create("S", "<p>{{ask:Driver}} {{choice:Status|ready|late}}</p>"),
    );
    expect(
      widgets(card).flatMap((w) =>
        w.kind === "input" || w.kind === "select"
          ? [`${w.kind} ${w.name}`]
          : [],
      ),
    ).toEqual(["input p-1", "select p-2"]);
    expect(selects(card)).toEqual([
      {
        kind: "select",
        name: "p-2",
        title: "Status",
        items: [
          { text: "Choose...", value: "0" },
          { text: "ready", value: "1" },
          { text: "late", value: "2" },
        ],
        selected: "0",
      },
    ]);
  });

  it.each([
    ["a string in an array", ["2"], "<p>Status: Rejected</p>"],
    ["a bare string", "2", "<p>Status: Rejected</p>"],
    ["a number", 2, "<p>Status: Rejected</p>"],
    ["absent", undefined, "<p>Status:</p>"],
    ["Choose...", ["0"], "<p>Status:</p>"],
  ])("example 1: reads the value as %s", (_, value, html) => {
    const { params } = open(create("S", STATUS));
    const event =
      value === undefined ? formEvent({}) : chosen({ "p-1": value });
    expect(htmlOf(promptInsertFlow(ports(), event, params))).toBe(html);
  });

  it("example 9: a forged value inserts nothing; the dropdown comes back at Choose...", () => {
    const { params } = open(create("S", STATUS));
    for (const forged of ["7", "-1", "1.5", "Rejected"]) {
      const card = cardOf(
        promptInsertFlow(ports(), chosen({ "p-1": [forged] }), params),
      );
      expect(texts(card)[0]).toBe("Choose again from the list: Status.");
      expect(selects(card)[0]?.selected).toBe("0");
      expect(card.footer?.primary.action.params?.["counted"]).toBe("1");
    }
  });

  it("example 3: the subject gets the option as plain text; the body escapes it", () => {
    const item = world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "S",
      subject: "Load {{choice:Status|ready & go|late}}",
      html: '<p>{{choice:status|ready & go|late}} "x"</p>',
    });
    const { params } = open(item);
    const event: AddonEvent = {
      commonEventObject: {
        formInputs: {
          "p-1": { stringInputs: { value: ["1"] } },
          subj: { stringInputs: { value: ["on"] } },
        },
      },
    };
    expect(promptInsertFlow(ports(), event, params)).toMatchObject({
      kind: "insert",
      html: '<p>ready &amp; go "x"</p>',
      subject: "Load ready & go",
    });
  });

  it("example 2 and the row hint: row Insert leaves the choice out; the row counts it", () => {
    const item = create(
      "S",
      "<p>Load is {{choice:Status|ready|late}} today.</p>",
    );
    expect(htmlOf(insertFlow(ports(), undefined, { id: item.id }))).toBe(
      "<p>Load is today.</p>",
    );
    expect(
      JSON.stringify(
        cardOf(folderFlow(ports(), { folderId: sales.id, page: "1" })),
      ),
    ).toContain("1 field to fill");
  });

  it("a blocked Insert keeps the chosen option selected", () => {
    const { params } = open(
      create("S", "<p>{{ask:Notes}} {{choice:Size|S|M|L}}</p>"),
    );
    const card = cardOf(
      promptInsertFlow(
        ports(),
        chosen({ "p-1": ["x".repeat(501)], "p-2": ["3"] }),
        params,
      ),
    );
    expect(texts(card)[0]).toBe("Shorten to 500 characters: Notes");
    expect(selects(card)[0]?.selected).toBe("3");
  });

  it("text-box fallback: the typed option as written inserts; other text is refused", () => {
    const { params } = open(create("S", STATUS));
    const typed = (text: string) =>
      promptInsertFlow(ports(), formEvent({ "p-1-text": text }), params);
    expect(htmlOf(typed(" On hold "))).toBe("<p>Status: On hold</p>");
    expect(htmlOf(typed(""))).toBe("<p>Status:</p>");
    expect(texts(cardOf(typed("on hold")))[0]).toBe(
      "Choose again from the list: Status.",
    );
    expect(texts(cardOf(typed("2")))[0]).toBe(
      "Choose again from the list: Status.",
    );
  });

  it("options changed between the card and Insert: the template changed line, nothing inserted", () => {
    const item = create("S", STATUS);
    const { params } = open(item);
    world.ok(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "S",
      html: "<p>Status: {{choice:Status|Approved|Rejected}}</p>",
    });
    const card = cardOf(
      promptInsertFlow(ports(), chosen({ "p-1": ["3"] }), params),
    );
    expect(texts(card)[0]).toBe(
      "The template changed. Check the fields and press Insert again.",
    );
    expect(selects(card)[0]?.items).toHaveLength(3);
  });

  it.each([
    ["<", "{{choice:T|a<b|c}}"],
    [">", "{{choice:T|a>b|c}}"],
    ["a script tag", "{{choice:T|<script>x</script>|c}}"],
    ["101 characters", `{{choice:T|${"a".repeat(101)}|c}}`],
    ["a duplicate after trimming", "{{choice:T| c |c}}"],
    ["1 option", "{{choice:T|c}}"],
    [
      "21 options",
      `{{choice:T|${Array.from({ length: 21 }, (_, n) => `o${String(n)}`).join("|")}}}`,
    ],
  ])("save refuses an option with %s", (_, token) => {
    const response = world.call(OWNER, "template.create", {
      folderId: sales.id,
      title: "Bad",
      html: `<p>${token.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
  });

  it("& and quotes in options are escaped like any value; 20 choice fields stay under 100 widgets", () => {
    const tokens = Array.from(
      { length: 20 },
      (_, n) => `{{choice:C${String(n)}|a & "b"|c}}`,
    );
    const { card, params } = open(create("S", `<p>${tokens.join(" ")}</p>`));
    expect(selects(card)).toHaveLength(20);
    expect(widgets(card).length).toBeLessThan(100);
    expect(
      htmlOf(promptInsertFlow(ports(), chosen({ "p-1": ["1"] }), params)),
    ).toBe("<p>a &amp; &quot;b&quot;</p>");
  });
});

describe("required fields (spec 5.11): a label ending with *", () => {
  it("row Insert opens the details card; a blank required box blocks the card's Insert, a filled one inserts", () => {
    const item = create("Load", "<p>{{ask:Load*}} {{ask:Note}}</p>");
    const opened = cardOf(insertFlow(ports(), undefined, { id: item.id }));
    expect(texts(opened)).toContain(
      "Fill in the fields marked *. Leave the others blank to type them in the draft.",
    );
    const params = opened.footer?.primary.action.params ?? {};
    const blocked = promptInsertFlow(
      ports(),
      formEvent({ "p-1": " ", "p-2": "x" }),
      params,
    );
    expect(texts(cardOf(blocked))).toContain(
      "Fill in the required fields: Load*",
    );
    expect(
      htmlOf(promptInsertFlow(ports(), formEvent({ "p-1": "L7" }), params)),
    ).toBe("<p>L7</p>");
    expect(applies()).toHaveLength(1);
  });
});
