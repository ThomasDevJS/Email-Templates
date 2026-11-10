import { beforeEach, describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../../src/shared/errors/codes";
import { ANY_CALLER } from "../../../src/shared/permissions/matrix";
import { handleRpc } from "../../../src/server/dispatch/handle";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const PING = {
  op: "ping",
  args: {},
  requestId: "TESTREQ0-000001",
  clientVersion: "test-sha",
};
let world: World;

beforeEach(() => {
  world = setupWorld();
  world.lines.length = 0;
});

function lastLog(): Record<string, unknown> {
  return JSON.parse(world.lines.at(-1) ?? "{}") as Record<string, unknown>;
}

describe("handleRpc", () => {
  it("wraps a handler result in the success envelope and logs one ok line", () => {
    const response = handleRpc({ email: "user@example.com" }, PING, "addon", {
      services: world.as("addon"),
    });
    expect(response).toMatchObject({
      ok: true,
      data: { pong: true, caller: "user@example.com", env: "test" },
      serverVersion: "test-testsha",
      durationMs: 0,
    });
    expect(world.lines).toHaveLength(1);
    expect(lastLog()).toMatchObject({
      level: "info",
      action: "ping",
      requestId: "TESTREQ0-000001",
      result: "ok",
      cache: "",
    });
  });

  it("returns AUTH_NO_USER for a blank caller and logs a denial", () => {
    expect(
      handleRpc({ email: "" }, PING, "addon", { services: world.services }),
    ).toMatchObject({
      ok: false,
      error: { code: "AUTH_NO_USER", retryable: false },
    });
    expect(lastLog()).toMatchObject({
      level: "warn",
      result: "denied",
      errorCode: "AUTH_NO_USER",
    });
  });

  it("logs AUTH_DOMAIN as a denial", () => {
    handleRpc({ email: "x@other.com" }, PING, "addon", {
      services: world.services,
    });
    expect(lastLog()).toMatchObject({
      result: "denied",
      errorCode: "AUTH_DOMAIN",
    });
  });

  it("returns BAD_REQUEST for a malformed body", () => {
    expect(
      handleRpc({ email: "user@example.com" }, "not json", "addon", {
        services: world.services,
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    });
    expect(lastLog()).toMatchObject({ action: "", result: "error" });
    expect(lastLog()["requestId"]).toMatch(/^[0-9A-Z]{8}-[0-9A-Z]{6}$/);
  });

  it("logs a CONFLICT as result conflict with details in the response", () => {
    const response = handleRpc(
      { email: OWNER },
      { ...PING, op: "boom" },
      "webapp",
      {
        services: world.services,
        tables: {
          policy: { boom: { action: ANY_CALLER, surface: "both" } },
          handlers: {
            boom: () => {
              throw new AppError(ErrorCode.CONFLICT, "stale", {
                currentVersion: 4,
              });
            },
          },
        },
      },
    );
    expect(response).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", details: { currentVersion: 4 } },
    });
    expect(lastLog()).toMatchObject({ level: "warn", result: "conflict" });
  });

  it("turns a handler crash into INTERNAL, logged at error level with the error name", () => {
    const response = handleRpc({ email: "user@example.com" }, PING, "addon", {
      services: world.services,
      tables: {
        policy: { ping: { action: ANY_CALLER, surface: "both" } },
        handlers: {
          ping: () => {
            throw new RangeError("detail that stays out of the response");
          },
        },
      },
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "INTERNAL", message: "Internal error", retryable: true },
    });
    expect(lastLog()).toMatchObject({
      level: "error",
      errorCode: "INTERNAL",
      errorName: "RangeError",
    });
  });

  it("logs the template or folder ID as targetId, and only well-formed IDs", () => {
    const id = "01JC8ABCDEFGHJKMNPQRSTVWXY";
    const target = (args: unknown) => {
      handleRpc({ email: OWNER }, { ...PING, args }, "webapp", {
        services: world.services,
      });
      return lastLog()["targetId"];
    };
    expect(target({ id, folderId: "01JC7ABCDEFGHJKMNPQRSTVWXY" })).toBe(id);
    expect(target({ folderId: id })).toBe(id);
    expect(target({ id: "<p>body text</p>" })).toBe("");
    expect(target("text")).toBe("");
    handleRpc({ email: OWNER }, null, "webapp", { services: world.services });
    expect(lastLog()["targetId"]).toBe("");
  });

  it("reports the cache state of the request in the log line", () => {
    world.cache.removeAll(["idx:meta"]);
    world.call(OWNER, "template.list");
    expect(lastLog()).toMatchObject({
      action: "template.list",
      cache: "rebuild",
    });
    world.call(OWNER, "template.list");
    expect(lastLog()).toMatchObject({ cache: "hit" });
  });

  it("logs the add-on's draft field names and counts (Q21)", () => {
    const draft = { fields: ["threadId", "messageId"], to: 2, cc: 1, bcc: 0 };
    const response = handleRpc({ email: OWNER }, { ...PING, draft }, "addon", {
      services: world.services,
    });
    expect(response.ok).toBe(true);
    expect(lastLog()["draft"]).toEqual({
      fields: ["messageId", "threadId"],
      to: 2,
      cc: 1,
      bcc: 0,
    });
    handleRpc({ email: OWNER }, PING, "addon", { services: world.services });
    expect(lastLog()).not.toHaveProperty("draft");
  });

  it("rejects a draft name outside the fixed list with VALIDATION and logs none of its text", () => {
    const draft = {
      fields: ["threadId", "Dear Bob, the price is 10"],
      to: 1,
      cc: 0,
      bcc: 0,
    };
    const response = handleRpc({ email: OWNER }, { ...PING, draft }, "addon", {
      services: world.services,
    });
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Draft fields must come from the fixed list",
      },
    });
    expect(world.lines).toHaveLength(1);
    expect(lastLog()).toMatchObject({
      result: "error",
      errorCode: "VALIDATION",
    });
    expect(lastLog()).not.toHaveProperty("draft");
    expect(world.lines[0]).not.toContain("Dear Bob");
    expect(world.lines[0]).not.toContain("threadId");
  });
});
