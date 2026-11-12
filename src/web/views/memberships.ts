import type { Memberships } from "../rpc/api";
import { formatTime, h, replace } from "../ui/dom";
import { adminLineText, lineText, skeletonRows } from "../ui/status";
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
 * resolver their members get no access (D7). "Refresh groups" runs `membership.refresh`.
 */
const COLUMNS: readonly Column[] = [
  { label: "Group" },
  { label: "Members", num: true },
  { label: "Groups inside", num: true },
  { label: "Status" },
];

export function membershipsTab(app: AppContext, panel: HTMLElement): View {
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const summary = h("p", { class: "meta" });
  const refresh = h("button", { type: "button" }, "Refresh groups");
  const table = h(
    "div",
    { class: "list", "aria-busy": "true", "aria-label": "Groups" },
    ...skeletonRows(4),
  );

  const warningRow = (group: string, children: readonly string[]) =>
    noteRow(
      COLUMNS,
      "warn",
      `Warning: members of ${children.join(", ")} get no access through ${group}. Add them to ${group} directly.`,
      "warn",
    );

  const draw = (data: Memberships) => {
    summary.textContent = `Members are read from Google${data.nested ? "" : " (direct members only)"}. Last refresh: ${formatTime(data.refreshedAt) || "never"}.`;
    table.setAttribute("aria-busy", "false");
    if (data.groups.length === 0) {
      replace(
        table,
        h(
          "p",
          { class: "empty", role: "status" },
          "No groups yet. A group shows here once it has access to a folder or is the admin group.",
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
        { caption: "Groups the app reads" },
      ),
    );
  };

  const failed = (error: unknown) => {
    table.setAttribute("aria-busy", "false");
    status.textContent = lineText(error, app.fail(error));
  };

  refresh.addEventListener("click", () => {
    refresh.disabled = true;
    status.textContent = "Refreshing groups...";
    app.api
      .refreshMemberships()
      .then((data) => {
        draw(data);
        status.textContent = `Refreshed ${String(data.groups.length)} groups.`;
      })
      .catch((error: unknown) => {
        table.setAttribute("aria-busy", "false");
        status.textContent = adminLineText(error, app.fail(error));
      })
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
