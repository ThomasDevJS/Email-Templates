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

/**
 * Drive REST v3 through UrlFetch with the owner's token (ADR-0002 Q16 fallback, `DRIVE_CLIENT=rest`).
 * Same scope `drive.file`; the manifest `urlFetchWhitelist` lists the two Drive URL prefixes below.
 */
export const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
export const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const BOUNDARY = "migway-templates-part";

export interface HttpResponse {
  getResponseCode(): number;
  getContentText(): string;
}

export interface HttpOptions {
  readonly method: "get" | "post" | "patch";
  readonly headers: Readonly<Record<string, string>>;
  readonly contentType?: string;
  readonly payload?: string;
  readonly muteHttpExceptions: true;
}

export type HttpFetch = (url: string, options: HttpOptions) => HttpResponse;

function multipart(meta: object, text: string): string {
  return [
    `--${BOUNDARY}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(meta),
    `--${BOUNDARY}`,
    `Content-Type: ${JSON_MIME}`,
    "",
    text,
    `--${BOUNDARY}--`,
  ].join("\r\n");
}

const FILE_ID = /^[\w-]+$/;

/**
 * Drive file IDs hold letters, digits, `-` and `_`; any other ID is refused before a request. Encoding alone is not
 * enough: URL parsers read `%2e%2e` as `..`, which climbs out of `/files/`.
 */
export function fileUrl(base: string, fileId: string): string {
  if (!FILE_ID.test(fileId))
    throw new AppError(
      ErrorCode.INTERNAL,
      "Drive REST refused a malformed file ID",
    );
  return `${base}/${fileId}`;
}

function query(params: Readonly<Record<string, string>>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

interface Request {
  readonly method: HttpOptions["method"];
  readonly url: string;
  readonly json?: object;
  readonly upload?: { readonly meta: object; readonly text: string };
}

function sender(fetch: HttpFetch, token: () => string) {
  return (request: Request): string => {
    const options = buildOptions(request, token());
    const response = fetch(request.url, options);
    const code = response.getResponseCode();
    if (code === 429)
      throw new AppError(
        ErrorCode.QUOTA,
        "Service is busy. Try again in a minute.",
      );
    if (code < 200 || code >= 300) {
      throw new AppError(
        ErrorCode.INTERNAL,
        `Drive REST ${request.method} failed with HTTP ${String(code)}`,
      );
    }
    return response.getContentText();
  };
}

/**
 * Raw media read through Drive REST. The Advanced client uses it for text that is not one JSON document, which
 * `Drive.Files.get` with `alt: 'media'` fails to return (it parses media as JSON and throws, HTTP status 200).
 */
export function restMediaReader(
  fetch: HttpFetch,
  token: () => string,
): (fileId: string) => string {
  const send = sender(fetch, token);
  return (fileId) =>
    send({ method: "get", url: `${fileUrl(DRIVE_API, fileId)}?alt=media` });
}

export function restDriveClient(
  fetch: HttpFetch,
  token: () => string,
): DriveClient {
  const send = sender(fetch, token);
  const media = restMediaReader(fetch, token);
  const json = (request: Request): unknown => JSON.parse(send(request));
  return {
    createFolder: (name, parentId) =>
      toDriveFile(
        json({
          method: "post",
          url: `${DRIVE_API}?fields=id`,
          json: {
            name,
            mimeType: FOLDER_MIME,
            parents: parentId ? [parentId] : [],
          },
        }),
      ).id,
    createFile: (file: NewFile) =>
      toDriveFile(
        json({
          method: "post",
          url: `${DRIVE_UPLOAD}?uploadType=multipart&fields=id`,
          upload: {
            meta: {
              name: file.name,
              parents: [file.parentId],
              mimeType: JSON_MIME,
              appProperties: file.appProperties ?? {},
            },
            text: file.text,
          },
        }),
      ).id,
    updateFile: (fileId: string, text: string, props?: AppProperties) => {
      send({
        method: "patch",
        url: `${fileUrl(DRIVE_UPLOAD, fileId)}?uploadType=multipart&fields=id`,
        upload: {
          meta: props === undefined ? {} : { appProperties: props },
          text,
        },
      });
    },
    readText: media,
    readRawText: media,
    getMeta: (fileId) =>
      toDriveFile(
        json({
          method: "get",
          url: `${fileUrl(DRIVE_API, fileId)}?${query({ fields: FILE_FIELDS })}`,
        }),
      ),
    list: (q) => listAll(json, q),
    copy: (fileId, name, parentId) =>
      toDriveFile(
        json({
          method: "post",
          url: `${fileUrl(DRIVE_API, fileId)}/copy?fields=id`,
          json: { name, parents: [parentId] },
        }),
      ).id,
    trash: (fileId) => {
      send({
        method: "patch",
        url: `${fileUrl(DRIVE_API, fileId)}?fields=id`,
        json: { trashed: true },
      });
    },
  };
}

function buildOptions(request: Request, token: string): HttpOptions {
  const headers = { Authorization: `Bearer ${token}` };
  if (request.upload !== undefined) {
    return {
      method: request.method,
      headers,
      contentType: `multipart/related; boundary=${BOUNDARY}`,
      payload: multipart(request.upload.meta, request.upload.text),
      muteHttpExceptions: true,
    };
  }
  if (request.json !== undefined) {
    return {
      method: request.method,
      headers,
      contentType: "application/json",
      payload: JSON.stringify(request.json),
      muteHttpExceptions: true,
    };
  }
  return { method: request.method, headers, muteHttpExceptions: true };
}

interface ListPage {
  readonly files?: readonly unknown[];
  readonly nextPageToken?: string;
}

function listAll(json: (request: Request) => unknown, q: string) {
  const found = [];
  let pageToken = "";
  do {
    const params = {
      q,
      pageSize: "1000",
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      ...(pageToken === "" ? {} : { pageToken }),
    };
    const page = json({
      method: "get",
      url: `${DRIVE_API}?${query(params)}`,
    }) as ListPage;
    found.push(...(page.files ?? []).map(toDriveFile));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken !== "");
  return found;
}
