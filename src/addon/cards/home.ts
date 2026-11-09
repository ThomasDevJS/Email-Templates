import type { RpcResponse } from "../../shared/model/protocol";

export const HOME_TITLE = "Migway Templates";
export const SLICE_TEXT = "Migway Templates, slice 1";
export const PING_FUNCTION = "onPing";

/** Slice 1 card: one line of text and a Ping button that calls the server through the add-on client. */
export function buildHomeCard(): GoogleAppsScript.Card_Service.Card {
  const ping = CardService.newTextButton()
    .setText("Ping")
    .setOnClickAction(CardService.newAction().setFunctionName(PING_FUNCTION));
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(SLICE_TEXT))
    .addWidget(ping);
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(HOME_TITLE))
    .addSection(section)
    .build();
}

function callerOf(data: unknown): string {
  if (typeof data !== "object" || data === null) return "unknown";
  const caller = (data as Record<string, unknown>)["caller"];
  return typeof caller === "string" && caller !== "" ? caller : "unknown";
}

/** Notification text for a ping result. Shows the caller the server identified (spike S2 evidence). */
export function pingMessage(response: RpcResponse): string {
  if (!response.ok)
    return `Ping failed: ${response.error.code}. ${response.error.message}`;
  const ms = String(response.durationMs);
  return `Ping ok: server ${response.serverVersion} sees ${callerOf(response.data)} (${ms} ms)`;
}
