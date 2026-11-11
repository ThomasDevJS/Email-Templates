import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import type {
  SidebarHome,
  SidebarTemplate,
} from "../../../src/shared/model/sidebar";
import { SIDE_CACHE } from "../../../src/server/cache/sideCache";
import { TEXT_MISS_BUDGET } from "../../../src/server/handlers/body";
import { runTick } from "../../../src/server/jobs/tick";
import { applyUsage } from "../../../src/server/audit/usage";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

/** Slice 5 ops: `search`, `search.body`, `favorite.set`, `favorite.unset`, and Favorites and Recent in the lists. */
const ANA = "ana@example.com";
const BOB = "bob@example.com";
const OUTSIDER = "out@other.example";
let world: World;
let sales: Folder;
let hr: Folder;

beforeEach(() => {
  world = setupWorld();
  // D11 rules: personal templates on (D29 default is off).
  setSetting(world, "personalTemplates", "on");
  sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
  hr = world.ok<Folder>(OWNER, "folder.create", { name: "HR" });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
  expect(world.lock.hasLock()).toBe(false);
});

function grant(folderId: string, email: string, level: string): string {
  return world.ok<{ id: string }>(OWNER, "grant.add", {
    folderId,
    principalType: "user",
    principalKey: email,
    level,
  }).id;
}

function create(
  folderId: string,
  title: string,
  fields: Record<string, unknown> = {},
): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId,
    title,
    html: "<p>Hello</p>",
    ...fields,
  });
}

function errorCode(caller: string, op: string, args: unknown, addon = false) {
  const response = world.call(caller, op, args, addon ? "addon" : "webapp");
  return response.ok ? "ok" : response.error.code;
}

const titles = (results: readonly { title: string }[]) =>
  results.map((r) => r.title);

function search(caller: string, query: string): SidebarTemplate[] {
  return world.ok<{ results: SidebarTemplate[] }>(
    caller,
    "search",
    { query },
    "addon",
  ).results;
}

/** Usage events as `tick` writes them. */
function used(email: string, ...ids: string[]): void {
  const store = world.services.store();
  store.writeSide(
    "usage",
    applyUsage(
      store.readSide("usage"),
      ids.map((itemId, n) => ({
        itemId,
        actor: email,
        ts: new Date(world.clock.now + n * 1000).toISOString(),
      })),
    ),
  );
  world.props.deleteProperty(SIDE_CACHE.usage.revKey);
}

