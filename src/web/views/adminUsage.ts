import { displayPath } from "../admin/model";
import { formatTime, h, replace } from "../ui/dom";
import { skeletonRows } from "../ui/status";
import type { AppContext, View } from "./context";

/** Tab "Usage" (admin, wireframe 06): template, folder, applies in 30 days, last used; most applied first. */
export function usageTab(app: AppContext, panel: HTMLElement): View {
  const table = h(
    "div",
    { class: "list", "aria-busy": "true", "aria-label": "Template usage" },
    ...skeletonRows(),
  );
  const hint = h("p", { class: "hint" });

  const load = () => {
    table.setAttribute("aria-busy", "true");
    app.api.usage().then(
      (data) => {
        table.setAttribute("aria-busy", "false");
        hint.textContent = `Applies counted from ${data.since} (UTC days). Apply events can arrive up to 5 min late.`;
        if (data.rows.length === 0) {
          replace(
            table,
            h(
              "p",
              { class: "empty" },
              "No templates yet. Usage appears here once templates exist.",
            ),
          );
          return;
        }
        replace(
          table,
          h(
            "table",
            { class: "admin-table" },
            h("caption", { class: "sr-only" }, "Usage per template"),
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                ...["Template", "Folder", "Applies 30 d", "Last used"].map(
                  (label) => h("th", { scope: "col" }, label),
                ),
              ),
            ),
            h(
              "tbody",
              {},
              ...data.rows.map((row) =>
                h(
                  "tr",
                  {},
                  h("td", {}, row.title),
                  h("td", {}, displayPath(row.folderPath)),
                  h("td", {}, String(row.applies30d)),
                  h("td", {}, formatTime(row.lastUsedAt) || "never"),
                ),
              ),
            ),
          ),
        );
      },
      (error: unknown) => {
        table.setAttribute("aria-busy", "false");
        replace(
          table,
          app.fail(error, load) ??
            h(
              "p",
              { class: "empty" },
              "Usage could not be loaded. Use Retry in the message.",
            ),
        );
      },
    );
  };

  replace(panel, hint, table);
  load();
  return { dispose: () => undefined };
}
