import { AppError, ErrorCode } from "../../shared/errors/codes";
import type {
  Grant,
  IndexDoc,
  MembersDoc,
  Level,
  PrincipalType,
} from "../../shared/model/data";
import { inPrivateTree } from "../../shared/permissions/effective";
import { isLevel } from "../../shared/permissions/levels";
import { auditEvent, type EventSource } from "../audit/events";
import { reqString } from "../dispatch/args";
import { eventSource, type HandlerContext } from "../dispatch/context";
import { mergeGroup, readGroupNow } from "../membership/snapshot";
import { nowIso } from "../services";
import { commit } from "./commit";
import {
  chainOf,
  findGrant,
  folderPath,
  liveFolder,
  replaceById,
} from "./indexOps";

const PRINCIPAL_TYPES: readonly PrincipalType[] = [
  "group",
  "user",
  "domain",
  "ou",
];

export interface GrantView extends Grant {
  /** False for OU grants: `groupsapp_direct` cannot resolve org units (Q4). */
  readonly active: boolean;
  readonly inherited: boolean;
}

function validation(message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message);
}

function view(grant: Grant, inherited: boolean): GrantView {
  return { ...grant, active: grant.principalType !== "ou", inherited };
}

/** Grants on the folder, then grants inherited from its ancestors. */
export function grantList(context: HandlerContext): { grants: GrantView[] } {
  const { index } = context.access();
  const folderId = reqString(context.args, "folderId");
  const chain = chainOf(index, folderId).map((folder) => folder.id);
  const grants = chain.flatMap((id) =>
    index.grants
      .filter((grant) => grant.folderId === id)
      .map((grant) => view(grant, id !== folderId)),
  );
  return { grants };
}

function principalType(value: string): PrincipalType {
  const type = PRINCIPAL_TYPES.find((candidate) => candidate === value);
  if (type === undefined)
    throw validation("principalType must be group, user, domain or ou");
  return type;
}

function principalKeyFor(type: PrincipalType, raw: string): string {
  const key = raw.trim().toLowerCase();
  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key);
  if ((type === "group" || type === "user") && !isEmail)
    throw validation(`${type} needs an email address`);
  if (type === "domain" && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(key))
    throw validation("domain needs a domain name");
  if (type === "ou" && !key.startsWith("/"))
    throw validation("ou needs a path starting with /");
  return key;
}

function grantLevel(value: string): Level {
  if (!isLevel(value)) throw validation("level must be use, edit or manage");
  return value;
}

function grantEvent(
  source: EventSource,
  index: IndexDoc,
  action: string,
  before: Grant | null,
  after: Grant | null,
) {
  const target = after ?? before;
  return auditEvent(source, {
    action,
    targetType: "grant",
    targetId: target?.id ?? "",
    targetPath: target === null ? "" : folderPath(index, target.folderId),
    before,
    after,
  });
}

function checkShareable(index: IndexDoc, folderId: string): void {
  liveFolder(index, folderId);
  if (inPrivateTree(chainOf(index, folderId)))
    throw validation("Private folders cannot be shared");
}

/**
 * Group principals are read through the resolver before the grant commits (unknown group: VALIDATION). After the
 * commit the read is merged into the snapshot, so the next request sees the members without waiting for the trigger.
 */
function readGroup(
  context: HandlerContext,
  type: PrincipalType,
  key: string,
): MembersDoc | null {
  if (type !== "group") return null;
  const fresh = readGroupNow(context.services, key);
  if (fresh.groups[key]?.status !== "ok")
    throw validation(
      `Group ${key} was not found or its members are not visible`,
    );
  return fresh;
}

/** Adds a grant, or changes the level of the existing grant for the same principal on the folder. */
export function grantAdd(context: HandlerContext): Grant {
  const folderId = reqString(context.args, "folderId");
  const type = principalType(reqString(context.args, "principalType"));
  const key = principalKeyFor(type, reqString(context.args, "principalKey"));
  const level = grantLevel(reqString(context.args, "level"));
  checkShareable(context.access().index, folderId);
  const fresh = readGroup(context, type, key);
  const source = eventSource(context, folderId);
  const added = commit(context, (current) => {
    checkShareable(current, folderId);
    const existing = current.grants.find(
      (grant) =>
        grant.folderId === folderId &&
        grant.principalType === type &&
        grant.principalKey === key,
    );
    const after: Grant =
      existing === undefined
        ? {
            id: context.services.newId(),
            folderId,
            principalType: type,
            principalKey: key,
            principalId: "",
            level,
            createdAt: nowIso(context.services),
            createdBy: context.caller.email,
          }
        : { ...existing, level };
    const grants =
      existing === undefined
        ? [...current.grants, after]
        : replaceById(current.grants, after);
    const doc = { ...current, grants };
    return {
      doc,
      events: [grantEvent(source, doc, "grant.add", existing ?? null, after)],
      result: after,
    };
  });
  if (fresh !== null) mergeAfterGrant(context, fresh);
  return added;
}

/**
 * The grant is committed; a failed merge (Drive read or lock) leaves the snapshot as it was. The 15-min
 * `refreshMembers` run adds the group, so the request still succeeds.
 */
function mergeAfterGrant(context: HandlerContext, fresh: MembersDoc): void {
  try {
    mergeGroup(context.services, fresh);
  } catch (error: unknown) {
    context.services.logger.warn({
      surface: context.surface,
      requestId: context.requestId,
      action: "grant.add.snapshotMerge",
      actor: context.caller.email,
      result: "error",
      error,
    });
  }
}

export function grantRemove(context: HandlerContext): { removed: string } {
  const grantId = reqString(context.args, "grantId");
  const source = eventSource(
    context,
    findGrant(context.access().index, grantId).folderId,
  );
  return commit(context, (current) => {
    const before = findGrant(current, grantId);
    const doc = {
      ...current,
      grants: current.grants.filter((grant) => grant.id !== grantId),
    };
    return {
      doc,
      events: [grantEvent(source, doc, "grant.remove", before, null)],
      result: { removed: grantId },
    };
  });
}
