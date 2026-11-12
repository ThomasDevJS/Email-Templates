import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Grant, IndexDoc } from "../../../src/shared/model/data";
import { PRIVATE_FOLDER_NAME } from "../../../src/server/handlers/folders";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
let world: World;

beforeEach(() => {
  world = setupWorld();
  // D11 rules: personal templates on (D29 default is off).
  setSetting(world, "personalTemplates", "on");
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
});

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

function codeOf(caller: string, op: string, args: unknown): string {
  const response = world.call(caller, op, args);
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

type Listed = { folders: (Folder & { level: string })[] };

describe("folders", () => {
  it("creates top-level folders for admins only, sub-folders for manage holders", () => {
    expect(codeOf(ANA, "folder.create", { name: "Top" })).toBe("DENIED");
    const sales = folder("Sales");
    expect(
      codeOf(ANA, "folder.create", { name: "Quotes", parentId: sales.id }),
    ).toBe("DENIED");
    grant(sales.id, ANA, "manage");
    const quotes = world.ok<Folder>(ANA, "folder.create", {
      name: "Quotes",
      parentId: sales.id,
    });
    expect(quotes).toMatchObject({
      parentId: sales.id,
      kind: "shared",
      version: 1,
      createdBy: ANA,
    });
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "folder.create",
      targetPath: "/Sales/Quotes",
      actorRoles: "manage",
    });
    expect(
      codeOf(OWNER, "folder.create", { name: "quotes", parentId: sales.id }),
    ).toBe("VALIDATION");
    expect(
      codeOf(OWNER, "folder.create", { name: "X", parentId: "missing" }),
    ).toBe("NOT_FOUND");
  });

  it("lists visible folders with levels and creates the caller's private folder on first use (D11)", () => {
    const sales = folder("Sales");
    folder("HR");
    grant(sales.id, ANA, "use");
    const listed = world.ok<Listed>(ANA, "folder.list");
    const mine = listed.folders.find((f) => f.kind === "private");
    expect(mine).toMatchObject({
      name: PRIVATE_FOLDER_NAME,
      ownerEmail: ANA,
      level: "edit",
    });
    expect(listed.folders.map((f) => f.name).sort()).toEqual([
      PRIVATE_FOLDER_NAME,
      "Sales",
    ]);
    world.ok<Listed>(ANA, "folder.list");
    expect(
      fileIndex().folders.filter((f) => f.kind === "private"),
    ).toHaveLength(1);
    expect(
      world.ok<Listed>(BOB, "folder.list").folders.map((f) => f.ownerEmail),
    ).toEqual([BOB]);
    const ownerView = world.ok<Listed>(OWNER, "folder.list").folders;
    expect(ownerView.filter((f) => f.kind === "private")).toHaveLength(3);
    expect(ownerView.every((f) => f.level === "manage")).toBe(true);
  });

  it("labels another user's private folder with its owner; nobody but an admin sees one (D18, role matrix)", () => {
    const sales = folder("Sales");
    grant(sales.id, ANA, "use");
    const CY = "cy@example.com";
    const DEE = "dee@example.com";
    grant(sales.id, BOB, "edit");
    grant(sales.id, CY, "manage");
    for (const user of [ANA, BOB, CY, DEE]) world.ok(user, "folder.list");
    for (const user of [ANA, BOB, CY, DEE]) {
      const folders = world.ok<Listed>(user, "folder.list").folders;
      const privates = folders.filter((f) => f.kind === "private");
      expect(privates.map((f) => [f.name, f.ownerEmail])).toEqual([
        [PRIVATE_FOLDER_NAME, user],
      ]);
      const others = [OWNER, ANA, BOB, CY, DEE].filter((x) => x !== user);
      const names = JSON.stringify(folders.map((f) => [f.name, f.ownerEmail]));
      for (const other of others) expect(names).not.toContain(other);
    }
    const adminView = world.ok<Listed>(OWNER, "folder.list").folders;
    expect(
      adminView
        .filter((f) => f.kind === "private")
        .map((f) => f.name)
        .sort(),
    ).toEqual([
      PRIVATE_FOLDER_NAME,
      `${PRIVATE_FOLDER_NAME} (${ANA})`,
      `${PRIVATE_FOLDER_NAME} (${BOB})`,
      `${PRIVATE_FOLDER_NAME} (${CY})`,
      `${PRIVATE_FOLDER_NAME} (${DEE})`,
    ]);
    expect(
      fileIndex().folders.filter(
        (f) => f.name !== PRIVATE_FOLDER_NAME && f.kind === "private",
      ),
    ).toEqual([]);
  });

  it("never stores the owner label when an admin renames another user's private folder (5b minor 2)", () => {
    world.ok(ANA, "folder.list");
    const labelled = world
      .ok<Listed>(OWNER, "folder.list")
      .folders.find((f) => f.ownerEmail === ANA);
    expect(labelled?.name).toBe(`${PRIVATE_FOLDER_NAME} (${ANA})`);
    const rename = (name: string) =>
      world.ok<Folder>(OWNER, "folder.rename", { folderId: labelled?.id, name })
        .name;
    expect(rename(labelled?.name ?? "")).toBe(PRIVATE_FOLDER_NAME);
    expect(rename("Ana drafts (ANA@example.com)")).toBe("Ana drafts");
    expect(rename("Drafts (bob@example.com)")).toBe("Drafts (bob@example.com)");
    expect(
      world
        .ok<Listed>(ANA, "folder.list")
        .folders.find((f) => f.kind === "private")?.name,
    ).toBe("Drafts (bob@example.com)");
  });

  it("lets the private folder owner create templates there, nobody else", () => {
    const mine = world.ok<Listed>(ANA, "folder.list").folders[0];
    expect(
      codeOf(ANA, "template.create", {
        folderId: mine?.id,
        title: "Mine",
        html: "",
      }),
    ).toBe("ok");
    expect(
      codeOf(BOB, "template.create", {
        folderId: mine?.id,
        title: "Bob's",
        html: "",
      }),
    ).toBe("DENIED");
    expect(
      codeOf(ANA, "folder.rename", { folderId: mine?.id, name: "X" }),
    ).toBe("DENIED");
    expect(codeOf(OWNER, "folder.delete", { folderId: mine?.id })).toBe(
      "VALIDATION",
    );
    expect(
      codeOf(OWNER, "grant.add", {
        folderId: mine?.id,
        principalType: "user",
        principalKey: BOB,
        level: "use",
      }),
    ).toBe("VALIDATION");
  });

  it("renames with an optional baseVersion check", () => {
    const sales = folder("Sales");
    const renamed = world.ok<Folder>(OWNER, "folder.rename", {
      folderId: sales.id,
      name: "Sales EU",
      baseVersion: 1,
    });
    expect(renamed).toMatchObject({ name: "Sales EU", version: 2 });
    const response = world.call(OWNER, "folder.rename", {
      folderId: sales.id,
      name: "Old",
      baseVersion: 1,
    });
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        details: { currentVersion: 2, updatedBy: OWNER },
      },
    });
    expect(
      codeOf(OWNER, "folder.rename", {
        folderId: sales.id,
        name: "x",
        baseVersion: -1,
      }),
    ).toBe("VALIDATION");
  });

  it("moves with manage on folder, old parent and new parent; top level needs admin", () => {
    const a = folder("A");
    const b = folder("B");
    const child = folder("Child", a.id);
    grant(a.id, ANA, "manage");
    expect(
      codeOf(ANA, "folder.move", { folderId: child.id, parentId: b.id }),
    ).toBe("DENIED");
    grant(b.id, ANA, "manage");
    expect(
      world.ok<Folder>(ANA, "folder.move", {
        folderId: child.id,
        parentId: b.id,
      }).parentId,
    ).toBe(b.id);
    expect(
      codeOf(ANA, "folder.move", { folderId: child.id, parentId: "" }),
    ).toBe("DENIED");
    expect(
      world.ok<Folder>(OWNER, "folder.move", {
        folderId: child.id,
        parentId: "",
      }).parentId,
    ).toBe("");
  });

  it("refuses moves into itself, a descendant or a private folder", () => {
    const a = folder("A");
    const b = folder("B", a.id);
    const mine = world
      .ok<Listed>(OWNER, "folder.list")
      .folders.find((f) => f.kind === "private");
    expect(
      codeOf(OWNER, "folder.move", { folderId: a.id, parentId: b.id }),
    ).toBe("VALIDATION");
    expect(
      codeOf(OWNER, "folder.move", { folderId: a.id, parentId: a.id }),
    ).toBe("VALIDATION");
    expect(
      codeOf(OWNER, "folder.move", { folderId: a.id, parentId: mine?.id }),
    ).toBe("VALIDATION");
    expect(
      codeOf(OWNER, "folder.move", { folderId: mine?.id, parentId: a.id }),
    ).toBe("VALIDATION");
  });

  it("soft deletes only empty folders", () => {
    const a = folder("A");
    const b = folder("B", a.id);
    expect(codeOf(OWNER, "folder.delete", { folderId: a.id })).toBe(
      "VALIDATION",
    );
    const item = world.ok<{ id: string }>(OWNER, "template.create", {
      folderId: b.id,
      title: "T",
      html: "",
    });
    expect(codeOf(OWNER, "folder.delete", { folderId: b.id })).toBe(
      "VALIDATION",
    );
    world.ok(OWNER, "template.delete", { id: item.id });
    expect(
      world.ok<Folder>(OWNER, "folder.delete", { folderId: b.id }).deletedBy,
    ).toBe(OWNER);
    expect(codeOf(OWNER, "folder.delete", { folderId: b.id })).toBe(
      "NOT_FOUND",
    );
    expect(
      world.ok<Folder>(OWNER, "folder.delete", { folderId: a.id }).deletedAt,
    ).not.toBe("");
  });
});

