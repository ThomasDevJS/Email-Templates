import type { VersionEntry, VersionList } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { escapeText } from "../../shared/html/escape";
import { formatTime, h, replace } from "../ui/dom";
import { shortName } from "../ui/person";
import { skeletonRows, toRpcError } from "../ui/status";
import type { AppContext, View } from "./context";
import { withChips } from "./preview";

/**
 * History (screen 5): version list (`role="listbox"`, arrows move, Enter previews, R restores), preview of the
 * subject line and body with placeholder chips on a sheet, and Restore with a confirm dialog. Restore creates
 * version N+1 from subject and body (linear history).
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
  const previewTitle = h(
    "h2",
    { id: "version-heading", class: "section-label" },
    "Version",
  );
  const preview = h("div", { class: "preview-body" });
  const subject = h("p", { class: "preview-subject" });
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

  /** Version number, then the tags, then time and author on a second line. */
  const entryContent = (entry: VersionEntry) => [
    h(
      "span",
      { class: "version-line" },
      h(
        "span",
        { class: "version-number" },
        `Version ${String(entry.version)}`,
      ),
      entry.current ? h("span", { class: "tag" }, "current") : null,
      entry.restoredFrom > 0
        ? h(
            "span",
            { class: "tag" },
            `restored from ${String(entry.restoredFrom)}`,
          )
        : null,
    ),
    h(
      "span",
      { class: "version-meta", title: entry.savedBy },
      `${formatTime(entry.savedAt)}, ${shortName(entry.savedBy)}`,
    ),
  ];

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
          ...entryContent(entry),
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
    // The short name as in the rows; the full address stays in the tooltip and the accessible name.
    replace(
      previewTitle,
      `Version ${String(entry.version)}, ${formatTime(entry.savedAt)}, `,
      h("span", { title: entry.savedBy }, shortName(entry.savedBy)),
      h("span", { class: "sr-only" }, ` (${entry.savedBy})`),
    );
    preview.setAttribute("aria-busy", "true");
    try {
      const body = await app.api.version(id, entry.version);
      subject.innerHTML =
        body.subject === ""
          ? ""
          : `<span class="subject-label">Subject:</span> ${withChips(escapeText(body.subject))}`;
      preview.innerHTML = withChips(body.html);
    } catch (error: unknown) {
      app.fail(error, () => void showVersion());
    } finally {
      preview.setAttribute("aria-busy", "false");
    }
    restoreButton.disabled = entry.current;
  };

  const load = async () => {
    const first = data === null;
    data = await app.api.versions(id);
    heading.textContent = `${data.title} - History`;
    selected = Math.min(selected, data.versions.length - 1);
    drawList();
    // Arrow keys work at once after opening (smoke 5b item 5).
    if (first) list.focus();
    await showVersion();
  };

  /** Runs after the confirm dialog closed: busy state at once, then the server call. */
  const runRestore = async (version: number, base: number) => {
    restoreButton.disabled = true;
    list.setAttribute("aria-busy", "true");
    status.textContent = `Restoring version ${String(version)}...`;
    try {
      const item = await app.api.restore(id, version, base);
      selected = 0;
      status.textContent = `Restored as version ${String(item.version)}.`;
      await load();
      void app.reload();
    } catch (error: unknown) {
      const rpc = toRpcError(error);
      list.setAttribute("aria-busy", "false");
      restoreButton.disabled = false;
      status.textContent =
        rpc.code === "CONFLICT"
          ? "Not restored: someone saved a newer version. The list is updated."
          : "Not restored.";
      if (rpc.code === "CONFLICT") await load();
      else app.fail(rpc, restore);
    }
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
          run: () => {
            void runRestore(entry.version, base);
            return true;
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
      { class: "page history-page" },
      h(
        "div",
        { class: "page-head" },
        heading,
        h("span", { class: "grow" }),
        h(
          "button",
          {
            type: "button",
            class: "ghost",
            onclick: () => {
              app.go({ name: "edit", id });
            },
          },
          "Open in editor",
        ),
        restoreButton,
      ),
      status,
      h(
        "div",
        { class: "history-columns" },
        h(
          "section",
          { class: "versions-panel", "aria-labelledby": "versions-heading" },
          h(
            "h2",
            { id: "versions-heading", class: "section-label" },
            "Versions",
          ),
          list,
        ),
        h(
          "section",
          {
            class: "preview history-preview",
            "aria-labelledby": "version-heading",
          },
          previewTitle,
          h("div", { class: "sheet" }, subject, preview),
        ),
      ),
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
