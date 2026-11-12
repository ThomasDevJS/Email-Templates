import type { Level } from "../model/data";
import { atLeast } from "./levels";
import type { LevelOf } from "./effective";

/**
 * ADR-0003 Part C role matrix as data, one entry per row. The policy table maps every op to one of these
 * actions; `checkNeed` applies the entry to the op's target folders.
 */
export type Need =
  | { readonly kind: "any" }
  | { readonly kind: "level"; readonly level: Level }
  | { readonly kind: "admin" };

const ANY: Need = { kind: "any" };
const ADMIN: Need = { kind: "admin" };
const USE: Need = { kind: "level", level: "use" };
const EDIT: Need = { kind: "level", level: "edit" };
const MANAGE: Need = { kind: "level", level: "manage" };

export const ROLE_MATRIX = {
  "template.read": USE,
  "template.apply": USE,
  favorite: USE,
  "template.write": EDIT,
  "template.move": EDIT,
  "template.trash": EDIT,
  "version.history": EDIT,
  "trash.purge": ADMIN,
  "folder.edit": MANAGE,
  "folder.moveDelete": MANAGE,
  "folder.createTop": ADMIN,
  "grant.manage": MANAGE,
  "export.folder": MANAGE,
  "library.transfer": ADMIN,
  "audit.view": ADMIN,
  "admin.ops": ADMIN,
  "private.self": EDIT,
} as const satisfies Readonly<Record<string, Need>>;

export type MatrixAction = keyof typeof ROLE_MATRIX;

/** Policy action for ops open to any identified caller (`me`, `ping`, `profile.me`). Not a matrix row. */
export const ANY_CALLER = "any" as const;
export type PolicyAction = MatrixAction | typeof ANY_CALLER;

/** Target folder ID meaning "top level": only admins may act there (create or move a top-level folder). */
export const ROOT = "";

export function needOf(action: PolicyAction): Need {
  return action === ANY_CALLER ? ANY : ROLE_MATRIX[action];
}

/**
 * Every target must satisfy the need. Level needs on `ROOT` require admin. A level need with no targets passes:
 * list ops filter their results with the same `LevelOf`, so nothing hidden leaves the server.
 */
export function checkNeed(
  need: Need,
  isAdmin: boolean,
  levelOf: LevelOf,
  targets: readonly string[],
): boolean {
  if (need.kind === "any") return true;
  if (need.kind === "admin") return isAdmin;
  return targets.every((target) =>
    target === ROOT ? isAdmin : atLeast(levelOf(target), need.level),
  );
}
