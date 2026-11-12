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
import { FINISH_TYPING } from "../../../src/addon/cards/recipients";
import { TOOLBAR_HINT } from "../../../src/addon/cards/sidePanel";
import { FakeCache } from "../../fakes/cache";
import { createRecordingGmail } from "../../fakes/gmail";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

/** Template recipients in the add-on (spec 5.7, 7.4, wireframe 02): rows with `rc`, the details card, `rh`, actions. */
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
    gmail: createRecordingGmail().gmail,
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

function folderCardOf(entry: Entry = "compose"): CardSpec {
  return cardOf(folderFlow(ports(entry), { folderId: sales.id, page: "1" }));
}

// Spike S6: `draftMetadata` carries all 3 lists, empty when the field is empty.
const newDraft: AddonEvent = {
  draftMetadata: { toRecipients: [], ccRecipients: [], bccRecipients: [] },
};
const reply: AddonEvent = {
  draftMetadata: {
    toRecipients: ["Driver@Example.org"],
    ccRecipients: ["boss@example.com"],
    bccRecipients: [],
    subject: "Re: leaving",
  },
};

/** The Insert params of the row of `item` on the folder card, as Gmail sends them back. */
function rowParams(item: Item): Record<string, string> {
  const row = widgets(folderCardOf()).find(
    (w) => w.kind === "item" && w.text === item.title,
  );
  if (row?.kind !== "item" || row.button === undefined)
    throw new Error("no row button");
  return { ...row.button.action.params };
}

const footerParams = (card: CardSpec) =>
  card.footer?.primary.action.params ?? {};

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

describe("list rows", () => {
  it("every row has Insert; a template with recipients shows the hint and carries rc (AC 1)", () => {
    const item = create();
    const fields = create("<p>{{ask:Driver}}</p>");
    world.ok(OWNER, "template.create", {
      folderId: sales.id,
      title: "Plain",
      html: "<p>x</p>",
    });
    const rows = widgets(folderCardOf()).flatMap((w) =>
      w.kind === "item" && w.button ? [w] : [],
    );
    expect(rows.map((w) => w.button?.text)).toEqual([
      "Insert",
      "Insert",
      "Insert",
    ]);
    expect(rows.find((w) => w.text === item.title)).toMatchObject({
      bottomLabel: "Adds To 1, Cc 1, Bcc 1",
      button: {
        text: "Insert",
        alt: "Insert Driver leaving",
        style: "filled",
        action: { fn: "onInsert", params: { id: item.id, rc: "1,1,1" } },
      },
    });
    expect(
      rows
        .filter((w) => w.text === item.title)
        .map((w) => w.button?.action.params),
    ).toEqual([
      { id: item.id, rc: "1,1,1" },
      { id: fields.id, rc: "1,1,1" },
    ]);
    expect(
      Object.keys(
        rows.find((w) => w.text === "Plain")?.button?.action.params ?? {},
      ),
    ).toEqual(["id"]);
    expect(JSON.stringify(rows)).not.toContain("Review");
  });

  it("side panel rows show the hint and carry rc on New email and Reply (slice 18 AC 1, 2)", () => {
    const item = create();
    for (const [entry, as] of [
      ["inbox", "new"],
      ["message", "reply"],
    ] as const) {
      const row = widgets(folderCardOf(entry)).find(
        (w) => w.kind === "item" && w.text === "Driver leaving",
      );
      expect(row).toMatchObject({ bottomLabel: "Adds To 1, Cc 1, Bcc 1" });
      expect(buttons(folderCardOf(entry))[0]?.action).toEqual({
        fn: "onCompose",
        params: { id: item.id, rc: "1,1,1", as },
      });
    }
  });
});

describe("row Insert with recipients (spec 7.4 Flow A)", () => {
  it("equal rc: one insert reply with body, subject and recipientActions(lists, draft, true) (AC 6)", () => {
    const item = create("<p>Hi {{ask:Driver}}</p>", "Leaving");
    expect(insertFlow(ports(), newDraft, rowParams(item))).toEqual({
      kind: "insert",
      html: "<p>Hi</p>",
      subject: "Leaving",
      recipients: { to: [TO], cc: [CC], bcc: [BCC] },
    });
  });

  it("in a reply: To not added, Cc keeps the draft list first, subject kept", () => {
    const item = create("<p>Hi</p>", "Leaving");
    const done = insertOf(insertFlow(ports(), reply, rowParams(item)));
    expect(done.subject).toBeNull();
    expect(done.recipients).toEqual({
      cc: ["boss@example.com", CC],
      bcc: [BCC],
    });
  });

  it("a different or absent rc pushes the details card with the change line and inserts nothing (AC 6)", () => {
    const item = create();
    const params = rowParams(item);
    setLists(item, { cc: [CC, "new@example.com"] });
    for (const sentRc of [params, { id: item.id }]) {
      const result = insertFlow(ports(), newDraft, sentRc);
      expect(result.kind).toBe("push");
      const card = cardOf(result);
      expect(texts(card)[0]).toBe(CHANGED);
      expect(texts(card)).toContain("new@example.com");
      expect(footerParams(card)["counted"]).toBe("1");
    }
    const card = cardOf(insertFlow(ports(), newDraft, params));
    const done = insertOf(
      promptInsertFlow(ports(), form({ rcpt: "on" }), footerParams(card)),
    );
    expect(done.recipients.cc).toEqual([CC, "new@example.com"]);
    expect(sent.at(-1)?.args).toMatchObject({ followUp: true });
  });

  it("a template address in a draft field the event cannot read pushes the details card, no insert (AC 7)", () => {
    const item = create();
    const odd: AddonEvent = {
      draftMetadata: { toRecipients: [], ccRecipients: "x", bccRecipients: [] },
    };
    const result = insertFlow(ports(), odd, rowParams(item));
    expect(result.kind).toBe("push");
    const card = cardOf(result);
    expect(texts(card)).toContain(
      `The draft's Cc recipients could not be read and were not changed. Add by hand: ${CC}.`,
    );
    expect(texts(card)).not.toContain(CHANGED);
    expect(
      insertOf(
        promptInsertFlow(
          ports(),
          form({ rcpt: "on" }, odd),
          footerParams(card),
        ),
      ).recipients,
    ).toEqual({ to: [TO], bcc: [BCC] });
  });

  it("deny: rc counts the allowed addresses; the blocked one is never inserted", () => {
    const item = create();
    setSetting(world, "recipientsExternal", "deny");
    const params = rowParams(item);
    expect(params["rc"]).toBe("1,1,0");
    expect(insertOf(insertFlow(ports(), newDraft, params)).recipients).toEqual({
      to: [TO],
      cc: [CC],
    });
  });

  it("no draft address reaches the server", () => {
    const item = create();
    insertFlow(ports(), reply, rowParams(item));
    const card = cardOf(previewFlow(ports(), reply, { id: item.id }));
    promptInsertFlow(ports(), form({ rcpt: "on" }, reply), footerParams(card));
    const args = JSON.stringify(sent.map((s) => s.args));
    expect(args).not.toContain("example.org");
    expect(args).not.toContain("boss@");
  });
});

