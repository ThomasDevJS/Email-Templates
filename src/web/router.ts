/**
 * Hash routes of the web app: `#/library`, `#/library?folder=<id>`, `#/edit/<id>`, `#/history/<id>`,
 * `#/new?folder=<id>`, `#/trash`, `#/admin` and `#/admin/<tab>`. The OVERLAY form `?view=editor&id=<id>`
 * (ADR-0001) and `?view=admin` (spec section 2) map onto the same routes.
 */
export const ADMIN_TABS = [
  "folders",
  "memberships",
  "audit",
  "usage",
  "transfer",
  "config",
] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export type Route =
  | { readonly name: "library"; readonly folderId: string }
  | { readonly name: "edit"; readonly id: string }
  | { readonly name: "history"; readonly id: string }
  | { readonly name: "new"; readonly folderId: string }
  | { readonly name: "trash" }
  | { readonly name: "admin"; readonly tab: AdminTab };

export const LIBRARY: Route = { name: "library", folderId: "" };
export const ADMIN: Route = { name: "admin", tab: "folders" };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function queryParam(query: string, key: string): string {
  for (const pair of query.split("&")) {
    const [name, value = ""] = pair.split("=");
    if (name === key) {
      const decoded = decodeURIComponent(value);
      return ID.test(decoded) ? decoded : "";
    }
  }
  return "";
}

/** Route of a hash with or without the leading `#`. Unknown or malformed hashes go to the library. */
export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const [, section = "", id = ""] = path.split("/");
  if ((section === "edit" || section === "history") && ID.test(id))
    return { name: section, id };
  if (section === "new")
    return { name: "new", folderId: queryParam(query, "folder") };
  if (section === "library")
    return { name: "library", folderId: queryParam(query, "folder") };
  if (section === "trash") return { name: "trash" };
  if (section === "admin") {
    const tab = ADMIN_TABS.find((name) => name === id);
    return tab === undefined ? ADMIN : { name: "admin", tab };
  }
  return LIBRARY;
}

/** Hash without `#`, the form `google.script.history` takes. */
export function routeHash(route: Route): string {
  switch (route.name) {
    case "library":
      return route.folderId === ""
        ? "/library"
        : `/library?folder=${route.folderId}`;
    case "new":
      return `/new?folder=${route.folderId}`;
    case "trash":
      return "/trash";
    case "admin":
      return route.tab === "folders" ? "/admin" : `/admin/${route.tab}`;
    default:
      return `/${route.name}/${route.id}`;
  }
}

/** Route for the OVERLAY URL parameters, or null when they name no route. */
export function overlayRoute(
  parameter: Readonly<Record<string, string>>,
): Route | null {
  if (parameter["view"] === "admin") return ADMIN;
  const id = parameter["id"] ?? "";
  if (!ID.test(id)) return null;
  if (parameter["view"] === "editor") return { name: "edit", id };
  if (parameter["view"] === "history") return { name: "history", id };
  return null;
}

/** Start route: a hash wins; otherwise the OVERLAY parameters; otherwise the library. */
export function startRoute(location: {
  readonly hash: string;
  readonly parameter: Readonly<Record<string, string>>;
}): Route {
  if (location.hash.replace(/^#/, "") !== "") return parseRoute(location.hash);
  return overlayRoute(location.parameter) ?? LIBRARY;
}
