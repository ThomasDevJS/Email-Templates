import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { BodyFile, IndexDoc, Item } from "../../shared/model/data";
import {
  NO_RECIPIENTS,
  recipientsOf,
  splitBlocked,
  type AppliedRecipients,
  type RecipientField,
  type Recipients,
} from "../../shared/model/recipients";
import { TITLE_MAX, tagList, templateTitle } from "../../shared/model/validate";
import { atLeast, type AccessLevel } from "../../shared/permissions/levels";
import type { PreparedBody } from "../../shared/body/prepare";
import { auditEvent, type EventSource } from "../audit/events";
import {
  keptStringArray,
  optBool,
  optString,
  optStringArray,
  reqInt,
  reqString,
} from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { nowIso } from "../services";
import { parseQuery, rank } from "../../shared/search/match";
import {
  bodyTexts,
  cacheBody,
  cacheText,
  prepareFor,
  readStoredBody,
  readableBody,
  recheckRecipients,
  recipientPolicy,
} from "./body";
import { callerLists, callerRecent, type CallerLists } from "./favorites";
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

/** Live templates in live folders where the caller holds `use`. */
function listed(context: HandlerContext, folderId: string): ItemView[] {
  const { index, levelOf } = context.access();
  const live = new Set(
    index.folders.filter((f) => f.deletedAt === "").map((f) => f.id),
  );
  return (
    index.items
      .filter((item) => item.deletedAt === "")
      .filter((item) => live.has(item.folderId))
      .filter((item) => folderId === "" || item.folderId === folderId)
      // Lists absent on items before slice 9 read as [] (spec 5.7); the library search matches them.
      .map((item) => ({
        ...item,
        ...recipientsOf(item),
        level: levelOf(item.folderId),
      }))
      .filter((item) => atLeast(item.level, "use"))
  );
}

export interface TrashView extends ItemView {
  /** False when the original folder was deleted or purged: Restore then needs a target folder. */
  readonly folderLive: boolean;
  readonly folderPath: string;
}

/**
 * Soft-deleted templates the caller may edit (wireframe 07 H). Levels resolve through deleted folders too, so a
 * template in a deleted folder stays restorable. Admins also see templates whose folder was purged.
 */
function trashed(context: HandlerContext, folderId: string): TrashView[] {
  const { index, levelOf, subject } = context.access();
  const live = new Set(
    index.folders.filter((f) => f.deletedAt === "").map((f) => f.id),
  );
  return index.items
    .filter((item) => item.deletedAt !== "")
    .filter((item) => folderId === "" || item.folderId === folderId)
    .map((item) => ({
      ...item,
      level: levelOf(item.folderId),
      folderLive: live.has(item.folderId),
      folderPath: folderPath(index, item.folderId),
    }))
    .filter((item) => subject.isAdmin || atLeast(item.level, "edit"));
}

/**
 * The library list (`trash: true` for the trash) with the caller's Favorites and Recent among the listed items
 * (web app star, filter and "last used" sort, spec 4.4). `canPurge`: the caller is an admin (Trash "Empty now").
 */
export function templateList(context: HandlerContext): {
  items: ItemView[];
  rev: number;
  canPurge: boolean;
} & CallerLists {
  const folderId = optString(context.args, "folderId");
  const items = optBool(context.args, "trash")
    ? trashed(context, folderId)
    : listed(context, folderId);
  const lists = callerLists(
    context.services,
    context.caller.email,
    new Set(items.map((item) => item.id)),
  );
  const { index, subject } = context.access();
  return { items, rev: index.rev, canPurge: subject.isAdmin, ...lists };
}

/**
 * Body text matches for the web app (spec 4.4): IDs of live templates the caller can use whose body text matches
 * every query term, best first. `skipped` counts templates whose text was neither cached nor read in this call.
 */
export function searchBody(context: HandlerContext): {
  ids: string[];
  skipped: number;
} {
  const query = parseQuery(optString(context.args, "query"));
  if (query.terms.length === 0) return { ids: [], skipped: 0 };
  const items = listed(context, "");
  const { texts, skipped } = bodyTexts(context.services, items);
  const recent = callerRecent(
    context.services,
    context.caller.email,
    new Set(items.map((item) => item.id)),
  );
  const found = rank(
    items.filter((item) => texts.has(item.bodyFileId)),
    { ...query, folders: [], tags: [] },
    (item) => ({
      title: "",
      subject: "",
      tags: [],
      folder: "",
      body: texts.get(item.bodyFileId) ?? "",
    }),
    recent,
  );
  return { ids: found.map((item) => item.id), skipped };
}

/**
 * Item (with its subject and recipients, `[]` when stored before slice 9) and body for the editor. The body is
 * sanitized again on read, like `template.getBody`.
 */
export function templateGet(context: HandlerContext): {
  item: Item;
  html: string;
} {
  const item = liveItem(context.access().index, reqString(context.args, "id"));
  return {
    item: { ...item, ...recipientsOf(item) },
    html: readableBody(
      context.services.props,
      readStoredBody(context.services, item),
      item.subject,
    ).html,
  };
}

/** Recipients as apply and preview see them (spec 5.7): with `deny`, outside addresses move to `blocked`. */
export function appliedRecipients(
  context: HandlerContext,
  item: Item,
): AppliedRecipients {
  return splitBlocked(recipientsOf(item), recipientPolicy(context));
}

/**
 * Current body and subject for apply and preview (level use): sanitized HTML, the subject, placeholder names and
 * prompt labels over both, and the recipients under the current switch. The stored body is already sanitized;
 * sanitizing again on read costs one parse and covers bodies stored before slice 3.
 */
