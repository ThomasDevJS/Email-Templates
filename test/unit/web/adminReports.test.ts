// @vitest-environment jsdom
/**
 * Admin tabs of slice 6b on the dev harness in jsdom: Audit log (filters, pages, details drawer), Usage, Export and
 * import, Config with jobs and backup restore. States: loading, error with request ID, DENIED, QUOTA.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { exportFailedText } from "../../../src/web/views/adminTransfer";
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

const NO_LONGER_ADMIN =
  "You are no longer an admin, so nothing was changed. Ask an admin if you need access.";
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

function radio(root: HTMLElement, label: string): HTMLInputElement {
  const found = [...root.querySelectorAll("label")].find(
    (candidate) => candidate.textContent.trim() === label,
  );
  const input = found?.querySelector("input");
  if (input === null || input === undefined) throw new Error(`no ${label}`);
  return input;
}

function checkedLabel(root: HTMLElement): string {
  return (
    root.querySelector("input:checked")?.closest("label")?.textContent.trim() ??
    ""
  );
}

/** One server op straight through the harness, as another admin's tab would send it. */
function otherTab(op: string, args: unknown): Promise<unknown> {
  const run = (
    window as unknown as {
      google: {
        script: {
          run: {
            withSuccessHandler(handler: (value: unknown) => void): {
              rpc(op: string, args: unknown, id: string): void;
            };
          };
        };
      };
    }
  ).google.script.run;
  return new Promise((resolve) => {
    run.withSuccessHandler(resolve).rpc(op, args, "other-tab");
  });
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
      "Refused actions and inserts can take up to 5 minutes to show here. An export entry records the start of an export, not that the file was downloaded.",
    );
    expect(status()).toContain("Page 1: entries 1 to 50 of 60.");
    expect(labelled<HTMLSelectElement>("Month").value).toBe("2026-11");
    for (const label of [
      "Date from",
      "Date to",
      "User",
      "Action",
      "Result",
      "Template or folder",
    ])
      expect(labelled(label)).toBeTruthy();
    button("Next page").focus();
    button("Next page").click();
    expect(main().querySelector('[aria-busy="true"]')).not.toBeNull();
    await until(() => {
      expect(status()).toContain("Page 2: entries 51 to 60 of 60.");
    });
    expect(button("Next page").disabled).toBe(true);
    // Focus lands on the first row of the new page, not on the body.
    expect(document.activeElement).toBe(
      main().querySelector(".admin-table tbody tr"),
    );
    button("Previous page").click();
    await until(() => {
      expect(status()).toContain("Page 1: entries 1 to 50 of 60.");
    });
    expect(document.activeElement).toBe(
      main().querySelector(".admin-table tbody tr"),
    );
    labelled<HTMLSelectElement>("Result").value = "denied";
    button("Filter").click();
    await until(() => {
      expect(status()).toContain("of 9.");
    });
    const results = [
      ...main().querySelectorAll(".admin-table tbody td:nth-child(5)"),
    ].map((cell) => cell.textContent);
    expect(new Set(results)).toEqual(new Set(["Denied"]));
    // The word is the tag; the tint repeats it.
    expect(
      main().querySelector(".admin-table tbody td:nth-child(5) .tag")
        ?.className,
    ).toBe("tag bad");
  });

  it("shows actions in words, the actor as an avatar with the full address under the name", async () => {
    await boot("/?latency=0#/admin/audit");
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(50);
    });
    const first = main().querySelector(".admin-table tbody tr") as HTMLElement;
    expect(first.querySelector("td:nth-child(3)")?.textContent).toBe(
      "Template updated",
    );
    // Visible text, so keyboard and touch users reach it without a tooltip.
    expect(first.querySelector(".who .who-address")?.textContent).toBe(
      "dev.user@example.com",
    );
    expect(first.querySelector(".who")?.textContent).toBe(
      "DUDev U.dev.user@example.com",
    );
    expect(first.querySelector("td:nth-child(5)")?.textContent).toBe("OK");
    expect(first.querySelector("td:nth-child(5) .tag")?.className).toBe(
      "tag ok",
    );
    expect(
      [...labelled<HTMLSelectElement>("Action").options].map((o) => [
        o.value,
        o.text,
      ]),
    ).toContainEqual(["template.get", "Template opened"]);
  });

  it("opens one drawer for a click and an Enter on the same row", async () => {
    await boot("/?latency=20#/admin/audit");
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(50);
    });
    const opener = main().querySelector<HTMLButtonElement>(
      ".admin-table tbody button",
    ) as HTMLButtonElement;
    opener.click();
    opener.click();
    await until(() => {
      expect(dialog()).not.toBeNull();
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it("opens the details drawer with before and after, traps focus and returns it", async () => {
    await boot("/?latency=0#/admin/audit");
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(50);
    });
    const opener = main().querySelector<HTMLButtonElement>(
      ".admin-table tbody button",
    ) as HTMLButtonElement;
    expect(opener.getAttribute("aria-label")).toMatch(
      /^Details: Template updated at /,
    );
    opener.focus();
    opener.click();
    expect(status()).toContain("Loading entry details...");
    await until(() => {
      expect(dialog()?.classList.contains("drawer")).toBe(true);
    });
    const drawer = dialog() as HTMLElement;
    expect(drawer.textContent).toContain("Price quote 2025");
    expect(drawer.textContent).toContain("Price quote 2026");
    expect(drawer.textContent).toContain("Request ID");
    expect(drawer.textContent).toContain("App version");
    expect(drawer.textContent).toContain("ms");
    const fact = (term: string) =>
      [...drawer.querySelectorAll("dt")]
        .filter((dt) => dt.textContent === term)
        .map((dt) => dt.nextElementSibling?.textContent);
    // The target in words; the raw value sits next to the raw operation name under "Technical details".
    expect(fact("Template or folder")).toEqual(["Sales / Quotes"]);
    expect(fact("Internal ID")).toEqual(["/Sales/Quotes"]);
    expect(fact("Internal name")).toEqual(["template.update"]);
    expect(drawer.querySelector(".facts-heading")?.textContent).toBe(
      "Technical details",
    );
    // The page behind the drawer is inert and hidden from assistive technology.
    const shell = document.querySelector(".shell") as HTMLElement;
    expect(shell.hasAttribute("inert")).toBe(true);
    expect(shell.getAttribute("aria-hidden")).toBe("true");
    expect(drawer.querySelector("pre.json")?.getAttribute("tabindex")).toBe(
      "0",
    );
    expect(drawer.contains(document.activeElement)).toBe(true);
    drawer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(dialog()).toBeNull();
    expect(shell.hasAttribute("inert")).toBe(false);
    expect(shell.hasAttribute("aria-hidden")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("shows the empty state when no event matches, and reloads on a month change", async () => {
    await boot("/?latency=0#/admin/audit");
    await until(() => {
      expect(main().querySelectorAll(".admin-table tbody tr")).toHaveLength(50);
    });
    labelled<HTMLInputElement>("User").value = "nobody";
    button("Filter").click();
    await until(() => {
      expect(text()).toContain(
        "No audit entries in 2026-11 match these filters. Change the filters and press Filter.",
      );
    });
    const month = labelled<HTMLSelectElement>("Month");
    month.value = "2026-10";
    month.dispatchEvent(new Event("change"));
    expect(status()).toContain("Loading audit entries...");
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
    ).toEqual(["Template", "Folder", "Inserts, 30 days", "Last inserted"]);
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
      expect(button("Export")).toBeTruthy();
    });
    expect(labelled<HTMLSelectElement>("Folder").disabled).toBe(true);
    // export.library skips every private folder tree (server transfer.ts libraryFolders).
    expect(text()).toContain(
      "A whole-library export leaves out personal folders (each user's My templates).",
    );
    button("Export").click();
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

  /** Boots the transfer tab on `query`, clicks Export, and records downloads. */
  const exportWith = async (query: string) => {
    const createUrl = vi.fn(() => "blob:x");
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    await boot(`/?latency=0&failOp=export.library&${query}#/admin/transfer`);
    await until(() => {
      expect(button("Export")).toBeTruthy();
    });
    button("Export").click();
    return { clicks, createUrl };
  };
  const waitStatus = (part: string | RegExp) =>
    vi.waitFor(
      () => {
        expect(status()).toMatch(part);
      },
      { timeout: 4000, interval: 10 },
    );

  it("retries a start answered BUSY and then downloads the whole file", async () => {
    const { clicks } = await exportWith("fail=BUSY&failTimes=2");
    await waitStatus(/Exported 4 templates to /);
    expect(clicks).toHaveLength(1);
    expect(toasts()).toBe("");
  });

  it("sends one run key with every try of a start, and a new key for the next click", async () => {
    await boot(
      "/?latency=0&failOp=export.library&fail=BUSY&failTimes=2#/admin/transfer",
    );
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    interface Run {
      withSuccessHandler(handler: (value: unknown) => void): Run;
      withFailureHandler(handler: (error: unknown) => void): Run;
      rpc(op: string, args: unknown, id: string): void;
    }
    const script = (window as unknown as { google: { script: { run: Run } } })
      .google.script;
    const runs: unknown[] = [];
    const wrap = (inner: Run): Run => ({
      withSuccessHandler: (handler) => wrap(inner.withSuccessHandler(handler)),
      withFailureHandler: (handler) => wrap(inner.withFailureHandler(handler)),
      rpc: (op, args, id) => {
        const sent = args as { start?: boolean; run?: unknown };
        if (sent.start === true) runs.push(sent.run);
        inner.rpc(op, args, id);
      },
    });
    script.run = wrap(script.run);
    await until(() => {
      expect(button("Export")).toBeTruthy();
    });
    button("Export").click();
    await waitStatus(/Exported 4 templates to /);
    button("Export").click();
    await until(() => {
      expect(runs).toHaveLength(4);
    });
    expect(new Set(runs.slice(0, 3)).size).toBe(1);
    expect(runs[0]).toMatch(/^[0-9A-Z]{8}-[0-9A-Z]{6}$/);
    expect(runs[3]).not.toBe(runs[0]);
  });

  it("retries a page that failed with a retryable error after the start", async () => {
    const { clicks } = await exportWith("fail=INTERNAL&failSkip=1&failTimes=3");
    await waitStatus(/Exported 4 templates to /);
    expect(clicks).toHaveLength(1);
  });

  it("stops after the retries without an answer, says so and downloads nothing", async () => {
    const { clicks, createUrl } = await exportWith("fail=NETWORK&failSkip=1");
    await waitStatus(
      "The export stopped after 0 of 4 templates: the server did not answer after 4 tries. No file was downloaded, so wait a few minutes and export again.",
    );
    expect(toasts()).toBe("");
    expect(clicks).toEqual([]);
    expect(createUrl).not.toHaveBeenCalled();
    expect(button("Export").disabled).toBe(false);
  });

  it("shows the server's own message when the server answered with an error after the retries", async () => {
    const { clicks, createUrl } = await exportWith("fail=QUOTA&failSkip=1");
    // The reason stays in the line after the toast closes (14 minor 10).
    await waitStatus(
      "The export stopped after 0 of 4 templates and no file was downloaded. Service is busy. Try again in a minute.",
    );
    expect(status()).not.toContain("did not answer");
    expect(toasts()).toContain("Service is busy. Try again in a minute.");
    expect(clicks).toEqual([]);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("says how far an export got when it stops midway and offers no partial file", async () => {
    // Pages of 1: the start and 2 pages pass, the third page gets no answer on any of its 4 tries.
    const { clicks, createUrl } = await exportWith(
      "exportPage=1&fail=NETWORK&failSkip=3",
    );
    await waitStatus(
      "The export stopped after 2 of 4 templates: the server did not answer after 4 tries. No file was downloaded, so wait a few minutes and export again.",
    );
    expect(status()).not.toContain("Exported");
    expect(clicks).toEqual([]);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("counts progress from the live total of each page", async () => {
    await boot(
      "/?latency=0&failOp=export.library&exportPage=1&fail=NETWORK&failSkip=3#/admin/transfer",
    );
    interface Run {
      withSuccessHandler(handler: (value: unknown) => void): Run;
      withFailureHandler(handler: (error: unknown) => void): Run;
      rpc(op: string, args: unknown, id: string): void;
    }
    const script = (window as unknown as { google: { script: { run: Run } } })
      .google.script;
    // A save after the start: every page now counts 5 templates.
    const wrap = (inner: Run): Run => ({
      withSuccessHandler: (handler) =>
        wrap(
          inner.withSuccessHandler((value) => {
            const reply = value as {
              data?: { next?: unknown; total?: number };
            };
            if (reply.data?.next !== undefined) reply.data.total = 5;
            handler(value);
          }),
        ),
      withFailureHandler: (handler) => wrap(inner.withFailureHandler(handler)),
      rpc: (op, args, id) => {
        inner.rpc(op, args, id);
      },
    });
    script.run = wrap(script.run);
    await until(() => {
      expect(button("Export")).toBeTruthy();
    });
    button("Export").click();
    await waitStatus(/^The export stopped after 2 of 5 templates/);
  });

  it("words a failed export from its progress and the server's answer", () => {
    expect(exportFailedText(0, null, null)).toBe(
      "The export did not start: the server did not answer after 4 tries. No file was downloaded, so wait a few minutes and export again.",
    );
    expect(exportFailedText(0, null, "")).toBe(
      "The export did not start and no file was downloaded.",
    );
    // A start of 0 templates did start (14 minor 8).
    expect(exportFailedText(0, 0, "")).toBe(
      "The export stopped after 0 of 0 templates and no file was downloaded.",
    );
    expect(exportFailedText(40, 100, "Ask a folder manager.")).toBe(
      "The export stopped after 40 of 100 templates and no file was downloaded. Ask a folder manager.",
    );
  });

  it("stops at once on a refused page (expired run) and downloads nothing", async () => {
    const { clicks, createUrl } = await exportWith(
      "fail=VALIDATION&failSkip=1&failTimes=1",
    );
    await waitStatus(
      "The export stopped after 0 of 4 templates and no file was downloaded. Simulated VALIDATION.",
    );
    expect(clicks).toEqual([]);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("validates a file before Import, then imports into the chosen folder", async () => {
    await boot("/?latency=0#/admin/transfer");
    await until(() => {
      expect(button("Check file")).toBeTruthy();
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
      [...labelled<HTMLSelectElement>("Import into").options].map(
        (o) => o.text,
      ),
    ).not.toContain("My templates");
    labelled<HTMLSelectElement>("Import into").value = "F-QUOTES";
    input.dispatchEvent(new Event("change"));
    button("Check file").click();
    await until(() => {
      expect(status()).toContain(
        "Checked. Import would create 1 templates, 1 skipped, 0 failed.",
      );
    });
    expect(text()).toContain(
      "A template with this title is already in this folder.",
    );
    const report = [...main().querySelectorAll(".import-report table")];
    expect(report.map((t) => t.querySelector("caption")?.textContent)).toEqual([
      "Check result",
      "Skipped and failed templates and folders",
    ]);
    expect(
      [...(report[0]?.querySelectorAll("tbody td") ?? [])].map(
        (td) => `${td.getAttribute("data-label") ?? ""} ${td.textContent}`,
      ),
    ).toEqual([
      "Templates 1",
      "Skipped 1",
      "Failed 0",
      "New folders 0",
      "Existing folders 0",
    ]);
    expect(run.disabled).toBe(false);
    run.click();
    expect(status()).toContain("Importing...");
    await until(() => {
      expect(status()).toContain("Imported 1 templates");
    });
    expect(run.disabled).toBe(true);
    // The Import button is disabled now, so focus moves to the report it produced.
    expect(document.activeElement).toBe(
      main().querySelector(".import-report table"),
    );
    expect(document.activeElement?.querySelector("caption")?.textContent).toBe(
      "Import result",
    );
  });

  it("asks for a file, and refuses a file over the limit before reading it", async () => {
    await boot("/?latency=0#/admin/transfer");
    await until(() => {
      expect(button("Check file")).toBeTruthy();
    });
    button("Check file").click();
    await until(() => {
      expect(status()).toContain("Choose an export file first.");
    });
    const input = labelled<HTMLInputElement>("Export file");
    const big = new File(["x"], "big.json");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    Object.defineProperty(input, "files", { value: [big] });
    button("Check file").click();
    await until(() => {
      expect(status()).toContain(
        "The file is larger than 5 MB. Export smaller folders and import them one by one.",
      );
    });
  });

  it("gives a manage holder Export folder only", async () => {
    await boot("/?latency=0&admin=0#/admin/transfer");
    await until(() => {
      expect(button("Export folder")).toBeTruthy();
    });
    expect(text()).not.toContain("Whole library");
    expect(text()).not.toContain("Check file");
    expect(
      [...labelled<HTMLSelectElement>("Folder").options].map((o) => o.text),
    ).not.toContain("Support");
  });
});

describe("config tab", () => {
  it("shows the settings, the jobs table with a late job and its error, and backups", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(main().querySelector("tr .tag.warn")?.textContent).toBe("Late");
    });
    // No class marks the late row; the "Late" tag carries it (review 8c minor 9).
    expect(main().querySelector("tr.late")).toBeNull();
    expect(
      main().querySelector("tr .tag.warn")?.closest(".status-cell")
        ?.textContent,
    ).toBe("Late2026-11-09T10:15:00.000Z Error: GroupsApp unavailable");
    for (const value of [
      "example.com",
      "admins@example.com",
      "groupsapp_direct",
      "active_user",
      "INDEX_REV",
      "850 KB (the app warns at 3.00 MB)",
    ])
      expect(text()).toContain(value);
    await until(() => {
      expect(
        [...main().querySelectorAll(".backups li .row-title")].map(
          (date) => date.textContent,
        ),
      ).toEqual(["2026-11-09", "2026-11-08", "2026-11-07"]);
    });
    expect(text()).toContain("3 nightly backups. The app keeps the last 14.");
    // Job names read in words; the raw name the runbook uses follows in small type.
    expect(
      [...main().querySelectorAll(".admin-table tbody .row-title")].map(
        (name) => name.parentElement?.textContent,
      ),
    ).toEqual([
      "Save insert counts and refused actions tick",
      "Refresh groups refreshMembers",
      "Nightly backup and cleanup daily",
    ]);
    // Settings, Jobs and Backups sit in one container that sets their shared width and first column.
    const config = main().querySelector(".config") as HTMLElement;
    expect(
      [...config.querySelectorAll("h2")].map((heading) => heading.textContent),
    ).toEqual(["Settings", "Technical details", "Background jobs", "Backups"]);
    expect(text()).not.toContain("RECIPIENTS_EXTERNAL");
  });

  it("restores a backup after a confirmation that names the date, Cancel first", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(main().querySelectorAll(".backups li")).toHaveLength(3);
    });
    const restore = main().querySelector(
      '[aria-label="Restore the backup of 2026-11-08"]',
    ) as HTMLButtonElement;
    expect(restore.textContent).toBe("Restore");
    restore.focus();
    restore.click();
    const confirm = dialog() as HTMLElement;
    expect(confirm.textContent).toContain("Restore the backup of 2026-11-08?");
    expect(confirm.textContent).toContain(
      "Changes made after that day are lost",
    );
    expect(confirm.textContent).toContain(
      "templates emptied from the trash after 2026-11-08 cannot come back",
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

  it("shows each setting with its explanation, current value and last change", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(main().querySelectorAll("fieldset.setting")).toHaveLength(3);
    });
    const [personal, outside] = [
      ...main().querySelectorAll<HTMLFieldSetElement>("fieldset.setting"),
    ] as [HTMLFieldSetElement, HTMLFieldSetElement];
    expect(personal.querySelector("legend")?.textContent).toBe(
      "Personal templates",
    );
    expect(personal.textContent).toContain(
      "Users can create their own templates in My templates.",
    );
    expect(personal.getAttribute("aria-describedby")).toBe(
      personal.querySelector(".setting-help")?.id,
    );
    expect(checkedLabel(personal)).toBe("On");
    expect(personal.textContent).toMatch(/Last change: ana\.moreno on Nov 9, /);
    expect(button("Save", personal).disabled).toBe(true);
    expect(outside.querySelector("legend")?.textContent).toBe(
      "Outside recipients",
    );
    expect(
      [...outside.querySelectorAll("label")].map((l) => l.textContent.trim()),
    ).toEqual(["Allowed", "example.com only"]);
    expect(checkedLabel(outside)).toBe("Allowed");
    expect(outside.textContent).toContain("Default, never changed.");
  });

  it("asks before turning personal templates off, Cancel first; saves after the confirm", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(main().querySelectorAll("fieldset.setting")).toHaveLength(3);
    });
    const personal = main().querySelector("fieldset.setting") as HTMLElement;
    radio(personal, "Off").click();
    const save = button("Save", personal);
    expect(save.disabled).toBe(false);
    save.focus();
    save.click();
    const confirm = dialog() as HTMLElement;
    expect(confirm.textContent).toContain("Turn off personal templates?");
    expect(confirm.textContent).toContain("Nothing is deleted:");
    expect(document.activeElement?.textContent).toBe("Cancel");
    button("Cancel", confirm).click();
    await until(() => {
      expect(dialog()).toBeNull();
    });
    expect(personal.textContent).toContain("Last change: ana.moreno");
    save.click();
    button("Turn off", dialog() as HTMLElement).click();
    await until(() => {
      expect(personal.textContent).toContain(
        "Saved. Personal templates are off for every user from their next action.",
      );
    });
    expect(personal.textContent).toContain("Last change: dev.user on Nov 9");
    expect(save.disabled).toBe(true);
    expect(save.textContent).toBe("Save");
  });

  it("saves a change that takes nothing away with no dialog", async () => {
    await boot("/?latency=0&personal=off#/admin/config");
    await until(() => {
      expect(main().querySelectorAll("fieldset.setting")).toHaveLength(3);
    });
    const personal = main().querySelector("fieldset.setting") as HTMLElement;
    expect(checkedLabel(personal)).toBe("Off");
    radio(personal, "On").click();
    button("Save", personal).click();
    expect(dialog()).toBeNull();
    await until(() => {
      expect(personal.textContent).toContain(
        "Saved. Personal templates are on for every user from their next action.",
      );
    });
  });

  it("asks before allowing only the domain, and shows a conflict with the current value", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(main().querySelectorAll("fieldset.setting")).toHaveLength(3);
    });
    const outside = main().querySelectorAll(
      "fieldset.setting",
    )[1] as HTMLElement;
    await otherTab("config.set", {
      name: "recipientsExternal",
      value: "deny",
      baseAt: "",
      baseBy: "",
    });
    radio(outside, "example.com only").click();
    button("Save", outside).click();
    const confirm = dialog() as HTMLElement;
    expect(confirm.textContent).toContain("Allow only example.com recipients?");
    button("Allow only example.com", confirm).click();
    await until(() => {
      expect(outside.textContent).toMatch(
        /dev\.user changed this setting on Nov 9, .*\. The page now shows the current value\./,
      );
    });
    expect(checkedLabel(outside)).toBe("example.com only");
    expect(button("Save", outside).disabled).toBe(true);
    radio(outside, "Allowed").click();
    button("Save", outside).click();
    expect(dialog()).toBeNull();
    await until(() => {
      expect(outside.textContent).toContain(
        "Saved. Outside recipients are allowed.",
      );
    });
  });

  it("shows the current value from a CONFLICT after an A, B, A change and keeps focus off the body", async () => {
    await boot("/?latency=0#/admin/config");
    await until(() => {
      expect(main().querySelectorAll("fieldset.setting")).toHaveLength(3);
    });
    const outside = main().querySelectorAll(
      "fieldset.setting",
    )[1] as HTMLElement;
    await otherTab("config.set", {
      name: "recipientsExternal",
      value: "deny",
      baseAt: "",
      baseBy: "",
    });
    await otherTab("config.set", {
      name: "recipientsExternal",
      value: "allow",
      baseAt: "2026-11-09T14:03:00.000Z",
      baseBy: "dev.user@example.com",
    });
    radio(outside, "example.com only").click();
    const save = button("Save", outside);
    save.focus();
    save.click();
    button("Allow only example.com", dialog() as HTMLElement).click();
    await until(() => {
      expect(outside.textContent).toMatch(
        /dev\.user changed this setting on Nov 9, .*\. The page now shows the current value\./,
      );
    });
    expect(checkedLabel(outside)).toBe("Allowed");
    expect(outside.textContent).toContain("Last change: dev.user on Nov 9");
    expect(save.disabled).toBe(true);
    expect(document.activeElement).toBe(
      outside.querySelector('[role="status"]'),
    );
  });

  it("moves focus to the status line after a Save without a dialog", async () => {
    await boot("/?latency=0&personal=off#/admin/config");
    await until(() => {
      expect(main().querySelectorAll("fieldset.setting")).toHaveLength(3);
    });
    const personal = main().querySelector("fieldset.setting") as HTMLElement;
    radio(personal, "On").click();
    const save = button("Save", personal);
    save.focus();
    save.click();
    expect(document.activeElement).toBe(save);
    expect(save.getAttribute("aria-disabled")).toBe("true");
    await until(() => {
      expect(personal.textContent).toContain("Saved.");
    });
    expect(document.activeElement).toBe(
      personal.querySelector('[role="status"]'),
    );
  });

  it("shows the empty and error states of the config tab", async () => {
    await boot("/?latency=0&fail=INTERNAL&failOp=config.get#/admin/config");
    await until(() => {
      expect(text()).toContain("Settings could not be loaded.");
    });
    expect(toasts()).toContain("Request ID");
  });
});

