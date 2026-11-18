/** Web app shell (screens 3 to 5), bundled and inlined into index.html by scripts/build.mjs (ADR-0005). */
import { googleHost, type GoogleScript, type Host } from "./host";
import {
  ADMIN,
  LIBRARY,
  parseRoute,
  routeHash,
  startRoute,
  type Route,
} from "./router";
import {
  createApi,
  type FolderRow,
  type ItemRow,
  type Profile,
} from "./rpc/api";
import { requestIdNow } from "../shared/requestId";
import { ErrorCode, NOT_SET_UP_TEXT } from "../shared/errors/codes";
import { createClient } from "./rpc/client";
import { createBusy } from "./ui/busy";
import {
  authPage,
  banner,
  presentationOf,
  showToast,
  toRpcError,
} from "./ui/status";
import { cancelDialogs, setInert, trapTab } from "./ui/dialog";
import { h, replace } from "./ui/dom";
import { icon, iconSprite } from "./ui/icons";
import { initials, shortName } from "./ui/person";
import { folderCounts } from "./library/model";
import { adminView } from "./views/admin";
import type { AppContext, View } from "./views/context";
import { editorView } from "./views/editor";
import { historyView } from "./views/history";
import { libraryView } from "./views/library";
import { trashView } from "./views/trash";
import { createFolderTree } from "./views/tree";

declare const google: { readonly script: GoogleScript };

/** The first load may take this long before the page says it failed (test round 1: a blank page until a retry). */
export const FIRST_LOAD_MS = 15_000;
/** Calls that never block the page: the text search runs while the user types; the account name is decoration. */
const QUIET_OPS: ReadonlySet<string> = new Set(["search.body", "profile.me"]);
const WAITS_FOR_LOAD: ReadonlySet<Route["name"]> = new Set([
  "library",
  "trash",
  "edit",
  "new",
]);

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`index.html lacks #${id}`);
  return found;
}

/** Which sidebar entry a route marks as current: one of the `data-nav` names, or "" for none. */
function navOf(route: Route, favoritesOnly: boolean): string {
  if (route.name === "library") {
    if (favoritesOnly) return "favorites";
    return route.folderId === "" ? "library" : "";
  }
  return route.name === "trash" || route.name === "admin" ? route.name : "";
}

