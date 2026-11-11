/**
 * A complete server `Services` on fakes, for handler, job and dispatch tests. `setupWorld` also runs `runSetup`
 * as the owner, so the data folder, Script Properties and triggers exist.
 */
import { createHash } from "node:crypto";
import { makeId } from "../../src/shared/ids";
import { createLogger } from "../../src/shared/log/logger";
import type { Surface } from "../../src/shared/log/logger";
import { handleRpc } from "../../src/server/dispatch/handle";
import { runSetup } from "../../src/server/jobs/setup";
import {
  meterCache,
  meterDirectory,
  meterDrive,
  meterLock,
  meterProps,
  newStats,
} from "../../src/server/metrics";
import type { Services } from "../../src/server/services";
import { advancedDriveClient } from "../../src/server/storage/advancedDrive";
import { driveStore } from "../../src/server/storage/driveStore";
import { requireStoreIds } from "../../src/server/storage/setupStore";
import type { RpcResponse } from "../../src/shared/model/protocol";
import {
  SETTINGS,
  type SettingName,
  type SettingValue,
} from "../../src/shared/model/settings";
import { FakeCache } from "./cache";
import { createDrive, type FakeDrive } from "./drive";
import {
  createDirectory,
  createGroupsApp,
  type FakeDirectory,
  type FakeGroupsApp,
} from "./groups";
import { FakeLock } from "./lock";
import { createUtilities } from "./output";
import { FakeProperties } from "./properties";
import { createScriptApp, type FakeScriptApp } from "./scriptApp";

export const OWNER = "owner@example.com";
export const DOMAIN = "example.com";
export const START_MS = Date.parse("2026-11-09T12:00:00.000Z");

export interface World {
  readonly services: Services;
  readonly clock: { now: number };
  readonly drive: FakeDrive;
  readonly props: FakeProperties;
  readonly cache: FakeCache;
  readonly lock: FakeLock;
  readonly scriptApp: FakeScriptApp;
  readonly groups: FakeGroupsApp;
  readonly directory: FakeDirectory;
  readonly session: { active: string; effective: string };
  readonly lines: string[];
  /** Fresh request stats, as runtime.ts creates per request. */
  as(surface: Surface): Services;
  call(
    caller: string,
    op: string,
    args?: unknown,
    surface?: Surface,
  ): RpcResponse;
  /** Data of a successful call, typed by the test; throws on an error response. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the test names the expected data type
  ok<T>(caller: string, op: string, args?: unknown, surface?: Surface): T;
}

function memo<T>(make: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= make());
}

export function createWorld(): World {
  const clock = { now: START_MS };
  const nowMs = () => clock.now;
  const drive = createDrive(nowMs);
  const props = new FakeProperties();
  const cache = new FakeCache(nowMs);
  const lock = new FakeLock();
  const scriptApp = createScriptApp();
  const groups = createGroupsApp();
  const directory = createDirectory();
  const session = { active: OWNER, effective: OWNER };
  const lines: string[] = [];
  let seq = 42;
  const logger = createLogger({
    sink: (line) => lines.push(line),
    now: () => new Date(clock.now),
    appVersion: "test-testsha",
    minLevel: "debug",
  });
  const driveClient = memo(() =>
    advancedDriveClient(drive.Files, createUtilities()),
  );
  const build = (surface: Surface): Services => {
    const stats = newStats(surface);
    const metered = memo(() => meterDrive(driveClient(), stats, nowMs));
    return {
      props: meterProps(props, stats, nowMs),
      cache: meterCache(cache, stats, nowMs),
      lock: meterLock(lock, stats, nowMs),
      session: {
        activeEmail: () => session.active,
        effectiveEmail: () => session.effective,
      },
      logger,
      nowMs,
      newId: () =>
        makeId(clock.now, (n) => {
          seq = (seq * 1103515245 + 12345) % 2147483648;
          return Math.floor(seq / 65536) % n;
        }),
      sha256: (text) => createHash("sha256").update(text, "utf8").digest("hex"),
      drive: metered,
      store: () => driveStore(metered(), requireStoreIds(props)),
      groups: () => groups,
      directoryUsers: () => meterDirectory(directory, stats, nowMs),
      triggers: scriptApp,
      appVersion: "test-testsha",
      stats,
      startedMs: clock.now,
    };
  };
  const world: World = {
    services: build("webapp"),
    clock,
    drive,
    props,
    cache,
    lock,
    scriptApp,
    groups,
    directory,
    session,
    lines,
    as: build,
    call: (caller, op, args = {}, surface = "webapp") =>
      handleRpc(
        { email: caller },
        { op, args, requestId: "TESTREQ0-000001", clientVersion: "t" },
        surface,
        {
          services: build(surface),
        },
      ),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- see World.ok
    ok: <T>(
      caller: string,
      op: string,
      args?: unknown,
      surface?: Surface,
    ): T => {
      const response = world.call(caller, op, args, surface);
      if (!response.ok)
        throw new Error(`${op} failed: ${JSON.stringify(response.error)}`);
      return response.data as T;
    },
  };
  return world;
}

/** World after `setup` as the owner: STORE, DOMAIN, OWNER_EMAIL, ADMIN_EMAILS and 3 triggers exist. */
export function setupWorld(): World {
  const world = createWorld();
  runSetup(world.services);
  return world;
}

/** Admin setting through `config.set` as the owner (an admin after setup); `from` is the other value. */
export function setSetting(
  world: World,
  name: SettingName,
  value: SettingValue,
): void {
  const values: readonly string[] = SETTINGS[name].values;
  const from = values.find((other) => other !== value);
  world.ok(OWNER, "config.set", { name, value, from });
}
