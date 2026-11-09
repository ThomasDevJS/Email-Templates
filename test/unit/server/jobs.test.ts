import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuditEvent, IndexDoc } from "../../../src/shared/model/data";
import { bufferEvent, readBuffer } from "../../../src/server/audit/buffer";
import {
  auditEvent,
  AUDIT_VALUE_LIMIT_BYTES,
  capValue,
} from "../../../src/server/audit/events";
import {
  appendUnique,
  groupByMonth,
  monthOf,
} from "../../../src/server/audit/lines";
import { rollAudit } from "../../../src/server/audit/roll";
import { applyUsage, RECENT_MAX } from "../../../src/server/audit/usage";
import { readMeta } from "../../../src/shared/cache/chunked";
import { INDEX_PREFIX, loadIndex } from "../../../src/server/cache/indexCache";
import {
  BACKUPS_KEPT,
  oldestKeptMonth,
  runDaily,
} from "../../../src/server/jobs/daily";
import { runTick } from "../../../src/server/jobs/tick";
import {
  ensureTriggers,
  TRIGGERS_VERSION_KEY,
} from "../../../src/server/jobs/triggers";
import { MEMBERS_PREFIX } from "../../../src/server/membership/snapshot";
import { childQuery } from "../../../src/server/storage/driveClient";
import { requireStoreIds } from "../../../src/server/storage/setupStore";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const DAY = 24 * 60 * 60 * 1000;
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

function source(actor = "x@example.com") {
  let n = 0;
  return {
    actor,
    actorRoles: "none",
    surface: "webapp" as const,
    requestId: "r",
    appVersion: "v",
    nowIso: () => new Date(world.clock.now).toISOString(),
    newId: () => `EVT${String(world.clock.now)}-${String(n++)}`,
  };
}

function denied(id: string): AuditEvent {
  return {
    ...auditEvent(source(), {
      action: "template.get",
      targetType: "folder",
      targetId: "f",
      result: "denied",
      errorCode: "DENIED",
    }),
    id,
  };
}

describe("audit events (ADR-0003 Part D)", () => {
  it("fills every field and caps before and after at 40 KB", () => {
    const event = auditEvent(source(), {
      action: "a",
      targetType: "template",
      targetId: "t",
      before: { big: "x".repeat(AUDIT_VALUE_LIMIT_BYTES) },
    });
    expect(event).toMatchObject({
      actor: "x@example.com",
      result: "ok",
      errorCode: "",
      targetPath: "",
      after: null,
      durationMs: 0,
    });
    expect(event.before).toEqual({
      truncated: true,
      bytes: AUDIT_VALUE_LIMIT_BYTES + 10,
    });
    expect(capValue({ a: 1 })).toEqual({ a: 1 });
  });

  it("appends lines once per ID and groups by month", () => {
    const first = appendUnique("", [denied("a"), denied("b"), denied("a")]);
    expect(first.added).toBe(2);
    const second = appendUnique(first.text.trimEnd(), [
      denied("b"),
      denied("c"),
    ]);
    expect(second.added).toBe(1);
    expect(second.text.split("\n").filter(Boolean)).toHaveLength(3);
    expect(appendUnique("garbage\n", [denied("a")]).added).toBe(1);
    expect(monthOf("2026-11-09T00:00:00Z")).toBe("2026-11");
    expect([
      ...groupByMonth([
        { ...denied("x"), ts: "2026-10-31T23:59:59Z" },
        denied("y"),
      ]).keys(),
    ]).toEqual(["2026-10", "2026-11"]);
  });
});

