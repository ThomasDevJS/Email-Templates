import type { IndexDoc } from "../../shared/model/data";
import { ROOT } from "../../shared/permissions/matrix";
import { findFolder, findGrant, findItem } from "../handlers/indexOps";
import { optString, reqString } from "./args";

/**
 * Target folder resolvers for policy rows (ADR-0003 Part C). Each returns the folder IDs whose level the op needs;
 * `ROOT` stands for the top level, where only admins act. Unknown IDs are NOT_FOUND.
 */
export type TargetResolver = (args: unknown, index: IndexDoc) => string[];

const parentOrRoot = (parentId: string): string =>
  parentId === "" ? ROOT : parentId;

export const itemFolder: TargetResolver = (args, index) => [
  findItem(index, reqString(args, "id")).folderId,
];

export const folderArg: TargetResolver = (args, index) => [
  findFolder(index, reqString(args, "folderId")).id,
];

export const folderAndParent: TargetResolver = (args, index) => {
  const folder = findFolder(index, reqString(args, "folderId"));
  return [folder.id, parentOrRoot(folder.parentId)];
};

/** Folder, old parent and new parent. Moving to the top level needs admin. */
export const folderMove: TargetResolver = (args, index) => {
  const folder = findFolder(index, reqString(args, "folderId"));
  const parentId = optString(args, "parentId");
  const newParent = parentId === "" ? ROOT : findFolder(index, parentId).id;
  return [folder.id, parentOrRoot(folder.parentId), newParent];
};

export const parentArg: TargetResolver = (args, index) => {
  const parentId = optString(args, "parentId");
  return parentId === "" ? [ROOT] : [findFolder(index, parentId).id];
};

export const templateMove: TargetResolver = (args, index) => [
  ...itemFolder(args, index),
  findFolder(index, reqString(args, "folderId")).id,
];

/** Source item folder and the target folder (same folder when `folderId` is omitted). */
export const templateCopy: TargetResolver = (args, index) => {
  const [source = ROOT] = itemFolder(args, index);
  const target = optString(args, "folderId");
  return [source, target === "" ? source : findFolder(index, target).id];
};

export const grantFolder: TargetResolver = (args, index) => [
  findGrant(index, reqString(args, "grantId")).folderId,
];

/**
 * Restore from the trash: the original folder (ROOT, admin only, when it was purged) and the target folder, which
 * is the original one unless `folderId` names another.
 */
export const restoreTargets: TargetResolver = (args, index) => {
  const item = findItem(index, reqString(args, "id"));
  const known = index.folders.some((folder) => folder.id === item.folderId);
  const source = known ? item.folderId : ROOT;
  const target = optString(args, "folderId");
  return [source, target === "" ? source : findFolder(index, target).id];
};
