import { ANY_CALLER, type PolicyAction } from "../../shared/permissions/matrix";
import { optString } from "./args";
import {
  folderAndParent,
  folderArg,
  folderMove,
  grantFolder,
  itemFolder,
  parentArg,
  restoreTargets,
  templateCopy,
  templateMove,
  type TargetResolver,
} from "./targets";

/**
 * Policy table (ADR-0003 Part C, spec section 6): one row per op. `dispatch` resolves the targets, computes the
 * caller's level and denies before any handler runs. `action` names a role matrix row; ops open to any identified
 * caller use `any`. Level rows without `targets` are list ops: their handlers filter results by the same levels.
 * `web` ops are refused on the add-on surface.
 */
export type OpSurface = "both" | "web";

export interface PolicyRow {
  readonly action: PolicyAction | ((args: unknown) => PolicyAction);
  readonly targets?: TargetResolver;
  readonly surface: OpSurface;
}

export type PolicyTable = Readonly<Record<string, PolicyRow>>;

const both = (action: PolicyAction, targets?: TargetResolver): PolicyRow =>
  targets === undefined
    ? { action, surface: "both" }
    : { action, targets, surface: "both" };
const web = (action: PolicyAction, targets?: TargetResolver): PolicyRow =>
  targets === undefined
    ? { action, surface: "web" }
    : { action, targets, surface: "web" };

/** Sub-folder creation needs `manage` on the parent; a top-level folder needs admin. */
const folderCreateAction = (args: unknown): PolicyAction =>
  optString(args, "parentId") === "" ? "folder.createTop" : "folder.edit";

export const POLICY: PolicyTable = {
  ping: both(ANY_CALLER),
  me: both(ANY_CALLER),
  "profile.me": both(ANY_CALLER),

  "sidebar.home": both("template.read"),
  "folder.list": both("template.read"),
  "template.list": both("template.read"),
  search: both("template.read"),
  "search.body": both("template.read"),
  "template.get": both("template.read", itemFolder),
  "template.getBody": both("template.read", itemFolder),
  "template.apply": both("template.apply", itemFolder),
  "favorite.set": both("favorite", itemFolder),
  "favorite.unset": both("favorite", itemFolder),

  "template.create": web("template.write", folderArg),
  "template.update": web("template.write", templateCopy),
  "template.duplicate": web("template.write", templateCopy),
  "template.delete": web("template.trash", itemFolder),
  "template.restoreFromTrash": web("template.trash", restoreTargets),
  "template.move": web("template.move", templateMove),
  "version.list": web("version.history", itemFolder),
  "version.get": web("version.history", itemFolder),
  "version.restore": web("version.history", itemFolder),

  "folder.create": {
    action: folderCreateAction,
    targets: parentArg,
    surface: "web",
  },
  "folder.rename": web("folder.edit", folderArg),
  "folder.move": web("folder.moveDelete", folderMove),
  "folder.delete": web("folder.moveDelete", folderAndParent),
  "trash.purge": web("trash.purge"),

  // List op: the handler keeps the folders the caller manages and answers DENIED when there are none.
  "admin.folders": web("grant.manage"),
  "grant.list": web("grant.manage", folderArg),
  "grant.add": web("grant.manage", folderArg),
  "grant.remove": web("grant.manage", grantFolder),

  "export.folder": web("export.folder", folderArg),
  "export.library": web("library.transfer"),
  import: web("library.transfer"),
  "audit.query": web("audit.view"),
  "usage.report": web("audit.view"),
  "membership.refresh": web("admin.ops"),
  "membership.status": web("admin.ops"),
  "config.get": web("admin.ops"),
  "config.set": web("admin.ops"),
  "admin.add": web("admin.ops"),
  "admin.remove": web("admin.ops"),
  "backup.list": web("admin.ops"),
  "backup.restore": web("admin.ops"),
};
