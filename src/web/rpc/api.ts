import type { Folder, Item } from "../../shared/model/data";
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
  readonly html: string;
  readonly savedAt: string;
  readonly savedBy: string;
  readonly restoredFrom: number;
}

export interface SaveArgs {
  readonly title: string;
  readonly folderId: string;
  readonly tags: readonly string[];
  readonly html: string;
}

export interface Api {
  profile(): Promise<Profile>;
  folders(): Promise<{ folders: FolderRow[] }>;
  templates(): Promise<{ items: ItemRow[] }>;
  template(id: string): Promise<{ item: Item; html: string }>;
  create(args: SaveArgs): Promise<Item>;
  update(id: string, baseVersion: number, args: SaveArgs): Promise<Item>;
  versions(id: string): Promise<VersionList>;
  version(id: string, version: number): Promise<VersionBody>;
  restore(id: string, version: number, baseVersion: number): Promise<Item>;
  duplicate(id: string): Promise<Item>;
  move(id: string, folderId: string, baseVersion: number): Promise<Item>;
  remove(id: string, baseVersion: number): Promise<Item>;
}

/** The casts trust the server's documented response shapes; the envelope itself is checked in client.ts. */
export function createApi(client: RpcClient): Api {
  const call = <T>(op: string, args: unknown = {}) =>
    client.call(op, args) as Promise<T>;
  return {
    profile: () => call("profile.me"),
    folders: () => call("folder.list"),
    templates: () => call("template.list"),
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
  };
}
