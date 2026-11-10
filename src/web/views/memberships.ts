import type { Memberships } from "../rpc/api";
import { formatTime, h, replace } from "../ui/dom";
import { lineText, skeletonRows } from "../ui/status";
import {
  adminTable,
  noteRow,
  tableRow,
  toneTag,
  type Column,
} from "./adminTable";
import type { AppContext, View } from "./context";

/**
 * Memberships tab (wireframe 06, admin): resolver, last refresh, one row per group in the refresh set with member
 * count, child group count and status. A group with child groups gets a warning row: with a direct-members
 * resolver their members get no access (D7). "Refresh now" runs `membership.refresh`.
 */
const COLUMNS: readonly Column[] = [
  { label: "Group" },
  { label: "Members", num: true },
  { label: "Child groups", num: true },
  { label: "Status" },
];

export function membershipsTab(app: AppContext, panel: HTMLElement): View {
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const summary = h("p", { class: "meta" });
  const refresh = h("button", { type: "button" }, "Refresh now");
  const table = h(
    "div",
    { class: "list", "aria-busy": "true", "aria-label": "Groups" },
    ...skeletonRows(4),
  );

  const warningRow = (group: string, children: readonly string[]) =>
    noteRow(
      COLUMNS,
      "warn",
      `Warning: ${group} contains ${children.join(", ")}. Members of these child groups get no access: the resolver reads direct members only.`,
      "warn",
    );

  const draw = (data: Memberships) => {
    summary.textContent = `Resolver: ${data.resolver}${data.nested ? "" : " (direct members only)"}. Last refresh: ${formatTime(data.refreshedAt) || "never"}.`;
    table.setAttribute("aria-busy", "false");
    if (data.groups.length === 0) {
      replace(
        table,
        h(
          "p",
          { class: "empty", role: "status" },
          "No groups yet. Groups appear here once a grant names one or ADMIN_GROUP is set.",
        ),
      );
      return;
    }
    replace(
      table,
      adminTable(
        COLUMNS,
        data.groups.flatMap((group) => [
          tableRow(COLUMNS, [
            h("span", { class: "row-title" }, group.group),
            String(group.members),
            String(group.childGroups.length),
            group.status === "ok"
              ? toneTag("OK", "ok")
              : toneTag("Could not be read", "bad"),
          ]),
          ...(group.childGroups.length > 0 && !data.nested
            ? [warningRow(group.group, group.childGroups)]
            : []),
        ]),
        { caption: "Groups in the refresh set" },
      ),
    );
  };

  const failed = (error: unknown) => {
    table.setAttribute("aria-busy", "false");
    status.textContent = lineText(error, app.fail(error));
  };

  refresh.addEventListener("click", () => {
    refresh.disabled = true;
    status.textContent = "Refreshing memberships...";
    app.api
      .refreshMemberships()
      .then((data) => {
        draw(data);
        status.textContent = `Refreshed ${String(data.groups.length)} groups.`;
      }, failed)
      .finally(() => {
        refresh.disabled = false;
        refresh.focus();
      });
  });

  replace(
    panel,
    h("div", { class: "tab-head" }, summary, refresh),
    table,
    status,
  );
  app.api.memberships().then(draw, failed);
  return { dispose: () => undefined };
}
