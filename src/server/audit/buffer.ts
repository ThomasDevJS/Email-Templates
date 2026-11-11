import type { AuditEvent } from "../../shared/model/data";
import { CACHE_TTL_S } from "../../shared/cache/chunked";
import type { CacheStore, ScriptLock } from "../services";

/**
 * Cache buffer for apply, denied and change events (ADR-0002 Audit storage). Each event is one `evt:<n>` key;
 * `evt:meta` counts them. Change events are security events without an index write of their own (export pages).
 * Buffering waits at most 500 ms for the script lock. The 5-min `tick` moves events to `usage.json` and
 * `pendingAudit`. Eviction can lose up to 5 min (Q14). At BUFFER_MAX events a new event takes the slot of a buffered
 * event of a lower rank (denied < apply < change), else it is refused. A change event is never lost: its caller
 * refuses the request when it is not stored. A lost apply or denied event counts: full-buffer drops in
 * `evt:dropped`, busy-lock drops in `evt:lost`; `tick` writes both as one `audit.dropped` event.
 */
export const BUFFER_LOCK_MS = 500;
export const BUFFER_MAX = 200;
const META_KEY = "evt:meta";
const DROPPED_KEY = "evt:dropped";
/** Busy-lock drops, counted without the lock; never cleared, so `tick` takes the rise since `evt:lostSeen`. */
const LOST_KEY = "evt:lost";
const LOST_SEEN_KEY = "evt:lostSeen";

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

const RANK: Readonly<Record<BufferedEvent["kind"], number>> = {
  denied: 0,
  apply: 1,
  change: 2,
};

/** The key of a buffered event ranked below `rank`, lowest rank first; null when there is none. */
function weakerSlot(cache: CacheStore, n: number, rank: number): string | null {
  const keys = Array.from({ length: n }, (_, k) => eventKey(k));
  const found = cache.getAll(keys);
  let best: { key: string; rank: number } | null = null;
  for (const key of keys) {
    const raw = found[key];
    if (raw === undefined) continue;
    const held = RANK[(JSON.parse(raw) as BufferedEvent).kind];
    if (held < rank && (best === null || held < best.rank))
      best = { key, rank: held };
  }
  return best?.key ?? null;
}

const bump = (cache: CacheStore, key: string) => {
  cache.put(key, String(count(cache, key) + 1), CACHE_TTL_S);
};

/**
 * True when the event is stored. A full buffer stores it in the slot of a lower-ranked event, which then counts
 * as dropped. A refused apply or denied event counts as dropped (full) or lost (lock busy); a refused change event
 * counts nowhere, because its request is refused.
 */
export function bufferEvent(
  cache: CacheStore,
  lock: ScriptLock,
  entry: BufferedEvent,
): boolean {
  const lossy = entry.kind !== "change";
  if (!lock.tryLock(BUFFER_LOCK_MS)) {
    // shortcut: two executions that both miss the lock at the same instant can count once (no atomic increment
    // in CacheService); exact counting would need the lock this path could not get.
    if (lossy) bump(cache, LOST_KEY);
    return false;
  }
  try {
    const n = count(cache);
    if (n < BUFFER_MAX) {
      cache.put(eventKey(n), JSON.stringify(entry), CACHE_TTL_S);
      cache.put(META_KEY, String(n + 1), CACHE_TTL_S);
      return true;
    }
    const slot = weakerSlot(cache, n, RANK[entry.kind]);
    if (slot !== null) cache.put(slot, JSON.stringify(entry), CACHE_TTL_S);
    if (slot !== null || lossy) bump(cache, DROPPED_KEY);
    return slot !== null;
  } finally {
    lock.releaseLock();
  }
}

export interface Buffered {
  readonly events: BufferedEvent[];
  readonly keys: string[];
  /** Apply and denied events lost since the last run: full buffer plus busy lock. */
  readonly dropped: number;
  /** `evt:lost` as read; `clearBuffer` marks it seen. */
  readonly lostMark: number;
}

/** Caller holds the script lock. Evicted entries are skipped. */
export function readBuffer(cache: CacheStore): Buffered {
  const keys = Array.from({ length: count(cache) }, (_, n) => eventKey(n));
  const found = keys.length === 0 ? {} : cache.getAll(keys);
  const events = keys
    .map((key) => found[key])
    .filter((raw): raw is string => raw !== undefined)
    .map((raw) => JSON.parse(raw) as BufferedEvent);
  const lost = count(cache, LOST_KEY);
  const seen = count(cache, LOST_SEEN_KEY);
  // A counter that expired starts again below the mark: all of it is new.
  const newLost = lost >= seen ? lost - seen : lost;
  return {
    events,
    keys,
    dropped: count(cache, DROPPED_KEY) + newLost,
    lostMark: lost,
  };
}

/** Caller holds the script lock and has written the events to their files. */
export function clearBuffer(cache: CacheStore, buffered: Buffered): void {
  cache.removeAll([...buffered.keys, META_KEY, DROPPED_KEY]);
  cache.put(LOST_SEEN_KEY, String(buffered.lostMark), CACHE_TTL_S);
}
