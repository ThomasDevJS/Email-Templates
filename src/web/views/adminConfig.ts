import { formatBytes } from "../admin/model";
import type { ConfigView, JobRow } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { formatTime, h, replace } from "../ui/dom";
import { lineText, skeletonRows } from "../ui/status";
import { adminTable, tableRow, toneTag, type Column } from "./adminTable";
import { settingsSection } from "./adminSettings";
import type { AppContext, View } from "./context";

/**
 * Tab "Settings and backups" (admin, wireframe 06): the admin settings (D29), then read only: environment, index size with the 3 MB warning, job health (a job
 * late by more than 2 intervals shows "Late" with its last error), and the 14 daily backups with Restore.
 */
const JOB_COLUMNS: readonly Column[] = [
  { label: "Job" },
  { label: "Schedule" },
  { label: "Last good run" },
  { label: "Status" },
];

/** Job names in words; the raw name follows in small type, because the runbook names jobs by it. */
const JOB_WORDS: Readonly<Record<string, string>> = {
  tick: "Save insert counts and refused actions",
  refreshMembers: "Refresh groups",
  daily: "Nightly backup and cleanup",
};

function jobName(name: string): HTMLElement {
  const words = JOB_WORDS[name];
  return h(
    "span",
    {},
    h("span", { class: "row-title" }, words ?? name),
    words === undefined ? null : h("span", { class: "meta" }, ` ${name}`),
  );
}

function jobStatus(job: JobRow): HTMLElement {
  return h(
    "div",
    { class: "status-cell" },
    job.status === "ok"
      ? toneTag("OK", "ok")
      : toneTag(job.status === "late" ? "Late" : "Never ran", "warn"),
    job.status === "ok" || job.lastError === ""
      ? null
      : h("span", { class: "meta" }, job.lastError),
  );
}

function environment(data: ConfigView): HTMLElement {
  const size = `${formatBytes(data.indexBytes)}${
    data.indexBytes >= data.indexWarnBytes
      ? ` (over ${formatBytes(data.indexWarnBytes)}: tell the developer, the library data is too large)`
      : ` (the app warns at ${formatBytes(data.indexWarnBytes)})`
  }`;
  const facts: [string, string][] = [
    ["Domain", data.domain],
    ["ADMIN_GROUP", data.adminGroup || "not set"],
    ["MEMBERSHIP_RESOLVER", data.resolver],
    ["CALLER_IDENTITY", data.callerIdentity],
    ["INDEX_REV", data.indexRev],
    ["App version", data.appVersion],
    ["Library data size", size],
  ];
  return h(
    "dl",
    { class: "facts" },
    ...facts.flatMap(([term, value]) => [
      h("dt", {}, term),
      h("dd", {}, value),
    ]),
  );
}

function jobsTable(data: ConfigView): HTMLElement {
  return h(
    "section",
    { "aria-labelledby": "jobs-heading" },
    h("h2", { id: "jobs-heading" }, "Background jobs"),
    adminTable(
      JOB_COLUMNS,
      data.jobs.map((job) =>
        tableRow(JOB_COLUMNS, [
          jobName(job.name),
          job.schedule,
          formatTime(job.lastOk) || "never",
          jobStatus(job),
        ]),
      ),
      { labelledBy: "jobs-heading" },
    ),
  );
}

function backupsSection(app: AppContext): HTMLElement {
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const list = h(
    "div",
    { "aria-busy": "true" },
    h("p", { class: "hint" }, "Loading backups..."),
  );

  /** One restore at a time: every Restore button waits for the running one. */
  const setBusy = (busy: boolean) => {
    for (const button of list.querySelectorAll("button"))
      button.disabled = busy;
  };

  const confirm = (date: string, restore: HTMLButtonElement) => {
    openDialog({
      title: `Restore the backup of ${date}?`,
      body: h(
        "p",
        {},
        `Everything goes back to ${date}: templates, versions, folders, access, favorites and insert counts. Changes made after that day are lost, and templates emptied from the trash after ${date} cannot come back.`,
      ),
      actions: [
        { label: "Cancel", autofocus: true, run: () => undefined },
        {
          label: `Restore ${date}`,
          primary: true,
          run: () => {
            setBusy(true);
            status.textContent = `Restoring the backup of ${date}...`;
            app.api
              .restoreBackup(date)
              .then(() => {
                status.textContent = `Restored the backup of ${date}.`;
                return app.reload();
              })
              .catch((error: unknown) => {
                status.textContent = lineText(error, app.fail(error));
              })
              .finally(() => {
                setBusy(false);
              });
            return undefined;
          },
        },
      ],
      returnFocus: restore,
    });
  };
  const restoreButton = (date: string) => {
    const button = h(
      "button",
      { type: "button", "aria-label": `Restore the backup of ${date}` },
      "Restore",
    );
    button.addEventListener("click", () => {
      confirm(date, button);
    });
    return button;
  };

  const load = () => {
    app.api.backups().then(
      ({ dates }) => {
        list.setAttribute("aria-busy", "false");
        if (dates.length === 0) {
          replace(
            list,
            h(
              "p",
              { class: "empty" },
              "No backups yet. The app makes one each night and keeps the last 14.",
            ),
          );
          return;
        }
        replace(
          list,
          h(
            "p",
            { class: "hint" },
            `${String(dates.length)} nightly backups. The app keeps the last 14.`,
          ),
          h(
            "ul",
            { class: "backups", "aria-labelledby": "backups-heading" },
            ...dates.map((date) =>
              h(
                "li",
                {},
                h("span", { class: "row-title" }, date),
                restoreButton(date),
              ),
            ),
          ),
        );
      },
      (error: unknown) => {
        list.setAttribute("aria-busy", "false");
        replace(
          list,
          app.fail(error, load) ??
            h(
              "p",
              { class: "empty" },
              "Backups could not be loaded. Press Retry in the message.",
            ),
        );
      },
    );
  };
  load();
  return h(
    "section",
    { "aria-labelledby": "backups-heading" },
    h("h2", { id: "backups-heading" }, "Backups"),
    list,
    status,
  );
}

export function configTab(app: AppContext, panel: HTMLElement): View {
  const body = h(
    "div",
    {
      class: "list",
      "aria-busy": "true",
      "aria-label": "Settings and backups",
    },
    ...skeletonRows(4),
  );
  const load = () => {
    app.api.config().then(
      (data) => {
        body.setAttribute("aria-busy", "false");
        replace(
          body,
          settingsSection(app, data),
          h("h2", {}, "Technical details"),
          environment(data),
          data.triggersError === ""
            ? null
            : h(
                "p",
                { class: "error", role: "alert" },
                `The background jobs could not be set up again: ${data.triggersError}`,
              ),
          jobsTable(data),
        );
      },
      (error: unknown) => {
        body.setAttribute("aria-busy", "false");
        replace(
          body,
          app.fail(error, load) ??
            h(
              "p",
              { class: "empty" },
              "Settings could not be loaded. Press Retry in the message.",
            ),
        );
      },
    );
  };
  replace(panel, h("div", { class: "config" }, body, backupsSection(app)));
  load();
  return { dispose: () => undefined };
}
