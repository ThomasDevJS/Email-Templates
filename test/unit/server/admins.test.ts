/**
 * In-app admins (D32, slice 16; spec 5.8, 6, 11.1, 13.10; ADR-0003 and ADR-0008 Amendments 2026-11-11). Security
 * cases first: who may call, each refusal with its own code and nothing written, the in-lock re-check, then audit,
 * timing, writers that must keep the list, restore and config.get.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Folder, IndexDoc, Item } from "../../../src/shared/model/data";
import type { AdminEntry } from "../../../src/shared/model/admins";
import type { Surface } from "../../../src/shared/log/logger";
import { readBuffer } from "../../../src/server/audit/buffer";
import type { ConfigView } from "../../../src/server/handlers/config";
import {
  directoryStatus,
  editedList,
} from "../../../src/server/handlers/admins";
import { runDaily } from "../../../src/server/jobs/daily";
import { refreshSnapshot } from "../../../src/server/membership/snapshot";
import { loadIndex } from "../../../src/server/cache/indexCache";
import { mutateIndex } from "../../../src/server/storage/writer";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
const CARL = "carl@example.com";
const GROUPIE = "groupie@example.com";
const ADMIN_GROUP = "admins@example.com";
const FORMAT = "Enter an email address, for example name@example.com.";
const OUTSIDE = "Only example.com addresses can be admins.";
const NO_ACCOUNT =
  "No example.com account has this address. A group goes in the admin group the owner sets.";

let world: World;
let propertyWrites: string[];

/** A Directory user whose primary address is `primary`, found under `key` (an alias when they differ). */
function person(key: string, primary = key): void {
  world.directory.users.set(key, { primaryEmail: primary });
}

beforeEach(() => {
  world = setupWorld();
  for (const who of [ANA, BOB, CARL, GROUPIE]) person(who);
  world.groups.groups.set(ADMIN_GROUP, { users: [GROUPIE] });
  world.props.setProperty("ADMIN_GROUP", ADMIN_GROUP);
  refreshSnapshot(world.services, loadIndex(world.services));
  propertyWrites = [];
  const set = world.props.setProperty.bind(world.props);
  vi.spyOn(world.props, "setProperty").mockImplementation((key, value) => {
    propertyWrites.push(key);
    return set(key, value);
  });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
  // Criterion 8: no op writes the break-glass or the group property.
  expect(propertyWrites).not.toContain("ADMIN_EMAILS");
  expect(propertyWrites).not.toContain("ADMIN_GROUP");
});

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

function listed(): string[] {
  return ((fileIndex().admins ?? []) as AdminEntry[]).map((e) => e.email);
}

function errorOf(
  caller: string,
  op: string,
  args: unknown,
  surface: Surface = "webapp",
): { code: string; message: string; details?: unknown } {
  const response = world.call(caller, op, args, surface);
  return response.ok ? { code: "ok", message: "" } : response.error;
}

const add = (caller: string, email: string) =>
  world.ok<{ admins: AdminEntry[]; changed: boolean }>(caller, "admin.add", {
    email,
  });
const remove = (caller: string, email: string) =>
  world.ok<{ admins: AdminEntry[]; changed: boolean }>(caller, "admin.remove", {
    email,
  });

/** Runs `before` once, right before the next script lock is taken: another request that wins the lock first. */
function beforeNextLock(before: () => void): void {
  const tryLock = world.lock.tryLock.bind(world.lock);
  let pending = true;
  world.lock.tryLock = (ms: number) => {
    if (pending) {
      pending = false;
      before();
    }
    return tryLock(ms);
  };
}

function deniedRows(): number {
  return readBuffer(world.cache).events.filter((e) => e.kind === "denied")
    .length;
}

/** `calls` of the last log line. */
function lastCalls(): { drive: number } {
  return (
    JSON.parse(world.lines.at(-1) ?? "{}") as { calls: { drive: number } }
  ).calls;
}

