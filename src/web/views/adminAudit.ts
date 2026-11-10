import type { AuditEvent } from "../../shared/model/data";
import { localDate, localDayStart } from "../admin/model";
import type { AuditFilter, AuditPage, AuditRow } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { formatTime, h, replace, uid } from "../ui/dom";
import { skeletonRows } from "../ui/status";
import type { AppContext, View } from "./context";

/**
 * Tab "Audit log" (admin, wireframe 06): month, date range, actor, action, result and target filters, 50 rows per
 * page, a details drawer with before and after JSON. The server reads the month file plus events not yet rolled.
 */
const RESULTS = ["ok", "denied", "conflict", "error"];
const NOTE =
  "Source: the month's audit file plus events not yet rolled (daily). Denied and apply events can arrive up to 5 min late.";

function select(options: readonly [string, string][]): HTMLSelectElement {
  return h(
    "select",
    {},
    ...options.map(([value, label]) => h("option", { value }, label)),
  );
}

function setOptions(
  element: HTMLSelectElement,
  options: readonly [string, string][],
): void {
  const value = element.value;
  replace(
    element,
    ...options.map(([v, label]) => h("option", { value: v }, label)),
  );
  element.value = options.some(([v]) => v === value) ? value : "";
}

function json(label: string, value: unknown): HTMLElement {
  return h(
    "div",
    {},
    h("h3", {}, label),
    h(
      "pre",
      { class: "json", tabindex: "0", "aria-label": `${label} JSON` },
      JSON.stringify(value, null, 2),
    ),
  );
}

function details(event: AuditEvent, returnFocus: HTMLElement): void {
  const facts: [string, string][] = [
    ["Time", formatTime(event.ts)],
    ["Actor", `${event.actor} (${event.actorRoles || "no level"})`],
    ["Action", event.action],
    ["Target", event.targetPath || event.targetId || event.targetType],
    [
      "Result",
      event.errorCode === ""
        ? event.result
        : `${event.result} (${event.errorCode})`,
    ],
    ["Duration", `${String(event.durationMs)} ms`],
    ["Request ID", event.requestId || "none"],
    ["App version", event.appVersion],
  ];
  openDialog({
    title: "Event details",
    variant: "drawer",
    returnFocus,
    body: h(
      "div",
      {},
      h(
        "dl",
        { class: "facts" },
        ...facts.flatMap(([term, value]) => [
          h("dt", {}, term),
          h("dd", {}, value),
        ]),
      ),
      json("Before", event.before),
      json("After", event.after),
    ),
    actions: [{ label: "Close", run: () => undefined }],
  });
}

export function auditTab(app: AppContext, panel: HTMLElement): View {
  const thisMonth = localDate(new Date()).slice(0, 7);
  const month = select([[thisMonth, thisMonth]]);
  const from = h("input", { type: "date" });
  const to = h("input", { type: "date" });
  const actor = h("input", { type: "text", maxlength: 254 });
  const action = select([["", "All actions"]]);
  const result = select([
    ["", "All results"],
    ...RESULTS.map((r): [string, string] => [r, r]),
  ]);
  const target = h("input", { type: "text", maxlength: 200 });
  const apply = h("button", { type: "submit", class: "primary" }, "Apply");
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const table = h(
    "div",
    { class: "list", "aria-busy": "true", "aria-label": "Audit events" },
    ...skeletonRows(),
  );
  const pager = h("div", { class: "list-actions" });
  let page = 0;
  let ticket = 0;

  const labelled = (label: string, input: HTMLElement) => {
    const id = uid("audit");
    input.id = id;
    return h("div", { class: "field" }, h("label", { for: id }, label), input);
  };

  const filter = (): AuditFilter => ({
    month: month.value,
    from: localDayStart(from.value),
    to: localDayStart(to.value, true),
    actor: actor.value.trim(),
    action: action.value,
    result: result.value,
    target: target.value.trim(),
    page,
  });

  const row = (entry: AuditRow) => {
    const open = h(
      "button",
      {
        type: "button",
        "aria-label": `Details: ${entry.action} at ${formatTime(entry.ts)}`,
      },
      "Details",
    );
    open.addEventListener("click", () => {
      status.textContent = "Loading event details...";
      app.api.auditEvent(entry.ts.slice(0, 7), entry.id).then(
        ({ event }) => {
          status.textContent = "";
          details(event, open);
        },
        (error: unknown) => {
          status.textContent = app.fail(error)?.textContent ?? "";
        },
      );
    });
    return h(
      "tr",
      {},
      h("td", {}, formatTime(entry.ts)),
      h("td", {}, entry.actor),
      h("td", {}, entry.action),
      h("td", {}, entry.targetPath || entry.targetId || entry.targetType),
      h("td", {}, entry.result),
      h("td", {}, open),
    );
  };

  const pageButton = (label: string, to: number, enabled: boolean) => {
    const button = h("button", { type: "button" }, label);
    button.disabled = !enabled;
    button.addEventListener("click", () => {
      page = to;
      load();
    });
    return button;
  };

  const draw = (data: AuditPage) => {
    setOptions(
      month,
      data.months.map((m): [string, string] => [m, m]),
    );
    month.value = data.month;
    setOptions(action, [
      ["", "All actions"],
      ...data.actions.map((a): [string, string] => [a, a]),
    ]);
    table.setAttribute("aria-busy", "false");
    const first = data.page * data.pageSize;
    status.textContent =
      data.total === 0
        ? ""
        : `Events ${String(first + 1)} to ${String(first + data.rows.length)} of ${String(data.total)}.`;
    replace(
      pager,
      pageButton("Previous page", data.page - 1, data.page > 0),
      pageButton(
        "Next page",
        data.page + 1,
        first + data.rows.length < data.total,
      ),
    );
    if (data.rows.length === 0) {
      replace(
        table,
        h(
          "p",
          { class: "empty" },
          `No audit events in ${data.month} match these filters.`,
        ),
      );
      return;
    }
    replace(
      table,
      h(
        "table",
        { class: "admin-table" },
        h("caption", { class: "sr-only" }, `Audit events of ${data.month}`),
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            ...["Time", "Actor", "Action", "Target", "Result", "Details"].map(
              (label) => h("th", { scope: "col" }, label),
            ),
          ),
        ),
        h("tbody", {}, ...data.rows.map(row)),
      ),
    );
  };

  const load = () => {
    const mine = ++ticket;
    table.setAttribute("aria-busy", "true");
    status.textContent = "Loading audit events...";
    app.api.audit(filter()).then(
      (data) => {
        if (mine === ticket) draw(data);
      },
      (error: unknown) => {
        if (mine !== ticket) return;
        table.setAttribute("aria-busy", "false");
        status.textContent = "";
        replace(
          table,
          app.fail(error, load) ??
            h(
              "p",
              { class: "empty" },
              "The audit log could not be loaded. Use Retry in the message.",
            ),
        );
      },
    );
  };

  const form = h(
    "form",
    { class: "filters", "aria-label": "Audit filters" },
    labelled("Month", month),
    labelled("Date from", from),
    labelled("Date to", to),
    labelled("Actor", actor),
    labelled("Action", action),
    labelled("Result", result),
    labelled("Target", target),
    apply,
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    page = 0;
    load();
  });
  month.addEventListener("change", () => {
    page = 0;
    load();
  });

  replace(panel, form, h("p", { class: "hint" }, NOTE), status, table, pager);
  load();
  return { dispose: () => undefined };
}
