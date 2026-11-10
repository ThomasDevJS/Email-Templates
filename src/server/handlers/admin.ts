import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { MembersDoc } from "../../shared/model/data";
import { appliesSince, windowStart } from "../audit/usage";
import { loadIndex } from "../cache/indexCache";
import { readSideCached } from "../cache/sideCache";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { purgeDeleted } from "../jobs/daily";
import {
  readSnapshot,
  refreshSnapshot,
  RESOLVER_KEY,
} from "../membership/snapshot";
import { createResolver, resolverId } from "../membership/resolver";
import { nowIso, type Services } from "../services";
import { commit } from "./commit";
import { folderLabel, type FolderView } from "./folders";
import { folderPath } from "./indexOps";

/**
 * Admin view (wireframe 06). `admin.folders` decides who enters: admins get every live folder, private ones
 * labelled with their owner (D18); `manage` holders get the folders they manage; everyone else DENIED.
 */
export function adminFolders(context: HandlerContext): {
  isAdmin: boolean;
  folders: FolderView[];
} {
  const { index, levelOf, subject } = context.access();
  const folders = index.folders
    .filter((folder) => folder.deletedAt === "")
    .map((folder) => ({
      ...folder,
      name: folderLabel(folder, context.caller.email),
      level: levelOf(folder.id),
    }))
    .filter((folder) => folder.level === "manage");
  if (!subject.isAdmin && folders.length === 0)
    throw new AppError(
      ErrorCode.DENIED,
      "You don't have access to this. Ask a folder manager.",
    );
  return { isAdmin: subject.isAdmin, folders };
}

export interface GroupRow {
  readonly group: string;
  readonly members: number;
  readonly childGroups: readonly string[];
  readonly status: "ok" | "error";
}

/** Memberships tab: counts only, no member addresses. `nested` false means child groups grant nothing (D7). */
export interface MembershipView {
  readonly resolver: string;
  readonly nested: boolean;
  readonly refreshedAt: string;
  readonly groups: readonly GroupRow[];
  readonly warnings: readonly string[];
}

function membershipView(
  services: Pick<Services, "props" | "groups">,
  doc: MembersDoc,
): MembershipView {
  const resolver = createResolver(
    resolverId(services.props.getProperty(RESOLVER_KEY)),
    services.groups,
  );
  return {
    resolver: resolver.id,
    nested: resolver.capabilities.nested,
    refreshedAt: doc.refreshedAt,
    groups: Object.entries(doc.groups)
      .map(([group, entry]) => ({
        group,
        members: entry.members.length,
        childGroups: entry.childGroups,
        status: entry.status,
      }))
      .sort((a, b) => a.group.localeCompare(b.group)),
    warnings: doc.warnings,
  };
}

export function membershipStatus(context: HandlerContext): MembershipView {
  return membershipView(context.services, readSnapshot(context.services));
}

/** "Refresh now" (admin): the 15-min `refreshMembers` run, at once and under the lock. */
export function membershipRefresh(context: HandlerContext): MembershipView {
  const { services } = context;
  return membershipView(
    services,
    refreshSnapshot(services, loadIndex(services)),
  );
}

/**
 * "Empty trash now" (admin): every soft-deleted template and folder leaves the index, then up to PURGE_FILES_MAX
 * body files go to the Drive trash; `itemsPending` templates keep theirs until the daily orphan cleanup.
 */
export function trashPurge(context: HandlerContext): {
  purged: number;
  filesTrashed: number;
  itemsPending: number;
} {
  const { services } = context;
  const report = purgeDeleted(
    services,
    services.nowMs() + 1,
    eventSource(context),
    (mutation) => commit(context, mutation),
  );
  return {
    purged: report.count,
    filesTrashed: report.filesTrashed,
    itemsPending: report.itemsPending,
  };
}

export interface UsageRow {
  readonly id: string;
  readonly title: string;
  readonly folderPath: string;
  readonly applies30d: number;
  readonly lastUsedAt: string;
}

/**
 * Usage tab (admin, wireframe 06): every live template with its folder, applies in the last 30 days (UTC days,
 * today included) and last use, most applied first. Entries written before slice 6b have no per-day counts and
 * show 0 applies until their next apply. Reads the index and `usage.json` through the cache.
 */
export function usageReport(context: HandlerContext): {
  since: string;
  rows: UsageRow[];
} {
  const { services } = context;
  const { index } = context.access();
  const usage = readSideCached(services, "usage");
  const since = windowStart(nowIso(services));
  const live = new Set(
    index.folders.filter((f) => f.deletedAt === "").map((f) => f.id),
  );
  const rows = index.items
    .filter((item) => item.deletedAt === "" && live.has(item.folderId))
    .map((item) => {
      const entry = usage.items[item.id];
      return {
        id: item.id,
        title: item.title,
        folderPath: folderPath(index, item.folderId),
        applies30d: appliesSince(entry, since),
        lastUsedAt: entry?.lastUsedAt ?? "",
      };
    })
    .sort(
      (a, b) =>
        b.applies30d - a.applies30d ||
        b.lastUsedAt.localeCompare(a.lastUsedAt) ||
        a.title.localeCompare(b.title),
    );
  return { since, rows };
}