describe("config tab, Admins section (D32)", () => {
  const section = () =>
    main().querySelector("fieldset.admins-setting") as HTMLElement;
  const rows = () =>
    [...section().querySelectorAll(".admins li")].map(
      (row) => row.querySelector(".row-title")?.textContent,
    );
  const input = () => labelled<HTMLInputElement>("Email address");
  const adminStatus = () =>
    section().querySelector('[role="status"]') as HTMLElement;

  async function open(url = "/?latency=0#/admin/config"): Promise<void> {
    await boot(url);
    await until(() => {
      expect(section()).not.toBeNull();
    });
  }

  function add(email: string): void {
    input().value = email;
    button("Add admin", section()).click();
  }

  it("shows the list with sources, no Remove on the caller's own row, the owner and group rows", async () => {
    await open();
    expect(section().querySelector("legend")?.textContent).toBe("Admins");
    expect(section().getAttribute("aria-describedby")).toBe(
      section().querySelector(".setting-help")?.id,
    );
    expect(section().textContent).toContain(
      "Admins manage every shared folder, its access, settings, imports and backups. Add people by their example.com address.",
    );
    expect(rows()).toEqual(["dev.user@example.com", "ana.moreno@example.com"]);
    const [own, other] = [...section().querySelectorAll(".admins li")] as [
      HTMLElement,
      HTMLElement,
    ];
    expect(own.querySelector("button")).toBeNull();
    expect(own.textContent).toMatch(/Added by ana\.moreno on Nov 8, /);
    expect(other.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Remove ana.moreno@example.com as admin",
    );
    expect(section().textContent).toContain(
      "Set by the owner: owner@example.com. These cannot be removed here.",
    );
    expect(section().textContent).toContain("Members of admins@example.com.");
  });

  it("shows the empty list text", async () => {
    await open("/?latency=0&admins=none#/admin/config");
    expect(section().textContent).toContain("No admins added here yet.");
    expect(section().querySelector(".admins")).toBeNull();
  });

  it("adds an admin: busy text, result, list from the op, focus on the status line", async () => {
    await open();
    const addButton = button("Add admin", section());
    addButton.focus();
    add(" Carl@Example.com ");
    expect(addButton.textContent).toBe("Adding...");
    expect(addButton.getAttribute("aria-disabled")).toBe("true");
    await until(() => {
      expect(adminStatus().textContent).toBe(
        "carl@example.com is now an admin.",
      );
    });
    expect(rows()).toContain("carl@example.com");
    expect(input().value).toBe("");
    expect(addButton.textContent).toBe("Add admin");
    expect(addButton.hasAttribute("aria-disabled")).toBe(false);
    expect(document.activeElement).toBe(adminStatus());
    add("carl@example.com");
    await until(() => {
      expect(adminStatus().textContent).toBe(
        "carl@example.com is already an admin.",
      );
    });
  });

  it("shows each refusal text inline and marks the field", async () => {
    await open();
    for (const [typed, message] of [
      ["name", "Enter an email address, for example name@example.com."],
      ["eve@other.org", "Only example.com addresses can be admins."],
      [
        "nobody@example.com",
        "No example.com account has this address. A group goes in the admin group the owner sets.",
      ],
    ] as const) {
      add(typed);
      await until(() => {
        expect(adminStatus().textContent).toBe(message);
      });
      expect(input().getAttribute("aria-invalid")).toBe("true");
      expect(input().getAttribute("aria-describedby")).toBe(adminStatus().id);
    }
    expect(rows()).toHaveLength(2);
  });

  it("removes after a confirm with Cancel focused; focus moves to the status line", async () => {
    await open();
    const remove = section().querySelector(
      '[aria-label="Remove ana.moreno@example.com as admin"]',
    ) as HTMLButtonElement;
    remove.focus();
    remove.click();
    const confirm = dialog() as HTMLElement;
    expect(confirm.textContent).toContain(
      "Remove ana.moreno@example.com as admin?",
    );
    expect(confirm.textContent).toContain(
      "They lose admin access at their next action. Their templates and folders stay.",
    );
    expect(document.activeElement?.textContent).toBe("Cancel");
    button("Cancel", confirm).click();
    await until(() => {
      expect(document.activeElement).toBe(remove);
    });
    expect(rows()).toHaveLength(2);
    remove.click();
    button("Remove admin", dialog() as HTMLElement).click();
    await until(() => {
      expect(adminStatus().textContent).toBe(
        "ana.moreno@example.com is no longer an admin.",
      );
    });
    expect(rows()).toEqual(["dev.user@example.com"]);
    await until(() => {
      expect(document.activeElement).toBe(adminStatus());
    });
  });

  it('answers "not in the list" when another admin removed the person first', async () => {
    await open();
    await otherTab("admin.remove", { email: "ana.moreno@example.com" });
    (
      section().querySelector(
        '[aria-label="Remove ana.moreno@example.com as admin"]',
      ) as HTMLButtonElement
    ).click();
    button("Remove admin", dialog() as HTMLElement).click();
    await until(() => {
      expect(adminStatus().textContent).toBe(
        "ana.moreno@example.com is not in the list.",
      );
    });
    expect(rows()).toEqual(["dev.user@example.com"]);
  });

  it("shows the no-longer-admin text on Add and on Remove, and leaves the field unmarked", async () => {
    await open("/?latency=0&fail=DENIED&failOp=admin.add#/admin/config");
    add("carl@example.com");
    await until(() => {
      expect(adminStatus().textContent).toBe(NO_LONGER_ADMIN);
    });
    expect(input().hasAttribute("aria-invalid")).toBe(false);
    expect(rows()).toHaveLength(2);
    document.body.replaceChildren();
    vi.resetModules();
    await open("/?latency=0&fail=DENIED&failOp=admin.remove#/admin/config");
    (
      section().querySelector(
        '[aria-label="Remove ana.moreno@example.com as admin"]',
      ) as HTMLButtonElement
    ).click();
    button("Remove admin", dialog() as HTMLElement).click();
    await until(() => {
      expect(adminStatus().textContent).toBe(NO_LONGER_ADMIN);
    });
    expect(input().hasAttribute("aria-invalid")).toBe(false);
  });

  it("shows the Directory text in the line, with no toast, when the address could not be checked", async () => {
    await open();
    add("flaky@example.com");
    await until(() => {
      expect(adminStatus().textContent).toBe(
        "The address could not be checked. Try again.",
      );
    });
    expect(toasts()).toBe("");
    expect(input().hasAttribute("aria-invalid")).toBe(false);
  });

  it("names the stored address when an alias is already an admin", async () => {
    await open();
    add("ana@example.com");
    await until(() => {
      expect(adminStatus().textContent).toBe(
        "ana.moreno@example.com is already an admin.",
      );
    });
  });
});

