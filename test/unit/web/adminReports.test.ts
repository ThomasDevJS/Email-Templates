// @vitest-environment jsdom
/**
 * Admin tabs of slice 6b on the dev harness in jsdom: Audit log (filters, pages, details drawer), Usage, Export and
 * import, Config with jobs and backup restore. States: loading, error with request ID, DENIED, QUOTA.
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
  vi.restoreAllMocks();
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
const toasts = () => document.getElementById("toasts")?.textContent ?? "";
const status = () =>
  [...main().querySelectorAll('[role="status"]')]
    .map((node) => node.textContent)
    .join(" ");

async function until(check: () => void): Promise<void> {
  await vi.waitFor(check, { timeout: 2000, interval: 5 });
}

function button(label: string, root: ParentNode = document): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent.trim() === label,
  );
  if (found === undefined) throw new Error(`no button ${label}`);
  return found;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the test names the control type
function labelled<T extends HTMLElement>(label: string): T {
  const found = [...main().querySelectorAll("label")].find(
    (candidate) => candidate.textContent.trim() === label,
  );
  const id = found?.getAttribute("for") ?? "";
  const control = document.getElementById(id);
  if (control === null) throw new Error(`no control for ${label}`);
  return control as T;
}

function dialog(): HTMLElement | null {
  return document.querySelector('[role="dialog"]');
}

describe("audit log tab", () => {
  it("lists 50 events per page with the late note, filters by result and pages", async () => {
    await boot("/?latency=0#/admin/audit");
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(50);
    });
    expect(text()).toContain(
      "Denied and apply events can arrive up to 5 min late.",
    );
    expect(status()).toContain("Events 1 to 50 of 60.");
    expect(labelled<HTMLSelectElement>("Month").value).toBe("2026-11");
    for (const label of [
      "Date from",
      "Date to",
      "Actor",
      "Action",
      "Result",
      "Target",
    ])
      expect(labelled(label)).toBeTruthy();
    button("Next page").click();
    expect(main().querySelector('[aria-busy="true"]')).not.toBeNull();
    await until(() => {
      expect(status()).toContain("Events 51 to 60 of 60.");
    });
    expect(button("Next page").disabled).toBe(true);
    labelled<HTMLSelectElement>("Result").value = "denied";
    button("Apply").click();
    await until(() => {
      expect(status()).toContain("of 9.");
    });
    const results = [
      ...main().querySelectorAll(".admin-table tbody td:nth-child(5)"),
    ].map((cell) => cell.textContent);
    expect(new Set(results)).toEqual(new Set(["denied"]));
  });

  it("opens the details drawer with before and after, traps focus and returns it", async () => {
    await boot("/?latency=0#/admin/audit");
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(50);
    });
    const opener = main().querySelector<HTMLButtonElement>(
      ".admin-table tbody button",
    ) as HTMLButtonElement;
    expect(opener.getAttribute("aria-label")).toMatch(/^Details: template\./);
    opener.focus();
    opener.click();
    expect(status()).toContain("Loading event details...");
    await until(() => {
      expect(dialog()?.classList.contains("drawer")).toBe(true);
    });
    const drawer = dialog() as HTMLElement;
    expect(drawer.textContent).toContain("Price quote 2025");
    expect(drawer.textContent).toContain("Price quote 2026");
    expect(drawer.textContent).toContain("Request ID");
    expect(drawer.textContent).toContain("App version");
    expect(drawer.textContent).toContain("ms");
    expect(drawer.contains(document.activeElement)).toBe(true);
    drawer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("shows the empty state when no event matches, and reloads on a month change", async () => {
    await boot("/?latency=0#/admin/audit");
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(50);
    });
    labelled<HTMLInputElement>("Actor").value = "nobody";
    button("Apply").click();
    await until(() => {
      expect(text()).toContain(
        "No audit events in 2026-11 match these filters.",
      );
    });
    const month = labelled<HTMLSelectElement>("Month");
    month.value = "2026-10";
    month.dispatchEvent(new Event("change"));
    expect(status()).toContain("Loading audit events...");
  });

  it("shows the error state with the request ID", async () => {
    await boot("/?latency=0&fail=INTERNAL&failOp=audit.query#/admin/audit");
    await until(() => {
      expect(toasts()).toContain("Request ID");
    });
    expect(text()).toContain("The audit log could not be loaded.");
    expect(main().querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("shows the DENIED banner and the QUOTA toast", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=audit.query#/admin/audit");
    await until(() => {
      expect(main().querySelector(".banner")?.textContent).toContain(
        "You don't have access",
      );
    });
    vi.resetModules();
    document.body.replaceChildren();
    await boot("/?latency=0&fail=QUOTA&failOp=usage.report#/admin/usage");
    await until(() => {
      expect(toasts()).toContain("Service is busy. Try again in a minute.");
    });
  });
});

describe("usage tab", () => {
  it("lists template, folder, applies in 30 days and last used", async () => {
    await boot("/?latency=0#/admin/usage");
    await until(() => {
      expect(
        main().querySelector(".admin-table tbody tr")?.textContent,
      ).toMatch(/^Price quote 2026Sales \/ Quotes112Nov \d+, \d+:\d\d [AP]M$/);
    });
    expect(
      [...main().querySelectorAll(".admin-table th")].map((t) => t.textContent),
    ).toEqual(["Template", "Folder", "Applies 30 d", "Last used"]);
    expect(text()).toContain("never");
  });
});

describe("export and import tab", () => {
  it("downloads the library as one JSON file with a busy status", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:x";
    });
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    await boot("/?latency=0#/admin/transfer");
    await until(() => {
      expect(button("Download JSON")).toBeTruthy();
    });
    expect(labelled<HTMLSelectElement>("Folder").disabled).toBe(true);
    button("Download JSON").click();
    expect(status()).toContain("Exporting...");
    await until(() => {
      expect(status()).toMatch(
        /Exported 4 templates to migway-templates-library-\d{4}-\d{2}-\d{2}\.json\./,
      );
    });
    expect(clicks[0]).toMatch(/^migway-templates-library-/);
    const file = JSON.parse(await (created[0] as Blob).text()) as {
      schemaVersion: number;
      items: { meta: { subject: string } }[];
    };
    expect(file.schemaVersion).toBe(1);
    expect(file.items.map((i) => i.meta.subject)).toContain(
      "Quote for {{ask:Product name}}",
    );
  });

  it("validates a file before Import, then imports into the chosen folder", async () => {
    await boot("/?latency=0#/admin/transfer");
    await until(() => {
      expect(button("Validate")).toBeTruthy();
    });
    const run = button("Import");
    expect(run.disabled).toBe(true);
    const input = labelled<HTMLInputElement>("Export file");
    const content = JSON.stringify({
      schemaVersion: 1,
      items: [
        { meta: { title: "Fresh" }, html: "<p>x</p>" },
        { meta: { title: "Discount approval" }, html: "<p>y</p>" },
      ],
    });
    Object.defineProperty(input, "files", {
      value: [new File([content], "export.json")],
    });
    expect(
      [...labelled<HTMLSelectElement>("Target folder").options].map(
        (o) => o.text,
      ),
    ).not.toContain("My templates");
    labelled<HTMLSelectElement>("Target folder").value = "F-QUOTES";
    input.dispatchEvent(new Event("change"));
    button("Validate").click();
    await until(() => {
      expect(status()).toContain(
        "Validate: would create 1 templates, 1 skipped, 0 failed.",
      );
    });
    expect(text()).toContain(
      "A template with this title is already in this folder",
    );
    expect(run.disabled).toBe(false);
    run.click();
    expect(status()).toContain("Importing...");
    await until(() => {
      expect(status()).toContain("Imported: 1 templates");
    });
    expect(run.disabled).toBe(true);
  });

  it("asks for a file, and refuses a file over the limit before reading it", async () => {
    await boot("/?latency=0#/admin/transfer");
    await until(() => {
      expect(button("Validate")).toBeTruthy();
    });
    button("Validate").click();
    await until(() => {
      expect(status()).toContain("Choose an export file first.");
    });
    const input = labelled<HTMLInputElement>("Export file");
    const big = new File(["x"], "big.json");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    Object.defineProperty(input, "files", { value: [big] });
    button("Validate").click();
    await until(() => {
      expect(status()).toContain("The file is larger than 5 MB.");
    });
  });

  it("gives a manage holder Export folder only", async () => {
    await boot("/?latency=0&admin=0#/admin/transfer");
    await until(() => {
      expect(button("Export folder")).toBeTruthy();
    });
    expect(text()).not.toContain("Whole library");
    expect(text()).not.toContain("Validate");
    expect(
      [...labelled<HTMLSelectElement>("Folder").options].map((o) => o.text),
    ).not.toContain("Support");
  });
});

describe("config tab", () => {
  it("shows the settings, the jobs table with a late job and its error, and backups", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(main().querySelector("tr.late")?.textContent).toContain(
        "late: 2026-11-09T10:15:00.000Z Error: GroupsApp unavailable",
      );
    });
    for (const value of [
      "example.com",
      "admins@example.com",
      "groupsapp_direct",
      "active_user",
      "INDEX_REV",
      "850 KB (warning at 3.00 MB)",
    ])
      expect(text()).toContain(value);
    await until(() => {
      expect(labelled<HTMLSelectElement>("Backup date").value).toBe(
        "2026-11-09",
      );
    });
    expect(text()).toContain("3 daily copies (14 kept).");
  });

  it("restores a backup after a confirmation that names the date, Cancel first", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(button("Restore from backup")).toBeTruthy();
    });
    labelled<HTMLSelectElement>("Backup date").value = "2026-11-08";
    const restore = button("Restore from backup");
    restore.focus();
    restore.click();
    const confirm = dialog() as HTMLElement;
    expect(confirm.textContent).toContain("Restore the backup of 2026-11-08?");
    expect(confirm.textContent).toContain(
      "Every change made after 2026-11-08 is lost",
    );
    expect(confirm.textContent).toContain(
      "Templates emptied from the trash after 2026-11-08 cannot come back",
    );
    expect(document.activeElement?.textContent).toBe("Cancel");
    button("Cancel", confirm).click();
    await until(() => {
      expect(document.activeElement).toBe(restore);
    });
    restore.click();
    button("Restore 2026-11-08", dialog() as HTMLElement).click();
    expect(status()).toContain("Restoring the backup of 2026-11-08...");
    await until(() => {
      expect(status()).toContain("Restored the backup of 2026-11-08.");
    });
  });

  it("shows the empty and error states of the config tab", async () => {
    await boot("/?latency=0&fail=INTERNAL&failOp=config.get#/admin/config");
    await until(() => {
      expect(text()).toContain("The configuration could not be loaded.");
    });
    expect(toasts()).toContain("Request ID");
  });
});
