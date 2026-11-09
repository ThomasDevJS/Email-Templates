import { domainOf } from "../../shared/permissions/principals";
import { DOMAIN_KEY, OWNER_EMAIL_KEY } from "../guards";
import { RESOLVER_KEY, ADMIN_EMAILS_KEY } from "../membership/snapshot";
import { resolverId } from "../membership/resolver";
import { nowIso, type Services } from "../services";
import { ensureStore } from "../storage/setupStore";
import { installAndRecord } from "./triggers";

export interface SetupResult {
  readonly domain: string;
  readonly created: number;
  readonly triggers: number;
}

/**
 * Once per environment, from the editor (spec section 16). Records the owner and domain, seeds `ADMIN_EMAILS`
 * with the owner when unset, creates the data folder and files idempotently, installs the 3 triggers.
 */
export function runSetup(services: Services): SetupResult {
  const owner = services.session.effectiveEmail().trim().toLowerCase();
  const domain = domainOf(owner);
  services.props.setProperty(OWNER_EMAIL_KEY, owner);
  services.props.setProperty(DOMAIN_KEY, domain);
  if ((services.props.getProperty(ADMIN_EMAILS_KEY) ?? "") === "")
    services.props.setProperty(ADMIN_EMAILS_KEY, owner);
  const resolver = resolverId(services.props.getProperty(RESOLVER_KEY));
  const { created } = ensureStore(
    services.drive(),
    services.props,
    nowIso(services),
    resolver,
  );
  installAndRecord(services);
  return {
    domain,
    created,
    triggers: services.triggers.getProjectTriggers().length,
  };
}
