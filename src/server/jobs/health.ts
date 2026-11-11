import { errorSummary, toErrorBody } from "../../shared/errors/codes";
import { nowIso, type Services } from "../services";

/** Job health in Script Properties (spec section 16): `job:<name>:lastOk` and `job:<name>:lastError`. */
const ERROR_TEXT_MAX = 500;

export function lastOkKey(name: string): string {
  return `job:${name}:lastOk`;
}

export function lastErrorKey(name: string): string {
  return `job:${name}:lastError`;
}

/** A job error whose message the job built from step names and codes only: safe to store, show and rethrow. */
export class JobError extends Error {
  override name = "JobError";
}

/** The message of a `JobError`, else "<code> <error name>"; never a platform message. */
export function jobErrorText(error: unknown): string {
  return (
    error instanceof JobError ? error.message : errorSummary(error)
  ).slice(0, ERROR_TEXT_MAX);
}

/** Writes `job:<name>:lastError` as "<time> <jobErrorText>", cut to 500 characters. */
export function recordJobError(
  services: Pick<Services, "props" | "nowMs">,
  name: string,
  error: unknown,
): void {
  services.props.setProperty(
    lastErrorKey(name),
    `${nowIso(services)} ${jobErrorText(error)}`,
  );
}

/**
 * Runs one job and writes one log line. A success clears `lastError`. A failure records `lastError` and rethrows a
 * `JobError` with the same safe text, so Executions, Cloud Logging and the trigger failure email carry no file text.
 */
export function runJob<T>(services: Services, name: string, work: () => T): T {
  const started = services.nowMs();
  const base = { surface: "trigger" as const, action: name };
  try {
    const result = work();
    services.props.setProperty(lastOkKey(name), nowIso(services));
    services.props.deleteProperty(lastErrorKey(name));
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
    throw error instanceof JobError ? error : new JobError(jobErrorText(error));
  }
}
