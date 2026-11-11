// @vitest-environment jsdom
/**
 * Admin view (wireframe 06) and Trash (wireframe 07 H) on the dev harness in jsdom: entry and DENIED, tablist keys,
 * folder and grant writes with busy status, conflict, memberships, restore with a folder picker, purge.
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
const status = () =>
  [...main().querySelectorAll('[role="status"]')]
    .map((node) => node.textContent)
    .join(" ");

async function until(check: () => void): Promise<void> {
  await vi.waitFor(check, { timeout: 2000, interval: 5 });
}

function key(target: Element, name: string): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true }),
  );
}

function button(label: string, root: ParentNode = document): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent.trim() === label,
  );
  if (found === undefined) throw new Error(`no button ${label}`);
  return found;
}

function dialog(): HTMLElement {
  return document.querySelector('[role="dialog"]') as HTMLElement;
}

function treeItem(name: string): HTMLElement {
  const found = [
    ...main().querySelectorAll<HTMLElement>('[role="treeitem"]'),
  ].find((item) => item.textContent.replace(/^[▸▾]/, "") === name);
  if (found === undefined) throw new Error(`no tree item ${name}`);
  return found;
}

interface HarnessRun {
  withSuccessHandler(handler: (value: unknown) => void): {
    rpc(op: string, args: unknown, id: string): void;
  };
}

/** One op straight through the harness, as another tab would send it. */
function harnessCall(
  op: string,
  args: unknown,
): Promise<{ ok: boolean; data?: unknown }> {
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

/** Boots `url`, then sends `op` as another tab would, before the view loads its data. */
async function harnessCallAfterBoot(
  url: string,
  op: string,
  args: unknown,
): Promise<void> {
  await boot(url);
  const reply = await harnessCall(op, args);
  expect(reply.ok).toBe(true);
}

/** Counts the calls of `op` from now on, by wrapping `google.script.run`. */
function countCalls(op: string): () => number {
  interface Run {
    withSuccessHandler(handler: (value: unknown) => void): Run;
    withFailureHandler(handler: (error: unknown) => void): Run;
    rpc(op: string, args: unknown, id: string): void;
  }
  const script = (window as unknown as { google: { script: { run: Run } } })
    .google.script;
  let count = 0;
  const wrap = (run: Run): Run => ({
    withSuccessHandler: (handler) => wrap(run.withSuccessHandler(handler)),
    withFailureHandler: (handler) => wrap(run.withFailureHandler(handler)),
    rpc: (name, args, id) => {
      if (name === op) count += 1;
      run.rpc(name, args, id);
    },
  });
  script.run = wrap(script.run);
  return () => count;
}

async function openQuotes(): Promise<void> {
  await until(() => {
    expect(main().querySelector('[role="tablist"]')).not.toBeNull();
  });
  treeItem("Sales").click();
  await until(() => {
    treeItem("Quotes").click();
  });
  await until(() => {
    expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(2);
  });
}

describe("admin view entry", () => {
  it("adds Admin to the rail for a manage holder and opens Folders and grants", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(document.querySelector("[data-nav=admin]")).not.toBeNull();
    });
    (document.querySelector("[data-nav=admin]") as HTMLElement).click();
    await until(() => {
      expect(main().querySelector('[role="tab"]')?.textContent).toBe(
        "Folders and grants",
      );
    });
    expect(
      document.querySelector("[data-nav=admin]")?.hasAttribute("aria-current"),
    ).toBe(true);
    expect(window.location.hash).toBe("#/admin");
  });

  it("opens from ?view=admin", async () => {
    await boot("/?latency=0&view=admin");
    await until(() => {
      expect(main().querySelector('[role="tablist"]')).not.toBeNull();
    });
  });

  it("shows only the DENIED state when the server refuses", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=admin.folders#/admin");
    await until(() => {
      expect(main().querySelector('[role="alert"]')?.textContent).toContain(
        "You don't have access to the admin view.",
      );
    });
    expect(main().querySelector('[role="tablist"]')).toBeNull();
    expect(main().querySelector('[role="tree"]')).toBeNull();
    button("Back to the library").click();
    expect(window.location.hash).toBe("#/library");
  });

  it("shows the error state with the request ID on a server error", async () => {
    await boot("/?latency=0&fail=INTERNAL&failOp=admin.folders#/admin");
    await until(() => {
      expect(document.getElementById("toasts")?.textContent).toContain(
        "Request ID",
      );
    });
    expect(text()).toContain("The admin view could not be loaded.");
  });

  it("gives a manage holder Folders and grants and Export, only for the folders they manage", async () => {
    await boot("/?latency=0&admin=0#/admin/memberships");
    await until(() => {
      expect(
        [...main().querySelectorAll('[role="tab"]')].map((t) => t.textContent),
      ).toEqual(["Folders and grants", "Export and import"]);
    });
    expect(main().querySelector('[aria-selected="true"]')?.textContent).toBe(
      "Folders and grants",
    );
    expect(main().textContent).not.toContain("+ Top-level folder");
    expect(main().textContent).not.toContain("Support");
  });
});