describe("search (sidebar, spec 4.4)", () => {
  it("ranks title over subject, tags and folder over snippet; only visible templates", () => {
    create(sales.id, "Quote reply");
    create(sales.id, "Welcome", { subject: "Your quote" });
    create(sales.id, "Pricing", { tags: ["quote"] });
    create(sales.id, "Intro", { html: "<p>About the quote</p>" });
    create(hr.id, "Quote HR only");
    grant(sales.id, ANA, "use");
    expect(titles(search(ANA, "QUOTE"))).toEqual([
      "Quote reply",
      "Pricing",
      "Welcome",
      "Intro",
    ]);
  });

  it("matches accents, prefixes and one typo for terms of 5 or more characters", () => {
    create(sales.id, "Résumé reminder");
    grant(sales.id, ANA, "use");
    expect(titles(search(ANA, "resu"))).toEqual(["Résumé reminder"]);
    expect(titles(search(ANA, "remindr"))).toEqual(["Résumé reminder"]);
    expect(titles(search(ANA, "rem xyz"))).toEqual([]);
    expect(titles(search(ANA, "rexu"))).toEqual([]);
  });

  it("filters with folder: and tag:, and an empty query returns nothing", () => {
    const quotes = world.ok<Folder>(OWNER, "folder.create", {
      name: "Quotes",
      parentId: sales.id,
    });
    create(quotes.id, "A", { tags: ["pricing"] });
    create(sales.id, "B", { tags: ["pricing"] });
    create(sales.id, "C");
    grant(sales.id, ANA, "use");
    expect(titles(search(ANA, "folder:quot"))).toEqual(["A"]);
    expect(titles(search(ANA, "tag:pricing"))).toEqual(["A", "B"]);
    expect(titles(search(ANA, "folder:sales tag:pri b"))).toEqual(["B"]);
    expect(search(ANA, "   ")).toEqual([]);
  });

  it("breaks ties by the caller's last use, then title, and returns at most 20", () => {
    const items = Array.from({ length: 25 }, (_, n) =>
      create(sales.id, `Note ${String(n).padStart(2, "0")}`),
    );
    grant(sales.id, ANA, "use");
    used(ANA, items[3]?.id ?? "", items[7]?.id ?? "");
    runTick(world.as("trigger"));
    const results = search(ANA, "note");
    expect(results).toHaveLength(20);
    expect(titles(results).slice(0, 3)).toEqual([
      "Note 07",
      "Note 03",
      "Note 00",
    ]);
  });

  it("never finds another user's private template, even for an admin", () => {
    const anaPrivate = world
      .ok<{ folders: Folder[] }>(ANA, "folder.list")
      .folders.find((f) => f.kind === "private");
    world.ok(ANA, "template.create", {
      folderId: anaPrivate?.id,
      title: "Ana secret",
      html: "<p>x</p>",
    });
    expect(search(ANA, "secret")).toHaveLength(1);
    expect(search(OWNER, "secret")).toEqual([]);
  });

  it("does not match recipient addresses (spec 5.7, Q39: web app library only)", () => {
    create(sales.id, "Offer", { to: ["buyer@example.com"] });
    grant(sales.id, ANA, "use");
    expect(search(ANA, "buyer")).toEqual([]);
    expect(search(ANA, "buyer@example.com")).toEqual([]);
  });

  it("template.list carries To, Cc and Bcc of the visible templates only, [] for templates without lists", () => {
    create(sales.id, "Offer", { to: ["buyer@example.com"], bcc: [BOB] });
    create(hr.id, "Hidden", { cc: ["hidden@example.com"] });
    grant(sales.id, ANA, "use");
    const legacy = create(sales.id, "Legacy");
    const index = world.services.store().readIndex();
    world.services.store().writeIndex({
      ...index,
      items: index.items.map((item) => {
        if (item.id !== legacy.id) return item;
        // An item written before slice 9: no lists.
        return Object.fromEntries(
          Object.entries(item).filter(
            ([key]) => !["to", "cc", "bcc"].includes(key),
          ),
        ) as unknown as Item;
      }),
    });
    world.props.deleteProperty("INDEX_REV");
    const listed = world.ok<{ items: Item[] }>(ANA, "template.list").items;
    expect(
      listed.map(({ title, to, cc, bcc }) => ({ title, to, cc, bcc })),
    ).toEqual([
      { title: "Offer", to: ["buyer@example.com"], cc: [], bcc: [BOB] },
      { title: "Legacy", to: [], cc: [], bcc: [] },
    ]);
    expect(JSON.stringify(listed)).not.toContain("hidden@example.com");
  });

  it("does not match names of folders the caller cannot see", () => {
    const quotes = world.ok<Folder>(OWNER, "folder.create", {
      name: "Quotes",
      parentId: hr.id,
    });
    create(quotes.id, "Offer");
    grant(quotes.id, ANA, "use");
    expect(titles(search(ANA, "folder:quotes"))).toEqual(["Offer"]);
    expect(search(ANA, "folder:hr")).toEqual([]);
  });
});

