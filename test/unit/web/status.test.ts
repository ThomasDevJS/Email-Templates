// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../src/shared/errors/codes";
import { RpcError } from "../../../src/web/rpc/client";
import { QUOTA_RETRY_MS, showToast } from "../../../src/web/ui/status";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

function retryOf(code: ErrorCode, retry: () => void): HTMLButtonElement {
  showToast(document.body, new RpcError(code, "m", "REQ-1", true), retry);
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Retry",
  );
  if (button === undefined) throw new Error("no Retry button");
  return button;
}

describe("toast Retry (spec section 7)", () => {
  it("QUOTA keeps Retry disabled for 60 s, then enables it", () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const button = retryOf(ErrorCode.QUOTA, retry);
    expect(button.disabled).toBe(true);
    vi.advanceTimersByTime(QUOTA_RETRY_MS - 1);
    expect(button.disabled).toBe(true);
    vi.advanceTimersByTime(1);
    expect(button.disabled).toBe(false);
    button.click();
    expect(retry).toHaveBeenCalledOnce();
    expect(document.querySelector(".toast")).toBeNull();
  });

  it("BUSY enables Retry at once", () => {
    expect(retryOf(ErrorCode.BUSY, vi.fn()).disabled).toBe(false);
  });
});