describe("role matrix of admin.add and admin.remove (criterion 3)", () => {
  type Role = "inApp" | "breakGlass" | "group" | "manage" | "user" | "removed";
  const ROLES: Readonly<Record<Role, () => string>> = {
    inApp: () => {
      add(OWNER, BOB);
      return BOB;
    },
    breakGlass: () => OWNER,
    group: () => GROUPIE,
    manage: () => {
      const sales = world.ok<Folder>(OWNER, "folder.create", { name: "S" });
      world.ok(OWNER, "grant.add", {
        folderId: sales.id,
        principalType: "user",
        principalKey: BOB,
        level: "manage",
      });
      return BOB;
    },
    user: () => BOB,
    removed: () => {
      add(OWNER, BOB);
      remove(OWNER, BOB);
      return BOB;
    },
  };
  const EXPECTED: Readonly<Record<Role, string>> = {
    inApp: "ok",
    breakGlass: "ok",
    group: "ok",
    manage: "DENIED",
    user: "DENIED",
    removed: "DENIED",
  };
  const cases = (Object.keys(ROLES) as Role[]).flatMap((role) =>
    ["admin.add", "admin.remove"].map((op) => [op, role, EXPECTED[role]]),
  );

  it.each(cases)("%s as %s: %s", (op, role, expected) => {
    const caller = ROLES[role as Role]();
    if (op === "admin.remove") add(OWNER, CARL);
    const before = JSON.stringify(fileIndex());
    const directoryCalls = world.directory.calls.length;
    const denied = deniedRows();
    world.lines.length = 0;
    expect(errorOf(caller, op, { email: CARL }).code).toBe(expected);
    if (expected === "DENIED") {
      // Denied before any data access: no Drive read, no Directory call, nothing written, one denied row.
      expect(lastCalls().drive).toBe(0);
      expect(world.directory.calls.length).toBe(directoryCalls);
      expect(JSON.stringify(fileIndex())).toBe(before);
      expect(deniedRows()).toBe(denied + 1);
    } else {
      expect(listed().includes(CARL)).toBe(op === "admin.add");
    }
  });

  it("refuses both ops on the add-on surface, even for the owner", () => {
    add(OWNER, CARL);
    const before = JSON.stringify(fileIndex());
    for (const op of ["admin.add", "admin.remove"])
      expect(errorOf(OWNER, op, { email: CARL }, "addon").code).toBe("DENIED");
    expect(JSON.stringify(fileIndex())).toBe(before);
  });
});