describe("search.body (web app, spec 4.4)", () => {
  it("returns IDs whose body text matches every term, only from usable folders", () => {
    const a = create(sales.id, "A", { html: "<p>Invoice due Friday</p>" });
    create(sales.id, "B", { html: "<p>Invoice paid</p>" });
    create(hr.id, "C", { html: "<p>Invoice due HR</p>" });
    grant(sales.id, ANA, "use");
    expect(world.ok(ANA, "search.body", { query: "invoice due" })).toEqual({
      ids: [a.id],
      skipped: 0,
    });
    expect(world.ok(ANA, "search.body", { query: "tag:x" })).toEqual({
      ids: [],
      skipped: 0,
    });
  });

  it("reads body files only on a text cache miss, at most 25 per call", () => {
    const items = Array.from({ length: TEXT_MISS_BUDGET + 3 }, (_, n) =>
      create(sales.id, `T${String(n)}`, { html: "<p>alpha</p>" }),
    );
    grant(sales.id, ANA, "use");
    const warm = world.drive.calls.length;
    expect(
      world.ok<{ ids: string[] }>(ANA, "search.body", { query: "alpha" }).ids,
    ).toHaveLength(TEXT_MISS_BUDGET + 3);
    expect(world.drive.calls.length).toBe(warm);
    world.cache.removeAll(items.map((item) => `ft:${item.bodyFileId}`));
    const first = world.ok<{ ids: string[]; skipped: number }>(
      ANA,
      "search.body",
      { query: "alpha" },
    );
    expect(first.ids).toHaveLength(TEXT_MISS_BUDGET);
    expect(first.skipped).toBe(3);
    const second = world.ok<{ skipped: number }>(ANA, "search.body", {
      query: "alpha",
    });
    expect(second.skipped).toBe(0);
  });
});

describe("favorites and recent (spec 4.1 step 2, 5.5)", () => {
  function home(caller: string): SidebarHome {
    return world.ok<SidebarHome>(caller, "sidebar.home", {}, "addon");
  }

  it("favorite.set puts the template first, favorite.unset removes it; sidebar and library see both", () => {
    const a = create(sales.id, "A");
    const b = create(sales.id, "B");
    grant(sales.id, ANA, "use");
    expect(world.ok(ANA, "favorite.set", { id: a.id }, "addon")).toEqual({
      id: a.id,
      favorite: true,
    });
    world.ok(ANA, "favorite.set", { id: b.id });
    world.ok(ANA, "favorite.set", { id: a.id });
    expect(home(ANA).favorites).toEqual([a.id, b.id]);
    world.ok(ANA, "favorite.unset", { id: a.id });
    expect(home(ANA).favorites).toEqual([b.id]);
    expect(
      world.ok<{ favorites: string[] }>(ANA, "template.list").favorites,
    ).toEqual([b.id]);
    expect(home(BOB).favorites).toEqual([]);
    const stored = world.services.store().readSide("favorites");
    expect(stored.byUser[ANA]).toEqual([b.id]);
  });

  it("never returns a favorite or recent template the caller can no longer use", () => {
    const a = create(sales.id, "A");
    const grantId = grant(sales.id, ANA, "use");
    world.ok(ANA, "favorite.set", { id: a.id });
    used(ANA, a.id);
    expect(home(ANA)).toMatchObject({ favorites: [a.id], recent: [a.id] });
    world.ok(OWNER, "grant.remove", { grantId });
    expect(home(ANA)).toMatchObject({ favorites: [], recent: [] });
    expect(
      world.ok<{ favorites: string[]; recent: string[] }>(ANA, "template.list"),
    ).toMatchObject({ favorites: [], recent: [] });
  });

  it("drops deleted templates and refuses to favorite one", () => {
    const a = create(sales.id, "A");
    grant(sales.id, ANA, "use");
    world.ok(ANA, "favorite.set", { id: a.id });
    world.ok(OWNER, "template.delete", { id: a.id });
    expect(home(ANA).favorites).toEqual([]);
    expect(errorCode(ANA, "favorite.set", { id: a.id })).toBe("NOT_FOUND");
    expect(errorCode(ANA, "favorite.unset", { id: a.id })).toBe("ok");
  });

  it("caps Favorites at 10 and Recent at 5 in the sidebar", () => {
    const items = Array.from({ length: 12 }, (_, n) =>
      create(sales.id, `T${String(n)}`),
    );
    grant(sales.id, ANA, "use");
    for (const item of items) world.ok(ANA, "favorite.set", { id: item.id });
    used(ANA, ...items.map((item) => item.id));
    const view = home(ANA);
    expect(view.favorites).toHaveLength(10);
    expect(view.favorites[0]).toBe(items[11]?.id);
    expect(view.recent).toHaveLength(5);
    expect(view.recent[0]).toBe(items[11]?.id);
  });

  it("serves warm favorites and usage from the cache and publishes unset revs in tick", () => {
    const a = create(sales.id, "A");
    grant(sales.id, ANA, "use");
    world.ok(ANA, "favorite.set", { id: a.id });
    let drive = world.drive.calls.length;
    home(ANA);
    expect(world.drive.calls.length).toBe(drive);
    world.props.deleteProperty(SIDE_CACHE.favorites.revKey);
    drive = world.drive.calls.length;
    expect(home(ANA).favorites).toEqual([a.id]);
    expect(world.drive.calls.length).toBeGreaterThan(drive);
    runTick(world.as("trigger"));
    expect(world.props.getProperty(SIDE_CACHE.favorites.revKey)).not.toBeNull();
    drive = world.drive.calls.length;
    home(ANA);
    expect(world.drive.calls.length).toBe(drive);
  });

  it("tick publishes usage after it writes apply events", () => {
    const a = create(sales.id, "A");
    grant(sales.id, ANA, "use");
    world.ok(ANA, "template.apply", { id: a.id, knownVersion: 0 }, "addon");
    runTick(world.as("trigger"));
    const drive = world.drive.calls.length;
    expect(home(ANA).recent).toEqual([a.id]);
    expect(world.drive.calls.length).toBe(drive);
  });
});