describe("admin-only actions refused because the caller is no longer an admin (slice 16 retry 1)", () => {
  it("Settings Save", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=config.set#/admin/config");
    await until(() => {
      expect(main().querySelectorAll("fieldset.setting")).toHaveLength(3);
    });
    const outside = main().querySelectorAll(
      "fieldset.setting",
    )[1] as HTMLElement;
    radio(outside, "Allowed").click();
    radio(outside, "example.com only").click();
    button("Save", outside).click();
    button("Allow only example.com", dialog() as HTMLElement).click();
    await until(() => {
      expect(outside.textContent).toContain(NO_LONGER_ADMIN);
    });
  });

  it("Restore a backup", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=backup.restore#/admin/config");
    await until(() => {
      expect(main().querySelectorAll(".backups li")).toHaveLength(3);
    });
    (
      main().querySelector(
        '[aria-label="Restore the backup of 2026-11-08"]',
      ) as HTMLButtonElement
    ).click();
    button("Restore 2026-11-08", dialog() as HTMLElement).click();
    await until(() => {
      expect(status()).toContain(NO_LONGER_ADMIN);
    });
  });

  it("Export of the whole library", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=export.library#/admin/transfer");
    await until(() => {
      expect(button("Export")).toBeTruthy();
    });
    button("Export").click();
    await until(() => {
      expect(status()).toContain(NO_LONGER_ADMIN);
    });
  });

  it("Import (Check file)", async () => {
    await boot("/?latency=0&fail=DENIED&failOp=import#/admin/transfer");
    await until(() => {
      expect(button("Check file")).toBeTruthy();
    });
    const input = labelled<HTMLInputElement>("Export file");
    Object.defineProperty(input, "files", {
      value: [
        new File(
          [JSON.stringify({ schemaVersion: 1, items: [] })],
          "export.json",
        ),
      ],
    });
    labelled<HTMLSelectElement>("Import into").value = "F-QUOTES";
    input.dispatchEvent(new Event("change"));
    button("Check file").click();
    await until(() => {
      expect(status()).toContain(NO_LONGER_ADMIN);
    });
  });
});
