import { ErrorCode } from "../../shared/errors/codes";
import { LIBRARY, type AdminTab } from "../router";
import type { FolderRow } from "../rpc/api";
import { h, replace } from "../ui/dom";
import { skeletonRows, toRpcError } from "../ui/status";
import { foldersTab } from "./adminFolders";
import type { AppContext, View } from "./context";
import { membershipsTab } from "./memberships";

/**
 * Admin view (wireframe 06). `admin.folders` decides who enters: DENIED shows the banner and nothing else.
 * Admins get the tabs Folders and grants and Memberships; manage holders get Folders and grants for the folders
 * they manage. The slice 6b tabs are not shown yet. Tabs are an ARIA tablist: Left and Right move and activate,
 * Home and End jump.
 */
export interface AdminData {
  readonly isAdmin: boolean;
  readonly folders: readonly FolderRow[];
}

const TAB_LABELS: Readonly<Record<AdminTab, string>> = {
  folders: "Folders and grants",
  memberships: "Memberships",
};

/** DENIED state (wireframe 07 B): the server sent no folder data. */
function denied(app: AppContext): HTMLElement {
  return h(
    "div",
    { class: "banner", role: "alert" },
    h(
      "p",
      {},
      "You don't have access to the admin view. It is for admins and folder managers.",
    ),
    h(
      "button",
      {
        type: "button",
        class: "link",
        onclick: () => {
          app.go(LIBRARY);
        },
      },
      "Back to the library",
    ),
  );
}

export function adminView(
  app: AppContext,
  main: HTMLElement,
  startTab: AdminTab,
): View {
  const heading = h("h2", { id: "admin-heading" }, "Admin");
  const body = h(
    "div",
    { class: "list", "aria-busy": "true", "aria-labelledby": "admin-heading" },
    ...skeletonRows(),
  );
  let current: View | null = null;

  const show = (data: AdminData, tab: AdminTab) => {
    const tabs: AdminTab[] = data.isAdmin
      ? ["folders", "memberships"]
      : ["folders"];
    let active = tabs.includes(tab) ? tab : "folders";
    const panel = h("div", {
      class: "tab-panel",
      role: "tabpanel",
      id: "admin-panel",
    });
    const buttons = tabs.map((name) =>
      h(
        "button",
        {
          type: "button",
          role: "tab",
          id: `tab-${name}`,
          "aria-controls": "admin-panel",
          onclick: () => {
            select(name, false);
          },
        },
        TAB_LABELS[name],
      ),
    );
    const select = (name: AdminTab, focus: boolean) => {
      active = name;
      buttons.forEach((button, index) => {
        const on = tabs[index] === name;
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
        if (on && focus) button.focus();
      });
      panel.setAttribute("aria-labelledby", `tab-${name}`);
      app.replaceRoute({ name: "admin", tab: name });
      current?.dispose();
      current =
        name === "folders"
          ? foldersTab(app, panel, data)
          : membershipsTab(app, panel);
    };
    const tablist = h(
      "div",
      { role: "tablist", "aria-label": "Admin sections", class: "tabs" },
      ...buttons,
    );
    tablist.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(active);
      const next: Record<string, number> = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      };
      const target = tabs[next[event.key] ?? -1];
      if (target === undefined) return;
      event.preventDefault();
      select(target, true);
    });
    body.setAttribute("aria-busy", "false");
    replace(body, tablist, panel);
    select(active, false);
  };

  replace(
    main,
    h(
      "section",
      { class: "admin", "aria-labelledby": "admin-heading" },
      heading,
      body,
    ),
  );
  const load = () => {
    app.api.adminFolders().then(
      (data) => {
        show(data, startTab);
      },
      (error: unknown) => {
        body.setAttribute("aria-busy", "false");
        replace(
          body,
          toRpcError(error).code === ErrorCode.DENIED
            ? denied(app)
            : (app.fail(error, load) ??
                h(
                  "p",
                  { class: "empty" },
                  "The admin view could not be loaded. Use Retry in the message, or reload the page.",
                )),
        );
      },
    );
  };
  load();
  return {
    dispose: () => {
      current?.dispose();
    },
  };
}
