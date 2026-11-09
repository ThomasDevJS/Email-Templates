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
  /** Loaded on first use and memoized; ops open to any caller never pay for it. */
  readonly access: () => Access;
}

export type Handler = (context: HandlerContext) => unknown;
export type HandlerTable = Readonly<Record<string, Handler>>;

export function accessFor(services: Services, caller: Caller): Access {
  const index = loadIndex(services);
  const subject = subjectFor(
    caller.email,
    readSnapshot(services),
    services.props,
  );
  return { subject, index, levelOf: levelResolver(subject, index) };
}

export function createContext(
  request: Omit<HandlerContext, "access">,
): HandlerContext {
  let access: Access | undefined;
  return {
    ...request,
    access: () => (access ??= accessFor(request.services, request.caller)),
  };
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
