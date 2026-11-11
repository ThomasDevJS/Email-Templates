import { beforeEach, describe, expect, it } from "vitest";
import { emptyMembers, type IndexDoc } from "../../../src/shared/model/data";
import { readMeta } from "../../../src/shared/cache/chunked";
import { loadIndex } from "../../../src/server/cache/indexCache";
import { handleRpc } from "../../../src/server/dispatch/handle";
import {
  createResolver,
  groupsAppDirect,
  resolverId,
  UNSUPPORTED,
} from "../../../src/server/membership/resolver";
import {
  buildSnapshot,
  MEMBERS_PREFIX,
  readSnapshot,
  referencedGroups,
  refreshSnapshot,
  subjectFor,
} from "../../../src/server/membership/snapshot";
import { createGroupsApp } from "../../fakes/groups";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";

describe("resolvers (ADR-0003 Part B)", () => {
  it("groupsapp_direct lists direct members and child groups, lower-cased, no org units", () => {
    const groups = createGroupsApp({
      "sales@example.com": {
        users: ["Ana@Example.com"],
        groups: ["EU@example.com"],
      },
    });
    const resolver = groupsAppDirect(groups);
    expect(resolver.capabilities).toEqual({ nested: false, orgUnits: false });
    expect(resolver.listMembers("sales@example.com")).toEqual([ANA]);
    expect(resolver.nestedGroups("sales@example.com")).toEqual([
      "eu@example.com",
    ]);
    expect(resolver.orgUnitOf(ANA)).toBe(UNSUPPORTED);
  });

  it.each(["directory", "cloud_identity"] as const)(
    "%s is a stub that throws NOT_CONFIGURED",
    (id) => {
      const resolver = createResolver(id, () => createGroupsApp());
      expect(resolver.id).toBe(id);
      for (const call of [
        () => resolver.listMembers("g"),
        () => resolver.nestedGroups("g"),
        () => resolver.orgUnitOf("u"),
      ])
        expect(call).toThrow(
          expect.objectContaining({ code: "NOT_CONFIGURED" }),
        );
    },
  );

  it("defaults MEMBERSHIP_RESOLVER to groupsapp_direct", () => {
    expect(resolverId(null)).toBe("groupsapp_direct");
    expect(resolverId("bogus")).toBe("groupsapp_direct");
    expect(resolverId("directory")).toBe("directory");
  });
});

describe("snapshot", () => {
  const index = (groups: string[]): IndexDoc => ({
    schemaVersion: 1,
    rev: 1,
    updatedAt: "",
    folders: [],
    items: [],
    pendingAudit: [],
    grants: groups.map((g, n) => ({
      id: String(n),
      folderId: "f",
      principalType: "group",
      principalKey: g,
      principalId: "",
      level: "use",
      createdAt: "",
      createdBy: "",
    })),
  });

  it("references the admin group plus every grant group, once each", () => {
    expect(
      referencedGroups(
        index(["b@example.com", "B@example.com", "a@example.com"]),
        " Admins@example.com ",
      ),
    ).toEqual(["a@example.com", "admins@example.com", "b@example.com"]);
    expect(referencedGroups(index([]), "")).toEqual([]);
  });

  it("records nested group warnings and keeps previous members of a group that fails", () => {
    const groups = createGroupsApp({
      "sales@example.com": { users: [ANA], groups: ["eu@example.com"] },
    });
    const previous = {
      ...emptyMembers("groupsapp_direct"),
      groups: {
        "gone@example.com": {
          members: ["old@example.com"],
          childGroups: [],
          status: "ok" as const,
        },
      },
    };
    const snapshot = buildSnapshot(
      groupsAppDirect(groups),
      ["sales@example.com", "gone@example.com"],
      previous,
      "T",
    );
    expect(snapshot.groups["sales@example.com"]).toEqual({
      members: [ANA],
      childGroups: ["eu@example.com"],
      status: "ok",
    });
    expect(snapshot.groups["gone@example.com"]).toEqual({
      members: ["old@example.com"],
      childGroups: [],
      status: "error",
    });
    expect(snapshot.warnings).toEqual([
      "Group sales@example.com contains group eu@example.com. Members of nested groups get no access until the resolver supports nesting.",
      expect.stringContaining("Group gone@example.com could not be read"),
    ]);
  });
});

