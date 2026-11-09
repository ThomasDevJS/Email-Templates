import { describe, expect, it } from "vitest";
import { createLogger } from "../../../src/shared/log/logger";
import {
  handleRpc,
  type HandleDeps,
} from "../../../src/server/dispatch/handle";

function deps(tables?: HandleDeps["tables"]): {
  lines: string[];
  deps: HandleDeps;
} {
  const lines: string[] = [];
  let clock = 1000;
  const logger = createLogger({
    sink: (line) => lines.push(line),
    now: () => new Date(0),
    appVersion: "test-sha",
    minLevel: "debug",
  });
  const base = { logger, nowMs: () => (clock += 5), serverVersion: "test-sha" };
  return { lines, deps: tables === undefined ? base : { ...base, tables } };
}

const PING = {
  op: "ping",
  args: {},
  requestId: "r1",
  clientVersion: "test-sha",
};

function logged(lines: string[]): Record<string, unknown> {
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0] ?? "") as Record<string, unknown>;
}

describe("handleRpc", () => {
  it("wraps a handler result in the success envelope and logs ok", () => {
    const { lines, deps: d } = deps();
    const response = handleRpc({ email: "user@example.com" }, PING, "addon", d);
    expect(response).toEqual({
      ok: true,
      data: { pong: true, caller: "user@example.com", env: "test" },
      serverVersion: "test-sha",
      durationMs: 5,
    });
    expect(logged(lines)).toMatchObject({
      level: "info",
      action: "ping",
      requestId: "r1",
      result: "ok",
      actor: "user@example.com",
    });
  });

  it("returns AUTH_NO_USER for a blank caller and logs a denial", () => {
    const { lines, deps: d } = deps();
    const response = handleRpc({ email: "" }, PING, "addon", d);
    expect(response).toMatchObject({
      ok: false,
      error: { code: "AUTH_NO_USER", retryable: false },
    });
    expect(logged(lines)).toMatchObject({
      level: "warn",
      result: "denied",
      errorCode: "AUTH_NO_USER",
    });
  });

  it("returns BAD_REQUEST for a malformed body", () => {
    const { lines, deps: d } = deps();
    expect(
      handleRpc({ email: "user@example.com" }, "not json", "addon", d),
    ).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    });
    expect(logged(lines)).toMatchObject({
      action: "",
      requestId: "",
      result: "error",
    });
  });

  it("returns UNKNOWN_OP for an op without a policy row", () => {
    const { deps: d } = deps();
    const response = handleRpc(
      { email: "user@example.com" },
      { ...PING, op: "template.delete" },
      "webapp",
      d,
    );
    expect(response).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_OP" },
    });
  });

  it("turns a handler crash into INTERNAL, logged at error level with the error name", () => {
    const { lines, deps: d } = deps({
      policy: { ping: { requiredLevel: "none" } },
      handlers: {
        ping: () => {
          throw new RangeError("detail that stays in the log");
        },
      },
    });
    const response = handleRpc({ email: "user@example.com" }, PING, "addon", d);
    expect(response).toMatchObject({
      ok: false,
      error: { code: "INTERNAL", message: "Internal error", retryable: true },
    });
    expect(logged(lines)).toMatchObject({
      level: "error",
      errorCode: "INTERNAL",
      errorName: "RangeError",
    });
  });
});
