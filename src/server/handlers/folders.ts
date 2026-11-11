import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { Folder, IndexDoc } from "../../shared/model/data";
import {
  FOLDER_DEPTH_MAX,
  folderName,
  uniqueSiblingName,
} from "../../shared/model/validate";
import {
  inPrivateTree,
  levelResolver,
} from "../../shared/permissions/effective";
import { personalTemplatesOn } from "../../shared/model/settings";
import { atLeast, type AccessLevel } from "../../shared/permissions/levels";
import { auditEvent, type EventSource } from "../audit/events";
import { optString, reqString } from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { nowIso } from "../services";
import { commit } from "./commit";
import { checkBaseVersion, optBaseVersion } from "./versions";
import { chainOf, folderPath, liveFolder, replaceById } from "./indexOps";

export const PRIVATE_FOLDER_NAME = "My templates";

function validation(message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message);
}

function folderEvent(
  source: EventSource,
  index: IndexDoc,
  action: string,
  before: Folder | null,
  after: Folder,
) {
  return auditEvent(source, {
    action,
    targetType: "folder",
    targetId: after.id,
    targetPath: folderPath(index, after.id),
    before,
    after,
  });
}

export function newFolder(
  context: HandlerContext,
  fields: Pick<
    Folder,
    "parentId" | "name" | "kind" | "ownerEmail" | "sortOrder"
  >,
): Folder {
  const now = nowIso(context.services);
  const email = context.caller.email;
  return {
    id: context.services.newId(),
    ...fields,
    createdAt: now,
    createdBy: email,
    updatedAt: now,
    updatedBy: email,
    deletedAt: "",
    deletedBy: "",
    version: 1,
  };
}

/** True when the caller has a private folder, or none may be created (personal templates off, D29). */
function noPrivateFolderNeeded(index: IndexDoc, email: string): boolean {
  if (!personalTemplatesOn(index.settings)) return true;
  const owner = email.toLowerCase();
  return index.folders.some(
    (folder) =>
      folder.kind === "private" &&
      folder.deletedAt === "" &&
      folder.ownerEmail.toLowerCase() === owner,
  );
}

/**
 * D11: every caller gets one private top-level folder on first use, only while personal templates are on (D29).
 * Returns the index after the change.
 */
function ensurePrivateFolder(context: HandlerContext): IndexDoc {
  const { index } = context.access();
  const email = context.caller.email;
  if (noPrivateFolderNeeded(index, email)) return index;
  const source = eventSource(context);
  return commit(context, (current) => {
    if (noPrivateFolderNeeded(current, email))
      return { doc: current, events: [], result: current };
    const folder = newFolder(context, {
      parentId: "",
      name: PRIVATE_FOLDER_NAME,
      kind: "private",
      ownerEmail: email.toLowerCase(),
      sortOrder: 0,
    });
    const doc = { ...current, folders: [...current.folders, folder] };
    return {
      doc,
      events: [folderEvent(source, doc, "folder.create", null, folder)],
      result: doc,
    };
  });
}

export interface FolderView extends Folder {
  readonly level: AccessLevel;
}

/**
 * Display name: another user's private folder gets its owner, "My templates (name@domain)" (D18: only admins see
 * those folders, so no other user's address reaches a non-admin). The caller's own keeps its name.
 */
export function folderLabel(folder: Folder, callerEmail: string): string {
  const owner = folder.ownerEmail.toLowerCase();
  return folder.kind === "private" && owner !== callerEmail.toLowerCase()
    ? `${folder.name} (${owner})`
    : folder.name;
}

/** Live folders where the caller holds `use` or more, each with the caller's level and display name. */
export function folderList(context: HandlerContext): { folders: FolderView[] } {
  const index = ensurePrivateFolder(context);
  const access = context.access();
  const levelOf =
    index === access.index
      ? access.levelOf
      : levelResolver(access.subject, index);
  const folders = index.folders
    .filter((folder) => folder.deletedAt === "")
    .map((folder) => ({
      ...folder,
      name: folderLabel(folder, context.caller.email),
      level: levelOf(folder.id),
    }))
    .filter((folder) => atLeast(folder.level, "use"));
  return { folders };
}

/** Levels of the folder's subtree, itself included (a leaf is 1). */
function subtreeHeight(index: IndexDoc, folderId: string): number {
  const children = index.folders.filter(
    (folder) => folder.parentId === folderId && folder.deletedAt === "",
  );
  return 1 + Math.max(0, ...children.map((c) => subtreeHeight(index, c.id)));
}

