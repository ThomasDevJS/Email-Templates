import type { Services } from "../services";

/**
 * Sender values from the Directory `domain_public` view (ADR-0004 Sender values), cached 6 h as `prof:<email>`.
 * Lookup failures return blank fields and are not cached, so a fixed Directory answer shows on the next request.
 */
export const PROFILE_TTL_S = 21600;

export interface SenderProfile {
  readonly email: string;
  readonly name: string;
  readonly givenName: string;
  readonly title: string;
  readonly department: string;
  readonly phone: string;
}

interface Organization {
  readonly primary?: boolean;
  readonly title?: string;
  readonly department?: string;
}

interface Phone {
  readonly type?: string;
  readonly value?: string;
}

interface DirectoryUser {
  readonly name?: { readonly fullName?: string; readonly givenName?: string };
  readonly organizations?: readonly Organization[];
  readonly phones?: readonly Phone[];
}

function pickOrganization(orgs: readonly Organization[]): Organization {
  return orgs.find((org) => org.primary === true) ?? orgs[0] ?? {};
}

function pickPhone(phones: readonly Phone[]): string {
  return (
    (phones.find((phone) => phone.type === "work") ?? phones[0])?.value ?? ""
  );
}

/** Mapping of ADR-0004: name.fullName, primary (else first) organization title and department, work (else first) phone. */
export function toProfile(email: string, raw: unknown): SenderProfile {
  const user = (raw ?? {}) as DirectoryUser;
  const org = pickOrganization(user.organizations ?? []);
  return {
    email,
    name: user.name?.fullName ?? "",
    givenName: user.name?.givenName ?? "",
    title: org.title ?? "",
    department: org.department ?? "",
    phone: pickPhone(user.phones ?? []),
  };
}

function cacheKey(email: string): string {
  return `prof:${email.toLowerCase()}`;
}

export function lookupProfile(
  services: Pick<Services, "cache" | "directoryUsers">,
  email: string,
): SenderProfile {
  const cached = services.cache.get(cacheKey(email));
  if (cached !== null) return JSON.parse(cached) as SenderProfile;
  let raw: unknown;
  try {
    raw = services
      .directoryUsers()
      .get(email, { viewType: "domain_public", projection: "basic" });
  } catch {
    return toProfile(email, {});
  }
  const profile = toProfile(email, raw);
  services.cache.put(cacheKey(email), JSON.stringify(profile), PROFILE_TTL_S);
  return profile;
}
