import { afterEach, describe, expect, it, vi } from "vitest";
import { callServer } from "../../../src/addon/client/serverClient";
import { createUtilities } from "../../fakes/output";

vi.mock("../../../src/shared/buildInfo", () => ({
  BUILD_INFO: { env: "test", execUrl: "", gitSha: "x" },
  APP_VERSION: "test-x",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callServer without execUrl", () => {
  it("answers NOT_CONFIGURED without a fetch, so the sidebar shows the not set up state", () => {
    vi.stubGlobal("Utilities", createUtilities());
    const fetch = vi.fn();
    vi.stubGlobal("UrlFetchApp", { fetch });
    expect(callServer("sidebar.home", {})).toMatchObject({
      requestId: "uuid-1",
      response: { ok: false, error: { code: "NOT_CONFIGURED" } },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
