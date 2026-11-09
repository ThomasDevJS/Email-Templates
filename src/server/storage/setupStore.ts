import { AppError, ErrorCode } from "../../shared/errors/codes";
import {
  EMPTY_FAVORITES,
  EMPTY_USAGE,
  emptyIndex,
  emptyMembers,
} from "../../shared/model/data";
import type { PropertyStore } from "../services";
import type { AppProperties, DriveClient } from "./driveClient";
import { FILE_NAMES, type StoreIds } from "./driveStore";

export const STORE_KEY = "STORE";
export const DATA_FOLDER_NAME = "Migway Templates Data";

type Step = (ids: Partial<StoreIds>) => string;

interface FileSeed {
  readonly name: string;
  readonly text: string;
  readonly appProperties?: AppProperties;
}

function seeds(nowIso: string, resolver: string) {
  const index = emptyIndex(nowIso);
  return {
    indexId: {
      name: FILE_NAMES.index,
      text: JSON.stringify(index),
      appProperties: { rev: String(index.rev) },
    },
    favoritesId: {
      name: FILE_NAMES.favorites,
      text: JSON.stringify(EMPTY_FAVORITES),
    },
    usageId: { name: FILE_NAMES.usage, text: JSON.stringify(EMPTY_USAGE) },
    membersId: {
      name: FILE_NAMES.members,
      text: JSON.stringify(emptyMembers(resolver)),
    },
  } satisfies Record<string, FileSeed>;
}

function root(ids: Partial<StoreIds>): string {
  if (ids.rootId === undefined)
    throw new AppError(ErrorCode.INTERNAL, "Data folder missing");
  return ids.rootId;
}

function steps(drive: DriveClient, nowIso: string, resolver: string) {
  const folder =
    (name: string): Step =>
    (ids) =>
      drive.createFolder(name, root(ids));
  const file =
    (seed: FileSeed): Step =>
    (ids) =>
      drive.createFile({ ...seed, parentId: root(ids) });
  const files = seeds(nowIso, resolver);
  const ordered: [keyof StoreIds, Step][] = [
    ["rootId", () => drive.createFolder(DATA_FOLDER_NAME, "")],
    ["bodiesId", folder("bodies")],
    ["auditId", folder("audit")],
    ["backupsId", folder("backups")],
    ["indexId", file(files.indexId)],
    ["favoritesId", file(files.favoritesId)],
    ["usageId", file(files.usageId)],
    ["membersId", file(files.membersId)],
  ];
  return ordered;
}

export function readStoreIds(props: PropertyStore): Partial<StoreIds> {
  const raw = props.getProperty(STORE_KEY);
  if (raw === null || raw === "") return {};
  return JSON.parse(raw) as Partial<StoreIds>;
}

export function requireStoreIds(props: PropertyStore): StoreIds {
  const ids = readStoreIds(props);
  if (ids.membersId === undefined) {
    throw new AppError(
      ErrorCode.NOT_CONFIGURED,
      "Storage is not set up. The owner runs setup() once.",
    );
  }
  return ids as StoreIds;
}

/**
 * Creates the data folder, its 3 subfolders and 4 JSON files, saving `STORE` after each step, so a rerun
 * after a crash continues where it stopped and a rerun after success creates nothing (ADR-0002 Layout).
 */
export function ensureStore(
  drive: DriveClient,
  props: PropertyStore,
  nowIso: string,
  resolver: string,
): { ids: StoreIds; created: number } {
  const ids: Partial<Record<keyof StoreIds, string>> = {
    ...readStoreIds(props),
  };
  let created = 0;
  for (const [key, run] of steps(drive, nowIso, resolver)) {
    if (ids[key] !== undefined) continue;
    ids[key] = run(ids);
    created++;
    props.setProperty(STORE_KEY, JSON.stringify(ids));
  }
  return { ids: ids as StoreIds, created };
}
