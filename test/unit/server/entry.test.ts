import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "../../../appsscript.json";
import * as entry from "../../../src/entry";
import {
  daily,
  doGet,
  doPost,
  refreshMembers,
  rpc,
  setup,
  tick,
} from "../../../src/server/entry";
import { CALLBACKS } from "../../../src/addon/cards/spec";
import { ENTRY_POINTS, TRIGGER_JOBS } from "../../../src/shared/entryPoints";
import { DOMAIN_KEY, OWNER_EMAIL_KEY } from "../../../src/server/guards";
import { lastErrorKey, lastOkKey } from "../../../src/server/jobs/health";
import {
  TRIGGERS_VERSION,
  TRIGGERS_VERSION_KEY,
} from "../../../src/server/jobs/triggers";
import { STORE_KEY } from "../../../src/server/storage/setupStore";
import { installGlobals, type GlobalWorld } from "../../fakes/globals";
import type { FakeHtmlOutput, FakeTextOutput } from "../../fakes/output";
import { OWNER, START_MS } from "../../fakes/world";

const USER = "user@example.com";
let world: GlobalWorld;
let lines: string[];

beforeEach(() => {
  vi.useFakeTimers({ now: START_MS, toFake: ["Date"] });
  world = installGlobals();
  lines = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lastLog(): Record<string, unknown> {
  return JSON.parse(lines.at(-1) ?? "{}") as Record<string, unknown>;
}

function asCaller(email: string): void {
  world.session.active = email;
}

function post(body: string): Record<string, unknown> {
  const event = {
    postData: { contents: body },
  } as unknown as GoogleAppsScript.Events.DoPost;
  return JSON.parse(
    (doPost(event) as unknown as FakeTextOutput).content,
  ) as Record<string, unknown>;
}

const PING = JSON.stringify({
  op: "ping",
  args: {},
  requestId: "r1",
  clientVersion: "x",
});

describe("setup (owner, from the editor)", () => {
  it("records owner and domain, creates the data folder and installs 3 triggers, idempotently", () => {
    expect(setup()).toEqual({ domain: "example.com", created: 8, triggers: 3 });
    expect(world.props.getProperty(OWNER_EMAIL_KEY)).toBe(OWNER);
    expect(world.props.getProperty(DOMAIN_KEY)).toBe("example.com");
    expect(world.props.getProperty("ADMIN_EMAILS")).toBe(OWNER);
    expect(world.props.getProperty(TRIGGERS_VERSION_KEY)).toBe(
      TRIGGERS_VERSION,
    );
    expect(world.props.getProperty(lastOkKey("setup"))).toBe(
      "2026-11-09T12:00:00.000Z",
    );
    expect(
      world.scriptApp.triggers.map((t) => `${t.handler} ${t.schedule}`),
    ).toEqual([
      "tick every 5 min",
      "refreshMembers every 15 min",
      "daily every 1 d at 2h",
    ]);
    const store = world.props.getProperty(STORE_KEY);
    expect(setup()).toEqual({ domain: "example.com", created: 0, triggers: 3 });
    expect(world.props.getProperty(STORE_KEY)).toBe(store);
    expect(world.scriptApp.triggers).toHaveLength(3);
  });

  it("refuses a call through google.script.run by another user (active differs from effective)", () => {
    asCaller(USER);
    expect(() => setup()).toThrow("setup may run only as the owner");
    expect(world.drive.files.size).toBe(0);
    expect(lastLog()).toMatchObject({
      action: "setup",
      result: "denied",
      errorCode: "DENIED",
      actor: USER,
    });
  });

  it("refuses a script editor who is not the recorded owner", () => {
    setup();
    world.session.active = "editor@example.com";
    world.session.effective = "editor@example.com";
    expect(() => setup()).toThrow("may run only as the owner");
    expect(world.props.getProperty(OWNER_EMAIL_KEY)).toBe(OWNER);
  });
});

describe("trigger guard (ENTRY_POINTS surface trigger)", () => {
  beforeEach(() => {
    setup();
  });

  it.each([
    ["tick", () => tick()],
    ["refreshMembers", () => refreshMembers()],
    ["daily", () => daily()],
  ] as const)("%s runs for the owner and records lastOk", (name, run) => {
    run();
    expect(world.props.getProperty(lastOkKey(name))).not.toBeNull();
    expect(lastLog()).toMatchObject({
      surface: "trigger",
      action: name,
      result: "ok",
    });
  });

  it.each([
    ["tick", (e?: { triggerUid: string }) => tick(e)],
    ["refreshMembers", (e?: { triggerUid: string }) => refreshMembers(e)],
    ["daily", (e?: { triggerUid: string }) => daily(e)],
  ] as const)(
    "%s refuses google.script.run from another user, even with a real triggerUid",
    (name, run) => {
      const uid =
        world.scriptApp.triggers.find((t) => t.handler === name)?.id ?? "";
      asCaller(USER);
      const before = world.drive.calls.length;
      expect(() => run({ triggerUid: uid })).toThrow(
        `${name} may run only as the owner or from its trigger`,
      );
      expect(world.drive.calls.length).toBe(before);
      expect(lastLog()).toMatchObject({ action: name, result: "denied" });
    },
  );

  it("runs from a real trigger with a blank active user and its own triggerUid", () => {
    asCaller("");
    const uid =
      world.scriptApp.triggers.find((t) => t.handler === "tick")?.id ?? "";
    expect(tick({ triggerUid: uid })).toMatchObject({ applies: 0, denied: 0 });
  });

  it("refuses a forged or mismatched triggerUid", () => {
    asCaller("");
    const dailyUid =
      world.scriptApp.triggers.find((t) => t.handler === "daily")?.id ?? "";
    expect(() => tick({ triggerUid: "forged" })).toThrow("tick may run only");
    expect(() => tick({ triggerUid: dailyUid })).toThrow("tick may run only");
    expect(() => tick()).toThrow("tick may run only");
  });

  it("refuses when the effective user is not the recorded owner", () => {
    world.session.active = "editor@example.com";
    world.session.effective = "editor@example.com";
    expect(() => daily()).toThrow("daily may run only");
  });

  it("refuses every job before setup recorded an owner", () => {
    world.props.deleteProperty(OWNER_EMAIL_KEY);
    expect(() => tick()).toThrow("tick may run only");
  });

  it("records lastError and rethrows when a job fails", () => {
    world.drive.failNext("get", new Error("Drive down"));
    expect(() => tick()).toThrow("Drive down");
    expect(world.props.getProperty(lastErrorKey("tick"))).toBe(
      "2026-11-09T12:00:00.000Z Error: Drive down",
    );
    expect(lastLog()).toMatchObject({
      level: "error",
      action: "tick",
      result: "error",
      errorCode: "INTERNAL",
    });
  });

  it("honours LOG_LEVEL from Script Properties", () => {
    world.props.setProperty("LOG_LEVEL", "error");
    lines.length = 0;
    tick();
    expect(lines).toHaveLength(0);
  });
});

describe("web app and add-on entry points", () => {
  beforeEach(() => {
    setup();
    asCaller(USER);
  });

  it("doGet serves the shell to a domain caller", () => {
    const page = doGet() as unknown as FakeHtmlOutput;
    expect(page.content).toBe("template:index");
    expect(page.templateValues).toEqual({
      email: USER,
      appVersion: "test-testsha",
    });
    expect(lastLog()).toMatchObject({
      action: "web.open",
      result: "ok",
      actor: USER,
    });
    expect(lastLog()["requestId"]).toMatch(/^[0-9A-Z]{8}-[0-9A-Z]{6}$/);
  });

  it.each([
    ["", "AUTH_NO_USER"],
    ["someone@other.com", "AUTH_DOMAIN"],
  ])("doGet serves the Cannot identify page to %j", (email, code) => {
    asCaller(email);
    const page = doGet() as unknown as FakeHtmlOutput;
    expect(page.title).toBe("Cannot identify your account");
    expect(lastLog()).toMatchObject({ result: "denied", errorCode: code });
    expect(lastLog()["requestId"]).toMatch(/^[0-9A-Z]{8}-[0-9A-Z]{6}$/);
  });

  it("reinstalls triggers on the first request after TRIGGERS_VERSION changed", () => {
    world.props.setProperty(TRIGGERS_VERSION_KEY, "0");
    const before = world.scriptApp.triggers.map((t) => t.id);
    doGet();
    expect(world.props.getProperty(TRIGGERS_VERSION_KEY)).toBe(
      TRIGGERS_VERSION,
    );
    expect(world.scriptApp.triggers).toHaveLength(3);
    expect(world.scriptApp.triggers.map((t) => t.id)).not.toEqual(before);
    rpc("ping", {});
    expect(world.scriptApp.triggers).toHaveLength(3);
  });

  it("doPost answers ping with the JSON envelope", () => {
    expect(post(PING)).toMatchObject({
      ok: true,
      data: { pong: true, caller: USER },
    });
    expect(lastLog()).toMatchObject({
      surface: "addon",
      action: "ping",
      requestId: "r1",
    });
  });

  it("doPost denies blank and foreign callers, and malformed bodies", () => {
    expect(post("{")).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    });
    asCaller("");
    expect(post(PING)).toMatchObject({
      ok: false,
      error: { code: "AUTH_NO_USER" },
    });
    asCaller("x@other.com");
    expect(post(PING)).toMatchObject({
      ok: false,
      error: { code: "AUTH_DOMAIN" },
    });
    const output = doPost(
      undefined as unknown as GoogleAppsScript.Events.DoPost,
    ) as unknown as FakeTextOutput;
    expect(JSON.parse(output.content)).toMatchObject({ ok: false });
  });

  it("rpc dispatches with a server-assigned request ID", () => {
    expect(rpc("ping", {})).toMatchObject({ ok: true, data: { pong: true } });
    expect(lastLog()).toMatchObject({ surface: "webapp" });
    expect(lastLog()["requestId"]).toMatch(/^[0-9A-Z]{8}-[0-9A-Z]{6}$/);
    expect(rpc(42, {})).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    });
  });

  it("rpc logs the web app's request ID when it is well formed", () => {
    rpc("ping", {}, "MW9UU758-QWCE26");
    expect(lastLog()).toMatchObject({ requestId: "MW9UU758-QWCE26" });
    rpc("ping", {}, "bad id <x>");
    expect(lastLog()["requestId"]).not.toBe("bad id <x>");
    rpc("ping", {}, 7);
    expect(lastLog()["requestId"]).toMatch(/^[0-9A-Z]{8}-[0-9A-Z]{6}$/);
  });

  it("rpc runs a full create through the real runtime services", () => {
    asCaller(OWNER);
    const folder = rpc("folder.create", { name: "Sales" });
    expect(folder).toMatchObject({ ok: true, data: { name: "Sales" } });
    expect(world.drive.byName("index.json")[0]?.content).toContain(
      '"name":"Sales"',
    );
  });

  it("hashes bodies with Utilities SHA-256 and reads profiles through AdminDirectory", () => {
    asCaller(OWNER);
    const folder = rpc("folder.create", { name: "Sales" }) as {
      data: { id: string };
    };
    const item = rpc("template.create", {
      folderId: folder.data.id,
      title: "T",
      html: "<p>hi</p>",
    }) as {
      data: { bodyFileId: string };
    };
    const body = JSON.parse(world.drive.text(item.data.bodyFileId)) as {
      sha256: string;
    };
    expect(body.sha256).toBe(
      createHash("sha256").update("<p>hi</p>").digest("hex"),
    );
    world.directory.users.set(OWNER, { name: { fullName: "Owner Name" } });
    expect(rpc("profile.me", {})).toMatchObject({
      ok: true,
      data: { name: "Owner Name" },
    });
  });

  it("answers NOT_CONFIGURED when an advanced service is not enabled", () => {
    asCaller(OWNER);
    vi.stubGlobal("Drive", undefined);
    vi.stubGlobal("AdminDirectory", undefined);
    expect(rpc("folder.list", {})).toMatchObject({
      ok: false,
      error: { code: "NOT_CONFIGURED" },
    });
    expect(rpc("profile.me", {})).toMatchObject({
      ok: true,
      data: { name: "" },
    });
  });

  it("selects the Drive REST client with DRIVE_CLIENT=rest", () => {
    asCaller(OWNER);
    world.props.setProperty("DRIVE_CLIENT", "rest");
    world.fetchApp.respondWith(() => ({ status: 500, body: "" }));
    expect(rpc("folder.list", {})).toMatchObject({
      ok: false,
      error: { code: "INTERNAL" },
    });
    expect(world.fetchApp.requests[0]?.url).toContain(
      "https://www.googleapis.com/drive/v3/files/",
    );
  });
});

