import { ErrorCode } from "../../shared/errors/codes";
import { PERSONAL_OFF_TEXT } from "../../shared/model/settings";
import { RpcError } from "../rpc/client";
import { formatTime, h, replace } from "./dom";

/**
 * Error, empty and loading states (spec section 7, wireframe 07). Toasts for retryable errors (BUSY, QUOTA,
 * NETWORK, INTERNAL) carry Retry and the request ID and stay until dismissed. Banners for DENIED and NOT_FOUND.
 */
export type Presentation = "auth" | "banner" | "toast" | "conflict" | "inline";

export function presentationOf(code: ErrorCode): Presentation {
  switch (code) {
    case ErrorCode.AUTH_NO_USER:
    case ErrorCode.AUTH_DOMAIN:
      return "auth";
    case ErrorCode.DENIED:
    case ErrorCode.NOT_FOUND:
      return "banner";
    case ErrorCode.CONFLICT:
      return "conflict";
    case ErrorCode.VALIDATION:
    case ErrorCode.BAD_REQUEST:
      return "inline";
    default:
      return "toast";
  }
}

/** The server's CONFLICT names a UTC time; the details let the browser show it in local time. */
function conflictText(error: RpcError): string {
  const by = error.details?.["updatedBy"];
  const at = error.details?.["updatedAt"];
  return typeof by === "string" && typeof at === "string"
    ? `${by} changed this at ${formatTime(at)}. Reload the page and try again.`
    : error.message;
}

/** DENIED on an admin-only action: the caller lost admin since the page loaded (slice 16 retry 1, wording.md). */
export const ADMIN_DENIED_TEXT =
  "You are no longer an admin, so nothing was changed. Ask an admin if you need access.";

/** `lineText` for an admin-only action: a DENIED there means the caller is no longer an admin. */
export function adminLineText(
  error: unknown,
  shown: HTMLElement | null,
): string {
  return toRpcError(error).code === ErrorCode.DENIED
    ? ADMIN_DENIED_TEXT
    : lineText(error, shown);
}

/** User-facing text per code (spec section 7). */
export function messageOf(error: RpcError): string {
  switch (error.code) {
    case ErrorCode.DENIED:
      return error.message === PERSONAL_OFF_TEXT
        ? PERSONAL_OFF_TEXT
        : "You don't have access to this template. Ask a folder manager.";
    case ErrorCode.NOT_FOUND:
      return "This template was deleted or moved.";
    case ErrorCode.BUSY:
      return "The library is busy. Try again in a few seconds.";
    case ErrorCode.QUOTA:
      return "Service is busy. Try again in a minute.";
    case ErrorCode.CONFLICT:
      return conflictText(error);
    default:
      return presentationOf(error.code) === "toast"
        ? "Something went wrong. Try again."
        : error.message;
  }
}

export function toRpcError(error: unknown): RpcError {
  if (error instanceof RpcError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new RpcError(ErrorCode.INTERNAL, message, "", true);
}

/**
 * One sentence for an inline status line. `shown` is what `AppContext.fail` returned: null when it already showed a
 * toast or the auth page (the line stays empty), else a banner whose message is used alone, ending with a period,
 * with no "Back to the library" link (smoke 6b defect A).
 */
export function lineText(error: unknown, shown: HTMLElement | null): string {
  if (shown === null) return "";
  const text = messageOf(toRpcError(error)).trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** QUOTA: spec section 7 allows a retry after 60 s, so Retry stays disabled that long. */
export const QUOTA_RETRY_MS = 60_000;

function retryButton(error: RpcError, onRetry: () => void): HTMLButtonElement {
  const button = h("button", { type: "button", onclick: onRetry }, "Retry");
  if (error.code === ErrorCode.QUOTA) {
    button.disabled = true;
    setTimeout(() => {
      button.disabled = false;
    }, QUOTA_RETRY_MS);
  }
  return button;
}

export function showToast(
  region: HTMLElement,
  error: RpcError,
  retry?: () => void,
): void {
  const toast = h(
    "div",
    { class: "toast", role: "alert" },
    h("p", {}, messageOf(error)),
    error.requestId === ""
      ? null
      : h("p", { class: "request-id" }, `Request ID ${error.requestId}`),
  );
  const actions = h("div", { class: "toast-actions" });
  if (retry !== undefined && error.retryable)
    actions.append(
      retryButton(error, () => {
        toast.remove();
        retry();
      }),
    );
  actions.append(
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          toast.remove();
        },
      },
      "Close",
    ),
  );
  toast.append(actions);
  region.append(toast);
}

export function banner(error: RpcError, onLibrary?: () => void): HTMLElement {
  return h(
    "div",
    { class: "banner", role: "alert" },
    h("p", {}, messageOf(error)),
    onLibrary === undefined
      ? null
      : h(
          "button",
          { type: "button", class: "link", onclick: onLibrary },
          "Back to the library",
        ),
  );
}

/** Full page for AUTH_NO_USER and AUTH_DOMAIN (wireframe 07 D); the server shows the same text from doGet. */
export function authPage(root: HTMLElement): void {
  replace(
    root,
    h(
      "main",
      { role: "alert", class: "auth-page" },
      h("p", {}, "Cannot identify your Migway account."),
      h(
        "p",
        {},
        "This app does not work when several Google accounts are signed in.",
      ),
      h(
        "p",
        {},
        "Use a separate Chrome profile for Migway, or an incognito window with only your Migway account.",
      ),
    ),
  );
}

/** Skeleton rows while a list loads (spec section 7: 8 rows). */
export function skeletonRows(count = 8): HTMLElement[] {
  return Array.from({ length: count }, () =>
    h(
      "div",
      { class: "skeleton-row", "aria-hidden": "true" },
      h("span", { class: "bone w40" }),
      h("span", { class: "bone w20" }),
      h("span", { class: "bone w10" }),
    ),
  );
}
