/**
 * Slice 6a server side: admin view entry (`admin.folders`), folders and grants rules, memberships, trash restore
 * and purge. Role matrix per op for no grant, use, edit, manage, admin and the add-on surface.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  Folder,
  Grant,
  IndexDoc,
  Item,
} from "../../../src/shared/model/data";
import {
  FOLDER_DEPTH_MAX,
  PRINCIPAL_KEY_MAX,
} from "../../../src/shared/model/validate";
import { readBuffer } from "../../../src/server/audit/buffer";
import { handleRpc } from "../../../src/server/dispatch/handle";
import { PURGE_FILES_MAX, runDaily } from "../../../src/server/jobs/daily";
import { WRITE_LOCK_MS } from "../../../src/server/lock";
import { ADMIN_EMAILS_KEY } from "../../../src/server/membership/snapshot";
import type { Surface } from "../../../src/shared/log/logger";
import type { RpcResponse } from "../../../src/shared/model/protocol";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
let world: World;

beforeEach(() => {
  world = setupWorld();
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
});

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

function codeOf(
  caller: string,
  op: string,
  args: unknown = {},
  surface: Surface = "webapp",
): string {
  const response = world.call(caller, op, args, surface);
  return response.ok ? "ok" : response.error.code;
}

function folder(name: string, parentId = ""): Folder {
  return world.ok<Folder>(OWNER, "folder.create", { name, parentId });
}

function grant(
  folderId: string,
  principalKey: string,
  level: string,
  principalType = "user",
): Grant {
  return world.ok<Grant>(OWNER, "grant.add", {
    folderId,
    principalType,
    principalKey,
    level,
  });
}

function template(folderId: string, title = "T"): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId,
    title,
    html: "<p>x</p>",
  });
}

type Role = "none" | "use" | "edit" | "manage" | "admin" | "addon";
const ROLES: readonly Role[] = [
  "none",
  "use",
  "edit",
  "manage",
  "admin",
  "addon",
];

interface Fixture {
  readonly sales: Folder;
  readonly quotes: Folder;
  readonly other: Folder;
  readonly item: Item;
  readonly extraGrant: Grant;
}

/** Sales > Quotes and Sales > Other; one trashed template in Quotes; the role's grant on Sales. */
function fixture(role: Role): { caller: string; surface: Surface } & Fixture {
  const sales = folder("Sales");
  const quotes = folder("Quotes", sales.id);
  const other = folder("Other", sales.id);
  const item = template(quotes.id);
  world.ok(OWNER, "template.delete", { id: item.id });
  const extraGrant = grant(quotes.id, BOB, "use");
  if (role === "use" || role === "edit" || role === "manage")
    grant(sales.id, ANA, role);
  const admin = role === "admin" || role === "addon";
  return {
    caller: admin ? OWNER : ANA,
    surface: role === "addon" ? "addon" : "webapp",
    sales,
    quotes,
    other,
    item,
    extraGrant,
  };
}

type Case = (f: Fixture) => [string, unknown];

const OPS: Readonly<Record<string, Case>> = {
  "admin.folders": () => ["admin.folders", {}],
  "grant.list": (f) => ["grant.list", { folderId: f.quotes.id }],
  "grant.add": (f) => [
    "grant.add",
    {
      folderId: f.quotes.id,
      principalType: "domain",
      principalKey: "example.com",
      level: "use",
    },
  ],
  "grant.remove": (f) => ["grant.remove", { grantId: f.extraGrant.id }],
  "folder.create (sub)": (f) => [
    "folder.create",
    { parentId: f.sales.id, name: "New" },
  ],
  "folder.rename": (f) => [
    "folder.rename",
    { folderId: f.quotes.id, name: "Offers" },
  ],
  "folder.move": (f) => [
    "folder.move",
    { folderId: f.other.id, parentId: f.quotes.id },
  ],
  "folder.delete": (f) => ["folder.delete", { folderId: f.other.id }],
  "template.restoreFromTrash": (f) => [
    "template.restoreFromTrash",
    { id: f.item.id },
  ],
  "trash.purge": () => ["trash.purge", {}],
  "membership.status": () => ["membership.status", {}],
  "membership.refresh": () => ["membership.refresh", {}],
};

