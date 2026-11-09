import { prepareBody, type PreparedBody } from "../../shared/body/prepare";
import { scanBody } from "../../shared/placeholders/validate";
import { sanitize } from "../../shared/sanitize/sanitize";
import type { PropertyStore } from "../services";

/** Script Property listing allowed image hosts, comma-separated (ADR-0004 Q12). Empty allows any `https` host. */
export const IMG_HOSTS_KEY = "IMG_HOSTS";

export function imgHosts(props: PropertyStore): string[] {
  return (props.getProperty(IMG_HOSTS_KEY) ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== "");
}

/** Sanitize and validate a body with this deployment's image host list. Throws VALIDATION with `details.problems`. */
export function prepareFor(props: PropertyStore, html: string): PreparedBody {
  return prepareBody(html, { imgHosts: imgHosts(props) });
}

/** A stored body as clients read it: sanitized again (covers bodies stored before slice 3), names and prompts. */
export function readableBody(
  props: PropertyStore,
  stored: string,
): { html: string; placeholders: string[]; prompts: string[] } {
  const html = sanitize(stored, { imgHosts: imgHosts(props) });
  const { placeholders, prompts } = scanBody(html);
  return { html, placeholders, prompts };
}
