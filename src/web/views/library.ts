import { atLeast } from "../../shared/permissions/levels";
import { filterItems, folderPath, subtreeIds } from "../library/model";
import type { ItemRow } from "../rpc/api";
import { h, replace } from "../ui/dom";
import { skeletonRows } from "../ui/status";
import type { AppContext, View } from "./context";
import { focusCell, templateGrid } from "./grid";
import { rowMenu } from "./rowActions";
import { createFolderTree } from "./tree";

/**
 * Library (screen 3): folder tree, search over title, folder and tags, template grid, New template.
 * `/` focuses the search box. Empty folder and no-results states per spec section 7.
 */
export function libraryView(
  app: AppContext,
  main: HTMLElement,
  startFolderId: string,
  loading: Promise<boolean>,
): View {
  let folderId = startFolderId;
  const search = h("input", {
    type: "search",
    id: "search",
    placeholder: "Search title, folder or tag",
    "aria-keyshortcuts": "/",
    autocomplete: "off",
  });
  const heading = h("h2", { id: "list-heading" }, "Templates");
  const actions = h("div", { class: "list-actions" });
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
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
  /** Selects a folder in place, so focus stays in the tree (smoke defect 7). */
  const tree = createFolderTree((id) => {
    folderId = id;
    app.pushRoute({ name: "library", folderId: id });
    tree.render(app.folders(), id);
    drawList();
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

  /** After a row action: the row of `focusId`, else the grid's first cell, else the search box. */
  const focusAfter = (focusId: string) => {
    const row = [...list.querySelectorAll("tr")].find(
      (candidate) => candidate.dataset["id"] === focusId,
    );
    const cell =
      row?.cells[1] ?? list.querySelector<HTMLTableCellElement>("tbody td");
    if (cell === null) search.focus();
    else focusCell(cell);
  };

  const afterAction = (text: string, focusId: string) => {
    status.textContent = text;
    drawList();
    focusAfter(focusId);
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
            menu: (item) => rowMenu(app, item, afterAction),
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
        status,
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
