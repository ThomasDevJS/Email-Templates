/** Web app shell (screens 3 to 5), bundled and inlined into index.html by scripts/build.mjs (ADR-0005). */
import { googleHost, type GoogleScript, type Host } from "./host";
import {
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
import type { AppContext, View } from "./views/context";
import { editorView } from "./views/editor";
import { historyView } from "./views/history";
import { libraryView } from "./views/library";

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
  let profile: Profile | null = null;
  let view: View | null = null;

  const reload = async () => {
    const [folderList, itemList] = await Promise.all([
      api.folders(),
      api.templates(),
    ]);
    folders = folderList.folders;
    items = itemList.items;
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
  const rerender = () => {
    void host.location().then((location) => {
      render(startRoute(location));
    });
  };

  const render = (route: Route) => {
    view?.dispose();
    for (const link of document.querySelectorAll("[data-nav]"))
      link.toggleAttribute("aria-current", route.name === "library");
    if (route.name === "library")
      view = libraryView(app, main, route.folderId, loaded());
    else if (route.name === "history") view = historyView(app, main, route.id);
    else
      view = editorView(
        app,
        main,
        route.name === "edit" ? { id: route.id } : { folderId: route.folderId },
        loaded(),
      );
  };

  const app: AppContext = {
    api,
    profile: () => profile,
    folders: () => folders,
    items: () => items,
    reload: async () => {
      await load(() => undefined);
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

  void load(rerender);
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
  for (const link of document.querySelectorAll("[data-nav]"))
    link.addEventListener("click", () => {
      app.go(LIBRARY);
    });
  void host.location().then((location) => {
    const route = startRoute(location);
    if (location.hash.replace(/^#/, "") === "" && route !== LIBRARY)
      host.navigate(routeHash(route), true);
    render(route);
  });
  return app;
}

if (typeof google !== "undefined") startApp(googleHost(google.script));
