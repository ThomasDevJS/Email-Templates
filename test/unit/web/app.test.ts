// @vitest-environment jsdom
/**
 * The web app shell on the dev harness (fake google.script, in-memory server) in jsdom: views, states,
 * keyboard paths and the save flow.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mediaListeners, stubLayout } from "./domStubs";

const INDEX = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "src", "web", "index.html"),
  "utf8",
);

beforeAll(stubLayout);

afterEach(() => {
  vi.resetModules();
  document.body.replaceChildren();
});

interface ScriptRun {
  withSuccessHandler(handler: (value: unknown) => void): ScriptRun;
  withFailureHandler(handler: (error: unknown) => void): ScriptRun;
  rpc(op: string, args: unknown, id: string): void;
}

/** Wraps the harness's `google.script.run`, so tests can count calls per op. */
function recordCalls(): void {
  sent.length = 0;
  const script = (
    window as unknown as { google: { script: { run: ScriptRun } } }
  ).google.script;
  const wrap = (inner: ScriptRun): ScriptRun => ({
    withSuccessHandler: (handler) => wrap(inner.withSuccessHandler(handler)),
    withFailureHandler: (handler) => wrap(inner.withFailureHandler(handler)),
    rpc: (op, args, id) => {
      sent.push(op);
      inner.rpc(op, args, id);
    },
  });
  script.run = wrap(script.run);
}

/** Loads the page at `url` (path, query and hash) with a fresh harness and app. */
async function boot(url: string): Promise<void> {
  window.history.replaceState(null, "", url);
  const body = /<body>([\s\S]*)<\/body>/.exec(INDEX)?.[1] ?? "";
  document.body.innerHTML = body
    .replace(/<script>[\s\S]*<\/script>/, "")
    .replace(/<\?=\s*\w+\s*\?>/g, "");
  await import("../../../src/web/dev-harness");
  recordCalls();
  await import("../../../src/web/app");
}

const main = () => document.getElementById("main") as HTMLElement;
/** Server calls by op since boot, read from the harness's request log. */
const sent: string[] = [];
const calls = (op: string) => sent.filter((name) => name === op).length;
const text = () => main().textContent;
/** A row's or a cell's template title, without the subject line under it. */
const titleOf = (element: Element | null | undefined) =>
  element?.querySelector(".row-title")?.textContent;
const sideTree = () =>
  document.querySelector('#side [role="tree"]') as HTMLElement;

/**
 * Waits for `check`, then for the page to take clicks again: a call still running after the awaited state (a
 * follow-up read, a background refresh) would drop the next click (D37 loader). Use `vi.waitFor` for a state that
 * only exists during a call.
 */
/** `vi.waitFor` at the pace of `until`, for a state that only exists during a call. */
const NOW = { timeout: 2000, interval: 5 };

async function until(check: () => void): Promise<void> {
  await vi.waitFor(check, { timeout: 2000, interval: 5 });
  await vi.waitFor(
    () => {
      expect(document.querySelector("[data-blocked]")).toBeNull();
    },
    { timeout: 2000, interval: 5 },
  );
}

function key(
  target: Element,
  name: string,
  init: KeyboardEventInit = {},
): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true, ...init }),
  );
}

function button(label: string, root: ParentNode = document): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent.trim() === label,
  );
  if (found === undefined) throw new Error(`no button ${label}`);
  return found;
}

interface HarnessRun {
  withSuccessHandler(handler: (value: unknown) => void): {
    rpc(op: string, args: unknown, id: string): void;
  };
}

/** One server op straight through the harness, as another tab or another user would send it. */
function harnessCall(op: string, args: unknown): Promise<{ ok: boolean }> {
  const run = (window as unknown as { google: { script: { run: HarnessRun } } })
    .google.script.run;
  return new Promise((resolve) => {
    run
      .withSuccessHandler((value) => {
        resolve(value as { ok: boolean });
      })
      .rpc(op, args, "other-tab");
  });
}

/** A save of version `base + 1` with the body "theirs" from a second tab. */
function otherTabSave(id: string, base: number): Promise<{ ok: boolean }> {
  return harnessCall("template.update", {
    id,
    baseVersion: base,
    title: "Other tab",
    html: "<p>theirs</p>",
  });
}

