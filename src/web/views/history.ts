import type { VersionEntry, VersionList } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { formatTime, h, replace } from "../ui/dom";
import { skeletonRows, toRpcError } from "../ui/status";
import type { AppContext, View } from "./context";
import { withChips } from "./preview";

/**
 * History (screen 5): version list (`role="listbox"`, arrows move, Enter previews, R restores), preview with
 * placeholder chips, and Restore with a confirm dialog. Restore creates version N+1 (linear history).
 */
export function historyView(
  app: AppContext,
  main: HTMLElement,
  id: string,
): View {
  let data: VersionList | null = null;
  let selected = 0;
  const heading = h("h1", {}, "History");
  const list = h(
    "ul",
    {
      role: "listbox",
      "aria-label": "Versions",
      class: "versions",
      tabindex: "0",
      "aria-busy": "true",
    },
    ...skeletonRows().map((row) => h("li", { "aria-hidden": "true" }, row)),
  );
  const previewTitle = h("h2", { id: "version-heading" }, "Version");
  const preview = h("div", { class: "preview-body" });
  const restoreButton = h(
    "button",
    { type: "button", class: "primary", "aria-keyshortcuts": "R" },
    "Restore this version",
  );
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });

  const entryText = (entry: VersionEntry) => {
    const parts = [
      `Version ${String(entry.version)}`,
      formatTime(entry.savedAt),
      entry.savedBy,
    ];
    if (entry.current) parts.push("current");
    if (entry.restoredFrom > 0)
      parts.push(`restored from ${String(entry.restoredFrom)}`);
    return parts.join(", ");
  };

  const drawList = () => {
    if (data === null) return;
    const versions = data.versions;
    list.setAttribute("aria-busy", "false");
    replace(
      list,
      ...versions.map((entry, i) =>
        h(
          "li",
          {
            role: "option",
            id: `version-${String(entry.version)}`,
            "aria-selected": String(i === selected),
            class: "version",
            onclick: () => {
              selected = i;
              drawList();
              void showVersion();
            },
          },
          entryText(entry),
        ),
      ),
    );
    const active = versions[selected];
    if (active !== undefined)
      list.setAttribute(
        "aria-activedescendant",
        `version-${String(active.version)}`,
      );
  };

  const showVersion = async () => {
    const entry = data?.versions[selected];
    if (entry === undefined) return;
    previewTitle.textContent = `Version ${String(entry.version)}, ${formatTime(entry.savedAt)}, ${entry.savedBy}`;
    preview.setAttribute("aria-busy", "true");
    try {
      const body = await app.api.version(id, entry.version);
      preview.innerHTML = withChips(body.html);
    } catch (error: unknown) {
      app.fail(error, () => void showVersion());
    } finally {
      preview.setAttribute("aria-busy", "false");
    }
    restoreButton.disabled = entry.current;
  };

  const load = async () => {
    data = await app.api.versions(id);
    heading.textContent = `${data.title} - History`;
    selected = Math.min(selected, data.versions.length - 1);
    drawList();
    await showVersion();
  };

  const restore = () => {
    const entry = data?.versions[selected];
    if (data === null || entry === undefined || entry.current) return;
    const base = data.currentVersion;
    openDialog({
      title: "Restore version",
      body: h(
        "p",
        {},
        `Create version ${String(base + 1)} from version ${String(entry.version)}?`,
      ),
      actions: [
        {
          label: "Restore",
          primary: true,
          run: async () => {
            try {
              const item = await app.api.restore(id, entry.version, base);
              selected = 0;
              status.textContent = `Restored as version ${String(item.version)}.`;
              await load();
              void app.reload();
            } catch (error: unknown) {
              const rpc = toRpcError(error);
              status.textContent =
                rpc.code === "CONFLICT"
                  ? "Not restored: someone saved a newer version. The list is updated."
                  : "Not restored.";
              if (rpc.code === "CONFLICT") await load();
              else app.fail(rpc, restore);
            }
          },
        },
        { label: "Cancel", run: () => true },
      ],
    });
  };

  list.addEventListener("keydown", (event) => {
    const count = data?.versions.length ?? 0;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(selected + 1, count - 1),
      ArrowUp: Math.max(selected - 1, 0),
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      selected = next;
      drawList();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void showVersion();
    } else if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      restore();
    }
  });
  restoreButton.addEventListener("click", restore);

  replace(
    main,
    h(
      "div",
      { class: "history-page" },
      h(
        "div",
        { class: "editor-header" },
        h(
          "button",
          {
            type: "button",
            class: "link",
            onclick: () => {
              app.go({ name: "edit", id });
            },
          },
          "‹ Editor",
        ),
        heading,
      ),
      h(
        "div",
        { class: "history-columns" },
        h(
          "section",
          { "aria-labelledby": "versions-heading" },
          h("h2", { id: "versions-heading" }, "Versions"),
          list,
        ),
        h(
          "section",
          { class: "preview", "aria-labelledby": "version-heading" },
          previewTitle,
          preview,
          restoreButton,
        ),
      ),
      status,
    ),
  );

  load().catch((error: unknown) => {
    const shown = app.fail(error, () => {
      app.go({ name: "history", id });
    });
    if (shown !== null) replace(main, shown);
  });

  return { dispose: () => undefined };
}
