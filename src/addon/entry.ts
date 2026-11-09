/**
 * Card Service entry points. They run as the user and never read storage, Script Cache or Script Properties
 * (ADR-0003 Part A). Data comes from the server through `callServer`; every callback passes the add-on guard
 * first, and the server checks permissions on every op. Logic lives in flows.ts; cards are built as plain data.
 */
import { BUILD_INFO } from "../shared/buildInfo";
import { renderCard, renderReply } from "./cards/render";
import type { Reply } from "./cards/spec";
import { waitSeconds } from "./cards/states";
import { callServer } from "./client/serverClient";
import { paramsOf, type AddonEvent } from "./event";
import {
  folderFlow,
  homeFlow,
  insertFlow,
  openLinkFlow,
  previewFlow,
  promptInsertFlow,
  refreshFlow,
  spikeCardFlow,
  spikeInsertFlow,
  type Ports,
} from "./flows";
import { requireAddonSession } from "./guard";
import { clearView } from "./view";

type Card = GoogleAppsScript.Card_Service.Card;
type Response =
  | GoogleAppsScript.Card_Service.ActionResponse
  | GoogleAppsScript.Card_Service.UpdateDraftActionResponse;
type Params = Readonly<Record<string, string>>;

function ports(): Ports {
  return {
    call: callServer,
    cache: CacheService.getUserCache(),
    nowMs: () => Date.now(),
    userEmail: Session.getActiveUser().getEmail(),
    execUrl: BUILD_INFO.execUrl,
  };
}

/** Guard, QUOTA wait (spec section 7: retry after 60 s), flow, render. */
function respond(
  name: string,
  event: AddonEvent | undefined,
  run: (ports: Ports, params: Params) => Reply,
): Response {
  requireAddonSession(name);
  const params = paramsOf(event);
  const context = ports();
  const wait = waitSeconds(params, context.nowMs());
  return renderReply(
    wait > 0
      ? {
          kind: "notify",
          text: `Service is busy. Try again in ${String(wait)} s.`,
        }
      : run(context, params),
  );
}

/** Gmail compose trigger (`addOns.gmail.composeTrigger.selectActions`). */
export function onComposeOpen(): Card {
  requireAddonSession("onComposeOpen");
  return renderCard(homeFlow(ports()));
}

/** Add-on homepage (`addOns.common.homepageTrigger`). */
export function onHomepage(): Card {
  requireAddonSession("onHomepage");
  return renderCard(homeFlow(ports()));
}

/** Universal action "Open library": opens the web app in an overlay and reloads the add-on on close. */
export function onOpenLibrary(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  requireAddonSession("onOpenLibrary");
  clearView(CacheService.getUserCache());
  const link = CardService.newOpenLink()
    .setUrl(BUILD_INFO.execUrl)
    .setOpenAs(CardService.OpenAs.OVERLAY)
    .setOnClose(CardService.OnClose.RELOAD_ADD_ON);
  return CardService.newUniversalActionResponseBuilder()
    .setOpenLink(link)
    .build();
}

export function onOpenFolder(event?: AddonEvent): Response {
  return respond("onOpenFolder", event, folderFlow);
}

export function onPreview(event?: AddonEvent): Response {
  return respond("onPreview", event, previewFlow);
}

export function onInsert(event?: AddonEvent): Response {
  return respond("onInsert", event, (context, params) =>
    insertFlow(context, event, params),
  );
}

export function onPromptInsert(event?: AddonEvent): Response {
  return respond("onPromptInsert", event, (context, params) =>
    promptInsertFlow(context, event, params),
  );
}

export function onRefresh(event?: AddonEvent): Response {
  return respond("onRefresh", event, refreshFlow);
}

export function onBack(event?: AddonEvent): Response {
  return respond("onBack", event, () => ({ kind: "pop" }));
}

export function onOpenLink(event?: AddonEvent): Response {
  return respond("onOpenLink", event, openLinkFlow);
}

/** TEMPORARY (spike S4). */
export function onSpikeCard(event?: AddonEvent): Response {
  return respond("onSpikeCard", event, spikeCardFlow);
}

/** TEMPORARY (spike S4). */
export function onSpikeInsert(event?: AddonEvent): Response {
  return respond("onSpikeInsert", event, (context, params) =>
    spikeInsertFlow(context, event, params),
  );
}