/** Expected result per role, in ROLES order. */
const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  "admin.folders": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "grant.list": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "grant.add": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "grant.remove": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "folder.create (sub)": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "folder.rename": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "folder.move": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "folder.delete": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "template.restoreFromTrash": ["DENIED", "DENIED", "ok", "ok", "ok", "DENIED"],
  "trash.purge": ["DENIED", "DENIED", "DENIED", "DENIED", "ok", "DENIED"],
  "membership.status": ["DENIED", "DENIED", "DENIED", "DENIED", "ok", "DENIED"],
  "membership.refresh": [
    "DENIED",
    "DENIED",
    "DENIED",
    "DENIED",
    "ok",
    "DENIED",
  ],
};

describe("role matrix of the slice 6a ops", () => {
  const cases = Object.keys(OPS).flatMap((name) =>
    ROLES.map((role, column) => [name, role, EXPECTED[name]?.[column]]),
  );

  it.each(cases)("%s as %s: %s", (name, role, expected) => {
    const f = fixture(role as Role);
    const [op, args] = (OPS[name as string] as Case)(f);
    const before = JSON.stringify(fileIndex());
    world.lines.length = 0;
    expect(codeOf(f.caller, op, args, f.surface)).toBe(expected);
    if (expected === "DENIED") {
      const line = JSON.parse(world.lines.at(-1) ?? "{}") as {
        calls: { drive: number };
      };
      expect(line.calls.drive).toBe(0);
      expect(JSON.stringify(fileIndex())).toBe(before);
    }
  });

  it("lists the trash only for edit and above", () => {
    for (const role of ROLES) {
      world = setupWorld();
      const f = fixture(role);
      const response = world.call(
        f.caller,
        "template.list",
        { trash: true },
        f.surface,
      );
      const data = response.ok
        ? (response.data as { items: unknown[]; canPurge: boolean })
        : { items: [], canPurge: false };
      const count = response.ok ? data.items.length : -1;
      expect(data.canPurge).toBe(role === "admin" || role === "addon");
      expect([role, count]).toEqual([
        role,
        { none: 0, use: 0, edit: 1, manage: 1, admin: 1, addon: 1 }[role],
      ]);
    }
  });
});

describe("admin.folders", () => {
  it("gives a manage holder the folders they manage, with no other folder or address", () => {
    const sales = folder("Sales");
    const quotes = folder("Quotes", sales.id);
    const hr = folder("HR");
    grant(hr.id, BOB, "manage");
    grant(sales.id, ANA, "manage");
    world.ok(BOB, "folder.list");
    const data = world.ok<{ isAdmin: boolean; folders: Folder[] }>(
      ANA,
      "admin.folders",
    );
    expect(data.isAdmin).toBe(false);
    expect(data.folders.map((entry) => entry.id).sort()).toEqual(
      [sales.id, quotes.id].sort(),
    );
    expect(JSON.stringify(data)).not.toContain(BOB);
  });

  it("gives an admin every folder, other users' private folders labelled with their owner (D18)", () => {
    world.ok(ANA, "folder.list");
    const data = world.ok<{ isAdmin: boolean; folders: Folder[] }>(
      OWNER,
      "admin.folders",
    );
    expect(data.isAdmin).toBe(true);
    expect(data.folders.map((entry) => entry.name)).toContain(
      `My templates (${ANA})`,
    );
  });

  it("buffers a denied audit event for a refused admin.folders and membership.status (ADR-0003 C)", () => {
    const sales = folder("Sales");
    grant(sales.id, ANA, "edit");
    expect(codeOf(ANA, "admin.folders")).toBe("DENIED");
    expect(codeOf(ANA, "membership.status")).toBe("DENIED");
    const denied = readBuffer(world.cache).events.flatMap((entry) =>
      entry.kind === "denied" ? [entry.event] : [],
    );
    expect(
      denied.map((event) => [event.action, event.actor, event.targetType]),
    ).toEqual([
      ["admin.folders", ANA, "library"],
      ["membership.status", ANA, "library"],
    ]);
    expect(denied[0]).toMatchObject({ result: "denied", errorCode: "DENIED" });
  });

  it("answers DENIED with no folder data to a caller who manages nothing", () => {
    const sales = folder("Sales");
    grant(sales.id, ANA, "edit");
    const response = world.call(ANA, "admin.folders");
    expect(response).toMatchObject({ ok: false, error: { code: "DENIED" } });
    expect(JSON.stringify(response)).not.toContain("Sales");
  });
});

