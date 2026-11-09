import { describe, expect, it } from "vitest";
import {
  CACHE_ITEM_LIMIT,
  CACHE_MAX_TTL_S,
  CACHE_VALUE_LIMIT_BYTES,
  createCacheService,
} from "../fakes/cache";
import { createLockService } from "../fakes/lock";
import {
  PROPERTY_VALUE_LIMIT_BYTES,
  createPropertiesService,
} from "../fakes/properties";
import { TRIGGER_LIMIT, createScriptApp } from "../fakes/scriptApp";
import { createSession } from "../fakes/session";

describe("fake CacheService", () => {
  it("rejects values over 100 KB and accepts exactly 100 KB", () => {
    const cache = createCacheService().getScriptCache();
    expect(() => {
      cache.put("big", "x".repeat(CACHE_VALUE_LIMIT_BYTES + 1));
    }).toThrow(/too large/);
    cache.put("max", "x".repeat(CACHE_VALUE_LIMIT_BYTES));
    expect(cache.get("max")).toHaveLength(CACHE_VALUE_LIMIT_BYTES);
  });

  it("rejects keys over 250 characters", () => {
    expect(() => {
      createCacheService().getScriptCache().put("k".repeat(251), "v");
    }).toThrow(/key/);
  });

  it("evicts the oldest item beyond 1,000 items", () => {
    const cache = createCacheService().getScriptCache();
    for (let i = 0; i <= CACHE_ITEM_LIMIT; i++) cache.put(`k${String(i)}`, "v");
    expect(cache.size()).toBe(CACHE_ITEM_LIMIT);
    expect(cache.get("k0")).toBeNull();
    expect(cache.get("k1")).toBe("v");
  });

  it("treats a re-put key as newest", () => {
    const cache = createCacheService().getScriptCache();
    for (let i = 0; i < CACHE_ITEM_LIMIT; i++) cache.put(`k${String(i)}`, "v");
    cache.put("k0", "again");
    cache.put("extra", "v");
    expect(cache.get("k0")).toBe("again");
    expect(cache.get("k1")).toBeNull();
  });

  it("expires entries after the TTL, capped at 6 h", () => {
    let now = 0;
    const cache = createCacheService(() => now).getScriptCache();
    cache.put("short", "v", 10);
    cache.put("long", "v", CACHE_MAX_TTL_S * 10);
    now = 10_000;
    expect(cache.get("short")).toBeNull();
    now = CACHE_MAX_TTL_S * 1000 - 1;
    expect(cache.get("long")).toBe("v");
    now = CACHE_MAX_TTL_S * 1000;
    expect(cache.get("long")).toBeNull();
  });

  it("supports getAll, putAll, remove and removeAll; keeps script and user caches apart", () => {
    const service = createCacheService();
    const cache = service.getScriptCache();
    cache.putAll({ a: "1", b: "2", c: "3" });
    cache.remove("a");
    cache.removeAll(["b"]);
    expect(cache.getAll(["a", "b", "c"])).toEqual({ c: "3" });
    expect(service.getUserCache().get("c")).toBeNull();
    expect(service.getDocumentCache()).toBeNull();
  });
});

describe("fake PropertiesService", () => {
  it("rejects values over 9 KB", () => {
    const props = createPropertiesService().getScriptProperties();
    expect(() =>
      props.setProperty("k", "x".repeat(PROPERTY_VALUE_LIMIT_BYTES + 1)),
    ).toThrow(/too large/);
  });

  it("stores, lists and deletes properties per store", () => {
    const service = createPropertiesService();
    const props = service.getScriptProperties();
    props.setProperties({ A: "1", B: "2" }).deleteProperty("A");
    expect(props.getProperties()).toEqual({ B: "2" });
    expect(props.getKeys()).toEqual(["B"]);
    expect(service.getUserProperties().getProperty("B")).toBeNull();
    props.deleteAllProperties();
    expect(props.getProperty("B")).toBeNull();
    expect(service.getDocumentProperties()).toBeNull();
  });
});

describe("fake LockService", () => {
  it("grants a free lock and releases it", () => {
    const lock = createLockService().getScriptLock();
    expect(lock.tryLock(500)).toBe(true);
    expect(lock.hasLock()).toBe(true);
    lock.releaseLock();
    expect(lock.hasLock()).toBe(false);
  });

  it("times out while another execution holds the lock", () => {
    const service = createLockService();
    service.script.holdElsewhere();
    expect(service.getScriptLock().tryLock(500)).toBe(false);
    expect(() => {
      service.getScriptLock().waitLock(500);
    }).toThrow(/Lock timeout/);
    expect(service.getUserLock().tryLock(0)).toBe(true);
    expect(() => service.getUserLock().tryLock(-1)).toThrow();
    expect(service.getDocumentLock()).toBeNull();
  });
});

describe("fake ScriptApp triggers", () => {
  it("creates, lists and deletes time-driven triggers", () => {
    const app = createScriptApp();
    const tick = app.newTrigger("tick").timeBased().everyMinutes(5).create();
    app.newTrigger("refreshMembers").timeBased().everyMinutes(15).create();
    app.newTrigger("daily").timeBased().everyDays(1).atHour(2).create();
    app.newTrigger("hourly").timeBased().everyHours(1).create();
    expect(
      app
        .getProjectTriggers()
        .map((t) => `${t.getHandlerFunction()} ${t.schedule}`),
    ).toEqual([
      "tick every 5 min",
      "refreshMembers every 15 min",
      "daily every 1 d at 2h",
      "hourly every 1 h",
    ]);
    app.deleteTrigger(tick);
    expect(app.getProjectTriggers().map((t) => t.getUniqueId())).toEqual([
      "trigger-2",
      "trigger-3",
      "trigger-4",
    ]);
  });

  it("refuses the 21st trigger", () => {
    const app = createScriptApp();
    for (let i = 0; i < TRIGGER_LIMIT; i++)
      app.newTrigger("f").timeBased().everyHours(1).create();
    expect(() =>
      app.newTrigger("f").timeBased().everyHours(1).create(),
    ).toThrow(/too many/);
  });
});

describe("fake Session", () => {
  it("returns a blank active user when unidentified, the owner as effective user", () => {
    const session = createSession("");
    expect(session.getActiveUser().getEmail()).toBe("");
    expect(session.getTemporaryActiveUserKey()).toBe("");
    expect(session.getEffectiveUser().getEmail()).toBe("owner@example.com");
    session.activeEmail = "user@example.com";
    expect(session.getTemporaryActiveUserKey()).toBe("key-user@example.com");
  });
});