describe("admin.add refusals (criterion 4): own code, check order, nothing written", () => {
  function refused(
    args: unknown,
    code: string,
    reason?: string,
    message?: string,
  ): void {
    const before = JSON.stringify(fileIndex());
    world.lines.length = 0;
    const error = errorOf(OWNER, "admin.add", args);
    expect(error.code).toBe(code);
    if (reason !== undefined) expect(error.details).toEqual({ reason });
    if (message !== undefined) expect(error.message).toBe(message);
    expect(JSON.stringify(fileIndex())).toBe(before);
  }

  it("ADMIN_FORMAT before the domain check, without a Directory call", () => {
    for (const email of ["", "name", "a..b@example.com", "x y@other.org"])
      refused({ email }, "VALIDATION", "ADMIN_FORMAT", FORMAT);
    refused(
      { email: `${"a".repeat(250)}@example.com` },
      "VALIDATION",
      "ADMIN_FORMAT",
    );
    expect(world.directory.calls).toEqual([]);
  });

  it("ADMIN_OUTSIDE for another domain or a subdomain, without a Directory call", () => {
    person("ana@other.org");
    for (const email of ["ana@other.org", "ana@sub.example.com"])
      refused({ email }, "VALIDATION", "ADMIN_OUTSIDE", OUTSIDE);
    expect(world.directory.calls).toEqual([]);
  });

  it("ADMIN_NO_ACCOUNT for an unknown address and a group address, after one Directory read", () => {
    for (const email of ["nobody@example.com", ADMIN_GROUP])
      refused({ email }, "VALIDATION", "ADMIN_NO_ACCOUNT", NO_ACCOUNT);
    expect(world.directory.calls).toEqual([
      {
        email: "nobody@example.com",
        options: { viewType: "domain_public", projection: "basic" },
      },
      {
        email: ADMIN_GROUP,
        options: { viewType: "domain_public", projection: "basic" },
      },
    ]);
  });

  it("ADMIN_OUTSIDE when an alias resolves to a primary address in another domain", () => {
    person("alias@example.com", "real@other.org");
    refused({ email: "alias@example.com" }, "VALIDATION", "ADMIN_OUTSIDE");
  });

  /** A Directory failure as the advanced service throws it: a message and `details.code`. */
  function directoryFails(message: string, code: number): void {
    world.directory.get = () => {
      throw Object.assign(new Error(`${message}: flaky@example.com`), {
        details: { code },
      });
    };
  }

  /** The Directory warn line: reason and status only, no address, no message text. */
  function directoryLine(): Record<string, unknown> {
    const line =
      world.lines.find((entry) => entry.includes("directory.users.get")) ?? "";
    expect(line).not.toContain("flaky");
    expect(line).not.toMatch(/unavailable|Resource/);
    return JSON.parse(line) as Record<string, unknown>;
  }

  it("SERVER (INTERNAL) with the 7.3 text and reason ADMIN_CHECK for any other Directory error", () => {
    directoryFails("Service unavailable", 503);
    refused(
      { email: "flaky@example.com" },
      "INTERNAL",
      "ADMIN_CHECK",
      "The address could not be checked. Try again.",
    );
    expect(directoryLine()).toMatchObject({
      level: "warn",
      action: "directory.users.get",
      errorCode: "ADMIN_CHECK:503",
      // Links the line to the admin.add line of the same request; no actor address (slice 16 retry 1 minor 1).
      requestId: "TESTREQ0-000001",
      actor: "",
    });
  });

  it("logs the status of a not-found answer; 0 when the error carries none", () => {
    directoryFails("Resource Not Found", 404);
    refused({ email: "flaky@example.com" }, "VALIDATION", "ADMIN_NO_ACCOUNT");
    expect(directoryLine()).toMatchObject({
      errorCode: "ADMIN_NO_ACCOUNT:404",
    });
    expect(directoryStatus(new Error("x"))).toBe(0);
    expect(directoryStatus({ details: { code: "404" } })).toBe(0);
    expect(directoryStatus(null)).toBe(0);
  });

  it("ADMIN_TOO_MANY for the 21st address, checked in the lock", () => {
    for (let n = 1; n <= 20; n++) {
      person(`p${String(n)}@example.com`);
      add(OWNER, `p${String(n)}@example.com`);
    }
    expect(listed()).toHaveLength(20);
    refused(
      { email: CARL },
      "VALIDATION",
      "ADMIN_TOO_MANY",
      "The list holds 20 admins. Remove one first.",
    );
    // A listed address at the cap is a repeat, not a refusal.
    expect(add(OWNER, "p1@example.com").changed).toBe(false);
  });

  it("VALIDATION for a missing, extra or malformed argument", () => {
    for (const args of [
      {},
      { email: CARL, extra: 1 },
      { email: 5 },
      { email: [CARL] },
      null,
      "carl@example.com",
    ])
      refused(args, "VALIDATION");
    for (const args of [{}, { email: CARL, id: "x" }, { email: null }])
      expect(errorOf(OWNER, "admin.remove", args).code).toBe("VALIDATION");
    expect(world.directory.calls).toEqual([]);
  });
});

describe("admin.add and admin.remove results", () => {
  it("adds trimmed, lower case, and stores the Directory primary address of an alias (criterion 5)", () => {
    person("carl.alias@example.com", "Carl@Example.com");
    const result = add(OWNER, "  CARL.Alias@Example.COM ");
    expect(result).toEqual({
      email: CARL,
      admins: [
        { email: CARL, addedAt: "2026-11-09T12:00:00.000Z", addedBy: OWNER },
      ],
      changed: true,
    });
    expect(world.directory.calls.at(-1)?.email).toBe("carl.alias@example.com");
    expect(listed()).toEqual([CARL]);
  });

  it("answers changed: false on a repeat add and on removing an unlisted address, no write, no event (criterion 6)", () => {
    add(OWNER, CARL);
    const before = JSON.stringify(fileIndex());
    expect(add(OWNER, CARL).changed).toBe(false);
    expect(add(OWNER, "Carl@example.com").changed).toBe(false);
    expect(remove(OWNER, BOB)).toMatchObject({ changed: false });
    expect(JSON.stringify(fileIndex())).toBe(before);
  });

  it("refuses self-removal with ADMIN_SELF, also for a break-glass admin (criterion 8)", () => {
    add(OWNER, CARL);
    const before = JSON.stringify(fileIndex());
    const error = errorOf(CARL, "admin.remove", { email: " Carl@Example.com" });
    expect(error).toMatchObject({
      code: "VALIDATION",
      message: "You cannot remove yourself. Ask another admin.",
      details: { reason: "ADMIN_SELF" },
    });
    expect(errorOf(OWNER, "admin.remove", { email: OWNER }).code).toBe(
      "VALIDATION",
    );
    expect(JSON.stringify(fileIndex())).toBe(before);
  });

  it("cannot remove a break-glass or group admin: they stay admin (spec 6)", () => {
    expect(remove(GROUPIE, OWNER).changed).toBe(false);
    expect(remove(OWNER, GROUPIE).changed).toBe(false);
    for (const who of [OWNER, GROUPIE])
      expect(world.ok<{ isAdmin: boolean }>(who, "me").isAdmin).toBe(true);
  });

  it('writes one audit event per change in the commit; the log line has targetId "" and no address (criterion 9)', () => {
    const rev = fileIndex().rev;
    world.lines.length = 0;
    add(OWNER, CARL);
    expect(fileIndex().rev).toBe(rev + 1);
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "admin.add",
      actor: OWNER,
      targetType: "admin",
      targetId: CARL,
      before: { email: CARL, admin: false },
      after: { email: CARL, admin: true },
      result: "ok",
    });
    const line = world.lines.at(-1) ?? "";
    expect(JSON.parse(line)).toMatchObject({
      action: "admin.add",
      targetId: "",
      result: "ok",
    });
    expect(line).not.toContain("carl");
    world.lines.length = 0;
    remove(OWNER, CARL);
    expect(fileIndex().rev).toBe(rev + 2);
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "admin.remove",
      targetId: CARL,
      before: { email: CARL, admin: true },
      after: { email: CARL, admin: false },
    });
    expect(world.lines.at(-1)).not.toContain("carl");
    const events = fileIndex().pendingAudit.filter((e) =>
      e.action.startsWith("admin."),
    );
    expect(events).toHaveLength(2);
  });
});

