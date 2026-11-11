/**
 * Admin settings (D29, ADR-0008, spec 5.8): `config.set`, the defaults, and every row of the spec 5.8 enforcement
 * table of `personalTemplates` for owner, admin and another user, with the switch on and off.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, IndexDoc, Item } from "../../../src/shared/model/data";
import type { SidebarHome } from "../../../src/shared/model/sidebar";
import { runSetup } from "../../../src/server/jobs/setup";
import { runDaily } from "../../../src/server/jobs/daily";
import { runTick } from "../../../src/server/jobs/tick";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
const OFF_TEXT = "Personal templates are turned off by your admin.";
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

function errorOf(
  caller: string,
  op: string,
  args: unknown = {},
): { code: string; message: string; details?: unknown } {
  const response = world.call(caller, op, args);
  return response.ok ? { code: "ok", message: "" } : response.error;
}

const set = (value: string, from: string, name = "personalTemplates") => ({
  name,
  value,
  from,
});

describe("defaults and storage", () => {
  it("setup writes no settings, a second setup keeps an admin's choice, reads write nothing", () => {
    expect(fileIndex().settings).toBeUndefined();
    const rev = fileIndex().rev;
    expect(world.ok(OWNER, "config.get")).toMatchObject({
      settings: {
        personalTemplates: { value: "off", updatedAt: "", updatedBy: "" },
        recipientsExternal: { value: "allow", updatedAt: "", updatedBy: "" },
      },
    });
    expect(world.ok(ANA, "me")).toMatchObject({
      personalTemplates: "off",
      recipientsExternal: "allow",
    });
    expect(world.ok<SidebarHome>(ANA, "sidebar.home").personalTemplates).toBe(
      "off",
    );
    world.ok(ANA, "folder.list");
    expect(fileIndex().rev).toBe(rev);
    expect(fileIndex().settings).toBeUndefined();
    setSetting(world, "personalTemplates", "on");
    runSetup(world.services);
    expect(fileIndex().settings?.personalTemplates?.value).toBe("on");
  });

  it("backup.restore keeps the live settings", () => {
    runDaily(world.services);
    setSetting(world, "recipientsExternal", "deny");
    world.ok(OWNER, "backup.restore", {
      date: new Date(world.clock.now).toISOString().slice(0, 10),
    });
    expect(fileIndex().settings?.recipientsExternal?.value).toBe("deny");
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "backup.restore",
    });
  });
});

describe("config.set", () => {
  it("changes a setting with one commit, one audit event and a log line without the value", () => {
    const rev = fileIndex().rev;
    world.lines.length = 0;
    const result = world.ok(OWNER, "config.set", set("on", "off"));
    expect(result).toEqual({
      name: "personalTemplates",
      value: "on",
      updatedAt: "2026-11-09T12:00:00.000Z",
      updatedBy: OWNER,
      changed: true,
    });
    const index = fileIndex();
    expect(index.rev).toBe(rev + 1);
    expect(index.settings).toEqual({
      personalTemplates: {
        value: "on",
        updatedAt: "2026-11-09T12:00:00.000Z",
        updatedBy: OWNER,
      },
    });
    expect(index.pendingAudit.at(-1)).toMatchObject({
      action: "config.set",
      targetType: "config",
      targetId: "personalTemplates",
      targetPath: "",
      before: { name: "personalTemplates", value: "off" },
      after: { name: "personalTemplates", value: "on" },
      actor: OWNER,
    });
    const line = world.lines.at(-1) ?? "";
    expect(JSON.parse(line)).toMatchObject({
      action: "config.set",
      targetId: "",
      result: "ok",
    });
    expect(line).not.toMatch(/"on"|personalTemplates/);
    expect(world.ok(ANA, "me")).toMatchObject({ personalTemplates: "on" });
  });

  it("answers changed: false and writes nothing when the value is already set", () => {
    const before = JSON.stringify(fileIndex());
    expect(world.ok(OWNER, "config.set", set("off", "on"))).toMatchObject({
      value: "off",
      changed: false,
      updatedBy: "",
    });
    expect(JSON.stringify(fileIndex())).toBe(before);
  });

  it("answers CONFLICT with the current entry when another admin changed it first", () => {
    setSetting(world, "personalTemplates", "on");
    const before = JSON.stringify(fileIndex());
    world.lines.length = 0;
    const error = errorOf(OWNER, "config.set", {
      ...set("on", "off"),
      value: "off",
      from: "off",
    });
    expect(error).toMatchObject({
      code: "CONFLICT",
      message:
        "owner changed this setting. The page now shows the current value.",
      details: {
        name: "personalTemplates",
        value: "on",
        updatedBy: OWNER,
      },
    });
    expect(JSON.stringify(fileIndex())).toBe(before);
    expect(JSON.parse(world.lines.at(-1) ?? "{}")).toMatchObject({
      result: "conflict",
    });
  });

  it("answers VALIDATION for an unknown name, value, from, a missing or an extra arg", () => {
    const cases: [unknown, string][] = [
      [set("on", "off", "imgHosts"), "Setting imgHosts does not exist."],
      [{ value: "on", from: "off" }, "Setting  does not exist."],
      [set("yes", "off"), "Setting personalTemplates takes on or off."],
      [set("on", "allow"), "Setting personalTemplates takes on or off."],
      [
        { name: "personalTemplates", value: "on" },
        "Setting personalTemplates takes on or off.",
      ],
      [
        { ...set("on", "off"), extra: 1 },
        "Setting personalTemplates takes on or off.",
      ],
      [
        set("on", "off", "recipientsExternal"),
        "Setting recipientsExternal takes allow or deny.",
      ],
    ];
    for (const [args, message] of cases)
      expect(errorOf(OWNER, "config.set", args)).toMatchObject({
        code: "VALIDATION",
        message,
      });
    expect(fileIndex().settings).toBeUndefined();
  });

  it("refuses non-admins and the add-on surface", () => {
    expect(errorOf(ANA, "config.set", set("on", "off")).code).toBe("DENIED");
    const response = world.call(OWNER, "config.set", set("on", "off"), "addon");
    expect(response.ok ? "ok" : response.error.code).toBe("DENIED");
    expect(fileIndex().settings).toBeUndefined();
  });
});

/** Fixture built with personal templates on; the test then sets the mode. */
interface Fixture {
  readonly anas: Folder;
  readonly sub: Folder;
  readonly sales: Folder;
  readonly own: Item;
  readonly gone: Item;
  readonly shared: Item;
}

