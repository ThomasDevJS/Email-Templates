import { APP_VERSION, BUILD_INFO } from "../shared/buildInfo";
import { AppError, ErrorCode } from "../shared/errors/codes";
import { makeId } from "../shared/ids";
import {
  createLogger,
  resolveLogLevel,
  type Logger,
  type Surface,
} from "../shared/log/logger";
import type { Caller } from "./dispatch/context";
import {
  meterCache,
  meterDirectory,
  meterDrive,
  meterLock,
  meterProps,
  newStats,
  snapshotProps,
} from "./metrics";
import type { DirectoryUsers, PropertyStore, Services } from "./services";
import { advancedDriveClient } from "./storage/advancedDrive";
import type { DriveClient } from "./storage/driveClient";
import { driveStore } from "./storage/driveStore";
import { restDriveClient } from "./storage/restDrive";
import { requireStoreIds } from "./storage/setupStore";

export const DRIVE_CLIENT_KEY = "DRIVE_CLIENT";

/** Logger writing JSON lines to the Apps Script execution log. Level from Script Property `LOG_LEVEL`. */
export function serverLogger(
  props: PropertyStore = PropertiesService.getScriptProperties(),
): Logger {
  return createLogger({
    sink: (line) => {
      console.log(line);
    },
    now: () => new Date(),
    appVersion: APP_VERSION,
    minLevel: resolveLogLevel(props.getProperty("LOG_LEVEL"), BUILD_INFO.env),
  });
}

/** Caller identity from Google's session (ADR-0003 Part A, `CALLER_IDENTITY=active_user`). Blank when unknown. */
export function currentCaller(): Caller {
  return { email: Session.getActiveUser().getEmail() };
}

function requireService<T>(service: T | undefined, name: string): T {
  if (service === undefined)
    throw new AppError(
      ErrorCode.NOT_CONFIGURED,
      `Advanced service ${name} is not enabled`,
    );
  return service;
}

/** `DRIVE_CLIENT=rest` selects Drive REST through UrlFetch; anything else the Advanced Drive service. */
export function driveClientFor(props: PropertyStore): DriveClient {
  if (props.getProperty(DRIVE_CLIENT_KEY) === "rest") {
    return restDriveClient(
      (url, options) => UrlFetchApp.fetch(url, options),
      () => ScriptApp.getOAuthToken(),
    );
  }
  const files = requireService(
    typeof Drive === "undefined" ? undefined : Drive,
    "Drive",
  ).Files;
  return advancedDriveClient(files, Utilities);
}

function memo<T>(make: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= make());
}

function hex(bytes: readonly number[]): string {
  return bytes
    .map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0"))
    .join("");
}

function sha256(text: string): string {
  return hex(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      text,
      Utilities.Charset.UTF_8,
    ),
  );
}

function directoryUsers(): DirectoryUsers {
  const admin = requireService(
    typeof AdminDirectory === "undefined" ? undefined : AdminDirectory,
    "AdminDirectory",
  );
  return requireService(admin.Users, "AdminDirectory.Users");
}

/** Clock value when this execution evaluated the bundle: the closest point to execution start that code sees. */
const LOADED_MS = Date.now();

/**
 * Services for one request or job run, from Apps Script globals, each service metered for the log line. Drive and
 * the store are built on first use. Requests read Script Properties once (`snapshotProps`); triggers read them live.
 */
export function createServices(surface: Surface): Services {
  const stats = newStats(surface);
  const now = () => Date.now();
  const live = meterProps(PropertiesService.getScriptProperties(), stats, now);
  const props = surface === "trigger" ? live : snapshotProps(live);
  const drive = memo(() => meterDrive(driveClientFor(props), stats, now));
  return {
    props,
    cache: meterCache(CacheService.getScriptCache(), stats, now),
    lock: meterLock(LockService.getScriptLock(), stats, now),
    session: {
      activeEmail: () => Session.getActiveUser().getEmail(),
      effectiveEmail: () => Session.getEffectiveUser().getEmail(),
    },
    logger: serverLogger(props),
    nowMs: now,
    newId: () => makeId(Date.now(), (n) => Math.floor(Math.random() * n)),
    sha256,
    drive,
    store: memo(() => driveStore(drive(), requireStoreIds(props))),
    groups: () => GroupsApp,
    directoryUsers: memo(() => meterDirectory(directoryUsers(), stats, now)),
    triggers: ScriptApp,
    appVersion: APP_VERSION,
    stats,
    startedMs: LOADED_MS,
  };
}
