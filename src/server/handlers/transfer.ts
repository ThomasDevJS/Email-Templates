import type { PreparedBody } from "../../shared/body/prepare";
import { AppError, ErrorCode, toErrorBody } from "../../shared/errors/codes";
import type { Folder, IndexDoc, Item } from "../../shared/model/data";
import {
  importRecipients,
  recipientsOf,
  type RecipientCode,
} from "../../shared/model/recipients";
import { tagList, templateTitle } from "../../shared/model/validate";
import { isId } from "../../shared/ids";
import { inPrivateTree } from "../../shared/permissions/effective";
import { controlIndex, oneLine } from "../../shared/placeholders/subject";
import { auditEvent, type EventSource } from "../audit/events";
import { optBool, optInt, optString, reqString } from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { nowIso } from "../services";
import {
  EXPORT_SCHEMA_VERSION,
  parseImportFile,
  type ExportHeader,
  type ExportItem,
  type ExportScope,
  type ImportFile,
} from "../transfer/format";
import {
  claimTitle,
  folderFor,
  planFolders,
  titlesByFolder,
  type FolderPlan,
  type MakeFolder,
  type ReportLine,
} from "../transfer/plan";
import {
  prepareFor,
  readStoredBody,
  recheckRecipients,
  recipientPolicy,
} from "./body";
import { commit } from "./commit";
import { newFolder } from "./folders";
import { chainOf, folderPath, liveFolder } from "./indexOps";
import {
  bodyFields,
  templateEvent,
  writeBody,
  type BodyRef,
} from "./templates";

/**
 * Export and import (wireframe 06, spec 4.5, ADR-0002 Backup and export). An export run starts with a `start: true`
 * call: it commits one audit event into `pendingAudit` (who, scope, number of templates; no title, content or
 * address) and returns a run token. Each page call carries the token and reads at most EXPORT_PAGE bodies from
 * Drive (cache first, never cache-filling); the browser joins the pages into one file. Import is admin only and
 * runs Validate (`dryRun`) and Import on the same rules.
 */
export const EXPORT_PAGE = 20;
/** A run token lives this long after its start or its last page (sliding, so a long export keeps going). */
export const EXPORT_RUN_TTL_S = 600;
export const EXPORT_RESTART =
  "This export is no longer valid (it expired or belongs to another session). Nothing was downloaded. Start the export again.";

/** Live folders of the subtree under `rootId`, the root included. */
function subtree(index: IndexDoc, rootId: string): Set<string> {
  const ids = new Set([rootId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const folder of index.folders)
      if (
        folder.deletedAt === "" &&
        ids.has(folder.parentId) &&
        !ids.has(folder.id)
      ) {
        ids.add(folder.id);
        grew = true;
      }
  }
  return ids;
}

/** Shared folders outside every private tree: private templates stay with their owners (D11). */
function libraryFolders(index: IndexDoc): Set<string> {
  return new Set(
    index.folders
      .filter((f) => f.deletedAt === "" && !inPrivateTree(chainOf(index, f.id)))
      .map((f) => f.id),
  );
}

/** The scope of an export and its folders on a given index (the request's, or the one read inside the lock). */
interface Scoped {
  readonly scope: ExportScope;
  readonly folderIds: (index: IndexDoc) => ReadonlySet<string>;
}

function liveItems(index: IndexDoc, folderIds: ReadonlySet<string>): Item[] {
  return index.items.filter(
    (item) => item.deletedAt === "" && folderIds.has(item.folderId),
  );
}

export interface ExportPage {
  readonly header: ExportHeader;
  readonly items: ExportItem[];
  readonly total: number;
  /** Offset of the next page, null after the last one. */
  readonly next: number | null;
}

export interface ExportStart {
  /** Run token for the page calls; valid for this caller and scope only. */
  readonly token: string;
  readonly total: number;
}

/** What the Script Cache holds under `exp:<token>`. */
interface ExportRun {
  readonly actor: string;
  readonly kind: ExportScope["kind"];
  readonly folderId: string;
}

const runKey = (token: string): string => `exp:${token}`;

/**
 * Commits the one audit event of an export run through the index write (ADR-0002 security events), counted on the
 * index read inside the lock, then stores the run token. A failed commit (BUSY, Drive error) throws a retryable
 * error and no token exists, so no page can be read.
 */