function fixture(): Fixture {
  setSetting(world, "personalTemplates", "on");
  const sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
  for (const who of [ANA, BOB])
    world.ok(OWNER, "grant.add", {
      folderId: sales.id,
      principalType: "user",
      principalKey: who,
      level: "edit",
    });
  const anas = world
    .ok<{ folders: Folder[] }>(ANA, "folder.list")
    .folders.find((folder) => folder.kind === "private") as Folder;
  const sub = world.ok<Folder>(OWNER, "folder.create", {
    parentId: anas.id,
    name: "Sub",
  });
  const own = world.ok<Item>(ANA, "template.create", {
    folderId: anas.id,
    title: "Mine",
    html: "<p>own words</p>",
  });
  world.ok(ANA, "template.update", {
    id: own.id,
    baseVersion: 1,
    title: "Mine",
    html: "<p>own words 2</p>",
  });
  const gone = world.ok<Item>(ANA, "template.create", {
    folderId: anas.id,
    title: "Gone",
    html: "<p>g</p>",
  });
  world.ok(ANA, "template.delete", { id: gone.id });
  const shared = world.ok<Item>(OWNER, "template.create", {
    folderId: sales.id,
    title: "Shared",
    html: "<p>s</p>",
  });
  return { anas, sub, sales, own, gone, shared };
}

type Case = (f: Fixture) => [string, unknown];
/** Expected code for [owner, admin, other user]. */
type Row = readonly [string, string, string];