describe("details card with recipients (spec 7.4 Flows B and C)", () => {
  function opened(item: Item, event: AddonEvent = newDraft) {
    const card = cardOf(previewFlow(ports(), event, { id: item.id }));
    return { card, params: footerParams(card) };
  }

  it("lists every address with markers under Recipients, with the switch on", () => {
    const item = create("<p>{{ask:Driver}}</p>");
    const { card, params } = opened(item);
    expect(card.sections.map((s) => s.header)).toContain("Recipients");
    expect(widgets(card)).toContainEqual({
      kind: "item",
      text: "Add recipients",
      bottomLabel: "Adds 3 recipients.",
      toggle: { name: "rcpt", selected: true },
    });
    expect(widgets(card)).toContainEqual({
      kind: "item",
      topLabel: "Bcc",
      text: BCC,
      bottomLabel: "outside example.com · hidden from other recipients",
    });
    expect(texts(card)).toContain(FINISH_TYPING);
    expect(params["rh"]).toMatch(/^[0-9a-f]{16}$/);
  });

  it("the switch on adds the recipients; off adds none", () => {
    const item = create("<p>{{ask:Driver}}</p>");
    const { params } = opened(item);
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

  it("both switches off: the body action only, no subject, no recipients (AC 11)", () => {
    const item = create("<p>Hi</p>", "Leaving");
    const { params } = opened(item);
    expect(promptInsertFlow(ports(), form({}), params)).toEqual({
      kind: "insert",
      html: "<p>Hi</p>",
      subject: null,
      recipients: {},
    });
  });

  it("changed recipients under the open card: no insert, the card says so with the switch on and a new rh", () => {
    const item = create("<p>{{ask:Driver}}</p>");
    const { params } = opened(item);
    setLists(item, { bcc: [] });
    const result = promptInsertFlow(
      ports(),
      form({ "p-1": "Jo", rcpt: "on" }),
      { ...params, version: "2" },
    );
    expect(result.kind).toBe("update");
    const card = cardOf(result);
    expect(texts(card)[0]).toBe(CHANGED);
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({
        text: "Add recipients",
        bottomLabel: "Adds 2 recipients.",
        toggle: { name: "rcpt", selected: true },
      }),
    );
    expect(footerParams(card)["rh"]).not.toBe(params["rh"]);
  });

  it("in a reply the card lists the To as not added and the Bcc marker", () => {
    const item = create("<p>{{ask:Driver}}</p>");
    const { card } = opened(item, reply);
    expect(texts(card)).toEqual(
      expect.arrayContaining([
        `Not added: ${TO}. The draft already has a To recipient.`,
        FINISH_TYPING,
      ]),
    );
  });

  it("deny: the blocked address is listed as not added", () => {
    const item = create();
    setSetting(world, "recipientsExternal", "deny");
    const { card } = opened(item);
    expect(texts(card)).toContain(
      `Not added: ${BCC}. Outside example.com, turned off by your admin.`,
    );
  });

  it.each(["inbox", "message"] as const)(
    "side panel %s: one template.apply followUp, the inputs, every address as for a new email, the hint last (slice 18 AC 8)",
    (entry) => {
      const item = create("<p>{{ask:Driver}}</p>", "Leaving");
      const card = cardOf(
        previewFlow(ports(entry), undefined, { id: item.id }),
      );
      expect(sent).toEqual([
        { op: "sidebar.home", args: {} },
        {
          op: "template.apply",
          args: { id: item.id, knownVersion: 0, followUp: true },
        },
      ]);
      expect(texts(card)).toEqual(expect.arrayContaining([TO, CC, BCC]));
      expect(texts(card)).not.toContain(FINISH_TYPING);
      expect(widgets(card).filter((w) => w.kind === "input")).toHaveLength(1);
      expect(card.footer?.primary.action.fn).toBe("onPromptCompose");
      expect(texts(card).at(-1)).toBe(TOOLBAR_HINT);
    },
  );
});