export function templateGetBody(context: HandlerContext): {
  id: string;
  version: number;
  subject: string;
  html: string;
  placeholders: string[];
  prompts: string[];
} & AppliedRecipients {
  const item = liveItem(context.access().index, reqString(context.args, "id"));
  return {
    id: item.id,
    version: item.currentVersion,
    subject: item.subject,
    ...appliedRecipients(context, item),
    ...readableBody(
      context.services.props,
      readStoredBody(context.services, item),
      item.subject,
    ),
  };
}

interface Draft {
  readonly title: string;
  readonly tags: string[];
  readonly body: PreparedBody;
}

/** `to`, `cc`, `bcc` args; a field left out keeps `stored` (the editor before slice 8b sends none). */
function recipientArgs(
  context: HandlerContext,
  stored: Recipients,
): Recipients {
  const read = (field: RecipientField) =>
    keptStringArray(context.args, field) ?? stored[field];
  return { to: read("to"), cc: read("cc"), bcc: read("bcc") };
}

/**
 * Save step 1 (ADR-0004): title and tags, then sanitize, placeholder, subject and recipient validation, all before
 * the lock. `stored`: the recipients an update keeps for fields it leaves out.
 */
function readDraft(context: HandlerContext, stored = NO_RECIPIENTS): Draft {
  const title = templateTitle(reqString(context.args, "title"));
  const tags = tagList(optStringArray(context.args, "tags"));
  const body = prepareFor(
    context,
    optString(context.args, "html"),
    optString(context.args, "subject"),
    recipientArgs(context, stored),
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
    subject: prepared.subject,
    ...prepared.recipients,
    html: prepared.html,
    plainText: prepared.plainText,
    savedAt: nowIso(context.services),
    savedBy: context.caller.email,
    note: "",
    restoredFrom,
    sha256,
  };
  const fileId = context.services.store().createBody(body);
  cacheBody(context.services, fileId, prepared.html);
  cacheText(context.services, fileId, prepared.plainText);
  return { version, fileId, sha256 };
}

/** Item fields that follow the body version (spec 5.3), the subject and recipients included. */
export function bodyFields(prepared: PreparedBody, body: BodyRef) {
  return {
    currentVersion: body.version,
    version: body.version,
    bodyFileId: body.fileId,
    subject: prepared.subject,
    ...prepared.recipients,
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
  return addTemplate(context, folderId, draft, "template.create");
}

/** "Copy of <title>", cut to the title limit. */
export function copyTitle(title: string): string {
  return `Copy of ${title}`.slice(0, TITLE_MAX).trim();
}

/**
 * Copy of a live template as version 1 of a new template, in the same folder or in `folderId`. Dispatch checked
 * edit on the source and the target folder (`templateCopy`). The body is prepared again, like a save.
 */
export function templateDuplicate(context: HandlerContext): Item {
  const { index } = context.access();
  const source = liveItem(index, reqString(context.args, "id"));
  const folderId = optString(context.args, "folderId") || source.folderId;
  liveFolder(index, folderId);
  const stored = readStoredBody(context.services, source);
  const draft: Draft = {
    title: copyTitle(source.title),
    tags: [...source.tags],
    body: prepareFor(context, stored, source.subject, recipientsOf(source)),
  };
  return addTemplate(context, folderId, draft, "template.duplicate");
}

/** Body file of version 1 outside the lock, then the index commit with the new item and its audit event. */
function addTemplate(
  context: HandlerContext,
  folderId: string,
  draft: Draft,
  action: string,
): Item {
  const id = context.services.newId();
  const body = writeBody(context, id, 1, draft.body);
  const source = eventSource(context, folderId);
  const now = nowIso(context.services);
  const email = context.caller.email;
  return commit(context, (current) => {
    liveFolder(current, folderId);
    recheckRecipients(context, current, draft.body.recipients);
    const item: Item = {
      id,
      kind: "template",
      folderId,
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
      events: [templateEvent(source, doc, action, null, item, body)],
      result: item,
    };
  });
}

/** Save sequence (ADR-0002 Concurrency): body file outside the lock, then the index commit with a version check. */
export function templateUpdate(context: HandlerContext): Item {
  const id = reqString(context.args, "id");
  const baseVersion = reqInt(context.args, "baseVersion");
  const known = liveItem(context.access().index, id);
  checkBaseVersion(known, baseVersion);
  const draft = readDraft(context, recipientsOf(known));
  const moveTo = optString(context.args, "folderId");
  const body = writeBody(context, id, baseVersion + 1, draft.body);
  const source = eventSource(context, moveTo || known.folderId);
  return commit(context, (current) => {
    const before = liveItem(current, id);
    checkBaseVersion(before, baseVersion);
    const folderId = moveTo || before.folderId;
    liveFolder(current, folderId);
    recheckRecipients(context, current, draft.body.recipients);
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

/**
 * Back from the trash into its folder, or into `folderId` when the original folder is gone or the caller lacks
 * edit there. Dispatch checked edit on the original folder and the target (`restoreTargets`).
 */
export function templateRestoreFromTrash(context: HandlerContext): Item {
  const target = optString(context.args, "folderId");
  return changeItem(context, "template.restoreFromTrash", (item, current) => {
    if (item.deletedAt === "")
      throw new AppError(
        ErrorCode.VALIDATION,
        "This template is not in the trash",
      );
    const folderId = target || item.folderId;
    liveFolder(current, folderId);
    return { ...item, folderId, deletedAt: "", deletedBy: "" };
  });
}
