import type { StoredSettings } from "./settings";

/**
 * Stored records (spec section 5, ADR-0002 Layout). Times are ISO 8601 UTC strings; an empty string means "not set".
 * Every mutable record carries `version`; `index.json` carries `rev`.
 */

export type Level = "use" | "edit" | "manage";
export type FolderKind = "shared" | "private";
export type PrincipalType = "group" | "user" | "domain" | "ou";

export interface Folder {
  readonly id: string;
  readonly parentId: string;
  readonly name: string;
  readonly kind: FolderKind;
  readonly ownerEmail: string;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly deletedAt: string;
  readonly deletedBy: string;
  readonly version: number;
}

export interface Grant {
  readonly id: string;
  readonly folderId: string;
  readonly principalType: PrincipalType;
  readonly principalKey: string;
  readonly principalId: string;
  readonly level: Level;
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface Item {
  readonly id: string;
  readonly kind: "template" | "signature";
  readonly folderId: string;
  readonly title: string;
  readonly subject: string;
  readonly tags: readonly string[];
  /** D26 (slice 9): fixed recipients, normalized. Absent in items saved before; read with `recipientsOf`. */
  readonly to?: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly status: "published" | "draft";
  readonly currentVersion: number;
  readonly bodyFileId: string;
  readonly snippet: string;
  readonly placeholders: readonly string[];
  readonly prompts: readonly string[];
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly deletedAt: string;
  readonly deletedBy: string;
  readonly version: number;
}

export type AuditSurface = "addon" | "webapp" | "trigger";
export type AuditResult = "ok" | "denied" | "conflict" | "error";
export type AuditTargetType =
  "template" | "folder" | "grant" | "library" | "config";

/** ADR-0003 Part D. `before` and `after` hold metadata only; bodies appear as `{ version, fileId, sha256 }`. */
export interface AuditEvent {
  readonly id: string;
  readonly ts: string;
  readonly actor: string;
  readonly actorRoles: string;
  readonly surface: AuditSurface;
  readonly action: string;
  readonly targetType: AuditTargetType;
  readonly targetId: string;
  readonly targetPath: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly result: AuditResult;
  readonly errorCode: string;
  readonly durationMs: number;
  readonly requestId: string;
  readonly appVersion: string;
}

export interface IndexDoc {
  readonly schemaVersion: 1;
  readonly rev: number;
  readonly updatedAt: string;
  readonly folders: readonly Folder[];
  readonly grants: readonly Grant[];
  readonly items: readonly Item[];
  readonly pendingAudit: readonly AuditEvent[];
  /** D29 (slice 11): admin settings; absent reads as the defaults (`settingsOf`, spec 5.8). */
  readonly settings?: StoredSettings | undefined;
}

export interface BodyFile {
  readonly itemId: string;
  readonly version: number;
  /** Added 2026-11-10 (D21). Files written before read as "" (`withSubject`). */
  readonly subject: string;
  /** D26 (slice 9): the recipients of this version. Absent in files written before; read with `recipientsOf`. */
  readonly to?: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly html: string;
  readonly plainText: string;
  readonly savedAt: string;
  readonly savedBy: string;
  readonly note: string;
  readonly restoredFrom: number;
  readonly sha256: string;
}

export interface GroupSnapshot {
  readonly members: readonly string[];
  readonly childGroups: readonly string[];
  readonly status: "ok" | "error";
}

export interface MembersDoc {
  readonly refreshedAt: string;
  readonly resolver: string;
  readonly groups: Readonly<Record<string, GroupSnapshot>>;
  readonly warnings: readonly string[];
}

export interface FavoritesDoc {
  readonly rev: number;
  readonly byUser: Readonly<Record<string, readonly string[]>>;
}

export interface UsageEntry {
  readonly applyCount: number;
  readonly lastUsedAt: string;
  /** Applies per UTC day (`YYYY-MM-DD`), last 30 days; added in slice 6b, absent in older entries. */
  readonly days?: Readonly<Record<string, number>>;
}

export interface UsageDoc {
  readonly rev: number;
  readonly items: Readonly<Record<string, UsageEntry>>;
  readonly recent: Readonly<Record<string, readonly string[]>>;
}

/** A stored record that may predate the subject field (spec 5.5): items and body files written before slice 5. */
export type Unmigrated<T extends { readonly subject: string }> = Omit<
  T,
  "subject"
> & { readonly subject?: string };

/** Missing subject reads as "". No migration write. */
export function withSubject<T extends { readonly subject: string }>(
  record: Unmigrated<T>,
): T {
  return { ...record, subject: record.subject ?? "" } as T;
}

export type StoredIndex = Omit<IndexDoc, "items"> & {
  readonly items: readonly Unmigrated<Item>[];
};

/** `index.json` as read from Drive or the cache: every item gets a subject. */
export function readIndexDoc(doc: StoredIndex): IndexDoc {
  return { ...doc, items: doc.items.map((item) => withSubject<Item>(item)) };
}

export function emptyIndex(nowIso: string): IndexDoc {
  return {
    schemaVersion: 1,
    rev: 1,
    updatedAt: nowIso,
    folders: [],
    grants: [],
    items: [],
    pendingAudit: [],
  };
}

export function emptyMembers(resolver: string): MembersDoc {
  return { refreshedAt: "", resolver, groups: {}, warnings: [] };
}

export const EMPTY_FAVORITES: FavoritesDoc = { rev: 1, byUser: {} };
export const EMPTY_USAGE: UsageDoc = { rev: 1, items: {}, recent: {} };