describe("evt buffer and tick flush", () => {
  it("buffers under tryLock(500) and drops the event when the lock is busy", () => {
    expect(
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: denied("d1"),
      }),
    ).toBe(true);
    world.lock.holdElsewhere();
    expect(
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: denied("d2"),
      }),
    ).toBe(false);
    world.lock.holdElsewhere(false);
    expect(readBuffer(world.cache).events).toHaveLength(1);
  });

  it("moves apply events to usage.json and denied events to pendingAudit, then clears the buffer", () => {
    const ts = new Date(world.clock.now).toISOString();
    bufferEvent(world.cache, world.lock, {
      kind: "apply",
      itemId: "I1",
      actor: "Ana@example.com",
      ts,
    });
    bufferEvent(world.cache, world.lock, {
      kind: "apply",
      itemId: "I1",
      actor: "bob@example.com",
      ts,
    });
    bufferEvent(world.cache, world.lock, {
      kind: "denied",
      event: denied("d1"),
    });
    const result = runTick(world.services);
    expect(result).toMatchObject({ applies: 2, denied: 1, rolled: 0 });
    const usage = world.services.store().readSide("usage");
    expect(usage.items["I1"]).toEqual({ applyCount: 2, lastUsedAt: ts });
    expect(usage.recent["ana@example.com"]).toEqual(["I1"]);
    expect(fileIndex().pendingAudit.map((e) => e.id)).toEqual(["d1"]);
    expect(readBuffer(world.cache).events).toHaveLength(0);
    expect(runTick(world.services)).toMatchObject({ applies: 0, denied: 0 });
  });

  it("does not add a denied event twice when the buffer survives a crash after the index write", () => {
    bufferEvent(world.cache, world.lock, {
      kind: "denied",
      event: denied("d1"),
    });
    world.drive.failNext("update");
    expect(() => runTick(world.services)).toThrow("Drive update failed");
    expect(readBuffer(world.cache).events).toHaveLength(1);
    const original = world.cache.removeAll.bind(world.cache);
    world.cache.removeAll = () => {
      world.cache.removeAll = original;
      throw new Error("cache down");
    };
    expect(() => runTick(world.services)).toThrow("cache down");
    expect(runTick(world.services).denied).toBe(1);
    expect(fileIndex().pendingAudit.map((e) => e.id)).toEqual(["d1"]);
  });

  it("skips evicted buffer entries", () => {
    bufferEvent(world.cache, world.lock, {
      kind: "denied",
      event: denied("d1"),
    });
    bufferEvent(world.cache, world.lock, {
      kind: "denied",
      event: denied("d2"),
    });
    world.cache.remove("evt:0");
    expect(runTick(world.services).denied).toBe(1);
  });

  it("records denied requests from dispatch through the buffer into pendingAudit", () => {
    world.call("intruder@example.com", "membership.refresh");
    runTick(world.services);
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      actor: "intruder@example.com",
      action: "membership.refresh",
      result: "denied",
    });
  });

  it("rolls pendingAudit early above 200 KB", () => {
    for (let n = 0; n < 6; n++)
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: {
          ...denied(`big${String(n)}`),
          before: { pad: "p".repeat(39000) },
        },
      });
    expect(runTick(world.services).rolled).toBe(6);
    expect(fileIndex().pendingAudit).toHaveLength(0);
    expect(world.drive.byName("2026-11.jsonl")).toHaveLength(1);
  });
});

describe("tick cache upkeep", () => {
  it("rebuilds a missing index set, keeps a fresh one, re-puts sets older than 5 h", () => {
    expect(runTick(world.services)).toMatchObject({
      indexCache: "rebuilt",
      membersCache: "reput",
    });
    expect(runTick(world.services)).toMatchObject({
      indexCache: "fresh",
      membersCache: "fresh",
    });
    world.cache.removeAll(["idx:meta"]);
    expect(runTick(world.services).indexCache).toBe("rebuilt");
    world.clock.now += 5 * 60 * 60 * 1000 + 1;
    expect(runTick(world.services)).toMatchObject({
      indexCache: "reput",
      membersCache: "reput",
    });
    expect(readMeta(world.cache, INDEX_PREFIX)?.builtAt).toBe(world.clock.now);
    expect(readMeta(world.cache, MEMBERS_PREFIX)?.builtAt).toBe(
      world.clock.now,
    );
  });
});

