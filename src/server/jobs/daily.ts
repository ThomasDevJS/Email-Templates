import type { AuditEvent, IndexDoc } from "../../shared/model/data";
import { TRASH_DAYS } from "../../shared/model/validate";
import { auditEvent, type EventSource } from "../audit/events";
import { rollAudit } from "../audit/roll";
import { loadIndex } from "../cache/indexCache";
import { nowIso, type Services } from "../services";
import { mutateIndex, type Mutation } from "../storage/writer";

/** Daily housekeeping (spec section 16, ADR-0002). Each step runs even if an earlier one failed. */
export const ORPHAN_AGE_MS = 60 * 60 * 1000;
export const BACKUPS_KEPT = 14;
export const AUDIT_MONTHS_KEPT = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

export const SYSTEM_ACTOR = "system";

/** Audit source of trigger work: actor `system`, no request ID. */
export function systemSource(services: Services): EventSource {
  return {
    actor: SYSTEM_ACTOR,
    actorRoles: "admin",
    surface: "trigger",
    requestId: "",
    appVersion: services.appVersion,
    nowIso: () => nowIso(services),
    newId: services.newId,
  };
}

function expired(deletedAt: string, cutoffMs: number): boolean {
  return deletedAt !== "" && Date.parse(deletedAt) < cutoffMs;
}

function purgeEvents(
  source: EventSource,
  index: IndexDoc,
  cutoffMs: number,
): AuditEvent[] {
  const items = index.items.filter((item) => expired(item.deletedAt, cutoffMs));
  const folders = index.folders.filter((folder) =>
    expired(folder.deletedAt, cutoffMs),
  );
  return [
    ...items.map((item) =>
      auditEvent(source, {
        action: "trash.purge",
        targetType: "template",
        targetId: item.id,
        before: item,
      }),
    ),
    ...folders.map((folder) =>
      auditEvent(source, {
        action: "trash.purge",
        targetType: "folder",
        targetId: folder.id,
        before: folder,
      }),
    ),
  ];
}

export interface Purged {
  readonly count: number;
  readonly goneItems: readonly string[];
  readonly folders: number;
}

/** Body files one purge trashes after its commit; the daily orphan cleanup trashes the rest (no item owns them). */
export const PURGE_FILES_MAX = 50;

export interface PurgeReport {
  /** Templates and folders removed from the index. */
  readonly count: number;
  /** The split of `count`, from the index read inside the lock. */
  readonly templates: number;
  readonly folders: number;
  readonly filesTrashed: number;
  /** Purged templates whose body files are left to the daily orphan cleanup. */
  readonly itemsPending: number;
}

function trashBodies(
  services: Services,
  itemIds: readonly string[],
): Pick<PurgeReport, "filesTrashed" | "itemsPending"> {
  const store = services.store();
  let filesTrashed = 0;
  let itemsPending = 0;
  for (const itemId of itemIds) {
    const room = PURGE_FILES_MAX - filesTrashed;
    if (room === 0) {
      itemsPending += 1;
      continue;
    }
    const bodies = store.listBodies(itemId);
    for (const body of bodies.slice(0, room)) store.trash(body.fileId);
    filesTrashed += Math.min(room, bodies.length);
    if (bodies.length > room) itemsPending += 1;
  }
  return { filesTrashed, itemsPending };
}

/** Index writer for a purge: `mutateIndex` for the trigger, `commit` (with the in-lock re-check) for a request. */
export type PurgeWrite = (mutation: Mutation<Purged>) => Purged;

/**
 * Items and folders soft-deleted before `cutoffMs` leave the index in one committed write; only then do their body
 * files go to the Drive trash. An item restored before the commit keeps its files; files left by a crash after the
 * commit belong to no item and the orphan cleanup trashes them; so do files over PURGE_FILES_MAX.
 */