function startExport(context: HandlerContext, scoped: Scoped): ExportStart {
  const { scope } = scoped;
  const folder = scope.kind === "folder";
  const total = commit(context, (current) => {
    if (folder) liveFolder(current, scope.folderId);
    const templates = liveItems(current, scoped.folderIds(current)).length;
    const event = auditEvent(eventSource(context, scope.folderId), {
      action: folder ? "export.folder" : "export.library",
      targetType: folder ? "folder" : "library",
      targetId: scope.folderId,
      targetPath: folder ? folderPath(current, scope.folderId) : "",
      after: { scope: scope.kind, templates },
    });
    return { doc: current, events: [event], result: templates };
  });
  const token = context.services.newId();
  const run: ExportRun = {
    actor: context.caller.email,
    kind: scope.kind,
    folderId: scope.folderId,
  };
  context.services.cache.put(
    runKey(token),
    JSON.stringify(run),
    EXPORT_RUN_TTL_S,
  );
  return { token, total };
}

/**
 * Refuses a page whose token is missing, malformed, expired or evicted, or belongs to another caller or scope;
 * otherwise extends the token's life by EXPORT_RUN_TTL_S.
 */
function checkRun(context: HandlerContext, scope: ExportScope): void {
  const token = optString(context.args, "token");
  const raw = isId(token) ? context.services.cache.get(runKey(token)) : null;
  const run = raw === null ? null : (JSON.parse(raw) as ExportRun);
  if (
    raw === null ||
    run?.actor !== context.caller.email ||
    run.kind !== scope.kind ||
    run.folderId !== scope.folderId
  )
    throw new AppError(ErrorCode.VALIDATION, EXPORT_RESTART);
  context.services.cache.put(runKey(token), raw, EXPORT_RUN_TTL_S);
}

/** One page of the export of `scoped`. Grants of folders outside the scope never appear. */
function exportPage(context: HandlerContext, scoped: Scoped): ExportPage {
  const { scope } = scoped;
  checkRun(context, scope);
  const { index } = context.access();
  const offset = optInt(context.args, "offset");
  const scopeIds = scoped.folderIds(index);
  const folders = index.folders
    .filter((folder) => scopeIds.has(folder.id))
    .map((folder) => ({
      id: folder.id,
      parentId: folder.id === scope.folderId ? "" : folder.parentId,
      name: folder.name,
    }));
  const grants = index.grants
    .filter((grant) => scopeIds.has(grant.folderId))
    .map(({ folderId, principalType, principalKey, level }) => ({
      folderId,
      principalType,
      principalKey,
      level,
    }));
  const items = liveItems(index, scopeIds);
  const page = items.slice(offset, offset + EXPORT_PAGE).map((item) => ({
    meta: {
      id: item.id,
      folderId: item.folderId,
      title: item.title,
      subject: item.subject,
      tags: item.tags,
      ...recipientsOf(item),
    },
    html: readStoredBody(context.services, item, false),
  }));
  const end = offset + page.length;
  return {
    header: {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: nowIso(context.services),
      exportedBy: context.caller.email,
      scope,
      folders,
      grants,
    },
    items: page,
    total: items.length,
    next: end < items.length ? end : null,
  };
}

/** `start: true` starts a run (audit event, token); otherwise one page of the run named by `token`. */
function runExport(
  context: HandlerContext,
  scoped: Scoped,
): ExportStart | ExportPage {
  return optBool(context.args, "start")
    ? startExport(context, scoped)
    : exportPage(context, scoped);
}

/** `export.folder` (manage on the folder): the folder and its subtree. */
export function exportFolder(
  context: HandlerContext,
): ExportStart | ExportPage {
  const root = liveFolder(
    context.access().index,
    reqString(context.args, "folderId"),
  );
  return runExport(context, {
    scope: { kind: "folder", folderId: root.id, name: root.name },
    folderIds: (index) => subtree(index, root.id),
  });
}

/** `export.library` (admin): every shared folder and its templates. */
export function exportLibrary(
  context: HandlerContext,
): ExportStart | ExportPage {
  return runExport(context, {
    scope: { kind: "library", folderId: "", name: "" },
    folderIds: libraryFolders,
  });
}

interface Ready {
  readonly id: string;
  readonly label: string;
  readonly fileFolderId: string;
  readonly title: string;
  readonly tags: string[];
  readonly body: PreparedBody;
  /** Codes of the addresses the import dropped (spec 5.7). */
  readonly dropped: readonly RecipientCode[];
}

type Prepared =
  | { readonly ok: true; readonly ready: Ready }
  | { readonly ok: false; readonly label: string; readonly reason: string };

function reasonOf(error: unknown): string {
  if (!(error instanceof AppError)) throw error;
  const problems = error.details?.["problems"];
  if (!Array.isArray(problems) || problems.length === 0) return error.message;
  const first = problems[0] as { code: string; message: string };
  const more =
    problems.length > 1 ? ` (and ${String(problems.length - 1)} more)` : "";
  return `${first.code}: ${first.message}${more}`;
}

