// TEMPORARY (spike S7): removed with src/addon/spikeS7.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as addon from "../../../src/addon/entry";
import { homeCard } from "../../../src/addon/cards/home";
import { createRecordingGmail } from "../../fakes/gmail";
import {
  createRecordingCardService,
  type RecordedCall,
} from "../../fakes/output";
import { createSession } from "../../fakes/session";
import { view } from "./fixtures";

const build = vi.hoisted(() => ({ env: "dev", execUrl: "", gitSha: "x" }));

vi.mock("../../../src/shared/buildInfo", () => ({
  BUILD_INFO: build,
  APP_VERSION: "x",
}));

const headers = (entry: "compose" | "inbox" | "message") =>
  homeCard(view(), entry).sections.map((s) => s.header);

describe("home card spike S7 section", () => {
  afterEach(() => {
    build.env = "dev";
  });

  it("is the last section of the dev side panel, after the S6 section", () => {
    for (const entry of ["inbox", "message"] as const)
      expect(headers(entry).slice(-2)).toEqual([
        "Spike S6 (temporary)",
        "Spike S7 (temporary)",
      ]);
  });

  it("is absent from the compose toolbar and from a prod build", () => {
    expect(headers("compose")).not.toContain("Spike S7 (temporary)");
    build.env = "prod";
    expect(headers("message")).not.toContain("Spike S7 (temporary)");
  });
});

describe("harness callbacks (dev build)", () => {
  let calls: RecordedCall[];
  const texts = () =>
    calls.filter((c) => c.method === "setText").map((c) => c.args[0]);

  beforeEach(() => {
    const cards = createRecordingCardService();
    calls = cards.calls;
    vi.stubGlobal("CardService", cards.service);
    vi.stubGlobal(
      "Session",
      createSession("user@example.com", "user@example.com"),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("New email opens the draft through GmailApp", () => {
    const fake = createRecordingGmail();
    vi.stubGlobal("GmailApp", fake.gmail);
    addon.onS7Compose({
      gmail: { accessToken: "t" },
      commonEventObject: { parameters: { b: "new" } },
    });
    expect(fake.calls.map((c) => c.method)).toEqual([
      "setCurrentMessageAccessToken",
      "createDraft",
    ]);
    expect(calls.map((c) => c.method)).toContain("setGmailDraft");
  });

  it("a Gmail exception shows its message on screen", () => {
    vi.stubGlobal("GmailApp", {
      setCurrentMessageAccessToken: () => {
        throw new Error("Required permissions: https://mail.google.com/");
      },
    });
    addon.onS7Compose({
      gmail: { accessToken: "t" },
      commonEventObject: { parameters: { b: "new" } },
    });
    expect(texts()).toContain(
      "S7 failed: Required permissions: https://mail.google.com/",
    );
  });

  it("the card and Notify callbacks render", () => {
    addon.onS7Card({ gmail: { accessToken: "t" } });
    expect(calls.map((c) => c.method)).toContain("pushCard");
    addon.onS7Notify();
    expect(texts()).toContain(
      "S7 Notify: the callback ran. No draft was made.",
    );
  });
});
