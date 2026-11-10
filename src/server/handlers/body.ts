import { prepareBody, type PreparedBody } from "../../shared/body/prepare";
import { CACHE_TTL_S, CHUNK_BYTES } from "../../shared/cache/chunked";
import type { Item } from "../../shared/model/data";
import { scanBody } from "../../shared/placeholders/validate";
import { sanitize } from "../../shared/sanitize/sanitize";
import { utf8Length } from "../../shared/text";
import type { PropertyStore, Services } from "../services";

/**
 * Script Cache copy of stored body HTML, one `bd:<bodyFileId>` entry for 6 h. Body files never change, so the
 * file ID is a safe key: an orphan file of a failed save never shadows the committed one. Bodies over one
 * entry (90 KB) are not cached and come from Drive.
 */
const bodyKey = (fileId: string): string => `bd:${fileId}`;

type BodyServices = Pick<Services, "cache" | "store">;

export function cacheBody(
  services: BodyServices,
  fileId: string,
  html: string,
): void {
  if (utf8Length(html) > CHUNK_BYTES) return;
  try {
    services.cache.put(bodyKey(fileId), html, CACHE_TTL_S);
  } catch {
    // A failed put costs the next reader one Drive read.
  }
}

/** Stored HTML of the item's current version: one cache read, Drive on a miss. */
export function readStoredBody(services: BodyServices, item: Item): string {
  const cached = services.cache.get(bodyKey(item.bodyFileId));
  if (cached !== null) return cached;
  const { html } = services.store().readBody(item.bodyFileId);
  cacheBody(services, item.bodyFileId, html);
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
 * Sanitize and validate a body and subject with this deployment's image host list. Throws VALIDATION with
 * `details.problems`.
 */
export function prepareFor(
  props: PropertyStore,
  html: string,
  subject: string,
): PreparedBody {
  return prepareBody(html, { imgHosts: imgHosts(props) }, subject);
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
