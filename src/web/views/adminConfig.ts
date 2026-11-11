import { formatBytes, recipientsText } from "../admin/model";
import type { ConfigView, JobRow } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { formatTime, h, replace } from "../ui/dom";
import { lineText, skeletonRows } from "../ui/status";
import { adminTable, tableRow, toneTag, type Column } from "./adminTable";
import type { AppContext, View } from "./context";

/**
 * Tab "Config" (admin, read only, wireframe 06): settings, index size with the 3 MB warning, job health (a job
 * late by more than 2 intervals shows "Late" with its last error), and the 14 daily backups with Restore.
 */
const JOB_COLUMNS: readonly Column[] = [
  { label: "Job" },
  { label: "Schedule" },
  { label: "Last OK" },
  { label: "Status" },
];

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

function settings(data: ConfigView): HTMLElement {
  const size = `${formatBytes(data.indexBytes)}${
    data.indexBytes >= data.indexWarnBytes
      ? ` (warning: over ${formatBytes(data.indexWarnBytes)}, the index should be split, ADR-0002)`
      : ` (warning at ${formatBytes(data.indexWarnBytes)})`
  }`;
  const recipients = recipientsText(data.recipientsExternal, data.domain);
  const facts: [string, string][] = [
    ["Domain", data.domain],
    ...(recipients === null
      ? []
      : [["Outside recipients", recipients] as [string, string]]),
    ["ADMIN_GROUP", data.adminGroup || "not set"],
    ["MEMBERSHIP_RESOLVER", data.resolver],
    ["CALLER_IDENTITY", data.callerIdentity],
    ["INDEX_REV", data.indexRev],
    ["App version", data.appVersion],
    ["Index size", size],
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
    h("h2", { id: "jobs-heading" }, "Jobs"),
    adminTable(
      JOB_COLUMNS,
      data.jobs.map((job) =>
        tableRow(JOB_COLUMNS, [
          h("span", { class: "row-title" }, job.name),
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
        `Every change made after ${date} is lost: templates, versions, folders, grants, favorites and usage counts go back to that day. Templates emptied from the trash after ${date} cannot come back; the server refuses the restore if the backup holds any. The audit log is kept and records the restore.`,
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
              "No backups yet. The daily job makes one each night and keeps 14.",
            ),
          );
          return;
        }
        replace(
          list,
          h(
            "p",
            { class: "hint" },
            `${String(dates.length)} daily copies (14 kept).`,
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
              "Backups could not be loaded. Use Retry in the message.",
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
    { class: "list", "aria-busy": "true", "aria-label": "Configuration" },
    ...skeletonRows(4),
  );
  const load = () => {
    app.api.config().then(
      (data) => {
        body.setAttribute("aria-busy", "false");
        replace(
          body,
          h("h2", { class: "first" }, "Settings"),
          settings(data),
          data.triggersError === ""
            ? null
            : h(
                "p",
                { class: "error", role: "alert" },
                `Trigger reinstall failed: ${data.triggersError}`,
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
              "The configuration could not be loaded. Use Retry in the message.",
            ),
        );
      },
    );
  };
  replace(panel, h("div", { class: "config" }, body, backupsSection(app)));
  load();
  return { dispose: () => undefined };
}
