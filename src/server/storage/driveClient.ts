/**
 * Drive v3 operations the store needs (ADR-0002 Layout). Two implementations behind this port:
 * the Advanced Drive service (default) and Drive REST through UrlFetch (`DRIVE_CLIENT=rest`, ADR-0002 Q16 fallback).
 */
export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const JSON_MIME = "application/json";

export type AppProperties = Readonly<Record<string, string>>;

export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly appProperties: AppProperties;
  readonly createdTime: string;
  readonly size: number;
}

export interface NewFile {
  readonly name: string;
  readonly parentId: string;
  readonly text: string;
  readonly appProperties?: AppProperties;
}

export interface DriveClient {
  createFolder(name: string, parentId: string): string;
  createFile(file: NewFile): string;
  updateFile(fileId: string, text: string, appProperties?: AppProperties): void;
  readText(fileId: string): string;
  getMeta(fileId: string): DriveFile;
  /** All pages of a `files.list` query; trashed files are excluded by the caller's query. */
  list(query: string): DriveFile[];
  copy(fileId: string, name: string, parentId: string): string;
  trash(fileId: string): void;
}

/** Fields requested on every metadata read, so both clients return the same shape. */
export const FILE_FIELDS = "id,name,mimeType,appProperties,createdTime,size";

/** Escapes a value for a Drive query string literal. */
export function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function childQuery(parentId: string, extra = ""): string {
  const base = `${quote(parentId)} in parents and trashed = false`;
  return extra === "" ? base : `${base} and ${extra}`;
}

export function appPropertyQuery(key: string, value: string): string {
  return `appProperties has { key=${quote(key)} and value=${quote(value)} }`;
}

interface RawFile {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly mimeType?: unknown;
  readonly appProperties?: unknown;
  readonly createdTime?: unknown;
  readonly size?: unknown;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function stringRecord(value: unknown): AppProperties {
  if (typeof value !== "object" || value === null) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}

/** Normalizes a Drive API file resource from either client. */
export function toDriveFile(raw: unknown): DriveFile {
  const file = (raw ?? {}) as RawFile;
  return {
    id: stringOr(file.id, ""),
    name: stringOr(file.name, ""),
    mimeType: stringOr(file.mimeType, ""),
    appProperties: stringRecord(file.appProperties),
    createdTime: stringOr(file.createdTime, ""),
    size: Number(stringOr(file.size, "0")),
  };
}
