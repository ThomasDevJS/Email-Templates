import { AppError, ErrorCode } from "../../shared/errors/codes";
import { loadIndex } from "../cache/indexCache";
import {
  folderCreate,
  folderDelete,
  folderList,
  folderMove,
  folderRename,
} from "../handlers/folders";
import { grantAdd, grantList, grantRemove } from "../handlers/grants";
import { me, ping, profileMe } from "../handlers/identity";
import { spikeS2, spikeS2b } from "../handlers/spikes";
import {
  templateCreate,
  templateDelete,
  templateGet,
  templateList,
  templateMove,
  templateRestoreFromTrash,
  templateUpdate,
} from "../handlers/templates";
import { refreshSnapshot } from "../membership/snapshot";
import type { Handler, HandlerContext, HandlerTable } from "./context";

/** Ops whose handlers arrive in slices 3 to 6. They keep a policy row, so dispatch still denies before this runs. */
export const LATER_SLICE_OPS = [
  "sidebar.home",
  "search",
  "search.body",
  "template.apply",
  "favorite.set",
  "favorite.unset",
  "template.duplicate",
  "version.list",
  "version.get",
  "version.restore",
  "trash.purge",
  "export.folder",
  "export.library",
  "import",
  "audit.query",
  "usage.report",
  "config.get",
  "backup.list",
  "backup.restore",
] as const;

const notImplemented =
  (op: string): Handler =>
  () => {
    throw new AppError(
      ErrorCode.NOT_IMPLEMENTED,
      `${op} arrives in a later slice`,
    );
  };

function membershipRefresh(context: HandlerContext): {
  groups: number;
  warnings: readonly string[];
} {
  const snapshot = refreshSnapshot(
    context.services,
    loadIndex(context.services),
  );
  return {
    groups: Object.keys(snapshot.groups).length,
    warnings: snapshot.warnings,
  };
}

/** Op table. Every key needs a row in POLICY and the reverse (policy completeness test). */
export const HANDLERS: HandlerTable = {
  ping,
  me,
  "profile.me": profileMe,
  "folder.list": folderList,
  "folder.create": folderCreate,
  "folder.rename": folderRename,
  "folder.move": folderMove,
  "folder.delete": folderDelete,
  "template.list": templateList,
  "template.get": templateGet,
  "template.create": templateCreate,
  "template.update": templateUpdate,
  "template.move": templateMove,
  "template.delete": templateDelete,
  "template.restoreFromTrash": templateRestoreFromTrash,
  "grant.list": grantList,
  "grant.add": grantAdd,
  "grant.remove": grantRemove,
  "membership.refresh": membershipRefresh,
  "spike.s2": spikeS2,
  "spike.s2b": spikeS2b,
  ...Object.fromEntries(LATER_SLICE_OPS.map((op) => [op, notImplemented(op)])),
};
