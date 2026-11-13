import { beforeEach, describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../../src/shared/errors/codes";
import { ANY_CALLER } from "../../../src/shared/permissions/matrix";
import { readBuffer } from "../../../src/server/audit/buffer";
import { handleRpc } from "../../../src/server/dispatch/handle";
import { POLICY } from "../../../src/server/dispatch/policy";
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
    const response = handleRpc({ email: "user@example.com" }, PING, "doPost", {
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
      handleRpc({ email: "" }, PING, "doPost", { services: world.services }),
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
    handleRpc({ email: "x@other.com" }, PING, "doPost", {
      services: world.services,
    });
    expect(lastLog()).toMatchObject({
      result: "denied",
      errorCode: "AUTH_DOMAIN",
    });
  });

  it("returns BAD_REQUEST for a malformed body", () => {
    expect(
      handleRpc({ email: "user@example.com" }, "not json", "doPost", {
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
      "rpc",
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
    const response = handleRpc({ email: "user@example.com" }, PING, "doPost", {
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
      handleRpc({ email: OWNER }, { ...PING, args }, "rpc", {
        services: world.services,
      });
      return lastLog()["targetId"];
    };
    expect(target({ id, folderId: "01JC7ABCDEFGHJKMNPQRSTVWXY" })).toBe(id);
    expect(target({ folderId: id })).toBe(id);
    expect(target({ id: "<p>body text</p>" })).toBe("");
    expect(target("text")).toBe("");
    handleRpc({ email: OWNER }, null, "rpc", { services: world.services });
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

  it("logs the add-on's draft field names, counts and hasSubject", () => {
    const draft = {
      fields: ["threadId", "messageId"],
      to: 2,
      cc: 1,
      bcc: 0,
      hasSubject: true,
    };
    const response = handleRpc({ email: OWNER }, { ...PING, draft }, "doPost", {
      services: world.services,
    });
    expect(response.ok).toBe(true);
    expect(lastLog()["draft"]).toEqual({
      fields: ["messageId", "threadId"],
      to: 2,
      cc: 1,
      bcc: 0,
      hasSubject: true,
    });
    handleRpc({ email: OWNER }, PING, "doPost", { services: world.services });
    expect(lastLog()).not.toHaveProperty("draft");
  });

  it("rejects a draft name outside the fixed list with VALIDATION and logs none of its text", () => {
    const draft = {
      fields: ["threadId", "Dear Bob, the price is 10"],
      to: 1,
      cc: 0,
      bcc: 0,
      hasSubject: false,
    };
    const response = handleRpc({ email: OWNER }, { ...PING, draft }, "doPost", {
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

describe("handleRpc: client label (D41, spec 5.11, slice 30)", () => {
  const CLIENT_TEXT = "Client must come from the fixed list";

  function deniedEvents() {
    return readBuffer(world.cache).events.flatMap((entry) =>
      entry.kind === "denied" ? [entry.event] : [],
    );
  }

  function post(raw: Record<string, unknown>, entry: "doPost" | "rpc") {
    return handleRpc({ email: OWNER }, raw, entry, {
      services: world.services,
    });
  }

  it("labels a doPost call without client as addon", () => {
    expect(post(PING, "doPost").ok).toBe(true);
    expect(lastLog()).toMatchObject({ surface: "addon", result: "ok" });
  });

  it("labels doPost log lines and denied rows extension when client is extension", () => {
    expect(post({ ...PING, client: "extension" }, "doPost").ok).toBe(true);
    expect(lastLog()).toMatchObject({ surface: "extension", result: "ok" });
    const response = post(
      {
        ...PING,
        op: "folder.create",
        args: { name: "X" },
        client: "extension",
      },
      "doPost",
    );
    expect(response).toMatchObject({ ok: false, error: { code: "DENIED" } });
    expect(lastLog()).toMatchObject({ surface: "extension", result: "denied" });
    expect(deniedEvents().at(-1)).toMatchObject({
      action: "folder.create",
      surface: "extension",
    });
  });

  it.each<[string, unknown]>([
    ["Extension", "Extension"],
    ["empty", ""],
    ["null", null],
    ["number", 1],
    ["list", ["extension"]],
    ["webapp", "webapp"],
    ["trigger", "trigger"],
    ["object", { name: "extension" }],
    ["long text", "Dear Bob, the price is 10"],
  ])(
    "answers VALIDATION to a %s client and logs none of it",
    (_name, client) => {
      const response = post({ ...PING, client }, "doPost");
      expect(response).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", message: CLIENT_TEXT },
      });
      expect(world.lines).toHaveLength(1);
      expect(lastLog()).toMatchObject({
        surface: "addon",
        result: "error",
        errorCode: "VALIDATION",
      });
      expect(lastLog()).not.toHaveProperty("client");
      expect(world.lines[0]).not.toContain("Dear Bob");
      expect(world.lines[0]).not.toContain("Extension");
      expect(deniedEvents()).toHaveLength(0);
    },
  );

  it.each<[string, unknown]>([
    ["absent", undefined],
    ["addon", "addon"],
    ["extension", "extension"],
    ["bad", "Extension"],
  ])("labels rpc webapp and ignores a %s client", (_name, client) => {
    const raw = client === undefined ? PING : { ...PING, client };
    expect(post(raw, "rpc").ok).toBe(true);
    expect(lastLog()).toMatchObject({ surface: "webapp", result: "ok" });
  });

  const WEB_OPS = Object.entries(POLICY)
    .filter(([, row]) => row.surface === "web")
    .map(([op]) => op);

  it("finds web rows in the live policy table", () => {
    expect(WEB_OPS.length).toBeGreaterThan(20);
  });

  it.each(WEB_OPS)(
    "denies web op %s on doPost for client extension, then addon, as admin",
    (op) => {
      for (const client of ["extension", "addon"]) {
        const before = deniedEvents().length;
        const response = post({ ...PING, op, client }, "doPost");
        expect(response).toMatchObject({
          ok: false,
          error: { code: "DENIED" },
        });
        expect(deniedEvents()).toHaveLength(before + 1);
        expect(deniedEvents().at(-1)).toMatchObject({
          action: op,
          surface: client,
          result: "denied",
        });
      }
    },
  );
});