const CASES: Readonly<Record<string, Case>> = {
  "folder.list": () => ["folder.list", {}],
  "sidebar.home": () => ["sidebar.home", {}],
  "template.list": () => ["template.list", {}],
  search: () => ["search", { query: "mine" }],
  "search.body": () => ["search.body", { query: "own" }],
  "template.get": (f) => ["template.get", { id: f.own.id }],
  "template.getBody": (f) => ["template.getBody", { id: f.own.id }],
  "template.apply": (f) => [
    "template.apply",
    { id: f.own.id, knownVersion: 0 },
  ],
  "favorite.set": (f) => ["favorite.set", { id: f.own.id }],
  "favorite.unset": (f) => ["favorite.unset", { id: f.own.id }],
  "template.create": (f) => [
    "template.create",
    { folderId: f.anas.id, title: "New", html: "<p>n</p>" },
  ],
  "template.update": (f) => [
    "template.update",
    { id: f.own.id, baseVersion: 2, title: "Changed", html: "<p>c</p>" },
  ],
  "template.duplicate (inside)": (f) => [
    "template.duplicate",
    { id: f.own.id },
  ],
  "template.duplicate (out)": (f) => [
    "template.duplicate",
    { id: f.own.id, folderId: f.sales.id },
  ],
  "template.duplicate (in)": (f) => [
    "template.duplicate",
    { id: f.shared.id, folderId: f.anas.id },
  ],
  "template.delete": (f) => ["template.delete", { id: f.own.id }],
  "template.restoreFromTrash": (f) => [
    "template.restoreFromTrash",
    { id: f.gone.id },
  ],
  "template.move (out)": (f) => [
    "template.move",
    { id: f.own.id, folderId: f.sales.id },
  ],
  "template.move (in)": (f) => [
    "template.move",
    { id: f.shared.id, folderId: f.anas.id },
  ],
  "version.list": (f) => ["version.list", { id: f.own.id }],
  "version.get": (f) => ["version.get", { id: f.own.id, version: 1 }],
  "version.restore": (f) => [
    "version.restore",
    { id: f.own.id, version: 1, baseVersion: 2 },
  ],
  "folder.create (sub)": (f) => [
    "folder.create",
    { parentId: f.anas.id, name: "New" },
  ],
  "folder.rename": (f) => ["folder.rename", { folderId: f.sub.id, name: "R" }],
  "folder.move": (f) => [
    "folder.move",
    { folderId: f.sub.id, parentId: f.sales.id },
  ],
  "folder.delete": (f) => ["folder.delete", { folderId: f.sub.id }],
  "grant.list": (f) => ["grant.list", { folderId: f.anas.id }],
  "export.folder": (f) => ["export.folder", { folderId: f.anas.id }],
  "export.library": () => ["export.library", {}],
  import: (f) => [
    "import",
    {
      folderId: f.anas.id,
      file: JSON.stringify({
        schemaVersion: 1,
        folders: [],
        items: [{ meta: { title: "I" }, html: "<p>i</p>" }],
      }),
    },
  ],
  "admin.folders": () => ["admin.folders", {}],
  "trash.purge": () => ["trash.purge", {}],
  me: () => ["me", {}],
};

const ALL: Row = ["ok", "ok", "ok"];
const READ: Row = ["ok", "ok", "DENIED"];
const NOBODY: Row = ["DENIED", "DENIED", "DENIED"];
const WRITE_ON: Row = ["ok", "ok", "DENIED"];
const MANAGE_ON: Row = ["DENIED", "ok", "DENIED"];
const ADMIN: Row = ["DENIED", "ok", "DENIED"];

/** Spec 5.8 table: [on, off]. */
const EXPECTED: Readonly<Record<string, readonly [Row, Row]>> = {
  "folder.list": [ALL, ALL],
  "sidebar.home": [ALL, ALL],
  "template.list": [ALL, ALL],
  search: [ALL, ALL],
  "search.body": [ALL, ALL],
  "template.get": [READ, READ],
  "template.getBody": [READ, READ],
  "template.apply": [READ, READ],
  "favorite.set": [READ, READ],
  "favorite.unset": [READ, READ],
  "template.create": [WRITE_ON, NOBODY],
  "template.update": [WRITE_ON, NOBODY],
  "template.duplicate (inside)": [WRITE_ON, NOBODY],
  "template.duplicate (out)": [WRITE_ON, NOBODY],
  "template.duplicate (in)": [WRITE_ON, NOBODY],
  "template.delete": [WRITE_ON, NOBODY],
  "template.restoreFromTrash": [WRITE_ON, NOBODY],
  "template.move (out)": [WRITE_ON, NOBODY],
  "template.move (in)": [WRITE_ON, NOBODY],
  "version.list": [WRITE_ON, NOBODY],
  "version.get": [WRITE_ON, NOBODY],
  "version.restore": [WRITE_ON, NOBODY],
  "folder.create (sub)": [MANAGE_ON, NOBODY],
  "folder.rename": [MANAGE_ON, NOBODY],
  "folder.move": [["DENIED", "VALIDATION", "DENIED"], NOBODY],
  "folder.delete": [MANAGE_ON, NOBODY],
  "grant.list": [MANAGE_ON, NOBODY],
  "export.folder": [MANAGE_ON, NOBODY],
  "export.library": [ADMIN, ADMIN],
  import: [
    ["DENIED", "VALIDATION", "DENIED"],
    ["DENIED", "VALIDATION", "DENIED"],
  ],
  "admin.folders": [ADMIN, ADMIN],
  "trash.purge": [ADMIN, ADMIN],
  me: [ALL, ALL],
};

