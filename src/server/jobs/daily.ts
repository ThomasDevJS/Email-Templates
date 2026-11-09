import type { AuditEvent, IndexDoc } from "../../shared/model/data";
import { auditEvent, type EventSource } from "../audit/events";
import { rollAudit } from "../audit/roll";
import { loadIndex } from "../cache/indexCache";
import { nowIso, type Services } from "../services";
import { mutateIndex } from "../storage/writer";

/** Daily housekeeping (spec section 16, ADR-0002). Each step runs even if an earlier one failed. */
export const TRASH_DAYS = 30;
export const ORPHAN_AGE_MS = 60 * 60 * 1000;
export const BACKUPS_KEPT = 14;
export const AUDIT_MONTHS_KEPT = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

export const SYSTEM_ACTOR = "system";

function systemSource(services: Services): EventSource {
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

/** Items and folders soft-deleted over 30 days ago leave the index; their body files go to the Drive trash first. */
export function purgeTrash(services: Services): number {
  const cutoff = services.nowMs() - TRASH_DAYS * DAY_MS;
  const store = services.store();
  const index = loadIndex(services);
  const doomed = index.items.filter((item) => expired(item.deletedAt, cutoff));
  for (const item of doomed)
    for (const body of store.listBodies(item.id)) store.trash(body.fileId);
  if (purgeEvents(systemSource(services), index, cutoff).length === 0) return 0;
  return mutateIndex(services, (current) => {
    const events = purgeEvents(systemSource(services), current, cutoff);
    const goneFolders = new Set(
      current.folders
        .filter((f) => expired(f.deletedAt, cutoff))
        .map((f) => f.id),
    );
    const doc = {
      ...current,
      items: current.items.filter((item) => !expired(item.deletedAt, cutoff)),
      folders: current.folders.filter((folder) => !goneFolders.has(folder.id)),
      grants: current.grants.filter(
        (grant) => !goneFolders.has(grant.folderId),
      ),
    };
    return { doc, events, result: events.length };
  });
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
