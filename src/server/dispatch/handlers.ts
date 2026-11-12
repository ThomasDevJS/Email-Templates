import {
  adminFolders,
  membershipRefresh,
  membershipStatus,
  trashPurge,
  usageReport,
} from "../handlers/admin";
import { adminAdd, adminRemove } from "../handlers/admins";
import { auditQuery } from "../handlers/audit";
import {
  backupList,
  backupRestore,
  configGet,
  configSet,
} from "../handlers/config";
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
import {
  exportFolder,
  exportLibrary,
  importTemplates,
} from "../handlers/transfer";
import type { HandlerTable } from "./context";

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
  "export.folder": exportFolder,
  "export.library": exportLibrary,
  import: importTemplates,
  "audit.query": auditQuery,
  "usage.report": usageReport,
  "config.get": configGet,
  "config.set": configSet,
  "admin.add": adminAdd,
  "admin.remove": adminRemove,
  "backup.list": backupList,
  "backup.restore": backupRestore,
};