describe("refresh job and admin determination", () => {
  let world: World;

  beforeEach(() => {
    world = setupWorld();
    world.groups.groups.set("admins@example.com", {
      users: ["boss@example.com"],
    });
    world.groups.groups.set("sales@example.com", { users: [ANA] });
    world.props.setProperty("ADMIN_GROUP", "admins@example.com");
  });

  it("writes members.json and the gm cache for the admin group and grant groups", () => {
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Sales",
    });
    world.ok(OWNER, "grant.add", {
      folderId: folder.id,
      principalType: "group",
      principalKey: "sales@example.com",
      level: "use",
    });
    world.groups.reads = 0;
    const snapshot = refreshSnapshot(world.services, loadIndex(world.services));
    expect(Object.keys(snapshot.groups).sort()).toEqual([
      "admins@example.com",
      "sales@example.com",
    ]);
    expect(world.groups.reads).toBe(4);
    expect(world.services.store().readSide("members")).toEqual(snapshot);
    expect(readMeta(world.cache, MEMBERS_PREFIX)?.rev).toBe(
      String(world.clock.now),
    );
    expect(readSnapshot(world.services)).toEqual(snapshot);
  });

  it("keeps a group granted while a refresh run was reading GroupsApp", () => {
    const stale = loadIndex(world.services);
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Sales",
    });
    world.ok(OWNER, "grant.add", {
      folderId: folder.id,
      principalType: "group",
      principalKey: "sales@example.com",
      level: "use",
    });
    expect(
      readSnapshot(world.services).groups["sales@example.com"]?.members,
    ).toEqual([ANA]);
    const snapshot = refreshSnapshot(world.services, stale);
    expect(Object.keys(snapshot.groups).sort()).toEqual([
      "admins@example.com",
      "sales@example.com",
    ]);
    expect(
      world.services.store().readSide("members").groups["sales@example.com"]
        ?.members,
    ).toEqual([ANA]);
  });

  it("merges a new grant group into the latest members.json, not an older copy", () => {
    refreshSnapshot(world.services, loadIndex(world.services));
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Sales",
    });
    world.ok(OWNER, "grant.add", {
      folderId: folder.id,
      principalType: "group",
      principalKey: "sales@example.com",
      level: "use",
    });
    expect(
      Object.keys(world.services.store().readSide("members").groups).sort(),
    ).toEqual(["admins@example.com", "sales@example.com"]);
  });

  it("keeps the snapshot when members.json cannot be read during grant.add (no shrink)", () => {
    refreshSnapshot(world.services, loadIndex(world.services));
    const before = world.services.store().readSide("members");
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Sales",
    });
    const services = world.as("webapp");
    const failingStore = () => {
      const store = services.store();
      return {
        ...store,
        readSide: ((name) => {
          if (name === "members") throw new Error("Drive read failed");
          return store.readSide(name);
        }) as typeof store.readSide,
      };
    };
    const response = handleRpc(
      { email: OWNER },
      {
        op: "grant.add",
        args: {
          folderId: folder.id,
          principalType: "group",
          principalKey: "sales@example.com",
          level: "use",
        },
        requestId: "TESTREQ0-000001",
        clientVersion: "t",
      },
      "webapp",
      { services: { ...services, store: failingStore } },
    );
    expect(response.ok).toBe(true);
    expect(world.services.store().readSide("members")).toEqual(before);
    expect(world.lines.join("\n")).toContain("grant.add.snapshotMerge");
  });

  it("reads the snapshot from members.json when the gm cache is gone, without GroupsApp", () => {
    refreshSnapshot(world.services, loadIndex(world.services));
    world.cache.removeAll(["gm:meta"]);
    world.groups.reads = 0;
    expect(
      readSnapshot(world.services).groups["admins@example.com"]?.members,
    ).toEqual(["boss@example.com"]);
    expect(world.groups.reads).toBe(0);
  });

  it("makes ADMIN_GROUP members and ADMIN_EMAILS admins, nobody else", () => {
    refreshSnapshot(world.services, loadIndex(world.services));
    const snapshot = readSnapshot(world.services);
    let indexReads = 0;
    const index = () => {
      indexReads++;
      return loadIndex(world.services);
    };
    expect(
      subjectFor("boss@example.com", snapshot, world.props, index).isAdmin,
    ).toBe(true);
    expect(subjectFor(OWNER, snapshot, world.props, index).isAdmin).toBe(true);
    // D32: the index (in-app list) is read only when both properties say no.
    expect(indexReads).toBe(0);
    expect(subjectFor(ANA, snapshot, world.props, index).isAdmin).toBe(false);
    expect(indexReads).toBe(1);
    expect(
      world.ok<{ isAdmin: boolean }>("boss@example.com", "me").isAdmin,
    ).toBe(true);
    expect(world.ok<{ isAdmin: boolean }>(ANA, "me")).toMatchObject({
      email: ANA,
      isAdmin: false,
    });
  });

  it("exposes membership.refresh to admins only", () => {
    expect(world.call(ANA, "membership.refresh")).toMatchObject({
      ok: false,
      error: { code: "DENIED" },
    });
    expect(
      world.ok<{ groups: unknown[] }>(OWNER, "membership.refresh").groups,
    ).toHaveLength(1);
  });

  it("fails clearly with a stub resolver", () => {
    world.props.setProperty("MEMBERSHIP_RESOLVER", "directory");
    const snapshot = refreshSnapshot(world.services, loadIndex(world.services));
    expect(snapshot.resolver).toBe("directory");
    expect(snapshot.groups["admins@example.com"]?.status).toBe("error");
    expect(snapshot.warnings[0]).toContain("(NOT_CONFIGURED AppError)");
  });
});
