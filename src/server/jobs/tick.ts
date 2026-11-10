import type { AuditEvent } from "../../shared/model/data";
import { utf8Length } from "../../shared/text";
import { clearBuffer, readBuffer, type BufferedEvent } from "../audit/buffer";
import { rollAudit } from "../audit/roll";
import { applyUsage, type ApplyEvent } from "../audit/usage";
import {
  REPUT_AFTER_MS,
  putChunked,
  readChunks,
  readMeta,
} from "../../shared/cache/chunked";
import {
  INDEX_PREFIX,
  INDEX_REV_KEY,
  loadIndex,
  rebuildIndexLocked,
} from "../cache/indexCache";
import { WRITE_LOCK_MS, withLock } from "../lock";
import { MEMBERS_PREFIX, putMembersCache } from "../membership/snapshot";
import type { Services } from "../services";
import { commitLocked } from "../storage/writer";
import { ensureTriggers } from "./triggers";

/** `pendingAudit` above this size is rolled to the month file by `tick`, not only by `daily` (bulk imports). */
export const EARLY_FLUSH_BYTES = 200 * 1024;

export interface TickResult {
  readonly applies: number;
  readonly denied: number;
  readonly rolled: number;
  readonly indexCache: "fresh" | "reput" | "rebuilt";
  readonly membersCache: "fresh" | "reput";
  /** True when this run reinstalled the triggers after a deploy changed `TRIGGERS_VERSION`. */
  readonly triggers: boolean;
}

function applies(events: readonly BufferedEvent[]): ApplyEvent[] {
  return events.flatMap((entry) => (entry.kind === "apply" ? [entry] : []));
}

function denials(events: readonly BufferedEvent[]): AuditEvent[] {
  return events.flatMap((entry) =>
    entry.kind === "denied" ? [entry.event] : [],
  );
}

/** Buffered events to their files under the lock; the buffer is cleared only after both writes. */
function flushBuffer(services: Services): { applies: number; denied: number } {
  return withLock(services.lock, WRITE_LOCK_MS, () => {
    const buffered = readBuffer(services.cache);
    const applied = applies(buffered.events);
    const denied = denials(buffered.events);
    if (applied.length > 0) {
      const store = services.store();
      store.writeSide("usage", applyUsage(store.readSide("usage"), applied));
    }
    if (denied.length > 0) {
      commitLocked(services, (current) => {
        const known = new Set(current.pendingAudit.map((event) => event.id));
        return {
          doc: current,
          events: denied.filter((event) => !known.has(event.id)),
          result: undefined,
        };
      });
    }
    clearBuffer(services.cache, buffered);
    return { applies: applied.length, denied: denied.length };
  });
}

function stale(services: Services, builtAt: number): boolean {
  return services.nowMs() - builtAt > REPUT_AFTER_MS;
}

/**
 * Keeps the index chunk set present and younger than 5 h. Also repairs `INDEX_REV` when it lags the file
 * (crash between save steps 6 and 7) by rebuilding from Drive.
 */
function upkeepIndex(services: Services): TickResult["indexCache"] {
  const fileRev = String(services.store().readIndexRev());
  const meta = readMeta(services.cache, INDEX_PREFIX);
  const text =
    meta?.rev === fileRev &&
    services.props.getProperty(INDEX_REV_KEY) === fileRev
      ? readChunks(services.cache, INDEX_PREFIX, meta)
      : null;
  if (meta === null || text === null) {
    withLock(services.lock, WRITE_LOCK_MS, () => rebuildIndexLocked(services));
    return "rebuilt";
  }
  if (!stale(services, meta.builtAt)) return "fresh";
  putChunked(services.cache, INDEX_PREFIX, fileRev, text, services.nowMs());
  return "reput";
}

function upkeepMembers(services: Services): TickResult["membersCache"] {
  const meta = readMeta(services.cache, MEMBERS_PREFIX);
  const text =
    meta === null ? null : readChunks(services.cache, MEMBERS_PREFIX, meta);
  if (text !== null && meta !== null && !stale(services, meta.builtAt))
    return "fresh";
  putMembersCache(services, services.store().readSide("members"));
  return "reput";
}

function pendingBytes(services: Services): number {
  return utf8Length(JSON.stringify(loadIndex(services).pendingAudit));
}

/** Every 5 min (spec section 16). Also the trigger version check, so add-on-only use after a deploy reinstalls too. */
export function runTick(services: Services): TickResult {
  const flushed = flushBuffer(services);
  const indexCache = upkeepIndex(services);
  const membersCache = upkeepMembers(services);
  const rolled =
    pendingBytes(services) > EARLY_FLUSH_BYTES ? rollAudit(services) : 0;
  const triggers = ensureTriggers(services);
  return { ...flushed, rolled, indexCache, membersCache, triggers };
}
