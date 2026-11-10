import { AppError, ErrorCode } from "../../shared/errors/codes";
import {
  adminFolders,
  membershipRefresh,
  membershipStatus,
  trashPurge,
} from "../handlers/admin";
import {
  folderCreate,
  folderDelete,
  folderList,
  folderMove,
  folderRename,
} from "../handlers/folders";
import { grantAdd, grantList, grantRemove } from "../handlers/grants";
import { versionGet, versionList, versionRestore } from "../handlers/history";
import { me, ping, profileMe } from "../handlers/identity";
import { favoriteSet, favoriteUnset } from "../handlers/favorites";
import { search, sidebarHome, templateApply } from "../handlers/sidebar";
import {
  templateCreate,
  templateDelete,
  templateDuplicate,
  templateGet,
  templateGetBody,
  templateList,
  templateMove,
  templateRestoreFromTrash,
  templateUpdate,
  searchBody,
} from "../handlers/templates";
import type { Handler, HandlerTable } from "./context";

/** Ops whose handlers arrive in slice 6b. They keep a policy row, so dispatch still denies before this runs. */
export const LATER_SLICE_OPS = [
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
  "template.getBody": templateGetBody,
  "template.create": templateCreate,
  "template.update": templateUpdate,
  "template.move": templateMove,
  "template.delete": templateDelete,
  "template.duplicate": templateDuplicate,
  "template.restoreFromTrash": templateRestoreFromTrash,
  "version.list": versionList,
  "version.get": versionGet,
  "version.restore": versionRestore,
  "grant.list": grantList,
  "grant.add": grantAdd,
  "grant.remove": grantRemove,
  "membership.refresh": membershipRefresh,
  "membership.status": membershipStatus,
  "admin.folders": adminFolders,
  "trash.purge": trashPurge,
  "sidebar.home": sidebarHome,
  "template.apply": templateApply,
  search,
  "search.body": searchBody,
  "favorite.set": favoriteSet,
  "favorite.unset": favoriteUnset,
  ...Object.fromEntries(LATER_SLICE_OPS.map((op) => [op, notImplemented(op)])),
};
