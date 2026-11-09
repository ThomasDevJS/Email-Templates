/**
 * Card Service entry points. They run as the user and never read storage, Script Cache or
 * Script Properties (ADR-0003 Part A). Data comes from the server through `callServer`.
 */
import { BUILD_INFO } from "../shared/buildInfo";
import { buildDiagCard, buildHomeCard, pingMessage } from "./cards/home";
import { runDiagnostics } from "./client/diag";
import { callServer } from "./client/serverClient";
import { requireAddonSession } from "./guard";

/** Gmail compose trigger (`addOns.gmail.composeTrigger.selectActions`). */
export function onComposeOpen(): GoogleAppsScript.Card_Service.Card {
  requireAddonSession("onComposeOpen");
  return buildHomeCard();
}

/** Add-on homepage (`addOns.common.homepageTrigger`). */
export function onHomepage(): GoogleAppsScript.Card_Service.Card {
  requireAddonSession("onHomepage");
  return buildHomeCard();
}

/** Ping button: one server round trip, result shown as a notification. */
export function onPing(): GoogleAppsScript.Card_Service.ActionResponse {
  requireAddonSession("onPing");
  const notification = CardService.newNotification().setText(
    pingMessage(callServer("ping", {})),
  );
  return CardService.newActionResponseBuilder()
    .setNotification(notification)
    .build();
}

/** Universal action "Open library": opens the web app in an overlay and reloads the add-on on close. */
export function onOpenLibrary(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  requireAddonSession("onOpenLibrary");
  const link = CardService.newOpenLink()
    .setUrl(BUILD_INFO.execUrl)
    .setOpenAs(CardService.OpenAs.OVERLAY)
    .setOnClose(CardService.OnClose.RELOAD_ADD_ON);
  return CardService.newUniversalActionResponseBuilder()
    .setOpenLink(link)
    .build();
}

/** Temporary spike S2 diagnostic (slice 1): shows raw front-door responses for the add-on token. */
export function onDiag(): GoogleAppsScript.Card_Service.ActionResponse {
  requireAddonSession("onDiag");
  const card = buildDiagCard(runDiagnostics());
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}