describe("folder rules (spec 5.1)", () => {
  it(`allows ${String(FOLDER_DEPTH_MAX)} levels and refuses one more on create and move`, () => {
    let parent = "";
    const chain: Folder[] = [];
    for (let level = 1; level <= FOLDER_DEPTH_MAX; level++) {
      const created = folder(`L${String(level)}`, parent);
      chain.push(created);
      parent = created.id;
    }
    expect(
      codeOf(OWNER, "folder.create", { parentId: parent, name: "X" }),
    ).toBe("VALIDATION");
    const top = folder("Top");
    folder("Child", top.id);
    const third = chain[FOLDER_DEPTH_MAX - 2] as Folder;
    expect(
      codeOf(OWNER, "folder.move", { folderId: top.id, parentId: third.id }),
    ).toBe("VALIDATION");
    const second = chain[FOLDER_DEPTH_MAX - 3] as Folder;
    expect(
      codeOf(OWNER, "folder.move", { folderId: top.id, parentId: second.id }),
    ).toBe("ok");
  });

  it("refuses grants, moves and deletes on private folders; the owner cannot rename theirs", () => {
    const mine = world
      .ok<{ folders: Folder[] }>(ANA, "folder.list")
      .folders.find((entry) => entry.kind === "private") as Folder;
    const shared = folder("Shared");
    expect(
      codeOf(OWNER, "grant.add", {
        folderId: mine.id,
        principalType: "user",
        principalKey: BOB,
        level: "use",
      }),
    ).toBe("VALIDATION");
    expect(
      codeOf(OWNER, "folder.move", { folderId: mine.id, parentId: shared.id }),
    ).toBe("VALIDATION");
    expect(codeOf(OWNER, "folder.delete", { folderId: mine.id })).toBe(
      "VALIDATION",
    );
    expect(
      codeOf(ANA, "folder.rename", { folderId: mine.id, name: "Mine" }),
    ).toBe("DENIED");
  });

  it("strips the owner label only from another user's private folder (slice 5c minor 1)", () => {
    const own = world
      .ok<{ folders: Folder[] }>(OWNER, "folder.list")
      .folders.find((entry) => entry.kind === "private") as Folder;
    const kept = `Mine (${OWNER})`;
    expect(
      world.ok<Folder>(OWNER, "folder.rename", { folderId: own.id, name: kept })
        .name,
    ).toBe(kept);
    const anas = world
      .ok<{ folders: Folder[] }>(ANA, "folder.list")
      .folders.find((entry) => entry.kind === "private") as Folder;
    expect(
      world.ok<Folder>(OWNER, "folder.rename", {
        folderId: anas.id,
        name: `Notes (${ANA})`,
      }).name,
    ).toBe("Notes");
  });

  it("answers CONFLICT on a stale folder version and keeps the other edit", () => {
    const sales = folder("Sales");
    world.ok(OWNER, "folder.rename", {
      folderId: sales.id,
      name: "Sales EU",
      baseVersion: 1,
    });
    const response = world.call(OWNER, "folder.rename", {
      folderId: sales.id,
      name: "Sales US",
      baseVersion: 1,
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", details: { currentVersion: 2 } },
    });
    expect(fileIndex().folders.find((f) => f.id === sales.id)?.name).toBe(
      "Sales EU",
    );
  });
});

