import { AppError, ErrorCode } from "../../shared/errors/codes";
import { reqInt } from "../dispatch/args";

interface Versioned {
  readonly version: number;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

/** `baseVersion` when the client sent one, else null (folder ops make it optional). */
export function optBaseVersion(args: unknown): number | null {
  const record = (args ?? {}) as Record<string, unknown>;
  return record["baseVersion"] === undefined
    ? null
    : reqInt(args, "baseVersion");
}

/** Optimistic check (ADR-0002 Concurrency): a stale `baseVersion` is CONFLICT with the current version, author and time. */
export function checkBaseVersion(
  record: Versioned,
  baseVersion: number | null,
): void {
  if (baseVersion === null || baseVersion === record.version) return;
  throw new AppError(
    ErrorCode.CONFLICT,
    `Changed by ${record.updatedBy} at ${record.updatedAt}.`,
    {
      currentVersion: record.version,
      updatedBy: record.updatedBy,
      updatedAt: record.updatedAt,
    },
  );
}
