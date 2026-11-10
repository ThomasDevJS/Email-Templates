// @vitest-environment jsdom
/**
 * The web app shell on the dev harness (fake google.script, in-memory server) in jsdom: views, states,
 * keyboard paths and the save flow.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { stubLayout } from "./domStubs";

const INDEX = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "src", "web", "index.html"),
  "utf8",
);

beforeAll(stubLayout);

afterEach(() => {
  vi.resetModules();
  document.body.replaceChildren();
});

/** Loads the page at `url` (path, query and hash) with a fresh harness and app. */
async function boot(url: string): Promise<void> {
  window.history.replaceState(null, "", url);
  const body = /<body>([\s\S]*)<\/body>/.exec(INDEX)?.[1] ?? "";
  document.body.innerHTML = body
    .replace(/<script>[\s\S]*<\/script>/, "")
    .replace(/<\?=\s*\w+\s*\?>/g, "");
  await import("../../../src/web/dev-harness");
  await import("../../../src/web/app");
}

const main = () => document.getElementById("main") as HTMLElement;
const text = () => main().textContent;

async function until(check: () => void): Promise<void> {
  await vi.waitFor(check, { timeout: 2000, interval: 5 });
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
  const run = (
    window as unknown as { google: { script: { run: HarnessRun } } }
  ).google.script.run;
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
    await until(() => {
      expect(main().querySelectorAll(".skeleton-row")).toHaveLength(8);
    });
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
    expect(
      main()
        .querySelector('[role="tree"]')
        ?.querySelectorAll('[role="treeitem"]'),
    ).toHaveLength(5);
    const star = main().querySelector<HTMLButtonElement>(".star");
    expect(star?.disabled).toBe(true);
    expect(star?.title).toBe("Slice 5");
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
      [...main().querySelectorAll('tbody [role="row"]')].map(
        (row) => row.children[1]?.textContent,
      ),
    ).toEqual(["Welcome email"]);
    search.value = "qoute";
    search.dispatchEvent(new Event("input"));
    expect(text()).toContain(
      'No templates match "qoute". Try folder: or tag:.',
    );
  });

  it("moves through the tree with arrow keys and opens a folder with Enter", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('[role="treeitem"]')).toHaveLength(5);
    });
    const tree = main().querySelector('[role="tree"]') as HTMLElement;
    const focused = () => tree.querySelector('[tabindex="0"]') as HTMLElement;
    expect(focused().textContent).toBe("All templates");
    key(focused(), "ArrowDown");
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
    key(focused(), "Home");
    key(focused(), "ArrowUp");
    key(focused(), "ArrowDown");
    expect(focused().textContent).toBe("HR");
    key(focused(), "Enter");
    await until(() => {
      expect(text()).toContain("No templates in HR.");
    });
    expect(window.location.hash).toBe("#/library?folder=F-EMPTY");
    expect(document.activeElement?.textContent).toBe("HR");
    expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
    button(
      "+ New template",
      main().querySelector(".empty") as HTMLElement,
    ).click();
    await until(() => {
      expect(main().querySelector(".editor-title")?.textContent).toBe(
        "New template",
      );
    });
  });

  it("keeps focus in the tree after a click or Enter, so arrows and Enter go on working (smoke defect 7)", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const items = () => [...main().querySelectorAll('[role="treeitem"]')];
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
    expect(document.activeElement?.textContent).toBe("Price quote 2026");
    key(document.activeElement as Element, "End");
    key(document.activeElement as Element, "Enter");
    await until(() => {
      expect(text()).toContain("Price quote 2026 - History");
    });
    expect(window.location.hash).toBe("#/history/T-QUOTE");
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
    expect(main().querySelector(".version")?.textContent).toBe("Version 2");
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
      ".editor-header .primary",
    );
    expect(save?.disabled).toBe(true);
    expect(save?.textContent).toBe("Saving...");
    await until(() => {
      expect(main().querySelector('[role="status"]')?.textContent).toMatch(
        /^Saved as version 3, \d\d:\d\d$/,
      );
    });
    expect(save?.disabled).toBe(false);
    expect(main().querySelector(".version")?.textContent).toBe("Version 3");
    (
      main().querySelector('[aria-label="Remove tag new"]') as HTMLButtonElement
    ).click();
    expect(main().querySelectorAll(".tag")).toHaveLength(2);
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
    button("{{ Placeholder").click();
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')].map(
        (item) => item.textContent,
      ),
    ).toContain("Ask the user...");
    key(menu, "ArrowDown");
    key(menu, "End");
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
      "Warning: recipient.first_name has no fallback",
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
        "Copy failed",
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
    expect(main().querySelector(".version")?.textContent).toBe("Version 2");
  });

  it("opens their version of a template created in this tab (smoke defect 1)", async () => {
    await boot("/?latency=0#/new?folder=F-QUOTES");
    await until(() => {
      expect(main().querySelector(".ProseMirror")).not.toBeNull();
    });
    (document.getElementById("title") as HTMLInputElement).value = "Mine";
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".version")?.textContent).toBe("Version 1");
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
    expect(main().querySelector(".version")?.textContent).toBe("Version 2");
    expect(main().querySelector(".status")?.textContent).toBe(
      "Loaded the latest version. Your changes were discarded.",
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
  it("lists versions, previews with chips and restores with confirmation", async () => {
    await boot("/?latency=0#/history/T-QUOTE");
    await until(() => {
      expect(main().querySelectorAll('[role="option"]')).toHaveLength(2);
    });
    const list = main().querySelector('[role="listbox"]') as HTMLElement;
    expect(list.getAttribute("aria-activedescendant")).toBe("version-2");
    key(list, "ArrowDown");
    key(list, "Enter");
    await until(() => {
      expect(main().querySelector(".preview h2")?.textContent).toContain(
        "Version 1",
      );
    });
    await until(() => {
      expect(
        main().querySelector(".preview-body .ph")?.getAttribute("aria-label"),
      ).toBe("Placeholder: recipient first name | there");
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
});

describe("states (spec section 7, wireframe 07)", () => {
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
      expect(text()).toContain("This template was removed or moved.");
    });
  });

  it("BUSY shows a toast with Retry and the request ID", async () => {
    await boot("/?latency=0&fail=BUSY&failOp=template.list#/library");
    await until(() => {
      expect(document.querySelector(".toast")).not.toBeNull();
    });
    const toast = document.querySelector(".toast") as HTMLElement;
    expect(toast.getAttribute("role")).toBe("alert");
    expect(toast.textContent).toContain("Busy, try again.");
    expect(toast.querySelector(".request-id")?.textContent).toMatch(
      /^Request ID [0-9A-Z]+-[0-9A-Z]{6}$/,
    );
    expect(text()).toContain("Templates could not be loaded.");
    button("Retry", toast).click();
    expect(document.querySelector(".toast")).toBeNull();
    await until(() => {
      expect(document.querySelector(".toast")).not.toBeNull();
    });
    button("Dismiss").click();
    expect(document.querySelector(".toast")).toBeNull();
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
        "Something went wrong. Retry.",
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
