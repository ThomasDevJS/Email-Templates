import { optString } from "../dispatch/args";
import type { HandlerContext } from "../dispatch/context";
import { requireStoreIds } from "../storage/setupStore";
import { utf8Length } from "../../shared/text";

/** Spike S2 (ADR-0003 Part A): what the server sees for this call. Admin only. */
export function spikeS2(context: HandlerContext): {
  surface: string;
  tokenCall: boolean;
  activeUser: string;
  effectiveUser: string;
  callerIdentified: boolean;
  driveReachable: boolean;
} {
  const activeUser = context.services.session.activeEmail();
  let driveReachable = true;
  try {
    context.services.store().readIndexRev();
  } catch {
    driveReachable = false;
  }
  return {
    surface: context.surface,
    tokenCall: context.surface === "addon",
    activeUser,
    effectiveUser: context.services.session.effectiveEmail(),
    callerIdentified: activeUser !== "",
    driveReachable,
  };
}

/** ADR-0002 Q17: 0.85 MB read and write each under 2 s keep Drive-only storage. */
export const S2B_THRESHOLD_MS = 2000;
export const S2B_SIZES = { "1x": 870_000, "10x": 8_600_000 } as const;
const ITEM_BYTES = 750;

/** Index-shaped JSON of about `bytes` UTF-8 bytes: one item per 750 bytes, as in the ADR-0002 size estimate. */
export function syntheticIndex(bytes: number): string {
  const filler = "x".repeat(ITEM_BYTES - 120);
  const count = Math.max(1, Math.round(bytes / ITEM_BYTES));
  const items = Array.from({ length: count }, (_, n) => ({
    id: `SPIKE${String(n).padStart(21, "0")}`,
    title: `Spike template ${String(n)}`,
    snippet: filler,
  }));
  return JSON.stringify({
    schemaVersion: 1,
    rev: 1,
    folders: [],
    grants: [],
    items,
    pendingAudit: [],
  });
}

/** True when both texts parse to equal JSON (key order and whitespace may differ after a Drive read). */
function sameJson(a: string, b: string): boolean {
  try {
    return canonical(JSON.parse(a)) === canonical(JSON.parse(b));
  } catch {
    return false;
  }
}

/** JSON text with object keys sorted at every level, so key order never matters. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function timed<T>(nowMs: () => number, run: () => T): { value: T; ms: number } {
  const started = nowMs();
  const value = run();
  return { value, ms: nowMs() - started };
}

/** Spike S2b: create, read and rewrite a generated index file in the data folder, then trash it. Admin only. */
export function spikeS2b(
  context: HandlerContext,
): Record<string, number | boolean | string> {
  const size = optString(context.args, "size") === "10x" ? "10x" : "1x";
  const text = syntheticIndex(S2B_SIZES[size]);
  const drive = context.services.drive();
  const parentId = requireStoreIds(context.services.props).rootId;
  const now = context.services.nowMs;
  const created = timed(now, () =>
    drive.createFile({ name: "spike-s2b.json", parentId, text }),
  );
  try {
    const read = timed(now, () => drive.readText(created.value));
    const written = timed(now, () => {
      drive.updateFile(created.value, text);
    });
    return {
      size,
      bytes: utf8Length(text),
      roundTripOk: read.value === text,
      roundTripSemanticOk: sameJson(read.value, text),
      readLength: read.value.length,
      readHead: read.value.slice(0, 120),
      createMs: created.ms,
      readMs: read.ms,
      writeMs: written.ms,
      thresholdMs: S2B_THRESHOLD_MS,
      readPass: read.ms < S2B_THRESHOLD_MS,
      writePass: written.ms < S2B_THRESHOLD_MS,
    };
  } finally {
    drive.trash(created.value);
  }
}
