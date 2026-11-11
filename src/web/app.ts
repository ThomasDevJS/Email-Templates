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
import { createClient } from "./rpc/client";
import {
  authPage,
  banner,
  presentationOf,
  showToast,
  toRpcError,
} from "./ui/status";
import { cancelDialogs, setInert, trapTab } from "./ui/dialog";
import { h } from "./ui/dom";
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
  const api = createApi(client);
  let folders: FolderRow[] = [];
  let items: ItemRow[] = [];
  let favorites = new Set<string>();
  let recent: string[] = [];
  let profile: Profile | null = null;
  let view: View | null = null;
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
    if (!side.contains(event.target as Node)) setPanel(false);
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
  const drawSide = () => {
    const current = navOf(route, favoritesOnly);
    for (const link of document.querySelectorAll<HTMLElement>("[data-nav]"))
      link.toggleAttribute("aria-current", link.dataset["nav"] === current);
    const selected =
      route.name === "library" && !favoritesOnly ? route.folderId : "";
    tree.render(folders, selected, folderCounts(folders, items));
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
      render(startRoute(location));
    });
  };

  const render = (next: Route) => {
    view?.dispose();
    route = next;
    if (next.name !== "library") favoritesOnly = false;
    closePanel();
    drawSide();
    view = viewOf(next);
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
    favoritesOnly = onlyFavorites;
    const next: Route = { name: "library", folderId };
    if (view?.scope === undefined) {
      app.go(next);
      return;
    }
    route = next;
    app.pushRoute(next);
    closePanel();
    drawSide();
    view.scope(folderId, onlyFavorites);
  };

  /** The sidebar shows Admin to callers who manage a folder (admins manage all); `admin.folders` decides on entry. */
  const showAdminLink = () => {
    const manages = folders.some((folder) => folder.level === "manage");
    if (!manages || document.querySelector("[data-nav=admin]") !== null) return;
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
    foldersChanged: () => {
      stale = true;
    },
    go: (next) => {
      host.navigate(routeHash(next), false);
      render(next);
      main.focus();
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

  void load(rerender).then(showAdminLink);
  api
    .profile()
    .then((me) => {
      profile = me;
      element("account-name").textContent = shortName(me.email);
      element("account-avatar").textContent = initials(me.email);
      element("signed-in").textContent = `Signed in as ${me.email}`;
    })
    .catch((error: unknown) => app.fail(error));
  host.onBackForward((hash) => {
    favoritesOnly = false;
    // A dialog or drawer belongs to the page being left; nothing may stay inert behind the new one.
    cancelDialogs();
    render(parseRoute(hash));
    if (document.activeElement === document.body) main.focus();
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
    if (location.hash.replace(/^#/, "") === "" && start !== LIBRARY)
      host.navigate(routeHash(start), true);
    render(start);
    // Pulls keyboard focus into the page, so the first "/" or arrow key reaches the app (smoke 5b item 8).
    if (document.activeElement === document.body) main.focus();
  });
  return app;
}

if (typeof google !== "undefined") startApp(googleHost(google.script));
