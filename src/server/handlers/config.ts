import { AppError, ErrorCode } from "../../shared/errors/codes";
import { TRIGGER_JOBS, type TriggerJob } from "../../shared/entryPoints";
import type { IndexDoc } from "../../shared/model/data";
import {
  allowedWords,
  isSettingName,
  isSettingValue,
  settingsOf,
  type SettingEntry,
  type SettingName,
  type SettingValue,
  type Settings,
} from "../../shared/model/settings";
import { utf8Length } from "../../shared/text";
import { auditEvent } from "../audit/events";
import { INDEX_REV_KEY, loadIndexForWrite } from "../cache/indexCache";
import {
  CACHED_SIDES,
  writeSideLocked,
  type CachedSide,
} from "../cache/sideCache";
import { optString } from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { DOMAIN_KEY } from "../guards";
import { lastErrorKey, lastOkKey } from "../jobs/health";
import {
  TRIGGERS_JOB,
  TRIGGERS_VERSION,
  TRIGGERS_VERSION_KEY,
} from "../jobs/triggers";
import { WRITE_LOCK_MS, withLock } from "../lock";
import { ADMIN_GROUP_KEY, RESOLVER_KEY } from "../membership/snapshot";
import { resolverId } from "../membership/resolver";
import { nowIso, type Services } from "../services";
import type { BackupDocs, SideDocs } from "../storage/port";
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
  tick: { ms: 5 * MINUTE_MS, label: "Every 5 minutes" },
  refreshMembers: { ms: 15 * MINUTE_MS, label: "Every 15 minutes" },
  daily: { ms: 24 * 60 * MINUTE_MS, label: "Every night, 02:00 to 03:00" },
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
  /** Admin settings (D29, spec 5.8), defaults filled in. */
  readonly settings: Settings;
  readonly indexRev: string;
  readonly appVersion: string;
  readonly indexBytes: number;
  readonly indexWarnBytes: number;
  readonly jobs: JobRow[];
  /** `job:triggers:lastError` while the reinstall is still pending (spec Q23), else "". */
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
    settings: settingsOf(index.settings),
    indexRev: prop(INDEX_REV_KEY),
    appVersion: services.appVersion,
    indexBytes: utf8Length(JSON.stringify(index)),
    indexWarnBytes: INDEX_WARN_BYTES,
    jobs: jobRows(services),
    triggersError:
      prop(TRIGGERS_VERSION_KEY) === TRIGGERS_VERSION
        ? ""
        : prop(lastErrorKey(TRIGGERS_JOB)),
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
 * Templates live in the backup but gone from the index now: emptied from the trash after the backup date, so their
 * body files are trashed. Restoring them would list templates that do not open.
 */
function purgedSince(current: IndexDoc, backup: IndexDoc): number {
  const known = new Set(current.items.map((item) => item.id));
  return backup.items.filter(
    (item) => item.deletedAt === "" && !known.has(item.id),
  ).length;
}

/** The backup index without trashed templates that were purged since: their files are gone and they were due anyway. */
function restorable(current: IndexDoc, backup: IndexDoc): IndexDoc {
  const known = new Set(current.items.map((item) => item.id));
  return {
    ...backup,
    items: backup.items.filter(
      (item) => item.deletedAt === "" || known.has(item.id),
    ),
  };
}

function refusePurged(current: IndexDoc, backup: IndexDoc, date: string): void {
  const lost = purgedSince(current, backup);
  if (lost > 0)
    throw new AppError(
      ErrorCode.VALIDATION,
      `Not restored. ${String(lost)} templates in the backup of ${date} were deleted for good after that day and would not open. Pick a newer backup.`,
    );
}

type Replaced = { name: CachedSide; doc: SideDocs[CachedSide] }[];

/** Writes the backup copies of the side files; records each live copy in `replaced` before it writes, for an undo. */
function writeSides(
  services: Services,
  backup: BackupDocs,
  replaced: Replaced,
): void {
  for (const name of CACHED_SIDES) {
    const live = services.store().readSide(name);
    replaced.push({ name, doc: live });
    const copy = backup[name];
    writeSideLocked(services, name, {
      ...copy,
      rev: Math.max(live.rev, copy.rev) + 1,
    });
  }
}

/** Puts the replaced side files back with a new rev, so caches move forward. */
function undoSides(services: Services, replaced: Readonly<Replaced>): void {
  for (const { name, doc } of replaced) {
    const now = services.store().readSide(name);
    writeSideLocked(services, name, { ...doc, rev: now.rev + 1 });
  }
}

