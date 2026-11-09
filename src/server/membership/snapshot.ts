import {
  emptyMembers,
  type GroupSnapshot,
  type IndexDoc,
  type MembersDoc,
} from "../../shared/model/data";
import {
  isAdminEmail,
  principalsFor,
} from "../../shared/permissions/principals";
import type { Subject } from "../../shared/permissions/effective";
import { getChunked, putChunked } from "../cache/chunked";
import { WRITE_LOCK_MS, withLock } from "../lock";
import { nowIso, type Services } from "../services";
import {
  createResolver,
  resolverId,
  type MembershipResolver,
} from "./resolver";

/**
 * Membership snapshot (ADR-0003 Part B): `members.json` on Drive plus `gm:*` chunks in the Script Cache.
 * Requests read only the snapshot and never call GroupsApp, so user traffic cannot exhaust its quota.
 */
export const MEMBERS_PREFIX = "gm";
export const ADMIN_GROUP_KEY = "ADMIN_GROUP";
export const ADMIN_EMAILS_KEY = "ADMIN_EMAILS";
export const RESOLVER_KEY = "MEMBERSHIP_RESOLVER";

type SnapshotServices = Pick<
  Services,
  "props" | "cache" | "lock" | "store" | "nowMs" | "groups"
>;

function cacheRev(doc: MembersDoc): string {
  return String(Date.parse(doc.refreshedAt) || 0);
}

export function putMembersCache(
  services: SnapshotServices,
  doc: MembersDoc,
): void {
  putChunked(
    services.cache,
    MEMBERS_PREFIX,
    cacheRev(doc),
    JSON.stringify(doc),
    services.nowMs(),
  );
}

export function readSnapshot(services: SnapshotServices): MembersDoc {
  const cached = getChunked(services.cache, MEMBERS_PREFIX);
  if (cached !== null) return JSON.parse(cached) as MembersDoc;
  const doc = services.store().readSide("members");
  putMembersCache(services, doc);
  return doc;
}

/** Referenced groups G = the admin group plus every group named in a grant. */
export function referencedGroups(
  index: IndexDoc,
  adminGroup: string,
): string[] {
  const groups = new Set<string>();
  if (adminGroup.trim() !== "") groups.add(adminGroup.trim().toLowerCase());
  for (const grant of index.grants) {
    if (grant.principalType === "group")
      groups.add(grant.principalKey.toLowerCase());
  }
  return [...groups].sort();
}

function readGroup(
  resolver: MembershipResolver,
  group: string,
  previous: GroupSnapshot | undefined,
): { snapshot: GroupSnapshot; warning: string } {
  try {
    const childGroups = resolver.nestedGroups(group);
    const snapshot: GroupSnapshot = {
      members: resolver.listMembers(group),
      childGroups,
      status: "ok",
    };
    const warning =
      childGroups.length > 0 && !resolver.capabilities.nested
        ? `Group ${group} contains group ${childGroups.join(", ")}. Members of nested groups get no access until the resolver supports nesting.`
        : "";
    return { snapshot, warning };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return {
      snapshot: {
        members: previous?.members ?? [],
        childGroups: previous?.childGroups ?? [],
        status: "error",
      },
      warning: `Group ${group} could not be read (${reason}). Previous members kept.`,
    };
  }
}

/** New snapshot for `groups`; groups that fail keep their previous members with status `error`. */
export function buildSnapshot(
  resolver: MembershipResolver,
  groups: readonly string[],
  previous: MembersDoc,
  refreshedAt: string,
): MembersDoc {
  const entries: Record<string, GroupSnapshot> = {};
  const warnings: string[] = [];
  for (const group of groups) {
    const { snapshot, warning } = readGroup(
      resolver,
      group,
      previous.groups[group],
    );
    entries[group] = snapshot;
    if (warning !== "") warnings.push(warning);
  }
  return { refreshedAt, resolver: resolver.id, groups: entries, warnings };
}

function currentResolver(services: SnapshotServices): MembershipResolver {
  return createResolver(
    resolverId(services.props.getProperty(RESOLVER_KEY)),
    services.groups,
  );
}

/** Refreshes every referenced group, writes `members.json` under the lock, then the `gm:*` cache. */
export function refreshSnapshot(
  services: SnapshotServices,
  index: IndexDoc,
): MembersDoc {
  const adminGroup = services.props.getProperty(ADMIN_GROUP_KEY) ?? "";
  const resolver = currentResolver(services);
  const previous = readPreviousSnapshot(services, resolver.id);
  const doc = buildSnapshot(
    resolver,
    referencedGroups(index, adminGroup),
    previous,
    nowIso(services),
  );
  withLock(services.lock, WRITE_LOCK_MS, () => {
    services.store().writeSide("members", doc);
  });
  putMembersCache(services, doc);
  return doc;
}

/** Adds or refreshes one group in the snapshot, for a grant to a group the snapshot lacks (ADR-0003 Part B). */
export function refreshGroup(
  services: SnapshotServices,
  group: string,
): MembersDoc {
  const resolver = currentResolver(services);
  const previous = readPreviousSnapshot(services, resolver.id);
  const key = group.trim().toLowerCase();
  const fresh = buildSnapshot(resolver, [key], previous, nowIso(services));
  const doc: MembersDoc = {
    refreshedAt: fresh.refreshedAt,
    resolver: resolver.id,
    groups: { ...previous.groups, ...fresh.groups },
    warnings: [
      ...previous.warnings.filter((w) => !w.startsWith(`Group ${key} `)),
      ...fresh.warnings,
    ],
  };
  withLock(services.lock, WRITE_LOCK_MS, () => {
    services.store().writeSide("members", doc);
  });
  putMembersCache(services, doc);
  return doc;
}

function readPreviousSnapshot(
  services: SnapshotServices,
  id: string,
): MembersDoc {
  try {
    return services.store().readSide("members");
  } catch {
    return emptyMembers(id);
  }
}

/** Subject for permission checks: principals and admin flag from the snapshot and Script Properties. */
export function subjectFor(
  email: string,
  snapshot: MembersDoc,
  props: Services["props"],
): Subject {
  return {
    email,
    principals: principalsFor(email, snapshot),
    isAdmin: isAdminEmail(
      email,
      props.getProperty(ADMIN_EMAILS_KEY) ?? "",
      props.getProperty(ADMIN_GROUP_KEY) ?? "",
      snapshot,
    ),
  };
}