export function purgeDeleted(
  services: Services,
  cutoffMs: number,
  source: EventSource,
  write: PurgeWrite = (mutation) => mutateIndex(services, mutation),
): PurgeReport {
  if (purgeEvents(source, loadIndex(services), cutoffMs).length === 0)
    return {
      count: 0,
      templates: 0,
      folders: 0,
      filesTrashed: 0,
      itemsPending: 0,
    };
  const purged = write((current) => {
    const events = purgeEvents(source, current, cutoffMs);
    const goneFolders = new Set(
      current.folders
        .filter((f) => expired(f.deletedAt, cutoffMs))
        .map((f) => f.id),
    );
    const goneItems = current.items
      .filter((item) => expired(item.deletedAt, cutoffMs))
      .map((item) => item.id);
    const doc = {
      ...current,
      items: current.items.filter((item) => !expired(item.deletedAt, cutoffMs)),
      folders: current.folders.filter((folder) => !goneFolders.has(folder.id)),
      grants: current.grants.filter(
        (grant) => !goneFolders.has(grant.folderId),
      ),
    };
    const result = {
      count: events.length,
      goneItems,
      folders: goneFolders.size,
    };
    return { doc, events, result };
  });
  return {
    count: purged.count,
    templates: purged.goneItems.length,
    folders: purged.folders,
    ...trashBodies(services, purged.goneItems),
  };
}

/** Daily step: everything soft-deleted over 30 days ago. */
export function purgeTrash(services: Services): number {
  return purgeDeleted(
    services,
    services.nowMs() - TRASH_DAYS * DAY_MS,
    systemSource(services),
  ).count;
}

/** Body files older than 1 h whose item is unknown or whose version is above the item's current version. */
export function cleanOrphans(services: Services): number {
  const store = services.store();
  const versions = new Map(
    loadIndex(services).items.map((item) => [item.id, item.currentVersion]),
  );
  const cutoff = services.nowMs() - ORPHAN_AGE_MS;
  const orphans = store.listBodies().filter((ref) => {
    if (Date.parse(ref.createdTime) > cutoff) return false;
    const current = versions.get(ref.itemId);
    return current === undefined || ref.version > current;
  });
  for (const ref of orphans) store.trash(ref.fileId);
  return orphans.length;
}

/** Copies the 3 mutable files to `backups/YYYY-MM-DD/` and trashes all but the newest 14 dates. */
export function backup(services: Services): number {
  const store = services.store();
  store.copyToBackup(nowIso(services).slice(0, 10));
  const old = store
    .listBackups()
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(BACKUPS_KEPT);
  for (const folder of old) store.trash(folder.id);
  return old.length;
}

/** First month kept: 24 months before the current month (`YYYY-MM`). */
export function oldestKeptMonth(nowMs: number): string {
  const now = new Date(nowMs);
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - AUDIT_MONTHS_KEPT, 1),
  );
  return first.toISOString().slice(0, 7);
}

export function trimAudit(services: Services): number {
  const store = services.store();
  const keepFrom = oldestKeptMonth(services.nowMs());
  const old = store
    .listAuditFiles()
    .filter(
      (file) =>
        /^\d{4}-\d{2}\.jsonl$/.test(file.name) &&
        file.name.slice(0, 7) < keepFrom,
    );
  for (const file of old) store.trash(file.id);
  return old.length;
}

const STEPS = {
  auditRolled: rollAudit,
  purged: purgeTrash,
  orphans: cleanOrphans,
  backupsTrashed: backup,
  auditFilesTrashed: trimAudit,
} as const;

export type DailyResult = Record<keyof typeof STEPS, number>;

/** Runs every step; throws one error naming the failed steps after all have run. */
export function runDaily(services: Services): DailyResult {
  const result = {} as DailyResult;
  const failed: string[] = [];
  for (const [name, step] of Object.entries(STEPS) as [
    keyof typeof STEPS,
    (s: Services) => number,
  ][]) {
    try {
      result[name] = step(services);
    } catch (error: unknown) {
      failed.push(
        `${name} (${error instanceof Error ? error.message : "error"})`,
      );
      result[name] = 0;
    }
  }
  if (failed.length > 0)
    throw new Error(`daily steps failed: ${failed.join(", ")}`);
  return result;
}
