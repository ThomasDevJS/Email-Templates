import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import type {
  ButtonSpec,
  CardSpec,
  Reply,
  Widget,
} from "../../../src/addon/cards/spec";
import type { ServerCall } from "../../../src/addon/client/serverClient";
import type { AddonEvent, Entry } from "../../../src/addon/event";
import {
  folderFlow,
  insertFlow,
  previewFlow,
  promptInsertFlow,
  type Ports,
} from "../../../src/addon/flows";
import { FakeCache } from "../../fakes/cache";
import { OWNER, setupWorld, type World } from "../../fakes/world";

/** Template recipients in the add-on (spec 5.7, wireframe 02): Review rows, cards, `rh` check, actions. */
const ANA = "ana@example.com";
const TO = "payroll@example.com";
const CC = "safety@example.com";
const BCC = "records@partner.com";
const CHANGED =
  "The recipients of this template changed. Check them and press Insert again.";
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
});

function ports(entry: Entry = "compose"): Ports {
  return {
    call: (op, args): ServerCall => {
      sent.push({ op, args });
      return {
        requestId: `req-${op}`,
        response: world.call(ANA, op, args, "addon"),
      };
    },
    cache,
    nowMs: () => world.clock.now,
    userEmail: ANA,
    execUrl: "https://script.google.com/macros/s/TEST/exec",
    entry,
    hash: (text) =>
      createHash("sha256").update(text).digest("hex").slice(0, 16),
  };
}

function create(html = "<p>Hi</p>", subject = ""): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId: sales.id,
    title: "Driver leaving",
    subject,
    html,
    to: [TO],
    cc: [CC],
    bcc: [BCC],
  });
}

function setLists(item: Item, lists: Record<string, string[]>): void {
  world.ok(OWNER, "template.update", {
    id: item.id,
    baseVersion: item.currentVersion,
    title: item.title,
    html: "<p>Hi</p>",
    ...lists,
  });
}

function cardOf(reply: Reply): CardSpec {
  if (reply.kind === "push" || reply.kind === "update") return reply.card;
  throw new Error(`expected a card, got ${reply.kind}`);
}

function insertOf(reply: Reply) {
  if (reply.kind !== "insert")
    throw new Error(`expected insert, got ${reply.kind}`);
  return reply;
}

const widgets = (card: CardSpec): Widget[] =>
  card.sections.flatMap((s) => s.widgets);
const texts = (card: CardSpec) =>
  widgets(card).flatMap((w) =>
    w.kind === "text" || w.kind === "item" ? [w.text] : [],
  );
const buttons = (card: CardSpec): ButtonSpec[] =>
  widgets(card).flatMap((w) =>
    w.kind === "buttons"
      ? [...w.buttons]
      : w.kind === "item" && w.button
        ? [w.button]
        : [],
  );
const named = (card: CardSpec, text: string) => {
  const found = buttons(card).find((b) => b.text === text);
  if (found === undefined) throw new Error(`no button ${text}`);
  return found.action.params ?? {};
};

function folderCardOf(entry: Entry = "compose"): CardSpec {
  return cardOf(folderFlow(ports(entry), { folderId: sales.id, page: "1" }));
}

const newDraft: AddonEvent = { draftMetadata: { toRecipients: [] } };
const reply: AddonEvent = {
  draftMetadata: {
    toRecipients: ["Driver@Example.org"],
    ccRecipients: ["boss@example.com"],
    subject: "Re: leaving",
  },
};

