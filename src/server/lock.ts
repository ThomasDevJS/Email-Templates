import { AppError, ErrorCode } from "../shared/errors/codes";
import type { ScriptLock } from "./services";

/** Every write waits up to 10 s for the script lock, then returns BUSY (ADR-0002 Concurrency). */
export const WRITE_LOCK_MS = 10000;

export function withLock<T>(
  lock: ScriptLock,
  timeoutMs: number,
  run: () => T,
): T {
  if (!lock.tryLock(timeoutMs))
    throw new AppError(
      ErrorCode.BUSY,
      "The library is busy. Try again in a few seconds.",
    );
  try {
    return run();
  } finally {
    lock.releaseLock();
  }
}
