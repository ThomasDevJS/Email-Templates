import { afterEach, describe, expect, it, vi } from "vitest";
import { callServer } from "../../../src/addon/client/serverClient";

vi.mock("../../../src/shared/buildInfo", () => ({
  BUILD_INFO: { env: "test", execUrl: "", gitSha: "x" },
  APP_VERSION: "test-x",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callServer without execUrl", () => {
  it("answers NOT_CONFIGURED without a fetch, so the sidebar shows the not set up state", () => {
    const fetch = vi.fn();
    vi.stubGlobal("UrlFetchApp", { fetch });
    const call = callServer("sidebar.home", {});
    expect(call.requestId).toMatch(/^[0-9A-Z]{8}-[0-9A-Z]{6}$/);
    expect(call).toMatchObject({
      response: { ok: false, error: { code: "NOT_CONFIGURED" } },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
