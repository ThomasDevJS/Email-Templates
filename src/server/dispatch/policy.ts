/**
 * Policy table (ADR-0003 Part C): one row per op. `dispatch` reads the row before any handler runs.
 * `none` means "any identified caller"; a blank caller is denied before the table is read.
 */
export type RequiredLevel = "none" | "use" | "edit" | "manage" | "admin";

export interface PolicyRow {
  readonly requiredLevel: RequiredLevel;
}

export type PolicyTable = Readonly<Record<string, PolicyRow>>;

export const POLICY: PolicyTable = {
  ping: { requiredLevel: "none" },
};