describe("library (screen 3)", () => {
  it("shows 8 skeleton rows with aria-busy, then the grid, header and tree", async () => {
    await boot("/?latency=30#/library");
    await vi.waitFor(() => {
      expect(main().querySelectorAll(".skeleton-row")).toHaveLength(8);
    }, NOW);
    expect(main().querySelector(".list")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    expect(main().querySelector(".list")?.getAttribute("aria-busy")).toBe(
      "false",
    );
    expect(document.getElementById("signed-in")?.textContent).toBe(
      "Signed in as dev.user@example.com",
    );
    expect(sideTree().querySelectorAll('[role="treeitem"]')).toHaveLength(4);
    expect(
      [...sideTree().querySelectorAll('[role="treeitem"]')].map((item) =>
        item.getAttribute("data-count"),
      ),
    ).toEqual([null, "3", "1", null]);
    expect(
      document
        .querySelector("[data-nav=library]")
        ?.hasAttribute("aria-current"),
    ).toBe(true);
    expect(main().querySelector(".count")?.textContent).toBe("4");
    const stars = [...main().querySelectorAll<HTMLButtonElement>(".star")];
    expect(stars.map((star) => star.getAttribute("aria-pressed"))).toContain(
      "true",
    );
    expect(stars.every((star) => !star.disabled)).toBe(true);
  });

  it("stars a template from the keyboard and filters by Favorites", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const rowOf = (title: string) =>
      [...main().querySelectorAll<HTMLTableRowElement>("tbody tr")].find(
        (row) => titleOf(row) === title,
      ) as HTMLTableRowElement;
    const starCell = rowOf("Welcome email").cells[0] as HTMLTableCellElement;
    expect(starCell.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Add to favorites: Welcome email",
    );
    key(starCell, "Enter");
    await until(() => {
      expect(main().querySelector(".status")?.textContent).toBe(
        'Added "Welcome email" to favorites.',
      );
    });
    const star = rowOf("Welcome email").cells[0]?.querySelector("button");
    expect(star?.getAttribute("aria-pressed")).toBe("true");
    expect(star?.getAttribute("aria-label")).toBe(
      "Remove from favorites: Welcome email",
    );
    expect(document.activeElement).toBe(rowOf("Welcome email").cells[0]);
    const filter = document.querySelector(
      "[data-nav=favorites]",
    ) as HTMLButtonElement;
    filter.click();
    expect(filter.hasAttribute("aria-current")).toBe(true);
    expect(main().querySelector("#list-heading")?.textContent).toBe(
      "Favorites",
    );
    expect(
      [...main().querySelectorAll("tbody tr")].map((row) => titleOf(row)),
    ).toEqual(["Price quote 2026", "Welcome email"]);
    (
      rowOf("Price quote 2026").cells[0]?.querySelector("button") as HTMLElement
    ).click();
    await until(() => {
      expect(main().querySelectorAll("tbody tr")).toHaveLength(1);
    });
    (
      rowOf("Welcome email").cells[0]?.querySelector("button") as HTMLElement
    ).click();
    await until(() => {
      expect(text()).toContain(
        "No favorites yet. Use the star in a row to add one.",
      );
    });
    (document.querySelector("[data-nav=library]") as HTMLElement).click();
    expect(filter.hasAttribute("aria-current")).toBe(false);
    expect(main().querySelectorAll("tbody tr")).toHaveLength(4);
  });

  it("finds subjects in the browser and body text through search.body", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "quote for";
    search.dispatchEvent(new Event("input"));
    expect(
      [...main().querySelectorAll('tbody [role="row"]')].map((row) =>
        titleOf(row),
      ),
    ).toEqual(["Price quote 2026"]);
    expect(main().querySelector(".row-sub")?.textContent).toBe(
      "Quote for [Product name]",
    );
    search.value = "interest";
    search.dispatchEvent(new Event("input"));
    expect(text()).toContain("Searching text...");
    expect(text()).not.toContain("No templates match");
    await until(() => {
      expect(main().querySelector(".matches-heading")?.textContent).toBe(
        "Matches in text",
      );
    });
    expect(
      titleOf(
        main().querySelector(
          '[aria-label="Matches in text"] tbody tr td:nth-child(2)',
        ),
      ),
    ).toBe("Price quote 2026");
    expect(text()).not.toContain("Searching text...");
  });

  it("blocks the page while the library loads, but never for the text search (D37)", async () => {
    await boot("/?latency=200#/library");
    expect(main().hasAttribute("data-blocked")).toBe(true);
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "interest";
    search.dispatchEvent(new Event("input"));
    await until(() => {
      expect(calls("search.body")).toBe(1);
    });
    expect(text()).toContain("Searching text...");
    expect(main().hasAttribute("data-blocked")).toBe(false);
  });

  it("shows the no-match text once a failed search.body settles", async () => {
    await boot("/?latency=0&fail=BUSY&failOp=search.body#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "interest";
    search.dispatchEvent(new Event("input"));
    expect(text()).toContain("Searching text...");
    await until(() => {
      expect(text()).toContain(
        'No templates match "interest". Try fewer words, or remove folder: and tag: from the search.',
      );
    });
  });

  it("takes focus on load and focuses search on the first / even when the key targets the document", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    expect(document.activeElement).toBe(main());
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "/", bubbles: true }),
    );
    expect(document.activeElement).toBe(document.getElementById("search"));
  });

  it("focuses search with / and filters by title, folder and tag", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    key(document.body, "/");
    const search = document.getElementById("search") as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    search.value = "onboarding";
    search.dispatchEvent(new Event("input"));
    expect(
      [...main().querySelectorAll('tbody [role="row"]')].map((row) =>
        titleOf(row),
      ),
    ).toEqual(["Welcome email"]);
    search.value = "qoute";
    search.dispatchEvent(new Event("input"));
    await until(() => {
      expect(text()).toContain(
        'No templates match "qoute". Try fewer words, or remove folder: and tag: from the search.',
      );
    });
  });

  it("moves through the tree with arrow keys and opens a folder with Enter", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(sideTree().querySelectorAll('[role="treeitem"]')).toHaveLength(4);
    });
    const tree = sideTree();
    const focused = () => tree.querySelector('[tabindex="0"]') as HTMLElement;
    // All templates is a sidebar entry outside the tree; the first folder holds the tree's tab stop.
    expect(focused().textContent).toBe("HR");
    expect(tree.querySelector('[aria-selected="true"]')).toBeNull();
    key(focused(), "ArrowDown");
    expect(focused().textContent).toContain("Sales");
    key(focused(), "ArrowRight");
    expect(focused().getAttribute("aria-expanded")).toBe("true");
    key(focused(), "ArrowRight");
    expect(focused().textContent).toBe("Onboarding");
    key(focused(), "ArrowLeft");
    expect(focused().textContent).toContain("Sales");
    key(focused(), "ArrowLeft");
    expect(focused().getAttribute("aria-expanded")).toBe("false");
    key(focused(), "End");
    expect(focused().textContent).toBe("My templates");
    key(focused(), "Home");
    key(focused(), "ArrowUp");
    expect(focused().textContent).toBe("HR");
    key(focused(), "Enter");
    await until(() => {
      expect(text()).toContain("No templates in HR.");
    });
    expect(window.location.hash).toBe("#/library?folder=F-EMPTY");
    expect(document.activeElement?.textContent).toBe("HR");
    expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
    button(
      "New template",
      main().querySelector(".empty") as HTMLElement,
    ).click();
    await until(() => {
      expect(main().querySelector(".editor-title")?.textContent).toBe(
        "New template",
      );
    });
  });

  it("opens the parents of a folder named in the address once the folders load (slice 23 retry 1)", async () => {
    await boot("/?latency=0#/library?folder=F-QUOTES");
    await until(() => {
      expect(
        sideTree().querySelector('[aria-selected="true"]')?.textContent,
      ).toBe("Quotes");
    });
  });

  describe("a closed parent of the selected folder (slice 23 retry 2)", () => {
    const row = (name: string) =>
      [...sideTree().querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
        (item) => item.textContent === name,
      );
    const salesOpen = () => row("Sales")?.getAttribute("aria-expanded");
    /** Quotes selected, then Sales closed by its chevron. */
    async function closedSales(): Promise<void> {
      await boot("/?latency=0#/library?folder=F-QUOTES");
      await until(() => {
        expect(main().querySelectorAll('tbody [role="row"]').length).toBe(2);
        expect(salesOpen()).toBe("true");
      });
      (row("Sales")?.querySelector(".tree-toggle") as HTMLElement).click();
      expect(salesOpen()).toBe("false");
    }

    it("opens again when the user picks the folder in the editor breadcrumb", async () => {
      await closedSales();
      key(main().querySelector('td[tabindex="0"]') as HTMLElement, "Enter");
      await until(() => {
        expect(window.location.hash).toMatch(/^#\/edit\//);
        expect(main().querySelector(".crumbs button")).not.toBeNull();
      });
      button("Quotes", main()).click();
      await until(() => {
        expect(window.location.hash).toBe("#/library?folder=F-QUOTES");
      });
      expect(salesOpen()).toBe("true");
      expect(row("Quotes")?.getAttribute("aria-selected")).toBe("true");
    });

    it("stays closed when the library loads again after Duplicate", async () => {
      await closedSales();
      (
        main().querySelector('[aria-label^="Actions for"]') as HTMLButtonElement
      ).click();
      (
        [...document.querySelectorAll('[role="menuitem"]')].find(
          (item) => item.textContent === "Duplicate",
        ) as HTMLElement
      ).click();
      await until(() => {
        expect(main().querySelectorAll('tbody [role="row"]').length).toBe(3);
      });
      expect(salesOpen()).toBe("false");
    });

    it("stays closed after All templates and browser Back", async () => {
      await closedSales();
      (document.querySelector("[data-nav=library]") as HTMLElement).click();
      expect(window.location.hash).toBe("#/library");
      window.history.back();
      await until(() => {
        expect(window.location.hash).toBe("#/library?folder=F-QUOTES");
        expect(main().querySelector("#list-heading")?.textContent).toBe(
          "Sales / Quotes",
        );
      });
      expect(salesOpen()).toBe("false");
    });

    it("changes the open state once on a double-click on the chevron", async () => {
      await closedSales();
      const chevron = row("Sales")?.querySelector(
        ".tree-toggle",
      ) as HTMLElement;
      for (const detail of [1, 2])
        chevron.dispatchEvent(
          new MouseEvent("click", { bubbles: true, detail }),
        );
      expect(salesOpen()).toBe("true");
    });
  });

  it("opens and closes a folder by its chevron or a second click, without opening it (slice 23)", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(sideTree().querySelectorAll('[role="treeitem"]')).toHaveLength(4);
    });
    const row = (name: string) =>
      [...sideTree().querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
        (item) => item.textContent === name,
      ) as HTMLElement;
    const chevron = (name: string) =>
      row(name).querySelector(".tree-toggle") as HTMLElement;
    const rows = () => sideTree().querySelectorAll('[role="treeitem"]').length;
    expect(chevron("Sales").getAttribute("aria-hidden")).toBe("true");
    expect(chevron("Sales").hasAttribute("tabindex")).toBe(false);
    chevron("Sales").click();
    expect(row("Sales").getAttribute("aria-expanded")).toBe("true");
    expect(rows()).toBe(6);
    expect(document.activeElement).toBe(row("Sales"));
    expect(window.location.hash).toBe("#/library");
    chevron("Sales").click();
    expect(row("Sales").getAttribute("aria-expanded")).toBe("false");
    expect(rows()).toBe(4);
    expect(window.location.hash).toBe("#/library");
    // A name click opens and expands; a second click on the selected open row closes it and stays.
    row("Sales").click();
    expect(window.location.hash).toBe("#/library?folder=F-SALES");
    expect(row("Sales").getAttribute("aria-expanded")).toBe("true");
    row("Sales").click();
    expect(row("Sales").getAttribute("aria-expanded")).toBe("false");
    expect(window.location.hash).toBe("#/library?folder=F-SALES");
    expect(document.activeElement).toBe(row("Sales"));
    // Closing the parent of the selected folder keeps the page and does not reopen at once.
    row("Sales").click();
    row("Quotes").click();
    expect(window.location.hash).toBe("#/library?folder=F-QUOTES");
    chevron("Sales").click();
    expect(rows()).toBe(4);
    expect(main().querySelector("#list-heading")?.textContent).toBe(
      "Sales / Quotes",
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(row("Sales").getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps focus in the tree after a click or Enter, so arrows and Enter go on working (smoke defect 7)", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const items = () => [...sideTree().querySelectorAll('[role="treeitem"]')];
    const support = items().find((item) => item.textContent === "Support");
    (support as HTMLElement).click();
    expect(document.activeElement?.textContent).toBe("Support");
    expect(window.location.hash).toBe("#/library?folder=F-SUPPORT");
    expect(main().querySelector("#list-heading")?.textContent).toBe("Support");
    key(document.activeElement as Element, "ArrowDown");
    key(document.activeElement as Element, "Enter");
    expect(document.activeElement?.textContent).toBe("My templates");
    expect(main().querySelector("#list-heading")?.textContent).toBe(
      "My templates",
    );
    key(document.activeElement as Element, "ArrowUp");
    expect(document.activeElement?.textContent).toBe("Support");
    window.history.back();
    await until(() => {
      expect(window.location.hash).toBe("#/library?folder=F-SUPPORT");
    });
  });

  it("moves through the grid with arrow keys and opens the editor or history with Enter", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const first = main().querySelector('td[tabindex="0"]') as HTMLElement;
    first.focus();
    key(first, "ArrowDown");
    expect(titleOf(document.activeElement)).toBe("Price quote 2026");
    key(document.activeElement as Element, "End");
    key(document.activeElement as Element, "Enter");
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.getAttribute("aria-label")).toBe(
      "Actions for Price quote 2026",
    );
    key(menu, "ArrowDown");
    key(menu, "ArrowDown");
    key(menu, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("History");
    key(menu, "Enter");
    await until(() => {
      expect(text()).toContain("Price quote 2026 - History");
    });
    expect(window.location.hash).toBe("#/history/T-QUOTE");
  });
});