describe("grants", () => {
  it("lists inherited grants with the source folder path", () => {
    const sales = folder("Sales");
    const quotes = folder("Quotes", sales.id);
    grant(sales.id, ANA, "edit");
    grant(quotes.id, "example.com", "use", "domain");
    grant(quotes.id, "/field", "use", "ou");
    const { grants } = world.ok<{
      grants: {
        principalKey: string;
        inherited: boolean;
        sourcePath: string;
        active: boolean;
      }[];
    }>(OWNER, "grant.list", { folderId: quotes.id });
    expect(
      grants.map((g) => [g.principalKey, g.inherited, g.sourcePath, g.active]),
    ).toEqual([
      ["example.com", false, "/Sales/Quotes", true],
      ["/field", false, "/Sales/Quotes", false],
      [ANA, true, "/Sales", true],
    ]);
  });

  it("names parent folders only as far as a manage holder can see them; admins see the full path", () => {
    const sales = folder("Sales");
    const quotes = folder("Quotes", sales.id);
    const deals = folder("Deals", quotes.id);
    grant(sales.id, BOB, "use");
    grant(quotes.id, ANA, "manage");
    const sources = (caller: string) =>
      world
        .ok<{ grants: { principalKey: string; sourcePath: string }[] }>(
          caller,
          "grant.list",
          { folderId: deals.id },
        )
        .grants.map((g) => [g.principalKey, g.sourcePath]);
    expect(sources(ANA)).toEqual([
      [ANA, "/Quotes"],
      [BOB, ""],
    ]);
    expect(JSON.stringify(sources(ANA))).not.toContain("Sales");
    expect(sources(OWNER)).toEqual([
      [ANA, "/Sales/Quotes"],
      [BOB, "/Sales"],
    ]);
  });

  it("validates a group through the resolver and logs the folder, not the principal", () => {
    const sales = folder("Sales");
    world.lines.length = 0;
    expect(
      codeOf(OWNER, "grant.add", {
        folderId: sales.id,
        principalType: "group",
        principalKey: "nobody@example.com",
        level: "use",
      }),
    ).toBe("VALIDATION");
    world.groups.groups.set("sales@example.com", { users: [ANA] });
    grant(sales.id, "sales@example.com", "use", "group");
    const line = JSON.parse(world.lines.at(-1) ?? "{}") as Record<
      string,
      unknown
    >;
    expect(line).toMatchObject({ action: "grant.add", targetId: sales.id });
    expect(world.lines.join("\n")).not.toContain("sales@example.com");
    expect(world.lines.join("\n")).not.toContain("nobody@example.com");
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "grant.add",
      before: null,
      after: { principalKey: "sales@example.com" },
    });
    expect(codeOf(ANA, "template.list")).toBe("ok");
  });

  it.each([
    ["group", `${"a".repeat(250)}@example.com`],
    ["user", `${"a".repeat(250)}@example.com`],
    ["domain", `${"a".repeat(250)}.example.com`],
    ["ou", `/${"a".repeat(254)}`],
  ])(
    "refuses a %s principal key over PRINCIPAL_KEY_MAX and stores nothing",
    (principalType, principalKey) => {
      const sales = folder("Sales");
      grant(sales.id, ANA, "manage");
      expect(principalKey.length).toBeGreaterThan(PRINCIPAL_KEY_MAX);
      // The group exists, so only the length rule can refuse it.
      world.groups.groups.set(principalKey, { users: [BOB] });
      const response = world.call(ANA, "grant.add", {
        folderId: sales.id,
        principalType,
        principalKey,
        level: "use",
      });
      expect(response).toMatchObject({
        ok: false,
        error: { code: "VALIDATION" },
      });
      expect(fileIndex().grants).toHaveLength(1);
    },
  );

  it("accepts a key of exactly PRINCIPAL_KEY_MAX characters", () => {
    const sales = folder("Sales");
    const key = `/${"a".repeat(PRINCIPAL_KEY_MAX - 1)}`;
    expect(grant(sales.id, key, "use", "ou").principalKey).toBe(key);
  });

  it("answers NOT_FOUND when the grant was removed by someone else", () => {
    const sales = folder("Sales");
    const added = grant(sales.id, ANA, "use");
    world.ok(OWNER, "grant.remove", { grantId: added.id });
    expect(codeOf(OWNER, "grant.remove", { grantId: added.id })).toBe(
      "NOT_FOUND",
    );
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "grant.remove",
      before: { id: added.id },
      after: null,
    });
  });

  it("keeps a user outside the granted group from seeing or using the folder (DoD 3)", () => {
    const sales = folder("Sales");
    const item = template(sales.id);
    world.groups.groups.set("sales@example.com", { users: [ANA] });
    grant(sales.id, "sales@example.com", "use", "group");
    expect(
      world.ok<{ items: Item[] }>(ANA, "template.list").items.map((i) => i.id),
    ).toEqual([item.id]);
    expect(world.ok<{ items: Item[] }>(BOB, "template.list").items).toEqual([]);
    expect(
      world
        .ok<{ folders: Folder[] }>(BOB, "folder.list")
        .folders.map((f) => f.id),
    ).not.toContain(sales.id);
    expect(codeOf(BOB, "template.get", { id: item.id })).toBe("DENIED");
    expect(codeOf(BOB, "template.apply", { id: item.id }, "addon")).toBe(
      "DENIED",
    );
  });
});

