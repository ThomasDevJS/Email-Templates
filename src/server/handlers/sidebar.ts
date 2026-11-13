import type { Item } from "../../shared/model/data";
import { settingValue } from "../../shared/model/settings";
import {
  recipientsOf,
  splitBlocked,
  type RecipientPolicy,
} from "../../shared/model/recipients";
import {
  SIDEBAR_SNIPPET_CHARS,
  type ApplyResult,
  type Sender,
  type SidebarFolder,
  type SidebarHome,
  type SidebarTemplate,
} from "../../shared/model/sidebar";
import { isEmptyQuery, parseQuery, rank } from "../../shared/search/match";
import { domainOf } from "../../shared/permissions/principals";
import { bufferEvent } from "../audit/buffer";
import { optBool, optString, reqInt, reqString } from "../dispatch/args";
import type { HandlerContext } from "../dispatch/context";
import { lookupProfile } from "../directory/profile";
import { DOMAIN_KEY } from "../guards";
import { nowIso } from "../services";
import { readStoredBody, readableBody, recipientPolicy } from "./body";
import { callerLists, callerRecent } from "./favorites";
import { liveItem } from "./indexOps";
import { appliedRecipients } from "./templates";
import {
  visibleLibrary,
  type VisibleFolder,
  type VisibleLibrary,
  type VisibleTemplate,
} from "./visible";

/** Wireframe 01: Favorites max 10, Recent max 5; spec 4.4: search top 20. */
export const FAVORITES_SHOWN = 10;
export const RECENT_SHOWN = 5;
export const SEARCH_RESULTS = 20;

/**
 * Sidebar ops (spec section 4.1). `sidebar.home` and `search` are list ops: dispatch lets every caller in and
 * `visibleLibrary` keeps only folders where the caller holds `use`. `template.apply` has its `use` check in dispatch.
 */

/** Row hint counts (spec 5.7): only for templates Insert may add an address with. */
function countsOf(item: Item, policy: RecipientPolicy) {
  const { to, cc, bcc } = splitBlocked(recipientsOf(item), policy);
  return to.length + cc.length + bcc.length === 0
    ? {}
    : { rc: [to.length, cc.length, bcc.length] as const };
}

function toTemplate(
  { item, level }: VisibleTemplate,
  policy: RecipientPolicy,
): SidebarTemplate {
  return {
    id: item.id,
    folderId: item.folderId,
    title: item.title,
    subject: item.subject,
    snippet: item.snippet.slice(0, SIDEBAR_SNIPPET_CHARS),
    version: item.currentVersion,
    prompts: item.prompts,
    level,
    ...countsOf(item, policy),
  };
}

/** Counts each template in its folder and in every visible ancestor. */
function subtreeCounts(library: VisibleLibrary): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { item } of library.templates) {
    let folderId = item.folderId;
    while (folderId !== "") {
      counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
      folderId = library.folderById.get(folderId)?.parentId ?? "";
    }
  }
  return counts;
}

export function sidebarHome(context: HandlerContext): SidebarHome {
  const library = visibleLibrary(context);
  const policy = recipientPolicy(context);
  const templates = library.templates.map((template) =>
    toTemplate(template, policy),
  );
  const counts = subtreeCounts(library);
  const folders: SidebarFolder[] = library.folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    count: counts.get(folder.id) ?? 0,
  }));
  const lists = callerLists(
    context.services,
    context.caller.email,
    new Set(templates.map((template) => template.id)),
  );
  return {
    folders: folders.filter((folder) => folder.parentId === ""),
    subfolders: folders.filter((folder) => folder.parentId !== ""),
    templates,
    favorites: lists.favorites.slice(0, FAVORITES_SHOWN),
    recent: lists.recent.slice(0, RECENT_SHOWN),
    personalTemplates: settingValue(
      context.access().index.settings,
      "personalTemplates",
    ),
  };
}

