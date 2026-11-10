import { AppError, ErrorCode } from "../../shared/errors/codes";
import {
  readIndexDoc,
  withSubject,
  type BodyFile,
  type StoredIndex,
  type Unmigrated,
} from "../../shared/model/data";
import {
  favoritesProblem,
  indexProblem,
  usageProblem,
} from "../../shared/model/shape";
import { appendUnique } from "../audit/lines";
import {
  FOLDER_MIME,
  appPropertyQuery,
  childQuery,
  quote,
  type DriveClient,
  type DriveFile,
} from "./driveClient";
import type {
  BackupDocs,
  BodyRef,
  NamedRef,
  SideDocs,
  SideName,
  SizedRef,
  StorePort,
} from "./port";

/** Folder and file IDs kept in Script Property `STORE` (ADR-0002 Layout). */
export interface StoreIds {
  readonly rootId: string;
  readonly bodiesId: string;
  readonly auditId: string;
  readonly backupsId: string;
  readonly indexId: string;
  readonly favoritesId: string;
  readonly usageId: string;
  readonly membersId: string;
}

export const FILE_NAMES = {
  index: "index.json",
  favorites: "favorites.json",
  usage: "usage.json",
  members: "members.json",
} as const;

const BACKED_UP = ["indexId", "favoritesId", "usageId"] as const;
const BACKUP_NAMES = [FILE_NAMES.index, FILE_NAMES.favorites, FILE_NAMES.usage];

function sideId(ids: StoreIds, name: SideName): string {
  return ids[`${name}Id`];
}

export function bodyName(itemId: string, version: number): string {
  return `${itemId}.v${String(version)}.json`;
}

function toBodyRef(file: DriveFile): BodyRef {
  const props = file.appProperties;
  return {
    fileId: file.id,
    itemId: props["itemId"] ?? "",
    version: Number(props["version"] ?? "0"),
    savedBy: props["savedBy"] ?? "",
    restoredFrom: Number(props["restoredFrom"] ?? "0"),
    createdTime: file.createdTime,
  };
}

const named = (file: DriveFile): NamedRef => ({ id: file.id, name: file.name });
const sized = (file: DriveFile): SizedRef => ({
  ...named(file),
  size: file.size,
});

function parseJson(
  text: string,
  what: string,
  code: ErrorCode = ErrorCode.INTERNAL,
): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(code, `${what} is not valid JSON`);
  }
}

/** Shape check per stored file (src/shared/model/shape.ts); `members.json` is written by the job alone. */
const PROBLEM: Readonly<Record<string, (doc: unknown) => string>> = {
  [FILE_NAMES.index]: indexProblem,
  [FILE_NAMES.favorites]: favoritesProblem,
  [FILE_NAMES.usage]: usageProblem,
};

/** Parses a stored file and checks its shape; a damaged file throws `code` naming the file and the problem. */
function readChecked(
  text: string,
  name: string,
  code: ErrorCode = ErrorCode.INTERNAL,
): unknown {
  const doc = parseJson(text, name, code);
  const problem = PROBLEM[name]?.(doc) ?? "";
  if (problem !== "")
    throw new AppError(code, `${name} is damaged: ${problem}`);
  return doc;
}

export function driveStore(drive: DriveClient, ids: StoreIds): StorePort {
  const findChild = (parentId: string, name: string): DriveFile | undefined =>
    drive.list(childQuery(parentId, `name = ${quote(name)}`))[0];
  const backupFolder = (dateKey: string): string =>
    findChild(ids.backupsId, dateKey)?.id ??
    drive.createFolder(dateKey, ids.backupsId);
  return {
    readIndex: () =>
      readIndexDoc(
        readChecked(
          drive.readText(ids.indexId),
          FILE_NAMES.index,
        ) as StoredIndex,
      ),
    readIndexRev: () =>
      Number(drive.getMeta(ids.indexId).appProperties["rev"] ?? "0"),
    writeIndex: (doc) => {
      drive.updateFile(ids.indexId, JSON.stringify(doc), {
        rev: String(doc.rev),
      });
    },
    readSide: <K extends SideName>(name: K) =>
      readChecked(
        drive.readText(sideId(ids, name)),
        FILE_NAMES[name],
      ) as SideDocs[K],
    writeSide: (name, doc) => {
      drive.updateFile(sideId(ids, name), JSON.stringify(doc));
    },
    createBody: (body: BodyFile) =>
      drive.createFile({
        name: bodyName(body.itemId, body.version),
        parentId: ids.bodiesId,
        text: JSON.stringify(body),
        appProperties: {
          itemId: body.itemId,
          version: String(body.version),
          savedBy: body.savedBy,
          restoredFrom: String(body.restoredFrom),
        },
      }),
    readBody: (fileId) =>
      withSubject<BodyFile>(
        parseJson(drive.readText(fileId), "body") as Unmigrated<BodyFile>,
      ),
    listBodies: (itemId) =>
      drive
        .list(
          itemId === undefined
            ? childQuery(ids.bodiesId)
            : childQuery(ids.bodiesId, appPropertyQuery("itemId", itemId)),
        )
        .map(toBodyRef),
    copyToBackup: (dateKey) => {
      const folderId = backupFolder(dateKey);
      const present = new Set(
        drive.list(childQuery(folderId)).map((f) => f.name),
      );
      BACKED_UP.forEach((key, i) => {
        const name = BACKUP_NAMES[i] ?? "";
        if (!present.has(name)) drive.copy(ids[key], name, folderId);
      });
    },
    listBackups: () =>
      drive
        .list(childQuery(ids.backupsId, `mimeType = ${quote(FOLDER_MIME)}`))
        .map(named),
    appendAudit: (month, events) => {
      const name = `${month}.jsonl`;
      const existing = findChild(ids.auditId, name);
      const before = existing === undefined ? "" : drive.readText(existing.id);
      const { text, added } = appendUnique(before, events);
      if (added === 0) return 0;
      if (existing === undefined)
        drive.createFile({ name, parentId: ids.auditId, text });
      else drive.updateFile(existing.id, text);
      return added;
    },
    readBackup: (dateKey) => {
      const folder = findChild(ids.backupsId, dateKey);
      if (folder === undefined) return null;
      const files = new Map(
        drive.list(childQuery(folder.id)).map((f) => [f.name, f.id]),
      );
      // Every copy is read and checked before the caller takes the lock; any problem names the file.
      const read = (name: string): unknown => {
        const id = files.get(name);
        if (id === undefined)
          throw new AppError(
            ErrorCode.VALIDATION,
            `This backup cannot be read: ${name} is missing`,
          );
        try {
          return readChecked(drive.readText(id), name, ErrorCode.VALIDATION);
        } catch (error: unknown) {
          if (!(error instanceof AppError)) throw error;
          throw new AppError(
            ErrorCode.VALIDATION,
            `This backup cannot be read: ${error.message}`,
          );
        }
      };
      const [index, favorites, usage] = BACKUP_NAMES.map(read);
      return {
        index: readIndexDoc(index as StoredIndex),
        favorites,
        usage,
      } as BackupDocs;
    },
    listAuditFiles: () => drive.list(childQuery(ids.auditId)).map(sized),
    readText: (fileId) => drive.readText(fileId),
    trash: (fileId) => {
      drive.trash(fileId);
    },
  };
}
