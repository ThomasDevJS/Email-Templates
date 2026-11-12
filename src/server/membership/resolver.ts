import { AppError, ErrorCode } from "../../shared/errors/codes";
import type { GroupsLookup } from "../services";

/** Membership resolver contract (ADR-0003 Part B). Script Property `MEMBERSHIP_RESOLVER` picks the implementation. */
export interface MembershipResolver {
  readonly id: ResolverId;
  readonly capabilities: {
    readonly nested: boolean;
    readonly orgUnits: boolean;
  };
  listMembers(groupEmail: string): string[];
  nestedGroups(groupEmail: string): string[];
  orgUnitOf(email: string): string;
}

export const RESOLVER_IDS = [
  "groupsapp_direct",
  "directory",
  "cloud_identity",
] as const;
export type ResolverId = (typeof RESOLVER_IDS)[number];
export const DEFAULT_RESOLVER: ResolverId = "groupsapp_direct";
export const UNSUPPORTED = "UNSUPPORTED";

const lower = (email: string): string => email.trim().toLowerCase();

/** Direct members through GroupsApp, run as the owner. No nesting, no org units (v1 default). */
export function groupsAppDirect(groups: GroupsLookup): MembershipResolver {
  return {
    id: "groupsapp_direct",
    capabilities: { nested: false, orgUnits: false },
    listMembers: (groupEmail) =>
      groups
        .getGroupByEmail(groupEmail)
        .getUsers()
        .map((user) => lower(user.getEmail())),
    nestedGroups: (groupEmail) =>
      groups
        .getGroupByEmail(groupEmail)
        .getGroups()
        .map((group) => lower(group.getEmail())),
    orgUnitOf: () => UNSUPPORTED,
  };
}

/** `directory` and `cloud_identity` need admin grants and extra scopes (2.5b); until then they refuse. */
function notConfigured(id: ResolverId): MembershipResolver {
  const fail = (): never => {
    throw new AppError(
      ErrorCode.NOT_CONFIGURED,
      `Membership resolver ${id} is not configured in this build`,
    );
  };
  return {
    id,
    capabilities: { nested: true, orgUnits: true },
    listMembers: fail,
    nestedGroups: fail,
    orgUnitOf: fail,
  };
}

export function resolverId(configured: string | null): ResolverId {
  return RESOLVER_IDS.find((id) => id === configured) ?? DEFAULT_RESOLVER;
}

export function createResolver(
  id: ResolverId,
  groups: () => GroupsLookup,
): MembershipResolver {
  return id === "groupsapp_direct"
    ? groupsAppDirect(groups())
    : notConfigured(id);
}
