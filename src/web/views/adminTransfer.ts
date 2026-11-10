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
import type { AppContext, View } from "./context";

/**
 * Tab "Export and import" (wireframe 06). Export: whole library (admin) or one folder the caller manages, joined
 * from pages into one JSON download `migway-templates-<scope>-<date>.json`. Import (admin): choose a file and a
 * target folder, Validate (nothing is written), then Import with the same file and target.
 */
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
    data.isAdmin ? "Download JSON" : "Export folder",
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
      status.textContent = `Exporting... ${String(items.length)} of ${String(page.total)} templates.`;
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
    { "aria-labelledby": "export-heading" },
    h(
      "h3",
      { id: "export-heading" },
      data.isAdmin ? "Export" : "Export folder",
    ),
    scope,
    labelled("Folder", folder),
    run,
    status,
  );
}

function reportTable(report: ImportReport): HTMLElement | null {
  if (report.lines.length === 0) return null;
  return h(
    "table",
    { class: "admin-table" },
    h("caption", {}, "Skipped and failed records"),
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        ...["Name", "Kind", "Result", "Reason"].map((label) =>
          h("th", { scope: "col" }, label),
        ),
      ),
    ),
    h(
      "tbody",
      {},
      ...report.lines.map((line) =>
        h(
          "tr",
          {},
          h("td", {}, line.name),
          h("td", {}, line.kind),
          h("td", {}, line.outcome),
          h("td", {}, line.reason),
        ),
      ),
    ),
  );
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
        replace(result, reportTable(report));
        validated = dryRun ? { text, target: folderId } : null;
        if (!dryRun) void app.reload();
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
    { "aria-labelledby": "import-heading" },
    h("h3", { id: "import-heading" }, "Import"),
    h(
      "p",
      { class: "hint" },
      `An export file of up to ${String(IMPORT_MAX_BYTES / 1024 / 1024)} MB and ${String(IMPORT_ITEMS_MAX)} templates. Validate shows what Import would do; nothing is written before Import.`,
    ),
    labelled("Export file", input),
    labelled("Target folder", target),
    h("div", { class: "list-actions" }, validate, run),
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
