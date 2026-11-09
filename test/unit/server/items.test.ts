import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  Folder,
  Grant,
  IndexDoc,
  Item,
} from "../../../src/shared/model/data";
import { INDEX_REV_KEY, loadIndex } from "../../../src/server/cache/indexCache";
import { runDaily } from "../../../src/server/jobs/daily";
import { runTick } from "../../../src/server/jobs/tick";
import { handleRpc } from "../../../src/server/dispatch/handle";
import { mutateIndex } from "../../../src/server/storage/writer";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
let world: World;

beforeEach(() => {
  world = setupWorld();
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
  expect(world.lock.hasLock()).toBe(false);
});

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

function errorOf(caller: string, op: string, args: unknown) {
  const response = world.call(caller, op, args);
  if (response.ok) throw new Error(`${op} unexpectedly succeeded`);
  return response.error;
}

function sharedFolder(name = "Sales", parentId = ""): Folder {
  return world.ok<Folder>(OWNER, "folder.create", { name, parentId });
}

function grant(folderId: string, email: string, level: string): Grant {
  return world.ok<Grant>(OWNER, "grant.add", {
    folderId,
    principalType: "user",
    principalKey: email,
    level,
  });
}

function create(caller: string, folderId: string, html = "<p>Hello</p>"): Item {
  return world.ok<Item>(caller, "template.create", {
    folderId,
    title: "Welcome",
    tags: ["intro"],
    html,
  });
}

describe("template create, get, update (save sequence)", () => {
  it("writes the body file with appProperties, then the index with the item and its audit event", () => {
    const folder = sharedFolder();
    grant(folder.id, ANA, "edit");
    const item = create(ANA, folder.id, "<p>Hello <b>Ana</b></p>");
    expect(item).toMatchObject({
      version: 1,
      currentVersion: 1,
      snippet: "Hello Ana",
      sizeBytes: 23,
      createdBy: ANA,
    });
    expect(world.drive.files.get(item.bodyFileId)).toMatchObject({
      name: `${item.id}.v1.json`,
      appProperties: {
        itemId: item.id,
        version: "1",
        savedBy: ANA,
        restoredFrom: "0",
      },
    });
    const index = fileIndex();
    expect(index.items).toHaveLength(1);
    expect(index.pendingAudit.at(-1)).toMatchObject({
      action: "template.create",
      actor: ANA,
      actorRoles: "edit",
      targetId: item.id,
      targetPath: "/Sales",
      before: null,
    });
    const after = index.pendingAudit.at(-1)?.after as {
      body: { version: number; fileId: string };
    };
    expect(after.body).toMatchObject({ version: 1, fileId: item.bodyFileId });
    expect(JSON.stringify(index.pendingAudit)).not.toContain("<b>Ana</b>");
    expect(world.props.getProperty(INDEX_REV_KEY)).toBe(String(index.rev));
    expect(world.ok(ANA, "template.get", { id: item.id })).toEqual({
      item,
      html: "<p>Hello <b>Ana</b></p>",
    });
  });

  it("creates a new version file on every save and keeps older versions", () => {
    const folder = sharedFolder();
    const item = create(OWNER, folder.id);
    const v2 = world.ok<Item>(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "Welcome 2",
      html: "<p>Two</p>",
    });
    expect(v2).toMatchObject({
      version: 2,
      currentVersion: 2,
      title: "Welcome 2",
    });
    expect(
      world.services
        .store()
        .listBodies(item.id)
        .map((ref) => ref.version)
        .sort(),
    ).toEqual([1, 2]);
  });

  it("returns CONFLICT with the current version, author and time for a stale baseVersion", () => {
    const folder = sharedFolder();
    grant(folder.id, ANA, "edit");
    const item = create(OWNER, folder.id);
    world.clock.now += 60000;
    world.ok(ANA, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "Ana's",
      html: "<p>A</p>",
    });
    const error = errorOf(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "Mine",
      html: "<p>B</p>",
    });
    expect(error).toMatchObject({
      code: "CONFLICT",
      retryable: false,
      details: {
        currentVersion: 2,
        updatedBy: ANA,
        updatedAt: "2026-11-09T12:01:00.000Z",
      },
    });
    expect(fileIndex().items[0]?.title).toBe("Ana's");
  });

  it("detects a conflict inside the lock when another save lands after the pre-check", () => {
    const folder = sharedFolder();
    const item = create(OWNER, folder.id);
    const services = world.as("webapp");
    const store = services.store();
    const racing = {
      ...services,
      store: () => ({
        ...store,
        createBody: (body: Parameters<typeof store.createBody>[0]) => {
          mutateIndex(services, (current) => ({
            doc: {
              ...current,
              items: current.items.map((i) => ({
                ...i,
                version: 2,
                currentVersion: 2,
                updatedBy: BOB,
              })),
            },
            events: [],
            result: undefined,
          }));
          return store.createBody(body);
        },
      }),
    };
    const response = handleRpc(
      { email: OWNER },
      {
        op: "template.update",
        args: { id: item.id, baseVersion: 1, title: "T", html: "" },
        requestId: "r",
        clientVersion: "t",
      },
      "webapp",
      { services: racing },
    );
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        details: { currentVersion: 2, updatedBy: BOB },
      },
    });
    expect(store.listBodies(item.id)).toHaveLength(2);
  });

  it("returns BUSY when the lock is held for 10 s", () => {
    const folder = sharedFolder();
    world.lock.holdElsewhere();
    expect(
      errorOf(OWNER, "template.create", {
        folderId: folder.id,
        title: "T",
        html: "",
      }),
    ).toMatchObject({
      code: "BUSY",
      retryable: true,
    });
  });

  it("calls the sanitize port on create and update (TODO slice 3: htmlparser2 allowlist replaces identity)", () => {
    const folder = sharedFolder();
    const item = create(OWNER, folder.id, "<p>one</p>");
    world.ok(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "T",
      html: "<p>two</p>",
    });
    expect(world.sanitized).toEqual(["<p>one</p>", "<p>two</p>"]);
  });

  it("rejects bodies over 100 KB and invalid titles", () => {
    const folder = sharedFolder();
    expect(
      errorOf(OWNER, "template.create", {
        folderId: folder.id,
        title: "T",
        html: "x".repeat(102401),
      }).code,
    ).toBe("VALIDATION");
    expect(
      errorOf(OWNER, "template.create", {
        folderId: folder.id,
        title: "",
        html: "",
      }).code,
    ).toBe("VALIDATION");
    expect(
      errorOf(OWNER, "template.create", {
        folderId: folder.id,
        title: "T",
        tags: "nope",
      }).code,
    ).toBe("VALIDATION");
  });
});

