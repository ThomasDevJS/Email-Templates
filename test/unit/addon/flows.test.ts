import { beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import { ErrorCode } from "../../../src/shared/errors/codes";
import type { CardSpec, Reply, Widget } from "../../../src/addon/cards/spec";
import type { ServerCall } from "../../../src/addon/client/serverClient";
import type { AddonEvent } from "../../../src/addon/event";
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
import { readBuffer } from "../../../src/server/audit/buffer";
import { FakeCache } from "../../fakes/cache";
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
function ports(email = ANA): Ports {
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

const toBob: AddonEvent = { draftMetadata: { toRecipients: [BOB] } };

describe("home (spec 4.1 steps 1 and 2)", () => {
  it("calls sidebar.home on a cache miss and reads the User Cache after that", () => {
    create("Welcome", "<p>Hi</p>");
    expect(texts(homeFlow(ports()))).toContain("Sales (1)");
    expect(homeFlow(ports()).title).toBe("Migway Templates");
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
      "Something went wrong.",
      "Request ID REQ-9",
      "Network: Server returned HTTP 401",
    ]);
    expect(readView(cache)).toBeNull();
  });

  it("refresh drops the cached view and replaces the root card", () => {
    homeFlow(ports());
    create("Late", "<p>x</p>");
    const reply = refreshFlow(ports());
    expect(reply.kind).toBe("root");
    expect(texts(cardOf(reply))).toContain("Sales (1)");
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
      "This template was removed or moved.",
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

describe("preview flow", () => {
  it("shows plain text with [Label] placeholders and caches the body", () => {
    const item = create(
      "Quote",
      "<p>Hi {{recipient.first_name|there}},</p><p>Date: {{ask:Meeting date}}</p>",
    );
    const card = cardOf(previewFlow(ports(), { id: item.id }));
    expect(texts(card)).toEqual([
      "Hi [Recipient first name],\nDate: [Meeting date]",
      "Fields to fill: Meeting date",
    ]);
    expect(readBody(cache, item.id)?.version).toBe(1);
  });

  it("reports a template outside the view as removed", () => {
    expect(texts(cardOf(previewFlow(ports(), { id: "NOPE" })))).toEqual([
      "This template was removed or moved.",
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
    const card = cardOf(previewFlow(ports(), { id: item.id }));
    expect(texts(card)).toEqual([
      "You don't have access to this template. Ask a folder manager.",
    ]);
    expect(readView(cache)).toBeNull();
  });
});

describe("insert flow (spec 4.1 steps 3 to 5)", () => {
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

  it("pushes the prompt card for prompts and unresolved values without a fallback", () => {
    const item = create(
      "Quote",
      "<p>{{ask:Meeting date}} {{sender.phone}} {{ask:meeting  DATE}}</p>",
    );
    const card = cardOf(insertFlow(ports(), undefined, { id: item.id }));
    expect(inputs(card).map((i) => [i.name, i.title])).toEqual([
      ["p-1", "Meeting date *"],
      ["p-2", "Your phone *"],
    ]);
  });

  it("refuses a template that needs more than 20 fields", () => {
    const asks = Array.from({ length: 20 }, (_, n) => `{{ask:Q${String(n)}}}`);
    const item = create("Big", `<p>${asks.join(" ")} {{sender.title}}</p>`);
    const card = cardOf(insertFlow(ports(), undefined, { id: item.id }));
    expect(texts(card)[0]).toContain("needs 21 fields");
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
    expect(texts(card)).toEqual(["This template was removed or moved."]);
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
    expect(texts(cardOf(home))).toContain("Sales (2)");
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

  it("Insert body only leaves the subject out and does not ask its prompts", () => {
    const item = withSubject("Quote for {{ask:Product}}", "<p>Hi</p>");
    expect(
      insertOf(
        insertFlow(ports(), undefined, { id: item.id, subject: "skip" }),
      ),
    ).toEqual({ kind: "insert", html: "<p>Hi</p>", subject: null });
  });

  it("the preview card shows the subject with [Label] and Insert body only", () => {
    const item = withSubject("Quote for {{ask:Product}}", "<p>Hi</p>");
    const card = cardOf(previewFlow(ports(), { id: item.id }));
    expect(texts(card)).toContain("Quote for [Product]");
    expect(readBody(cache, item.id)?.subject).toBe(item.subject);
  });

  it("asks a label shared by subject and body once and fills both; the switch decides the subject", () => {
    const item = withSubject(
      "Quote for {{ask:Product}}",
      "<p>{{ask:product}} {{ask:Date}}</p>",
    );
    const card = cardOf(insertFlow(ports(), undefined, { id: item.id }));
    expect(inputs(card).map((i) => i.title)).toEqual(["Product *", "Date *"]);
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({
        text: "Replace the subject",
        toggle: { name: "subj", selected: true },
      }),
    );
    const params = card.footer?.primary.action.params ?? {};
    const submit = (form: Record<string, string>) =>
      insertOf(promptInsertFlow(ports(), formEvent(form), params));
    expect(submit({ "p-1": "Pen\nred", "p-2": "Mon", subj: "on" })).toEqual({
      kind: "insert",
      html: "<p>Pen<br>red Mon</p>",
      subject: "Quote for Pen red",
    });
    expect(submit({ "p-1": "Pen", "p-2": "Mon" }).subject).toBeNull();
  });

  it("a blocked prompt card Insert keeps the switch state", () => {
    const item = withSubject("{{ask:Product}}", "<p>x</p>");
    const params =
      cardOf(insertFlow(ports(), undefined, { id: item.id })).footer?.primary
        .action.params ?? {};
    const card = cardOf(promptInsertFlow(ports(), formEvent({}), params));
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({ toggle: { name: "subj", selected: false } }),
    );
  });
});

describe("prompt card Insert (wireframe 02)", () => {
  let item: Item;
  const values = JSON.stringify({ "sender.name": "Ana Lima" });

  beforeEach(() => {
    item = create(
      "Quote",
      "<p>{{sender.name}}: {{ask:Topic}} / {{ask:Notes}} / {{ask:topic}}</p>",
    );
    insertFlow(ports(), undefined, { id: item.id });
    sent = [];
  });

  const submit = (form: Record<string, string>, version = "1") =>
    promptInsertFlow(ports(), formEvent(form), {
      id: item.id,
      title: "Quote",
      version,
      values,
    });

  it("inserts escaped values, newlines as <br>; re-checks use without the body or a second event", () => {
    expect(
      htmlOf(submit({ "p-1": 'Q3 <plan> & "x"', "p-2": "one\ntwo" })),
    ).toBe(
      "<p>Ana Lima: Q3 &lt;plan&gt; &amp; &quot;x&quot; / one<br>two / Q3 &lt;plan&gt; &amp; &quot;x&quot;</p>",
    );
    expect(sent).toEqual([
      {
        op: "template.apply",
        args: {
          id: item.id,
          knownVersion: 1,
          followUp: true,
        },
      },
    ]);
    const applies = readBuffer(world.cache).events.filter(
      (event) => event.kind === "apply",
    );
    expect(applies).toHaveLength(1);
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

  it("blocks a blank field: no insert, card updated with the error line and the field first", () => {
    const reply = submit({ "p-1": "Pricing", "p-2": "  " });
    expect(reply.kind).toBe("update");
    const card = cardOf(reply);
    expect(inputs(card).map((i) => [i.name, i.value])).toEqual([
      ["p-2", "  "],
      ["p-1", "Pricing"],
    ]);
    expect(texts(card).at(-1)).toBe("(!) Fill 1 field: Notes");
  });

  it("blocks values over 500 characters", () => {
    const card = cardOf(submit({ "p-1": "x".repeat(501), "p-2": "ok" }));
    expect(texts(card).at(-1)).toBe("(!) Shorten to 500 characters: Topic");
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
    expect(texts(card).at(-1)).toBe(
      "(!) The template changed. Check the fields and insert again.",
    );
    expect(sent.map((s) => s.op)).toEqual(["template.apply"]);
    expect(card.footer?.primary.action.params?.["version"]).toBe("2");
  });

  it("loads the body when the cache lost it; broken values become an implicit prompt", () => {
    cache.removeAll([`body:${item.id}`]);
    const reply = promptInsertFlow(
      ports(),
      formEvent({ "p-1": "N", "p-2": "a", "p-3": "b" }),
      { id: item.id, version: "1", values: "{broken" },
    );
    expect(htmlOf(reply)).toBe("<p>N: a / b / a</p>");
    expect(sent).toMatchObject([
      { op: "template.apply", args: { knownVersion: 0, followUp: true } },
    ]);
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
      "This template was removed or moved.",
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