const CALLERS = [ANA, OWNER, BOB] as const;
const cases = Object.keys(CASES).flatMap((name) =>
  (["on", "off"] as const).flatMap((mode, m) =>
    CALLERS.map(
      (caller, c) =>
        [name, mode, caller, EXPECTED[name]?.[m]?.[c] ?? "missing"] as const,
    ),
  ),
);

describe("personal templates switch: spec 5.8 enforcement table", () => {
  it.each(cases)("%s, %s, %s: %s", (name, mode, caller, expected) => {
    const f = fixture();
    setSetting(world, "personalTemplates", mode);
    const [op, args] = (CASES[name] as Case)(f);
    const error = errorOf(caller, op, args);
    expect(error.code).toBe(expected);
    const onCode = EXPECTED[name]?.[0]?.[CALLERS.indexOf(caller)];
    if (mode === "off" && expected === "DENIED" && onCode !== "DENIED")
      expect(error.message).toBe(OFF_TEXT);
  });

  it("covers every op of the policy table that touches folders", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(CASES).sort());
  });
});

describe("personal templates off: what each caller sees", () => {
  it("lists the owner's folder and templates at use, for search, sidebar, favorites and Recent", () => {
    const f = fixture();
    world.ok(ANA, "favorite.set", { id: f.own.id });
    world.ok(ANA, "template.apply", { id: f.own.id, knownVersion: 0 });
    runTick(world.services);
    setSetting(world, "personalTemplates", "off");
    const folders = world.ok<{ folders: (Folder & { level: string })[] }>(
      ANA,
      "folder.list",
    ).folders;
    expect(folders.find((x) => x.id === f.anas.id)?.level).toBe("use");
    const list = world.ok<{ items: (Item & { level?: string })[] }>(
      ANA,
      "template.list",
    );
    expect(list.items.map((i) => i.id)).toContain(f.own.id);
    const home = world.ok<SidebarHome>(ANA, "sidebar.home");
    expect(home.folders.map((x) => x.id)).toContain(f.anas.id);
    expect(home.favorites).toEqual([f.own.id]);
    expect(home.recent).toEqual([f.own.id]);
    expect(home.templates.find((t) => t.id === f.own.id)?.level).toBe("use");
    expect(
      world
        .ok<{ results: { id: string }[] }>(ANA, "search", { query: "mine" })
        .results.map((r) => r.id),
    ).toEqual([f.own.id]);
    const trash = world.ok<{ items: Item[] }>(ANA, "template.list", {
      trash: true,
    });
    expect(trash.items.map((i) => i.id)).not.toContain(f.gone.id);
  });

  it("lets an admin read other users' private folders in the library at use; the sidebar keeps hiding them", () => {
    const f = fixture();
    setSetting(world, "personalTemplates", "off");
    const folders = world.ok<{ folders: (Folder & { level: string })[] }>(
      OWNER,
      "folder.list",
    ).folders;
    expect(folders.find((x) => x.id === f.anas.id)?.level).toBe("use");
    expect(folders.find((x) => x.id === f.sales.id)?.level).toBe("manage");
    expect(
      world.ok<SidebarHome>(OWNER, "sidebar.home").folders.map((x) => x.id),
    ).not.toContain(f.anas.id);
    expect(
      world
        .ok<{ folders: Folder[] }>(BOB, "folder.list")
        .folders.map((x) => x.id),
    ).not.toContain(f.anas.id);
  });

  it("creates no private folder while off, one after on; turning on again loses nothing", () => {
    const f = fixture();
    const before = JSON.stringify(fileIndex().items);
    setSetting(world, "personalTemplates", "off");
    const rev = fileIndex().rev;
    const bobs = () =>
      world
        .ok<{ folders: Folder[] }>(BOB, "folder.list")
        .folders.filter((x) => x.kind === "private");
    expect(bobs()).toEqual([]);
    expect(fileIndex().rev).toBe(rev);
    expect(world.ok<SidebarHome>(BOB, "sidebar.home").personalTemplates).toBe(
      "off",
    );
    setSetting(world, "personalTemplates", "on");
    expect(bobs()).toHaveLength(1);
    expect(JSON.stringify(fileIndex().items)).toBe(before);
    expect(
      world.ok<Item>(ANA, "template.update", {
        id: f.own.id,
        baseVersion: 2,
        title: "Mine",
        html: "<p>3</p>",
      }).currentVersion,
    ).toBe(3);
    expect(fileIndex().folders.filter((x) => x.deletedAt === "")).toHaveLength(
      4,
    );
  });
});
