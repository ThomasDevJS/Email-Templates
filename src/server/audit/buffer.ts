import type { AuditEvent } from "../../shared/model/data";
import { CACHE_TTL_S } from "../../shared/cache/chunked";
import type { CacheStore, ScriptLock } from "../services";

/**
 * Cache buffer for apply and denied events (ADR-0002 Audit storage). Each event is one `evt:<n>` key; `evt:meta`
 * counts them. Buffering waits at most 500 ms for the script lock. The 5-min `tick` moves events to `usage.json`
 * and `pendingAudit`. Eviction can lose up to 5 min (Q14). At BUFFER_MAX events a new event takes an evicted slot;
 * else an apply event takes the slot of a buffered denied event, so a flood of refused calls never pushes out
 * applies. Every other loss counts: full-buffer drops in `evt:dropped`, busy-lock drops in `evt:lost`; `tick`
 * writes both as one `audit.dropped` event.
 */
export const BUFFER_LOCK_MS = 500;
export const BUFFER_MAX = 200;
const META_KEY = "evt:meta";
const DROPPED_KEY = "evt:dropped";
/**
 * Busy-lock drops, counted without the lock, as "<lost> <seen>": `tick` reports `lost - seen` and moves `seen` up.
 * One key, so both numbers expire or are evicted together and the difference stays right.
 */
const LOST_KEY = "evt:lost";

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

function toCount(raw: string | null | undefined): number {
  const parsed = raw === null || raw === undefined ? 0 : Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function count(cache: CacheStore, key = META_KEY): number {
  return toCount(cache.get(key));
}

/** `[lost, seen]` of LOST_KEY; [0, 0] when absent. */
function lostPair(cache: CacheStore): [number, number] {
  const [lost, seen] = (cache.get(LOST_KEY) ?? "").split(" ");
  return [toCount(lost), toCount(seen)];
}

/**
 * The slot a new event may take in a full buffer: an evicted slot first, else (for an apply) a buffered denied
 * event; null when there is none. `evicted` tells whether the slot held nothing.
 */
function slotFor(
  cache: CacheStore,
  n: number,
  kind: BufferedEvent["kind"],
): { key: string; evicted: boolean } | null {
  const keys = Array.from({ length: n }, (_, k) => eventKey(k));
  const found = cache.getAll(keys);
  const free = keys.find((key) => found[key] === undefined);
  if (free !== undefined) return { key: free, evicted: true };
  if (kind === "denied") return null;
  const denied = keys.find(
    (key) =>
      (JSON.parse(found[key] as string) as BufferedEvent).kind === "denied",
  );
  return denied === undefined ? null : { key: denied, evicted: false };
}

/**
 * True when the event is stored. A full buffer stores it in an evicted slot, or an apply in the slot of a denied
 * event, which then counts as dropped. A refused event counts as dropped (full) or lost (lock busy).
 */
export function bufferEvent(
  cache: CacheStore,
  lock: ScriptLock,
  entry: BufferedEvent,
): boolean {
  if (!lock.tryLock(BUFFER_LOCK_MS)) {
    // shortcut: two executions that both miss the lock at the same instant can count once (no atomic increment
    // in CacheService); exact counting would need the lock this path could not get.
    const [lost, seen] = lostPair(cache);
    cache.put(LOST_KEY, `${String(lost + 1)} ${String(seen)}`, CACHE_TTL_S);
    return false;
  }
  try {
    const n = count(cache);
    if (n < BUFFER_MAX) {
      cache.put(eventKey(n), JSON.stringify(entry), CACHE_TTL_S);
      cache.put(META_KEY, String(n + 1), CACHE_TTL_S);
      return true;
    }
    const slot = slotFor(cache, n, entry.kind);
    if (slot !== null) cache.put(slot.key, JSON.stringify(entry), CACHE_TTL_S);
    if (slot?.evicted !== true)
      cache.put(
        DROPPED_KEY,
        String(count(cache, DROPPED_KEY) + 1),
        CACHE_TTL_S,
      );
    return slot !== null;
  } finally {
    lock.releaseLock();
  }
}

export interface Buffered {
  readonly events: BufferedEvent[];
  readonly keys: string[];
  /** Events lost since the last run: full buffer plus busy lock. */
  readonly dropped: number;
  /** `lost` of `evt:lost` as read; `clearBuffer` marks it seen. */
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
  const [lost, seen] = lostPair(cache);
  return {
    events,
    keys,
    dropped: count(cache, DROPPED_KEY) + Math.max(0, lost - seen),
    lostMark: lost,
  };
}

/** Caller holds the script lock and has written the events to their files. */
export function clearBuffer(cache: CacheStore, buffered: Buffered): void {
  cache.removeAll([...buffered.keys, META_KEY, DROPPED_KEY]);
  // Re-read: a busy-lock drop counted since `readBuffer` stays above the mark.
  const [lost] = lostPair(cache);
  if (lost > 0)
    cache.put(
      LOST_KEY,
      `${String(lost)} ${String(buffered.lostMark)}`,
      CACHE_TTL_S,
    );
}
