import type { Level } from "../model/data";

/** Effective level of a caller on a folder: `none` < `use` < `edit` < `manage` (ADR-0003 Part C). */
export type AccessLevel = "none" | Level;

const RANK: Readonly<Record<AccessLevel, number>> = {
  none: 0,
  use: 1,
  edit: 2,
  manage: 3,
};

export function atLeast(have: AccessLevel, need: AccessLevel): boolean {
  return RANK[have] >= RANK[need];
}

export function higher(a: AccessLevel, b: AccessLevel): AccessLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

export function isLevel(value: unknown): value is Level {
  return value === "use" || value === "edit" || value === "manage";
}
