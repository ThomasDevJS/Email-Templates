import { ErrorCode } from "../../shared/errors/codes";
import type { Failure } from "../client/serverClient";
import {
  action,
  type ActionSpec,
  type ButtonSpec,
  type CardSpec,
  type Widget,
} from "./spec";

/**
 * Sidebar states (wireframe 07, spec section 7): account not identified, not set up, DENIED, NOT_FOUND, and the
 * retry state for BUSY, QUOTA, NETWORK (TIMEOUT) and everything else (SERVER) with the request ID.
 */
export const QUOTA_WAIT_MS = 60_000;
/** Callback parameter that makes a QUOTA Retry wait until this epoch millisecond. */
export const NOT_BEFORE = "notBefore";

export interface StateContext {
  /** The action that failed; Retry runs it again. */
  readonly retry: ActionSpec;
  /** False on the root card, where Back has nowhere to go. */
  readonly canGoBack: boolean;
  readonly nowMs: number;
}

const back: ButtonSpec = { text: "Back", action: action("onBack") };
const refresh: ButtonSpec = { text: "Refresh", action: action("onRefresh") };

function card(lines: readonly string[], buttons: ButtonSpec[]): CardSpec {
  const text: Widget[] = lines.map((line) => ({ kind: "text", text: line }));
  const row: Widget[] =
    buttons.length === 0 ? [] : [{ kind: "buttons", buttons }];
  return {
    name: "state",
    sections: [{ widgets: [...text, ...row] }],
  };
}

function retryAction(failure: Failure, context: StateContext): ActionSpec {
  if (failure.code !== ErrorCode.QUOTA) return context.retry;
  return action(context.retry.fn, {
    ...context.retry.params,
    [NOT_BEFORE]: String(context.nowMs + QUOTA_WAIT_MS),
  });
}

function retryLines(failure: Failure): string[] {
  const head =
    failure.code === ErrorCode.BUSY
      ? "Busy right now. Press Retry in a few seconds."
      : failure.code === ErrorCode.QUOTA
        ? "Service is busy. Try again in a minute."
        : "Something went wrong. Press Retry.";
  const lines = [head];
  if (failure.requestId !== "") lines.push(`Request ID ${failure.requestId}`);
  // NETWORK messages come from the add-on itself ("Server returned HTTP 401"); deploy.md step 10 needs them.
  if (failure.code === ErrorCode.NETWORK)
    lines.push(`Details for your admin: ${failure.message}`);
  return lines;
}

const ACCOUNT_LINES = [
  "Cannot identify your Migway account.",
  "This app does not work when several Google accounts are signed in. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account.",
];

export function stateCard(failure: Failure, context: StateContext): CardSpec {
  const backOr = (button: ButtonSpec): ButtonSpec[] =>
    context.canGoBack ? [back] : [button];
  switch (failure.code) {
    case ErrorCode.AUTH_NO_USER:
    case ErrorCode.AUTH_DOMAIN:
      return card(ACCOUNT_LINES, []);
    case ErrorCode.NOT_CONFIGURED:
      return card(
        [
          "Migway Templates is not set up yet.",
          "Ask your admin to finish setup, then press Retry.",
        ],
        [{ text: "Retry", action: context.retry }],
      );
    case ErrorCode.DENIED:
      return card(
        ["You don't have access to this template. Ask a folder manager."],
        backOr(refresh),
      );
    case ErrorCode.NOT_FOUND:
      return card(
        [
          "This template was deleted or moved. Press Refresh to update the list.",
        ],
        [refresh],
      );
    default:
      return card(retryLines(failure), [
        { text: "Retry", action: retryAction(failure, context) },
        ...(context.canGoBack ? [back] : []),
      ]);
  }
}

/** Seconds a QUOTA Retry still has to wait, or 0 when it may run. */
export function waitSeconds(
  params: Readonly<Record<string, string>>,
  nowMs: number,
): number {
  const notBefore = Number(params[NOT_BEFORE] ?? "0");
  return Number.isFinite(notBefore) && notBefore > nowMs
    ? Math.ceil((notBefore - nowMs) / 1000)
    : 0;
}
