/**
 * In-memory GroupsApp. `getGroupByEmail` throws for unknown groups, as Apps Script does when the group does not
 * exist or its member list is not visible. `reads` counts lookups (quota budget, ADR-0003 Part B).
 */
export interface FakeGroupSpec {
  readonly users: readonly string[];
  readonly groups?: readonly string[];
}

export interface FakeGroupsApp {
  readonly groups: Map<string, FakeGroupSpec>;
  reads: number;
  getGroupByEmail(email: string): {
    getUsers(): { getEmail(): string }[];
    getGroups(): { getEmail(): string }[];
  };
}

const withEmail = (email: string) => ({ getEmail: () => email });

export function createGroupsApp(
  initial: Record<string, FakeGroupSpec> = {},
): FakeGroupsApp {
  const groups = new Map(Object.entries(initial));
  const app: FakeGroupsApp = {
    groups,
    reads: 0,
    getGroupByEmail(email) {
      app.reads++;
      const spec = groups.get(email.toLowerCase());
      if (spec === undefined)
        throw new Error(`Invalid argument: group ${email} not found`);
      return {
        getUsers: () => spec.users.map(withEmail),
        getGroups: () => (spec.groups ?? []).map(withEmail),
      };
    },
  };
  return app;
}

/** In-memory `AdminDirectory.Users`. Unknown users throw "Resource Not Found". Records each call's options. */
export interface FakeDirectory {
  readonly users: Map<string, unknown>;
  readonly calls: { email: string; options: object }[];
  get(email: string, options: object): unknown;
}

export function createDirectory(
  initial: Record<string, unknown> = {},
): FakeDirectory {
  const users = new Map(Object.entries(initial));
  const calls: { email: string; options: object }[] = [];
  return {
    users,
    calls,
    get(email, options) {
      calls.push({ email, options });
      if (!users.has(email)) throw new Error("Resource Not Found: userKey");
      return users.get(email);
    },
  };
}