describe("tablist and memberships", () => {
  it("moves between tabs with arrow keys, Home and End, and refreshes memberships", async () => {
    await boot("/?latency=0#/admin");
    await until(() => {
      expect(main().querySelectorAll('[role="tab"]')).toHaveLength(6);
    });
    const tabs = [...main().querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    key(tabs[0] as HTMLElement, "ArrowRight");
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(window.location.hash).toBe("#/admin/memberships");
    expect(
      main()
        .querySelector('[role="tabpanel"]')
        ?.getAttribute("aria-labelledby"),
    ).toBe("tab-memberships");
    await until(() => {
      expect(main().querySelector("tr.warn")?.textContent).toContain(
        "sales@example.com contains emea-sales@example.com",
      );
    });
    expect(text()).toContain(
      "Resolver: groupsapp_direct (direct members only)",
    );
    expect(text()).toMatch(/Last refresh: Nov \d+, \d+:\d\d [AP]M\./);
    const refresh = button("Refresh now");
    refresh.click();
    expect(status()).toContain("Refreshing memberships...");
    expect(refresh.disabled).toBe(true);
    await until(() => {
      expect(status()).toContain("Refreshed 2 groups.");
    });
    expect(document.activeElement).toBe(refresh);
    key(tabs[1] as HTMLElement, "Home");
    expect(document.activeElement).toBe(tabs[0]);
    key(tabs[0] as HTMLElement, "End");
    expect(document.activeElement).toBe(tabs[5]);
    expect(window.location.hash).toBe("#/admin/config");
    key(tabs[5] as HTMLElement, "ArrowRight");
    expect(document.activeElement).toBe(tabs[0]);
    key(tabs[0] as HTMLElement, "ArrowLeft");
    expect(document.activeElement).toBe(tabs[5]);
  });
});

describe("folders and grants", () => {
  it("shows effective access with the inherited source and the inactive OU", async () => {
    await boot("/?latency=0#/admin");
    await openQuotes();
    const rows = [...main().querySelectorAll(".admin-table tbody tr")].map(
      (row) => row.textContent,
    );
    expect(rows[0]).toContain("OU /field");
    expect(rows[0]).toContain(
      "Inactive: OU resolution needs the Directory resolver",
    );
    expect(rows[1]).toContain("Sales (inherited)");
    expect(main().querySelector("h2#folder-heading")?.textContent).toBe(
      "Sales / Quotes",
    );
    // Slice 8c: the type is read before the key and shown as an icon; the level is a tag.
    const principal = main().querySelector(".admin-table tbody .principal");
    expect(principal?.querySelector(".sr-only")?.textContent).toBe("OU ");
    expect(principal?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(
      main().querySelector(".admin-table tbody td:nth-child(2) .tag")
        ?.textContent,
    ).toBe("Use");
  });

  it("asks for a principal under the field and marks it invalid", async () => {
    await boot("/?latency=0#/admin");
    await openQuotes();
    const form = main().querySelector("form") as HTMLFormElement;
    const input = form.querySelector('input[type="text"]') as HTMLInputElement;
    form.dispatchEvent(new Event("submit"));
    const error = document.getElementById(`${input.id}-error`);
    expect(error?.textContent).toBe("Enter a principal.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(
      `${input.id}-error`,
    );
    expect(document.activeElement).toBe(input);
  });

  it("loads the library folders again after a grant change, with no page reload", async () => {
    await boot("/?latency=0#/admin");
    await openQuotes();
    const folderLists = countCalls("folder.list");
    const form = main().querySelector("form") as HTMLFormElement;
    (form.querySelector('input[type="text"]') as HTMLInputElement).value =
      "pat@example.com";
    form.dispatchEvent(new Event("submit"));
    await until(() => {
      expect(status()).toContain("Added group pat@example.com with level use.");
    });
    (document.querySelector("[data-nav=library]") as HTMLElement).click();
    await until(() => {
      expect(folderLists()).toBe(1);
    });
  });

  it("adds and removes a grant with a busy status at once", async () => {
    await boot("/?latency=20#/admin");
    await openQuotes();
    const form = main().querySelector("form") as HTMLFormElement;
    const type = form.querySelector("select") as HTMLSelectElement;
    type.value = "user";
    type.dispatchEvent(new Event("change"));
    expect(form.textContent).toContain("User email");
    const input = form.querySelector('input[type="text"]') as HTMLInputElement;
    expect(form.querySelector(`label[for="${input.id}"]`)?.textContent).toBe(
      "Principal",
    );
    expect(input.maxLength).toBe(254);
    input.value = "pat@example.com";
    form.dispatchEvent(new Event("submit"));
    expect(status()).toContain("Adding grant...");
    await until(() => {
      expect(status()).toContain("Added user pat@example.com with level use.");
    });
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(3);
    });
    button(
      "Remove",
      main().querySelector(".admin-table tbody tr") as HTMLElement,
    ).click();
    expect(status()).toContain("Removing grant...");
    await until(() => {
      expect(status()).toContain("Removed the grant for OU /field.");
    });
  });

  it("keeps the form when the server refuses a group, and asks for an empty principal", async () => {
    await boot("/?latency=0#/admin");
    await openQuotes();
    const form = main().querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit"));
    expect(form.textContent).toContain("Enter a principal.");
    const input = form.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = "missing@example.com";
    form.dispatchEvent(new Event("submit"));
    await until(() => {
      expect(status()).toContain(
        "Group missing@example.com was not found or its members are not visible.",
      );
    });
    expect(status()).not.toContain("Back to the library");
    expect(input.value).toBe("missing@example.com");
  });

  it("creates a top-level folder through the name dialog and selects it", async () => {
    await boot("/?latency=20#/admin");
    await until(() => {
      expect(main().querySelector('[role="tablist"]')).not.toBeNull();
    });
    const opener = button("New top-level folder");
    opener.focus();
    opener.click();
    const input = dialog().querySelector("input") as HTMLInputElement;
    button("OK", dialog()).click();
    expect(dialog().textContent).toContain("1 to 80");
    input.value = "Legal";
    button("OK", dialog()).click();
    await until(() => {
      expect(status()).toContain("Creating folder...");
    });
    await until(() => {
      expect(status()).toContain('Created folder "Legal".');
    });
    expect(main().querySelector("h2#folder-heading")?.textContent).toBe(
      "Legal",
    );
    expect(document.activeElement?.id).toBe("folder-heading");
    await until(() => {
      expect(main().querySelector(".empty")?.textContent).toBe(
        "Only admins can see this folder. Add a grant to share it.",
      );
    });
    (document.querySelector("[data-nav=library]") as HTMLElement).click();
    await until(() => {
      expect(
        [...document.querySelectorAll('#side [role="treeitem"]')].map(
          (item) => item.textContent,
        ),
      ).toContain("Legal");
    });
  });

  it("asks before deleting, Cancel first, and reports a non-empty folder", async () => {
    await boot("/?latency=0#/admin");
    await openQuotes();
    button("Delete...").click();
    expect(dialog().textContent).toContain(
      "Only an empty folder can be deleted.",
    );
    expect(document.activeElement?.textContent).toBe("Cancel");
    button("Delete", dialog()).click();
    expect(status()).toContain("Deleting folder...");
    await until(() => {
      expect(status()).toContain("Only an empty folder can be deleted");
    });
  });

  it("moves a folder after the dialog", async () => {
    await boot("/?latency=0#/admin");
    await openQuotes();
    // One group the narrow layout lays out as 2 by 2 (styles.test.ts), so no button sits alone on a row.
    expect(
      [...main().querySelectorAll(".folder-actions button")].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["New subfolder", "Rename...", "Move...", "Delete..."]);
    button("Move...").click();
    const select = dialog().querySelector("select") as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toContain(
      "Top level",
    );
    select.value = "F-EMPTY";
    button("Move", dialog()).click();
    await until(() => {
      expect(status()).toContain('Moved "Quotes" into HR.');
    });
    expect(main().querySelector("h2#folder-heading")?.textContent).toBe(
      "HR / Quotes",
    );
  });

  it("shows the conflict and reloads when another tab renamed the folder", async () => {
    await boot("/?latency=0#/admin");
    await openQuotes();
    await harnessCall("folder.rename", {
      folderId: "F-QUOTES",
      name: "Offers",
      baseVersion: 1,
    });
    button("Rename...").click();
    (dialog().querySelector("input") as HTMLInputElement).value = "Prices";
    button("OK", dialog()).click();
    await until(() => {
      expect(status()).toContain("Changed by dev.user@example.com at");
    });
    await until(() => {
      expect(main().querySelector("h2#folder-heading")?.textContent).toBe(
        "Sales / Offers",
      );
    });
  });
});