describe("in-lock re-check (criterion 7)", () => {
  it("refuses a caller removed between the dispatch check and the lock; nothing written", () => {
    add(OWNER, CARL);
    beforeNextLock(() => remove(OWNER, CARL));
    const error = errorOf(CARL, "admin.add", { email: BOB });
    expect(error.code).toBe("DENIED");
    expect(listed()).toEqual([]);
    expect(
      fileIndex().pendingAudit.filter((e) => e.action === "admin.add"),
    ).toHaveLength(1);
  });

  it("two admins removing each other leave one of them", () => {
    add(OWNER, BOB);
    add(OWNER, CARL);
    beforeNextLock(() => remove(BOB, CARL));
    expect(errorOf(CARL, "admin.remove", { email: BOB }).code).toBe("DENIED");
    expect(listed()).toEqual([BOB]);
  });

  it("refuses a removed admin's in-flight level-row writes in the lock: nothing written, one denied row (retry 1)", () => {
    const sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
    add(OWNER, CARL);
    const writes: [string, unknown][] = [
      [
        "grant.add",
        {
          folderId: sales.id,
          principalType: "user",
          principalKey: CARL,
          level: "manage",
        },
      ],
      ["template.create", { folderId: sales.id, title: "T", html: "<p>t</p>" }],
    ];
    for (const [op, args] of writes) {
      add(OWNER, CARL);
      beforeNextLock(() => remove(OWNER, CARL));
      const before = fileIndex().rev + 1;
      const denied = deniedRows();
      expect(errorOf(CARL, op, args).code).toBe("DENIED");
      expect(fileIndex().rev).toBe(before);
      expect(fileIndex().grants).toHaveLength(0);
      expect(fileIndex().items).toHaveLength(0);
      expect(deniedRows()).toBe(denied + 1);
    }
  });

  it("refuses, never writes an empty list, when the edit finds nothing to do on the list read for the write", () => {
    const stored = [{ email: CARL, addedAt: "t", addedBy: OWNER }];
    expect(() => editedList(stored, "example.com", () => null)).toThrow(
      expect.objectContaining({ code: "CONFLICT" }),
    );
    expect(editedList(stored, "example.com", (entries) => entries)).toEqual(
      stored,
    );
  });

  it("two concurrent adds both land", () => {
    add(OWNER, BOB);
    beforeNextLock(() => add(OWNER, ANA));
    add(BOB, CARL);
    expect(listed()).toEqual([BOB, ANA, CARL]);
  });
});

