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
import { draftInfo, entryOf, paramsOf, type AddonEvent } from "./event";
import {
  folderFlow,
  homeFlow,
  insertFlow,
  openLinkFlow,
  previewFlow,
  promptInsertFlow,
  refreshFlow,
  searchFlow,
  type Ports,
} from "./flows";
import { requireAddonSession } from "./guard";
import {
  s7CardFlow,
  s7ComposeFlow,
  s7Failure,
  s7NotifyFlow,
  s7Visible,
} from "./spikeS7";
import { clearView } from "./view";

type Card = GoogleAppsScript.Card_Service.Card;
type Response =
  | GoogleAppsScript.Card_Service.ActionResponse
  | GoogleAppsScript.Card_Service.UpdateDraftActionResponse
  | GoogleAppsScript.Card_Service.ComposeActionResponse;
type Params = Readonly<Record<string, string>>;

/** Every server call of this execution carries the event's draft diagnostics (names, counts, `hasSubject`). */
function ports(event: AddonEvent | undefined): Ports {
  const draft = draftInfo(event);
  return {
    call: (op, args) => callServer(op, args, draft),
    cache: CacheService.getUserCache(),
    nowMs: () => Date.now(),
    userEmail: Session.getActiveUser().getEmail(),
    execUrl: BUILD_INFO.execUrl,
    entry: entryOf(event),
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
  const context = ports(event);
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
export function onComposeOpen(event?: AddonEvent): Card {
  requireAddonSession("onComposeOpen");
  return renderCard(homeFlow(ports(event)));
}

/** Add-on homepage (`addOns.common.homepageTrigger`). */
export function onHomepage(event?: AddonEvent): Card {
  requireAddonSession("onHomepage");
  return renderCard(homeFlow(ports(event)));
}

/** Gmail contextual trigger `unconditional`: the side panel with a message open (ADR-0007 section 4). */
export function onMessageOpen(event?: AddonEvent): Card {
  requireAddonSession("onMessageOpen");
  return renderCard(homeFlow(ports(event)));
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
  return respond("onPreview", event, (context, params) =>
    previewFlow(context, event, params),
  );
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

/** Home card search input, on change (spec 4.4). */
export function onSearch(event?: AddonEvent): Response {
  return respond("onSearch", event, (context) => searchFlow(context, event));
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

/** TEMPORARY (spike S7): guard, then flow and render; any exception after the guard shows on the tester's screen. */
function s7Respond(name: string, run: () => Reply): Response {
  requireAddonSession(name);
  return s7Visible(
    () => renderReply(run()),
    (error) => renderReply(s7Failure(error)),
  );
}

/** TEMPORARY (spike S7): harness card, dev build and side panel only. */
export function onS7Card(event?: AddonEvent): Response {
  return s7Respond("onS7Card", () => s7CardFlow(BUILD_INFO.env, event));
}

/** TEMPORARY (spike S7): New email, Reply, Reply all as compose actions. */
export function onS7Compose(event?: AddonEvent): Response {
  return s7Respond("onS7Compose", () =>
    s7ComposeFlow(BUILD_INFO.env, event, paramsOf(event), GmailApp),
  );
}

/** TEMPORARY (spike S7): compose-action button whose callback returns a notification. */
export function onS7Notify(): Response {
  return s7Respond("onS7Notify", () => s7NotifyFlow(BUILD_INFO.env));
}