describe("row menu (wireframe 03, smoke defect 6)", () => {
  const rows = () => [...main().querySelectorAll("tbody tr")];
  const titles = () => rows().map((row) => titleOf(row));
  const titleCell = (title: string) =>
    rows()
      .map((row) => row.children[1] as HTMLElement)
      .find((cell) => titleOf(cell) === title) as HTMLElement;
  const menuLabels = () =>
    [...document.querySelectorAll('[role="menuitem"]')].map(
      (item) => item.textContent,
    );
  const status = () => main().querySelector(".templates .status")?.textContent;

  async function library(): Promise<void> {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(rows()).toHaveLength(4);
    });
  }

  it("opens with Shift+F10, moves with arrows, and Esc returns focus to the cell", async () => {
    await library();
    const cell = titleCell("Discount approval");
    cell.focus();
    key(cell, "F10", { shiftKey: true });
    expect(menuLabels()).toEqual([
      "Edit",
      "Duplicate",
      "Move...",
      "History",
      "Delete...",
    ]);
    expect(document.activeElement?.textContent).toBe("Edit");
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    key(menu, "ArrowUp");
    expect(document.activeElement?.textContent).toBe("Delete...");
    key(menu, "Escape");
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(cell);
    expect(cell.tabIndex).toBe(0);
  });

  it("shows no menu on a row where the caller holds only use", async () => {
    await library();
    const cell = titleCell("Ticket received");
    expect(
      cell.parentElement?.querySelector('[aria-haspopup="menu"]'),
    ).toBeNull();
    key(cell, "F10", { shiftKey: true });
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("duplicates and focuses the copy", async () => {
    await library();
    (
      main().querySelector(
        '[aria-label="Actions for Welcome email"]',
      ) as HTMLButtonElement
    ).click();
    (
      [...document.querySelectorAll('[role="menuitem"]')].find(
        (item) => item.textContent === "Duplicate",
      ) as HTMLElement
    ).click();
    expect(status()).toBe("Duplicating...");
    await until(() => {
      expect(status()).toBe('Duplicated as "Copy of Welcome email".');
    });
    expect(titles()).toContain("Copy of Welcome email");
    expect(titleOf(document.activeElement)).toBe("Copy of Welcome email");
  });

  it("moves only to folders with edit, after the dialog", async () => {
    await library();
    const cell = titleCell("Welcome email");
    cell.focus();
    key(cell, "ContextMenu");
    key(document.querySelector('[role="menu"]') as Element, "ArrowDown");
    key(document.querySelector('[role="menu"]') as Element, "ArrowDown");
    key(document.querySelector('[role="menu"]') as Element, "Enter");
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const select = dialog.querySelector("select") as HTMLSelectElement;
    expect([...select.options].map((option) => option.text)).toEqual([
      "HR",
      "My templates",
      "Sales",
      "Sales / Quotes",
    ]);
    select.value = "F-EMPTY";
    button("Move", dialog).click();
    expect(status()).toBe("Moving...");
    await until(() => {
      expect(status()).toBe('Moved "Welcome email" to HR.');
    });
    expect(
      titleCell("Welcome email").parentElement?.children[2]?.textContent,
    ).toBe("HR");
    expect(titleOf(document.activeElement)).toBe("Welcome email");
  });

  it("deletes after confirmation, and Cancel keeps the template", async () => {
    await library();
    const cell = titleCell("Discount approval");
    cell.focus();
    const pickDelete = () => {
      key(document.activeElement as Element, "F10", { shiftKey: true });
      key(document.querySelector('[role="menu"]') as Element, "End");
      key(document.querySelector('[role="menu"]') as Element, "Enter");
      return document.querySelector('[role="dialog"]') as HTMLElement;
    };
    const first = pickDelete();
    expect(document.activeElement).toBe(button("Cancel", first));
    expect(first.textContent).toContain(
      'Delete "Discount approval"? Deleted templates stay in the trash for 30 days.',
    );
    button("Cancel", first).click();
    await until(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    expect(document.activeElement).toBe(cell);
    button("Delete", pickDelete()).click();
    expect(status()).toBe("Deleting...");
    await until(() => {
      expect(status()).toBe('Deleted "Discount approval".');
    });
    expect(titles()).not.toContain("Discount approval");
    expect(rows()).toHaveLength(3);
  });

  it("reports a server refusal in the status line", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=template.duplicate#/library");
    await until(() => {
      expect(rows()).toHaveLength(4);
    });
    const cell = titleCell("Welcome email");
    cell.focus();
    key(cell, "F10", { shiftKey: true });
    key(document.querySelector('[role="menu"]') as Element, "ArrowDown");
    key(document.querySelector('[role="menu"]') as Element, "Enter");
    await until(() => {
      expect(status()).toContain("You don't have access");
    });
  });
});