export function startApp(host: Host): AppContext {
  const main = element("main");
  const toasts = element("toasts");
  const side = element("side");
  const menuButton = element("menu-button");
  const client = createClient(host.runner, requestIdNow);
  // D37: every call blocks the page while it runs, except searches while typing and background refreshes.
  const busy = createBusy([main, side]);
  const api = createApi({
    call: (op, args) =>
      QUIET_OPS.has(op)
        ? client.call(op, args)
        : busy.track(client.call(op, args)),
  });

  let folders: FolderRow[] = [];
  let items: ItemRow[] = [];
  let favorites = new Set<string>();
  let recent: string[] = [];
  let profile: Profile | null = null;
  let view: View | null = null;
  /** The first view of this page load (see `blocking`). */
  let firstView: View | null = null;
  let route: Route = LIBRARY;
  /** The sidebar's "Favorites": the library shows only starred templates of every folder. */
  let favoritesOnly = false;
  document.body.prepend(iconSprite());

  /**
   * Under 860 px the sidebar opens as a modal panel from the menu button: Tab wraps inside it, the page behind is
   * inert, and Esc, a pick or a press outside closes it.
   */
  const isOpen = () => side.classList.contains("open");
  const outside = (event: Event) => {
    const target = event.target as Element;
    // A dialog over the panel (the leave question) is not outside: its answer returns focus into the panel.
    if (!side.contains(target) && target.closest(".backdrop") === null)
      setPanel(false);
  };
  const setPanel = (open: boolean, focusButton = false) => {
    side.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    setInert(main, open);
    if (open) document.addEventListener("mousedown", outside, true);
    else document.removeEventListener("mousedown", outside, true);
    if (focusButton) menuButton.focus();
  };
  const closePanel = () => {
    if (isOpen()) setPanel(false);
  };
  menuButton.addEventListener("click", () => {
    setPanel(!isOpen());
  });
  side.addEventListener("keydown", (event) => {
    if (!isOpen()) return;
    if (event.key === "Escape") setPanel(false, true);
    else if (event.key === "Tab") trapTab(side, event);
  });
  // A window that grows past 860 px shows the sidebar again, so the page behind must not stay inert.
  window
    .matchMedia("(min-width: 860px)")
    .addEventListener("change", (event) => {
      if (event.matches) closePanel();
    });

  /** Sidebar state: the current entry, the selected folder and the counts from the loaded index. */
  const tree = createFolderTree((id) => {
    openScope(id, false);
  }, null);
  element("side-folders").append(tree.element);
  /** `reveal`: the user chose this route, so the tree shows its folder (slice 23). */
  const drawSide = (reveal = false) => {
    const current = navOf(route, favoritesOnly);
    for (const link of document.querySelectorAll<HTMLElement>("[data-nav]"))
      link.toggleAttribute("aria-current", link.dataset["nav"] === current);
    const selected =
      route.name === "library" && !favoritesOnly ? route.folderId : "";
    tree.render(folders, selected, folderCounts(folders, items), reveal);
  };

  const reload = async () => {
    const [folderList, itemList] = await Promise.all([
      api.folders(),
      api.templates(),
    ]);
    folders = folderList.folders;
    items = itemList.items;
    favorites = new Set(itemList.favorites);
    recent = itemList.recent;
    drawSide();
  };
  let loading: Promise<void> = Promise.resolve();
  /** Resolves true when folders and templates loaded; the failure itself is shown once, as a toast. */
  const loaded = () => loading.then(() => true).catch(() => false);
  /** Loads the library. A failure shows a toast whose Retry loads again and then runs `afterRetry`. */
  const load = (afterRetry: () => void): Promise<boolean> => {
    loading = reload();
    return loading.then(
      () => true,
      (error: unknown) => {
        app.fail(error, () => {
          void load(afterRetry).then((ok) => {
            if (ok) afterRetry();
          });
        });
        return false;
      },
    );
  };
  /** Set by an admin folder write; the next view that shows the library loads it again (smoke 6b defect B). */
  let stale = false;
  const fresh = (): Promise<boolean> => {
    if (!stale) return loaded();
    stale = false;
    return load(() => undefined);
  };
  const rerender = () => {
    void host.location().then((location) => {
      render(startRoute(location), true);
    });
  };

  /** Route hook of the unsaved-changes guard (slice 8b): a view may hold a route change and run `leave` later. */
  const leaving = (leave: () => void) => {
    if (view?.canLeave?.(leave) !== false) leave();
  };

  const show = (next: Route) => {
    host.navigate(routeHash(next), false);
    render(next, true);
    main.focus();
  };

  const render = (next: Route, reveal = false) => {
    view?.dispose();
    route = next;
    if (next.name !== "library") favoritesOnly = false;
    closePanel();
    drawSide(reveal);
    view = viewOf(next);
    firstView ??= view;
  };

  const viewOf = (next: Route): View => {
    switch (next.name) {
      case "library":
        return libraryView(
          app,
          main,
          { folderId: next.folderId, favorites: favoritesOnly },
          fresh(),
        );
      case "history":
        return historyView(app, main, next.id);
      case "trash":
        return trashView(app, main, fresh());
      case "admin":
        return adminView(app, main, next.tab);
      case "edit":
        return editorView(app, main, { id: next.id }, fresh());
      case "new":
        return editorView(app, main, { folderId: next.folderId }, fresh());
    }
  };

  /** A folder, all templates or the favorites: in place when the library shows (focus stays), else a new view. */
  const openScope = (folderId: string, onlyFavorites: boolean) => {
    const next: Route = { name: "library", folderId };
    if (view?.scope === undefined) {
      // Favorites mode is set only when the view really leaves, so a cancelled exit leaves no state behind.
      leaving(() => {
        favoritesOnly = onlyFavorites;
        show(next);
      });
      return;
    }
    favoritesOnly = onlyFavorites;
    route = next;
    app.pushRoute(next);
    closePanel();
    drawSide(true);
    view.scope(folderId, onlyFavorites);
  };

  /**
   * The sidebar shows Admin to callers who manage a folder, and to admins; `admin.folders` decides on entry. A new
   * install has no folder yet, so an admin manages none: the `me` call covers that case.
   */
  const showAdminLink = () => {
    if (folders.some((folder) => folder.level === "manage")) addAdminLink();
    else
      void app.background
        .me()
        .then((me) => {
          if (me.isAdmin) addAdminLink();
        })
        // Without the answer the link stays hidden; `?view=admin` still opens Admin.
        .catch(() => undefined);
  };

  const addAdminLink = () => {
    if (document.querySelector("[data-nav=admin]") !== null) return;
    const button = h(
      "button",
      { type: "button", class: "nav-item", "data-nav": "admin" },
      icon("gear"),
      "Admin",
    );
    button.addEventListener("click", () => {
      app.go(ADMIN);
    });
    button.toggleAttribute("aria-current", route.name === "admin");
    element("side-manage").append(button);
  };

  const app: AppContext = {
    api,
    background: createApi(client),
    profile: () => profile,
    folders: () => folders,
    items: () => items,
    favorites: () => favorites,
    recent: () => recent,
    setFavorite: async (id, favorite) => {
      await api.setFavorite(id, favorite);
      if (favorite) favorites.add(id);
      else favorites.delete(id);
    },
    reload: async () => {
      await load(() => undefined);
    },
    itemSaved: (item) => {
      const folder = folders.find((entry) => entry.id === item.folderId);
      // A folder this page does not know: read the lists again.
      if (folder === undefined) {
        void load(() => undefined);
        return;
      }
      const row: ItemRow = { ...item, level: folder.level };
      const known = items.some((entry) => entry.id === item.id);
      items = known
        ? items.map((entry) => (entry.id === item.id ? row : entry))
        : [...items, row];
      drawSide();
    },
    foldersChanged: () => {
      stale = true;
    },
    go: (next) => {
      leaving(() => {
        show(next);
      });
    },
    replaceRoute: (next) => {
      host.navigate(routeHash(next), true);
    },
    pushRoute: (next) => {
      host.navigate(routeHash(next), false);
    },
    fail: (error, retry) => {
      const rpc = toRpcError(error);
      const presentation = presentationOf(rpc.code);
      if (presentation === "auth") {
        authPage(document.body);
        return null;
      }
      if (presentation === "toast") {
        showToast(toasts, rpc, retry);
        return null;
      }
      return banner(rpc, () => {
        app.go(LIBRARY);
      });
    },
  };

  /** True while main shows the first-load error or its "Loading..." line, so a late success renders the route. */
  let blocked = false;
  /**
   * The first-load error replaces only the first view of the page load, and only one that waits for this load
   * (library, editor, trash); a view that drew on its own (Admin, History) keeps its page and gets the usual toast.
   */
  const blocking = () =>
    main.isConnected &&
    (blocked ||
      view === null ||
      (view === firstView && WAITS_FOR_LOAD.has(route.name)));
  const firstLoad = (): Promise<boolean> => {
    const timer = window.setTimeout(() => {
      if (blocking()) stalled(null);
    }, FIRST_LOAD_MS);
    loading = reload();
    return loading.then(
      () => {
        window.clearTimeout(timer);
        if (blocked) {
          blocked = false;
          rerender();
        }
        return true;
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        // Quiet: the banner is the one message; the auth page and views that drew keep the usual handling.
        if (presentationOf(toRpcError(error).code) !== "auth" && blocking())
          stalled(error);
        else
          app.fail(error, () => {
            void load(rerender).then((ok) => {
              if (ok) rerender();
            });
          });
        return false;
      },
    );
  };
  /** No answer in time, or a failed first load: one plain error with Reload. */
  const stalled = (error: unknown) => {
    blocked = true;
    const notSetUp =
      error !== null && toRpcError(error).code === ErrorCode.NOT_CONFIGURED;
    replace(
      main,
      h(
        "div",
        { class: "banner", role: "alert" },
        h(
          "p",
          {},
          notSetUp
            ? NOT_SET_UP_TEXT
            : "Templates could not be loaded. Press Reload to try again.",
        ),
        h(
          "button",
          {
            type: "button",
            onclick: () => {
              replace(
                main,
                h("p", { class: "status", role: "status" }, "Loading..."),
              );
              // The button is gone: focus goes to the page region, not the body.
              main.focus();
              void firstLoad().then(showAdminLink);
            },
          },
          "Reload",
        ),
      ),
    );
  };
  void firstLoad().then(showAdminLink);
  api
    .profile()
    .then((me) => {
      profile = me;
      element("account-name").textContent = shortName(me.email);
      element("account-avatar").textContent = initials(me.email);
      element("signed-in").textContent = `Signed in as ${me.email}`;
    })
    .catch((error: unknown) => app.fail(error));
  /** The address the app travels back to after a held Back or Forward; its change event is no route change. */
  let returning: string | null = null;
  host.onBackForward((hash, moved) => {
    const next = parseRoute(hash);
    const expected = returning;
    returning = null;
    if (routeHash(next) === expected) return;
    const open = () => {
      favoritesOnly = false;
      // A dialog or drawer belongs to the page being left; nothing may stay inert behind the new one.
      cancelDialogs();
      render(next);
      if (document.activeElement === document.body) main.focus();
    };
    // While the view asks, the address goes back to it; leaving later moves it on again.
    const held = view?.canLeave?.(() => {
      // A known distance travels again to the entry the user chose, so leaving adds no entry (8b minor 5).
      if (moved === 0) host.navigate(routeHash(next), false);
      else {
        returning = routeHash(next);
        host.go(moved);
      }
      open();
    });
    if (held !== false) open();
    else if (moved === 0) host.navigate(routeHash(route), false);
    else {
      // Travel back the same distance, so the history stays exactly as it was.
      returning = routeHash(route);
      host.go(-moved);
    }
  });
  // `<base target="_top">` would send fragment links to the top window, so both links act in script.
  element("skip").addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
  });
  const navActions: Readonly<Record<string, () => void>> = {
    library: () => {
      openScope("", false);
    },
    favorites: () => {
      openScope("", true);
    },
    trash: () => {
      app.go({ name: "trash" });
    },
  };
  for (const [name, action] of Object.entries(navActions))
    document
      .querySelector(`[data-nav=${name}]`)
      ?.addEventListener("click", action);
  void host.location().then((location) => {
    const start = startRoute(location);
    // Stamps the page's first entry with its position, so a Back to it travels back in place of pushing (8b minor 2).
    host.navigate(routeHash(start), true);
    // A first load that already failed shows its banner; a success renders the route then.
    if (!blocked) render(start, true);
    // Pulls keyboard focus into the page, so the first "/" or arrow key reaches the app (smoke 5b item 8).
    if (document.activeElement === document.body) main.focus();
  });
  return app;
}

if (typeof google !== "undefined") startApp(googleHost(google.script));
