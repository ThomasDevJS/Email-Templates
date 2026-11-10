import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { Level, PrincipalType } from "../../shared/model/data";
import {
  IMPORT_ITEMS_MAX,
  IMPORT_MAX_BYTES,
} from "../../shared/model/validate";
import { utf8Length } from "../../shared/text";

/**
 * Export file (ADR-0002 Backup and export): `{ schemaVersion, exportedAt, exportedBy, scope, folders[], grants[],
 * items[{ meta, html }] }`, current versions only, subjects included. Folders and items keep their source IDs so
 * an import can rebuild the tree; an import gives every record a new ID.
 */
export const EXPORT_SCHEMA_VERSION = 1;
/** Upload limits (bytes and templates in shared/model/validate.ts), enforced on the server before parsing. */
export const IMPORT_FOLDERS_MAX = 100;

export interface ExportFolder {
  readonly id: string;
  readonly parentId: string;
  readonly name: string;
}

export interface ExportGrant {
  readonly folderId: string;
  readonly principalType: PrincipalType;
  readonly principalKey: string;
  readonly level: Level;
}

export interface ExportItem {
  readonly meta: {
    readonly id: string;
    readonly folderId: string;
    readonly title: string;
    readonly subject: string;
    readonly tags: readonly string[];
  };
  readonly html: string;
}

export interface ExportScope {
  readonly kind: "library" | "folder";
  readonly folderId: string;
  readonly name: string;
}

export interface ExportHeader {
  readonly schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly exportedBy: string;
  readonly scope: ExportScope;
  readonly folders: readonly ExportFolder[];
  readonly grants: readonly ExportGrant[];
}

/** One record of the file as read: usable fields, or the reason it cannot be used. */
export type Parsed<T> =
  | { readonly ok: true; readonly value: T; readonly label: string }
  | { readonly ok: false; readonly reason: string; readonly label: string };

export interface ImportFile {
  readonly folders: readonly Parsed<ExportFolder>[];
  readonly items: readonly Parsed<ExportItem>[];
}

type Json = Readonly<Record<string, unknown>>;

function invalid(message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message);
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const str = (record: Json, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" ? value : null;
};

/** A short name for the import report: the record's title or name, cut to 120 characters. */
function labelOf(record: unknown, key: string, position: number): string {
  const value = isRecord(record) ? str(record, key) : null;
  return value === null || value.trim() === ""
    ? `#${String(position + 1)}`
    : value.trim().slice(0, 120);
}

function parseFolder(raw: unknown, position: number): Parsed<ExportFolder> {
  const label = labelOf(raw, "name", position);
  if (!isRecord(raw))
    return { ok: false, reason: "Not a folder record", label };
  const id = str(raw, "id");
  const parentId = str(raw, "parentId") ?? "";
  const name = str(raw, "name");
  if (id === null || id === "" || name === null)
    return { ok: false, reason: "Folder needs an id and a name", label };
  return { ok: true, value: { id, parentId, name }, label };
}

function stringList(value: unknown): string[] | null {
  if (value === undefined) return [];
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? value
    : null;
}

function parseItem(raw: unknown, position: number): Parsed<ExportItem> {
  const meta = isRecord(raw) ? raw["meta"] : undefined;
  const label = labelOf(meta, "title", position);
  const html = isRecord(raw) ? str(raw, "html") : null;
  if (!isRecord(meta) || html === null)
    return { ok: false, reason: "Template needs meta and html", label };
  const title = str(meta, "title");
  const tags = stringList(meta["tags"]);
  if (title === null || tags === null)
    return { ok: false, reason: "Template needs a title and text tags", label };
  return {
    ok: true,
    value: {
      meta: {
        id: str(meta, "id") ?? "",
        folderId: str(meta, "folderId") ?? "",
        title,
        subject: str(meta, "subject") ?? "",
        tags,
      },
      html,
    },
    label,
  };
}

function list(file: Json, key: string, max: number): unknown[] {
  const value = file[key] ?? [];
  if (!Array.isArray(value)) throw invalid(`${key} must be a list`);
  if (value.length > max)
    throw invalid(
      `The file has more than ${String(max)} ${key}. Export smaller folders and import them one by one.`,
    );
  return value;
}

/**
 * File-level checks, all before any write: size, JSON, schema version, list sizes. A bad record does not fail the
 * file; it becomes a failed entry with its reason. Error messages never echo file content.
 */
export function parseImportFile(text: string): ImportFile {
  if (utf8Length(text) > IMPORT_MAX_BYTES)
    throw invalid(
      `The file is larger than ${String(IMPORT_MAX_BYTES / 1024 / 1024)} MB`,
    );
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw invalid("The file is not valid JSON");
  }
  if (!isRecord(file)) throw invalid("The file is not a Migway export");
  if (file["schemaVersion"] !== EXPORT_SCHEMA_VERSION)
    throw invalid(
      `Unsupported schema version: this app reads version ${String(EXPORT_SCHEMA_VERSION)}`,
    );
  const folders = list(file, "folders", IMPORT_FOLDERS_MAX).map(parseFolder);
  refuseDuplicateIds(folders);
  return {
    folders,
    items: list(file, "items", IMPORT_ITEMS_MAX).map(parseItem),
  };
}

/** Two folders with one ID would split their templates; the file is refused, naming both by position. */
function refuseDuplicateIds(folders: readonly Parsed<ExportFolder>[]): void {
  const seen = new Map<string, number>();
  for (const [n, record] of folders.entries()) {
    if (!record.ok) continue;
    const first = seen.get(record.value.id);
    if (first !== undefined)
      throw invalid(
        `Folders #${String(first + 1)} and #${String(n + 1)} of the file have the same id`,
      );
    seen.set(record.value.id, n);
  }
}