describe("list rows", () => {
  it("a template with recipients shows the hint and Review (preview card); others keep Insert", () => {
    const item = create();
    world.ok(OWNER, "template.create", {
      folderId: sales.id,
      title: "Plain",
      html: "<p>x</p>",
    });
    const home = folderCardOf();
    const rows = widgets(home).flatMap((w) =>
      w.kind === "item" && w.button ? [w] : [],
    );
    const row = rows.find((w) => w.text === item.title);
    expect(row).toMatchObject({
      bottomLabel: "Adds To 1, Cc 1, Bcc 1",
      button: {
        text: "Review",
        alt: "Review Driver leaving",
        action: { fn: "onPreview", params: { id: item.id } },
      },
    });
    expect(rows.find((w) => w.text === "Plain")).toMatchObject({
      button: { text: "Insert" },
    });
  });

  it("Review of a template with prompts goes through Insert to the prompt card", () => {
    const item = create("<p>{{ask:Driver}}</p>");
    const row = widgets(folderCardOf()).find(
      (w) => w.kind === "item" && w.text === item.title,
    );
    expect(row).toMatchObject({
      button: { text: "Review", action: { fn: "onInsert" } },
    });
    const card = cardOf(insertFlow(ports(), newDraft, { id: item.id }));
    expect(widgets(card)).toContainEqual({
      kind: "item",
      text: "Add recipients",
      bottomLabel: `To ${TO}, Cc ${CC}, Bcc ${BCC} (outside example.com)`,
      toggle: { name: "rcpt", selected: true },
    });
  });

  it("side panel rows show the hint and no button", () => {
    create();
    const row = widgets(folderCardOf("inbox")).find(
      (w) => w.kind === "item" && w.text === "Driver leaving",
    );
    expect(row).toMatchObject({ bottomLabel: "Adds To 1, Cc 1, Bcc 1" });
    expect(row).not.toHaveProperty("button");
  });
});

describe("preview card and Insert", () => {
  it("lists every address with markers, then inserts body, subject and one action per field", () => {
    const item = create("<p>Hi</p>", "Leaving");
    const card = cardOf(previewFlow(ports(), newDraft, { id: item.id }));
    expect(card.sections.map((s) => s.header)).toContain("Recipients");
    expect(texts(card)).toEqual(
      expect.arrayContaining([TO, CC, BCC, "Adds 3 recipients."]),
    );
    expect(widgets(card)).toContainEqual({
      kind: "item",
      topLabel: "Bcc",
      text: BCC,
      bottomLabel: "outside example.com\nhidden from other recipients",
    });
    expect(buttons(card).map((b) => b.text)).toEqual([
      "Insert",
      "Insert body only",
    ]);
    const done = insertOf(insertFlow(ports(), newDraft, named(card, "Insert")));
    expect(done).toMatchObject({
      subject: "Leaving",
      recipients: { to: [TO], cc: [CC], bcc: [BCC] },
    });
  });

  it("in a reply: To not added, Cc keeps the draft list first, subject kept", () => {
    const item = create("<p>Hi</p>", "Leaving");
    const card = cardOf(previewFlow(ports(), reply, { id: item.id }));
    expect(texts(card)).toContain(
      `Not added: ${TO}. The draft already has a To recipient.`,
    );
    expect(buttons(card).map((b) => b.text)).toEqual([
      "Insert",
      "Insert with subject",
      "Insert body only",
    ]);
    const done = insertOf(insertFlow(ports(), reply, named(card, "Insert")));
    expect(done.subject).toBeNull();
    expect(done.recipients).toEqual({
      cc: ["boss@example.com", CC],
      bcc: [BCC],
    });
  });

  it("Insert body only sends no subject and no recipients", () => {
    const item = create("<p>Hi</p>", "Leaving");
    const card = cardOf(previewFlow(ports(), newDraft, { id: item.id }));
    expect(
      insertOf(insertFlow(ports(), newDraft, named(card, "Insert body only"))),
    ).toEqual({
      kind: "insert",
      html: "<p>Hi</p>",
      subject: null,
      recipients: {},
    });
  });

  it("changed recipients under the open card: no insert, the card says so and carries the new hash", () => {
    const item = create();
    const card = cardOf(previewFlow(ports(), newDraft, { id: item.id }));
    const shown = named(card, "Insert");
    setLists(item, { cc: ["new@example.com"] });
    const again = insertFlow(ports(), newDraft, shown);
    expect(again.kind).toBe("update");
    const updated = cardOf(again);
    expect(texts(updated)[0]).toBe(`(!) ${CHANGED}`);
    expect(texts(updated)).toContain("new@example.com");
    expect(named(updated, "Insert")["rh"]).not.toBe(shown["rh"]);
    expect(
      insertOf(insertFlow(ports(), newDraft, named(updated, "Insert")))
        .recipients.cc,
    ).toEqual(["new@example.com"]);
  });

  it("a one-click Insert from a stale row never adds recipients: it pushes the preview card", () => {
    const item = create();
    const result = insertFlow(ports(), newDraft, { id: item.id });
    expect(result.kind).toBe("push");
    expect(texts(cardOf(result))).toContain(TO);
    expect(texts(cardOf(result))).not.toContain(`(!) ${CHANGED}`);
  });

  it("deny: the blocked address is listed as not added and never inserted", () => {
    const item = create();
    world.props.setProperty("RECIPIENTS_EXTERNAL", "deny");
    const card = cardOf(previewFlow(ports(), newDraft, { id: item.id }));
    expect(texts(card)).toContain(
      `Not added: ${BCC}. Outside example.com, turned off by your admin.`,
    );
    expect(
      insertOf(insertFlow(ports(), newDraft, named(card, "Insert"))).recipients,
    ).toEqual({ to: [TO], cc: [CC] });
  });

  it("side panel preview lists the recipients with no Insert", () => {
    const item = create();
    const card = cardOf(
      previewFlow(ports("message"), undefined, { id: item.id }),
    );
    expect(texts(card)).toContain(CC);
    expect(buttons(card)).toEqual([]);
  });

  it("no draft address reaches the server", () => {
    const item = create();
    const card = cardOf(previewFlow(ports(), reply, { id: item.id }));
    insertFlow(ports(), reply, named(card, "Insert"));
    const args = JSON.stringify(sent.map((s) => s.args));
    expect(args).not.toContain("example.org");
    expect(args).not.toContain("boss@");
  });
});

