import {
  prepareBody,
  problemsError,
  type PreparedBody,
} from "../../shared/body/prepare";
import { CACHE_TTL_S, CHUNK_BYTES } from "../../shared/cache/chunked";
import type { IndexDoc, Item } from "../../shared/model/data";
import {
  NO_RECIPIENTS,
  validateRecipients,
  type RecipientPolicy,
  type Recipients,
} from "../../shared/model/recipients";
import { settingValue } from "../../shared/model/settings";
import { scanBody } from "../../shared/placeholders/validate";
import { sanitize } from "../../shared/sanitize/sanitize";
import { utf8Length } from "../../shared/text";
import type { HandlerContext } from "../dispatch/context";
import { DOMAIN_KEY } from "../guards";
import type { PropertyStore, Services } from "../services";

/**
 * Script Cache copy of stored body HTML, one `bd:<bodyFileId>` entry for 6 h. Body files never change, so the
 * file ID is a safe key: an orphan file of a failed save never shadows the committed one. Bodies over one
 * entry (90 KB) are not cached and come from Drive.
 */
const bodyKey = (fileId: string): string => `bd:${fileId}`;
/** Plain text of a body file for `search.body` (spec 4.4 `ft:*`), same rules as `bd:*`. */
const textKey = (fileId: string): string => `ft:${fileId}`;

type BodyServices = Pick<Services, "cache" | "store">;

function putEntry(services: BodyServices, key: string, value: string): void {
  if (utf8Length(value) > CHUNK_BYTES) return;
  try {
    services.cache.put(key, value, CACHE_TTL_S);
  } catch {
    // A failed put costs the next reader one Drive read.
  }
}

export function cacheBody(
  services: BodyServices,
  fileId: string,
  html: string,
): void {
  putEntry(services, bodyKey(fileId), html);
}

export function cacheText(
  services: BodyServices,
  fileId: string,
  text: string,
): void {
  putEntry(services, textKey(fileId), text);
}

/**
 * shortcut: at most 25 Drive reads per `search.body` call; the rest count as `skipped` and are cached by later
 * calls. Upgrade: warm `ft:*` in `tick` if libraries grow past a few hundred templates.
 */
export const TEXT_MISS_BUDGET = 25;

/** Plain text by body file ID: one `getAll` over `ft:*`, then Drive for up to 25 misses. */
export function bodyTexts(
  services: BodyServices,
  items: readonly Item[],
): { texts: Map<string, string>; skipped: number } {
  const ids = items.map((item) => item.bodyFileId);
  const found = ids.length === 0 ? {} : services.cache.getAll(ids.map(textKey));
  const texts = new Map<string, string>();
  const missing: string[] = [];
  for (const id of ids) {
    const text = found[textKey(id)];
    if (text === undefined) missing.push(id);
    else texts.set(id, text);
  }
  for (const id of missing.slice(0, TEXT_MISS_BUDGET)) {
    const { plainText } = services.store().readBody(id);
    cacheText(services, id, plainText);
    texts.set(id, plainText);
  }
  return { texts, skipped: Math.max(0, missing.length - TEXT_MISS_BUDGET) };
}

/**
 * Stored HTML of the item's current version: one cache read, Drive on a miss. `keep` false leaves a missed body out
 * of the cache, so a bulk read (export) does not push other entries out of the 1,000-item Script Cache.
 */
export function readStoredBody(
  services: BodyServices,
  item: Item,
  keep = true,
): string {
  const cached = services.cache.get(bodyKey(item.bodyFileId));
  if (cached !== null) return cached;
  const { html } = services.store().readBody(item.bodyFileId);
  if (keep) cacheBody(services, item.bodyFileId, html);
  return html;
}

/** Script Property listing allowed image hosts, comma-separated (ADR-0004 Q12). Empty allows any `https` host. */
export const IMG_HOSTS_KEY = "IMG_HOSTS";

export function imgHosts(props: PropertyStore): string[] {
  return (props.getProperty(IMG_HOSTS_KEY) ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== "");
}

/**
 * `DOMAIN` from the request's property snapshot and the admin setting `recipientsExternal` from the request's
 * index (D29, spec 5.8): no extra Properties or Drive call.
 */
export function recipientPolicy(
  context: HandlerContext,
  index: IndexDoc = context.access().index,
): RecipientPolicy {
  const domain = context.services.props.getProperty(DOMAIN_KEY) ?? "";
  return {
    domain: domain.trim().toLowerCase(),
    external: settingValue(index.settings, "recipientsExternal"),
  };
}

/**
 * In-lock re-check of a write (ADR-0008 section 1): recipients prepared before the lock are checked again under the
 * setting of the index read inside the lock, so a save that started under `allow` stores no outside address after
 * `deny`. Same VALIDATION as the save.
 */
export function recheckRecipients(
  context: HandlerContext,
  current: IndexDoc,
  recipients: Recipients,
): void {
  const policy = recipientPolicy(context, current);
  if (policy.external === "allow") return;
  const { problems } = validateRecipients(recipients, policy);
  if (problems.length > 0) throw problemsError(problems, []);
}

/**
 * Sanitize and validate a body, subject and recipients with this deployment's image host list and recipient
 * switch. Throws VALIDATION with `details.problems`.
 */
export function prepareFor(
  context: HandlerContext,
  html: string,
  subject: string,
  recipients: Recipients = NO_RECIPIENTS,
): PreparedBody {
  const hosts = imgHosts(context.services.props);
  return prepareBody(html, { imgHosts: hosts }, subject, {
    lists: recipients,
    policy: recipientPolicy(context),
  });
}

/**
 * A stored body as clients read it: sanitized again (covers bodies stored before slice 3), names and prompts over
 * subject and body.
 */
export function readableBody(
  props: PropertyStore,
  stored: string,
  subject: string,
): { html: string; placeholders: string[]; prompts: string[] } {
  const html = sanitize(stored, { imgHosts: imgHosts(props) });
  const { placeholders, prompts } = scanBody(html, [], subject);
  return { html, placeholders, prompts };
}
