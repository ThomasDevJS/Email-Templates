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
        (row) => row.cells[1]?.textContent === title,
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
    const filter = button("★ Favorites");
    filter.click();
    expect(filter.getAttribute("aria-pressed")).toBe("true");
    expect(
      [...main().querySelectorAll("tbody tr")].map(
        (row) => (row as HTMLTableRowElement).cells[1]?.textContent,
      ),
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
        "No favorites in All templates. Use the star in a row to add one.",
      );
    });
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
      [...main().querySelectorAll('tbody [role="row"]')].map(
        (row) => row.children[1]?.textContent,
      ),
    ).toEqual(["Price quote 2026"]);
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
      main().querySelector(
        '[aria-label="Matches in text"] tbody tr td:nth-child(2)',
      )?.textContent,
    ).toBe("Price quote 2026");
    expect(text()).not.toContain("Searching text...");
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
        'No templates match "interest". Try folder: or tag:.',
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
      [...main().querySelectorAll('tbody [role="row"]')].map(
        (row) => row.children[1]?.textContent,
      ),
    ).toEqual(["Welcome email"]);
    search.value = "qoute";
    search.dispatchEvent(new Event("input"));
    await until(() => {
      expect(text()).toContain(
        'No templates match "qoute". Try folder: or tag:.',
      );
    });
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
  const titles = () => rows().map((row) => row.children[1]?.textContent);
  const titleCell = (title: string) =>
    rows()
      .map((row) => row.children[1] as HTMLElement)
      .find((cell) => cell.textContent === title) as HTMLElement;
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
    expect(document.activeElement?.textContent).toBe("Copy of Welcome email");
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
    expect(document.activeElement?.textContent).toBe("Welcome email");
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
    button("{{ Placeholder").click();
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
        "Error: Subject: Unknown placeholder sender.nmae",
      );
    });
    subject.value = "Offer";
    subject.dispatchEvent(new Event("input"));
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".version")?.textContent).toBe("Version 3");
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
    expect(document.activeElement).toBe(list);
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

  it("shows the subject line of a version with chips", async () => {
    await boot("/?latency=0#/history/T-QUOTE");
    await until(() => {
      expect(main().querySelector(".preview-subject")?.textContent).toBe(
        "Subject: Quote for Ask: Product name",
      );
    });
    expect(
      main().querySelector(".preview-subject .ph")?.getAttribute("aria-label"),
    ).toBe("Placeholder: ask: product name");
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