describe("timing and caches (criterion 10)", () => {
  it("an added person is admin on the next request; a removed one is DENIED on the next admin op", () => {
    expect(errorOf(CARL, "config.get", {}).code).toBe("DENIED");
    expect(world.ok<{ isAdmin: boolean }>(CARL, "me").isAdmin).toBe(false);
    add(OWNER, CARL);
    // The Script Cache index is keyed by INDEX_REV, which the commit raised: no cache to clear.
    expect(world.ok<{ isAdmin: boolean }>(CARL, "me").isAdmin).toBe(true);
    expect(errorOf(CARL, "config.get", {}).code).toBe("ok");
    remove(OWNER, CARL);
    expect(errorOf(CARL, "config.get", {}).code).toBe("DENIED");
    expect(errorOf(CARL, "admin.add", { email: BOB }).code).toBe("DENIED");
    expect(world.ok<{ isAdmin: boolean }>(CARL, "me").isAdmin).toBe(false);
  });

  it("an in-app admin gets admin levels on folders (manage on a folder without a grant)", () => {
    const sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
    expect(errorOf(CARL, "grant.list", { folderId: sales.id }).code).toBe(
      "DENIED",
    );
    add(OWNER, CARL);
    expect(errorOf(CARL, "grant.list", { folderId: sales.id }).code).toBe("ok");
  });
});

describe("stored list", () => {
  function store(admins: unknown): void {
    mutateIndex(world.services, (current) => ({
      doc: { ...current, admins },
      events: [],
      result: null,
    }));
  }

  it("a malformed list or entry grants nothing and the index still loads (criterion 1)", () => {
    for (const junk of [
      "carl@example.com",
      { email: CARL },
      [CARL],
      [{ email: 5, addedAt: "", addedBy: "" }],
      [{ email: CARL }],
      [{ email: "carl@other.org", addedAt: "", addedBy: "" }],
      [{ email: "carl@@example.com", addedAt: "", addedBy: "" }],
      [null],
    ]) {
      store(junk);
      expect(world.ok<{ isAdmin: boolean }>(CARL, "me").isAdmin).toBe(false);
      expect(errorOf(CARL, "config.get", {}).code).toBe("DENIED");
      expect(world.ok<ConfigView>(OWNER, "config.get").admins).toEqual([]);
    }
    store([
      { email: 5 },
      { email: " Carl@Example.com ", addedAt: "t", addedBy: OWNER },
    ]);
    expect(world.ok<{ isAdmin: boolean }>(CARL, "me").isAdmin).toBe(true);
  });

  it("every index writer keeps the list (criterion 11)", () => {
    add(OWNER, CARL);
    const sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
    expect(listed()).toEqual([CARL]);
    const item = world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "T",
      html: "<p>t</p>",
    });
    expect(listed()).toEqual([CARL]);
    world.ok(OWNER, "grant.add", {
      folderId: sales.id,
      principalType: "user",
      principalKey: BOB,
      level: "use",
    });
    expect(listed()).toEqual([CARL]);
    setSetting(world, "personalTemplates", "on");
    expect(listed()).toEqual([CARL]);
    world.ok(OWNER, "import", {
      folderId: sales.id,
      file: JSON.stringify({
        schemaVersion: 1,
        folders: [],
        items: [{ meta: { title: "Imported" }, html: "<p>i</p>" }],
      }),
    });
    expect(listed()).toEqual([CARL]);
    world.ok(OWNER, "template.delete", { id: item.id });
    world.ok(OWNER, "trash.purge");
    expect(listed()).toEqual([CARL]);
  });

  it("backup.restore keeps the live list and records liveAdminsKept (criterion 12)", () => {
    add(OWNER, BOB);
    runDaily(world.services);
    remove(OWNER, BOB);
    add(OWNER, CARL);
    world.ok(OWNER, "backup.restore", {
      date: new Date(world.clock.now).toISOString().slice(0, 10),
    });
    expect(listed()).toEqual([CARL]);
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "backup.restore",
      after: { liveSettingsKept: true, liveAdminsKept: true },
    });
  });

  it("config.get returns admins and breakGlass to admins only (criterion 13)", () => {
    add(OWNER, CARL);
    const view = world.ok<ConfigView>(CARL, "config.get");
    expect(view.admins).toEqual([
      { email: CARL, addedAt: "2026-11-09T12:00:00.000Z", addedBy: OWNER },
    ]);
    expect(view.breakGlass).toEqual([OWNER]);
    expect(view.adminGroup).toBe(ADMIN_GROUP);
    for (const who of [BOB, ANA])
      expect(errorOf(who, "config.get", {}).code).toBe("DENIED");
  });
});