describe("save sequence crash points (ADR-0002 Concurrency)", () => {
  it("after the body file is created and before the index write: index unchanged, the orphan is trashed after 1 h", () => {
    const folder = sharedFolder();
    const revBefore = fileIndex().rev;
    world.drive.failNext("update", new Error("Drive write failed"));
    expect(
      errorOf(OWNER, "template.create", {
        folderId: folder.id,
        title: "T",
        html: "<p>x</p>",
      }).code,
    ).toBe("INTERNAL");
    expect(fileIndex().rev).toBe(revBefore);
    expect(fileIndex().items).toHaveLength(0);
    const orphans = world.services.store().listBodies();
    expect(orphans).toHaveLength(1);
    expect(runDaily(world.services).orphans).toBe(0);
    world.clock.now += 61 * 60 * 1000;
    expect(runDaily(world.services).orphans).toBe(1);
    expect(world.drive.files.get(orphans[0]?.fileId ?? "")?.trashed).toBe(true);
  });

  it("after the index write and before INDEX_REV: the next writer adopts the file rev and keeps the change", () => {
    const folder = sharedFolder();
    const original = world.props.setProperty.bind(world.props);
    let fail = true;
    world.props.setProperty = (key: string, value: string) => {
      if (key === INDEX_REV_KEY && fail) {
        fail = false;
        throw new Error("Properties unavailable");
      }
      return original(key, value);
    };
    expect(
      errorOf(OWNER, "template.create", {
        folderId: folder.id,
        title: "Kept",
        html: "",
      }).code,
    ).toBe("INTERNAL");
    const committed = fileIndex();
    expect(committed.items.map((i) => i.title)).toEqual(["Kept"]);
    expect(world.props.getProperty(INDEX_REV_KEY)).toBe(
      String(committed.rev - 1),
    );
    world.ok(OWNER, "template.create", {
      folderId: folder.id,
      title: "Next",
      html: "",
    });
    const next = fileIndex();
    expect(next.rev).toBe(committed.rev + 1);
    expect(next.items.map((i) => i.title)).toEqual(["Kept", "Next"]);
    expect(world.props.getProperty(INDEX_REV_KEY)).toBe(String(next.rev));
  });

  it("after the index write and before INDEX_REV: tick repairs readers within 5 min", () => {
    const folder = sharedFolder();
    loadIndex(world.services);
    const store = world.services.store();
    store.writeIndex({
      ...store.readIndex(),
      rev: fileIndex().rev + 1,
      folders: [
        ...fileIndex().folders,
        { ...folder, id: "LATE", name: "Late" },
      ],
    });
    expect(loadIndex(world.services).folders.map((f) => f.id)).not.toContain(
      "LATE",
    );
    expect(runTick(world.services).indexCache).toBe("rebuilt");
    expect(loadIndex(world.services).folders.map((f) => f.id)).toContain(
      "LATE",
    );
  });
});

