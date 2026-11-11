import {
  IMPORT_ITEMS_MAX,
  IMPORT_MAX_BYTES,
} from "../../shared/model/validate";
import { exportFileName, importSummary, sharedFolders } from "../admin/model";
import { folderPath } from "../library/model";
import type { ExportPage, FolderRow, ImportReport } from "../rpc/api";
import { ErrorCode } from "../../shared/errors/codes";
import { RpcError } from "../rpc/client";
import { requestIdNow } from "../../shared/requestId";
import { adminLineText, lineText, toRpcError } from "../ui/status";
import { h, replace, uid } from "../ui/dom";
import type { AdminData, AdminFolders } from "./admin";
import { adminTable, tableRow, toneTag, type Column } from "./adminTable";
import type { AppContext, View } from "./context";

/** Retries of an export start or page that failed with a retryable error, and the first wait (1x, 2x, 3x). */
export const EXPORT_RETRIES = 3;
export const EXPORT_RETRY_MS = 200;

/**
 * Status text of an export that failed. It says how far the export got and that no file exists, so nobody takes a
 * part of the library for the whole. `answer` is the server's own message, "" when a toast or page already shows
 * it, and null when the server gave no answer after every retry.
 */
export function exportFailedText(
  done: number,
  total: number,
  answer: string | null,
): string {
  const head =
    total === 0
      ? "The export did not start"
      : `The export stopped after ${String(done)} of ${String(total)} templates`;
  return answer === null
    ? `${head}: the server did not answer after ${String(EXPORT_RETRIES + 1)} tries. No file was downloaded, so wait a few minutes and export again.`
    : `${head} and no file was downloaded. ${answer}`.trim();
}

/**
 * Tab "Export and import" (wireframe 06). Export: whole library (admin) or one folder the caller manages. The start
 * call records the export in the audit log and returns a run token; the pages, read with it, are joined into one JSON
 * download `migway-templates-<scope>-<date>.json`. Import (admin): choose a file and a
 * target folder, Validate (nothing is written), then Import with the same file and target.
 */
const REPORT_COLUMNS: readonly Column[] = [
  { label: "Templates", num: true },
  { label: "Skipped", num: true },
  { label: "Failed", num: true },
  { label: "New folders", num: true },
  { label: "Existing folders", num: true },
];
const LINE_COLUMNS: readonly Column[] = [
  { label: "Name" },
  { label: "Type" },
  { label: "Result" },
  { label: "Reason" },
];
const EXPORT_NOTE =
  "as one file, without the trash, older versions, favorites, insert counts or the audit log.";

