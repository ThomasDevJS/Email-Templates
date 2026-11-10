import type { AuditEvent, AuditResult } from "../../shared/model/data";

/**
 * Pure part of `audit.query` (wireframe 06 Audit log): parse a month file, merge it with the events not yet rolled,
 * filter, sort newest first and cut one page. Duplicate IDs (a crash between roll steps) count once.
 */
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_RESULTS: readonly AuditResult[] = [
  "ok",
  "denied",
  "conflict",
  "error",
];

export interface AuditFilter {
  /** ISO instants; `from` inclusive, `to` exclusive, "" for open. */
  readonly from: string;
  readonly to: string;
  /** Case-insensitive part of the actor address. */
  readonly actor: string;
  /** Exact action name, "" for all. */
  readonly action: string;
  readonly result: AuditResult | "";
  /** Case-insensitive part of the target ID or path. */
  readonly target: string;
}

/** A row of the table: the event without `before` and `after`, which the details drawer loads by ID. */
export type AuditRow = Omit<AuditEvent, "before" | "after">;

export interface AuditPage {
  readonly total: number;
  readonly rows: AuditRow[];
  /** Distinct actions of the month, for the action filter. */
  readonly actions: string[];
}

/** Events of one JSON Lines file; blank and unreadable lines are skipped. */
export function parseLines(text: string): AuditEvent[] {
  return text.split("\n").flatMap((line) => {
    if (line.trim() === "") return [];
    try {
      const parsed = JSON.parse(line) as AuditEvent;
      return typeof parsed.id === "string" && typeof parsed.ts === "string"
        ? [parsed]
        : [];
    } catch {
      return [];
    }
  });
}

/** File events, then pending events of the same month; the first copy of an ID wins. */
export function mergeMonth(
  month: string,
  fileEvents: readonly AuditEvent[],
  pending: readonly AuditEvent[],
): AuditEvent[] {
  const byId = new Map<string, AuditEvent>();
  for (const event of [...fileEvents, ...pending])
    if (event.ts.startsWith(month) && !byId.has(event.id))
      byId.set(event.id, event);
  return [...byId.values()];
}

const contains = (value: string, part: string): boolean =>
  part === "" || value.toLowerCase().includes(part.toLowerCase());

export function matches(event: AuditEvent, filter: AuditFilter): boolean {
  return (
    (filter.from === "" || event.ts >= filter.from) &&
    (filter.to === "" || event.ts < filter.to) &&
    contains(event.actor, filter.actor) &&
    (filter.action === "" || event.action === filter.action) &&
    (filter.result === "" || event.result === filter.result) &&
    (contains(event.targetId, filter.target) ||
      contains(event.targetPath, filter.target))
  );
}

function row(event: AuditEvent): AuditRow {
  return {
    id: event.id,
    ts: event.ts,
    actor: event.actor,
    actorRoles: event.actorRoles,
    surface: event.surface,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    targetPath: event.targetPath,
    result: event.result,
    errorCode: event.errorCode,
    durationMs: event.durationMs,
    requestId: event.requestId,
    appVersion: event.appVersion,
  };
}

/** Page `page` (from 0) of the matching events, newest first. */
export function auditPage(
  events: readonly AuditEvent[],
  filter: AuditFilter,
  page: number,
): AuditPage {
  const found = events
    .filter((event) => matches(event, filter))
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  const start = page * AUDIT_PAGE_SIZE;
  return {
    total: found.length,
    rows: found.slice(start, start + AUDIT_PAGE_SIZE).map(row),
    actions: [...new Set(events.map((event) => event.action))].sort(),
  };
}
