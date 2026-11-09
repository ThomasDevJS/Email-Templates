import { utf8CharBytes } from "../../shared/text";
import type { CacheStore } from "../services";

/**
 * Chunked values in the Script Cache (ADR-0002 Caching). A set is `<prefix>:<rev>:<n>` chunks of at most 90 KB
 * plus `<prefix>:meta` = `{ rev, chunkCount, builtAt }`. Keys carry `rev`, so a reader never mixes two builds;
 * one missing chunk makes the whole set a miss.
 */
export const CHUNK_BYTES = 90 * 1024;
export const CACHE_TTL_S = 21600;
/** The 5-min trigger re-puts sets older than this, before the 6 h TTL lapses. */
export const REPUT_AFTER_MS = 5 * 60 * 60 * 1000;

export interface ChunkMeta {
  readonly rev: string;
  readonly chunkCount: number;
  readonly builtAt: number;
}

/** Splits text into pieces of at most `maxBytes` UTF-8 bytes, never inside a character. */
export function splitByBytes(text: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  let bytes = 0;
  let index = 0;
  for (const char of text) {
    const size = utf8CharBytes(char.codePointAt(0) ?? 0);
    if (bytes + size > maxBytes) {
      chunks.push(text.slice(start, index));
      start = index;
      bytes = 0;
    }
    bytes += size;
    index += char.length;
  }
  if (index > start || chunks.length === 0) chunks.push(text.slice(start));
  return chunks;
}

export function chunkKey(prefix: string, rev: string, n: number): string {
  return `${prefix}:${rev}:${String(n)}`;
}

export function metaKey(prefix: string): string {
  return `${prefix}:meta`;
}

export function putChunked(
  cache: CacheStore,
  prefix: string,
  rev: string,
  text: string,
  nowMs: number,
): void {
  const chunks = splitByBytes(text, CHUNK_BYTES);
  const values: Record<string, string> = {};
  chunks.forEach((chunk, n) => {
    values[chunkKey(prefix, rev, n)] = chunk;
  });
  const meta: ChunkMeta = { rev, chunkCount: chunks.length, builtAt: nowMs };
  cache.putAll(values, CACHE_TTL_S);
  cache.put(metaKey(prefix), JSON.stringify(meta), CACHE_TTL_S);
}

export function readMeta(cache: CacheStore, prefix: string): ChunkMeta | null {
  const raw = cache.get(metaKey(prefix));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as ChunkMeta;
  } catch {
    return null;
  }
}

/** Whole text of the set named by `meta`, or null when any chunk is gone. One `getAll` round trip. */
export function readChunks(
  cache: CacheStore,
  prefix: string,
  meta: ChunkMeta,
): string | null {
  const keys = Array.from({ length: meta.chunkCount }, (_, n) =>
    chunkKey(prefix, meta.rev, n),
  );
  const found = cache.getAll(keys);
  const parts: string[] = [];
  for (const key of keys) {
    const part = found[key];
    if (part === undefined) return null;
    parts.push(part);
  }
  return parts.join("");
}

/** Text of the current set; with `rev`, only when the meta names that revision. */
export function getChunked(
  cache: CacheStore,
  prefix: string,
  rev?: string,
): string | null {
  const meta = readMeta(cache, prefix);
  if (meta === null || (rev !== undefined && meta.rev !== rev)) return null;
  return readChunks(cache, prefix, meta);
}
