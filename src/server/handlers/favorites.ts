import { reqString } from "../dispatch/args";
import type { HandlerContext } from "../dispatch/context";
import { readSideCached, writeSideLocked } from "../cache/sideCache";
import { WRITE_LOCK_MS, withLock } from "../lock";
import type { Services } from "../services";
import { liveItem } from "./indexOps";

/**
 * Favorites (`favorites.json`, spec 5.5) and the caller's Recent list (`usage.json` `recent`). Stored lists may
 * name templates the caller can no longer use; every read keeps only IDs in the caller's visible set.
 */
export interface CallerLists {
  /** Newest first. */
  readonly favorites: string[];
  /** Last used first. */
  readonly recent: string[];
}

const key = (email: string): string => email.trim().toLowerCase();

const keep = (
  ids: readonly string[] | undefined,
  visible: ReadonlySet<string>,
): string[] => (ids ?? []).filter((id) => visible.has(id));

/** The caller's Recent list only: search ranking needs no favorites read. */
export function callerRecent(
  services: Services,
  email: string,
  visible: ReadonlySet<string>,
): string[] {
  return keep(readSideCached(services, "usage").recent[key(email)], visible);
}

export function callerLists(
  services: Services,
  email: string,
  visible: ReadonlySet<string>,
): CallerLists {
  const favorites = readSideCached(services, "favorites").byUser[key(email)];
  return {
    favorites: keep(favorites, visible),
    recent: callerRecent(services, email, visible),
  };
}

/** Dispatch checked `use` on the template's folder. The list is read and written under the script lock. */
function setFavorite(
  context: HandlerContext,
  favorite: boolean,
): { id: string; favorite: boolean } {
  const id = reqString(context.args, "id");
  if (favorite) liveItem(context.access().index, id);
  const { services } = context;
  const email = key(context.caller.email);
  withLock(services.lock, WRITE_LOCK_MS, () => {
    const doc = services.store().readSide("favorites");
    const rest = (doc.byUser[email] ?? []).filter((other) => other !== id);
    writeSideLocked(services, "favorites", {
      rev: doc.rev + 1,
      byUser: { ...doc.byUser, [email]: favorite ? [id, ...rest] : rest },
    });
  });
  return { id, favorite };
}

export function favoriteSet(context: HandlerContext) {
  return setFavorite(context, true);
}

export function favoriteUnset(context: HandlerContext) {
  return setFavorite(context, false);
}
