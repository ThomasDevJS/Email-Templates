import type { AuditEvent } from "../../shared/model/data";
import { loadIndex } from "../cache/indexCache";
import type { Services } from "../services";
import { mutateIndex } from "../storage/writer";
import { groupByMonth } from "./lines";

/**
 * Moves `pendingAudit` to `audit/YYYY-MM.jsonl` (ADR-0002 Audit storage): append outside the lock, then remove
 * the flushed IDs under the lock. A crash between the steps leaves the events pending; the next append skips
 * IDs already in the month file, so no line repeats.
 */
export function rollAudit(services: Services): number {
  const pending: readonly AuditEvent[] = loadIndex(services).pendingAudit;
  if (pending.length === 0) return 0;
  const store = services.store();
  for (const [month, events] of groupByMonth(pending))
    store.appendAudit(month, events);
  const flushed = new Set(pending.map((event) => event.id));
  mutateIndex(services, (current) => ({
    doc: {
      ...current,
      pendingAudit: current.pendingAudit.filter(
        (event) => !flushed.has(event.id),
      ),
    },
    events: [],
    result: undefined,
  }));
  return pending.length;
}
