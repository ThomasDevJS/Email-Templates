/**
 * In-memory ScriptApp with time-driven triggers. Models the limit of 20 triggers per user per script [R4 S2].
 * `getOAuthToken` returns a fixed placeholder string, never a real token.
 */
export const TRIGGER_LIMIT = 20;
export const FAKE_OAUTH_TOKEN = "fake-oauth-token";

export interface FakeTrigger {
  readonly id: string;
  readonly handler: string;
  readonly schedule: string;
  getUniqueId(): string;
  getHandlerFunction(): string;
}

class TimeTriggerBuilder {
  private schedule = "";

  constructor(
    private readonly handler: string,
    private readonly install: (
      handler: string,
      schedule: string,
    ) => FakeTrigger,
  ) {}

  everyMinutes(n: number): this {
    this.schedule = `every ${String(n)} min`;
    return this;
  }

  everyHours(n: number): this {
    this.schedule = `every ${String(n)} h`;
    return this;
  }

  everyDays(n: number): this {
    this.schedule = `every ${String(n)} d`;
    return this;
  }

  atHour(hour: number): this {
    this.schedule = `${this.schedule} at ${String(hour)}h`;
    return this;
  }

  create(): FakeTrigger {
    return this.install(this.handler, this.schedule);
  }
}

export interface FakeScriptApp {
  readonly triggers: FakeTrigger[];
  newTrigger(handler: string): { timeBased(): TimeTriggerBuilder };
  getProjectTriggers(): FakeTrigger[];
  deleteTrigger(trigger: FakeTrigger): void;
  getOAuthToken(): string;
}

export function createScriptApp(): FakeScriptApp {
  const triggers: FakeTrigger[] = [];
  let nextId = 1;
  const install = (handler: string, schedule: string): FakeTrigger => {
    if (triggers.length >= TRIGGER_LIMIT)
      throw new Error("This script has too many triggers.");
    const id = `trigger-${String(nextId++)}`;
    const trigger = {
      id,
      handler,
      schedule,
      getUniqueId: () => id,
      getHandlerFunction: () => handler,
    };
    triggers.push(trigger);
    return trigger;
  };
  return {
    triggers,
    newTrigger: (handler) => ({
      timeBased: () => new TimeTriggerBuilder(handler, install),
    }),
    getProjectTriggers: () => [...triggers],
    deleteTrigger(trigger) {
      const index = triggers.findIndex(
        (candidate) => candidate.id === trigger.id,
      );
      if (index >= 0) triggers.splice(index, 1);
    },
    getOAuthToken: () => FAKE_OAUTH_TOKEN,
  };
}
