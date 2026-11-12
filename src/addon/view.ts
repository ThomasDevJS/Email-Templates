import {
  CHUNK_BYTES,
  getChunked,
  metaKey,
  putChunked,
} from "../shared/cache/chunked";
import type { CacheStore } from "../shared/cache/store";
import type { SidebarHome } from "../shared/model/sidebar";
import { utf8Length } from "../shared/text";

/**
 * Add-on User Cache (spec 4.1 step 1, section 10): the caller's sidebar view as `view:*` chunks and one
 * `body:<id>` entry per recently used template. Only add-on code touches it; the server never sees it.
 * The view lives 10 minutes; Open library, Edit, Refresh, DENIED and NOT_FOUND clear it sooner.
 */
export const VIEW_PREFIX = "view";
export const VIEW_TTL_S = 600;
export const BODY_TTL_S = 21600;

export function readView(cache: CacheStore): SidebarHome | null {
  const text = getChunked(cache, VIEW_PREFIX);
  return text === null ? null : (JSON.parse(text) as SidebarHome);
}

export function writeView(
  cache: CacheStore,
  view: SidebarHome,
  nowMs: number,
): void {
  putChunked(
    cache,
    VIEW_PREFIX,
    String(nowMs),
    JSON.stringify(view),
    nowMs,
    VIEW_TTL_S,
  );
}

/** Dropping the meta key makes every chunk unreachable; the chunks expire on their own. */
export function clearView(cache: CacheStore): void {
  cache.removeAll([metaKey(VIEW_PREFIX)]);
}

export interface CachedBody {
  readonly version: number;
  readonly html: string;
  readonly subject: string;
}

const bodyKey = (id: string): string => `body:${id}`;

export function readBody(cache: CacheStore, id: string): CachedBody | null {
  const raw = cache.get(bodyKey(id));
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as Partial<CachedBody>;
  // An entry written before slice 5 has no subject: a miss, so the next call fetches body and subject.
  return typeof parsed.version === "number" &&
    typeof parsed.html === "string" &&
    typeof parsed.subject === "string"
    ? { version: parsed.version, html: parsed.html, subject: parsed.subject }
    : null;
}

/** Bodies over one cache entry (90 KB) are not cached; the next apply sends `knownVersion` 0 and gets the body. */
export function writeBody(
  cache: CacheStore,
  id: string,
  body: CachedBody,
): void {
  const text = JSON.stringify(body);
  if (utf8Length(text) <= CHUNK_BYTES) cache.put(bodyKey(id), text, BODY_TTL_S);
}
