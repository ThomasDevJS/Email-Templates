import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { BodyFile, IndexDoc, Item } from "../../shared/model/data";
import { tagList, templateTitle } from "../../shared/model/validate";
import { atLeast, type AccessLevel } from "../../shared/permissions/levels";
import type { PreparedBody } from "../../shared/body/prepare";
import { auditEvent, type EventSource } from "../audit/events";
import {
  optBool,
  optString,
  optStringArray,
  reqInt,
  reqString,
} from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { nowIso } from "../services";
import { prepareFor, readableBody } from "./body";
import { commit } from "./commit";
import {
  findItem,
  folderPath,
  liveFolder,
  liveItem,
  replaceById,
} from "./indexOps";
import { checkBaseVersion, optBaseVersion } from "./versions";

export interface ItemView extends Item {
  readonly level: AccessLevel;
}

/** Body reference stored in audit events in place of the HTML (ADR-0003 Part D). */
export interface BodyRef {
  readonly version: number;
  readonly fileId: string;
  readonly sha256: string;
}

export function templateEvent(
  source: EventSource,
  index: IndexDoc,
  action: string,
  before: Item | null,
  after: Item,
  body?: BodyRef,
) {
  return auditEvent(source, {
    action,
    targetType: "template",
    targetId: after.id,
    targetPath: folderPath(index, after.folderId),
    before,
    after: body === undefined ? after : { ...after, body },
  });
}

/** Live templates in folders where the caller holds `use`; with `trash: true`, deleted ones where the caller holds `edit`. */
export function templateList(context: HandlerContext): {
  items: ItemView[];
  rev: number;
} {
  const trash = optBool(context.args, "trash");
  const folderId = optString(context.args, "folderId");
  const { index, levelOf } = context.access();
  const live = new Set(
    index.folders.filter((f) => f.deletedAt === "").map((f) => f.id),
  );
  const need: AccessLevel = trash ? "edit" : "use";
  const items = index.items
    .filter((item) => (item.deletedAt !== "") === trash)
    .filter((item) => live.has(item.folderId))
    .filter((item) => folderId === "" || item.folderId === folderId)
    .map((item) => ({ ...item, level: levelOf(item.folderId) }))
    .filter((item) => atLeast(item.level, need));
  return { items, rev: index.rev };
}

export function templateGet(context: HandlerContext): {
  item: Item;
  html: string;
} {
  const item = liveItem(context.access().index, reqString(context.args, "id"));
  const body = context.services.store().readBody(item.bodyFileId);
  return { item, html: body.html };
}

/**
 * Current body for apply and preview (level use): sanitized HTML, placeholder names and prompt labels. The stored
 * body is already sanitized; sanitizing again on read costs one parse and covers bodies stored before slice 3.
 */
export function templateGetBody(context: HandlerContext): {
  id: string;
  version: number;
  html: string;
  placeholders: string[];
  prompts: string[];
} {
  const item = liveItem(context.access().index, reqString(context.args, "id"));
  const stored = context.services.store().readBody(item.bodyFileId);
  return {
    id: item.id,
    version: item.currentVersion,
    ...readableBody(context.services.props, stored.html),
  };
}

interface Draft {
  readonly title: string;
  readonly tags: string[];
  readonly body: PreparedBody;
}

/** Save step 1 (ADR-0004): title and tags, then sanitize and placeholder validation, all before the lock. */
function readDraft(context: HandlerContext): Draft {
  const title = templateTitle(reqString(context.args, "title"));
  const tags = tagList(optStringArray(context.args, "tags"));
  const body = prepareFor(
    context.services.props,
    optString(context.args, "html"),
  );
  return { title, tags, body };
}

/** Save step 2: the immutable version file, written outside the lock. `restoredFrom` is 0 for a plain save. */
export function writeBody(
  context: HandlerContext,
  itemId: string,
  version: number,
  prepared: PreparedBody,
  restoredFrom = 0,
): BodyRef {
  const sha256 = context.services.sha256(prepared.html);
  const body: BodyFile = {
    itemId,
    version,
    html: prepared.html,
    plainText: prepared.plainText,
    savedAt: nowIso(context.services),
    savedBy: context.caller.email,
    note: "",
    restoredFrom,
    sha256,
  };
  return { version, fileId: context.services.store().createBody(body), sha256 };
}

