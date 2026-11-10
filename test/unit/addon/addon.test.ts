import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as addon from "../../../src/addon/entry";
import { CALLBACKS } from "../../../src/addon/cards/spec";
import {
  callServer,
  readResponse,
} from "../../../src/addon/client/serverClient";
import { readView, writeView } from "../../../src/addon/view";
import type { SidebarHome } from "../../../src/shared/model/sidebar";
import { FakeCache } from "../../fakes/cache";
import {
  createRecordingCardService,
  createUtilities,
  type RecordedCall,
} from "../../fakes/output";
import { FAKE_OAUTH_TOKEN, createScriptApp } from "../../fakes/scriptApp";
import { createSession, type FakeSession } from "../../fakes/session";
import { createUrlFetchApp, type FakeUrlFetchApp } from "../../fakes/urlFetch";

const EXEC_URL = "https://script.google.com/macros/s/TEST_DEPLOYMENT/exec";
const USER = "user@example.com";

let fetchApp: FakeUrlFetchApp;
let calls: RecordedCall[];
let session: FakeSession;
let cache: FakeCache;
let now: number;

const HOME: SidebarHome = {
  folders: [{ id: "F1", name: "Sales", parentId: "", count: 1 }],
  subfolders: [],
  templates: [
    {
      id: "T1",
      folderId: "F1",
      title: "Welcome",
      subject: "",
      snippet: "Hi",
      version: 2,
      prompts: [],
      level: "use",
    },
  ],
  favorites: [],
  recent: [],
};

function ok(data: unknown): string {
  return JSON.stringify({
    ok: true,
    data,
    serverVersion: "test-x",
    durationMs: 7,
  });
}

/** Answers each op from `data`; records ops in order. */
function serve(data: Record<string, unknown>): string[] {
  const ops: string[] = [];
  fetchApp.respondWith((request) => {
    const op = (JSON.parse(request.params.payload as string) as { op: string })
      .op;
    ops.push(op);
    return { status: 200, body: ok(data[op]) };
  });
  return ops;
}

