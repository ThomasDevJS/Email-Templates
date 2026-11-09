/**
 * Allowlist of top-level Apps Script functions (ADR-0003 Part C, revised in slice 2). Every export of src/entry.ts
 * appears here with the one surface it serves; a test fails on any export missing from the list or the reverse.
 * Any top-level function is callable through `google.script.run` from the web app, so each surface has a guard:
 * - `webapp_rpc`: `doGet` and `rpc`, web app callers; `rpc` runs `dispatch`.
 * - `doPost`: add-on calls with a bearer token; runs `dispatch`.
 * - `trigger`: time-driven jobs and `setup`; run only for the owner or a real project trigger.
 * - `addon`: Card Service callbacks; run only when the effective user is the active user (never as the owner for someone else).
 */
export type EntrySurface = "webapp_rpc" | "doPost" | "trigger" | "addon";

export const ENTRY_POINTS = {
  doGet: "webapp_rpc",
  rpc: "webapp_rpc",
  doPost: "doPost",
  setup: "trigger",
  tick: "trigger",
  refreshMembers: "trigger",
  daily: "trigger",
  onComposeOpen: "addon",
  onHomepage: "addon",
  onOpenLibrary: "addon",
  onPing: "addon",
  onDiag: "addon",
} as const satisfies Readonly<Record<string, EntrySurface>>;

export type EntryName = keyof typeof ENTRY_POINTS;

/** Handler names `setup` installs as time-driven triggers (spec section 16). */
export const TRIGGER_JOBS = ["tick", "refreshMembers", "daily"] as const;
export type TriggerJob = (typeof TRIGGER_JOBS)[number];
