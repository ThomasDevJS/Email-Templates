import type { Surface } from "../../shared/log/logger";
import type { IndexDoc } from "../../shared/model/data";
import {
  levelResolver,
  type LevelOf,
  type Subject,
} from "../../shared/permissions/effective";
import type { EventSource } from "../audit/events";
import { loadIndex } from "../cache/indexCache";
import { readSnapshot, subjectFor } from "../membership/snapshot";
import { nowIso, type Services } from "../services";

export interface Caller {
  readonly email: string;
}

/** Caller's permission view: principals and admin flag from the snapshot, levels over the loaded index. */
export interface Access {
  readonly subject: Subject;
  readonly levelOf: LevelOf;
  readonly index: IndexDoc;
}

export interface HandlerContext {
  readonly caller: Caller;
  readonly args: unknown;
  readonly surface: Surface;
  readonly requestId: string;
  readonly services: Services;
  /** Principals and admin flag from the membership snapshot (and the index for the in-app list); memoized. */
  readonly subject: () => Subject;
  /** Subject plus the loaded index; loaded on first use and memoized. Ops open to any caller never pay for it. */
  readonly access: () => Access;
  /**
   * Re-runs this op's authorization on the index read inside the script lock. Throws CONFLICT when a target
   * folder changed since the pre-lock check (concurrent move) and DENIED when the caller lost the level.
   */
  readonly recheck: (index: IndexDoc) => void;
}

export type Handler = (context: HandlerContext) => unknown;
export type HandlerTable = Readonly<Record<string, Handler>>;

export function createContext(
  request: Omit<HandlerContext, "access" | "subject">,
): HandlerContext {
  const { services, caller } = request;
  let subject: Subject | undefined;
  let access: Access | undefined;
  let loaded: IndexDoc | undefined;
  const indexOf = (): IndexDoc => (loaded ??= loadIndex(services));
  const subjectOf = (): Subject =>
    (subject ??= subjectFor(
      caller.email,
      readSnapshot(services),
      services.props,
      indexOf,
    ));
  const accessOf = (): Access => {
    if (access !== undefined) return access;
    const index = indexOf();
    const who = subjectOf();
    access = { subject: who, index, levelOf: levelResolver(who, index) };
    return access;
  };
  return { ...request, subject: subjectOf, access: accessOf };
}

/** Audit source of this request. `actorRoles` is `admin` or the caller's level on `folderId`. */
export function eventSource(
  context: HandlerContext,
  folderId = "",
): EventSource {
  const { subject, levelOf } = context.access();
  return {
    actor: context.caller.email,
    actorRoles: subject.isAdmin ? "admin" : levelOf(folderId),
    surface: context.surface,
    requestId: context.requestId,
    appVersion: context.services.appVersion,
    nowIso: () => nowIso(context.services),
    newId: context.services.newId,
  };
}