describe("memberships", () => {
  it("reports counts and child groups, never member addresses", () => {
    world.groups.groups.set("admins@example.com", { users: [OWNER] });
    world.groups.groups.set("sales@example.com", {
      users: [ANA, BOB],
      groups: ["emea@example.com"],
    });
    world.props.setProperty("ADMIN_GROUP", "admins@example.com");
    const sales = folder("Sales");
    grant(sales.id, "sales@example.com", "use", "group");
    const refreshed = world.ok<{
      resolver: string;
      nested: boolean;
      refreshedAt: string;
      groups: unknown[];
      warnings: string[];
    }>(OWNER, "membership.refresh");
    expect(refreshed).toMatchObject({
      resolver: "groupsapp_direct",
      nested: false,
      groups: [
        {
          group: "admins@example.com",
          members: 1,
          childGroups: [],
          status: "ok",
        },
        {
          group: "sales@example.com",
          members: 2,
          childGroups: ["emea@example.com"],
          status: "ok",
        },
      ],
    });
    expect(refreshed.warnings[0]).toContain("emea@example.com");
    const status = world.ok<typeof refreshed>(OWNER, "membership.status");
    expect(status).toEqual(refreshed);
    expect(JSON.stringify(status)).not.toContain(ANA);
  });
});

describe("trash", () => {
  it("restores into another folder when the original folder was deleted", () => {
    const sales = folder("Sales");
    const quotes = folder("Quotes", sales.id);
    const other = folder("Other", sales.id);
    const hr = folder("HR");
    grant(sales.id, ANA, "edit");
    const item = template(quotes.id);
    world.ok(ANA, "template.delete", { id: item.id });
    world.ok(OWNER, "folder.delete", { folderId: quotes.id });
    const rows = world.ok<{
      items: (Item & { folderLive: boolean; folderPath: string })[];
    }>(ANA, "template.list", { trash: true }).items;
    expect(rows.map((row) => [row.id, row.folderLive, row.folderPath])).toEqual(
      [[item.id, false, "/Sales/Quotes"]],
    );
    expect(codeOf(ANA, "template.restoreFromTrash", { id: item.id })).toBe(
      "NOT_FOUND",
    );
    expect(
      codeOf(ANA, "template.restoreFromTrash", {
        id: item.id,
        folderId: hr.id,
      }),
    ).toBe("DENIED");
    const restored = world.ok<Item>(ANA, "template.restoreFromTrash", {
      id: item.id,
      folderId: other.id,
    });
    expect(restored).toMatchObject({ folderId: other.id, deletedAt: "" });
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "template.restoreFromTrash",
      before: { folderId: quotes.id },
      after: { folderId: other.id },
    });
  });

  describe("another user's private folder (ADR-0003 Part C: admin = manage everywhere)", () => {
    function setup() {
      const anas = world
        .ok<{ folders: Folder[] }>(ANA, "folder.list")
        .folders.find((entry) => entry.kind === "private") as Folder;
      const sales = folder("Sales");
      grant(sales.id, BOB, "edit");
      const shared = template(sales.id);
      const own = world.ok<Item>(ANA, "template.create", {
        folderId: anas.id,
        title: "Mine",
        html: "",
      });
      return { anas, sales, shared, own };
    }

    it("lets an admin restore, move, duplicate into it and update a template there", () => {
      const { anas, shared, own } = setup();
      world.ok(OWNER, "template.delete", { id: shared.id });
      expect(
        world.ok<Item>(OWNER, "template.restoreFromTrash", {
          id: shared.id,
          folderId: anas.id,
        }).folderId,
      ).toBe(anas.id);
      const other = template(folder("HR").id);
      expect(
        world.ok<Item>(OWNER, "template.move", {
          id: other.id,
          folderId: anas.id,
        }).folderId,
      ).toBe(anas.id);
      expect(
        world.ok<Item>(OWNER, "template.duplicate", {
          id: other.id,
          folderId: anas.id,
        }).folderId,
      ).toBe(anas.id);
      expect(
        world.ok<Item>(OWNER, "template.update", {
          id: own.id,
          baseVersion: 1,
          title: "Edited by admin",
          html: "<p>x</p>",
        }).title,
      ).toBe("Edited by admin");
    });

    it("answers DENIED to a caller who is neither the owner nor an admin", () => {
      const { anas, shared, own } = setup();
      world.ok(BOB, "template.delete", { id: shared.id });
      const into = { folderId: anas.id };
      expect(
        codeOf(BOB, "template.restoreFromTrash", { id: shared.id, ...into }),
      ).toBe("DENIED");
      world.ok(BOB, "template.restoreFromTrash", { id: shared.id });
      expect(codeOf(BOB, "template.move", { id: shared.id, ...into })).toBe(
        "DENIED",
      );
      expect(
        codeOf(BOB, "template.duplicate", { id: shared.id, ...into }),
      ).toBe("DENIED");
      expect(
        codeOf(BOB, "template.create", { ...into, title: "X", html: "" }),
      ).toBe("DENIED");
      expect(
        codeOf(BOB, "template.update", {
          id: own.id,
          baseVersion: 1,
          title: "Bob",
          html: "",
        }),
      ).toBe("DENIED");
      expect(
        world
          .ok<{ folders: Folder[] }>(BOB, "folder.list")
          .folders.map((entry) => entry.id),
      ).not.toContain(anas.id);
    });

    it("keeps edit for the owner, and nothing above it", () => {
      const { anas, own } = setup();
      expect(
        world.ok<Item>(ANA, "template.update", {
          id: own.id,
          baseVersion: 1,
          title: "Mine 2",
          html: "",
        }).title,
      ).toBe("Mine 2");
      expect(
        world
          .ok<{ folders: (Folder & { level: string })[] }>(ANA, "folder.list")
          .folders.find((entry) => entry.id === anas.id)?.level,
      ).toBe("edit");
      expect(
        codeOf(ANA, "folder.create", { parentId: anas.id, name: "Sub" }),
      ).toBe("DENIED");
    });
  });

  it("purges every trashed template now, with audit events by the admin", () => {
    const sales = folder("Sales");
    const kept = template(sales.id, "Kept");
    const gone = template(sales.id, "Gone");
    world.ok(OWNER, "template.delete", { id: gone.id });
    expect(world.ok<{ purged: number }>(OWNER, "trash.purge").purged).toBe(1);
    expect(fileIndex().items.map((i) => i.id)).toEqual([kept.id]);
    expect(world.drive.files.get(gone.bodyFileId)?.trashed).toBe(true);
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "trash.purge",
      actor: OWNER,
      targetId: gone.id,
    });
    expect(world.ok<{ purged: number }>(OWNER, "trash.purge").purged).toBe(0);
  });

  it(`trashes at most ${String(PURGE_FILES_MAX)} body files per purge and leaves the rest to the daily orphan cleanup`, () => {
    const sales = folder("Sales");
    const items = Array.from({ length: PURGE_FILES_MAX + 3 }, (_, n) =>
      template(sales.id, `T${String(n)}`),
    );
    for (const item of items)
      world.ok(OWNER, "template.delete", { id: item.id });
    const files = () =>
      items.filter(
        (item) => world.drive.files.get(item.bodyFileId)?.trashed === true,
      ).length;
    expect(world.ok(OWNER, "trash.purge")).toEqual({
      purged: PURGE_FILES_MAX + 3,
      filesTrashed: PURGE_FILES_MAX,
      itemsPending: 3,
    });
    expect(files()).toBe(PURGE_FILES_MAX);
    world.clock.now += 2 * 60 * 60 * 1000;
    runDaily(world.services);
    expect(files()).toBe(PURGE_FILES_MAX + 3);
  });

  it("re-checks the admin inside the lock: an admin removed meanwhile purges nothing", () => {
    const sales = folder("Sales");
    const gone = template(sales.id);
    world.ok(OWNER, "template.delete", { id: gone.id });
    const response = racing(OWNER, "trash.purge", {}, () => {
      world.props.setProperty(ADMIN_EMAILS_KEY, "someone@example.com");
    });
    expect(response).toMatchObject({ ok: false, error: { code: "DENIED" } });
    expect(fileIndex().items.map((i) => i.id)).toEqual([gone.id]);
    expect(readBuffer(world.cache).events.at(-1)).toMatchObject({
      kind: "denied",
      event: { action: "trash.purge", actor: OWNER },
    });
  });
});

/** Runs `op`; `race` runs once, right before the request's write lock. */
function racing(
  caller: string,
  op: string,
  args: unknown,
  race: () => void,
): RpcResponse {
  const services = world.as("webapp");
  let armed = true;
  const lock = {
    tryLock: (ms: number) => {
      if (armed && ms === WRITE_LOCK_MS) {
        armed = false;
        race();
      }
      return world.lock.tryLock(ms);
    },
    releaseLock: () => {
      world.lock.releaseLock();
    },
  };
  return handleRpc(
    { email: caller },
    { op, args, requestId: "TESTREQ0-000001", clientVersion: "t" },
    "webapp",
    { services: { ...services, lock } },
  );
}
