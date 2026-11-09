import type { Api, FolderRow, ItemRow, Profile } from "../rpc/api";
import type { Route } from "../router";

/** What every view gets: the server API, the loaded library, navigation and error handling. */
export interface AppContext {
  readonly api: Api;
  readonly profile: () => Profile | null;
  readonly folders: () => readonly FolderRow[];
  readonly items: () => readonly ItemRow[];
  /** Reloads folders and templates from the server. */
  reload(): Promise<void>;
  go(route: Route): void;
  /** Changes the URL to `route` without rendering again (a new template that got its ID). */
  replaceRoute(route: Route): void;
  /** Central error handling: auth page, toast with Retry, or the returned banner for DENIED and NOT_FOUND. */
  fail(error: unknown, retry?: () => void): HTMLElement | null;
}

/** A mounted view; `dispose` runs before the next route renders. */
export interface View {
  dispose(): void;
}
