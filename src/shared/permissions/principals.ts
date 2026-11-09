import type { MembersDoc, PrincipalType } from "../model/data";

/**
 * Principal set of a caller (ADR-0003 Part B): `user:<email>`, `domain:<domain>`, `group:<g>` for each
 * snapshot group that lists the email, and `ou:<path>` only when the resolver supports org units.
 */
export function principalKey(type: PrincipalType, key: string): string {
  return `${type}:${key.trim().toLowerCase()}`;
}

export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase();
}

export function groupsOf(email: string, snapshot: MembersDoc): string[] {
  const needle = email.trim().toLowerCase();
  return Object.entries(snapshot.groups)
    .filter(([, group]) =>
      group.members.some((member) => member.toLowerCase() === needle),
    )
    .map(([groupEmail]) => groupEmail.toLowerCase());
}

export function principalsFor(
  email: string,
  snapshot: MembersDoc,
  orgUnit = "",
): Set<string> {
  const principals = new Set<string>([
    principalKey("user", email),
    principalKey("domain", domainOf(email)),
  ]);
  for (const group of groupsOf(email, snapshot))
    principals.add(principalKey("group", group));
  if (orgUnit !== "") principals.add(principalKey("ou", orgUnit));
  return principals;
}

/** Admin = listed in `ADMIN_EMAILS` (comma separated, break-glass) or a member of `ADMIN_GROUP` in the snapshot. */
export function isAdminEmail(
  email: string,
  adminEmails: string,
  adminGroup: string,
  snapshot: MembersDoc,
): boolean {
  const needle = email.trim().toLowerCase();
  const listed = adminEmails
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .includes(needle);
  if (listed) return true;
  const group = adminGroup.trim().toLowerCase();
  return group !== "" && groupsOf(email, snapshot).includes(group);
}
