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
      handler: (event: { readonly location: ScriptLocation }) => void,
    ): void;
  };
}

export interface Host {
  readonly runner: Runner;
  location(): Promise<ScriptLocation>;
  /** `hash` without the leading `#`, for example `/edit/01ABC`. */
  navigate(hash: string, replace: boolean): void;
  onBackForward(handler: (hash: string) => void): void;
}

export function googleHost(script: GoogleScript): Host {
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
      if (replace) script.history.replace(null, {}, hash);
      else script.history.push(null, {}, hash);
    },
    onBackForward: (handler) => {
      script.history.setChangeHandler((event) => {
        handler(event.location.hash);
      });
    },
  };
}
