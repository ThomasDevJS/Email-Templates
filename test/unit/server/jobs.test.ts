import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuditEvent, IndexDoc } from "../../../src/shared/model/data";
import {
  BUFFER_MAX,
  bufferEvent,
  readBuffer,
  type BufferedEvent,
} from "../../../src/server/audit/buffer";
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
import {
  applyUsage,
  appliesSince,
  RECENT_MAX,
  windowStart,
} from "../../../src/server/audit/usage";
import { readMeta } from "../../../src/shared/cache/chunked";
import { INDEX_PREFIX, loadIndex } from "../../../src/server/cache/indexCache";
import {
  BACKUPS_KEPT,
  oldestKeptMonth,
  runDaily,
} from "../../../src/server/jobs/daily";
import { lastErrorKey } from "../../../src/server/jobs/health";
import { runTick } from "../../../src/server/jobs/tick";
import {
  ensureTriggers,
  TRIGGERS_VERSION,
  TRIGGERS_VERSION_KEY,
} from "../../../src/server/jobs/triggers";
import { snapshotProps } from "../../../src/server/metrics";
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
    expect(usage.items["I1"]).toEqual({
      applyCount: 2,
      lastUsedAt: ts,
      days: { [ts.slice(0, 10)]: 2 },
    });
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
      indexCache: "fresh",
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
    expect(() => rollAudit(world.services)).toThrow("The library is busy");
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
    expect(() => runDaily(world.services)).toThrow(
      "purged (The library is busy",
    );
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
      days: { "2026-11-09": 1 },
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

  it("reinstalls once when 2 executions both read the stale version before either took the lock", () => {
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    const first = snapshotProps(world.props);
    const second = snapshotProps(world.props);
    expect(first.getProperty(TRIGGERS_VERSION_KEY)).toBe("0");
    expect(second.getProperty(TRIGGERS_VERSION_KEY)).toBe("0");
    const created = () => world.scriptApp.triggers.map((t) => t.id);
    expect(
      ensureTriggers({ ...world.services, props: first }, world.props),
    ).toBe(true);
    const afterFirst = created();
    expect(
      ensureTriggers({ ...world.services, props: second }, world.props),
    ).toBe(false);
    expect(created()).toEqual(afterFirst);
  });

  it("creates the new set before it deletes the old one (spec Q23)", () => {
    const old = world.scriptApp.triggers.map((t) => t.id);
    const deleteTrigger = world.scriptApp.deleteTrigger.bind(world.scriptApp);
    const countsAtDelete: number[] = [];
    world.scriptApp.deleteTrigger = (trigger) => {
      countsAtDelete.push(world.scriptApp.triggers.length);
      deleteTrigger(trigger);
    };
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    expect(ensureTriggers(world.services)).toBe(true);
    expect(countsAtDelete[0]).toBe(6);
    expect(world.scriptApp.triggers).toHaveLength(3);
    expect(world.scriptApp.triggers.map((t) => t.id)).not.toContain(old[0]);
  });

  it("keeps the old triggers and records the job error when a create fails", () => {
    const old = world.scriptApp.triggers.map((t) => t.id);
    const newTrigger = world.scriptApp.newTrigger.bind(world.scriptApp);
    world.scriptApp.newTrigger = (handler) =>
      handler === "daily"
        ? {
            timeBased: () => {
              throw new Error("Trigger quota");
            },
          }
        : newTrigger(handler);
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    expect(() => ensureTriggers(world.services)).toThrow("Trigger quota");
    expect(world.scriptApp.triggers.map((t) => t.id)).toEqual(old);
    expect(world.props.getProperty(lastErrorKey("triggers"))).toContain(
      "Error: Trigger quota",
    );
    expect(world.props.getProperty(TRIGGERS_VERSION_KEY)).toBe("0");
    expect(world.lock.hasLock()).toBe(false);
  });

  it("deletes the other old triggers when one delete fails, and the next run leaves 3 (slice 6a minor 4)", () => {
    const deleteTrigger = world.scriptApp.deleteTrigger.bind(world.scriptApp);
    const firstOld = world.scriptApp.triggers[0]?.id;
    world.scriptApp.deleteTrigger = (trigger) => {
      if (trigger.getUniqueId() === firstOld) throw new Error("Delete refused");
      deleteTrigger(trigger);
    };
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    expect(() => ensureTriggers(world.services)).toThrow("Delete refused");
    expect(world.scriptApp.triggers).toHaveLength(4);
    expect(world.props.getProperty(TRIGGERS_VERSION_KEY)).toBe("0");
    expect(world.props.getProperty(lastErrorKey("triggers"))).toContain(
      "Delete refused",
    );
    world.scriptApp.deleteTrigger = deleteTrigger;
    expect(ensureTriggers(world.services)).toBe(true);
    expect(world.scriptApp.triggers).toHaveLength(3);
    expect(world.props.getProperty(TRIGGERS_VERSION_KEY)).toBe(
      TRIGGERS_VERSION,
    );
  });

  it("keeps the create error when removing the new triggers also fails", () => {
    const newTrigger = world.scriptApp.newTrigger.bind(world.scriptApp);
    world.scriptApp.newTrigger = (handler) =>
      handler === "daily"
        ? {
            timeBased: () => {
              throw new Error("Trigger quota");
            },
          }
        : newTrigger(handler);
    world.scriptApp.deleteTrigger = () => {
      throw new Error("Delete refused");
    };
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    expect(() => ensureTriggers(world.services)).toThrow("Trigger quota");
  });

  it("tick reinstalls after a deploy changed TRIGGERS_VERSION", () => {
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    expect(runTick(world.services).triggers).toBe(true);
    expect(world.props.getProperty(TRIGGERS_VERSION_KEY)).toBe(
      TRIGGERS_VERSION,
    );
    expect(runTick(world.services).triggers).toBe(false);
  });
});

