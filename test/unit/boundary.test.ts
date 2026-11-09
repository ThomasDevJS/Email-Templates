/// <reference types="vite/client" />
/**
 * Add-on and server boundary (ADR-0003 Part A). Add-on code runs as the user and must never reach storage,
 * Script Cache, Script Properties or membership services; server code must never use the User Cache.
 * ESLint gives the same errors in the editor; this test keeps them in CI even if a lint rule is disabled inline.
 */
import { describe, expect, it } from "vitest";

const addonSources = import.meta.glob<string>("../../src/addon/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});
const serverSources = import.meta.glob<string>("../../src/server/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});
const sharedSources = import.meta.glob<string>("../../src/shared/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Matches an import or export `from` whose module path has a segment named `segment`, at any depth. */
function importsSegment(segment: string): RegExp {
  return new RegExp(`from\\s+["'](?:[^"']*/)?${segment}(?:/[^"']*)?["']`);
}

const ADDON_FORBIDDEN = [
  importsSegment("server"),
  /\bgetScriptCache\b/,
  /\bgetScriptProperties\b/,
  /\bDrive(App)?\b\s*\./,
  /\bGroupsApp\b/,
  /\bAdminDirectory\b/,
];
const SERVER_FORBIDDEN = [/\bgetUserCache\b/, importsSegment("addon")];
const SHARED_FORBIDDEN = [importsSegment("server"), importsSegment("addon")];

function violations(
  sources: Record<string, string>,
  patterns: readonly RegExp[],
): string[] {
  return Object.entries(sources).flatMap(([file, source]) =>
    patterns
      .filter((pattern) => pattern.test(source))
      .map((pattern) => `${file}: ${String(pattern)}`),
  );
}

describe("ADR-0003 Part A boundary", () => {
  it("finds the source files", () => {
    expect(Object.keys(addonSources).length).toBeGreaterThan(0);
    expect(Object.keys(serverSources).length).toBeGreaterThan(0);
    expect(Object.keys(sharedSources).length).toBeGreaterThan(0);
  });

  it("add-on code does not import server code or touch shared stores", () => {
    expect(violations(addonSources, ADDON_FORBIDDEN)).toEqual([]);
  });

  it("server code does not use the User Cache or import add-on code", () => {
    expect(violations(serverSources, SERVER_FORBIDDEN)).toEqual([]);
  });

  it("shared code imports neither side", () => {
    expect(violations(sharedSources, SHARED_FORBIDDEN)).toEqual([]);
  });

  it("detects a violation", () => {
    expect(
      violations(
        { "x.ts": 'import { a } from "../server/storage/x";' },
        ADDON_FORBIDDEN,
      ),
    ).toHaveLength(1);
    expect(
      violations({ "y.ts": "CacheService.getUserCache()" }, SERVER_FORBIDDEN),
    ).toHaveLength(1);
  });

  it.each([
    'import { a } from "../server";',
    "import { a } from '../../server/dispatch/policy';",
    'export { a } from "server/x";',
    'import type { A } from "../../src/server/entry";',
  ])("catches any path segment named server: %s", (source) => {
    expect(violations({ "x.ts": source }, ADDON_FORBIDDEN)).toHaveLength(1);
  });

  it.each([
    'import { a } from "../shared/serverless";',
    'import { a } from "../observer";',
    'import { a } from "./server-utils";',
  ])("ignores paths without a segment named server: %s", (source) => {
    expect(violations({ "x.ts": source }, ADDON_FORBIDDEN)).toEqual([]);
  });
});
