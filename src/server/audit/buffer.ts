import type { AuditEvent } from "../../shared/model/data";
import { CACHE_TTL_S } from "../cache/chunked";
import type { CacheStore, ScriptLock } from "../services";

/**
 * Cache buffer for apply and denied events (ADR-0002 Audit storage). Each event is one `evt:<n>` key; `evt:meta`
 * counts them. Buffering waits at most 500 ms for the script lock and otherwise drops the event (the console log
 * line stays). The 5-min `tick` moves events to `usage.json` and `pendingAudit`. Eviction can lose up to 5 min (Q14).
 */
export const BUFFER_LOCK_MS = 500;
const META_KEY = "evt:meta";

export type BufferedEvent =
  | {
      readonly kind: "apply";
      readonly itemId: string;
      readonly actor: string;
      readonly ts: string;
    }
  | { readonly kind: "denied"; readonly event: AuditEvent };

function eventKey(n: number): string {
  return `evt:${String(n)}`;
}

function count(cache: CacheStore): number {
  const raw = cache.get(META_KEY);
  const parsed = raw === null ? 0 : Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/** Returns false when the lock was busy and the event was not buffered. */
export function bufferEvent(
  cache: CacheStore,
  lock: ScriptLock,
  entry: BufferedEvent,
): boolean {
  if (!lock.tryLock(BUFFER_LOCK_MS)) return false;
  try {
    const n = count(cache);
    cache.put(eventKey(n), JSON.stringify(entry), CACHE_TTL_S);
    cache.put(META_KEY, String(n + 1), CACHE_TTL_S);
    return true;
  } finally {
    lock.releaseLock();
  }
}

export interface Buffered {
  readonly events: BufferedEvent[];
  readonly keys: string[];
}

/** Caller holds the script lock. Evicted entries are skipped. */
export function readBuffer(cache: CacheStore): Buffered {
  const keys = Array.from({ length: count(cache) }, (_, n) => eventKey(n));
  const found = keys.length === 0 ? {} : cache.getAll(keys);
  const events = keys
    .map((key) => found[key])
    .filter((raw): raw is string => raw !== undefined)
    .map((raw) => JSON.parse(raw) as BufferedEvent);
  return { events, keys };
}

/** Caller holds the script lock and has written the events to their files. */
export function clearBuffer(cache: CacheStore, buffered: Buffered): void {
  cache.removeAll([...buffered.keys, META_KEY]);
}
