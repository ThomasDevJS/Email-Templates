import type { UsageDoc, UsageEntry } from "../../shared/model/data";

/** Apply counts and per-user recent lists in `usage.json` (spec section 5.5). */
export const RECENT_MAX = 20;

export interface ApplyEvent {
  readonly itemId: string;
  readonly actor: string;
  readonly ts: string;
}

function bump(entry: UsageEntry | undefined, ts: string): UsageEntry {
  const last = entry?.lastUsedAt ?? "";
  return {
    applyCount: (entry?.applyCount ?? 0) + 1,
    lastUsedAt: ts > last ? ts : last,
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
