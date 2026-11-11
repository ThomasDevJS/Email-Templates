// @vitest-environment jsdom
/** D37 page loader: blocks clicks and keys in the page while a call runs, shows itself after 300 ms, never sticks. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUSY_MAX_MS,
  BUSY_SHOW_MS,
  createBusy,
} from "../../../src/web/ui/busy";

let main: HTMLElement;
let dialogButton: HTMLButtonElement;
let button: HTMLButtonElement;
let clicks: string[];

beforeEach(() => {
  vi.useFakeTimers();
  document.body.replaceChildren();
  main = document.createElement("main");
  button = document.createElement("button");
  main.append(button);
  dialogButton = document.createElement("button");
  document.body.append(main, dialogButton);
  clicks = [];
  button.addEventListener("click", () => clicks.push("page"));
  button.addEventListener("keydown", () => clicks.push("key"));
  dialogButton.addEventListener("click", () => clicks.push("dialog"));
});

afterEach(() => {
  vi.useRealTimers();
});

const bar = () => document.querySelector<HTMLElement>(".busy-bar");
const announced = () =>
  document.querySelector('[role="status"]')?.textContent ?? "";
const press = () => {
  button.click();
  button.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
};

describe("page loader (D37)", () => {
  it("drops clicks and keys in the page while a call runs; dialogs and focus stay", async () => {
    const busy = createBusy([main]);
    let finish: (value: string) => void = () => undefined;
    button.focus();
    const call = busy.track(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    press();
    dialogButton.click();
    expect(clicks).toEqual(["dialog"]);
    expect(document.activeElement).toBe(button);
    finish("ok");
    await expect(call).resolves.toBe("ok");
    press();
    expect(clicks).toEqual(["dialog", "page", "key"]);
    expect(document.activeElement).toBe(button);
  });

  it("shows the bar, aria-busy and one Loading only after 300 ms", async () => {
    const busy = createBusy([main]);
    const quick = busy.track(Promise.resolve(1));
    await quick;
    await vi.advanceTimersByTimeAsync(BUSY_SHOW_MS);
    expect(bar()?.hidden).toBe(true);
    expect(announced()).toBe("");
    let finish: () => void = () => undefined;
    void busy.track(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await vi.advanceTimersByTimeAsync(BUSY_SHOW_MS - 1);
    expect(bar()?.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(bar()?.hidden).toBe(false);
    expect(main.getAttribute("aria-busy")).toBe("true");
    expect(announced()).toBe("Loading");
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(bar()?.hidden).toBe(true);
    expect(main.hasAttribute("aria-busy")).toBe(false);
    expect(announced()).toBe("");
  });

  it("ends the block when the call throws", async () => {
    const busy = createBusy([main]);
    await expect(busy.track(Promise.reject(new Error("x")))).rejects.toThrow(
      "x",
    );
    press();
    expect(clicks).toEqual(["page", "key"]);
  });

  it("ends the block after 20 s when a call never answers, and blocks again for the next call", async () => {
    const busy = createBusy([main]);
    void busy.track(new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(BUSY_MAX_MS - 1);
    press();
    expect(clicks).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(bar()?.hidden).toBe(true);
    press();
    expect(clicks).toEqual(["page", "key"]);
    await busy.track(Promise.resolve());
    press();
    expect(clicks).toHaveLength(4);
    expect(main.hasAttribute("data-blocked")).toBe(false);
  });
});
