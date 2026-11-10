import { formatBytes } from "../admin/model";
import type { ConfigView, JobRow } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { formatTime, h, replace, uid } from "../ui/dom";
import { skeletonRows } from "../ui/status";
import type { AppContext, View } from "./context";

/**
 * Tab "Config" (admin, read only, wireframe 06): settings, index size with the 3 MB warning, job health (a job
 * late by more than 2 intervals shows "late" with its last error), and the 14 daily backups with Restore.
 */
function statusText(job: JobRow): string {
  if (job.status === "ok") return "ok";
  const head = job.status === "late" ? "late" : "never ran";
  return job.lastError === "" ? head : `${head}: ${job.lastError}`;
}

function settings(data: ConfigView): HTMLElement {
  const size = `${formatBytes(data.indexBytes)}${
    data.indexBytes >= data.indexWarnBytes
      ? ` (warning: over ${formatBytes(data.indexWarnBytes)}, the index should be split, ADR-0002)`
      : ` (warning at ${formatBytes(data.indexWarnBytes)})`
  }`;
  const facts: [string, string][] = [
    ["Domain", data.domain],
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
    "table",
    { class: "admin-table" },
    h("caption", {}, "Jobs"),
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        ...["Job", "Schedule", "Last OK", "Status"].map((label) =>
          h("th", { scope: "col" }, label),
        ),
      ),
    ),
    h(
      "tbody",
      {},
      ...data.jobs.map((job) =>
        h(
          "tr",
          { class: job.status === "ok" ? "" : "late" },
          h("td", {}, job.name),
          h("td", {}, job.schedule),
          h("td", {}, formatTime(job.lastOk) || "never"),
          h("td", {}, statusText(job)),
        ),
      ),
    ),
  );
}

function backupsSection(app: AppContext): HTMLElement {
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const choice = h("select", {});
  const restore = h(
    "button",
    { type: "button", class: "danger" },
    "Restore from backup",
  );
  const id = uid("backup");
  choice.id = id;
  const list = h(
    "div",
    { "aria-busy": "true" },
    h("p", { class: "hint" }, "Loading backups..."),
  );

  const confirm = (date: string) => {
    openDialog({
      title: `Restore the backup of ${date}?`,
      body: h(
        "p",
        {},
        `The library, favorites and usage counts go back to ${date}. Templates, folders, grants and favorites changed after that are lost. The audit log is kept and records the restore.`,
      ),
      actions: [
        { label: "Cancel", autofocus: true, run: () => undefined },
        {
          label: `Restore ${date}`,
          primary: true,
          run: () => {
            restore.disabled = true;
            status.textContent = `Restoring the backup of ${date}...`;
            app.api
              .restoreBackup(date)
              .then(() => {
                status.textContent = `Restored the backup of ${date}.`;
                return app.reload();
              })
              .catch((error: unknown) => {
                status.textContent = app.fail(error)?.textContent ?? "";
              })
              .finally(() => {
                restore.disabled = false;
              });
            return undefined;
          },
        },
      ],
      returnFocus: restore,
    });
  };
  restore.addEventListener("click", () => {
    if (choice.value !== "") confirm(choice.value);
  });

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
          choice,
          ...dates.map((date) => h("option", { value: date }, date)),
        );
        replace(
          list,
          h(
            "p",
            { class: "hint" },
            `${String(dates.length)} daily copies (14 kept).`,
          ),
          h(
            "div",
            { class: "admin-toolbar" },
            h(
              "div",
              { class: "field" },
              h("label", { for: id }, "Backup date"),
              choice,
            ),
            restore,
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
    h("h3", { id: "backups-heading" }, "Backups"),
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
          settings(data),
          data.triggersError === ""
            ? null
            : h(
                "p",
                { class: "late", role: "alert" },
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
  replace(panel, body, backupsSection(app));
  load();
  return { dispose: () => undefined };
}
