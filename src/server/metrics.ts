import type { CacheStore } from "../shared/cache/store";
import type { CacheState, Surface } from "../shared/log/logger";
import type { DirectoryUsers, PropertyStore, ScriptLock } from "./services";
import type { DriveClient } from "./storage/driveClient";

/**
 * Per-request call counts and phase times for the request log line (spec section 11, slice 4b). Each Apps Script
 * service the server uses is wrapped once per execution; every call counts under its service and adds its time
 * to a phase. Only counts and milliseconds are recorded, never arguments or results.
 */
export type CallKind = "props" | "cache" | "drive" | "lock" | "dir";
export type Phase =
  "propsMs" | "cacheMs" | "driveReadMs" | "driveWriteMs" | "lockMs" | "dirMs";

export interface RequestStats {
  cache: CacheState;
  readonly surface: Surface;
  readonly calls: Record<CallKind, number>;
  readonly ms: Record<Phase, number>;
  /** First target folder dispatch resolved; the log's `targetId` when the args name no `id` or `folderId` (`grant.remove`). */
  target: string;
}

export function newStats(surface: Surface): RequestStats {
  return {
    cache: "",
    surface,
    calls: { props: 0, cache: 0, drive: 0, lock: 0, dir: 0 },
    ms: {
      propsMs: 0,
      cacheMs: 0,
      driveReadMs: 0,
      driveWriteMs: 0,
      lockMs: 0,
      dirMs: 0,
    },
    target: "",
  };
}

/** Script Properties with `getProperties`, as Apps Script provides them. */
export interface ScriptProperties extends PropertyStore {
  getProperties(): Record<string, string>;
}

type Meter = (method: string, ms: number) => void;

/**
 * Copy of `target` holding only the methods named in `methods`, each timed and reported to `meter`. The method
 * table is a `Record` over the interface keys, so a method added to the interface fails the type check here.
 */
function metered<T extends object>(
  target: T,
  methods: Readonly<Record<keyof T, true>>,
  meter: Meter,
  now: () => number,
): T {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(methods)) {
    out[name] = (...args: unknown[]) => {
      const started = now();
      // Looked up per call, so the wrapper follows the target's current method.
      const method = (target as Record<string, unknown>)[name] as (
        ...rest: unknown[]
      ) => unknown;
      try {
        return method.apply(target, args);
      } finally {
        meter(name, now() - started);
      }
    };
  }
  return out as T;
}

function count(
  stats: RequestStats,
  kind: CallKind,
  phase: (method: string) => Phase,
): Meter {
  return (method, ms) => {
    stats.calls[kind] += 1;
    stats.ms[phase(method)] += ms;
  };
}

const DRIVE_READS: ReadonlySet<string> = new Set([
  "readText",
  "readRawText",
  "getMeta",
  "list",
]);

export function meterProps(
  props: ScriptProperties,
  stats: RequestStats,
  now: () => number,
): ScriptProperties {
  return metered(
    props,
    {
      getProperty: true,
      getProperties: true,
      setProperty: true,
      deleteProperty: true,
    },
    count(stats, "props", () => "propsMs"),
    now,
  );
}

export function meterCache(
  cache: CacheStore,
  stats: RequestStats,
  now: () => number,
): CacheStore {
  return metered(
    cache,
    { get: true, getAll: true, put: true, putAll: true, removeAll: true },
    count(stats, "cache", () => "cacheMs"),
    now,
  );
}

/** Counts `tryLock` calls; `lockMs` is the time spent waiting for the lock. */
export function meterLock(
  lock: ScriptLock,
  stats: RequestStats,
  now: () => number,
): ScriptLock {
  return metered(
    lock,
    { tryLock: true, releaseLock: true },
    (method, ms) => {
      if (method !== "tryLock") return;
      stats.calls.lock += 1;
      stats.ms.lockMs += ms;
    },
    now,
  );
}

export function meterDrive(
  drive: DriveClient,
  stats: RequestStats,
  now: () => number,
): DriveClient {
  return metered(
    drive,
    {
      createFolder: true,
      createFile: true,
      updateFile: true,
      readText: true,
      readRawText: true,
      getMeta: true,
      list: true,
      copy: true,
      trash: true,
    },
    count(stats, "drive", (method) =>
      DRIVE_READS.has(method) ? "driveReadMs" : "driveWriteMs",
    ),
    now,
  );
}

export function meterDirectory(
  users: DirectoryUsers,
  stats: RequestStats,
  now: () => number,
): DirectoryUsers {
  return metered(
    users,
    { get: true },
    count(stats, "dir", () => "dirMs"),
    now,
  );
}

/**
 * Script Properties read once per execution: the first read loads every property with one `getProperties` call.
 * Writes go through and update the copy. Request code only; triggers that read under the lock use the live store.
 */
export function snapshotProps(props: ScriptProperties): PropertyStore {
  let values: Map<string, string> | null = null;
  const load = () =>
    (values ??= new Map(Object.entries(props.getProperties())));
  return {
    getProperty: (key) => load().get(key) ?? null,
    setProperty: (key, value) => {
      props.setProperty(key, value);
      load().set(key, value);
    },
    deleteProperty: (key) => {
      props.deleteProperty(key);
      load().delete(key);
    },
  };
}