beforeEach(() => {
  now = Date.parse("2026-11-09T12:00:00Z");
  vi.useFakeTimers({ now, toFake: ["Date"] });
  fetchApp = createUrlFetchApp();
  const cards = createRecordingCardService();
  calls = cards.calls;
  cache = new FakeCache(() => Date.now());
  vi.stubGlobal("UrlFetchApp", fetchApp);
  vi.stubGlobal("ScriptApp", createScriptApp());
  vi.stubGlobal("Utilities", createUtilities());
  vi.stubGlobal("CardService", cards.service);
  vi.stubGlobal("CacheService", { getUserCache: () => cache });
  session = createSession(USER, USER);
  vi.stubGlobal("Session", session);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function argsOf(method: string): unknown[] {
  return calls
    .filter((call) => call.method === method)
    .map((call) => call.args[0]);
}

/** One request ID format on both surfaces (spec section 11). */
const REQUEST_ID = /^[0-9A-Z]{8}-[0-9A-Z]{6}$/;

describe("callServer", () => {
  it("posts the request with the user's OAuth token and returns the request ID", () => {
    fetchApp.respondWith(() => ({ status: 200, body: ok({ pong: true }) }));
    const call = callServer("ping", {});
    expect(call).toMatchObject({ response: { ok: true, durationMs: 7 } });
    expect(call.requestId).toMatch(REQUEST_ID);
    const [request] = fetchApp.requests;
    expect(request?.url).toBe(EXEC_URL);
    expect(request?.params).toMatchObject({
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${FAKE_OAUTH_TOKEN}` },
      muteHttpExceptions: true,
    });
    const payload = JSON.parse(request?.params.payload as string) as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      op: "ping",
      args: {},
      requestId: call.requestId,
      clientVersion: "test-testsha",
    });
    expect(Object.keys(payload["timing"] as object).sort()).toEqual(
      expect.arrayContaining(["addonPreMs", "addonTokenMs"]),
    );
  });

  it("sends the previous call's fetch and total times with the next call", () => {
    fetchApp.respondWith(() => ({ status: 200, body: ok(null) }));
    callServer("ping", {});
    callServer("ping", {});
    const timing = (
      JSON.parse(fetchApp.requests.at(-1)?.params.payload as string) as {
        timing: Record<string, number>;
      }
    ).timing;
    expect(Object.keys(timing).sort()).toEqual([
      "addonPreMs",
      "addonTokenMs",
      "prevFetchMs",
      "prevTotalMs",
    ]);
    for (const value of Object.values(timing))
      expect(Number.isInteger(value)).toBe(true);
  });

  it("follows one 302 by hand with a GET and no Authorization header", () => {
    fetchApp.respondWith((request) =>
      request.url === EXEC_URL
        ? {
            status: 302,
            body: "",
            headers: { Location: "https://content.example/echo?key=1" },
          }
        : { status: 200, body: ok(null) },
    );
    expect(callServer("ping", {}).response.ok).toBe(true);
    const [first, second] = fetchApp.requests;
    expect(first?.params.followRedirects).toBe(false);
    expect(second?.url).toBe("https://content.example/echo?key=1");
    expect(second?.params.method).toBe("get");
    expect(second?.params.headers).toBeUndefined();
  });

  it("reports the status of a failed redirect hop", () => {
    fetchApp.respondWith((request) =>
      request.url === EXEC_URL
        ? { status: 302, body: "", headers: { location: "https://c.example/" } }
        : { status: 500, body: "" },
    );
    expect(callServer("ping", {}).response).toMatchObject({
      ok: false,
      error: { code: "NETWORK", message: "Server returned HTTP 500" },
    });
  });

  it("returns NETWORK when the fetch throws", () => {
    fetchApp.respondWith(() => {
      throw new Error("DNS");
    });
    expect(callServer("ping", {}).response).toMatchObject({
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

describe("add-on entry points", () => {
  it("sends the event's draft field names and counts with every call, never values (Q21)", () => {
    serve({ "sidebar.home": HOME });
    addon.onComposeOpen({
      gmail: {
        threadId: "thread-secret",
        toRecipients: ["bob@example.com"],
      },
    });
    const payload = fetchApp.requests[0]?.params.payload as string;
    expect((JSON.parse(payload) as { draft: unknown }).draft).toEqual({
      fields: ["threadId", "toRecipients"],
      to: 1,
      cc: 0,
      bcc: 0,
    });
    expect(payload).not.toContain("thread-secret");
    expect(payload).not.toContain("bob@example.com");
  });

  it("compose and homepage load sidebar.home once, then read the User Cache", () => {
    const ops = serve({ "sidebar.home": HOME });
    addon.onComposeOpen();
    addon.onHomepage();
    expect(ops).toEqual(["sidebar.home"]);
    expect(argsOf("setTitle")).toEqual([
      "Migway Templates",
      "Search templates",
      "Migway Templates",
      "Search templates",
    ]);
    expect(argsOf("setText")).toContain("Sales (1)");
    expect(argsOf("build")).toHaveLength(2);
  });

  it("Insert returns UpdateDraftActionResponse with IN_PLACE_INSERT and MUTABLE_HTML", () => {
    serve({
      "template.apply": {
        id: "T1",
        title: "Welcome",
        version: 2,
        html: "<p>Hi {{recipient.first_name|there}}</p>",
        subject: "Welcome {{recipient.first_name|aboard}}",
        sender: { name: "", title: "", phone: "", department: "" },
        recipientFirstName: "",
      },
    });
    addon.onInsert({ commonEventObject: { parameters: { id: "T1" } } });
    expect(calls.find((c) => c.method === "addUpdateContent")?.args).toEqual([
      "<p>Hi there</p>",
      "MUTABLE_HTML",
    ]);
    expect(argsOf("setUpdateType")).toEqual(["IN_PLACE_INSERT"]);
    expect(argsOf("setUpdateDraftBodyAction")).toHaveLength(1);
    expect(argsOf("addUpdateSubject")).toEqual(["Welcome aboard"]);
    expect(argsOf("setUpdateDraftSubjectAction")).toHaveLength(1);
  });

  it("a QUOTA Retry within 60 s shows a notification and calls nothing", () => {
    addon.onInsert({
      parameters: { id: "T1", notBefore: String(now + 30_000) },
    });
    expect(fetchApp.requests).toHaveLength(0);
    expect(argsOf("setText")).toEqual(["Service is busy. Try again in 30 s."]);
  });

  it("Back pops, Refresh replaces the root, folder and preview push cards", () => {
    writeView(cache, HOME, now);
    serve({
      "sidebar.home": HOME,
      "template.getBody": {
        id: "T1",
        version: 2,
        html: "<p>x</p>",
        subject: "",
      },
    });
    addon.onBack();
    expect(argsOf("popCard")).toHaveLength(1);
    addon.onOpenFolder({ parameters: { folderId: "F1", page: "1" } });
    addon.onPreview({ parameters: { id: "T1" } });
    expect(argsOf("pushCard")).toHaveLength(2);
    addon.onRefresh();
    expect(argsOf("popToRoot")).toHaveLength(1);
  });

  it("the prompt card Insert re-checks with template.apply and renders the cached body", () => {
    const ops = serve({
      "template.apply": {
        id: "T1",
        title: "X",
        version: 2,
        html: null,
        sender: { name: "", title: "", phone: "", department: "" },
        recipientFirstName: "",
      },
    });
    cache.put(
      "body:T1",
      JSON.stringify({ version: 2, html: "<p>{{ask:X}}</p>", subject: "" }),
    );
    addon.onPromptInsert({
      parameters: { id: "T1", version: "2", values: "{}" },
      formInput: { "p-1": "filled" },
    });
    expect(calls.find((c) => c.method === "addUpdateContent")?.args[0]).toBe(
      "<p>filled</p>",
    );
    expect(ops).toEqual(["template.apply"]);
  });

  it("Open library and Edit open the web app in an overlay and drop the cached view", () => {
    writeView(cache, HOME, now);
    addon.onOpenLibrary();
    expect(readView(cache)).toBeNull();
    writeView(cache, HOME, now);
    addon.onOpenLink({ parameters: { id: "T1" } });
    expect(readView(cache)).toBeNull();
    expect(argsOf("setUrl")).toEqual([
      EXEC_URL,
      `${EXEC_URL}?view=editor&id=T1`,
    ]);
    expect(argsOf("setOpenAs")).toEqual(["OVERLAY", "OVERLAY"]);
    expect(argsOf("setOnClose")).toEqual(["RELOAD_ADD_ON", "RELOAD_ADD_ON"]);
  });
});

describe("add-on guard (ENTRY_POINTS surface addon)", () => {
  const entries = [
    "onComposeOpen",
    "onHomepage",
    "onOpenLibrary",
    ...CALLBACKS,
  ];

  it.each(entries)(
    "%s refuses when it runs as the owner for another caller (google.script.run)",
    (name) => {
      session.effectiveEmail = "owner@example.com";
      const run = (addon as Record<string, () => unknown>)[name];
      expect(run).toBeTypeOf("function");
      expect(() => run?.()).toThrow(
        `${name} runs only inside the Gmail add-on`,
      );
      expect(fetchApp.requests).toHaveLength(0);
    },
  );

  it("refuses a blank active user", () => {
    session.activeEmail = "";
    session.effectiveEmail = "";
    expect(() => addon.onInsert()).toThrow("runs only inside the Gmail add-on");
  });
});
