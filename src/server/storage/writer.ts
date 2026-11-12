import type { AuditEvent, IndexDoc } from "../../shared/model/data";
import { loadIndexForWrite, publishIndex } from "../cache/indexCache";
import { WRITE_LOCK_MS, withLock } from "../lock";
import { nowIso, type Services } from "../services";

/** What a mutation returns: the changed document (without `rev`), its security events and the op result. */
export interface Mutated<T> {
  readonly doc: IndexDoc;
  readonly events: readonly AuditEvent[];
  readonly result: T;
}

export type Mutation<T> = (current: IndexDoc) => Mutated<T>;

type WriterServices = Pick<
  Services,
  "props" | "cache" | "lock" | "store" | "nowMs" | "stats" | "logger"
>;

/**
 * Save steps 4 to 7 of ADR-0002 Concurrency; the caller holds the script lock.
 * (4) load the index whose `rev` matches the file, (5) apply the change, append events to `pendingAudit`,
 * set `rev + 1`, (6) write `index.json` (commit point), (7) set `INDEX_REV` and put the chunks.
 */
export function commitLocked<T>(
  services: WriterServices,
  mutation: Mutation<T>,
): T {
  const current = loadIndexForWrite(services);
  const { doc, events, result } = mutation(current);
  const next: IndexDoc = {
    ...doc,
    rev: current.rev + 1,
    updatedAt: nowIso(services),
    pendingAudit: [...doc.pendingAudit, ...events],
  };
  services.store().writeIndex(next);
  publishIndex(services, next);
  return result;
}

/** Steps 3 to 8: take the lock (BUSY after 10 s), commit, release. */
export function mutateIndex<T>(
  services: WriterServices,
  mutation: Mutation<T>,
): T {
  return withLock(services.lock, WRITE_LOCK_MS, () =>
    commitLocked(services, mutation),
  );
}
