import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHUNK_BYTES,
  chunkKey,
  getChunked,
  putChunked,
  readMeta,
  splitByBytes,
} from "../../../src/shared/cache/chunked";
import {
  INDEX_PREFIX,
  INDEX_REV_KEY,
  loadIndex,
  loadIndexForWrite,
} from "../../../src/server/cache/indexCache";
import {
  CACHE_ITEM_LIMIT,
  CACHE_VALUE_LIMIT_BYTES,
  FakeCache,
} from "../../fakes/cache";
import { OWNER, setupWorld, type World } from "../../fakes/world";

describe("splitByBytes", () => {
  it("cuts on UTF-8 byte counts, never inside a character", () => {
    expect(splitByBytes("abcdef", 4)).toEqual(["abcd", "ef"]);
    expect(splitByBytes("éééé", 5)).toEqual(["éé", "éé"]);
    expect(splitByBytes("a😀b", 4)).toEqual(["a", "😀", "b"]);
    expect(splitByBytes("", 4)).toEqual([""]);
  });

  it("keeps every 90 KB chunk under the 100 KB cache value limit", () => {
    const text = "Grüße 😀 ".repeat(40000);
    const chunks = splitByBytes(text, CHUNK_BYTES);
    expect(chunks.join("")).toBe(text);
    for (const chunk of chunks)
      expect(Buffer.byteLength(chunk)).toBeLessThanOrEqual(
        CACHE_VALUE_LIMIT_BYTES,
      );
  });
});

describe("chunked cache sets (ADR-0002 Caching)", () => {
  let now: number;
  let cache: FakeCache;

  beforeEach(() => {
    now = 1000;
    cache = new FakeCache(() => now);
  });

  it("puts `prefix:rev:n` chunks plus meta and reads them back in one getAll", () => {
    const text = "x".repeat(CHUNK_BYTES * 2 + 10);
    putChunked(cache, "idx", "4", text, now);
    expect(readMeta(cache, "idx")).toEqual({
      rev: "4",
      chunkCount: 3,
      builtAt: 1000,
    });
    expect(cache.get(chunkKey("idx", "4", 2))).toBe("x".repeat(10));
    expect(getChunked(cache, "idx", "4")).toBe(text);
    expect(getChunked(cache, "idx")).toBe(text);
  });

  it("misses when the meta names another rev, so readers never mix builds", () => {
    putChunked(cache, "idx", "4", "old", now);
    putChunked(cache, "idx", "5", "new", now);
    expect(getChunked(cache, "idx", "4")).toBeNull();
    expect(getChunked(cache, "idx", "5")).toBe("new");
  });

  it("misses when one chunk is gone or the meta is unreadable", () => {
    putChunked(cache, "idx", "1", "y".repeat(CHUNK_BYTES * 3), now);
    cache.remove(chunkKey("idx", "1", 1));
    expect(getChunked(cache, "idx", "1")).toBeNull();
    cache.put("idx:meta", "{oops");
    expect(readMeta(cache, "idx")).toBeNull();
  });

  it("misses after FIFO eviction removes chunks from the middle of a set", () => {
    putChunked(cache, "idx", "1", "z".repeat(CHUNK_BYTES * 10), now);
    cache.remove(chunkKey("idx", "1", 0));
    cache.put(chunkKey("idx", "1", 0), "z".repeat(CHUNK_BYTES));
    for (let n = 0; n < CACHE_ITEM_LIMIT - 5; n++)
      cache.put(`other:${String(n)}`, "v");
    expect(cache.get(chunkKey("idx", "1", 0))).not.toBeNull();
    expect(cache.get(chunkKey("idx", "1", 5))).toBeNull();
    expect(getChunked(cache, "idx", "1")).toBeNull();
  });

  it("misses after the 6 h TTL", () => {
    putChunked(cache, "idx", "1", "t", now);
    now += 21600 * 1000;
    expect(getChunked(cache, "idx", "1")).toBeNull();
  });
});

describe("index cache", () => {
  let world: World;

  beforeEach(() => {
    world = setupWorld();
  });

  afterEach(() => {
    expect(world.lock.nestedAcquisitions).toBe(0);
  });

  it("rebuilds on a miss under the lock, then hits", () => {
    const first = loadIndex(world.services);
    expect(world.services.stats.cache).toBe("rebuild");
    expect(world.props.getProperty(INDEX_REV_KEY)).toBe(String(first.rev));
    expect(loadIndex(world.services)).toEqual(first);
    expect(world.services.stats.cache).toBe("hit");
    expect(world.lock.hasLock()).toBe(false);
  });

  it("reads Drive without touching the cache when the lock is busy", () => {
    world.lock.holdElsewhere();
    const doc = loadIndex(world.services);
    expect(doc.rev).toBe(1);
    expect(world.services.stats.cache).toBe("miss");
    expect(readMeta(world.cache, INDEX_PREFIX)).toBeNull();
  });

  it("rebuilds after eviction in the middle of a large index", () => {
    for (let n = 0; n < 6; n++)
      world.ok(OWNER, "folder.create", {
        name: `F${String(n)} ${"x".repeat(70)}`,
      });
    const big = loadIndex(world.services);
    const padded = {
      ...big,
      pendingAudit: Array.from({ length: 400 }, () => big.pendingAudit[0]),
    };
    putChunked(
      world.cache,
      INDEX_PREFIX,
      String(big.rev),
      JSON.stringify(padded),
      world.clock.now,
    );
    const meta = readMeta(world.cache, INDEX_PREFIX);
    expect(meta?.chunkCount).toBeGreaterThan(3);
    world.cache.remove(chunkKey(INDEX_PREFIX, String(big.rev), 1));
    const reloaded = loadIndex(world.services);
    expect(world.services.stats.cache).toBe("rebuild");
    expect(reloaded).toEqual(big);
  });

  it("uses the cached index for a writer only when its rev matches the file", () => {
    loadIndex(world.services);
    expect(loadIndexForWrite(world.services).rev).toBe(1);
    expect(world.services.stats.cache).toBe("hit");
    const store = world.services.store();
    store.writeIndex({ ...store.readIndex(), rev: 9 });
    expect(loadIndexForWrite(world.services).rev).toBe(9);
    expect(world.services.stats.cache).toBe("rebuild");
  });

  it("survives a failed cache put: the next reader rebuilds", () => {
    const failing = {
      ...world.services,
      cache: {
        putAll: () => {
          throw new Error("Argument too large");
        },
        get: world.cache.get.bind(world.cache),
        getAll: world.cache.getAll.bind(world.cache),
        put: world.cache.put.bind(world.cache),
        removeAll: world.cache.removeAll.bind(world.cache),
      },
    };
    expect(loadIndex(failing).rev).toBe(1);
    expect(
      world.lines.some((line) => line.includes('"action":"cache.put"')),
    ).toBe(true);
  });
});
