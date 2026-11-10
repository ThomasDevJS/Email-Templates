import type { Folder, IndexDoc, Item } from "../../shared/model/data";
import {
  SIDEBAR_SNIPPET_CHARS,
  type ApplyResult,
  type Sender,
  type SidebarFolder,
  type SidebarHome,
  type SidebarTemplate,
} from "../../shared/model/sidebar";
import {
  ancestry,
  folderMap,
  type LevelOf,
} from "../../shared/permissions/effective";
import { atLeast } from "../../shared/permissions/levels";
import { domainOf } from "../../shared/permissions/principals";
import { bufferEvent } from "../audit/buffer";
import { optBool, optString, reqInt, reqString } from "../dispatch/args";
import type { HandlerContext } from "../dispatch/context";
import { lookupProfile } from "../directory/profile";
import { DOMAIN_KEY } from "../guards";
import { nowIso } from "../services";
import { readStoredBody, readableBody } from "./body";
import { liveItem } from "./indexOps";

/**
 * Sidebar ops (spec section 4.1). `sidebar.home` is a list op: dispatch lets every caller in and this handler
 * keeps only folders where the caller holds `use`. `template.apply` has its `use` check in dispatch.
 */

/** Owner of the private tree the folder sits in, or "" for a shared folder. */
function privateOwner(folder: Folder, byId: ReadonlyMap<string, Folder>) {
  const top = ancestry(folder.id, byId).find((f) => f.kind === "private");
  return top?.ownerEmail.toLowerCase() ?? "";
}

/**
 * Live folders the caller can use. Other users' private folders stay out even for admins: the sidebar applies
 * templates, and every private folder is named "My templates".
 */
function visibleFolders(
  index: IndexDoc,
  levelOf: LevelOf,
  email: string,
): Map<string, { folder: Folder; own: boolean }> {
  const byId = folderMap(index.folders);
  const me = email.toLowerCase();
  const visible = new Map<string, { folder: Folder; own: boolean }>();
  for (const folder of index.folders) {
    if (folder.deletedAt !== "" || !atLeast(levelOf(folder.id), "use"))
      continue;
    const owner = privateOwner(folder, byId);
    if (owner !== "" && owner !== me) continue;
    visible.set(folder.id, { folder, own: owner === me });
  }
  return visible;
}

function toTemplate(item: Item, levelOf: LevelOf): SidebarTemplate {
  return {
    id: item.id,
    folderId: item.folderId,
    title: item.title,
    snippet: item.snippet.slice(0, SIDEBAR_SNIPPET_CHARS),
    version: item.currentVersion,
    prompts: item.prompts,
    level: levelOf(item.folderId),
  };
}

const byTitle = (a: SidebarTemplate, b: SidebarTemplate): number =>
  a.title.localeCompare(b.title);

/** Shared folders first by sort order and name, the caller's private folder last (wireframe 01). */
function folderOrder(
  a: Folder & { own: boolean },
  b: Folder & { own: boolean },
) {
  if (a.own !== b.own) return a.own ? 1 : -1;
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/** Counts each template in its folder and in every visible ancestor. */
function subtreeCounts(
  templates: readonly SidebarTemplate[],
  parentOf: ReadonlyMap<string, string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const template of templates) {
    let folderId = template.folderId;
    while (folderId !== "") {
      counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
      folderId = parentOf.get(folderId) ?? "";
    }
  }
  return counts;
}

export function sidebarHome(context: HandlerContext): SidebarHome {
  const { index, levelOf } = context.access();
  const visible = visibleFolders(index, levelOf, context.caller.email);
  const parentOf = new Map(
    [...visible.values()].map(({ folder }) => [
      folder.id,
      visible.has(folder.parentId) ? folder.parentId : "",
    ]),
  );
  const templates = index.items
    .filter((item) => item.deletedAt === "" && visible.has(item.folderId))
    .map((item) => toTemplate(item, levelOf))
    .sort(byTitle);
  const counts = subtreeCounts(templates, parentOf);
  const folders: SidebarFolder[] = [...visible.values()]
    .map(({ folder, own }) => ({ ...folder, own }))
    .sort(folderOrder)
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: parentOf.get(folder.id) ?? "",
      count: counts.get(folder.id) ?? 0,
    }));
  return {
    folders: folders.filter((folder) => folder.parentId === ""),
    subfolders: folders.filter((folder) => folder.parentId !== ""),
    templates,
    favorites: [],
    recent: [],
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
