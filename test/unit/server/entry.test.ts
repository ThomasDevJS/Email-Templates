import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  daily,
  doGet,
  doPost,
  refreshMembers,
  rpc,
  setup,
  tick,
} from "../../../src/server/entry";
import {
  createPropertiesService,
  type FakePropertiesService,
} from "../../fakes/properties";
import {
  createContentService,
  createHtmlService,
  createUtilities,
  type FakeHtmlOutput,
  type FakeTextOutput,
} from "../../fakes/output";
import { createSession, type FakeSession } from "../../fakes/session";

let session: FakeSession;
let properties: FakePropertiesService;
let lines: string[];

beforeEach(() => {
  session = createSession("user@example.com");
  properties = createPropertiesService();
  lines = [];
  vi.stubGlobal("Session", session);
  vi.stubGlobal("PropertiesService", properties);
  vi.stubGlobal("HtmlService", createHtmlService());
  vi.stubGlobal("ContentService", createContentService());
  vi.stubGlobal("Utilities", createUtilities());
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lastLog(): Record<string, unknown> {
  return JSON.parse(lines.at(-1) ?? "{}") as Record<string, unknown>;
}

function post(body: string): {
  status: Record<string, unknown>;
  output: FakeTextOutput;
} {
  const event = {
    postData: { contents: body },
  } as unknown as GoogleAppsScript.Events.DoPost;
  const output = doPost(event) as unknown as FakeTextOutput;
  return {
    status: JSON.parse(output.content) as Record<string, unknown>,
    output,
  };
}

describe("doGet", () => {
  it("serves the index template with the caller email", () => {
    const page = doGet() as unknown as FakeHtmlOutput;
    expect(page.content).toBe("template:index");
    expect(page.title).toBe("Migway Templates");
    expect(page.templateValues).toEqual({
      email: "user@example.com",
      appVersion: "test-testsha",
    });
    expect(lastLog()).toMatchObject({
      action: "web.open",
      result: "ok",
      actor: "user@example.com",
    });
  });

  it("serves the Cannot identify page when the caller email is blank", () => {
    session.activeEmail = "";
    const page = doGet() as unknown as FakeHtmlOutput;
    expect(page.title).toBe("Cannot identify your account");
    expect(page.content).toContain("Cannot identify your Migway account.");
    expect(page.content).toContain("separate Chrome profile");
    expect(lastLog()).toMatchObject({
      result: "denied",
      errorCode: "AUTH_NO_USER",
    });
  });
});

describe("doPost", () => {
  it("answers ping with the JSON envelope", () => {
    const { status, output } = post(
      JSON.stringify({
        op: "ping",
        args: {},
        requestId: "r1",
        clientVersion: "x",
      }),
    );
    expect(output.mimeType).toBe("application/json");
    expect(status).toMatchObject({
      ok: true,
      data: { pong: true, caller: "user@example.com" },
      serverVersion: "test-testsha",
    });
    expect(typeof status["durationMs"]).toBe("number");
    expect(lastLog()).toMatchObject({
      surface: "addon",
      action: "ping",
      requestId: "r1",
    });
  });

  it("denies a blank active user with AUTH_NO_USER", () => {
    session.activeEmail = "";
    const { status } = post(
      JSON.stringify({
        op: "ping",
        args: {},
        requestId: "r1",
        clientVersion: "x",
      }),
    );
    expect(status).toMatchObject({
      ok: false,
      error: { code: "AUTH_NO_USER" },
    });
  });

  it("returns BAD_REQUEST for a body that is not JSON", () => {
    expect(post("{").status).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    });
  });

  it("returns BAD_REQUEST when the event has no body", () => {
    const output = doPost(
      undefined as unknown as GoogleAppsScript.Events.DoPost,
    ) as unknown as FakeTextOutput;
    expect(JSON.parse(output.content)).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    });
  });
});

describe("rpc", () => {
  it("dispatches with a server-assigned request ID", () => {
    expect(rpc("ping", {})).toMatchObject({ ok: true, data: { pong: true } });
    expect(lastLog()).toMatchObject({ surface: "webapp", requestId: "uuid-1" });
  });

  it("rejects a non-string op", () => {
    expect(rpc(42, {})).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    });
  });
});

describe("trigger stubs", () => {
  it.each([
    ["setup", setup],
    ["tick", tick],
    ["refreshMembers", refreshMembers],
    ["daily", daily],
  ] as const)("%s logs one JSON line", (name, run) => {
    run();
    expect(lines).toHaveLength(1);
    expect(lastLog()).toMatchObject({
      surface: "trigger",
      action: name,
      result: "ok",
    });
  });

  it("honours LOG_LEVEL from Script Properties", () => {
    properties.script.setProperty("LOG_LEVEL", "error");
    tick();
    expect(lines).toHaveLength(0);
  });
});
