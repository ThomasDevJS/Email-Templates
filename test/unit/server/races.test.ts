/**
 * Concurrent changes between a caller's pre-lock authorization and the commit (review slice 2, retry 1).
 * The race runs when the caller's request first asks for the 10 s write lock, after `dispatch` authorized it
 * on the pre-lock index. The in-lock recheck must answer CONFLICT and leave the other change in place.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, IndexDoc, Item } from "../../../src/shared/model/data";
import { handleRpc } from "../../../src/server/dispatch/handle";
import { WRITE_LOCK_MS } from "../../../src/server/lock";
import type { RpcResponse } from "../../../src/shared/model/protocol";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
let world: World;
let a: Folder;
let b: Folder;
let c: Folder;

beforeEach(() => {
  world = setupWorld();
  a = world.ok<Folder>(OWNER, "folder.create", { name: "A" });
  b = world.ok<Folder>(OWNER, "folder.create", { name: "B" });
  c = world.ok<Folder>(OWNER, "folder.create", { name: "C" });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
  expect(world.lock.hasLock()).toBe(false);
});

function grant(folderId: string, level: string): void {
  world.ok(OWNER, "grant.add", {
    folderId,
    principalType: "user",
    principalKey: ANA,
    level,
  });
}

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

/** Runs `op` for `caller`; `race` runs once, right before the request's write lock. */
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

function itemIn(folderId: string): Item {
  const item = world.ok<Item>(OWNER, "template.create", {
    folderId,
    title: "X",
    html: "<p>x</p>",
  });
  world.ok(ANA, "template.list");
  return item;
}

function ownerMoves(itemId: string, folderId: string): () => void {
  return () => {
    world.ok(OWNER, "template.move", { id: itemId, folderId });
  };
}

function stored(itemId: string): Item | undefined {
  return fileIndex().items.find((item) => item.id === itemId);
}

describe("template writes re-check their folder inside the lock", () => {
  it("update: ana (edit on A only) gets CONFLICT when the owner moved X to B, and X stays in B", () => {
    grant(a.id, "edit");
    const x = itemIn(a.id);
    const response = racing(
      ANA,
      "template.update",
      { id: x.id, baseVersion: 1, title: "Ana", html: "<p>ana</p>" },
      ownerMoves(x.id, b.id),
    );
    expect(response).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", details: { reason: "moved" } },
    });
    expect(stored(x.id)).toMatchObject({ folderId: b.id, title: "X" });
  });

  it("move: ana's move from A to C fails when the owner moved X to B first", () => {
    grant(a.id, "edit");
    grant(c.id, "edit");
    const x = itemIn(a.id);
    const response = racing(
      ANA,
      "template.move",
      { id: x.id, folderId: c.id },
      ownerMoves(x.id, b.id),
    );
    expect(response).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(stored(x.id)?.folderId).toBe(b.id);
  });

  it("delete: ana cannot trash X after it moved to B", () => {
    grant(a.id, "edit");
    const x = itemIn(a.id);
    const response = racing(
      ANA,
      "template.delete",
      { id: x.id },
      ownerMoves(x.id, b.id),
    );
    expect(response).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(stored(x.id)).toMatchObject({ folderId: b.id, deletedAt: "" });
  });

  it("restore: ana cannot restore X after the owner moved it out of A in the trash", () => {
    grant(a.id, "edit");
    const x = itemIn(a.id);
    world.ok(OWNER, "template.delete", { id: x.id });
    const response = racing(
      ANA,
      "template.restoreFromTrash",
      { id: x.id },
      () => {
        world.services.store().writeIndex({
          ...fileIndex(),
          rev: fileIndex().rev + 1,
          items: fileIndex().items.map((i) =>
            i.id === x.id ? { ...i, folderId: b.id } : i,
          ),
        });
      },
    );
    expect(response).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(stored(x.id)?.deletedAt).not.toBe("");
  });

  it("update: a grant removed before the commit answers DENIED", () => {
    grant(a.id, "edit");
    const x = itemIn(a.id);
    const grantId = fileIndex().grants[0]?.id;
    const response = racing(
      ANA,
      "template.update",
      { id: x.id, baseVersion: 1, title: "Ana", html: "" },
      () => {
        world.ok(OWNER, "grant.remove", { grantId });
      },
    );
    expect(response).toMatchObject({ ok: false, error: { code: "DENIED" } });
    expect(stored(x.id)?.title).toBe("X");
  });

  it("update without a race keeps the item's folder", () => {
    grant(a.id, "edit");
    const x = itemIn(a.id);
    const response = racing(
      ANA,
      "template.update",
      { id: x.id, baseVersion: 1, title: "Ana", html: "" },
      () => undefined,
    );
    expect(response).toMatchObject({ ok: true, data: { folderId: a.id } });
  });
});

describe("folder writes re-check their parents inside the lock", () => {
  function child(): Folder {
    const folder = world.ok<Folder>(OWNER, "folder.create", {
      name: "F",
      parentId: a.id,
    });
    world.ok(ANA, "folder.list");
    return folder;
  }

  function ownerMovesFolder(folderId: string, parentId: string): () => void {
    return () => {
      world.ok(OWNER, "folder.move", { folderId, parentId });
    };
  }

  function parentOf(folderId: string): string | undefined {
    return fileIndex().folders.find((f) => f.id === folderId)?.parentId;
  }

  it("move: ana (manage on A and C) gets CONFLICT when the owner moved F to B", () => {
    grant(a.id, "manage");
    grant(c.id, "manage");
    const f = child();
    const response = racing(
      ANA,
      "folder.move",
      { folderId: f.id, parentId: c.id },
      ownerMovesFolder(f.id, b.id),
    );
    expect(response).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(parentOf(f.id)).toBe(b.id);
  });

  it("rename: ana cannot rename F after it moved under B", () => {
    grant(a.id, "manage");
    const f = child();
    const response = racing(
      ANA,
      "folder.rename",
      { folderId: f.id, name: "Mine" },
      ownerMovesFolder(f.id, b.id),
    );
    expect(response).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(fileIndex().folders.find((x) => x.id === f.id)?.name).toBe("F");
  });

  it("delete: ana cannot delete F after it moved under B", () => {
    grant(a.id, "manage");
    const f = child();
    const response = racing(
      ANA,
      "folder.delete",
      { folderId: f.id },
      ownerMovesFolder(f.id, b.id),
    );
    expect(response).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(fileIndex().folders.find((x) => x.id === f.id)?.deletedAt).toBe("");
  });
});

describe("personal templates switched off while a write runs (D29, ADR-0008 section 1)", () => {
  it("refuses the owner's save in the lock on the fresh index; nothing is written", () => {
    setSetting(world, "personalTemplates", "on");
    const mine = world
      .ok<{ folders: Folder[] }>(ANA, "folder.list")
      .folders.find((folder) => folder.kind === "private") as Folder;
    const item = world.ok<Item>(ANA, "template.create", {
      folderId: mine.id,
      title: "Mine",
      html: "<p>x</p>",
    });
    const response = racing(
      ANA,
      "template.update",
      { id: item.id, baseVersion: 1, title: "Changed", html: "<p>y</p>" },
      () => {
        setSetting(world, "personalTemplates", "off");
      },
    );
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "DENIED",
        message: "Personal templates are turned off by your admin.",
      },
    });
    expect(fileIndex().items.find((x) => x.id === item.id)?.title).toBe("Mine");
  });
});