/**
 * Item rules of a save (spec 5.3), the spec 5.6 import rule for the subject (control characters become one space,
 * then `prepareBody` rejects SUBJ_TOO_LONG and PH_* problems) and the spec 5.7 rule for recipients (bad addresses
 * dropped; too many refuses the whole file).
 */
function prepareItems(context: HandlerContext, file: ImportFile): Prepared[] {
  const policy = recipientPolicy(context);
  return file.items.map((record): Prepared => {
    if (!record.ok)
      return { ok: false, label: record.label, reason: record.reason };
    const { meta, html } = record.value;
    const { recipients, dropped, problems } = importRecipients(meta, policy);
    const [tooMany] = problems;
    if (tooMany !== undefined)
      throw new AppError(
        ErrorCode.VALIDATION,
        `Nothing was imported: the template ${record.label}: ${tooMany.message}`,
      );
    try {
      return {
        ok: true,
        ready: {
          id: context.services.newId(),
          label: record.label,
          fileFolderId: meta.folderId,
          title: templateTitle(meta.title),
          tags: tagList(meta.tags),
          body: prepareFor(context, html, oneLine(meta.subject), recipients),
          dropped,
        },
      };
    } catch (error: unknown) {
      return { ok: false, label: record.label, reason: reasonOf(error) };
    }
  });
}

const DROP_REASONS: Readonly<Record<RecipientCode, string>> = {
  RCPT_FORMAT: "not an email address",
  RCPT_TOO_LONG: "longer than 254 characters",
  RCPT_TOO_MANY: "too many",
  RCPT_DUPLICATE: "already in an earlier field",
  RCPT_EXTERNAL: "outside the domain, turned off by the admin",
};

/** "2 addresses dropped: not an email address (1), already in an earlier field (1)". Counts, never an address. */
function droppedText(codes: readonly RecipientCode[]): string {
  const counts = new Map<RecipientCode, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  const parts = [...counts].map(
    ([code, n]) => `${DROP_REASONS[code]} (${String(n)})`,
  );
  const s = codes.length === 1 ? "" : "es";
  return `${String(codes.length)} address${s} dropped: ${parts.join(", ")}`;
}

interface Placement {
  readonly folders: FolderPlan;
  readonly placed: { readonly ready: Ready; readonly folderId: string }[];
  readonly lines: ReportLine[];
}

/** Folders, then templates, on one index: the same rules for Validate (before the lock) and Import (inside it). */
function place(
  index: IndexDoc,
  targetId: string,
  file: ImportFile,
  prepared: readonly Prepared[],
  make: MakeFolder,
): Placement {
  const folders = planFolders(index, targetId, file.folders, make);
  const titles = titlesByFolder(index);
  const lines: ReportLine[] = [...folders.lines];
  const placed: Placement["placed"] = [];
  const line = (name: string, outcome: ReportLine["outcome"], reason: string) =>
    lines.push({ kind: "template", name, outcome, reason });
  for (const entry of prepared) {
    if (!entry.ok) {
      line(entry.label, "failed", entry.reason);
      continue;
    }
    const folderId = folderFor(folders, targetId, entry.ready.fileFolderId);
    if (folderId === null)
      line(entry.ready.label, "failed", "Its folder was not imported");
    else if (!claimTitle(titles, folderId, entry.ready.title))
      line(
        entry.ready.label,
        "skipped",
        "A template with this title is already in this folder",
      );
    else {
      placed.push({ ready: entry.ready, folderId });
      if (entry.ready.dropped.length > 0)
        line(entry.ready.label, "imported", droppedText(entry.ready.dropped));
    }
  }
  return { folders, placed, lines };
}

export interface ImportReport {
  readonly dryRun: boolean;
  readonly created: number;
  readonly skipped: number;
  readonly failed: number;
  readonly foldersCreated: number;
  readonly foldersReused: number;
  readonly subjectsFlattened: number;
  /** Recipient addresses dropped over all placed templates (spec 5.7). */
  readonly addressesDropped: number;
  readonly lines: readonly ReportLine[];
}

function report(
  dryRun: boolean,
  placement: Placement,
  created: number,
  flattened: number,
): ImportReport {
  const templates = placement.lines.filter((l) => l.kind === "template");
  return {
    dryRun,
    created,
    skipped: templates.filter((l) => l.outcome === "skipped").length,
    failed: templates.filter((l) => l.outcome === "failed").length,
    foldersCreated: placement.folders.created.length,
    foldersReused: placement.folders.reused,
    subjectsFlattened: flattened,
    addressesDropped: placement.placed.reduce(
      (sum, { ready }) => sum + ready.dropped.length,
      0,
    ),
    lines: placement.lines,
  };
}