describe("template list, move, delete, restore", () => {
  it("lists only templates in folders where the caller holds use", () => {
    const sales = sharedFolder("Sales");
    const hr = sharedFolder("HR");
    grant(sales.id, ANA, "use");
    create(OWNER, sales.id);
    create(OWNER, hr.id);
    const list = world.ok<{ items: { folderId: string; level: string }[] }>(
      ANA,
      "template.list",
    );
    expect(list.items.map((i) => i.folderId)).toEqual([sales.id]);
    expect(list.items[0]?.level).toBe("use");
    expect(
      world.ok<{ items: unknown[] }>(BOB, "template.list").items,
    ).toHaveLength(0);
    expect(
      world.ok<{ items: unknown[] }>(OWNER, "template.list", {
        folderId: hr.id,
      }).items,
    ).toHaveLength(1);
    expect(
      errorOf(ANA, "template.get", {
        id: world.ok<{ items: Item[] }>(OWNER, "template.list", {
          folderId: hr.id,
        }).items[0]?.id,
      }).code,
    ).toBe("DENIED");
  });

  it("moves only with edit on source and target", () => {
    const a = sharedFolder("A");
    const b = sharedFolder("B");
    grant(a.id, ANA, "edit");
    grant(b.id, ANA, "use");
    const item = create(OWNER, a.id);
    expect(
      errorOf(ANA, "template.move", { id: item.id, folderId: b.id }).code,
    ).toBe("DENIED");
    grant(b.id, ANA, "edit");
    expect(
      world.ok<Item>(ANA, "template.move", { id: item.id, folderId: b.id })
        .folderId,
    ).toBe(b.id);
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "template.move",
      targetPath: "/B",
    });
  });

  it("soft deletes to the trash and restores from it", () => {
    const folder = sharedFolder();
    const item = create(OWNER, folder.id);
    const deleted = world.ok<Item>(OWNER, "template.delete", {
      id: item.id,
      baseVersion: 1,
    });
    expect(deleted.deletedAt).toBe("2026-11-09T12:00:00.000Z");
    expect(errorOf(OWNER, "template.get", { id: item.id }).code).toBe(
      "NOT_FOUND",
    );
    expect(errorOf(OWNER, "template.delete", { id: item.id }).code).toBe(
      "NOT_FOUND",
    );
    expect(
      world.ok<{ items: unknown[] }>(OWNER, "template.list", { trash: true })
        .items,
    ).toHaveLength(1);
    expect(
      world.ok<Item>(OWNER, "template.restoreFromTrash", { id: item.id })
        .deletedAt,
    ).toBe("");
    expect(
      errorOf(OWNER, "template.restoreFromTrash", { id: item.id }).code,
    ).toBe("VALIDATION");
  });

  it("hides trash from use-only callers", () => {
    const folder = sharedFolder();
    grant(folder.id, ANA, "use");
    const item = create(OWNER, folder.id);
    world.ok(OWNER, "template.delete", { id: item.id });
    expect(
      world.ok<{ items: unknown[] }>(ANA, "template.list", { trash: true })
        .items,
    ).toHaveLength(0);
    expect(
      errorOf(ANA, "template.restoreFromTrash", { id: item.id }).code,
    ).toBe("DENIED");
  });

  it("moves with template.update when folderId changes, checking edit on the target", () => {
    const a = sharedFolder("A");
    const b = sharedFolder("B");
    grant(a.id, ANA, "edit");
    const item = create(ANA, a.id);
    expect(
      errorOf(ANA, "template.update", {
        id: item.id,
        baseVersion: 1,
        title: "T",
        html: "",
        folderId: b.id,
      }).code,
    ).toBe("DENIED");
    grant(b.id, ANA, "edit");
    expect(
      world.ok<Item>(ANA, "template.update", {
        id: item.id,
        baseVersion: 1,
        title: "T",
        html: "",
        folderId: b.id,
      }).folderId,
    ).toBe(b.id);
  });
});
