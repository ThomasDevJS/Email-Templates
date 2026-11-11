import type { AuditEvent } from "../../shared/model/data";
import { CACHE_TTL_S } from "../../shared/cache/chunked";
import type { CacheStore, ScriptLock } from "../services";

/**
 * Cache buffer for apply, denied and change events (ADR-0002 Audit storage). Each event is one `evt:<n>` key;
 * `evt:meta` counts them. Change events are security events without an index write of their own (export). Buffering
 * waits at most 500 ms for the script lock and otherwise drops the event (the console log line stays). The 5-min
 * `tick` moves events to `usage.json` and `pendingAudit`. Eviction can lose up to 5 min (Q14). At BUFFER_MAX events
 * a new denied event is dropped, and a new apply or change event takes the slot of a buffered denied event, so a
 * flood of refused calls never pushes out applies or changes. Every drop counts in `evt:dropped`, so the flood
 * neither crowds the 1,000-item Script Cache nor grows `pendingAudit` by more than BUFFER_MAX per `tick`.
 */
export const BUFFER_LOCK_MS = 500;
export const BUFFER_MAX = 200;
const META_KEY = "evt:meta";
const DROPPED_KEY = "evt:dropped";

export type BufferedEvent =
  | {
      readonly kind: "apply";
      readonly itemId: string;
      readonly actor: string;
      readonly ts: string;
    }
  | { readonly kind: "denied" | "change"; readonly event: AuditEvent };

function eventKey(n: number): string {
  return `evt:${String(n)}`;
}

function count(cache: CacheStore, key = META_KEY): number {
  const raw = cache.get(key);
  const parsed = raw === null ? 0 : Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/** The key of a buffered denied event, or null when none is left (all applies and changes, or evicted). */
function deniedSlot(cache: CacheStore, n: number): string | null {
  const keys = Array.from({ length: n }, (_, k) => eventKey(k));
  const found = cache.getAll(keys);
  return (
    keys.find((key) => {
      const raw = found[key];
      return (
        raw !== undefined &&
        (JSON.parse(raw) as BufferedEvent).kind === "denied"
      );
    }) ?? null
  );
}

/**
 * Returns false when the lock was busy or the event was dropped. When full, a denied event is dropped, and an
 * apply or change event replaces a buffered denied event (dropped instead); either drop counts.
 */
export function bufferEvent(
  cache: CacheStore,
  lock: ScriptLock,
  entry: BufferedEvent,
): boolean {
  if (!lock.tryLock(BUFFER_LOCK_MS)) return false;
  try {
    const n = count(cache);
    if (n < BUFFER_MAX) {
      cache.put(eventKey(n), JSON.stringify(entry), CACHE_TTL_S);
      cache.put(META_KEY, String(n + 1), CACHE_TTL_S);
      return true;
    }
    const slot = entry.kind === "denied" ? null : deniedSlot(cache, n);
    if (slot !== null) cache.put(slot, JSON.stringify(entry), CACHE_TTL_S);
    cache.put(DROPPED_KEY, String(count(cache, DROPPED_KEY) + 1), CACHE_TTL_S);
    return slot !== null;
  } finally {
    lock.releaseLock();
  }
}

export interface Buffered {
  readonly events: BufferedEvent[];
  readonly keys: string[];
  /** Events refused because the buffer was full. */
  readonly dropped: number;
}

/** Caller holds the script lock. Evicted entries are skipped. */
export function readBuffer(cache: CacheStore): Buffered {
  const keys = Array.from({ length: count(cache) }, (_, n) => eventKey(n));
  const found = keys.length === 0 ? {} : cache.getAll(keys);
  const events = keys
    .map((key) => found[key])
    .filter((raw): raw is string => raw !== undefined)
    .map((raw) => JSON.parse(raw) as BufferedEvent);
  return { events, keys, dropped: count(cache, DROPPED_KEY) };
}

/** Caller holds the script lock and has written the events to their files. */
export function clearBuffer(cache: CacheStore, buffered: Buffered): void {
  cache.removeAll([...buffered.keys, META_KEY, DROPPED_KEY]);
}