describe("grants", () => {
  it("adds, changes and removes grants with audit events; lists inherited grants", () => {
    const sales = folder("Sales");
    const quotes = folder("Quotes", sales.id);
    const first = grant(sales.id, "Ana@Example.com", "use");
    expect(first).toMatchObject({
      principalKey: ANA,
      level: "use",
      createdBy: OWNER,
    });
    const changed = grant(sales.id, ANA, "edit");
    expect(changed.id).toBe(first.id);
    grant(quotes.id, "example.com", "use", "domain");
    grant(quotes.id, "/sales", "use", "ou");
    const listed = world.ok<{
      grants: (Grant & { inherited: boolean; active: boolean })[];
    }>(OWNER, "grant.list", { folderId: quotes.id });
    expect(
      listed.grants.map((g) => [g.principalKey, g.inherited, g.active]),
    ).toEqual([
      ["example.com", false, true],
      ["/sales", false, false],
      [ANA, true, true],
    ]);
    expect(world.ok(OWNER, "grant.remove", { grantId: first.id })).toEqual({
      removed: first.id,
    });
    expect(fileIndex().grants.map((g) => g.principalKey)).toEqual([
      "example.com",
      "/sales",
    ]);
    expect(
      fileIndex()
        .pendingAudit.filter((e) => e.targetType === "grant")
        .map((e) => e.action),
    ).toEqual([
      "grant.add",
      "grant.add",
      "grant.add",
      "grant.add",
      "grant.remove",
    ]);
  });

  it("validates principals and levels", () => {
    const sales = folder("Sales");
    const add = (principalType: string, principalKey: string, level = "use") =>
      codeOf(OWNER, "grant.add", {
        folderId: sales.id,
        principalType,
        principalKey,
        level,
      });
    expect(add("user", "not-an-email")).toBe("VALIDATION");
    expect(add("domain", "a@b.com")).toBe("VALIDATION");
    expect(add("ou", "sales")).toBe("VALIDATION");
    expect(add("robot", "x")).toBe("VALIDATION");
    expect(add("user", ANA, "admin")).toBe("VALIDATION");
  });

  it("checks a new group through the resolver and adds it to the snapshot in the same request", () => {
    const sales = folder("Sales");
    expect(
      codeOf(OWNER, "grant.add", {
        folderId: sales.id,
        principalType: "group",
        principalKey: "ghost@example.com",
        level: "use",
      }),
    ).toBe("VALIDATION");
    world.groups.groups.set("sales@example.com", { users: [ANA] });
    grant(sales.id, "sales@example.com", "use", "group");
    expect(world.ok<{ items: unknown[] }>(ANA, "template.list").items).toEqual(
      [],
    );
    expect(
      world.ok<Listed>(ANA, "folder.list").folders.map((f) => f.name),
    ).toContain("Sales");
  });

  it("requires manage on the folder for grant ops", () => {
    const sales = folder("Sales");
    grant(sales.id, ANA, "edit");
    const anaGrant = fileIndex().grants[0];
    expect(codeOf(ANA, "grant.list", { folderId: sales.id })).toBe("DENIED");
    expect(codeOf(ANA, "grant.remove", { grantId: anaGrant?.id })).toBe(
      "DENIED",
    );
    expect(codeOf(OWNER, "grant.remove", { grantId: "missing" })).toBe(
      "NOT_FOUND",
    );
  });
});