describe("role matrix for the slice 5 ops (default deny)", () => {
  let item: Item;

  beforeEach(() => {
    item = create(sales.id, "Quote");
  });

  const ops = [
    ["favorite.set", () => ({ id: item.id })],
    ["favorite.unset", () => ({ id: item.id })],
  ] as const;

  it.each(ops)(
    "%s: no grant DENIED, use edit manage ok, admin ok",
    (op, args) => {
      expect(errorCode(ANA, op, args())).toBe("DENIED");
      expect(errorCode(ANA, op, args(), true)).toBe("DENIED");
      for (const [email, level] of [
        [ANA, "use"],
        [BOB, "edit"],
        ["cy@example.com", "manage"],
      ] as const) {
        grant(sales.id, email, level);
        expect(errorCode(email, op, args())).toBe("ok");
        expect(errorCode(email, op, args(), true)).toBe("ok");
      }
      expect(errorCode(OWNER, op, args())).toBe("ok");
    },
  );

  it.each(ops)(
    "%s: an outside domain is refused before any data access",
    (op, args) => {
      const drive = world.drive.calls.length;
      expect(errorCode(OUTSIDER, op, args())).toBe("AUTH_DOMAIN");
      expect(world.drive.calls.length).toBe(drive);
    },
  );

  it("search and search.body: list ops, empty without a grant, filtered with one", () => {
    expect(search(ANA, "quote")).toEqual([]);
    expect(world.ok(ANA, "search.body", { query: "hello" })).toEqual({
      ids: [],
      skipped: 0,
    });
    grant(sales.id, ANA, "use");
    expect(titles(search(ANA, "quote"))).toEqual(["Quote"]);
    expect(
      world.ok<{ ids: string[] }>(ANA, "search.body", { query: "hello" }).ids,
    ).toEqual([item.id]);
    expect(errorCode(OUTSIDER, "search", { query: "q" }, true)).toBe(
      "AUTH_DOMAIN",
    );
    expect(errorCode(OUTSIDER, "search.body", { query: "q" })).toBe(
      "AUTH_DOMAIN",
    );
  });

  it("an unknown template ID is NOT_FOUND before any favorites read", () => {
    const drive = world.drive.calls.length;
    expect(errorCode(ANA, "favorite.set", { id: "X".repeat(26) })).toBe(
      "NOT_FOUND",
    );
    expect(world.drive.calls.length).toBe(drive);
  });
});
