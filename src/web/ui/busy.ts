import { h } from "./dom";

/** A wait shows the bar and the "Loading" announcement only after this long (D37). */
export const BUSY_SHOW_MS = 300;
/** A wait longer than this stops blocking; the call itself goes on and keeps its own error path. */
export const BUSY_MAX_MS = 20_000;
/** Typing events: a text field keeps them during a wait, so nothing typed is lost (slice 24 retry 1). */
const TYPING_EVENTS: ReadonlySet<string> = new Set([
  "keydown",
  "beforeinput",
  "paste",
  "drop",
]);
const TEXT_INPUTS: ReadonlySet<string> = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
]);

/** A field the user types into: the template text, Title, Subject, the address and tag boxes. */
function isTextField(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUTS.has(target.type);
  return (
    target instanceof Element &&
    target.closest('[contenteditable="true"]') !== null
  );
}

const BLOCKED_EVENTS = [
  "click",
  "dblclick",
  "mousedown",
  "pointerdown",
  "keydown",
  "beforeinput",
  "paste",
  "drop",
  "contextmenu",
  "submit",
] as const;

export interface Busy {
  /** Blocks the page while `work` runs. */
  track<T>(work: Promise<T>): Promise<T>;
}

/**
 * The one page loader (D37). While a tracked call runs, clicks and keys inside `regions` (the page and the
 * sidebar) are dropped, except typing in a text field, so focus stays where it was; dialogs and toasts sit outside and keep working. After
 * BUSY_SHOW_MS a slim bar shows at the top, `aria-busy` marks the regions and one polite "Loading" is announced.
 * The block ends when the last call settles, or after BUSY_MAX_MS whatever happens.
 */
export function createBusy(regions: readonly HTMLElement[]): Busy {
  const bar = h("div", { class: "busy-bar", hidden: true });
  const status = h("p", { class: "sr-only", role: "status" });
  document.body.append(bar, status);
  let running = 0;
  let blocking = false;
  let showTimer = 0;

  const guard = (event: Event) => {
    if (!blocking) return;
    const target = event.target as Node;
    if (!regions.some((region) => region.contains(target))) return;
    // Clicks stay blocked everywhere; a text field takes keys, so typing during a save stays (and reads unsaved).
    if (TYPING_EVENTS.has(event.type) && isTextField(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const name of BLOCKED_EVENTS)
    document.addEventListener(name, guard, true);

  const mark = (on: boolean) => {
    bar.hidden = !on;
    status.textContent = on ? "Loading" : "";
    for (const region of regions)
      if (on) region.setAttribute("aria-busy", "true");
      else region.removeAttribute("aria-busy");
  };
  const stop = () => {
    window.clearTimeout(showTimer);
    blocking = false;
    for (const region of regions) delete region.dataset["blocked"];
    mark(false);
  };
  const start = () => {
    blocking = true;
    // At once, unlike `aria-busy`: tests and styles can see the block.
    for (const region of regions) region.dataset["blocked"] = "";
    showTimer = window.setTimeout(() => {
      mark(true);
    }, BUSY_SHOW_MS);
  };

  return {
    track: (work) => {
      if (!blocking) start();
      running += 1;
      let counted = true;
      // Each call stops counting when it settles or after its own BUSY_MAX_MS (slice 24 retry 1).
      const done = () => {
        if (!counted) return;
        counted = false;
        window.clearTimeout(limit);
        running -= 1;
        if (running === 0) stop();
      };
      const limit = window.setTimeout(done, BUSY_MAX_MS);
      work.then(done, done);
      return work;
    },
  };
}
