import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { Folder, Grant, IndexDoc, Item } from "../../shared/model/data";
import { ancestry, folderMap } from "../../shared/permissions/effective";

/** Lookups and replacements on the index document. Lookups include soft-deleted records. */
function notFound(what: string): AppError {
  return new AppError(ErrorCode.NOT_FOUND, `${what} was removed or moved.`);
}

export function findItem(index: IndexDoc, id: string): Item {
  const item = index.items.find((candidate) => candidate.id === id);
  if (item === undefined) throw notFound("This template");
  return item;
}

export function findFolder(index: IndexDoc, id: string): Folder {
  const folder = index.folders.find((candidate) => candidate.id === id);
  if (folder === undefined) throw notFound("This folder");
  return folder;
}

export function findGrant(index: IndexDoc, id: string): Grant {
  const grant = index.grants.find((candidate) => candidate.id === id);
  if (grant === undefined) throw notFound("This grant");
  return grant;
}

export function liveFolder(index: IndexDoc, id: string): Folder {
  const folder = findFolder(index, id);
  if (folder.deletedAt !== "") throw notFound("This folder");
  return folder;
}

export function liveItem(index: IndexDoc, id: string): Item {
  const item = findItem(index, id);
  if (item.deletedAt !== "") throw notFound("This template");
  return item;
}

export function replaceById<T extends { readonly id: string }>(
  list: readonly T[],
  next: T,
): T[] {
  return list.map((entry) => (entry.id === next.id ? next : entry));
}

/** `/Sales/Quotes` style path for audit events. */
export function folderPath(index: IndexDoc, folderId: string): string {
  const names = ancestry(folderId, folderMap(index.folders))
    .map((folder) => folder.name)
    .reverse();
  return `/${names.join("/")}`;
}

export function chainOf(index: IndexDoc, folderId: string): Folder[] {
  return ancestry(folderId, folderMap(index.folders));
}
