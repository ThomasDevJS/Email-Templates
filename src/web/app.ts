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
import { h } from "./ui/dom";
import { adminView } from "./views/admin";
import type { AppContext, View } from "./views/context";
import { editorView } from "./views/editor";
import { historyView } from "./views/history";
import { libraryView } from "./views/library";
import { trashView } from "./views/trash";

declare const google: { readonly script: GoogleScript };

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`index.html lacks #${id}`);
  return found;
}

export function startApp(host: Host): AppContext {
  const main = element("main");
  const toasts = element("toasts");
  const signedIn = element("signed-in");
  const client = createClient(host.runner, requestIdNow);
  const api = createApi(client);
  let folders: FolderRow[] = [];
  let items: ItemRow[] = [];
  let favorites = new Set<string>();
  let recent: string[] = [];
  let profile: Profile | null = null;
  let view: View | null = null;

  const reload = async () => {
    const [folderList, itemList] = await Promise.all([
      api.folders(),
      api.templates(),
    ]);
    folders = folderList.folders;
    items = itemList.items;
    favorites = new Set(itemList.favorites);
    recent = itemList.recent;
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

  let section = "library";
  const render = (route: Route) => {
    view?.dispose();
    section = route.name === "admin" ? "admin" : "library";
    for (const link of document.querySelectorAll<HTMLElement>("[data-nav]"))
      link.toggleAttribute("aria-current", link.dataset["nav"] === section);
    view = viewOf(route);
  };

  const viewOf = (route: Route): View => {
    switch (route.name) {
      case "library":
        return libraryView(app, main, route.folderId, fresh());
      case "history":
        return historyView(app, main, route.id);
      case "trash":
        return trashView(app, main, fresh());
      case "admin":
        return adminView(app, main, route.tab);
      case "edit":
        return editorView(app, main, { id: route.id }, fresh());
      case "new":
        return editorView(app, main, { folderId: route.folderId }, fresh());
    }
  };

  /** The rail shows Admin to callers who manage a folder (admins manage all); `admin.folders` decides on entry. */
  const showAdminLink = () => {
    const rail = document.querySelector(".rail");
    const manages = folders.some((folder) => folder.level === "manage");
    const link = document.querySelector("[data-nav=admin]");
    if (!manages || link !== null || rail === null) return;
    const button = h(
      "button",
      { type: "button", class: "nav-link", "data-nav": "admin" },
      "Admin",
    );
    button.addEventListener("click", () => {
      app.go(ADMIN);
    });
    button.toggleAttribute("aria-current", section === "admin");
    rail.append(button);
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
    go: (route) => {
      host.navigate(routeHash(route), false);
      render(route);
      main.focus();
    },
    replaceRoute: (route) => {
      host.navigate(routeHash(route), true);
    },
    pushRoute: (route) => {
      host.navigate(routeHash(route), false);
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
      signedIn.textContent = `Signed in as ${me.email}`;
    })
    .catch((error: unknown) => app.fail(error));
  host.onBackForward((hash) => {
    render(parseRoute(hash));
  });
  // `<base target="_top">` would send fragment links to the top window, so both links act in script.
  element("skip").addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
  });
  for (const link of document.querySelectorAll("[data-nav=library]"))
    link.addEventListener("click", () => {
      app.go(LIBRARY);
    });
  void host.location().then((location) => {
    const route = startRoute(location);
    if (location.hash.replace(/^#/, "") === "" && route !== LIBRARY)
      host.navigate(routeHash(route), true);
    render(route);
    // Pulls keyboard focus into the page, so the first "/" or arrow key reaches the app (smoke 5b item 8).
    if (document.activeElement === document.body) main.focus();
  });
  return app;
}

if (typeof google !== "undefined") startApp(googleHost(google.script));
