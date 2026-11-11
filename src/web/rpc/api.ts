import type {
  AuditEvent,
  Folder,
  Item,
  Level,
  PrincipalType,
} from "../../shared/model/data";
import type {
  ExternalRule,
  RecipientField,
  Recipients,
} from "../../shared/model/recipients";
import type {
  SettingEntry,
  SettingName,
  SettingValue,
  Settings,
} from "../../shared/model/settings";
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

/** `me`: the caller and the outside-recipients rule the editor checks addresses against (spec 5.7). */
export interface Me {
  readonly email: string;
  readonly isAdmin: boolean;
  readonly recipientsExternal: ExternalRule;
}

export interface VersionBody extends Recipients {
  readonly version: number;
  readonly subject: string;
  readonly html: string;
  readonly savedAt: string;
  readonly savedBy: string;
  readonly restoredFrom: number;
}

/** `to`, `cc`, `bcc` are always sent: an empty list clears a field (spec 4.2). */
export interface SaveArgs extends Recipients {
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

export interface AuditFilter {
  readonly month: string;
  /** ISO instants, "" for open. */
  readonly from: string;
  readonly to: string;
  readonly actor: string;
  readonly action: string;
  readonly result: string;
  readonly target: string;
  readonly page: number;
}

export type AuditRow = Omit<AuditEvent, "before" | "after"> & {
  readonly exportTemplates?: number;
};

export interface AuditPage {
  readonly month: string;
  readonly months: readonly string[];
  readonly actions: readonly string[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly rows: readonly AuditRow[];
}

export interface UsageRow {
  readonly id: string;
  readonly title: string;
  readonly folderPath: string;
  readonly applies30d: number;
  readonly lastUsedAt: string;
}

/** One page of an export; the browser joins `items` of all pages under `header` (ADR-0002 export format). */
export interface ExportPage {
  readonly header: {
    readonly scope: {
      readonly kind: "library" | "folder";
      readonly name: string;
    };
  } & Record<string, unknown>;
  readonly items: readonly unknown[];
  readonly total: number;
  readonly next: number | null;
}

/** Answer of an export start: the run token for the page calls and the templates in scope. */
export interface ExportStart {
  readonly token: string;
  readonly total: number;
}

export interface ReportLine {
  readonly kind: "folder" | "template";
  readonly name: string;
  readonly outcome: "skipped" | "failed";
  readonly reason: string;
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

export interface JobRow {
  readonly name: string;
  readonly schedule: string;
  readonly lastOk: string;
  readonly status: "ok" | "late" | "never";
  readonly lastError: string;
}

export interface ConfigView {
  readonly domain: string;
  readonly adminGroup: string;
  readonly resolver: string;
  readonly callerIdentity: string;
  readonly indexRev: string;
  readonly appVersion: string;
  readonly indexBytes: number;
  readonly indexWarnBytes: number;
  /** Admin settings (D29, spec 5.8), defaults filled in. */
  readonly settings: Settings;
  readonly jobs: readonly JobRow[];
  readonly triggersError: string;
}

export interface Api {
  profile(): Promise<Profile>;
  me(): Promise<Me>;
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
  /** `recipientsUnreadable`: fields of version K whose stored list could not be read and were restored empty. */
  restore(
    id: string,
    version: number,
    baseVersion: number,
  ): Promise<Item & { recipientsUnreadable?: RecipientField[] }>;
  duplicate(id: string): Promise<Item>;
  move(id: string, folderId: string, baseVersion: number): Promise<Item>;
  remove(id: string, baseVersion: number): Promise<Item>;
  /** Trashed templates the caller may edit; `canPurge` when the caller is an admin. */
  trash(): Promise<{ items: TrashRow[]; canPurge: boolean }>;
  restoreFromTrash(id: string, folderId: string): Promise<Item>;
  /** `itemsPending`: purged templates whose stored versions the daily job removes. */
  purgeTrash(): Promise<{
    purged: number;
    templates: number;
    folders: number;
    filesTrashed: number;
    itemsPending: number;
  }>;
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
  audit(filter: AuditFilter): Promise<AuditPage>;
  auditEvent(month: string, id: string): Promise<{ event: AuditEvent }>;
  usage(): Promise<{ since: string; rows: UsageRow[] }>;
  /** `folderId` "" exports the whole library (admin). The start records the export in the audit log. */
  exportStart(folderId: string): Promise<ExportStart>;
  exportPage(
    folderId: string,
    offset: number,
    token: string,
  ): Promise<ExportPage>;
  importFile(
    folderId: string,
    file: string,
    dryRun: boolean,
  ): Promise<ImportReport>;
  config(): Promise<ConfigView>;
  /** `config.set`: CONFLICT with the current entry in `details` when `base` is not the last change. */
  setSetting(
    name: SettingName,
    value: SettingValue,
    base: SettingEntry,
  ): Promise<SettingEntry & { changed: boolean }>;
  backups(): Promise<{ dates: string[] }>;
  restoreBackup(date: string): Promise<{ date: string; rev: number }>;
}

/** The casts trust the server's documented response shapes; the envelope itself is checked in client.ts. */
export function createApi(client: RpcClient): Api {
  const call = <T>(op: string, args: unknown = {}) =>
    client.call(op, args) as Promise<T>;
  return {
    profile: () => call("profile.me"),
    me: () => call("me"),
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
    audit: (filter) => call("audit.query", filter),
    auditEvent: (month, id) => call("audit.query", { month, id }),
    usage: () => call("usage.report"),
    exportStart: (folderId) =>
      folderId === ""
        ? call("export.library", { start: true })
        : call("export.folder", { folderId, start: true }),
    exportPage: (folderId, offset, token) =>
      folderId === ""
        ? call("export.library", { offset, token })
        : call("export.folder", { folderId, offset, token }),
    importFile: (folderId, file, dryRun) =>
      call("import", { folderId, file, dryRun }),
    config: () => call("config.get"),
    setSetting: (name, value, base) =>
      call("config.set", {
        name,
        value,
        baseAt: base.updatedAt,
        baseBy: base.updatedBy,
      }),
    backups: () => call("backup.list"),
    restoreBackup: (date) => call("backup.restore", { date }),
  };
}
