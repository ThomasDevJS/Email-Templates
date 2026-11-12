import { getChunked, putChunked } from "../../shared/cache/chunked";
import type { Services } from "../services";
import type { SideDocs } from "../storage/port";

/**
 * `favorites.json` and `usage.json` through the Script Cache, the `INDEX_REV` pattern (ADR-0002 Caching): Script
 * Property `FAVORITES_REV` or `USAGE_REV` names the published `rev`, readers accept only that `<prefix>:<rev>:*`
 * set. A miss reads Drive and puts the set only when the file has the published `rev`, so a late put is never
 * newer than a writer's. Writers (`favorite.*`, `tick`) hold the script lock and publish. `tick` publishes a file
 * whose property is unset (environments set up before slice 5).
 */
export const SIDE_CACHE = {
  favorites: { prefix: "fav", revKey: "FAVORITES_REV" },
  usage: { prefix: "use", revKey: "USAGE_REV" },
} as const;

export type CachedSide = keyof typeof SIDE_CACHE;
export const CACHED_SIDES: readonly CachedSide[] = ["favorites", "usage"];

type SideServices = Pick<
  Services,
  "props" | "cache" | "store" | "nowMs" | "stats" | "logger"
>;

function putSide<K extends CachedSide>(
  services: SideServices,
  name: K,
  doc: SideDocs[K],
): void {
  try {
    putChunked(
      services.cache,
      SIDE_CACHE[name].prefix,
      String(doc.rev),
      JSON.stringify(doc),
      services.nowMs(),
    );
  } catch (error: unknown) {
    services.logger.warn({
      surface: services.stats.surface,
      action: "cache.put",
      result: "error",
      error,
    });
  }
}

export function readSideCached<K extends CachedSide>(
  services: SideServices,
  name: K,
): SideDocs[K] {
  const { prefix, revKey } = SIDE_CACHE[name];
  const rev = services.props.getProperty(revKey);
  const text = rev === null ? null : getChunked(services.cache, prefix, rev);
  if (text !== null) return JSON.parse(text) as SideDocs[K];
  const doc = services.store().readSide(name);
  if (rev === String(doc.rev)) putSide(services, name, doc);
  return doc;
}

/** Caller holds the script lock: publishes the file's `rev` and the cache set. */
export function publishSide<K extends CachedSide>(
  services: SideServices,
  name: K,
  doc: SideDocs[K],
): void {
  services.props.setProperty(SIDE_CACHE[name].revKey, String(doc.rev));
  putSide(services, name, doc);
}

/** Caller holds the script lock: writes the file, then publishes it. */
export function writeSideLocked<K extends CachedSide>(
  services: SideServices,
  name: K,
  doc: SideDocs[K],
): void {
  services.store().writeSide(name, doc);
  publishSide(services, name, doc);
}
