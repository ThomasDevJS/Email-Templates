import type { UsageDoc, UsageEntry } from "../../shared/model/data";

/** Apply counts and per-user recent lists in `usage.json` (spec section 5.5). */
export const RECENT_MAX = 20;
/** Days of per-day counts kept per template, for the Usage tab's "Applies 30 d" (wireframe 06). */
export const USAGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ApplyEvent {
  readonly itemId: string;
  readonly actor: string;
  readonly ts: string;
}

/** First UTC day (`YYYY-MM-DD`) of the 30-day window that ends on the day of `ts`. */
export function windowStart(ts: string): string {
  const day = Date.parse(ts.slice(0, 10));
  return new Date(day - (USAGE_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** Applies on days from `from` (`YYYY-MM-DD`) on. */
export function appliesSince(
  entry: UsageEntry | undefined,
  from: string,
): number {
  return Object.entries(entry?.days ?? {})
    .filter(([day]) => day >= from)
    .reduce((sum, [, count]) => sum + count, 0);
}

/** Counts `ts` on its day and keeps only the 30 days that end on the day of `latest`. */
function bumpDays(
  days: Readonly<Record<string, number>>,
  ts: string,
  latest: string,
): Record<string, number> {
  const from = windowStart(latest);
  const day = ts.slice(0, 10);
  const kept = Object.fromEntries(
    Object.entries(days).filter(([key]) => key >= from),
  );
  return day < from ? kept : { ...kept, [day]: (days[day] ?? 0) + 1 };
}

function bump(entry: UsageEntry | undefined, ts: string): UsageEntry {
  const last = entry?.lastUsedAt ?? "";
  const latest = ts > last ? ts : last;
  return {
    applyCount: (entry?.applyCount ?? 0) + 1,
    lastUsedAt: latest,
    days: bumpDays(entry?.days ?? {}, ts, latest),
  };
}

function pushRecent(list: readonly string[], itemId: string): string[] {
  return [itemId, ...list.filter((id) => id !== itemId)].slice(0, RECENT_MAX);
}

/** Applies events in time order; `rev` grows by one per call. */
export function applyUsage(
  usage: UsageDoc,
  events: readonly ApplyEvent[],
): UsageDoc {
  const items: Record<string, UsageEntry> = { ...usage.items };
  const recent: Record<string, readonly string[]> = { ...usage.recent };
  const ordered = [...events].sort((a, b) =>
    a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0,
  );
  for (const event of ordered) {
    items[event.itemId] = bump(items[event.itemId], event.ts);
    const actor = event.actor.toLowerCase();
    recent[actor] = pushRecent(recent[actor] ?? [], event.itemId);
  }
  return { rev: usage.rev + 1, items, recent };
}
