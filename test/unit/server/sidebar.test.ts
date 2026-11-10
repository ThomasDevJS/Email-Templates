import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import type {
  ApplyResult,
  SidebarHome,
} from "../../../src/shared/model/sidebar";
import { readBuffer } from "../../../src/server/audit/buffer";
import {
  F8_ANSWERS,
  S4_FIXTURES,
  s4Fixture,
} from "../../../src/shared/spike/s4Fixtures";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
const EVE = "eve@example.com";
const OUTSIDER = "out@other.example";
let world: World;
let sales: Folder;
let quotes: Folder;
let hr: Folder;

beforeEach(() => {
  world = setupWorld();
  sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
  quotes = world.ok<Folder>(OWNER, "folder.create", {
    name: "Quotes",
    parentId: sales.id,
  });
  hr = world.ok<Folder>(OWNER, "folder.create", { name: "HR" });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
  expect(world.lock.hasLock()).toBe(false);
});

function grant(folderId: string, email: string, level: string): void {
  world.ok(OWNER, "grant.add", {
    folderId,
    principalType: "user",
    principalKey: email,
    level,
  });
}

function create(folderId: string, title: string, html: string): Item {
  return world.ok<Item>(OWNER, "template.create", { folderId, title, html });
}

function errorOf(caller: string, op: string, args: unknown, addon = false) {
  const response = world.call(caller, op, args, addon ? "addon" : "webapp");
  if (response.ok) throw new Error(`${op} unexpectedly succeeded`);
  return response.error;
}

function home(caller: string): SidebarHome {
  return world.ok<SidebarHome>(caller, "sidebar.home", {}, "addon");
}

function apply(caller: string, args: Record<string, unknown>): ApplyResult {
  return world.ok<ApplyResult>(caller, "template.apply", args, "addon");
}

describe("sidebar.home (spec 4.1 step 2, list op filtered by use)", () => {
  it("returns the top visible folders with subtree counts and the caller's templates", () => {
    create(sales.id, "Welcome", "<p>Hi {{recipient.first_name|there}}</p>");
    create(quotes.id, "Price quote", "<p>{{ask:Meeting date}}</p>");
    create(hr.id, "Leave", "<p>HR only</p>");
    grant(sales.id, ANA, "use");
    const view = home(ANA);
    expect(view.folders).toEqual([
      { id: sales.id, name: "Sales", parentId: "", count: 2 },
    ]);
    expect(view.subfolders).toEqual([
      {
        id: quotes.id,
        name: "Quotes",
        parentId: sales.id,
        count: 1,
      },
    ]);
    expect(view.templates.map((t) => t.title)).toEqual([
      "Price quote",
      "Welcome",
    ]);
    expect(view.templates[0]).toMatchObject({
      folderId: quotes.id,
      prompts: ["Meeting date"],
      level: "use",
      version: 1,
    });
    expect(view).toMatchObject({ isAdmin: false, favorites: [], recent: [] });
  });

  it("shows a granted subfolder at the top when its parent is hidden", () => {
    create(quotes.id, "Price quote", "<p>x</p>");
    grant(quotes.id, BOB, "edit");
    const view = home(BOB);
    expect(view.folders.map((f) => [f.name, f.parentId, f.count])).toEqual([
      ["Quotes", "", 1],
    ]);
    expect(view.templates[0]?.level).toBe("edit");
  });

  it("returns nothing to a caller without grants (default deny)", () => {
    create(sales.id, "Welcome", "<p>x</p>");
    expect(home(EVE)).toMatchObject({
      folders: [],
      subfolders: [],
      templates: [],
    });
  });

  it("hides deleted templates and folders", () => {
    const item = create(sales.id, "Welcome", "<p>x</p>");
    world.ok(OWNER, "template.delete", { id: item.id });
    world.ok(OWNER, "folder.delete", { folderId: hr.id });
    grant(sales.id, ANA, "use");
    const view = home(ANA);
    expect(view.templates).toEqual([]);
    expect(view.folders[0]?.count).toBe(0);
    expect(home(OWNER).folders.map((f) => f.name)).toEqual(["Sales"]);
  });

  it("lists the caller's own private folder last and other users' private folders never, even for admins", () => {
    world.ok(ANA, "folder.list");
    world.ok(OWNER, "folder.list");
    const anaHome = home(ANA);
    expect(anaHome.folders).toEqual([
      expect.objectContaining({ name: "My templates" }),
    ]);
    const ownerHome = home(OWNER);
    expect(ownerHome.isAdmin).toBe(true);
    expect(ownerHome.folders.map((f) => f.name)).toEqual([
      "Sales",
      "HR",
      "My templates",
    ]);
  });

  it("serves both surfaces and buffers nothing", () => {
    grant(sales.id, ANA, "use");
    expect(world.call(ANA, "sidebar.home").ok).toBe(true);
    expect(readBuffer(world.cache).events).toEqual([]);
  });
});

