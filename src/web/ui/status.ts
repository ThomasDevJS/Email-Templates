import { ErrorCode } from "../../shared/errors/codes";
import { RpcError } from "../rpc/client";
import { h, replace } from "./dom";

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

/** User-facing text per code (spec section 7). */
export function messageOf(error: RpcError): string {
  switch (error.code) {
    case ErrorCode.DENIED:
      return "You don't have access to this template. Ask a folder manager.";
    case ErrorCode.NOT_FOUND:
      return "This template was removed or moved.";
    case ErrorCode.BUSY:
      return "Busy, try again.";
    case ErrorCode.QUOTA:
      return "Service is busy. Try again in a minute.";
    case ErrorCode.NOT_IMPLEMENTED:
      return "This action arrives in a later release.";
    default:
      return presentationOf(error.code) === "toast"
        ? "Something went wrong. Retry."
        : error.message;
  }
}

export function toRpcError(error: unknown): RpcError {
  if (error instanceof RpcError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new RpcError(ErrorCode.INTERNAL, message, "", true);
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
      "Dismiss",
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
        "Apps Script does not support several signed-in Google accounts.",
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
