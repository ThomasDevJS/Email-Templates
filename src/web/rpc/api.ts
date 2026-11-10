import type {
  Folder,
  Item,
  Level,
  PrincipalType,
} from "../../shared/model/data";
import type { AccessLevel } from "../../shared/permissions/levels";
import type { RpcClient } from "./client";

/** Typed server ops the web app uses (spec section 6). Shapes match the slice 2 and 3 handlers. */
export interface FolderRow extends Folder {
  readonly level: AccessLevel;
}

export interface ItemRow extends Item {
  readonly level: AccessLevel;
}

export interface Profile {
  readonly email: string;
  readonly name: string;
  readonly givenName: string;
  readonly title: string;
  readonly department: string;
  readonly phone: string;
}

export interface VersionEntry {
  readonly version: number;
  readonly savedBy: string;
  readonly savedAt: string;
  readonly restoredFrom: number;
  readonly current: boolean;
}

export interface VersionList {
  readonly id: string;
  readonly title: string;
  readonly currentVersion: number;
  readonly versions: readonly VersionEntry[];
}

export interface VersionBody {
  readonly version: number;
  readonly subject: string;
  readonly html: string;
  readonly savedAt: string;
  readonly savedBy: string;
  readonly restoredFrom: number;
}

export interface SaveArgs {
  readonly title: string;
  readonly subject: string;
  readonly folderId: string;
  readonly tags: readonly string[];
  readonly html: string;
}

/**
 * `grant.list` row: `inherited` grants sit on an ancestor, `sourcePath` names it as far as the caller sees it ("" when
 * hidden). `active` is false for OU (D17).
 */
export interface GrantRow {
  readonly id: string;
  readonly folderId: string;
  readonly principalType: PrincipalType;
  readonly principalKey: string;
  readonly level: Level;
  readonly active: boolean;
  readonly inherited: boolean;
  readonly sourcePath: string;
}

export interface TrashRow extends ItemRow {
  readonly folderLive: boolean;
  readonly folderPath: string;
}

export interface GroupRow {
  readonly group: string;
  readonly members: number;
  readonly childGroups: readonly string[];
  readonly status: "ok" | "error";
}

export interface Memberships {
  readonly resolver: string;
  readonly nested: boolean;
  readonly refreshedAt: string;
  readonly groups: readonly GroupRow[];
  readonly warnings: readonly string[];
}

export interface NewGrant {
  readonly folderId: string;
  readonly principalType: PrincipalType;
  readonly principalKey: string;
  readonly level: Level;
}

export interface Api {
  profile(): Promise<Profile>;
  folders(): Promise<{ folders: FolderRow[] }>;
  /** The library with the caller's Favorites (newest first) and Recent (last used first). */
  templates(): Promise<{
    items: ItemRow[];
    favorites: string[];
    recent: string[];
  }>;
  setFavorite(id: string, favorite: boolean): Promise<unknown>;
  /** IDs whose body text matches; `skipped` templates were not searched in this call. */
  searchBody(query: string): Promise<{ ids: string[]; skipped: number }>;
  template(id: string): Promise<{ item: Item; html: string }>;
  create(args: SaveArgs): Promise<Item>;
  update(id: string, baseVersion: number, args: SaveArgs): Promise<Item>;
  versions(id: string): Promise<VersionList>;
  version(id: string, version: number): Promise<VersionBody>;
  restore(id: string, version: number, baseVersion: number): Promise<Item>;
  duplicate(id: string): Promise<Item>;
  move(id: string, folderId: string, baseVersion: number): Promise<Item>;
  remove(id: string, baseVersion: number): Promise<Item>;
  /** Trashed templates the caller may edit; `canPurge` when the caller is an admin. */
  trash(): Promise<{ items: TrashRow[]; canPurge: boolean }>;
  restoreFromTrash(id: string, folderId: string): Promise<Item>;
  purgeTrash(): Promise<{ purged: number }>;
  /** Admin view entry: DENIED for callers who manage no folder. */
  adminFolders(): Promise<{ isAdmin: boolean; folders: FolderRow[] }>;
  createFolder(parentId: string, name: string): Promise<Folder>;
  renameFolder(folder: Folder, name: string): Promise<Folder>;
  moveFolder(folder: Folder, parentId: string): Promise<Folder>;
  deleteFolder(folder: Folder): Promise<Folder>;
  grants(folderId: string): Promise<{ grants: GrantRow[] }>;
  addGrant(grant: NewGrant): Promise<unknown>;
  removeGrant(grantId: string): Promise<unknown>;
  memberships(): Promise<Memberships>;
  refreshMemberships(): Promise<Memberships>;
}

/** The casts trust the server's documented response shapes; the envelope itself is checked in client.ts. */
export function createApi(client: RpcClient): Api {
  const call = <T>(op: string, args: unknown = {}) =>
    client.call(op, args) as Promise<T>;
  return {
    profile: () => call("profile.me"),
    folders: () => call("folder.list"),
    templates: () => call("template.list"),
    setFavorite: (id, favorite) =>
      call(favorite ? "favorite.set" : "favorite.unset", { id }),
    searchBody: (query) => call("search.body", { query }),
    template: (id) => call("template.get", { id }),
    create: (args) => call("template.create", args),
    update: (id, baseVersion, args) =>
      call("template.update", { ...args, id, baseVersion }),
    versions: (id) => call("version.list", { id }),
    version: (id, version) => call("version.get", { id, version }),
    restore: (id, version, baseVersion) =>
      call("version.restore", { id, version, baseVersion }),
    duplicate: (id) => call("template.duplicate", { id }),
    move: (id, folderId, baseVersion) =>
      call("template.move", { id, folderId, baseVersion }),
    remove: (id, baseVersion) => call("template.delete", { id, baseVersion }),
    trash: () => call("template.list", { trash: true }),
    restoreFromTrash: (id, folderId) =>
      call("template.restoreFromTrash", { id, folderId }),
    purgeTrash: () => call("trash.purge"),
    adminFolders: () => call("admin.folders"),
    createFolder: (parentId, name) => call("folder.create", { parentId, name }),
    renameFolder: (folder, name) =>
      call("folder.rename", {
        folderId: folder.id,
        name,
        baseVersion: folder.version,
      }),
    moveFolder: (folder, parentId) =>
      call("folder.move", {
        folderId: folder.id,
        parentId,
        baseVersion: folder.version,
      }),
    deleteFolder: (folder) =>
      call("folder.delete", {
        folderId: folder.id,
        baseVersion: folder.version,
      }),
    grants: (folderId) => call("grant.list", { folderId }),
    addGrant: (grant) => call("grant.add", grant),
    removeGrant: (grantId) => call("grant.remove", { grantId }),
    memberships: () => call("membership.status"),
    refreshMemberships: () => call("membership.refresh"),
  };
}
