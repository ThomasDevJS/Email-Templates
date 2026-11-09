import { describe, expect, it } from "vitest";
import {
  buildEntry,
  createLogger,
  isLogLevel,
  resolveLogLevel,
  topFrames,
  type LoggerOptions,
} from "../../../src/shared/log/logger";

const FIXED = new Date("2026-11-09T14:03:22.120Z");

function capture(minLevel: LoggerOptions["minLevel"] = "debug"): {
  lines: string[];
  options: LoggerOptions;
} {
  const lines: string[] = [];
  return {
    lines,
    options: {
      sink: (line) => lines.push(line),
      now: () => FIXED,
      appVersion: "dev-abc1234",
      minLevel,
    },
  };
}

const SPEC_FIELDS = [
  "ts",
  "level",
  "requestId",
  "surface",
  "action",
  "actor",
  "targetId",
  "result",
  "errorCode",
  "durationMs",
  "cache",
  "appVersion",
];

describe("logger output shape (spec section 11)", () => {
  it("writes one JSON line with exactly the spec fields", () => {
    const { lines, options } = capture();
    createLogger(options).info({
      surface: "addon",
      action: "template.apply",
      result: "ok",
      requestId: "r1",
      actor: "user@example.com",
      targetId: "t1",
      durationMs: 412,
      cache: "hit",
    });
    expect(lines).toHaveLength(1);
    const line = lines[0] ?? "";
    expect(line).not.toContain("\n");
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(Object.keys(entry)).toEqual(SPEC_FIELDS);
    expect(entry).toEqual({
      ts: "2026-11-09T14:03:22.120Z",
      level: "info",
      requestId: "r1",
      surface: "addon",
      action: "template.apply",
      actor: "user@example.com",
      targetId: "t1",
      result: "ok",
      errorCode: "",
      durationMs: 412,
      cache: "hit",
      appVersion: "dev-abc1234",
    });
  });

  it("fills optional fields with empty values", () => {
    const { options } = capture();
    const entry = buildEntry(
      "warn",
      { surface: "trigger", action: "tick", result: "ok" },
      options,
    );
    expect(entry).toMatchObject({
      requestId: "",
      actor: "",
      targetId: "",
      errorCode: "",
      durationMs: 0,
      cache: "",
    });
  });

  it("adds errorName and the first 3 stack frames for errors", () => {
    const { options } = capture();
    const error = new TypeError("boom");
    error.stack =
      "TypeError: boom\n    at a (x.js:1)\n    at b (x.js:2)\n    at c (x.js:3)\n    at d (x.js:4)";
    const entry = buildEntry(
      "error",
      { surface: "webapp", action: "ping", result: "error", error },
      options,
    );
    expect(entry.errorName).toBe("TypeError");
    expect(entry.stack).toEqual([
      "at a (x.js:1)",
      "at b (x.js:2)",
      "at c (x.js:3)",
    ]);
  });

  it("ignores non-Error thrown values", () => {
    const { options } = capture();
    const entry = buildEntry(
      "error",
      { surface: "webapp", action: "ping", result: "error", error: "text" },
      options,
    );
    expect(entry).not.toHaveProperty("errorName");
  });

  it("drops lines below the minimum level", () => {
    const { lines, options } = capture("info");
    const logger = createLogger(options);
    logger.debug({ surface: "webapp", action: "a", result: "ok" });
    logger.info({ surface: "webapp", action: "b", result: "ok" });
    logger.warn({ surface: "webapp", action: "c", result: "denied" });
    logger.error({ surface: "webapp", action: "d", result: "error" });
    expect(
      lines.map((line) => (JSON.parse(line) as { action: string }).action),
    ).toEqual(["b", "c", "d"]);
  });
});

describe("log level helpers", () => {
  it("returns no frames for a missing stack", () => {
    expect(topFrames(undefined)).toEqual([]);
  });

  it("recognises the 4 levels only", () => {
    expect(["debug", "info", "warn", "error"].every(isLogLevel)).toBe(true);
    expect(isLogLevel("trace")).toBe(false);
    expect(isLogLevel("toString")).toBe(false);
  });

  it("uses LOG_LEVEL when valid, else info in prod and debug elsewhere", () => {
    expect(resolveLogLevel("warn", "prod")).toBe("warn");
    expect(resolveLogLevel(null, "prod")).toBe("info");
    expect(resolveLogLevel("loud", "prod")).toBe("info");
    expect(resolveLogLevel(null, "dev")).toBe("debug");
  });
});