function importedItem(
  context: HandlerContext,
  ready: Ready,
  folderId: string,
  body: BodyRef,
): Item {
  const now = nowIso(context.services);
  const email = context.caller.email;
  return {
    id: ready.id,
    kind: "template",
    folderId,
    status: "published",
    title: ready.title,
    tags: ready.tags,
    createdAt: now,
    createdBy: email,
    updatedAt: now,
    updatedBy: email,
    deletedAt: "",
    deletedBy: "",
    ...bodyFields(ready.body, body),
  };
}

function folderEvents(
  source: EventSource,
  doc: IndexDoc,
  created: readonly Folder[],
) {
  return created.map((folder) =>
    auditEvent(source, {
      action: "import",
      targetType: "folder",
      targetId: folder.id,
      targetPath: folderPath(doc, folder.id),
      after: folder,
    }),
  );
}

/**
 * `import` (admin): `file` is the export JSON text, `folderId` the target folder. With `dryRun` nothing is written
 * and the report says what Import would do. Import writes the body files of the placed templates outside the lock,
 * then places again on the index read inside the lock and commits folders, templates and one `import` audit event
 * per record. A template placed now but not before the lock is skipped; its body file, if any, is an orphan the
 * daily cleanup removes.
 */
export function importTemplates(context: HandlerContext): ImportReport {
  const targetId = reqString(context.args, "folderId");
  const dryRun = optBool(context.args, "dryRun");
  const file = parseImportFile(optString(context.args, "file"));
  const { index } = context.access();
  liveFolder(index, targetId);
  if (inPrivateTree(chainOf(index, targetId)))
    throw new AppError(
      ErrorCode.VALIDATION,
      "Templates cannot be imported into a private folder. Pick a shared folder.",
    );
  const prepared = prepareItems(context, file);
  const flattened = file.items.filter(
    (record) => record.ok && controlIndex(record.value.meta.subject) >= 0,
  ).length;
  const make: MakeFolder = (parentId, name, sortOrder) =>
    newFolder(context, {
      parentId,
      name,
      kind: "shared",
      ownerEmail: "",
      sortOrder,
    });
  const before = place(index, targetId, file, prepared, make);
  if (dryRun) return report(true, before, before.placed.length, flattened);
  const bodies = new Map(
    before.placed.map(({ ready }) => [
      ready.id,
      nothingImported(`the template ${ready.label} could not be saved`, () =>
        writeBody(context, ready.id, 1, ready.body),
      ),
    ]),
  );
  const source = eventSource(context, targetId);
  return nothingImported("the library could not be written", () =>
    commitImport(context, {
      targetId,
      file,
      prepared,
      make,
      bodies,
      source,
      flattened,
    }),
  );
}

/**
 * Runs `work`; a failure keeps its error code and says that nothing entered the library (body files already
 * written are orphans the daily cleanup removes). The message names `what` failed, never "Internal error".
 */
function nothingImported<T>(what: string, work: () => T): T {
  try {
    return work();
  } catch (error: unknown) {
    const body = toErrorBody(error);
    const reason =
      body.code === ErrorCode.INTERNAL
        ? what
        : `${what}: ${body.message.replace(/\.$/, "")}`;
    throw new AppError(
      body.code,
      `Nothing was imported: ${reason}. Run the import again.`,
      body.details,
    );
  }
}

interface ImportRun {
  readonly targetId: string;
  readonly file: ImportFile;
  readonly prepared: readonly Prepared[];
  readonly make: MakeFolder;
  readonly bodies: ReadonlyMap<string, BodyRef>;
  readonly source: EventSource;
  readonly flattened: number;
}

/** Places again on the index read inside the lock and commits folders, templates and their audit events. */
function commitImport(context: HandlerContext, run: ImportRun): ImportReport {
  const { targetId, file, prepared, make, bodies, source, flattened } = run;
  return commit(context, (current) => {
    liveFolder(current, targetId);
    const placement = place(current, targetId, file, prepared, make);
    const items: Item[] = [];
    const lines = [...placement.lines];
    for (const { ready, folderId } of placement.placed) {
      recheckRecipients(context, current, ready.body.recipients);
      const body = bodies.get(ready.id);
      if (body === undefined)
        lines.push({
          kind: "template",
          name: ready.label,
          outcome: "skipped",
          reason: "The library changed during the import. Run it again.",
        });
      else items.push(importedItem(context, ready, folderId, body));
    }
    const doc = {
      ...current,
      folders: [...current.folders, ...placement.folders.created],
      items: [...current.items, ...items],
    };
    const events = [
      ...folderEvents(source, doc, placement.folders.created),
      ...items.map((item) =>
        templateEvent(source, doc, "import", null, item, bodies.get(item.id)),
      ),
    ];
    return {
      doc,
      events,
      result: report(false, { ...placement, lines }, items.length, flattened),
    };
  });
}