describe("daily", () => {
  it("rolls pendingAudit into the month file and survives a crash between append and cleanup without duplicates", () => {
    world.ok(OWNER, "folder.create", { name: "A" });
    world.ok(OWNER, "folder.create", { name: "B" });
    const pending = fileIndex().pendingAudit.map((e) => e.id);
    expect(pending).toHaveLength(2);
    world.lock.holdElsewhere();
    expect(() => rollAudit(world.services)).toThrow("Busy");
    world.lock.holdElsewhere(false);
    expect(fileIndex().pendingAudit).toHaveLength(2);
    world.ok(OWNER, "folder.create", { name: "C" });
    const all = fileIndex().pendingAudit.map((e) => e.id);
    expect(
      world.services
        .store()
        .appendAudit("2026-11", fileIndex().pendingAudit.slice(0, 2)),
    ).toBe(0);
    expect(runDaily(world.services).auditRolled).toBe(3);
    const lines =
      world.drive.byName("2026-11.jsonl")[0]?.content.trim().split("\n") ?? [];
    expect(lines.map((line) => (JSON.parse(line) as AuditEvent).id)).toEqual(
      all,
    );
    expect(lines).toHaveLength(3);
    expect(fileIndex().pendingAudit).toHaveLength(0);
    expect(runDaily(world.services).auditRolled).toBe(0);
  });

  it("purges items and folders deleted over 30 days ago, with their body files and grants", () => {
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Old",
    });
    const item = world.ok<{ id: string; bodyFileId: string }>(
      OWNER,
      "template.create",
      { folderId: folder.id, title: "T", html: "" },
    );
    world.ok(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "T",
      html: "2",
    });
    world.ok(OWNER, "grant.add", {
      folderId: folder.id,
      principalType: "domain",
      principalKey: "example.com",
      level: "use",
    });
    world.ok(OWNER, "template.delete", { id: item.id });
    world.ok(OWNER, "folder.delete", { folderId: folder.id });
    world.clock.now += 29 * DAY;
    expect(runDaily(world.services).purged).toBe(0);
    world.clock.now += 2 * DAY;
    expect(runDaily(world.services).purged).toBe(2);
    const index = fileIndex();
    expect(index.items).toHaveLength(0);
    expect(index.folders).toHaveLength(0);
    expect(index.grants).toHaveLength(0);
    expect(world.drive.files.get(item.bodyFileId)?.trashed).toBe(true);
    expect(world.services.store().listBodies(item.id)).toHaveLength(0);
    expect(
      index.pendingAudit.map((e) => [e.action, e.targetType, e.actor]),
    ).toEqual([
      ["trash.purge", "template", "system"],
      ["trash.purge", "folder", "system"],
    ]);
  });

  it("leaves body files alone when the purge commit fails, and a restored item keeps them", () => {
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Old",
    });
    const item = world.ok<{ id: string; bodyFileId: string }>(
      OWNER,
      "template.create",
      { folderId: folder.id, title: "T", html: "" },
    );
    world.ok(OWNER, "template.delete", { id: item.id });
    world.clock.now += 31 * DAY;
    world.lock.holdElsewhere();
    expect(() => runDaily(world.services)).toThrow("purged (Busy");
    world.lock.holdElsewhere(false);
    expect(world.drive.files.get(item.bodyFileId)?.trashed).toBe(false);
    world.ok(OWNER, "template.restoreFromTrash", { id: item.id });
    expect(runDaily(world.services).purged).toBe(0);
    expect(world.drive.files.get(item.bodyFileId)?.trashed).toBe(false);
  });

  it("keeps 14 dated backups of index, favorites and usage", () => {
    for (let day = 0; day < 16; day++) {
      runDaily(world.services);
      world.clock.now += DAY;
    }
    const names = world.services
      .store()
      .listBackups()
      .map((b) => b.name)
      .sort();
    expect(names).toHaveLength(BACKUPS_KEPT);
    expect(names[0]).toBe("2026-11-11");
    expect(names.at(-1)).toBe("2026-11-24");
    const folderId = world.services.store().listBackups()[0]?.id ?? "";
    expect(
      world.drive
        .query(childQuery(folderId))
        .map((f) => f.name)
        .sort(),
    ).toEqual(["favorites.json", "index.json", "usage.json"]);
  });

  it("trashes audit month files older than 24 months", () => {
    const auditId = requireStoreIds(world.props).auditId;
    for (const name of [
      "2024-10.jsonl",
      "2024-11.jsonl",
      "2026-11.jsonl",
      "notes.txt",
    ])
      world.drive.add({ name, parents: [auditId] }, "");
    expect(oldestKeptMonth(world.clock.now)).toBe("2024-11");
    expect(runDaily(world.services).auditFilesTrashed).toBe(1);
    expect(world.drive.byName("2024-10.jsonl")[0]?.trashed).toBe(true);
    expect(world.drive.byName("2024-11.jsonl")[0]?.trashed).toBe(false);
  });

  it("runs every step and reports the failed ones", () => {
    world.drive.failNext("copy", new Error("copy refused"));
    expect(() => runDaily(world.services)).toThrow(
      "daily steps failed: backupsTrashed (copy refused)",
    );
    expect(world.drive.byName("2026-11.jsonl")).toHaveLength(0);
  });
});

describe("usage", () => {
  it("counts applies, keeps the latest time and 20 recent items per user", () => {
    const events = Array.from({ length: 25 }, (_, n) => ({
      itemId: `I${String(n)}`,
      actor: "a@example.com",
      ts: `2026-11-09T00:00:${String(n).padStart(2, "0")}Z`,
    }));
    const usage = applyUsage(
      { rev: 1, items: {}, recent: {} },
      [...events].reverse(),
    );
    expect(usage.rev).toBe(2);
    expect(usage.recent["a@example.com"]).toHaveLength(RECENT_MAX);
    expect(usage.recent["a@example.com"]?.[0]).toBe("I24");
    const again = applyUsage(usage, [
      { itemId: "I0", actor: "a@example.com", ts: "2026-01-01T00:00:00Z" },
    ]);
    expect(again.items["I0"]).toEqual({
      applyCount: 2,
      lastUsedAt: "2026-11-09T00:00:00Z",
    });
    expect(again.recent["a@example.com"]?.[0]).toBe("I0");
  });
});

describe("trigger reinstall", () => {
  it("reinstalls once when TRIGGERS_VERSION is stale, not when the lock is busy", () => {
    expect(ensureTriggers(world.services)).toBe(false);
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    world.lock.holdElsewhere();
    expect(ensureTriggers(world.services)).toBe(false);
    world.lock.holdElsewhere(false);
    expect(ensureTriggers(world.services)).toBe(true);
    expect(world.scriptApp.triggers).toHaveLength(3);
    expect(ensureTriggers(world.services)).toBe(false);
  });
});

describe("loadIndex for jobs", () => {
  it("is shared by rollAudit and the request path", () => {
    expect(loadIndex(world.services).rev).toBe(fileIndex().rev);
  });
});
