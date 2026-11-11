import { getChunked, putChunked } from "../../shared/cache/chunked";
import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { AuditEvent, AuditResult } from "../../shared/model/data";
import { PRINCIPAL_KEY_MAX } from "../../shared/model/validate";
import {
  AUDIT_PAGE_SIZE,
  AUDIT_RESULTS,
  auditPage,
  mergeMonth,
  parseLines,
  type AuditFilter,
  type AuditRow,
} from "../audit/query";
import { monthOf } from "../audit/lines";
import { loadIndex } from "../cache/indexCache";
import { optInt, optString } from "../dispatch/args";
import type { HandlerContext } from "../dispatch/context";
import { nowIso, type Services } from "../services";

/**
 * `audit.query` (admin, wireframe 06 Audit log). One month: `audit/<YYYY-MM>.jsonl` plus `pendingAudit` (events
 * not yet rolled by `daily`). Drive per call: one `files.list` of the audit folder and, on a cache miss, one read
 * of the month file; the text is cached as `aud:<month>` chunks keyed by file ID and size, so an append misses.
 * With `id` the op returns that one event with `before` and `after` for the details drawer.
 */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_FILE = /^(\d{4}-\d{2})\.jsonl$/;
const ACTION_MAX = 100;
const TARGET_MAX = 200;
const INSTANT_MAX = 40;

function invalid(message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message);
}

function bounded(args: unknown, field: string, max: number): string {
  const value = optString(args, field).trim();
  if (value.length > max)
    throw invalid(`${field} must be ${String(max)} characters or fewer`);
  return value;
}

function instant(args: unknown, field: string): string {
  const value = bounded(args, field, INSTANT_MAX);
  if (value === "") return "";
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw invalid(`${field} must be a date and time`);
  return new Date(ms).toISOString();
}

function resultArg(args: unknown): AuditResult | "" {
  const value = optString(args, "result");
  if (value === "") return "";
  const found = AUDIT_RESULTS.find((result) => result === value);
  if (found === undefined)
    throw invalid("result must be ok, denied, conflict or error");
  return found;
}

function monthArg(context: HandlerContext): string {
  const value = optString(context.args, "month");
  if (value === "") return monthOf(nowIso(context.services));
  if (!MONTH.test(value)) throw invalid("month must have the form YYYY-MM");
  return value;
}

export function auditFilter(args: unknown): AuditFilter {
  return {
    from: instant(args, "from"),
    to: instant(args, "to"),
    actor: bounded(args, "actor", PRINCIPAL_KEY_MAX),
    action: bounded(args, "action", ACTION_MAX),
    result: resultArg(args),
    target: bounded(args, "target", TARGET_MAX),
  };
}

/** Month file text through the Script Cache; a failed put only costs the next call one Drive read. */
function monthText(
  services: Services,
  month: string,
  file: { id: string; size: number },
): string {
  const prefix = `aud:${month}`;
  const rev = `${file.id}.${String(file.size)}`;
  const cached = getChunked(services.cache, prefix, rev);
  if (cached !== null) return cached;
  const text = services.store().readText(file.id);
  try {
    putChunked(services.cache, prefix, rev, text, services.nowMs());
  } catch {
    // Over the cache limits: the next call reads Drive again.
  }
  return text;
}

interface MonthData {
  readonly events: AuditEvent[];
  readonly months: string[];
}

function readMonth(context: HandlerContext, month: string): MonthData {
  const { services } = context;
  const pending = loadIndex(services).pendingAudit;
  const files = services.store().listAuditFiles();
  const file = files.find((entry) => entry.name === `${month}.jsonl`);
  const fileEvents =
    file === undefined ? [] : parseLines(monthText(services, month, file));
  const months = new Set([
    monthOf(nowIso(services)),
    ...files.flatMap((entry) => MONTH_FILE.exec(entry.name)?.slice(1) ?? []),
    ...pending.map((event) => monthOf(event.ts)),
  ]);
  return {
    events: mergeMonth(month, fileEvents, pending),
    months: [...months].sort().reverse(),
  };
}

export interface AuditQueryResult {
  readonly month: string;
  readonly months: string[];
  readonly actions: string[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly rows: AuditRow[];
}

export function auditQuery(
  context: HandlerContext,
): AuditQueryResult | { event: AuditEvent } {
  const month = monthArg(context);
  const id = bounded(context.args, "id", ACTION_MAX);
  const filter = id === "" ? auditFilter(context.args) : null;
  const page = optInt(context.args, "page");
  const data = readMonth(context, month);
  if (filter === null) {
    const event = data.events.find((entry) => entry.id === id);
    if (event === undefined)
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "This audit entry was not found. Reload the list.",
      );
    return { event };
  }
  return {
    month,
    months: data.months,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    ...auditPage(data.events, filter, page),
  };
}
