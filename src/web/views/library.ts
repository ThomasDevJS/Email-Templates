import { atLeast } from "../../shared/permissions/levels";
import { parseQuery } from "../../shared/search/match";
import { folderPath, searchItems, subtreeIds } from "../library/model";
import type { ItemRow } from "../rpc/api";
import { h, replace } from "../ui/dom";
import { lineText, skeletonRows } from "../ui/status";
import type { AppContext, View } from "./context";
import { focusCell, templateGrid, type GridActions } from "./grid";
import { rowMenu } from "./rowActions";
import { createFolderTree } from "./tree";

/**
 * Library (screen 3): folder tree, search over title, subject, folder and tags with `folder:` and `tag:`, the
 * Favorites filter, template grid with stars, New template. Body text matches arrive from `search.body` after a
 * pause in typing and show under "Matches in text". `/` focuses the search box. Empty folder and no-results
 * states per spec section 7. `performance.measure` entries `library.list` and `library.body` time both steps
 * (spec 12: under 1 s after the first load).
 */
const BODY_SEARCH_DELAY_MS = 300;
const SEARCHING = "Searching text...";

export function libraryView(
  app: AppContext,
  main: HTMLElement,
  startFolderId: string,
  loading: Promise<boolean>,
): View {
  let folderId = startFolderId;
  let onlyFavorites = false;
  let bodyTimer = 0;
  /** Body matches for `bodyQuery`; dropped when the query changes. */
  let bodyQuery = "";
  let bodyIds: readonly string[] = [];
  let bodySkipped = 0;
  /** Query whose `search.body` call is still due or running; "" when none. */
  let bodyPending = "";
  const search = h("input", {
    type: "search",
    id: "search",
    placeholder: "Search title, subject, folder or tag",
    "aria-keyshortcuts": "/",
    autocomplete: "off",
  });
  const favoritesFilter = h(
    "button",
    { type: "button", class: "filter", "aria-pressed": "false" },
    "★ Favorites",
  );
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
    const ids = folderId === "" ? null : subtreeIds(app.folders(), folderId);
    const favorites = app.favorites();
    return app
      .items()
      .filter((item) => ids === null || ids.has(item.folderId))
      .filter((item) => !onlyFavorites || favorites.has(item.id));
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
    if (onlyFavorites)
      return h(
        "p",
        { class: "empty", role: "status" },
        `No favorites in ${folderName()}. Use the star in a row to add one.`,
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

  const toggleFavorite = (item: ItemRow) => {
    const favorite = !app.favorites().has(item.id);
    app.setFavorite(item.id, favorite).then(
      () => {
        afterAction(
          favorite
            ? `Added "${item.title}" to favorites.`
            : `Removed "${item.title}" from favorites.`,
          item.id,
        );
        const row = [...list.querySelectorAll("tr")].find(
          (candidate) => candidate.dataset["id"] === item.id,
        );
        if (row?.cells[0] !== undefined) focusCell(row.cells[0]);
      },
      (error: unknown) => {
        status.textContent = lineText(error, app.fail(error));
      },
    );
  };

  const gridActions: GridActions = {
    open: (item) => {
      app.go({ name: "edit", id: item.id });
    },
    menu: (item) =>
      rowMenu(app, item, {
        busy: (text) => {
          status.textContent = text;
        },
        done: afterAction,
      }),
    isFavorite: (item) => app.favorites().has(item.id),
    toggleFavorite,
  };

  /** Templates in scope whose body matched and that the title search did not list, in server order. */
  const bodyMatches = (shown: readonly ItemRow[]): ItemRow[] => {
    if (bodyQuery !== search.value.trim()) return [];
    const listed = new Set(shown.map((item) => item.id));
    const byId = new Map(scoped().map((item) => [item.id, item]));
    return bodyIds.flatMap((id) =>
      listed.has(id) ? [] : (byId.get(id) ?? []),
    );
  };

  const searching = () =>
    bodyPending !== "" && bodyPending === search.value.trim();

  const bodySection = (shown: readonly ItemRow[]): HTMLElement[] => {
    if (searching()) return [h("p", { class: "hint" }, SEARCHING)];
    const extra = bodyMatches(shown);
    const note =
      bodyQuery === search.value.trim() && bodySkipped > 0
        ? h(
            "p",
            { class: "hint" },
            `${String(bodySkipped)} templates were not searched yet. Search again to include them.`,
          )
        : null;
    if (extra.length === 0) return note === null ? [] : [note];
    return [
      h("h3", { class: "matches-heading" }, "Matches in text"),
      templateGrid(extra, app.folders(), gridActions, "Matches in text"),
      ...(note === null ? [] : [note]),
    ];
  };

  const drawList = () => {
    const started = performance.now();
    const query = search.value.trim();
    const items = searchItems(scoped(), app.folders(), query, app.recent());
    heading.textContent = folderName();
    replace(actions, canCreate() ? newButton() : null);
    // The status region announces the text search; the list stays busy until its reply (slice 5b minors 3, 4).
    list.setAttribute("aria-busy", String(searching()));
    if (searching()) status.textContent = SEARCHING;
    else if (status.textContent === SEARCHING) status.textContent = "";
    const body = bodySection(items);
    const grid =
      items.length === 0
        ? null
        : templateGrid(items, app.folders(), gridActions);
    replace(
      list,
      grid === null && body.length === 0 ? emptyState(query) : grid,
      ...body,
    );
    performance.measure("library.list", { start: started });
  };

  /** `search.body` after a pause in typing, for queries with words (operators alone filter in the browser). */
  const searchBodies = () => {
    window.clearTimeout(bodyTimer);
    const query = search.value.trim();
    bodyPending = parseQuery(query).terms.length === 0 ? "" : query;
    if (bodyPending === "") return;
    bodyTimer = window.setTimeout(() => {
      const started = performance.now();
      app.api.searchBody(query).then(
        (found) => {
          if (query !== search.value.trim()) return;
          bodyPending = "";
          bodyQuery = query;
          bodyIds = found.ids;
          bodySkipped = found.skipped;
          drawList();
          performance.measure("library.body", { start: started });
        },
        (error: unknown) => {
          if (query !== search.value.trim()) return;
          bodyPending = "";
          drawList();
          app.fail(error);
        },
      );
    }, BODY_SEARCH_DELAY_MS);
  };

  search.addEventListener("input", () => {
    searchBodies();
    drawList();
  });
  favoritesFilter.addEventListener("click", () => {
    onlyFavorites = !onlyFavorites;
    favoritesFilter.setAttribute("aria-pressed", String(onlyFavorites));
    drawList();
  });
  /** The key may target the document itself when nothing in the page has focus (smoke 5b item 8). */
  const slash = (event: KeyboardEvent) => {
    const target = event.target;
    const typing =
      target instanceof Element &&
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
        favoritesFilter,
      ),
      h(
        "nav",
        { class: "folders", "aria-label": "Folders" },
        h("h2", { class: "sr-only" }, "Folders"),
        tree.element,
        h(
          "button",
          {
            type: "button",
            class: "link trash-link",
            onclick: () => {
              app.go({ name: "trash" });
            },
          },
          "Trash",
        ),
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
      window.clearTimeout(bodyTimer);
    },
  };
}
