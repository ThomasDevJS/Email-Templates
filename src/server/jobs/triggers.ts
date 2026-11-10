import type { TriggerJob } from "../../shared/entryPoints";
import { recordJobError } from "./health";
import type {
  PropertyStore,
  Services,
  TimeTriggerBuilder,
  TriggerApp,
} from "../services";

/**
 * Time-driven triggers (spec section 16). `setup` installs them; the first web app page load or the next `tick`
 * after a deploy reinstalls them when Script Property `TRIGGERS_VERSION` differs from this constant. Bump it when
 * the set changes.
 */
export const TRIGGERS_VERSION = "1";
export const TRIGGERS_VERSION_KEY = "TRIGGERS_VERSION";
const REINSTALL_LOCK_MS = 10000;

export const SCHEDULES: Readonly<
  Record<TriggerJob, (b: TimeTriggerBuilder) => TimeTriggerBuilder>
> = {
  tick: (b) => b.everyMinutes(5),
  refreshMembers: (b) => b.everyMinutes(15),
  daily: (b) => b.everyDays(1).atHour(2),
};

/** Health key (`job:triggers:lastError`) of a failed reinstall; the Config tab flags it (spec Q23). */
export const TRIGGERS_JOB = "triggers";

/**
 * Creates the 3 jobs, then deletes the triggers that existed before, so a rerun leaves the same set (spec Q23).
 * A failed create deletes the new ones it made and rethrows: the old set keeps running.
 */
export function installTriggers(app: TriggerApp): void {
  const old = app.getProjectTriggers();
  const created: { getUniqueId(): string }[] = [];
  try {
    for (const [handler, schedule] of Object.entries(SCHEDULES))
      created.push(schedule(app.newTrigger(handler).timeBased()).create());
  } catch (error: unknown) {
    for (const trigger of created) app.deleteTrigger(trigger);
    throw error;
  }
  for (const trigger of old) app.deleteTrigger(trigger);
}

/** Installs and records `TRIGGERS_VERSION`; a failure writes the job health error and leaves the version stale. */
export function installAndRecord(
  services: Pick<Services, "triggers" | "props" | "nowMs">,
): void {
  try {
    installTriggers(services.triggers);
  } catch (error: unknown) {
    recordJobError(services, TRIGGERS_JOB, error);
    throw error;
  }
  services.props.setProperty(TRIGGERS_VERSION_KEY, TRIGGERS_VERSION);
}

/**
 * Reinstalls under the script lock when the stored version is stale. Returns true when it reinstalled. The check
 * inside the lock reads `live` (Script Properties read now): a request's once-per-execution copy would miss the
 * reinstall another execution just recorded.
 */
export function ensureTriggers(
  services: Pick<Services, "triggers" | "props" | "lock" | "nowMs">,
  live: PropertyStore = services.props,
): boolean {
  const stale = (props: PropertyStore) =>
    props.getProperty(TRIGGERS_VERSION_KEY) !== TRIGGERS_VERSION;
  if (!stale(services.props) || !services.lock.tryLock(REINSTALL_LOCK_MS))
    return false;
  try {
    if (!stale(live)) return false;
    installAndRecord({
      triggers: services.triggers,
      props: live,
      nowMs: services.nowMs,
    });
    return true;
  } finally {
    services.lock.releaseLock();
  }
}