describe("prompt card", () => {
  function opened(item: Item, event: AddonEvent = newDraft) {
    const card = cardOf(insertFlow(ports(), event, { id: item.id }));
    const params = card.footer?.primary.action.params ?? {};
    return { card, params };
  }

  const form = (
    values: Record<string, string>,
    base: AddonEvent = newDraft,
  ): AddonEvent => ({
    ...base,
    commonEventObject: {
      formInputs: Object.fromEntries(
        Object.entries(values).map(([k, v]) => [
          k,
          { stringInputs: { value: [v] } },
        ]),
      ),
    },
  });

  it("the switch on adds the recipients; off adds none", () => {
    const item = create("<p>{{ask:Driver}}</p>");
    const { params } = opened(item);
    expect(params["rh"]).toMatch(/^[0-9a-f]{16}$/);
    expect(
      insertOf(
        promptInsertFlow(ports(), form({ "p-1": "Jo", rcpt: "on" }), params),
      ).recipients,
    ).toEqual({ to: [TO], cc: [CC], bcc: [BCC] });
    expect(
      insertOf(promptInsertFlow(ports(), form({ "p-1": "Jo" }), params))
        .recipients,
    ).toEqual({});
  });

  it("changed recipients: no insert, the card says so with the switch on", () => {
    const item = create("<p>{{ask:Driver}}</p>");
    const { params } = opened(item);
    setLists(item, { bcc: [] });
    const card = cardOf(
      promptInsertFlow(ports(), form({ "p-1": "Jo", rcpt: "on" }), {
        ...params,
        version: "2",
      }),
    );
    expect(texts(card).at(-1)).toBe(`(!) ${CHANGED}`);
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({
        text: "Add recipients",
        bottomLabel: `To ${TO}, Cc ${CC}`,
        toggle: { name: "rcpt", selected: true },
      }),
    );
  });

  it("Insert body only: no switch, no recipients", () => {
    const item = create("<p>{{ask:Driver}}</p>", "Leaving");
    const card = cardOf(
      insertFlow(ports(), newDraft, { id: item.id, subject: "skip" }),
    );
    expect(texts(card)).not.toContain("Add recipients");
    const params = card.footer?.primary.action.params ?? {};
    expect(params).not.toHaveProperty("rh");
    expect(
      insertOf(
        promptInsertFlow(ports(), form({ "p-1": "Jo", rcpt: "on" }), params),
      ),
    ).toMatchObject({ subject: null, recipients: {} });
  });
});
