import { displayPath } from "../admin/model";
import { formatTime, h, replace } from "../ui/dom";
import { skeletonRows } from "../ui/status";
import { adminTable, tableRow, type Column } from "./adminTable";
import type { AppContext, View } from "./context";
import { pathBlock } from "./grid";

/** Tab "Usage" (admin, wireframe 06): template, folder, applies in 30 days, last used; most applied first. */
const COLUMNS: readonly Column[] = [
  { label: "Template" },
  { label: "Folder" },
  { label: "Inserts, 30 days", num: true },
  { label: "Last inserted" },
];

export function usageTab(app: AppContext, panel: HTMLElement): View {
  const table = h(
    "div",
    { class: "list", "aria-busy": "true", "aria-label": "Template usage" },
    ...skeletonRows(),
  );
  const hint = h("p", { class: "meta note" });

  const load = () => {
    table.setAttribute("aria-busy", "true");
    app.api.usage().then(
      (data) => {
        table.setAttribute("aria-busy", "false");
        hint.textContent = `Inserts counted since ${data.since}. A new insert can take up to 5 minutes to show.`;
        if (data.rows.length === 0) {
          replace(
            table,
            h(
              "p",
              { class: "empty" },
              "No templates yet. Insert counts show here once the library has templates.",
            ),
          );
          return;
        }
        replace(
          table,
          adminTable(
            COLUMNS,
            data.rows.map((row) =>
              tableRow(COLUMNS, [
                h("span", { class: "row-title" }, row.title),
                pathBlock(displayPath(row.folderPath)),
                String(row.applies30d),
                formatTime(row.lastUsedAt) || "never",
              ]),
            ),
            { caption: "Usage per template" },
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
              "Usage could not be loaded. Press Retry in the message.",
            ),
        );
      },
    );
  };

  replace(panel, hint, table);
  load();
  return { dispose: () => undefined };
}
