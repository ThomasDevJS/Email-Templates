import type { PreparedBody } from "../../shared/body/prepare";
import { AppError } from "../../shared/errors/codes";
import type { Folder, IndexDoc, Item } from "../../shared/model/data";
import { tagList, templateTitle } from "../../shared/model/validate";
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
import { prepareFor, readStoredBody } from "./body";
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
 * Export and import (wireframe 06, spec 4.5, ADR-0002 Backup and export). Exports page through the templates,
 * EXPORT_PAGE per call, so one call reads at most EXPORT_PAGE bodies from Drive (cache first); the browser joins
 * the pages into one file. Import is admin only and runs Validate (`dryRun`) and Import on the same rules.
 */
export const EXPORT_PAGE = 20;

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

export interface ExportPage {
  readonly header: ExportHeader;
  readonly items: ExportItem[];
  readonly total: number;
  /** Offset of the next page, null after the last one. */
  readonly next: number | null;
}

/** One page of the export of the folders `scopeIds`. Grants of folders outside the scope never appear. */
function exportPage(
  context: HandlerContext,
  scopeIds: ReadonlySet<string>,
  scope: ExportScope,
): ExportPage {
  const { index } = context.access();
  const offset = optInt(context.args, "offset");
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
  const items = index.items.filter(
    (item) => item.deletedAt === "" && scopeIds.has(item.folderId),
  );
  const page = items.slice(offset, offset + EXPORT_PAGE).map((item) => ({
    meta: {
      id: item.id,
      folderId: item.folderId,
      title: item.title,
      subject: item.subject,
      tags: item.tags,
    },
    html: readStoredBody(context.services, item),
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

/** `export.folder` (manage on the folder): the folder and its subtree. */
export function exportFolder(context: HandlerContext): ExportPage {
  const { index } = context.access();
  const root = liveFolder(index, reqString(context.args, "folderId"));
  return exportPage(context, subtree(index, root.id), {
    kind: "folder",
    folderId: root.id,
    name: root.name,
  });
}

/** `export.library` (admin): every shared folder and its templates. */
export function exportLibrary(context: HandlerContext): ExportPage {
  return exportPage(context, libraryFolders(context.access().index), {
    kind: "library",
    folderId: "",
    name: "",
  });
}

interface Ready {
  readonly id: string;
  readonly label: string;
  readonly fileFolderId: string;
  readonly title: string;
  readonly tags: string[];
  readonly body: PreparedBody;
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
 * Item rules of a save (spec 5.3) and the spec 5.6 import rule for the subject: control characters become one
 * space, then `prepareBody` sanitizes the body and rejects SUBJ_TOO_LONG and PH_* problems.
 */
function prepareItems(context: HandlerContext, file: ImportFile): Prepared[] {
  return file.items.map((record): Prepared => {
    if (!record.ok)
      return { ok: false, label: record.label, reason: record.reason };
    const { meta, html } = record.value;
    try {
      return {
        ok: true,
        ready: {
          id: context.services.newId(),
          label: record.label,
          fileFolderId: meta.folderId,
          title: templateTitle(meta.title),
          tags: tagList(meta.tags),
          body: prepareFor(context.services.props, html, oneLine(meta.subject)),
        },
      };
    } catch (error: unknown) {
      return { ok: false, label: record.label, reason: reasonOf(error) };
    }
  });
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
    else placed.push({ ready: entry.ready, folderId });
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
      writeBody(context, ready.id, 1, ready.body),
    ]),
  );
  const source = eventSource(context, targetId);
  return commit(context, (current) => {
    liveFolder(current, targetId);
    const placement = place(current, targetId, file, prepared, make);
    const items: Item[] = [];
    const lines = [...placement.lines];
    for (const { ready, folderId } of placement.placed) {
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