function folderOptions(folders: readonly FolderRow[]): HTMLOptionElement[] {
  return folders
    .map((folder) => ({ id: folder.id, label: folderPath(folders, folder.id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((option) => h("option", { value: option.id }, option.label));
}

function labelled(label: string, input: HTMLElement): HTMLElement {
  const id = uid("transfer");
  input.id = id;
  return h("div", { class: "field" }, h("label", { for: id }, label), input);
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = h("a", { href: url, download: name, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportSection(app: AppContext, data: AdminData): HTMLElement {
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const folder = h("select", {}, ...folderOptions(data.folders));
  const library = h("input", {
    type: "radio",
    name: "export-scope",
    value: "library",
  });
  const single = h("input", {
    type: "radio",
    name: "export-scope",
    value: "folder",
  });
  library.checked = data.isAdmin;
  single.checked = !data.isAdmin;
  const run = h(
    "button",
    { type: "button", class: "primary" },
    data.isAdmin ? "Export" : "Export folder",
  );
  const sync = () => {
    folder.disabled = library.checked;
  };
  library.addEventListener("change", sync);
  single.addEventListener("change", sync);
  sync();

  /** Runs `work`; a retryable failure is tried again after EXPORT_RETRY_MS, then 2 and 3 times that. */
  const retrying = async <T>(work: () => Promise<T>): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await work();
      } catch (error: unknown) {
        const retry = error instanceof RpcError && error.retryable;
        if (!retry || attempt > EXPORT_RETRIES) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, EXPORT_RETRY_MS * attempt),
        );
      }
    }
  };

  const pages = async (
    folderId: string,
    progress: { done: number; total: number },
  ) => {
    const run = requestIdNow();
    const { token, total } = await retrying(() =>
      app.api.exportStart(folderId, run),
    );
    progress.total = total;
    const pageAt = (offset: number) =>
      retrying(() => app.api.exportPage(folderId, offset, token));
    let page: ExportPage = await pageAt(0);
    const items = [...page.items];
    while (page.next !== null) {
      progress.done = items.length;
      // Each page counts the live library: a save during the export changes the total (13 retry 2 minor 5).
      progress.total = page.total;
      status.textContent = `Exporting ${String(items.length)} of ${String(page.total)} templates...`;
      page = await pageAt(page.next);
      items.push(...page.items);
    }
    return { file: { ...page.header, items }, count: items.length };
  };

  run.addEventListener("click", () => {
    const folderId = library.checked ? "" : folder.value;
    if (!library.checked && folderId === "") {
      status.textContent = "Choose a folder to export.";
      return;
    }
    run.disabled = true;
    status.textContent = "Exporting...";
    const progress = { done: 0, total: 0 };
    pages(folderId, progress)
      .then(({ file, count }) => {
        const name = exportFileName(file.scope, new Date());
        download(name, JSON.stringify(file, null, 2));
        status.textContent = `Exported ${String(count)} templates to ${name}.`;
      })
      .catch((error: unknown) => {
        // No file is offered: a page that failed leaves the export incomplete. Only a NETWORK error means the
        // server gave no answer; every other error carries the server's message (toast, banner or this line).
        const noAnswer = toRpcError(error).code === ErrorCode.NETWORK;
        status.textContent = exportFailedText(
          progress.done,
          progress.total,
          noAnswer
            ? null
            : // The library export is admin only; a folder export needs manage.
              (folderId === "" ? adminLineText : lineText)(
                error,
                app.fail(error),
              ),
        );
      })
      .finally(() => {
        run.disabled = false;
      });
  });

  const scope = data.isAdmin
    ? h(
        "fieldset",
        { class: "scope" },
        h("legend", {}, "What to export"),
        h("label", {}, library, " Whole library (shared folders)"),
        h("label", {}, single, " One folder and its subfolders"),
      )
    : null;
  return h(
    "section",
    { class: "transfer", "aria-labelledby": "export-heading" },
    h(
      "h2",
      { id: "export-heading" },
      data.isAdmin ? "Export" : "Export folder",
    ),
    h(
      "p",
      { class: "hint" },
      data.isAdmin
        ? `Downloads the templates, folders and access of the whole library or of one folder ${EXPORT_NOTE} A whole-library export leaves out personal folders (each user's My templates).`
        : `Downloads the templates, folders and access of a folder you manage and its subfolders ${EXPORT_NOTE}`,
    ),
    scope,
    h("div", { class: "form-row" }, labelled("Folder", folder), run),
    status,
  );
}

function reportTables(report: ImportReport): HTMLElement[] {
  const counts = adminTable(
    REPORT_COLUMNS,
    [
      tableRow(
        REPORT_COLUMNS,
        [
          report.created,
          report.skipped,
          report.failed,
          report.foldersCreated,
          report.foldersReused,
        ].map(String),
      ),
    ],
    { caption: report.dryRun ? "Check result" : "Import result" },
  );
  counts.classList.add("compact");
  counts.tabIndex = -1;
  if (report.lines.length === 0) return [counts];
  const lines = adminTable(
    LINE_COLUMNS,
    report.lines.map((line) =>
      tableRow(LINE_COLUMNS, [
        line.name,
        line.kind === "folder" ? "Folder" : "Template",
        toneTag(
          line.outcome === "failed" ? "Failed" : "Skipped",
          line.outcome === "failed" ? "bad" : "warn",
        ),
        line.reason,
      ]),
    ),
    { caption: "Skipped and failed templates and folders" },
  );
  lines.querySelector("caption")?.classList.remove("sr-only");
  return [counts, lines];
}

function importSection(
  app: AppContext,
  data: AdminData,
  folders: AdminFolders,
): HTMLElement {
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const result = h("div", { class: "import-report" });
  const input = h("input", { type: "file", accept: "application/json,.json" });
  const target = h("select", {}, ...folderOptions(sharedFolders(data.folders)));
  const validate = h("button", { type: "button" }, "Check file");
  const run = h("button", { type: "button", class: "primary" }, "Import");
  let validated: { text: string; target: string } | null = null;
  const reset = () => {
    validated = null;
    run.disabled = true;
    replace(result);
  };
  input.addEventListener("change", reset);
  target.addEventListener("change", reset);
  reset();

  const readFile = async (): Promise<string | null> => {
    const file = input.files?.[0];
    if (file === undefined) {
      status.textContent = "Choose an export file first.";
      return null;
    }
    if (file.size > IMPORT_MAX_BYTES) {
      status.textContent = `The file is larger than ${String(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Export smaller folders and import them one by one.`;
      return null;
    }
    return file.text();
  };

  const send = (text: string, dryRun: boolean) => {
    validate.disabled = true;
    run.disabled = true;
    status.textContent = dryRun ? "Checking file..." : "Importing...";
    const folderId = target.value;
    app.api
      .importFile(folderId, text, dryRun)
      .then((report) => {
        status.textContent = importSummary(report);
        replace(result, ...reportTables(report));
        validated = dryRun ? { text, target: folderId } : null;
        if (dryRun) return;
        // The Import button turns disabled, so focus goes to the report it produced.
        result.querySelector<HTMLElement>("table")?.focus();
        // An import can create folders: the library and the other Admin tabs read them again.
        void app.reload();
        folders.refresh().catch(() => undefined);
      })
      .catch((error: unknown) => {
        status.textContent = adminLineText(error, app.fail(error));
      })
      .finally(() => {
        validate.disabled = false;
        run.disabled = validated === null;
      });
  };

  validate.addEventListener("click", () => {
    reset();
    void readFile().then((text) => {
      if (text !== null) send(text, true);
    });
  });
  run.addEventListener("click", () => {
    if (validated !== null) send(validated.text, false);
  });

  return h(
    "section",
    { class: "transfer", "aria-labelledby": "import-heading" },
    h("h2", { id: "import-heading" }, "Import"),
    h(
      "p",
      { class: "hint" },
      `Adds the templates of an export file (up to ${String(IMPORT_MAX_BYTES / 1024 / 1024)} MB, ${String(IMPORT_ITEMS_MAX)} templates) to a shared folder as new templates. Access from the file is not imported, and a template whose title is already in its folder is skipped.`,
    ),
    h(
      "div",
      { class: "form-row" },
      labelled("Export file", input),
      labelled("Import into", target),
    ),
    h(
      "div",
      { class: "steps" },
      validate,
      run,
      h(
        "span",
        { class: "meta" },
        "Check file changes nothing. It shows what Import would do.",
      ),
    ),
    status,
    result,
  );
}

export function transferTab(
  app: AppContext,
  panel: HTMLElement,
  folders: AdminFolders,
): View {
  const data = folders.current();
  replace(
    panel,
    exportSection(app, data),
    data.isAdmin ? importSection(app, data, folders) : null,
  );
  return { dispose: () => undefined };
}
