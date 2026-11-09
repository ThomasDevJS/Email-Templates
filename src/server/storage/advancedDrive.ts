import { AppError, ErrorCode } from "../../shared/errors/codes";
import {
  FILE_FIELDS,
  FOLDER_MIME,
  JSON_MIME,
  toDriveFile,
  type AppProperties,
  type DriveClient,
  type NewFile,
} from "./driveClient";

/** The part of the Advanced Drive service v3 (`Drive.Files`) this client calls. */
export interface AdvancedFiles {
  create(resource: object, media?: unknown, options?: object): unknown;
  update(
    resource: object,
    fileId: string,
    media?: unknown,
    options?: object,
  ): unknown;
  get(fileId: string, options?: object): unknown;
  list(options: object): unknown;
  copy(resource: object, fileId: string, options?: object): unknown;
}

export interface BlobMaker {
  newBlob(data: string, contentType: string, name: string): unknown;
}

interface ListPage {
  readonly files?: readonly unknown[];
  readonly nextPageToken?: string;
}

const PAGE_SIZE = 1000;

/** A Drive file resource (what `files.get` returns when `alt: 'media'` is ignored). */
function looksLikeFileResource(value: Record<string, unknown>): boolean {
  return (
    typeof value["id"] === "string" &&
    typeof value["mimeType"] === "string" &&
    (value["kind"] === "drive#file" || typeof value["name"] === "string")
  );
}

/**
 * `files.get` with `alt: 'media'` returns text, bytes or a blob depending on the runtime, and for a JSON
 * file the Advanced service may hand back the parsed object itself (spike S2 (e), observed 2026-11-09).
 */
export function mediaToText(media: unknown): string {
  if (typeof media === "string") return media;
  if (Array.isArray(media)) {
    const bytes = Uint8Array.from(media as number[], (byte) => byte & 0xff);
    return new TextDecoder().decode(bytes);
  }
  if (media === null || typeof media !== "object")
    throw new AppError(
      ErrorCode.INTERNAL,
      `Unreadable Drive media: type=${typeof media}`,
    );
  const record = media as Record<string, unknown>;
  const getDataAsString = record["getDataAsString"];
  if (typeof getDataAsString === "function")
    return (getDataAsString as () => string).call(media);
  if (looksLikeFileResource(record))
    throw new AppError(
      ErrorCode.INTERNAL,
      "Unreadable Drive media: alt=media ignored, got a file resource",
    );
  return JSON.stringify(media);
}

function idOf(file: unknown): string {
  return toDriveFile(file).id;
}

function metadata(file: NewFile): object {
  return {
    name: file.name,
    parents: [file.parentId],
    mimeType: JSON_MIME,
    appProperties: file.appProperties ?? {},
  };
}

export function advancedDriveClient(
  files: AdvancedFiles,
  blobs: BlobMaker,
): DriveClient {
  const blob = (text: string, name: string): unknown =>
    blobs.newBlob(text, JSON_MIME, name);
  return {
    createFolder: (name, parentId) =>
      idOf(
        files.create(
          { name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : [] },
          undefined,
          { fields: "id" },
        ),
      ),
    createFile: (file) =>
      idOf(
        files.create(metadata(file), blob(file.text, file.name), {
          fields: "id",
        }),
      ),
    updateFile: (fileId: string, text: string, props?: AppProperties) => {
      const resource = props === undefined ? {} : { appProperties: props };
      files.update(resource, fileId, blob(text, fileId), { fields: "id" });
    },
    readText: (fileId) => mediaToText(files.get(fileId, { alt: "media" })),
    getMeta: (fileId) =>
      toDriveFile(files.get(fileId, { fields: FILE_FIELDS })),
    list: (query) => listAll(files, query),
    copy: (fileId, name, parentId) =>
      idOf(files.copy({ name, parents: [parentId] }, fileId, { fields: "id" })),
    trash: (fileId) => {
      files.update({ trashed: true }, fileId, undefined, { fields: "id" });
    },
  };
}

function listAll(files: AdvancedFiles, query: string) {
  const found = [];
  let pageToken: string | undefined;
  do {
    const options = {
      q: query,
      pageSize: PAGE_SIZE,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      ...(pageToken === undefined ? {} : { pageToken }),
    };
    const page = files.list(options) as ListPage;
    found.push(...(page.files ?? []).map(toDriveFile));
    pageToken = page.nextPageToken;
  } while (pageToken !== undefined && pageToken !== "");
  return found;
}
