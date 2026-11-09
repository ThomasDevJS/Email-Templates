import type {
  AuditEvent,
  AuditResult,
  AuditSurface,
  AuditTargetType,
} from "../../shared/model/data";
import { utf8Length } from "../../shared/text";

/** `before` and `after` are capped at 40 KB each (ADR-0003 Part D). */
export const AUDIT_VALUE_LIMIT_BYTES = 40 * 1024;

/** Who acts, from where, in which request. Built once per request or job run. */
export interface EventSource {
  readonly actor: string;
  readonly actorRoles: string;
  readonly surface: AuditSurface;
  readonly requestId: string;
  readonly appVersion: string;
  readonly nowIso: () => string;
  readonly newId: () => string;
}

export interface EventFields {
  readonly action: string;
  readonly targetType: AuditTargetType;
  readonly targetId: string;
  readonly targetPath?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly result?: AuditResult;
  readonly errorCode?: string;
  readonly durationMs?: number;
}

export function capValue(value: unknown): unknown {
  if (value === undefined) return null;
  const size = utf8Length(JSON.stringify(value));
  return size <= AUDIT_VALUE_LIMIT_BYTES
    ? value
    : { truncated: true, bytes: size };
}

export function auditEvent(
  source: EventSource,
  fields: EventFields,
): AuditEvent {
  return {
    id: source.newId(),
    ts: source.nowIso(),
    actor: source.actor,
    actorRoles: source.actorRoles,
    surface: source.surface,
    action: fields.action,
    targetType: fields.targetType,
    targetId: fields.targetId,
    targetPath: fields.targetPath ?? "",
    before: capValue(fields.before),
    after: capValue(fields.after),
    result: fields.result ?? "ok",
    errorCode: fields.errorCode ?? "",
    durationMs: fields.durationMs ?? 0,
    requestId: source.requestId,
    appVersion: source.appVersion,
  };
}
