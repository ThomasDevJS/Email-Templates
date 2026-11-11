import type { AuditEvent } from "../../shared/model/data";
import { utf8Length } from "../../shared/text";
import { clearBuffer, readBuffer, type BufferedEvent } from "../audit/buffer";
import { auditEvent } from "../audit/events";
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
import {
  CACHED_SIDES,
  SIDE_CACHE,
  publishSide,
  writeSideLocked,
} from "../cache/sideCache";
import { WRITE_LOCK_MS, withLock } from "../lock";
import { MEMBERS_PREFIX, putMembersCache } from "../membership/snapshot";
import type { Services } from "../services";
import { commitLocked } from "../storage/writer";
import { systemSource } from "./daily";
import { ensureTriggers } from "./triggers";

/** `pendingAudit` above this size is rolled to the month file by `tick`, not only by `daily` (bulk imports). */
export const EARLY_FLUSH_BYTES = 200 * 1024;

export interface TickResult {
  readonly applies: number;
  readonly denied: number;
  /** Change events without their own index write (export), moved to `pendingAudit`. */
  readonly changes: number;
  /** Events the full buffer refused since the last run; one `audit.dropped` event records the count. */
  readonly dropped: number;
  readonly rolled: number;
  readonly indexCache: "fresh" | "reput" | "rebuilt";
  readonly membersCache: "fresh" | "reput";
  /** True when this run reinstalled the triggers after a deploy changed `TRIGGERS_VERSION`. */
  readonly triggers: boolean;
}

function applies(events: readonly BufferedEvent[]): ApplyEvent[] {
  return events.flatMap((entry) => (entry.kind === "apply" ? [entry] : []));
}

function rows(
  events: readonly BufferedEvent[],
  kind: "denied" | "change",
): AuditEvent[] {
  return events.flatMap((entry) => (entry.kind === kind ? [entry.event] : []));
}

/** The count of events the full buffer refused, as one audit event; none when nothing was dropped. */
function droppedEvents(services: Services, dropped: number): AuditEvent[] {
  if (dropped === 0) return [];
  return [
    auditEvent(systemSource(services), {
      action: "audit.dropped",
      targetType: "library",
      targetId: "",
      after: { dropped },
      result: "error",
    }),
  ];
}

/** Buffered events to their files under the lock; the buffer is cleared only after both writes. */
function flushBuffer(
  services: Services,
): Pick<TickResult, "applies" | "denied" | "changes" | "dropped"> {
  return withLock(services.lock, WRITE_LOCK_MS, () => {
    const buffered = readBuffer(services.cache);
    const applied = applies(buffered.events);
    const denied = rows(buffered.events, "denied");
    const changes = rows(buffered.events, "change");
    const audit = [
      ...changes,
      ...denied,
      ...droppedEvents(services, buffered.dropped),
    ];
    if (applied.length > 0)
      writeSideLocked(
        services,
        "usage",
        applyUsage(services.store().readSide("usage"), applied),
      );
    if (audit.length > 0) {
      commitLocked(services, (current) => {
        const known = new Set(current.pendingAudit.map((event) => event.id));
        return {
          doc: current,
          events: audit.filter((event) => !known.has(event.id)),
          result: undefined,
        };
      });
    }
    clearBuffer(services.cache, buffered);
    return {
      applies: applied.length,
      denied: denied.length,
      changes: changes.length,
      dropped: buffered.dropped,
    };
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

/** Publishes `favorites.json` and `usage.json` whose rev property is unset (environments set up before slice 5). */
function upkeepSides(services: Services): void {
  for (const name of CACHED_SIDES) {
    if (services.props.getProperty(SIDE_CACHE[name].revKey) !== null) continue;
    withLock(services.lock, WRITE_LOCK_MS, () => {
      publishSide(services, name, services.store().readSide(name));
    });
  }
}

function pendingBytes(services: Services): number {
  return utf8Length(JSON.stringify(loadIndex(services).pendingAudit));
}

/** Every 5 min (spec section 16). Also the trigger version check, so add-on-only use after a deploy reinstalls too. */
export function runTick(services: Services): TickResult {
  const flushed = flushBuffer(services);
  const indexCache = upkeepIndex(services);
  const membersCache = upkeepMembers(services);
  upkeepSides(services);
  const rolled =
    pendingBytes(services) > EARLY_FLUSH_BYTES ? rollAudit(services) : 0;
  const triggers = ensureTriggers(services);
  return { ...flushed, rolled, indexCache, membersCache, triggers };
}
