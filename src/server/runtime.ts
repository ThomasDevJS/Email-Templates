import { APP_VERSION, BUILD_INFO } from "../shared/buildInfo";
import {
  createLogger,
  resolveLogLevel,
  type Logger,
} from "../shared/log/logger";
import type { Caller } from "./dispatch/handlers";
import type { HandleDeps } from "./dispatch/handle";

/** Logger writing JSON lines to the Apps Script execution log. Level from Script Property `LOG_LEVEL`. */
export function serverLogger(): Logger {
  const configured =
    PropertiesService.getScriptProperties().getProperty("LOG_LEVEL");
  return createLogger({
    sink: (line) => {
      console.log(line);
    },
    now: () => new Date(),
    appVersion: APP_VERSION,
    minLevel: resolveLogLevel(configured, BUILD_INFO.env),
  });
}

/** Caller identity from Google's session (ADR-0003 Part A, `CALLER_IDENTITY=active_user`). Blank when unknown. */
export function currentCaller(): Caller {
  return { email: Session.getActiveUser().getEmail() };
}

export function handleDeps(): HandleDeps {
  return {
    logger: serverLogger(),
    nowMs: () => Date.now(),
    serverVersion: APP_VERSION,
  };
}
