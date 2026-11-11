import {
  IMPORT_ITEMS_MAX,
  IMPORT_MAX_BYTES,
} from "../../shared/model/validate";
import { exportFileName, importSummary, sharedFolders } from "../admin/model";
import { folderPath } from "../library/model";
import type { FolderRow, ImportReport } from "../rpc/api";
import { lineText } from "../ui/status";
import { h, replace, uid } from "../ui/dom";
import type { AdminData } from "./admin";
import { adminTable, tableRow, toneTag, type Column } from "./adminTable";
import type { AppContext, View } from "./context";

/**
 * Tab "Export and import" (wireframe 06). Export: whole library (admin) or one folder the caller manages, joined
 * from pages into one JSON download `migway-templates-<scope>-<date>.json`. Import (admin): choose a file and a
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
  { label: "Kind" },
  { label: "Result" },
  { label: "Reason" },
];
const EXPORT_NOTE =
  "as one JSON file, without the trash, older versions, favorites, usage or the audit log.";

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

  const pages = async (folderId: string) => {
    let page = await app.api.exportPage(folderId, 0);
    const items = [...page.items];
    while (page.next !== null) {
      status.textContent = `Exporting ${String(items.length)} of ${String(page.total)} templates...`;
      page = await app.api.exportPage(folderId, page.next);
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
    pages(folderId)
      .then(({ file, count }) => {
        const name = exportFileName(file.scope, new Date());
        download(name, JSON.stringify(file, null, 2));
        status.textContent = `Exported ${String(count)} templates to ${name}.`;
      })
      .catch((error: unknown) => {
        status.textContent = lineText(error, app.fail(error));
      })
      .finally(() => {
        run.disabled = false;
      });
  });

  const scope = data.isAdmin
    ? h(
        "fieldset",
        { class: "scope" },
        h("legend", {}, "Export scope"),
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
        ? `Downloads the live templates, folders and grants of the scope you choose ${EXPORT_NOTE} A whole-library export leaves out the private folders (each user's My templates).`
        : `Downloads the live templates, folders and grants of a folder you manage and its subfolders ${EXPORT_NOTE}`,
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
    { caption: report.dryRun ? "Validate report" : "Import report" },
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
    { caption: "Skipped and failed records" },
  );
  lines.querySelector("caption")?.classList.remove("sr-only");
  return [counts, lines];
}

function importSection(app: AppContext, data: AdminData): HTMLElement {
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const result = h("div", { class: "import-report" });
  const input = h("input", { type: "file", accept: "application/json,.json" });
  const target = h("select", {}, ...folderOptions(sharedFolders(data.folders)));
  const validate = h("button", { type: "button" }, "Validate");
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
      status.textContent = `The file is larger than ${String(IMPORT_MAX_BYTES / 1024 / 1024)} MB.`;
      return null;
    }
    return file.text();
  };

  const send = (text: string, dryRun: boolean) => {
    validate.disabled = true;
    run.disabled = true;
    status.textContent = dryRun ? "Validating..." : "Importing...";
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
        void app.reload();
      })
      .catch((error: unknown) => {
        status.textContent = lineText(error, app.fail(error));
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
      `Adds the templates of an export file of up to ${String(IMPORT_MAX_BYTES / 1024 / 1024)} MB and ${String(IMPORT_ITEMS_MAX)} templates to a shared folder as new templates, without the file's grants and without templates whose title is already in their folder.`,
    ),
    h(
      "div",
      { class: "form-row" },
      labelled("Export file", input),
      labelled("Target folder", target),
    ),
    h(
      "div",
      { class: "steps" },
      validate,
      run,
      h(
        "span",
        { class: "meta" },
        "Validate writes nothing and shows what Import would do.",
      ),
    ),
    status,
    result,
  );
}

export function transferTab(
  app: AppContext,
  panel: HTMLElement,
  data: AdminData,
): View {
  replace(
    panel,
    exportSection(app, data),
    data.isAdmin ? importSection(app, data) : null,
  );
  return { dispose: () => undefined };
}
