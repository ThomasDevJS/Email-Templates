import type { TriggerJob } from "../../shared/entryPoints";
import type { Services, TimeTriggerBuilder, TriggerApp } from "../services";

/**
 * Time-driven triggers (spec section 16). `setup` installs them; the first web app request after a deploy
 * reinstalls them when Script Property `TRIGGERS_VERSION` differs from this constant. Bump it when the set changes.
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

/** Deletes every project trigger and creates the 3 jobs, so a rerun leaves the same set. */
export function installTriggers(app: TriggerApp): void {
  for (const trigger of app.getProjectTriggers()) app.deleteTrigger(trigger);
  for (const [handler, schedule] of Object.entries(SCHEDULES)) {
    schedule(app.newTrigger(handler).timeBased()).create();
  }
}

export function installAndRecord(
  services: Pick<Services, "triggers" | "props">,
): void {
  installTriggers(services.triggers);
  services.props.setProperty(TRIGGERS_VERSION_KEY, TRIGGERS_VERSION);
}

/** Reinstalls under the script lock when the stored version is stale. Returns true when it reinstalled. */
export function ensureTriggers(
  services: Pick<Services, "triggers" | "props" | "lock">,
): boolean {
  const stale = () =>
    services.props.getProperty(TRIGGERS_VERSION_KEY) !== TRIGGERS_VERSION;
  if (!stale() || !services.lock.tryLock(REINSTALL_LOCK_MS)) return false;
  try {
    if (!stale()) return false;
    installAndRecord(services);
    return true;
  } finally {
    services.lock.releaseLock();
  }
}