const APPLY: BufferedEvent = {
  kind: "apply",
  itemId: "I1",
  actor: "a@example.com",
  ts: "2026-11-09T12:00:00.000Z",
};

describe("event buffer cap", () => {
  it(`keeps ${String(BUFFER_MAX)} events, counts the drops and records them as one audit event`, () => {
    for (let n = 0; n < BUFFER_MAX + 7; n++)
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: denied(`d${String(n)}`),
      });
    const buffered = readBuffer(world.cache);
    expect(buffered.events).toHaveLength(BUFFER_MAX);
    expect(buffered.dropped).toBe(7);
    expect(runTick(world.services)).toMatchObject({
      denied: BUFFER_MAX,
      dropped: 7,
    });
    const pending = fileIndex().pendingAudit;
    expect(pending).toHaveLength(BUFFER_MAX + 1);
    expect(pending.at(-1)).toMatchObject({
      action: "audit.dropped",
      actor: "system",
      after: { dropped: 7 },
    });
    expect(readBuffer(world.cache).dropped).toBe(0);
    expect(runTick(world.services)).toMatchObject({ denied: 0, dropped: 0 });
  });

  it("drops denied events first: an apply event takes the slot of a denied one in a full buffer", () => {
    for (let n = 0; n < BUFFER_MAX; n++)
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: denied(`d${String(n)}`),
      });
    expect(bufferEvent(world.cache, world.lock, APPLY)).toBe(true);
    expect(
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: denied("late"),
      }),
    ).toBe(false);
    const buffered = readBuffer(world.cache);
    expect(buffered.events).toHaveLength(BUFFER_MAX);
    expect(buffered.dropped).toBe(2);
    expect(runTick(world.services)).toMatchObject({
      applies: 1,
      denied: BUFFER_MAX - 1,
      dropped: 2,
    });
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "audit.dropped",
      after: { dropped: 2 },
    });
    expect(world.services.store().readSide("usage").items["I1"]).toBeDefined();
  });

  it("counts apply and denied events lost to a busy lock once", () => {
    const tryLock = world.lock.tryLock.bind(world.lock);
    world.lock.tryLock = () => false;
    expect(bufferEvent(world.cache, world.lock, APPLY)).toBe(false);
    expect(
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: denied("busy"),
      }),
    ).toBe(false);
    world.lock.tryLock = tryLock;
    expect(runTick(world.services)).toMatchObject({ dropped: 2 });
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "audit.dropped",
      after: { dropped: 2 },
    });
    expect(runTick(world.services)).toMatchObject({ dropped: 0 });
    world.lock.tryLock = () => false;
    bufferEvent(world.cache, world.lock, APPLY);
    world.lock.tryLock = tryLock;
    expect(runTick(world.services)).toMatchObject({ dropped: 1 });
  });

  it("counts every busy-lock loss after 6 quiet hours (the count and its mark expire together)", () => {
    const tryLock = world.lock.tryLock.bind(world.lock);
    const lose = (n: number) => {
      world.lock.tryLock = () => false;
      for (let k = 0; k < n; k++) bufferEvent(world.cache, world.lock, APPLY);
      world.lock.tryLock = tryLock;
    };
    lose(5);
    expect(runTick(world.services)).toMatchObject({ dropped: 5 });
    for (let hour = 0; hour < 5; hour++) {
      world.clock.now += 60 * 60 * 1000;
      expect(runTick(world.services)).toMatchObject({ dropped: 0 });
    }
    // The losses arrive after the 6 h TTL of the first count, before the next tick.
    world.clock.now += 61 * 60 * 1000;
    lose(7);
    expect(runTick(world.services)).toMatchObject({ dropped: 7 });
  });

  it("drops an apply event when the full buffer holds no denied event, and counts it", () => {
    for (let n = 0; n < BUFFER_MAX; n++)
      bufferEvent(world.cache, world.lock, APPLY);
    expect(bufferEvent(world.cache, world.lock, APPLY)).toBe(false);
    expect(readBuffer(world.cache).dropped).toBe(1);
  });

  it("stores a new event in an evicted slot of a full buffer without counting a drop", () => {
    for (let n = 0; n < BUFFER_MAX; n++)
      bufferEvent(world.cache, world.lock, APPLY);
    world.cache.remove("evt:7");
    expect(
      bufferEvent(world.cache, world.lock, {
        kind: "denied",
        event: denied("late"),
      }),
    ).toBe(true);
    const buffered = readBuffer(world.cache);
    expect(buffered.events).toHaveLength(BUFFER_MAX);
    expect(buffered.dropped).toBe(0);
    expect(bufferEvent(world.cache, world.lock, APPLY)).toBe(true);
    expect(readBuffer(world.cache).dropped).toBe(1);
    expect(bufferEvent(world.cache, world.lock, APPLY)).toBe(false);
    expect(readBuffer(world.cache).dropped).toBe(2);
  });
});

describe("usage days", () => {
  it("counts applies per UTC day and sums the 30 days that end today", () => {
    const usage = applyUsage({ rev: 1, items: {}, recent: {} }, [
      { itemId: "I", actor: "a@example.com", ts: "2026-10-10T10:00:00Z" },
      { itemId: "I", actor: "a@example.com", ts: "2026-10-12T10:00:00Z" },
      { itemId: "I", actor: "a@example.com", ts: "2026-11-09T10:00:00Z" },
      { itemId: "I", actor: "a@example.com", ts: "2026-11-09T11:00:00Z" },
    ]);
    const entry = usage.items["I"];
    expect(entry?.days).toEqual({ "2026-10-12": 1, "2026-11-09": 2 });
    expect(windowStart("2026-11-09T23:00:00Z")).toBe("2026-10-11");
    expect(appliesSince(entry, "2026-10-11")).toBe(3);
    expect(appliesSince(undefined, "2026-10-11")).toBe(0);
  });
});

describe("loadIndex for jobs", () => {
  it("is shared by rollAudit and the request path", () => {
    expect(loadIndex(world.services).rev).toBe(fileIndex().rev);
  });
});