describe("editor (screen 4, flow 4.2)", () => {
  it("redirects the OVERLAY URL into the hash route and loads the template", async () => {
    await boot("/?latency=0&view=editor&id=T-QUOTE");
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
    });
    expect(window.location.hash).toBe("#/edit/T-QUOTE");
    expect((document.getElementById("title") as HTMLInputElement).value).toBe(
      "Price quote 2026",
    );
    expect((document.getElementById("folder") as HTMLSelectElement).value).toBe(
      "F-QUOTES",
    );
    expect(
      [...main().querySelectorAll(".tag")].map(
        (tag) => tag.firstChild?.textContent,
      ),
    ).toEqual(["pricing", "quotes"]);
    expect(main().querySelector(".saved-state")?.textContent).toMatch(
      /^Saved as version 2, (Nov 9, (2026, )?)?\d{1,2}:\d\d [AP]M$/,
    );
    expect(main().querySelector('[role="toolbar"]')).not.toBeNull();
    await until(() => {
      expect(main().querySelector(".preview-body")?.textContent).toContain(
        "Dev User",
      );
    });
  });

  it("saves with Ctrl+S, disables Save while saving and announces the version", async () => {
    await boot("/?latency=20#/edit/T-QUOTE");
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
    });
    const tagInput = document.getElementById("tag-input") as HTMLInputElement;
    tagInput.value = "new";
    key(tagInput, "Enter");
    key(document.body, "s", { ctrlKey: true });
    const save = main().querySelector<HTMLButtonElement>(
      ".editor-head .primary",
    );
    expect(save?.disabled).toBe(true);
    expect(save?.textContent).toBe("Saving...");
    expect(main().querySelector(".saved-state")?.textContent).toBe("Saving...");
    await until(() => {
      expect(main().querySelector('[role="status"]')?.textContent).toMatch(
        /^Saved as version 3, \d{1,2}:\d\d [AP]M$/,
      );
    });
    expect(save?.disabled).toBe(false);
    // D37: the save's own answer updates the library; no folder.list or template.list after it.
    expect([calls("folder.list"), calls("template.list")]).toEqual([1, 1]);
    (
      main().querySelector('[aria-label="Remove tag new"]') as HTMLButtonElement
    ).click();
    expect(main().querySelectorAll(".tag")).toHaveLength(2);
  });

  it("keeps what is typed during a save and then says Unsaved changes; clicks stay blocked (slice 24 retry 1)", async () => {
    await boot("/?latency=300#/edit/T-QUOTE");
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    const title = document.getElementById("title") as HTMLInputElement;
    const body = main().querySelector(".ProseMirror") as HTMLElement;
    title.value = "Price quote 2027";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    key(document.body, "s", { ctrlKey: true });
    expect(main().hasAttribute("data-blocked")).toBe(true);
    // Typing goes through: keys, Backspace and paste in the title and the text.
    const passes = (target: Element, event: Event) =>
      target.dispatchEvent(event);
    const typed = (name: string) =>
      new KeyboardEvent("keydown", {
        key: name,
        bubbles: true,
        cancelable: true,
      });
    expect(passes(title, typed("x"))).toBe(true);
    expect(passes(title, typed("Backspace"))).toBe(true);
    expect(passes(body, typed("y"))).toBe(true);
    expect(
      passes(body, new Event("paste", { bubbles: true, cancelable: true })),
    ).toBe(true);
    title.value = "Price quote 2027 abc";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    // A click on the sidebar does not go through.
    const trash = document.querySelector("[data-nav=trash]") as HTMLElement;
    expect(
      passes(
        trash,
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    ).toBe(false);
    await until(() => {
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    expect(title.value).toBe("Price quote 2027 abc");
    expect(main().querySelector(".saved-state")?.textContent).toBe(
      "Unsaved changes",
    );
    expect(window.location.hash).toBe("#/edit/T-QUOTE");
  });

  it("edits the subject: counter, placeholder menu at the caret, preview and save", async () => {
    await boot("/?latency=0#/edit/T-QUOTE");
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
    });
    const subject = document.getElementById("subject") as HTMLInputElement;
    expect(subject.value).toBe("Quote for {{ask:Product name}}");
    expect(document.querySelector('label[for="subject"]')?.textContent).toBe(
      "Subject",
    );
    expect(document.getElementById("subject-count")?.textContent).toBe(
      "30/200 (optional)",
    );
    subject.focus();
    subject.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    subject.setSelectionRange(0, 0);
    button("Insert field").click();
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    (
      items.find((item) => item.textContent === "Sender name") as HTMLElement
    ).click();
    expect(subject.value).toBe("{{sender.name}}Quote for {{ask:Product name}}");
    expect(document.activeElement).toBe(subject);
    await until(() => {
      expect(main().querySelector(".preview-subject")?.textContent).toBe(
        "Subject: Dev UserQuote for [Product name]",
      );
    });
    subject.value = "Hi {{sender.nmae}}";
    subject.dispatchEvent(new Event("input"));
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".problems")?.textContent).toContain(
        "Error: Subject: Unknown field sender.nmae",
      );
    });
    subject.value = "Offer";
    subject.dispatchEvent(new Event("input"));
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".saved-state")?.textContent).toMatch(
        /^Saved as version 3, /,
      );
    });
    expect(
      (
        (await harnessCall("template.get", { id: "T-QUOTE" })) as unknown as {
          data: { item: { subject: string } };
        }
      ).data.item.subject,
    ).toBe("Offer");
  });

  it("lists validation problems from the server", async () => {
    await boot("/?latency=0#/edit/T-QUOTE");
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
    });
    (document.getElementById("title") as HTMLInputElement).value = " ";
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".problems")?.textContent).toContain(
        "Error: Title must be 1 to 120 characters",
      );
    });
    expect(main().querySelector(".problems")?.getAttribute("role")).toBe(
      "alert",
    );
  });

  it("shows warnings after a save and creates a new template", async () => {
    await boot("/?latency=0#/new?folder=F-QUOTES");
    await until(() => {
      expect(main().querySelector(".ProseMirror")).not.toBeNull();
    });
    (document.getElementById("title") as HTMLInputElement).value = "Fresh";
    button("Insert field").click();
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')].map(
        (item) => item.textContent,
      ),
    ).toContain("Ask the sender...");
    key(menu, "ArrowDown");
    key(menu, "End");
    key(menu, "ArrowUp");
    key(menu, "ArrowUp");
    key(menu, "ArrowUp");
    key(menu, "Enter");
    await until(() => {
      expect(main().querySelector(".ph")?.textContent).toBe(
        "Recipient first name",
      );
    });
    button("Save").click();
    await until(() => {
      expect(window.location.hash).toMatch(/^#\/edit\/T-\d+$/);
    });
    expect(main().querySelector(".problems")?.textContent).toContain(
      "Warning: Recipient first name has no default text",
    );
  });

  it("asks before overwriting a newer version: open theirs, copy mine, cancel", async () => {
    await boot("/?latency=0#/edit/T-DISCOUNT");
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
    });
    expect((await otherTabSave("T-DISCOUNT", 1)).ok).toBe(true);
    const save = button("Save");
    save.focus();
    save.click();
    await until(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("saved version 2 at");
    expect(
      [...dialog.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["Open their version", "Copy my text", "Cancel"]);
    expect(document.activeElement?.textContent).toBe("Open their version");
    key(document.activeElement as Element, "Tab", { shiftKey: true });
    expect(document.activeElement?.textContent).toBe("Cancel");
    key(document.activeElement as Element, "Tab");
    expect(document.activeElement?.textContent).toBe("Open their version");
    key(dialog, "Escape");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(save);
    save.click();
    await until(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    button("Copy my text").click();
    await until(() => {
      expect(main().querySelector(".status")?.textContent).toContain(
        "Not copied",
      );
    });
    save.click();
    await until(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    button("Open their version").click();
    await until(() => {
      expect(main().querySelector(".ProseMirror")?.textContent).toBe("theirs");
    });
    expect(main().querySelector(".saved-state")?.textContent).toMatch(
      /^Saved as version 2, /,
    );
  });

  it("opens their version of a template created in this tab (smoke defect 1)", async () => {
    await boot("/?latency=0#/new?folder=F-QUOTES");
    await until(() => {
      expect(main().querySelector(".ProseMirror")).not.toBeNull();
    });
    (document.getElementById("title") as HTMLInputElement).value = "Mine";
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".saved-state")?.textContent).toMatch(
        /^Saved as version 1, /,
      );
    });
    const id = window.location.hash.replace("#/edit/", "");
    expect((await otherTabSave(id, 1)).ok).toBe(true);
    button("Save").click();
    await until(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    button("Open their version").click();
    await until(() => {
      expect(main().querySelector(".ProseMirror")?.textContent).toBe("theirs");
    });
    expect(main().querySelector(".saved-state")?.textContent).toMatch(
      /^Saved as version 2, /,
    );
    expect(main().querySelector(".status")?.textContent).toBe(
      "Opened their version. Your changes were discarded.",
    );
  });

  it("returns focus to Save when the conflict dialog closes after Ctrl+S in the body (smoke defect 2)", async () => {
    await boot("/?latency=0#/edit/T-WELCOME");
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
    });
    expect((await otherTabSave("T-WELCOME", 1)).ok).toBe(true);
    const body = main().querySelector(".ProseMirror") as HTMLElement;
    body.focus();
    key(body, "s", { ctrlKey: true });
    await until(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    key(document.querySelector('[role="dialog"]') as Element, "Escape");
    expect(document.activeElement).toBe(button("Save"));
  });
});

