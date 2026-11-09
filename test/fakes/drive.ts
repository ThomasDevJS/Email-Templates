/**
 * In-memory Advanced Drive service v3 (`Drive.Files`) and a Drive REST responder for the fake UrlFetchApp.
 * Models files and folders, parents, appProperties (merged on update, as Drive does), media round trips through
 * blobs, sizes in UTF-8 bytes, `files.list` queries with paging, copy and trash. `failNext` injects a failure.
 */
import type { FakeReply, FakeRequest, Responder } from "./urlFetch";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  appProperties: Record<string, string>;
  content: string;
  createdTime: string;
  trashed: boolean;
}

type Method = "create" | "update" | "get" | "list" | "copy";

interface Resource {
  name?: string;
  mimeType?: string;
  parents?: string[];
  appProperties?: Record<string, string | null>;
  trashed?: boolean;
}

interface MediaLike {
  getDataAsString(): string;
}

function bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** Splits on ` and ` outside quotes and braces. */
function clauses(query: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === "'") quoted = !quoted;
    if (!quoted && char === "{") depth++;
    if (!quoted && char === "}") depth--;
    if (!quoted && depth === 0 && query.startsWith(" and ", i)) {
      parts.push(query.slice(start, i).trim());
      start = i + 5;
    }
  }
  parts.push(query.slice(start).trim());
  return parts.filter((part) => part !== "");
}

const LITERAL = "'((?:\\\\.|[^'\\\\])*)'";
const unescape = (value: string): string => value.replace(/\\(.)/g, "$1");

function matcher(clause: string): (file: FakeFile) => boolean {
  let m = new RegExp(`^${LITERAL} in parents$`).exec(clause);
  if (m) {
    const parent = unescape(m[1] ?? "");
    return (file) => file.parents.includes(parent);
  }
  if (clause === "trashed = false") return (file) => !file.trashed;
  m = new RegExp(`^(name|mimeType) = ${LITERAL}$`).exec(clause);
  if (m) {
    const field = m[1] as "name" | "mimeType";
    const value = unescape(m[2] ?? "");
    return (file) => file[field] === value;
  }
  m = new RegExp(
    `^appProperties has \\{ key=${LITERAL} and value=${LITERAL} \\}$`,
  ).exec(clause);
  if (m) {
    const key = unescape(m[1] ?? "");
    const value = unescape(m[2] ?? "");
    return (file) => file.appProperties[key] === value;
  }
  throw new Error(`Fake Drive does not understand query clause: ${clause}`);
}

export class FakeDrive {
  readonly files = new Map<string, FakeFile>();
  readonly calls: Method[] = [];
  private nextId = 1;
  private readonly failures = new Map<Method, Error>();

  constructor(private readonly nowMs: () => number = () => Date.now()) {}

  failNext(method: Method, error = new Error(`Drive ${method} failed`)): void {
    this.failures.set(method, error);
  }

  private enter(method: Method): void {
    this.calls.push(method);
    const failure = this.failures.get(method);
    if (failure !== undefined) {
      this.failures.delete(method);
      throw failure;
    }
  }

  private file(id: string): FakeFile {
    const file = this.files.get(id);
    if (file === undefined) throw new Error(`File not found: ${id}`);
    return file;
  }

