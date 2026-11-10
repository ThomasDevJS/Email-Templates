import type { IndexDoc } from "../../shared/model/data";
import type { Services } from "../services";
import { getChunked, putChunked } from "../../shared/cache/chunked";

/**
 * `index.json` through the Script Cache (ADR-0002 Caching). Readers read Script Property `INDEX_REV`, then the
 * `idx:<rev>:*` set. A miss reads Drive without the script lock (`loadIndex`); writers publish under the lock.
 */
export const INDEX_REV_KEY = "INDEX_REV";
export const INDEX_PREFIX = "idx";

type IndexServices = Pick<
  Services,
  "props" | "cache" | "lock" | "store" | "nowMs" | "stats" | "logger"
>;

function cachedIndex(services: IndexServices): IndexDoc | null {
  const rev = services.props.getProperty(INDEX_REV_KEY);
  if (rev === null) return null;
  const text = getChunked(services.cache, INDEX_PREFIX, rev);
  return text === null ? null : (JSON.parse(text) as IndexDoc);
}

/** Sets `INDEX_REV` and puts the chunk set. */
export function publishIndex(services: IndexServices, doc: IndexDoc): void {
  services.props.setProperty(INDEX_REV_KEY, String(doc.rev));
  putIndexChunks(services, doc);
}

/** Puts the chunk set of `doc.rev`. A failed cache put only costs the next reader a Drive read. */
function putIndexChunks(services: IndexServices, doc: IndexDoc): void {
  try {
    putChunked(
      services.cache,
      INDEX_PREFIX,
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

/** Caller holds the script lock. Reads `index.json` and adopts its `rev`, also after a crash between steps 6 and 7. */
export function rebuildIndexLocked(services: IndexServices): IndexDoc {
  const doc = services.store().readIndex();
  publishIndex(services, doc);
  services.stats.cache = "rebuild";
  return doc;
}

/**
 * Index for readers, without the script lock. A miss reads Drive and, when the file's `rev` is the published
 * `INDEX_REV`, puts the `idx:<rev>:*` chunks: every build of one `rev` holds the same text, so a late put is never
 * wrong, only overwritten. Readers never set `INDEX_REV`, so it never goes down; writers, `setup` and `tick` set it
 * under the lock. Any other miss serves the file and leaves the cache to `tick`.
 */
export function loadIndex(services: IndexServices): IndexDoc {
  const hit = cachedIndex(services);
  if (hit !== null) {
    services.stats.cache = "hit";
    return hit;
  }
  const doc = services.store().readIndex();
  if (services.props.getProperty(INDEX_REV_KEY) === String(doc.rev)) {
    putIndexChunks(services, doc);
    services.stats.cache = "rebuild";
  } else {
    services.stats.cache = "miss";
  }
  return doc;
}

/**
 * Index for a writer that holds the lock (save step 4). The cached copy is used only when its `rev` equals the
 * `rev` in the file's appProperties; otherwise the file wins, so a write that bypassed the cache is never lost.
 */
export function loadIndexForWrite(services: IndexServices): IndexDoc {
  const fileRev = services.store().readIndexRev();
  const hit = cachedIndex(services);
  if (hit?.rev === fileRev) {
    services.stats.cache = "hit";
    return hit;
  }
  services.stats.cache = "rebuild";
  return services.store().readIndex();
}
