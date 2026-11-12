import type { Item } from "../../shared/model/data";
import type { Api, FolderRow, ItemRow, Profile } from "../rpc/api";
import type { Route } from "../router";

/** What every view gets: the server API, the loaded library, navigation and error handling. */
export interface AppContext {
  readonly api: Api;
  /** The same calls without the page loader, for refreshes the user did not ask for (D37). */
  readonly background: Api;
  readonly profile: () => Profile | null;
  readonly folders: () => readonly FolderRow[];
  readonly items: () => readonly ItemRow[];
  /** The caller's favorite template IDs. */
  readonly favorites: () => ReadonlySet<string>;
  /** The caller's recently used template IDs, last used first. */
  readonly recent: () => readonly string[];
  /** Stars or unstars a template on the server, then in the loaded list. */
  setFavorite(id: string, favorite: boolean): Promise<void>;
  /** Reloads folders and templates from the server. */
  reload(): Promise<void>;
  /** A save answered with the template: the loaded list takes it, with no second read (D37). */
  itemSaved(item: Item): void;
  /** Folders changed on the server (admin view): the next library, trash or editor view loads them again. */
  foldersChanged(): void;
  go(route: Route): void;
  /** Changes the URL to `route` without rendering again (a new template that got its ID). */
  replaceRoute(route: Route): void;
  /** Adds `route` to the history without rendering again (the library selects a folder in place). */
  pushRoute(route: Route): void;
  /** Central error handling: auth page, toast with Retry, or the returned banner for DENIED and NOT_FOUND. */
  fail(error: unknown, retry?: () => void): HTMLElement | null;
}

/** A mounted view; `dispose` runs before the next route renders. */
export interface View {
  dispose(): void;
  /**
   * Editor only (unsaved-changes guard): true lets the route change happen now; false means the view asks first and
   * calls `leave` if the user leaves.
   */
  canLeave?(leave: () => void): boolean;
  /** Library only: shows another folder ("" for all), or the favorites of every folder, in place. */
  scope?(folderId: string, favorites: boolean): void;
}
