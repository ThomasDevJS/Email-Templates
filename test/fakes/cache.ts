/**
 * In-memory CacheService. Models the limits that matter (ADR-0005 Tests): 100 KB per value,
 * 250-character keys, 1,000 items per cache with oldest-first eviction, TTL up to 6 h.
 */
export const CACHE_VALUE_LIMIT_BYTES = 100 * 1024;
export const CACHE_KEY_LIMIT = 250;
export const CACHE_ITEM_LIMIT = 1000;
export const CACHE_DEFAULT_TTL_S = 600;
export const CACHE_MAX_TTL_S = 21600;

interface Entry {
  readonly value: string;
  readonly expiresAtMs: number;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export class FakeCache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly nowMs: () => number) {}

  get(key: string): string | null {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAtMs <= this.nowMs()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  getAll(keys: string[]): Record<string, string> {
    const found: Record<string, string> = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) found[key] = value;
    }
    return found;
  }

  put(
    key: string,
    value: string,
    ttlSeconds: number = CACHE_DEFAULT_TTL_S,
  ): void {
    if (key.length > CACHE_KEY_LIMIT)
      throw new Error(`Cache key longer than ${String(CACHE_KEY_LIMIT)}`);
    if (byteLength(value) > CACHE_VALUE_LIMIT_BYTES)
      throw new Error("Argument too large: value");
    const ttl = Math.min(ttlSeconds, CACHE_MAX_TTL_S);
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAtMs: this.nowMs() + ttl * 1000 });
    this.evictOldest();
  }

  putAll(values: Record<string, string>, ttlSeconds?: number): void {
    for (const [key, value] of Object.entries(values))
      this.put(key, value, ttlSeconds);
  }

  remove(key: string): void {
    this.entries.delete(key);
  }

  removeAll(keys: string[]): void {
    for (const key of keys) this.entries.delete(key);
  }

  size(): number {
    return this.entries.size;
  }

  private evictOldest(): void {
    while (this.entries.size > CACHE_ITEM_LIMIT) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) return;
      this.entries.delete(oldest.value);
    }
  }
}

export interface FakeCacheService {
  readonly script: FakeCache;
  readonly user: FakeCache;
  getScriptCache(): FakeCache;
  getUserCache(): FakeCache;
  getDocumentCache(): null;
}

export function createCacheService(
  nowMs: () => number = () => Date.now(),
): FakeCacheService {
  const script = new FakeCache(nowMs);
  const user = new FakeCache(nowMs);
  return {
    script,
    user,
    getScriptCache: () => script,
    getUserCache: () => user,
    getDocumentCache: () => null,
  };
}
