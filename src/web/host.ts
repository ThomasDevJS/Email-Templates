import type { Runner } from "./rpc/client";

/**
 * The page's link to Apps Script (`google.script`). The web app runs in a sandboxed iframe, so the top URL is
 * read with `google.script.url.getLocation` and changed with `google.script.history` (reload keeps the route).
 * The dev harness installs a fake `google` object with the same shape.
 */
export interface ScriptLocation {
  readonly hash: string;
  readonly parameter: Readonly<Record<string, string>>;
}

interface ScriptRun {
  withSuccessHandler(handler: (value: unknown) => void): ScriptRun;
  withFailureHandler(handler: (error: unknown) => void): ScriptRun;
  rpc(op: string, args: unknown, requestId: string): void;
}

export interface GoogleScript {
  readonly run: ScriptRun;
  readonly url: {
    getLocation(callback: (location: ScriptLocation) => void): void;
  };
  readonly history: {
    push(state: unknown, params: object, hash: string): void;
    replace(state: unknown, params: object, hash: string): void;
    setChangeHandler(
      handler: (event: {
        readonly state?: unknown;
        readonly location: ScriptLocation;
      }) => void,
    ): void;
  };
}

export interface Host {
  readonly runner: Runner;
  location(): Promise<ScriptLocation>;
  /** `hash` without the leading `#`, for example `/edit/01ABC`. */
  navigate(hash: string, replace: boolean): void;
  /** `moved`: entries traveled (-1 for one Back), 0 when unknown (an entry from before this page load). */
  onBackForward(handler: (hash: string, moved: number) => void): void;
  /** Travels `delta` entries in the browser history, as Back (-1) and Forward (+1) do. */
  go(delta: number): void;
}

export function googleHost(script: GoogleScript): Host {
  // Each entry this page writes stores its position, so a Back or Forward reports how far it moved.
  const page = String(Date.now());
  let at = 0;
  return {
    runner: {
      run: (op, args, requestId, onReply, onFailure) => {
        script.run
          .withSuccessHandler(onReply)
          .withFailureHandler(onFailure)
          .rpc(op, args, requestId);
      },
    },
    location: () =>
      new Promise((resolve) => {
        script.url.getLocation(resolve);
      }),
    navigate: (hash, replace) => {
      if (replace) script.history.replace({ page, at }, {}, hash);
      else {
        at += 1;
        script.history.push({ page, at }, {}, hash);
      }
    },
    onBackForward: (handler) => {
      script.history.setChangeHandler((event) => {
        const state = event.state as { page?: unknown; at?: unknown } | null;
        const to = state?.page === page ? state.at : undefined;
        const moved = typeof to === "number" ? to - at : 0;
        if (typeof to === "number") at = to;
        handler(event.location.hash, moved);
      });
    },
    go: (delta) => {
      window.history.go(delta);
    },
  };
}
