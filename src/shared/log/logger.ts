/**
 * JSON line logger (spec section 11). One line per request and per trigger run.
 * The field list is closed, so template bodies, prompt values, recipients and tokens have no field to land in.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type Surface = "addon" | "webapp" | "trigger";
export type LogResult = "ok" | "denied" | "conflict" | "error";
export type CacheState = "hit" | "miss" | "rebuild" | "";

export interface LogFields {
  readonly surface: Surface;
  readonly action: string;
  readonly result: LogResult;
  readonly requestId?: string;
  readonly actor?: string;
  readonly targetId?: string;
  readonly errorCode?: string;
  readonly durationMs?: number;
  readonly cache?: CacheState;
  readonly error?: unknown;
}

export interface LogEntry {
  readonly ts: string;
  readonly level: LogLevel;
  readonly requestId: string;
  readonly surface: Surface;
  readonly action: string;
  readonly actor: string;
  readonly targetId: string;
  readonly result: LogResult;
  readonly errorCode: string;
  readonly durationMs: number;
  readonly cache: CacheState;
  readonly appVersion: string;
  readonly errorName?: string;
  readonly stack?: readonly string[];
}

export interface LoggerOptions {
  readonly sink: (line: string) => void;
  readonly now: () => Date;
  readonly appVersion: string;
  readonly minLevel: LogLevel;
}

export type Logger = Readonly<Record<LogLevel, (fields: LogFields) => void>>;

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
const STACK_FRAMES = 3;

export function isLogLevel(value: string): value is LogLevel {
  return Object.prototype.hasOwnProperty.call(LEVEL_RANK, value);
}

/** `LOG_LEVEL` Script Property wins when valid; otherwise prod logs `info` and above, other environments `debug`. */
export function resolveLogLevel(
  configured: string | null,
  env: string,
): LogLevel {
  if (configured !== null && isLogLevel(configured)) return configured;
  return env === "prod" ? "info" : "debug";
}

/** First 3 `at ...` frames of an error stack. */
export function topFrames(stack: string | undefined): string[] {
  if (stack === undefined) return [];
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, STACK_FRAMES);
}

function errorFields(error: unknown): Pick<LogEntry, "errorName" | "stack"> {
  if (!(error instanceof Error)) return {};
  return { errorName: error.name, stack: topFrames(error.stack) };
}

export function buildEntry(
  level: LogLevel,
  fields: LogFields,
  options: LoggerOptions,
): LogEntry {
  return {
    ts: options.now().toISOString(),
    level,
    requestId: fields.requestId ?? "",
    surface: fields.surface,
    action: fields.action,
    actor: fields.actor ?? "",
    targetId: fields.targetId ?? "",
    result: fields.result,
    errorCode: fields.errorCode ?? "",
    durationMs: fields.durationMs ?? 0,
    cache: fields.cache ?? "",
    appVersion: options.appVersion,
    ...errorFields(fields.error),
  };
}

export function createLogger(options: LoggerOptions): Logger {
  const write = (level: LogLevel) => (fields: LogFields) => {
    if (LEVEL_RANK[level] < LEVEL_RANK[options.minLevel]) return;
    options.sink(JSON.stringify(buildEntry(level, fields, options)));
  };
  return {
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
  };
}
