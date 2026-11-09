import type { CacheState, Logger, Surface } from "../shared/log/logger";
import type { DriveClient } from "./storage/driveClient";
import type { StorePort } from "./storage/port";

/** Script Properties as the server uses them. The real `Properties` object satisfies it. */
export interface PropertyStore {
  getProperty(key: string): string | null;
  setProperty(key: string, value: string): unknown;
  deleteProperty(key: string): unknown;
}

/** Script Cache as the server uses it. The real `Cache` object satisfies it. */
export interface CacheStore {
  get(key: string): string | null;
  getAll(keys: string[]): Record<string, string>;
  put(key: string, value: string, ttlSeconds?: number): void;
  putAll(values: Record<string, string>, ttlSeconds?: number): void;
  removeAll(keys: string[]): void;
}

export interface ScriptLock {
  tryLock(timeoutMs: number): boolean;
  releaseLock(): void;
}

export interface SessionInfo {
  activeEmail(): string;
  effectiveEmail(): string;
}

/** Trigger operations on `ScriptApp` that `setup` and the reinstall check need. */
export interface TriggerApp {
  getProjectTriggers(): {
    getUniqueId(): string;
    getHandlerFunction(): string;
  }[];
  deleteTrigger(trigger: { getUniqueId(): string }): void;
  newTrigger(handler: string): {
    timeBased(): TimeTriggerBuilder;
  };
}

export interface TimeTriggerBuilder {
  everyMinutes(n: number): TimeTriggerBuilder;
  everyDays(n: number): TimeTriggerBuilder;
  atHour(hour: number): TimeTriggerBuilder;
  create(): unknown;
}

/** Group lookups the `groupsapp_direct` resolver performs (ADR-0003 Part B). */
export interface GroupsLookup {
  getGroupByEmail(email: string): {
    getUsers(): { getEmail(): string }[];
    getGroups(): { getEmail(): string }[];
  };
}

/** `AdminDirectory.Users.get` as the profile lookup calls it (ADR-0004 Sender values). */
export interface DirectoryUsers {
  get(userKey: string, options: object): unknown;
}

/** Per-request record of how the index was served, for the `cache` log field. */
export interface RequestStats {
  cache: CacheState;
  readonly surface: Surface;
}

/** Everything server code touches outside pure logic. Built in runtime.ts from Apps Script globals, from fakes in tests. */
export interface Services {
  readonly props: PropertyStore;
  readonly cache: CacheStore;
  readonly lock: ScriptLock;
  readonly session: SessionInfo;
  readonly logger: Logger;
  readonly nowMs: () => number;
  readonly newId: () => string;
  readonly sha256: (text: string) => string;
  readonly drive: () => DriveClient;
  readonly store: () => StorePort;
  readonly groups: () => GroupsLookup;
  readonly directoryUsers: () => DirectoryUsers;
  readonly triggers: TriggerApp;
  readonly appVersion: string;
  readonly stats: RequestStats;
}

export function nowIso(services: Pick<Services, "nowMs">): string {
  return new Date(services.nowMs()).toISOString();
}
