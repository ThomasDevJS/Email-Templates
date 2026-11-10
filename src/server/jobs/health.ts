import { toErrorBody } from "../../shared/errors/codes";
import { nowIso, type Services } from "../services";

/** Job health in Script Properties (spec section 16): `job:<name>:lastOk` and `job:<name>:lastError`. */
const ERROR_TEXT_MAX = 500;

export function lastOkKey(name: string): string {
  return `job:${name}:lastOk`;
}

export function lastErrorKey(name: string): string {
  return `job:${name}:lastError`;
}

function describe(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  return `${name}: ${message}`.slice(0, ERROR_TEXT_MAX);
}

/** Writes `job:<name>:lastError` as "<time> <error name>: <message>", cut to 500 characters. */
export function recordJobError(
  services: Pick<Services, "props" | "nowMs">,
  name: string,
  error: unknown,
): void {
  services.props.setProperty(
    lastErrorKey(name),
    `${nowIso(services)} ${describe(error)}`,
  );
}

/**
 * Runs one job and writes one log line. A failure records `lastError` and rethrows, so Apps Script also
 * sends its trigger failure email to the owner.
 */
export function runJob<T>(services: Services, name: string, work: () => T): T {
  const started = services.nowMs();
  const base = { surface: "trigger" as const, action: name };
  try {
    const result = work();
    services.props.setProperty(lastOkKey(name), nowIso(services));
    services.logger.info({
      ...base,
      result: "ok",
      durationMs: services.nowMs() - started,
      cache: services.stats.cache,
    });
    return result;
  } catch (error: unknown) {
    recordJobError(services, name, error);
    services.logger.error({
      ...base,
      result: "error",
      errorCode: toErrorBody(error).code,
      durationMs: services.nowMs() - started,
      cache: services.stats.cache,
      error,
    });
    throw error;
  }
}