/**
 * Restore from backup (admin, ADR-0002 Backup). The 3 copies are read and shape-checked before the lock (a damaged
 * copy answers VALIDATION naming the file). Under the lock: admin re-check, refusal when templates of the backup
 * were emptied from the trash since, then `favorites.json` and `usage.json`, then `index.json` as the commit point
 * (`rev = current + 1`, current `pendingAudit` and `settings` kept, one `backup.restore` event). A failure before the index write
 * puts the replaced side files back. Revs and cache sets are published, so readers see the restored data at once.
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
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "This backup no longer exists. Reload the page and pick another.",
    );
  const source = eventSource(context);
  return withLock(services.lock, WRITE_LOCK_MS, () => {
    const current = loadIndexForWrite(services);
    context.recheck(current);
    refusePurged(current, backup.index, date);
    const replaced: Replaced = [];
    try {
      writeSides(services, backup, replaced);
      const rev = commitLocked(services, (latest) => {
        const restored = restorable(latest, backup.index);
        const event = auditEvent(source, {
          action: "backup.restore",
          targetType: "library",
          targetId: "",
          before: { rev: latest.rev, items: latest.items.length },
          after: {
            date,
            rev: latest.rev + 1,
            items: restored.items.length,
            liveSettingsKept: true,
          },
        });
        return {
          doc: {
            ...restored,
            pendingAudit: latest.pendingAudit,
            settings: latest.settings,
          },
          events: [event],
          result: latest.rev + 1,
        };
      });
      return { date, rev };
    } catch (error: unknown) {
      undoSides(services, replaced);
      throw error;
    }
  });
}

const SET_ARGS = ["name", "value", "baseAt", "baseBy"];
/** Longest part of a client's setting name that the VALIDATION text echoes, in characters. */
export const NAME_ECHO_MAX = 40;
/** `baseBy` is an address or "", `baseAt` an ISO time or "". */
const BASE_MAX = 254;

interface SetRequest {
  readonly name: SettingName;
  readonly value: SettingValue;
  /** The last change the admin saw: `updatedAt` and `updatedBy` from `config.get`, "" for the default. */
  readonly baseAt: string;
  readonly baseBy: string;
}

function echoName(name: unknown): string {
  return typeof name === "string"
    ? Array.from(name).slice(0, NAME_ECHO_MAX).join("")
    : "";
}

const isBase = (value: unknown): value is string =>
  typeof value === "string" && value.length <= BASE_MAX;

/** `{ name, value, baseAt, baseBy }` against the fixed list (spec 5.8); anything else is VALIDATION (spec 7.3 texts), old `from` args a reload hint. */
export function setRequest(args: unknown): SetRequest {
  const record = (args ?? {}) as Readonly<Record<string, unknown>>;
  // A tab loaded before `baseAt`, `baseBy` replaced `from` (slice 13) sends the old args.
  if ("from" in record)
    throw new AppError(
      ErrorCode.VALIDATION,
      "This page is out of date. Reload it and save again.",
    );
  const name = record["name"];
  if (!isSettingName(name))
    throw new AppError(
      ErrorCode.VALIDATION,
      `Setting ${echoName(name)} does not exist.`,
    );
  const { value, baseAt, baseBy } = record;
  const extra = Object.keys(record).some((key) => !SET_ARGS.includes(key));
  if (
    !isSettingValue(name, value) ||
    !isBase(baseAt) ||
    !isBase(baseBy) ||
    extra
  )
    throw new AppError(
      ErrorCode.VALIDATION,
      `Setting ${name} takes ${allowedWords(name)}.`,
    );
  return { name, value, baseAt, baseBy };
}

export interface SetResult extends SettingEntry {
  readonly name: SettingName;
  readonly changed: boolean;
}

/**
 * `config.set` (admin, web, ADR-0008 section 2). Under the lock on the fresh index: admin re-check, then the same
 * value answers `changed: false` with no write; a last change other than the one the admin saw (`baseAt`, `baseBy`)
 * answers CONFLICT with the current entry, so an A, B, A sequence cannot hide B. Else one index commit carries the
 * change and its `config.set` event; `INDEX_REV` rises.
 */
export function configSet(context: HandlerContext): SetResult {
  const { name, value, baseAt, baseBy } = setRequest(context.args);
  const { services } = context;
  const source = eventSource(context);
  return withLock(services.lock, WRITE_LOCK_MS, () => {
    const current = loadIndexForWrite(services);
    context.recheck(current);
    const entry: SettingEntry = settingsOf(current.settings)[name];
    if (entry.value === value) return { name, ...entry, changed: false };
    if (entry.updatedAt !== baseAt || entry.updatedBy !== baseBy)
      throw new AppError(
        ErrorCode.CONFLICT,
        // The client adds "on <local time>" from `updatedAt` (spec 7.3); the server has no caller time zone.
        `${entry.updatedBy.split("@")[0] ?? ""} changed this setting. The page now shows the current value.`,
        { name, ...entry },
      );
    return commitLocked(services, (latest) => {
      const after: SettingEntry = {
        value,
        updatedAt: nowIso(services),
        updatedBy: context.caller.email,
      };
      const event = auditEvent(source, {
        action: "config.set",
        targetType: "config",
        targetId: name,
        before: { name, value: entry.value },
        after: { name, value },
      });
      return {
        doc: { ...latest, settings: { ...latest.settings, [name]: after } },
        events: [event],
        result: { name, ...after, changed: true },
      };
    });
  });
}