describe("trash", () => {
  it("lists deleted templates with days left and restores into the original folder", async () => {
    vi.useFakeTimers({
      now: Date.parse("2026-11-10T12:00:00Z"),
      toFake: ["Date"],
    });
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    button("Trash").click();
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(1);
    });
    vi.useRealTimers();
    // Title without the snippet line; the author's full address is the avatar's tooltip.
    const cells = [...main().querySelectorAll(".trash-table tbody td")].map(
      (cell) =>
        cell.querySelector(".row-title")?.textContent ??
        cell.querySelector(".who")?.getAttribute("title") ??
        cell.textContent,
    );
    expect(cells.slice(0, 5)).toEqual([
      "Old price list",
      "Sales / Quotes",
      expect.stringMatching(/^Nov 1, \d+:00 [AP]M$/) as unknown as string,
      "ben@example.com",
      "21",
    ]);
    expect(
      main().querySelector(".trash-table tbody .row-sub")?.textContent,
    ).toBe("Prices of last year.");
    button("Restore").click();
    expect(status()).toContain('Restoring "Old price list"...');
    await until(() => {
      expect(status()).toContain(
        'Restored "Old price list" to Sales / Quotes.',
      );
    });
    expect(text()).toContain(
      "Trash is empty. Deleted templates stay here for 30 days.",
    );
    expect(document.activeElement?.id).toBe("trash-heading");
  });

  it("asks for a target folder when the original folder is gone", async () => {
    await boot("/?latency=0#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const made = await harnessCall("folder.create", {
      parentId: "",
      name: "Gone",
    });
    const folderId = (made.data as { id: string }).id;
    const item = await harnessCall("template.create", {
      folderId,
      title: "Lost",
      html: "<p>x</p>",
    });
    const id = (item.data as { id: string }).id;
    await harnessCall("template.delete", { id, baseVersion: 1 });
    await harnessCall("folder.delete", { folderId, baseVersion: 1 });
    button("Trash").click();
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(2);
    });
    const row = [...main().querySelectorAll(".trash-table tbody tr")].find(
      (tr) => tr.textContent.includes("Lost"),
    ) as HTMLElement;
    button("Restore", row).click();
    expect(dialog().textContent).toContain("The folder Gone was deleted.");
    const select = dialog().querySelector("select") as HTMLSelectElement;
    expect(dialog().querySelector(`label[for="${select.id}"]`)).not.toBeNull();
    select.value = "F-EMPTY";
    button("Restore", dialog()).click();
    await until(() => {
      expect(status()).toContain('Restored "Lost" to HR.');
    });
  });

  it("empties the trash after a confirmation, Cancel first", async () => {
    await boot("/?latency=0#/trash");
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(1);
    });
    button("Empty trash now...").click();
    expect(document.activeElement?.textContent).toBe("Cancel");
    expect(dialog().textContent).toContain("This cannot be undone.");
    button("Empty trash", dialog()).click();
    expect(status()).toContain("Emptying the trash...");
    await until(() => {
      expect(status()).toContain(
        "Emptied the trash: 1 template removed for good.",
      );
    });
    expect(text()).toContain("Trash is empty.");
  });

  it("counts from the server's answer when the list cannot be reloaded", async () => {
    await boot("/?latency=0#/trash");
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(1);
    });
    // Only the reload after the purge fails: the counts come from the trash.purge answer.
    window.history.replaceState(
      null,
      "",
      "/?latency=0&fail=INTERNAL&failOp=template.list#/trash",
    );
    button("Empty trash now...").click();
    button("Empty trash", dialog()).click();
    await until(() => {
      expect(status()).toContain(
        "Emptied the trash: 1 template removed for good. The list could not be refreshed.",
      );
    });
  });

  it("counts templates in both the dialog and the result when deleted folders go too", async () => {
    await harnessCallAfterBoot("/?latency=0#/trash", "folder.delete", {
      folderId: "F-EMPTY",
      baseVersion: 1,
    });
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(1);
    });
    button("Empty trash now...").click();
    expect(dialog().textContent).toContain(
      "Empty the trash? The 1 template in it is removed for good, and deleted folders go too.",
    );
    button("Empty trash", dialog()).click();
    await until(() => {
      expect(status()).toContain(
        "Emptied the trash: 1 template and 1 deleted folder removed for good.",
      );
    });
  });

  it("says when the nightly job deletes the stored versions of purged templates", async () => {
    await boot("/?latency=0&pending=2#/trash");
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(1);
    });
    button("Empty trash now...").click();
    button("Empty trash", dialog()).click();
    await until(() => {
      expect(status()).toContain(
        "Emptied the trash: 1 template removed for good. The nightly job deletes the stored versions of 2 of them.",
      );
    });
  });

  it("hides Empty trash from callers who are not admins", async () => {
    await boot("/?latency=0&admin=0#/trash");
    await until(() => {
      expect(main().querySelectorAll(".trash-table tbody tr")).toHaveLength(1);
    });
    expect(text()).not.toContain("Empty trash now");
  });
});

describe("library text search (slice 5b minors 3 and 4)", () => {
  it("announces Searching text in the status region and marks the list busy", async () => {
    await boot("/?latency=50#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "interest";
    search.dispatchEvent(new Event("input"));
    expect(status()).toContain("Searching text...");
    expect(main().querySelector(".list")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    await until(() => {
      expect(main().querySelector(".matches-heading")).not.toBeNull();
    });
    expect(status()).not.toContain("Searching text...");
    expect(main().querySelector(".list")?.getAttribute("aria-busy")).toBe(
      "false",
    );
  });

  it("shows no toast for a failed search.body of a stale query", async () => {
    await boot("/?latency=100&fail=BUSY&failOp=search.body#/library");
    await until(() => {
      expect(main().querySelectorAll('tbody [role="row"]')).toHaveLength(4);
    });
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "interest";
    search.dispatchEvent(new Event("input"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    search.value = "zzz";
    search.dispatchEvent(new Event("input"));
    await until(() => {
      expect(document.querySelectorAll("#toasts .toast")).toHaveLength(1);
    });
    // Both replies are in after 450 ms more: "interest" at about 450 ms, "zzz" at about 750 ms.
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(document.querySelectorAll("#toasts .toast")).toHaveLength(1);
  });
});