describe("history (screen 5)", () => {
  it("starts no second restore from a toast's Retry while one runs (slice 24 retry 1)", async () => {
    await boot(
      "/?latency=50&fail=INTERNAL&failOp=version.restore&failTimes=2#/history/T-QUOTE",
    );
    await until(() => {
      expect(main().querySelectorAll('[role="option"]')).toHaveLength(2);
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    const list = main().querySelector('[role="listbox"]') as HTMLElement;
    key(list, "ArrowDown");
    const restoreFails = async (count: number) => {
      await until(() => {
        expect(main().hasAttribute("data-blocked")).toBe(false);
      });
      key(list, "r");
      button(
        "Restore",
        document.querySelector('[role="dialog"]') as HTMLElement,
      ).click();
      await until(() => {
        expect(document.querySelectorAll(".toast")).toHaveLength(count);
      });
    };
    await restoreFails(1);
    await restoreFails(2);
    const [first, second] = [
      ...document.querySelectorAll<HTMLElement>(".toast"),
    ];
    button("Retry", first).click();
    button(
      "Restore",
      document.querySelector('[role="dialog"]') as HTMLElement,
    ).click();
    await Promise.resolve();
    button("Retry", second).click();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await until(() => {
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    expect(calls("version.restore")).toBe(3);
  });

  it("lists versions, previews with chips and restores with confirmation", async () => {
    await boot("/?latency=0#/history/T-QUOTE");
    await until(() => {
      expect(main().querySelectorAll('[role="option"]')).toHaveLength(2);
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    const list = main().querySelector('[role="listbox"]') as HTMLElement;
    expect(list.getAttribute("aria-activedescendant")).toBe("version-2");
    expect(document.activeElement).toBe(list);
    key(list, "ArrowDown");
    key(list, "Enter");
    await until(() => {
      expect(main().querySelector(".preview h2")?.textContent).toContain(
        "Version 1",
      );
    });
    const heading = main().querySelector(".preview h2") as HTMLElement;
    expect(heading.textContent).toMatch(
      /^Version 1, Nov \d+, \d+:\d\d [AP]M, Dev U\. \(dev\.user@example\.com\)$/,
    );
    expect(heading.querySelector("[title]")?.getAttribute("title")).toBe(
      "dev.user@example.com",
    );
    await until(() => {
      expect(
        main().querySelector(".preview-body .ph")?.getAttribute("aria-label"),
      ).toBe("Field: Recipient first name, default text there");
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    key(list, "r");
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain("Create version 3 from version 1?");
    button("Restore", dialog).click();
    await Promise.resolve();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(main().querySelector(".status")?.textContent).toBe(
      "Restoring version 1...",
    );
    expect(list.getAttribute("aria-busy")).toBe("true");
    await until(() => {
      expect(main().querySelector(".status")?.textContent).toBe(
        "Restored as version 3.",
      );
    });
    await until(() => {
      expect(main().querySelectorAll('[role="option"]')).toHaveLength(3);
    });
    expect(main().querySelector('[role="option"]')?.textContent).toContain(
      "restored from 1",
    );
  });

  it("shows the subject line of a version with chips", async () => {
    await boot("/?latency=0#/history/T-QUOTE");
    await until(() => {
      expect(main().querySelector(".preview-subject")?.textContent).toBe(
        "Subject: Quote for Product name",
      );
    });
    expect(
      main().querySelector(".preview-subject .ph")?.getAttribute("aria-label"),
    ).toBe("Field: Product name, the sender fills it in");
  });
});

describe("shell (slice 8a)", () => {
  async function library(): Promise<void> {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
  }

  describe("narrow-screen panel (modal while open)", () => {
    const side = () => document.getElementById("side") as HTMLElement;
    const menu = () =>
      document.getElementById("menu-button") as HTMLButtonElement;
    const isOpen = () => side().classList.contains("open");

    async function openPanel(): Promise<void> {
      await library();
      await until(() => {
        expect(document.querySelector("[data-nav=admin]")).not.toBeNull();
      });
      expect(menu().getAttribute("aria-label")).toBe("Menu");
      menu().click();
      expect(menu().getAttribute("aria-expanded")).toBe("true");
      expect(isOpen()).toBe(true);
    }

    it("makes the page behind inert while open, and live again after", async () => {
      await openPanel();
      expect(main().hasAttribute("inert")).toBe(true);
      expect(main().getAttribute("aria-hidden")).toBe("true");
      menu().click();
      expect(isOpen()).toBe(false);
      expect(main().hasAttribute("inert")).toBe(false);
      expect(main().hasAttribute("aria-hidden")).toBe(false);
    });

    it("wraps Tab and Shift+Tab inside the panel", async () => {
      await openPanel();
      const admin = document.querySelector("[data-nav=admin]") as HTMLElement;
      admin.focus();
      key(admin, "Tab");
      expect(document.activeElement).toBe(menu());
      key(menu(), "Tab", { shiftKey: true });
      expect(document.activeElement).toBe(admin);
      expect(isOpen()).toBe(true);
    });

    it("closes with Esc and returns focus to the menu button", async () => {
      await openPanel();
      const trash = document.querySelector("[data-nav=trash]") as HTMLElement;
      trash.focus();
      key(trash, "Escape");
      expect(isOpen()).toBe(false);
      expect(menu().getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(menu());
    });

    it("closes on a press outside the panel, and not on a press inside", async () => {
      await openPanel();
      side().dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(isOpen()).toBe(true);
      main().dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(isOpen()).toBe(false);
      expect(main().hasAttribute("inert")).toBe(false);
    });

    it("closes when a nav item is chosen", async () => {
      await openPanel();
      const trash = document.querySelector("[data-nav=trash]") as HTMLElement;
      trash.click();
      expect(isOpen()).toBe(false);
      expect(main().hasAttribute("inert")).toBe(false);
      expect(window.location.hash).toBe("#/trash");
      expect(trash.hasAttribute("aria-current")).toBe(true);
    });

    it("closes when the window grows past 860 px", async () => {
      await openPanel();
      mediaListeners.at(-1)?.({ matches: true });
      expect(isOpen()).toBe(false);
      expect(main().hasAttribute("inert")).toBe(false);
    });
  });

  it("opens Favorites from another view", async () => {
    await boot("/?latency=0#/trash");
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(1);
    });
    (document.querySelector("[data-nav=favorites]") as HTMLElement).click();
    await until(() => {
      expect(main().querySelectorAll("tbody tr")).toHaveLength(1);
    });
    expect(main().querySelector("#list-heading")?.textContent).toBe(
      "Favorites",
    );
    expect(window.location.hash).toBe("#/library");
  });

  it("opens a folder of the sidebar tree from another view", async () => {
    await boot("/?latency=0#/trash");
    await until(() => {
      expect(sideTree().querySelectorAll('[role="treeitem"]')).toHaveLength(4);
      expect(main().hasAttribute("data-blocked")).toBe(false);
    });
    (
      [...sideTree().querySelectorAll('[role="treeitem"]')].find(
        (item) => item.textContent === "Support",
      ) as HTMLElement
    ).click();
    await until(() => {
      expect(main().querySelector("#list-heading")?.textContent).toBe(
        "Support",
      );
    });
    expect(window.location.hash).toBe("#/library?folder=F-SUPPORT");
    expect(
      sideTree().querySelector('[aria-selected="true"]')?.textContent,
    ).toBe("Support");
  });

  it("names every icon-only button and hides every icon", async () => {
    await library();
    const buttons = [...document.querySelectorAll("button")];
    expect(buttons.length).toBeGreaterThan(10);
    for (const found of buttons)
      expect(
        found.textContent.trim() !== "" || found.hasAttribute("aria-label"),
      ).toBe(true);
    for (const svg of document.querySelectorAll("svg.i"))
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelectorAll("#i-star, #i-more, #i-menu")).toHaveLength(
      3,
    );
    expect(document.querySelector("svg.logo")?.getAttribute("aria-label")).toBe(
      "Migway",
    );
  });

  it("skips the columns the narrow layout hides when arrows move along a row", async () => {
    await library();
    for (const row of main().querySelectorAll("tbody tr"))
      for (const index of [3, 5])
        (row as HTMLTableRowElement).cells[index]?.setAttribute(
          "style",
          "display: none",
        );
    const row = main().querySelector("tbody tr") as HTMLTableRowElement;
    const folder = row.cells[2] as HTMLTableCellElement;
    folder.focus();
    key(folder, "ArrowRight");
    expect(document.activeElement).toBe(row.cells[4]);
    key(document.activeElement as Element, "ArrowRight");
    expect(document.activeElement).toBe(row.cells[6]);
    key(document.activeElement as Element, "ArrowLeft");
    key(document.activeElement as Element, "ArrowLeft");
    expect(document.activeElement).toBe(folder);
    key(folder, "End");
    expect(document.activeElement).toBe(row.cells[6]);
    key(document.activeElement as Element, "Home");
    expect(document.activeElement).toBe(row.cells[0]);
  });

  it("shows Delete in red after a divider, and its confirm button as destructive", async () => {
    await library();
    (
      main().querySelector(
        '[aria-label="Actions for Welcome email"]',
      ) as HTMLButtonElement
    ).click();
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    const remove = [...menu.querySelectorAll('[role="menuitem"]')].at(-1);
    expect(remove?.textContent).toBe("Delete...");
    expect(remove?.classList.contains("destructive")).toBe(true);
    expect(remove?.previousElementSibling?.getAttribute("role")).toBe(
      "separator",
    );
    (remove as HTMLElement).click();
    expect(
      button("Delete", document.querySelector('[role="dialog"]') as HTMLElement)
        .className,
    ).toBe("destructive");
  });
});

describe("states (spec section 7, wireframe 07)", () => {
  it("personal templates off: the own folder says why there is no New template", async () => {
    await boot("/?latency=0&personal=off#/library?folder=F-MINE");
    await until(() => {
      expect(text()).toContain("No templates in My templates.");
    });
    const note = main().querySelector('[role="note"]') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe(
      "Personal templates are turned off by your admin. You can still insert these templates.",
    );
    expect(() => button("New template")).toThrow();
    window.location.hash = "#/library?folder=F-EMPTY";
    await until(() => {
      expect(text()).toContain("No templates in HR.");
    });
    expect((main().querySelector('[role="note"]') as HTMLElement).hidden).toBe(
      true,
    );
    expect(button("New template").disabled).toBe(false);
  });

  it("New template from All templates asks for the folder, the last used one preselected", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const create = button("New template");
    create.focus();
    create.click();
    const choice = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(choice.querySelector("h2")?.textContent).toBe("New template");
    const select = choice.querySelector("select") as HTMLSelectElement;
    expect(document.activeElement).toBe(select);
    // Folders at edit or manage only: Support is `use`.
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "HR",
      "My templates",
      "Sales",
      "Sales / Onboarding",
      "Sales / Quotes",
    ]);
    button("Cancel", choice).click();
    await until(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    expect(document.activeElement).toBe(create);
    create.click();
    const again = document.querySelector('[role="dialog"]') as HTMLElement;
    (again.querySelector("select") as HTMLSelectElement).value = "F-QUOTES";
    button("Create", again).click();
    await until(() => {
      expect(main().querySelector(".editor-title")?.textContent).toBe(
        "New template",
      );
    });
    expect(window.location.hash).toBe("#/new?folder=F-QUOTES");
    expect(document.querySelectorAll("[inert]")).toHaveLength(0);
    window.location.hash = "#/library";
    await until(() => {
      expect(main().querySelector("#list-heading")?.textContent).toBe(
        "All templates",
      );
    });
    button("New template").click();
    const third = document.querySelector('[role="dialog"]') as HTMLElement;
    expect((third.querySelector("select") as HTMLSelectElement).value).toBe(
      "F-QUOTES",
    );
  });

  it("New template from Favorites asks for the folder too", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    (document.querySelector("[data-nav=favorites]") as HTMLElement).click();
    await until(() => {
      expect(main().querySelector("#list-heading")?.textContent).toBe(
        "Favorites",
      );
    });
    button("New template").click();
    expect(document.querySelector('[role="dialog"] select')).not.toBeNull();
  });

  it("personal templates off and no shared folder at edit: no New template anywhere", async () => {
    await boot("/?latency=0&personal=off&access=use#/library");
    await until(() => {
      expect(main().querySelector("#list-heading")?.textContent).toBe(
        "All templates",
      );
    });
    await until(() => {
      expect(main().querySelector('[aria-busy="false"]')).not.toBeNull();
    });
    expect(() => button("New template")).toThrow();
    window.location.hash = "#/library?folder=F-MINE";
    await until(() => {
      expect(main().querySelector("#list-heading")?.textContent).toBe(
        "My templates",
      );
    });
    expect(
      (main().querySelector('[role="note"]') as HTMLElement).textContent,
    ).toBe(
      "Personal templates are turned off by your admin. You can still insert these templates.",
    );
    expect(() => button("New template")).toThrow();
  });

  it("no folder visible: asks the user to get access, no button", async () => {
    await boot("/?latency=0&access=none#/library");
    await until(() => {
      expect(text()).toContain(
        "No templates shared with you yet. Ask your admin for access to a folder.",
      );
    });
    expect(main().querySelector(".empty button")).toBeNull();
  });

  it("no folder yet (a new install): an admin still gets the Admin link", async () => {
    await boot("/?latency=0&access=none#/library");
    await until(() => {
      expect(document.querySelector("[data-nav=admin]")).not.toBeNull();
    });
  });

  it("no folder yet: a user who is no admin gets no Admin link", async () => {
    await boot("/?latency=0&access=none&admin=0#/library");
    await until(() => {
      expect(text()).toContain("No templates shared with you yet.");
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector("[data-nav=admin]")).toBeNull();
  });

  it("DENIED shows a banner with a link to the library", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=template.get#/edit/T-QUOTE");
    await until(() => {
      expect(text()).toContain(
        "You don't have access to this template. Ask a folder manager.",
      );
    });
    expect(main().querySelector(".banner")?.getAttribute("role")).toBe("alert");
    button("Back to the library").click();
    await until(() => {
      expect(window.location.hash).toBe("#/library");
    });
  });

  it("NOT_FOUND shows a banner", async () => {
    await boot("/?latency=0#/history/T-GONE");
    await until(() => {
      expect(text()).toContain("This template was deleted or moved.");
    });
  });

  it("BUSY shows a toast with Retry and the request ID", async () => {
    // Admin draws on its own, so a failed first load keeps it and shows the toast (20a review minor 1).
    await boot("/?latency=0&fail=BUSY&failOp=template.list#/admin");
    await until(() => {
      expect(document.querySelector(".toast")).not.toBeNull();
    });
    const toast = document.querySelector(".toast") as HTMLElement;
    expect(toast.getAttribute("role")).toBe("alert");
    expect(toast.textContent).toContain(
      "The library is busy. Try again in a few seconds.",
    );
    expect(toast.querySelector(".request-id")?.textContent).toMatch(
      /^Request ID [0-9A-Z]+-[0-9A-Z]{6}$/,
    );
    await until(() => {
      expect(main().querySelector('[role="tablist"]')).not.toBeNull();
    });
    expect(main().querySelector(".banner")).toBeNull();
    button("Retry", toast).click();
    expect(document.querySelector(".toast")).toBeNull();
    await until(() => {
      expect(document.querySelector(".toast")).not.toBeNull();
    });
    button("Close").click();
    expect(document.querySelector(".toast")).toBeNull();
  });

  it("shows Loading... from the first paint, before the script runs", () => {
    const html = /<main[^>]*>([\s\S]*?)<\/main>/.exec(INDEX)?.[1] ?? "";
    document.body.innerHTML = html;
    const line = document.querySelector('[role="status"]');
    expect(line?.textContent).toBe("Loading...");
  });

  it("a failed first load shows one plain error with Reload, and Reload loads the page", async () => {
    await boot("/?latency=0&fail=INTERNAL&failOp=template.list#/library");
    await until(() => {
      expect(main().querySelector('[role="alert"]')?.textContent).toContain(
        "Templates could not be loaded. Press Reload to try again.",
      );
    });
    // One message: the banner, no toast (20a review must-fix 2).
    expect(document.querySelectorAll(".toast")).toHaveLength(0);
    button("Reload").click();
    expect(document.activeElement).toBe(main());
    await until(() => {
      expect(main().querySelector('[role="alert"]')).not.toBeNull();
    });
    expect(document.querySelectorAll(".toast")).toHaveLength(0);
    window.history.replaceState(null, "", "/?latency=0#/library");
    button("Reload").click();
    expect(main().querySelector('[role="status"]')?.textContent).toBe(
      "Loading...",
    );
    expect(document.activeElement).toBe(main());
    await until(() => {
      expect(main().querySelectorAll("tbody tr").length).toBeGreaterThan(0);
    });
    expect(main().querySelector('[role="alert"]')).toBeNull();
  });

  it("a first load with no answer in 15 seconds shows the error, and a late answer renders the page", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await boot("/?latency=20000#/library");
      await vi.advanceTimersByTimeAsync(15_000);
      expect(main().querySelector('[role="alert"]')?.textContent).toContain(
        "Press Reload to try again.",
      );
      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(10);
      expect(main().querySelector('[role="alert"]')).toBeNull();
      expect(main().querySelectorAll("tbody tr").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a slow first load never replaces an Admin page that already drew", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await boot("/?latency=20000#/admin");
      await vi.advanceTimersByTimeAsync(15_000);
      expect(main().querySelector("#admin-heading")).not.toBeNull();
      expect(main().textContent).not.toContain("Press Reload");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a first load that is not set up says so in the banner", async () => {
    await boot("/?latency=0&fail=NOT_CONFIGURED&failOp=folder.list#/library");
    await until(() => {
      expect(main().querySelector('[role="alert"]')?.textContent).toContain(
        "Migway Templates is not set up yet. Ask your admin to finish setup.",
      );
    });
    expect(document.querySelectorAll(".toast")).toHaveLength(0);
  });

  it("INTERNAL on save shows the generic toast", async () => {
    await boot(
      "/?latency=0&fail=INTERNAL&failOp=template.update#/edit/T-QUOTE",
    );
    await until(() => {
      expect(main().querySelector(".ph")).not.toBeNull();
    });
    button("Save").click();
    await until(() => {
      expect(document.querySelector(".toast")?.textContent).toContain(
        "Something went wrong. Try again.",
      );
    });
    expect(main().querySelector(".status")?.textContent).toBe("Not saved.");
  });

  it("AUTH_NO_USER replaces the page", async () => {
    await boot("/?latency=0&fail=AUTH_NO_USER&failOp=profile.me#/library");
    await until(() => {
      expect(document.body.textContent).toContain(
        "Cannot identify your Migway account.",
      );
    });
  });
});

describe("slice 8d minors", () => {
  async function library(): Promise<void> {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
  }

  it("makes the page behind a dialog inert and hidden, and returns focus on close", async () => {
    await library();
    const cell = main().querySelector<HTMLElement>(
      'tbody [role="row"] [role="gridcell"]:nth-child(2)',
    ) as HTMLElement;
    cell.focus();
    key(cell, "F10", { shiftKey: true });
    (
      [...document.querySelectorAll('[role="menuitem"]')].at(-1) as HTMLElement
    ).click();
    const shell = document.querySelector(".shell") as HTMLElement;
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(shell.hasAttribute("inert")).toBe(true);
    expect(shell.getAttribute("aria-hidden")).toBe("true");
    // The toasts stay live, so an error during the dialog is still announced.
    expect(document.getElementById("toasts")?.hasAttribute("inert")).toBe(
      false,
    );
    key(document.querySelector('[role="dialog"]') as Element, "Escape");
    expect(shell.hasAttribute("inert")).toBe(false);
    expect(shell.hasAttribute("aria-hidden")).toBe(false);
    expect(document.activeElement).toBe(cell);
  });

  it("gives screen readers the full address in the library By column, next to the tooltip", async () => {
    await library();
    const who = main().querySelector("tbody .who") as HTMLElement;
    const address = who.getAttribute("title") ?? "";
    expect(address).toMatch(/@example\.com$/);
    expect(who.querySelector(".sr-only")?.textContent).toBe(` (${address})`);
  });

  it("gives screen readers the full address in the history version rows", async () => {
    await boot("/?latency=0#/history/T-QUOTE");
    await until(() => {
      expect(main().querySelectorAll('[role="option"]')).toHaveLength(2);
    });
    expect(
      main().querySelector('[role="option"] .version-meta .sr-only')
        ?.textContent,
    ).toBe(" (ben@example.com)");
  });
});
