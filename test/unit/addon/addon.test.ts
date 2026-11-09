import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  onComposeOpen,
  onHomepage,
  onOpenLibrary,
  onPing,
} from "../../../src/addon/entry";
import { pingMessage } from "../../../src/addon/cards/home";
import {
  callServer,
  readResponse,
} from "../../../src/addon/client/serverClient";
import {
  createRecordingCardService,
  createUtilities,
  type RecordedCall,
} from "../../fakes/output";
import { FAKE_OAUTH_TOKEN, createScriptApp } from "../../fakes/scriptApp";
import { createUrlFetchApp, type FakeUrlFetchApp } from "../../fakes/urlFetch";

const EXEC_URL = "https://script.google.com/macros/s/TEST_DEPLOYMENT/exec";
const OK_BODY = JSON.stringify({
  ok: true,
  data: { pong: true, caller: "user@example.com" },
  serverVersion: "test-x",
  durationMs: 7,
});

let fetchApp: FakeUrlFetchApp;
let calls: RecordedCall[];

beforeEach(() => {
  fetchApp = createUrlFetchApp();
  const cards = createRecordingCardService();
  calls = cards.calls;
  vi.stubGlobal("UrlFetchApp", fetchApp);
  vi.stubGlobal("ScriptApp", createScriptApp());
  vi.stubGlobal("Utilities", createUtilities());
  vi.stubGlobal("CardService", cards.service);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function argsOf(method: string): unknown[] {
  return calls
    .filter((call) => call.method === method)
    .map((call) => call.args[0]);
}

describe("callServer", () => {
  it("posts the request with the user's OAuth token to the build-time execUrl", () => {
    fetchApp.respondWith(() => ({ status: 200, body: OK_BODY }));
    expect(callServer("ping", {})).toMatchObject({ ok: true, durationMs: 7 });
    const [request] = fetchApp.requests;
    expect(request?.url).toBe(EXEC_URL);
    expect(request?.params).toMatchObject({
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${FAKE_OAUTH_TOKEN}` },
      muteHttpExceptions: true,
    });
    expect(JSON.parse(request?.params.payload as string)).toEqual({
      op: "ping",
      args: {},
      requestId: "uuid-1",
      clientVersion: "test-testsha",
    });
  });

  it("follows one 302 by hand with a GET and no Authorization header", () => {
    fetchApp.respondWith((request) =>
      request.url === EXEC_URL
        ? {
            status: 302,
            body: "",
            headers: { Location: "https://content.example/echo?key=1" },
          }
        : { status: 200, body: OK_BODY },
    );
    const result = callServer("ping", {});
    expect(result.ok).toBe(true);
    expect(fetchApp.requests).toHaveLength(2);
    const [first, second] = fetchApp.requests;
    expect(first?.params.followRedirects).toBe(false);
    expect(second?.url).toBe("https://content.example/echo?key=1");
    expect(second?.params.method).toBe("get");
    expect(second?.params.headers).toBeUndefined();
  });

  it("reports the first hop status when the server rejects the token", () => {
    fetchApp.respondWith(() => ({ status: 404, body: "" }));
    expect(callServer("ping", {})).toMatchObject({
      ok: false,
      error: { code: "NETWORK", message: "Server returned HTTP 404" },
    });
  });

  it("returns NETWORK when the fetch throws", () => {
    fetchApp.respondWith(() => {
      throw new Error("DNS");
    });
    expect(callServer("ping", {})).toMatchObject({
      ok: false,
      error: { code: "NETWORK", retryable: true },
    });
  });
});

describe("readResponse", () => {
  it.each([
    [403, "", "Server returned HTTP 403"],
    [200, "<html>", "Server reply is not JSON"],
    [200, "{}", "Server reply has an unknown shape"],
  ])("maps status %i body %j to NETWORK", (status, body, message) => {
    expect(readResponse(status, body)).toMatchObject({
      ok: false,
      error: { code: "NETWORK", message },
    });
  });
});

describe("pingMessage", () => {
  it("shows the caller the server identified", () => {
    expect(pingMessage(readResponse(200, OK_BODY))).toBe(
      "Ping ok: server test-x sees user@example.com (7 ms)",
    );
  });

  it("shows unknown when the reply has no caller", () => {
    const body = JSON.stringify({
      ok: true,
      data: null,
      serverVersion: "v",
      durationMs: 1,
    });
    expect(pingMessage(readResponse(200, body))).toContain("sees unknown");
  });

  it("shows the error code on failure", () => {
    const body = JSON.stringify({
      ok: false,
      error: {
        code: "AUTH_NO_USER",
        message: "Cannot identify your account",
        retryable: false,
      },
      serverVersion: "v",
      durationMs: 1,
    });
    expect(pingMessage(readResponse(200, body))).toBe(
      "Ping failed: AUTH_NO_USER. Cannot identify your account",
    );
  });
});

describe("add-on entry points", () => {
  it("compose and homepage show the slice 1 card with a Ping button", () => {
    onComposeOpen();
    onHomepage();
    expect(argsOf("setText")).toEqual([
      "Ping",
      "Diag",
      "Migway Templates, slice 1",
      "Ping",
      "Diag",
      "Migway Templates, slice 1",
    ]);
    expect(argsOf("setFunctionName")).toEqual([
      "onPing",
      "onDiag",
      "onPing",
      "onDiag",
    ]);
  });

  it("Ping shows the server reply as a notification", () => {
    fetchApp.respondWith(() => ({ status: 200, body: OK_BODY }));
    onPing();
    expect(argsOf("setText")).toEqual([
      "Ping ok: server test-x sees user@example.com (7 ms)",
    ]);
  });

  it("Open library opens the web app in an overlay that reloads the add-on", () => {
    onOpenLibrary();
    expect(argsOf("setUrl")).toEqual([EXEC_URL]);
    expect(argsOf("setOpenAs")).toEqual(["OVERLAY"]);
    expect(argsOf("setOnClose")).toEqual(["RELOAD_ADD_ON"]);
  });
});