/** "Sales / Quotes" from visible folders only, so a hidden ancestor's name never matches. */
function visiblePath(
  folder: VisibleFolder,
  folderById: ReadonlyMap<string, VisibleFolder>,
): string {
  const names: string[] = [];
  for (let id = folder.id; id !== "" && names.length < folderById.size;) {
    names.unshift(folderById.get(id)?.name ?? "");
    id = folderById.get(id)?.parentId ?? "";
  }
  return names.join(" / ");
}

/**
 * Sidebar search (spec 4.4): top 20 matches among the templates `sidebar.home` shows, ranked by `rank`. Body text
 * here is the 140-character snippet from the index; full body text is `search.body` (web app).
 * shortcut: snippet only, so no Drive or `ft:*` read; upgrade if users miss body matches in the sidebar.
 */
export function search(context: HandlerContext): {
  results: SidebarTemplate[];
} {
  const query = parseQuery(optString(context.args, "query"));
  if (isEmptyQuery(query)) return { results: [] };
  const library = visibleLibrary(context);
  const policy = recipientPolicy(context);
  const recent = callerRecent(
    context.services,
    context.caller.email,
    new Set(library.templates.map(({ item }) => item.id)),
  );
  const ranked = rank(
    library.templates.map((template) => ({
      ...template,
      id: template.item.id,
      title: template.item.title,
    })),
    query,
    ({ item, folder }) => ({
      title: item.title,
      subject: item.subject,
      tags: item.tags,
      folder: visiblePath(folder, library.folderById),
      body: item.snippet,
    }),
    recent,
  );
  return {
    results: ranked
      .slice(0, SEARCH_RESULTS)
      .map((template) => toTemplate(template, policy)),
  };
}

export function senderOf(context: HandlerContext): Sender {
  const profile = lookupProfile(context.services, context.caller.email);
  return {
    name: profile.name,
    title: profile.title,
    phone: profile.phone,
    department: profile.department,
  };
}

/**
 * Given name of an internal recipient (ADR-0004 Apply semantics 2). The add-on sends only an address in the
 * caller's domain; the server checks it against `DOMAIN` again, so no external address reaches the Directory.
 */
export function recipientFirstName(context: HandlerContext): string {
  const email = optString(context.args, "recipientEmailIfInternal")
    .trim()
    .toLowerCase();
  const domain = (context.services.props.getProperty(DOMAIN_KEY) ?? "")
    .trim()
    .toLowerCase();
  if (email === "" || domain === "" || domainOf(email) !== domain) return "";
  return lookupProfile(context.services, email).givenName;
}

/**
 * Apply (spec 4.1 step 3). Dispatch re-checked `use` on the item's folder. The body travels only when the
 * add-on's copy is stale. The apply event goes to the `evt:*` buffer (500 ms lock at most, spec section 10).
 * `followUp: true` is the prompt card's Insert: the same `use` check, no second event, because the Insert tap
 * that opened the card buffered one already. One user action, one event. It also skips the recipient lookup
 * (Q24): the card carries the values of the first call, so a follow-up never serves as a free name lookup.
 */
export function templateApply(context: HandlerContext): ApplyResult {
  const item = liveItem(context.access().index, reqString(context.args, "id"));
  const knownVersion = reqInt(context.args, "knownVersion");
  const followUp = optBool(context.args, "followUp");
  const fresh = knownVersion !== item.currentVersion;
  const html = fresh
    ? readableBody(
        context.services.props,
        readStoredBody(context.services, item),
        item.subject,
      ).html
    : null;
  const result: ApplyResult = {
    id: item.id,
    title: item.title,
    version: item.currentVersion,
    html,
    subject: fresh ? item.subject : null,
    sender: senderOf(context),
    recipientFirstName: followUp ? "" : recipientFirstName(context),
    ...appliedRecipients(context, item),
  };
  if (!followUp)
    bufferEvent(context.services.cache, context.services.lock, {
      kind: "apply",
      itemId: item.id,
      actor: context.caller.email,
      ts: nowIso(context.services),
    });
  return result;
}