/** Spec 5.1 depth rule: a subtree of `height` levels under `parentId` stays within FOLDER_DEPTH_MAX. */
function checkDepth(index: IndexDoc, parentId: string, height: number): void {
  const depth =
    (parentId === "" ? 0 : chainOf(index, parentId).length) + height;
  if (depth > FOLDER_DEPTH_MAX)
    throw validation(
      `Folders can be at most ${String(FOLDER_DEPTH_MAX)} levels deep`,
    );
}

function siblingCount(index: IndexDoc, parentId: string): number {
  return index.folders.filter(
    (folder) => folder.parentId === parentId && folder.deletedAt === "",
  ).length;
}

export function folderCreate(context: HandlerContext): Folder {
  const name = folderName(reqString(context.args, "name"));
  const parentId = optString(context.args, "parentId");
  const source = eventSource(context, parentId);
  return commit(context, (current) => {
    if (parentId !== "") liveFolder(current, parentId);
    checkDepth(current, parentId, 1);
    const folder = newFolder(context, {
      parentId,
      name,
      kind: "shared",
      ownerEmail: "",
      sortOrder: siblingCount(current, parentId),
    });
    uniqueSiblingName(current.folders, folder);
    const doc = { ...current, folders: [...current.folders, folder] };
    return {
      doc,
      events: [folderEvent(source, doc, "folder.create", null, folder)],
      result: folder,
    };
  });
}

function changeFolder(
  context: HandlerContext,
  action: string,
  change: (folder: Folder, current: IndexDoc) => Folder,
): Folder {
  const folderId = reqString(context.args, "folderId");
  const baseVersion = optBaseVersion(context.args);
  const source = eventSource(context, folderId);
  return commit(context, (current) => {
    const before = liveFolder(current, folderId);
    checkBaseVersion(before, baseVersion);
    const changed = change(before, current);
    const after: Folder = {
      ...changed,
      updatedAt: nowIso(context.services),
      updatedBy: context.caller.email,
      version: before.version + 1,
    };
    const doc = { ...current, folders: replaceById(current.folders, after) };
    return {
      doc,
      events: [folderEvent(source, doc, action, before, after)],
      result: after,
    };
  });
}

export function folderRename(context: HandlerContext): Folder {
  const name = folderName(reqString(context.args, "name"));
  return changeFolder(context, "folder.rename", (folder, current) => {
    // `folder.list` shows another user's private folder with " (owner)"; that label is never stored.
    const label = folderLabel(folder, context.caller.email).slice(
      folder.name.length,
    );
    const stored =
      label !== "" && name.toLowerCase().endsWith(label)
        ? name.slice(0, -label.length).trim()
        : name;
    const renamed = { ...folder, name: stored };
    uniqueSiblingName(current.folders, renamed);
    return renamed;
  });
}

function checkMoveTarget(
  current: IndexDoc,
  folder: Folder,
  parentId: string,
): void {
  if (inPrivateTree(chainOf(current, folder.id)))
    throw validation("Private folders and their subfolders cannot move");
  if (parentId === "") return;
  liveFolder(current, parentId);
  const targetChain = chainOf(current, parentId);
  if (targetChain.some((entry) => entry.id === folder.id))
    throw validation("A folder cannot move into itself or its subfolders");
  if (inPrivateTree(targetChain))
    throw validation("Shared folders cannot move into a private folder");
  checkDepth(current, parentId, subtreeHeight(current, folder.id));
}

export function folderMove(context: HandlerContext): Folder {
  const parentId = optString(context.args, "parentId");
  return changeFolder(context, "folder.move", (folder, current) => {
    checkMoveTarget(current, folder, parentId);
    const moved = {
      ...folder,
      parentId,
      sortOrder: siblingCount(current, parentId),
    };
    uniqueSiblingName(current.folders, moved);
    return moved;
  });
}

function checkEmpty(current: IndexDoc, folder: Folder): void {
  if (folder.kind === "private")
    throw validation("Private folders cannot be deleted");
  const busy =
    current.items.some(
      (item) => item.folderId === folder.id && item.deletedAt === "",
    ) ||
    current.folders.some(
      (child) => child.parentId === folder.id && child.deletedAt === "",
    );
  if (busy) throw validation("Only an empty folder can be deleted");
}

export function folderDelete(context: HandlerContext): Folder {
  return changeFolder(context, "folder.delete", (folder, current) => {
    checkEmpty(current, folder);
    return {
      ...folder,
      deletedAt: nowIso(context.services),
      deletedBy: context.caller.email,
    };
  });
}
