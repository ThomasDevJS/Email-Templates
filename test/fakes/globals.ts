/**
 * Installs the fakes of a `World` as Apps Script globals, so entry points (which build their services from
 * globals in runtime.ts) run against the same fake Drive, cache, properties, lock, triggers and session.
 */
import { vi } from "vitest";
import { driveRestResponder } from "./drive";
import {
  createContentService,
  createHtmlService,
  createUtilities,
} from "./output";
import { createUrlFetchApp, type FakeUrlFetchApp } from "./urlFetch";
import { createWorld, OWNER, type World } from "./world";

export interface GlobalWorld extends World {
  readonly fetchApp: FakeUrlFetchApp;
}

export function installGlobals(world: World = createWorld()): GlobalWorld {
  const fetchApp = createUrlFetchApp();
  // Drive REST by default: the Advanced client reads JSON Lines through UrlFetch. Tests may replace it.
  fetchApp.respondWith(driveRestResponder(world.drive));
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => world.props,
  });
  vi.stubGlobal("CacheService", { getScriptCache: () => world.cache });
  vi.stubGlobal("LockService", { getScriptLock: () => world.lock });
  vi.stubGlobal("Session", {
    getActiveUser: () => ({ getEmail: () => world.session.active }),
    getEffectiveUser: () => ({ getEmail: () => world.session.effective }),
  });
  vi.stubGlobal("ScriptApp", {
    ...world.scriptApp,
    getOAuthToken: () => "fake-token",
  });
  vi.stubGlobal("Drive", { Files: world.drive.Files });
  vi.stubGlobal("GroupsApp", world.groups);
  vi.stubGlobal("AdminDirectory", { Users: world.directory });
  vi.stubGlobal("Utilities", createUtilities());
  vi.stubGlobal("UrlFetchApp", fetchApp);
  vi.stubGlobal("HtmlService", createHtmlService());
  vi.stubGlobal("ContentService", createContentService());
  world.session.active = OWNER;
  world.session.effective = OWNER;
  return { ...world, fetchApp };
}
