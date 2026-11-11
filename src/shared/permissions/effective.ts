import type { Folder, Grant } from "../model/data";
import { personalTemplatesOn, type StoredSettings } from "../model/settings";
import { higher, type AccessLevel } from "./levels";
import { ROLE_MATRIX } from "./matrix";
import { principalKey } from "./principals";

/** Who is asking. `principals` comes from `principalsFor`; `isAdmin` from `isAdminEmail`. */
export interface Subject {
  readonly email: string;
  readonly principals: ReadonlySet<string>;
  readonly isAdmin: boolean;
}

export interface PermissionData {
  readonly folders: readonly Folder[];
  readonly grants: readonly Grant[];
  /** Admin settings of the index (D29); absent = the defaults. */
  readonly settings?: StoredSettings | undefined;
}

export type LevelOf = (folderId: string) => AccessLevel;

/** Folder and its ancestors, nearest first. Stops at a missing parent or a cycle. */
export function ancestry(
  folderId: string,
  byId: ReadonlyMap<string, Folder>,
): Folder[] {
  const chain: Folder[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current !== undefined && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return chain;
}

export function folderMap(folders: readonly Folder[]): Map<string, Folder> {
  return new Map(folders.map((folder) => [folder.id, folder]));
}

/** True when the folder or one of its ancestors is a private folder (D11). */
export function inPrivateTree(chain: readonly Folder[]): boolean {
  return chain.some((folder) => folder.kind === "private");
}

function grantKey(grant: Grant): string {
  return principalKey(grant.principalType, grant.principalKey);
}

function grantLevel(
  chain: readonly Folder[],
  subject: Subject,
  grantsByFolder: ReadonlyMap<string, readonly Grant[]>,
): AccessLevel {
  let level: AccessLevel = "none";
  for (const folder of chain) {
    for (const grant of grantsByFolder.get(folder.id) ?? []) {
      if (subject.principals.has(grantKey(grant)))
        level = higher(level, grant.level);
    }
  }
  return level;
}

/** Level the owner of a private folder holds there: the matrix row "Private folder of self". */
export const PRIVATE_OWNER_LEVEL: AccessLevel =
  ROLE_MATRIX["private.self"].level;

function isOwner(chain: readonly Folder[], subject: Subject): boolean {
  const owner = chain.find((folder) => folder.kind === "private")?.ownerEmail;
  return (
    owner !== undefined &&
    owner.toLowerCase() === subject.email.trim().toLowerCase()
  );
}

/** Private tree: the owner holds `edit`, nobody else holds anything; grants there are ignored (D11). */
function privateLevel(chain: readonly Folder[], subject: Subject): AccessLevel {
  return isOwner(chain, subject) ? PRIVATE_OWNER_LEVEL : "none";
}

/** Personal templates off (D29, ADR-0008 section 3): owner and admins read and insert, nobody writes. */
function privateOffLevel(
  chain: readonly Folder[],
  subject: Subject,
): AccessLevel {
  return subject.isAdmin || isOwner(chain, subject) ? "use" : "none";
}

function groupGrants(grants: readonly Grant[]): Map<string, Grant[]> {
  const byFolder = new Map<string, Grant[]>();
  for (const grant of grants) {
    const list = byFolder.get(grant.folderId) ?? [];
    list.push(grant);
    byFolder.set(grant.folderId, list);
  }
  return byFolder;
}

/**
 * Effective level = maximum over grants on the folder and every ancestor whose principal the subject holds.
 * Admin = `manage` on every existing folder, private ones included. Unknown folder = `none`. Memoized per folder.
 * While personal templates are off (D29), a private tree is `use` for its owner and admins and `none` for others;
 * that rule runs before the admin rule.
 */
export function levelResolver(subject: Subject, data: PermissionData): LevelOf {
  const privateOff = !personalTemplatesOn(data.settings);
  const byId = folderMap(data.folders);
  const grantsByFolder = groupGrants(data.grants);
  const memo = new Map<string, AccessLevel>();
  const compute = (folderId: string): AccessLevel => {
    const chain = ancestry(folderId, byId);
    if (chain.length === 0) return "none";
    if (privateOff && inPrivateTree(chain))
      return privateOffLevel(chain, subject);
    if (subject.isAdmin) return "manage";
    if (inPrivateTree(chain)) return privateLevel(chain, subject);
    return grantLevel(chain, subject, grantsByFolder);
  };
  return (folderId) => {
    const cached = memo.get(folderId);
    if (cached !== undefined) return cached;
    const level = compute(folderId);
    memo.set(folderId, level);
    return level;
  };
}
