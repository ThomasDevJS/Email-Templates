import type {
  AuditEvent,
  BodyFile,
  FavoritesDoc,
  IndexDoc,
  MembersDoc,
  UsageDoc,
} from "../../shared/model/data";

/** Side files next to `index.json` (ADR-0002 Layout). */
export interface SideDocs {
  readonly favorites: FavoritesDoc;
  readonly usage: UsageDoc;
  readonly members: MembersDoc;
}

export type SideName = keyof SideDocs;

/** One body version file, read from its Drive `appProperties` without downloading it. */
export interface BodyRef {
  readonly fileId: string;
  readonly itemId: string;
  readonly version: number;
  readonly savedBy: string;
  readonly restoredFrom: number;
  readonly createdTime: string;
}

export interface NamedRef {
  readonly id: string;
  readonly name: string;
}

/**
 * Storage port (ADR-0002). The Drive JSON implementation is the only one in v1; tests run it on the fake Drive.
 * Callers hold the script lock around `writeIndex` and `writeSide`; body files are written outside it.
 */
export interface StorePort {
  readIndex(): IndexDoc;
  /** `rev` from the `index.json` appProperties: one metadata read, no download. */
  readIndexRev(): number;
  writeIndex(doc: IndexDoc): void;
  readSide<K extends SideName>(name: K): SideDocs[K];
  writeSide<K extends SideName>(name: K, doc: SideDocs[K]): void;
  createBody(body: BodyFile): string;
  readBody(fileId: string): BodyFile;
  /** Versions of one item, or every body file when `itemId` is omitted (orphan cleanup). */
  listBodies(itemId?: string): BodyRef[];
  /** Copies `index.json`, `favorites.json` and `usage.json` to `backups/<dateKey>/`; skips copies already there. */
  copyToBackup(dateKey: string): void;
  listBackups(): NamedRef[];
  /** Appends events to `audit/<month>.jsonl`, skipping IDs already in the file. Returns the number appended. */
  appendAudit(month: string, events: readonly AuditEvent[]): number;
  listAuditFiles(): NamedRef[];
  trash(fileId: string): void;
}
