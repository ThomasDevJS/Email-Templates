import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { Item } from "../../shared/model/data";
import {
  recipientsOf,
  unreadableRecipients,
  type RecipientField,
  type Recipients,
} from "../../shared/model/recipients";
import { reqInt, reqString } from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { nowIso } from "../services";
import type { BodyRef as StoredBody } from "../storage/port";
import { prepareFor, readableBody } from "./body";
import { commit } from "./commit";
import { liveItem, replaceById } from "./indexOps";
import { bodyFields, templateEvent, writeBody } from "./templates";
import { checkBaseVersion } from "./versions";

/** Version history (spec 4.2, wireframe 05): list, read and restore body versions. Level edit (policy table). */

export interface VersionEntry {
  readonly version: number;
  readonly savedBy: string;
  readonly savedAt: string;
  readonly restoredFrom: number;
  readonly current: boolean;
}

/**
 * Body files of the item's committed versions, newest first. A crash between the body write and the index commit
 * can leave an extra file for a version; the file the item points at wins, else the newest file.
 */
function committedVersions(context: HandlerContext, item: Item): StoredBody[] {
  const chosen = new Map<number, StoredBody>();
  for (const ref of context.services.store().listBodies(item.id)) {
    if (ref.version < 1 || ref.version > item.currentVersion) continue;
    const previous = chosen.get(ref.version);
    const better =
      previous === undefined ||
      ref.fileId === item.bodyFileId ||
      (previous.fileId !== item.bodyFileId &&
        ref.createdTime > previous.createdTime);
    if (better) chosen.set(ref.version, ref);
  }
  return [...chosen.values()].sort((a, b) => b.version - a.version);
}

function findVersion(
  context: HandlerContext,
  item: Item,
  version: number,
): StoredBody {
  const ref = committedVersions(context, item).find(
    (candidate) => candidate.version === version,
  );
  if (ref === undefined)
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Version ${String(version)} of this template was not found.`,
    );
  return ref;
}

export function versionList(context: HandlerContext): {
  id: string;
  title: string;
  currentVersion: number;
  versions: VersionEntry[];
} {
  const item = liveItem(context.access().index, reqString(context.args, "id"));
  const versions = committedVersions(context, item).map((ref) => ({
    version: ref.version,
    savedBy: ref.savedBy,
    savedAt: ref.createdTime,
    restoredFrom: ref.restoredFrom,
    current: ref.version === item.currentVersion,
  }));
  return {
    id: item.id,
    title: item.title,
    currentVersion: item.currentVersion,
    versions,
  };
}

export function versionGet(context: HandlerContext): {
  version: number;
  subject: string;

  html: string;
  savedAt: string;
  savedBy: string;
  restoredFrom: number;
  prompts: string[];
} & Recipients {
  const item = liveItem(context.access().index, reqString(context.args, "id"));
  const ref = findVersion(context, item, reqInt(context.args, "version"));
  const body = context.services.store().readBody(ref.fileId);
  const readable = readableBody(
    context.services.props,
    body.html,
    body.subject,
  );
  return {
    version: body.version,
    subject: body.subject,
    // The recipients of this version, `[]` in files written before slice 9.
    ...recipientsOf(body),
    html: readable.html,
    savedAt: body.savedAt,
    savedBy: body.savedBy,
    restoredFrom: body.restoredFrom,
    prompts: readable.prompts,
  };
}

/**
 * Restore creates version N+1 from subject, recipients and body of version K (linear history) through the save write
 * path, so K's recipients are validated again (`deny` refuses outside addresses), plus an audit row. A list of K
 * that fails the shape rule restores as empty and is named in `recipientsUnreadable`.
 */
export function versionRestore(
  context: HandlerContext,
): Item & { recipientsUnreadable: RecipientField[] } {
  const id = reqString(context.args, "id");
  const from = reqInt(context.args, "version");
  const baseVersion = reqInt(context.args, "baseVersion");
  const known = liveItem(context.access().index, id);
  checkBaseVersion(known, baseVersion);
  const old = context.services
    .store()
    .readBody(findVersion(context, known, from).fileId);
  const prepared = prepareFor(
    context,
    old.html,
    old.subject,
    recipientsOf(old),
  );
  const body = writeBody(context, id, baseVersion + 1, prepared, from);
  const source = eventSource(context, known.folderId);
  return commit(context, (current) => {
    const before = liveItem(current, id);
    checkBaseVersion(before, baseVersion);
    const after: Item = {
      ...before,
      ...bodyFields(prepared, body),
      updatedAt: nowIso(context.services),
      updatedBy: context.caller.email,
    };
    const doc = { ...current, items: replaceById(current.items, after) };
    return {
      doc,
      events: [
        templateEvent(source, doc, "version.restore", before, after, body),
      ],
      result: { ...after, recipientsUnreadable: unreadableRecipients(old) },
    };
  });
}