describe("template.apply (spec 4.1 step 3)", () => {
  let item: Item;

  beforeEach(() => {
    item = create(
      sales.id,
      "Welcome",
      '<p onclick="x">Hi {{recipient.first_name}}, {{sender.name}}</p>',
    );
    world.directory.users.set(ANA, {
      name: { fullName: "Ana Lima", givenName: "Ana" },
      organizations: [{ title: "Sales Lead", department: "Sales" }],
      phones: [{ type: "work", value: "+1 555 0199" }],
    });
    world.directory.users.set(BOB, { name: { givenName: "Bob" } });
  });

  it.each(["use", "edit", "manage"])(
    "lets a caller with %s apply: body, sender values, internal recipient first name",
    (level) => {
      grant(sales.id, ANA, level);
      expect(
        apply(ANA, {
          id: item.id,
          knownVersion: 0,
          recipientEmailIfInternal: BOB,
        }),
      ).toEqual({
        id: item.id,
        title: "Welcome",
        version: 1,
        html: "<p>Hi {{recipient.first_name}}, {{sender.name}}</p>",
        sender: {
          name: "Ana Lima",
          title: "Sales Lead",
          phone: "+1 555 0199",
          department: "Sales",
        },
        recipientFirstName: "Bob",
      });
    },
  );

  it("denies a caller without use, buffers the denial, not an apply", () => {
    expect(
      errorOf(ANA, "template.apply", { id: item.id, knownVersion: 0 }, true),
    ).toMatchObject({ code: "DENIED" });
    const kinds = readBuffer(world.cache).events.map((event) => event.kind);
    expect(kinds).toEqual(["denied"]);
  });

  it("re-checks use on every call: a removed grant denies the next apply", () => {
    grant(sales.id, ANA, "use");
    apply(ANA, { id: item.id, knownVersion: 1 });
    const grantId = world.services
      .store()
      .readIndex()
      .grants.find((g) => g.principalKey === ANA)?.id;
    world.ok(OWNER, "grant.remove", { grantId });
    expect(
      errorOf(ANA, "template.apply", { id: item.id, knownVersion: 1 }, true),
    ).toMatchObject({ code: "DENIED" });
  });

  it("lets admins apply anywhere", () => {
    expect(apply(OWNER, { id: item.id, knownVersion: 0 }).html).not.toBeNull();
  });

  it("omits the body when knownVersion is current", () => {
    grant(sales.id, ANA, "use");
    const reads = world.drive.calls.length;
    const result = apply(ANA, { id: item.id, knownVersion: 1 });
    expect(result.html).toBeNull();
    expect(result.version).toBe(1);
    expect(world.drive.calls.slice(reads)).not.toContain("get");
  });

  it("buffers one apply event per call (spec section 10)", () => {
    grant(sales.id, ANA, "use");
    apply(ANA, { id: item.id, knownVersion: 0 });
    expect(readBuffer(world.cache).events).toEqual([
      {
        kind: "apply",
        itemId: item.id,
        actor: ANA,
        ts: new Date(world.clock.now).toISOString(),
      },
    ]);
  });

  it("followUp (prompt card Insert) re-checks use but buffers no second event", () => {
    grant(sales.id, ANA, "use");
    apply(ANA, { id: item.id, knownVersion: 0 });
    apply(ANA, { id: item.id, knownVersion: 1, followUp: true });
    expect(
      readBuffer(world.cache).events.filter((e) => e.kind === "apply"),
    ).toHaveLength(1);
    expect(
      errorOf(
        EVE,
        "template.apply",
        { id: item.id, knownVersion: 1, followUp: true },
        true,
      ).code,
    ).toBe("DENIED");
  });

  it("never looks up an external or blank recipient", () => {
    grant(sales.id, ANA, "use");
    for (const recipientEmailIfInternal of [OUTSIDER, "", "  "]) {
      const calls = world.directory.calls.length;
      expect(
        apply(ANA, { id: item.id, knownVersion: 1, recipientEmailIfInternal })
          .recipientFirstName,
      ).toBe("");
      expect(
        world.directory.calls.slice(calls).map((call) => call.email),
      ).not.toContain(OUTSIDER);
    }
  });

  it("returns blank values when the Directory has no record", () => {
    grant(sales.id, EVE, "use");
    expect(
      apply(EVE, {
        id: item.id,
        knownVersion: 1,
        recipientEmailIfInternal: "nobody@example.com",
      }),
    ).toMatchObject({
      sender: { name: "", title: "", phone: "", department: "" },
      recipientFirstName: "",
    });
  });

  it("validates arguments and reports removed templates", () => {
    grant(sales.id, ANA, "use");
    expect(errorOf(ANA, "template.apply", { id: item.id }, true)).toMatchObject(
      { code: "VALIDATION" },
    );
    world.ok(OWNER, "template.delete", { id: item.id });
    expect(
      errorOf(ANA, "template.apply", { id: item.id, knownVersion: 1 }, true),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("spike.s4 (TEMPORARY, admin only)", () => {
  it("denies non-admins on both surfaces, even with a grant", () => {
    grant(sales.id, ANA, "manage");
    expect(errorOf(ANA, "spike.s4", { fixture: "F1" }, true).code).toBe(
      "DENIED",
    );
    expect(errorOf(ANA, "spike.s4", { fixture: "F1" }).code).toBe("DENIED");
  });

  it("returns every fixture to an admin on the add-on surface", () => {
    for (const fixture of S4_FIXTURES) {
      const result = world.ok<{ html: string; bytes: number }>(
        OWNER,
        "spike.s4",
        { fixture },
        "addon",
      );
      expect(result.html).toBe(s4Fixture(fixture, {}));
    }
    expect(errorOf(OWNER, "spike.s4", { fixture: "F10" }).code).toBe(
      "VALIDATION",
    );
  });

  it("sizes F6 and F7 at 50 KB and 200 KB", () => {
    const bytes = (fixture: string) =>
      world.ok<{ bytes: number }>(OWNER, "spike.s4", { fixture }).bytes;
    expect(bytes("F6")).toBeGreaterThanOrEqual(50 * 1024);
    expect(bytes("F6")).toBeLessThan(51 * 1024);
    expect(bytes("F7")).toBeGreaterThanOrEqual(200 * 1024);
    expect(bytes("F7")).toBeLessThan(201 * 1024);
  });

  it("fills F8 with sender values, the recipient first name and escaped prompt answers", () => {
    world.directory.users.set(OWNER, { name: { fullName: "Owner One" } });
    world.directory.users.set(BOB, { name: { givenName: "Bob" } });
    const { html } = world.ok<{ html: string }>(OWNER, "spike.s4", {
      fixture: "F8",
      recipientEmailIfInternal: BOB,
    });
    expect(html).toContain("<p>Name: Owner One</p>");
    expect(html).toContain("<p>Title: no title</p>");
    expect(html).toContain("<p>Hi Bob,</p>");
    expect(html).toContain(
      "<strong>Q3 &lt;review&gt; &amp; &quot;plan&quot;</strong>",
    );
    expect(html).toContain("Line one<br>Line two");
    expect(Object.keys(F8_ANSWERS)).toEqual(["topic", "notes"]);
  });
});