  resource(file: FakeFile): Record<string, unknown> {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      appProperties: { ...file.appProperties },
      createdTime: file.createdTime,
      size: String(bytes(file.content)),
    };
  }

  private mergeProps(file: FakeFile, props: Resource["appProperties"]): void {
    const merged = Object.entries({ ...file.appProperties, ...props });
    file.appProperties = Object.fromEntries(
      merged.filter((entry): entry is [string, string] => entry[1] !== null),
    );
  }

  add(resource: Resource, content: string): FakeFile {
    const file: FakeFile = {
      id: `file-${String(this.nextId++)}`,
      name: resource.name ?? "Untitled",
      mimeType: resource.mimeType ?? "application/octet-stream",
      parents: resource.parents ?? [],
      appProperties: {},
      content,
      createdTime: new Date(this.nowMs()).toISOString(),
      trashed: false,
    };
    this.mergeProps(file, resource.appProperties);
    this.files.set(file.id, file);
    return file;
  }

  patch(fileId: string, resource: Resource, content?: string): FakeFile {
    const file = this.file(fileId);
    if (resource.name !== undefined) file.name = resource.name;
    if (resource.trashed !== undefined) file.trashed = resource.trashed;
    this.mergeProps(file, resource.appProperties);
    if (content !== undefined) file.content = content;
    return file;
  }

  query(q: string): FakeFile[] {
    const tests = clauses(q).map(matcher);
    return [...this.files.values()].filter((file) =>
      tests.every((test) => test(file)),
    );
  }

  /** Text of a file, for assertions. */
  text(id: string): string {
    return this.file(id).content;
  }

  byName(name: string): FakeFile[] {
    return [...this.files.values()].filter((file) => file.name === name);
  }

  readonly Files = {
    create: (resource: Resource, media?: MediaLike): unknown => {
      this.enter("create");
      return this.resource(this.add(resource, media?.getDataAsString() ?? ""));
    },
    update: (
      resource: Resource,
      fileId: string,
      media?: MediaLike,
    ): unknown => {
      this.enter("update");
      return this.resource(
        this.patch(fileId, resource, media?.getDataAsString()),
      );
    },
    get: (fileId: string, options: { alt?: string } = {}): unknown => {
      this.enter("get");
      const file = this.file(fileId);
      return options.alt === "media" ? file.content : this.resource(file);
    },
    list: (options: {
      q: string;
      pageSize?: number;
      pageToken?: string;
    }): unknown => {
      this.enter("list");
      const all = this.query(options.q);
      const start = Number(options.pageToken ?? "0");
      const size = options.pageSize ?? 100;
      const page = all.slice(start, start + size);
      const next = start + size < all.length ? String(start + size) : undefined;
      return {
        files: page.map((file) => this.resource(file)),
        ...(next === undefined ? {} : { nextPageToken: next }),
      };
    },
    copy: (resource: Resource, fileId: string): unknown => {
      this.enter("copy");
      const source = this.file(fileId);
      const copy = this.add(
        {
          name: resource.name ?? source.name,
          mimeType: source.mimeType,
          parents: resource.parents ?? source.parents,
          appProperties: source.appProperties,
        },
        source.content,
      );
      return this.resource(copy);
    },
  };
}

export function createDrive(nowMs?: () => number): FakeDrive {
  return new FakeDrive(nowMs);
}

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

function reply(status: number, body: unknown): FakeReply {
  return {
    status,
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

/** Parses a `multipart/related` payload into its JSON metadata and its media text. */
function parseMultipart(
  payload: string,
  contentType: string,
): [Resource, string] {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1] ?? "";
  const parts = payload
    .split(`--${boundary}`)
    .map((part) => part.replace(/^\r\n/, "").replace(/\r\n$/, ""))
    .filter((part) => part !== "" && part !== "--");
  const body = (part: string): string =>
    part.slice(part.indexOf("\r\n\r\n") + 4);
  return [JSON.parse(body(parts[0] ?? "")) as Resource, body(parts[1] ?? "")];
}

function route(drive: FakeDrive, request: FakeRequest): FakeReply {
  const url = new URL(request.url);
  const path = `${url.origin}${url.pathname}`;
  const method = request.params.method ?? "get";
  const payload =
    typeof request.params.payload === "string" ? request.params.payload : "";
  const contentType = request.params.contentType ?? "";
  const id = path.split("/files/")[1] ?? "";
  if (path === UPLOAD && method === "post") {
    const [meta, text] = parseMultipart(payload, contentType);
    return reply(
      200,
      drive.Files.create(meta, { getDataAsString: () => text }),
    );
  }
  if (path.startsWith(`${UPLOAD}/`) && method === "patch") {
    const [meta, text] = parseMultipart(payload, contentType);
    return reply(
      200,
      drive.Files.update(meta, id, { getDataAsString: () => text }),
    );
  }
  if (path === API && method === "post")
    return reply(200, drive.Files.create(JSON.parse(payload) as Resource));
  if (path === API && method === "get") {
    const pageToken = url.searchParams.get("pageToken");
    return reply(
      200,
      drive.Files.list({
        q: url.searchParams.get("q") ?? "",
        pageSize: Number(url.searchParams.get("pageSize") ?? "100"),
        ...(pageToken === null ? {} : { pageToken }),
      }),
    );
  }
  if (path.endsWith("/copy") && method === "post")
    return reply(
      200,
      drive.Files.copy(
        JSON.parse(payload) as Resource,
        id.replace("/copy", ""),
      ),
    );
  if (method === "patch")
    return reply(200, drive.Files.update(JSON.parse(payload) as Resource, id));
  const alt = url.searchParams.get("alt") ?? "";
  return reply(200, drive.Files.get(id, alt === "" ? {} : { alt }));
}

/** Answers Drive REST v3 calls from the fake UrlFetchApp against `drive`; 401 without a bearer token. */
export function driveRestResponder(drive: FakeDrive): Responder {
  return (request) => {
    const headers = (request.params.headers ?? {}) as Record<string, string>;
    if (!(headers["Authorization"] ?? "").startsWith("Bearer "))
      return reply(401, "");
    try {
      return route(drive, request);
    } catch (error: unknown) {
      return reply(404, { error: String(error) });
    }
  };
}
