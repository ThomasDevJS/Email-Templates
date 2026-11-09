import { atLeast } from "../../shared/permissions/levels";
import { filterItems, folderPath, subtreeIds } from "../library/model";
import type { ItemRow } from "../rpc/api";
import { h, replace } from "../ui/dom";
import { skeletonRows } from "../ui/status";
import type { AppContext, View } from "./context";
import { templateGrid } from "./grid";
import { createFolderTree } from "./tree";

/**
 * Library (screen 3): folder tree, search over title, folder and tags, template grid, New template.
 * `/` focuses the search box. Empty folder and no-results states per spec section 7.
 */
export function libraryView(
  app: AppContext,
  main: HTMLElement,
  folderId: string,
  loading: Promise<boolean>,
): View {
  const search = h("input", {
    type: "search",
    id: "search",
    placeholder: "Search title, folder or tag",
    "aria-keyshortcuts": "/",
    autocomplete: "off",
  });
  const heading = h("h2", { id: "list-heading" }, "Templates");
  const actions = h("div", { class: "list-actions" });
  const list = h(
    "div",
    {
      class: "list",
      "aria-labelledby": "list-heading",
      "aria-busy": "true",
      role: "region",
    },
    ...skeletonRows(),
  );
  const tree = createFolderTree((id) => {
    app.go({ name: "library", folderId: id });
  });

  const folderName = () =>
    folderId === "" ? "All templates" : folderPath(app.folders(), folderId);

  const scoped = (): ItemRow[] => {
    if (folderId === "") return [...app.items()];
    const ids = subtreeIds(app.folders(), folderId);
    return app.items().filter((item) => ids.has(item.folderId));
  };

  const canCreate = () => {
    const folder = app.folders().find((candidate) => candidate.id === folderId);
    return folder !== undefined && atLeast(folder.level, "edit");
  };

  const newButton = () =>
    h(
      "button",
      {
        type: "button",
        class: "primary",
        onclick: () => {
          app.go({ name: "new", folderId });
        },
      },
      "+ New template",
    );

  const emptyState = (query: string) => {
    if (query !== "")
      return h(
        "p",
        { class: "empty", role: "status" },
        `No templates match "${query}". Try folder: or tag:.`,
      );
    return h(
      "div",
      { class: "empty", role: "status" },
      h("p", {}, `No templates in ${folderName()}.`),
      canCreate() ? newButton() : null,
    );
  };

  const drawList = () => {
    const query = search.value.trim();
    const items = filterItems(scoped(), app.folders(), query).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    heading.textContent = folderName();
    replace(actions, canCreate() ? newButton() : null);
    list.setAttribute("aria-busy", "false");
    replace(
      list,
      items.length === 0
        ? emptyState(query)
        : templateGrid(items, app.folders(), {
            open: (item) => {
              app.go({ name: "edit", id: item.id });
            },
            history: (item) => {
              app.go({ name: "history", id: item.id });
            },
          }),
    );
  };

  search.addEventListener("input", drawList);
  const slash = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const typing =
      target.closest("input, textarea, select, [contenteditable]") !== null;
    if (event.key === "/" && !typing) {
      event.preventDefault();
      search.focus();
    }
  };
  document.addEventListener("keydown", slash);

  replace(
    main,
    h(
      "div",
      { class: "library" },
      h(
        "div",
        { class: "search" },
        h("label", { for: "search" }, "Search templates"),
        search,
      ),
      h(
        "nav",
        { class: "folders", "aria-label": "Folders" },
        h("h2", { class: "sr-only" }, "Folders"),
        tree.element,
      ),
      h(
        "section",
        { class: "templates", "aria-labelledby": "list-heading" },
        h("div", { class: "list-header" }, heading, actions),
        list,
      ),
    ),
  );

  void loading.then((ok) => {
    tree.render(app.folders(), folderId);
    if (ok) {
      drawList();
      return;
    }
    list.setAttribute("aria-busy", "false");
    replace(
      list,
      h(
        "p",
        { class: "empty" },
        "Templates could not be loaded. Use Retry in the message, or reload the page.",
      ),
    );
  });

  return {
    dispose: () => {
      document.removeEventListener("keydown", slash);
    },
  };
}
