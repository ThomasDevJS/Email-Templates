/**
 * Card Service entry points. They run as the user and never read storage, Script Cache or
 * Script Properties (ADR-0003 Part A). Data comes from the server through `callServer`.
 */
import { BUILD_INFO } from "../shared/buildInfo";
import { buildHomeCard, pingMessage } from "./cards/home";
import { callServer } from "./client/serverClient";

/** Gmail compose trigger (`addOns.gmail.composeTrigger.selectActions`). */
export function onComposeOpen(): GoogleAppsScript.Card_Service.Card {
  return buildHomeCard();
}

/** Add-on homepage (`addOns.common.homepageTrigger`). */
export function onHomepage(): GoogleAppsScript.Card_Service.Card {
  return buildHomeCard();
}

/** Ping button: one server round trip, result shown as a notification. */
export function onPing(): GoogleAppsScript.Card_Service.ActionResponse {
  const notification = CardService.newNotification().setText(
    pingMessage(callServer("ping", {})),
  );
  return CardService.newActionResponseBuilder()
    .setNotification(notification)
    .build();
}

/** Universal action "Open library": opens the web app in an overlay and reloads the add-on on close. */
export function onOpenLibrary(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  const link = CardService.newOpenLink()
    .setUrl(BUILD_INFO.execUrl)
    .setOpenAs(CardService.OpenAs.OVERLAY)
    .setOnClose(CardService.OnClose.RELOAD_ADD_ON);
  return CardService.newUniversalActionResponseBuilder()
    .setOpenLink(link)
    .build();
}