/** Item fields that follow the body version (spec 5.3). */
export function bodyFields(prepared: PreparedBody, body: BodyRef) {
  return {
    currentVersion: body.version,
    version: body.version,
    bodyFileId: body.fileId,
    snippet: prepared.snippet,
    placeholders: prepared.placeholders,
    prompts: prepared.prompts,
    sizeBytes: prepared.sizeBytes,
  };
}

export function templateCreate(context: HandlerContext): Item {
  const folderId = reqString(context.args, "folderId");
  const draft = readDraft(context);
  liveFolder(context.access().index, folderId);
  const id = context.services.newId();
  const body = writeBody(context, id, 1, draft.body);
  const source = eventSource(context, folderId);
  const now = nowIso(context.services);
  const email = context.caller.email;
  return commit(context, (current) => {
    liveFolder(current, folderId);
    const item: Item = {
      id,
      kind: "template",
      folderId,
      subject: "",
      status: "published",
      title: draft.title,
      tags: draft.tags,
      createdAt: now,
      createdBy: email,
      updatedAt: now,
      updatedBy: email,
      deletedAt: "",
      deletedBy: "",
      ...bodyFields(draft.body, body),
    };
    const doc = { ...current, items: [...current.items, item] };
    return {
      doc,
      events: [templateEvent(source, doc, "template.create", null, item, body)],
      result: item,
    };
  });
}

/** Save sequence (ADR-0002 Concurrency): body file outside the lock, then the index commit with a version check. */
export function templateUpdate(context: HandlerContext): Item {
  const id = reqString(context.args, "id");
  const baseVersion = reqInt(context.args, "baseVersion");
  const draft = readDraft(context);
  const known = liveItem(context.access().index, id);
  checkBaseVersion(known, baseVersion);
  const moveTo = optString(context.args, "folderId");
  const body = writeBody(context, id, baseVersion + 1, draft.body);
  const source = eventSource(context, moveTo || known.folderId);
  return commit(context, (current) => {
    const before = liveItem(current, id);
    checkBaseVersion(before, baseVersion);
    const folderId = moveTo || before.folderId;
    liveFolder(current, folderId);
    const after: Item = {
      ...before,
      ...bodyFields(draft.body, body),
      title: draft.title,
      tags: draft.tags,
      folderId,
      updatedAt: nowIso(context.services),
      updatedBy: context.caller.email,
    };
    const doc = { ...current, items: replaceById(current.items, after) };
    return {
      doc,
      events: [
        templateEvent(source, doc, "template.update", before, after, body),
      ],
      result: after,
    };
  });
}

/** Metadata-only change of one template under the lock, with an optional `baseVersion` check. */
function changeItem(
  context: HandlerContext,
  action: string,
  change: (item: Item, current: IndexDoc) => Item,
): Item {
  const id = reqString(context.args, "id");
  const baseVersion = optBaseVersion(context.args);
  const source = eventSource(
    context,
    findItem(context.access().index, id).folderId,
  );
  return commit(context, (current) => {
    const before = findItem(current, id);
    checkBaseVersion(before, baseVersion);
    const after: Item = {
      ...change(before, current),
      updatedAt: nowIso(context.services),
      updatedBy: context.caller.email,
    };
    const doc = { ...current, items: replaceById(current.items, after) };
    return {
      doc,
      events: [templateEvent(source, doc, action, before, after)],
      result: after,
    };
  });
}

function requireLive(item: Item): void {
  if (item.deletedAt !== "")
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "This template was removed or moved.",
    );
}

export function templateMove(context: HandlerContext): Item {
  const folderId = reqString(context.args, "folderId");
  return changeItem(context, "template.move", (item, current) => {
    requireLive(item);
    liveFolder(current, folderId);
    return { ...item, folderId };
  });
}

export function templateDelete(context: HandlerContext): Item {
  return changeItem(context, "template.delete", (item) => {
    requireLive(item);
    return {
      ...item,
      deletedAt: nowIso(context.services),
      deletedBy: context.caller.email,
    };
  });
}

export function templateRestoreFromTrash(context: HandlerContext): Item {
  return changeItem(context, "template.restoreFromTrash", (item, current) => {
    if (item.deletedAt === "")
      throw new AppError(
        ErrorCode.VALIDATION,
        "This template is not in the trash",
      );
    liveFolder(current, item.folderId);
    return { ...item, deletedAt: "", deletedBy: "" };
  });
}