describe("entry point allowlist (ADR-0003 Part C, revised in slice 2)", () => {
  it("lists every bundle export with one surface, and nothing else", () => {
    expect(Object.keys(entry).sort()).toEqual(Object.keys(ENTRY_POINTS).sort());
  });

  it("marks every manifest add-on function as surface addon", () => {
    const addon = [
      manifest.addOns.common.homepageTrigger.runFunction,
      ...manifest.addOns.common.universalActions.map((a) => a.runFunction),
      ...manifest.addOns.gmail.composeTrigger.selectActions.map(
        (a) => a.runFunction,
      ),
    ];
    for (const name of addon)
      expect(ENTRY_POINTS[name as keyof typeof ENTRY_POINTS]).toBe("addon");
    const addonEntries = Object.entries(ENTRY_POINTS).filter(
      ([, surface]) => surface === "addon",
    );
    expect(addonEntries.map(([name]) => name).sort()).toEqual(
      ["onComposeOpen", "onHomepage", "onOpenLibrary", ...CALLBACKS].sort(),
    );
  });

  it("marks every installed trigger handler and setup as surface trigger", () => {
    for (const job of [...TRIGGER_JOBS, "setup"])
      expect(ENTRY_POINTS[job as keyof typeof ENTRY_POINTS]).toBe("trigger");
  });
});
