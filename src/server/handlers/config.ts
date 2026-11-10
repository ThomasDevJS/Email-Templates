import { AppError, ErrorCode } from "../../shared/errors/codes";
import { TRIGGER_JOBS, type TriggerJob } from "../../shared/entryPoints";
import { utf8Length } from "../../shared/text";
import { auditEvent } from "../audit/events";
import { INDEX_REV_KEY } from "../cache/indexCache";
import { CACHED_SIDES, writeSideLocked } from "../cache/sideCache";
import { optString } from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { DOMAIN_KEY } from "../guards";
import { lastErrorKey, lastOkKey } from "../jobs/health";
import { TRIGGERS_JOB } from "../jobs/triggers";
import { WRITE_LOCK_MS, withLock } from "../lock";
import { ADMIN_GROUP_KEY, RESOLVER_KEY } from "../membership/snapshot";
import { resolverId } from "../membership/resolver";
import type { Services } from "../services";
import { commitLocked } from "../storage/writer";

/**
 * Config tab (admin, read only, wireframe 06): the listed settings, index size, job health and backups. Values
 * come from the request's Script Properties snapshot and the cached index; no other property leaves the server.
 */
export const CALLER_IDENTITY_KEY = "CALLER_IDENTITY";
/** ADR-0002 Revisit: split the index above 3 MB. */
export const INDEX_WARN_BYTES = 3 * 1024 * 1024;
const MINUTE_MS = 60 * 1000;

/** Interval and schedule label per job; the same schedule `SCHEDULES` installs (triggers.ts). */
export const JOB_INTERVALS: Readonly<
  Record<TriggerJob, { readonly ms: number; readonly label: string }>
> = {
  tick: { ms: 5 * MINUTE_MS, label: "every 5 min" },
  refreshMembers: { ms: 15 * MINUTE_MS, label: "every 15 min" },
  daily: { ms: 24 * 60 * MINUTE_MS, label: "daily, 02:00 to 03:00" },
};

export interface JobRow {
  readonly name: TriggerJob;
  readonly schedule: string;
  readonly lastOk: string;
  /** `late`: no success for more than 2 intervals; `never`: no success recorded. */
  readonly status: "ok" | "late" | "never";
  /** The last error text, only when the job is late or never ran. */
  readonly lastError: string;
}

/** Spec 16: a job is late when its last success is more than 2 intervals old. */
export function jobStatus(
  lastOk: string,
  intervalMs: number,
  nowMs: number,
): JobRow["status"] {
  if (lastOk === "") return "never";
  return nowMs - Date.parse(lastOk) > 2 * intervalMs ? "late" : "ok";
}

function jobRows(services: Services): JobRow[] {
  const prop = (key: string) => services.props.getProperty(key) ?? "";
  return TRIGGER_JOBS.map((name) => {
    const { ms, label } = JOB_INTERVALS[name];
    const lastOk = prop(lastOkKey(name));
    const status = jobStatus(lastOk, ms, services.nowMs());
    return {
      name,
      schedule: label,
      lastOk,
      status,
      lastError: status === "ok" ? "" : prop(lastErrorKey(name)),
    };
  });
}

export interface ConfigView {
  readonly domain: string;
  readonly adminGroup: string;
  readonly resolver: string;
  readonly callerIdentity: string;
  readonly indexRev: string;
  readonly appVersion: string;
  readonly indexBytes: number;
  readonly indexWarnBytes: number;
  readonly jobs: JobRow[];
  /** `job:triggers:lastError` of a failed reinstall (spec Q23), "" when none. */
  readonly triggersError: string;
}

export function configGet(context: HandlerContext): ConfigView {
  const { services } = context;
  const prop = (key: string) => services.props.getProperty(key) ?? "";
  const { index } = context.access();
  return {
    domain: prop(DOMAIN_KEY),
    adminGroup: prop(ADMIN_GROUP_KEY),
    resolver: resolverId(services.props.getProperty(RESOLVER_KEY)),
    callerIdentity: prop(CALLER_IDENTITY_KEY) || "active_user",
    indexRev: prop(INDEX_REV_KEY),
    appVersion: services.appVersion,
    indexBytes: utf8Length(JSON.stringify(index)),
    indexWarnBytes: INDEX_WARN_BYTES,
    jobs: jobRows(services),
    triggersError: prop(lastErrorKey(TRIGGERS_JOB)),
  };
}

const BACKUP_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The daily backup folders (`backups/YYYY-MM-DD/`, 14 kept), newest first. One Drive list. */
export function backupList(context: HandlerContext): { dates: string[] } {
  const dates = context.services
    .store()
    .listBackups()
    .map((folder) => folder.name)
    .filter((name) => BACKUP_DATE.test(name))
    .sort()
    .reverse();
  return { dates };
}

/**
 * Restore from backup (admin, ADR-0002 Backup): the copies of `date` replace `index.json`, `favorites.json` and
 * `usage.json` under the script lock. The index takes `rev = current + 1` and keeps the current `pendingAudit`, so
 * no audit event is lost and the restore itself is one more. `INDEX_REV`, `FAVORITES_REV`, `USAGE_REV` and their
 * cache sets are published, so readers see the restored data at once. The admin check runs again inside the lock.
 */
export function backupRestore(context: HandlerContext): {
  date: string;
  rev: number;
} {
  const { services } = context;
  const date = optString(context.args, "date");
  if (!BACKUP_DATE.test(date))
    throw new AppError(ErrorCode.VALIDATION, "date must be YYYY-MM-DD");
  const backup = services.store().readBackup(date);
  if (backup === null)
    throw new AppError(ErrorCode.NOT_FOUND, "This backup was removed.");
  const source = eventSource(context);
  return withLock(services.lock, WRITE_LOCK_MS, () => {
    const rev = commitLocked(services, (current) => {
      context.recheck(current);
      const event = auditEvent(source, {
        action: "backup.restore",
        targetType: "library",
        targetId: "",
        before: { rev: current.rev, items: current.items.length },
        after: { date, rev: current.rev + 1, items: backup.index.items.length },
      });
      return {
        doc: { ...backup.index, pendingAudit: current.pendingAudit },
        events: [event],
        result: current.rev + 1,
      };
    });
    for (const name of CACHED_SIDES) {
      const live = services.store().readSide(name);
      const copy = backup[name];
      writeSideLocked(services, name, {
        ...copy,
        rev: Math.max(live.rev, copy.rev) + 1,
      });
    }
    return { date, rev };
  });
}
