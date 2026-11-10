# Handoff: implementer to reviewer, slice 6a (admin shell, folders and grants, memberships, trash)

Branch `slice/06a-admin-folders`, base a7e5abb. Commits ad1980f (server), 7ebd41e (web), 5b7cdf0 (smoke, test timing), plus this handoff commit. Not merged, not pushed.

## Done

| # | Criterion | Where |
|---|---|---|
| 1 | `#/admin`, `#/admin/memberships`, `?view=admin` (router.ts). Rail shows Admin when `folder.list` gave a `manage` level. New op `admin.folders` decides on entry: admins every live folder, manage holders the folders they manage, everyone else DENIED (no folder data). | src/web/router.ts, src/web/app.ts, src/web/views/admin.ts, src/server/handlers/admin.ts |
| 2 | Folders and grants: tree (reuses `createFolderTree`, root row "All folders"), + Top-level folder (admin), + Subfolder, Rename, Move, Delete with confirmation (Cancel first). Effective access table: principal, level, source ("this folder" or "Sales (inherited)"), OU rows marked inactive (D17). Add grant (group, user, domain, OU) and Remove. Group validation is the existing resolver read (`readGroupNow`). Audit events with before and after are the slice 2 ones. | src/web/views/adminFolders.ts, src/web/admin/model.ts, src/server/handlers/grants.ts (`sourcePath`) |
| 3 | Memberships: new admin op `membership.status`; `membership.refresh` returns the same view. Resolver, nested flag, last refresh, per group member count, child groups, status; warning row on child groups. No member addresses leave the server. | src/web/views/memberships.ts, src/server/handlers/admin.ts |
| 4 | Trash view (`#/trash`, link under the library tree). `template.list {trash:true}` resolves levels through deleted folders and adds `folderLive`, `folderPath`, `canPurge`. Restore in place, or a folder picker when the folder is gone or not editable. `template.restoreFromTrash` takes `folderId`; new target resolver `restoreTargets` (edit on original and target; purged original = ROOT, admin only). `trash.purge` (admin) purges everything soft-deleted now via `purgeDeleted`, shared with the daily job; left `LATER_SLICE_OPS`. Daily 30-day purge unchanged (`purgeTrash` calls `purgeDeleted`). | src/web/views/trash.ts, src/server/handlers/templates.ts, src/server/dispatch/targets.ts, src/server/jobs/daily.ts |
| 5 | Private folders: no grant (existing VALIDATION), no move, no delete (existing). Admin view hides Subfolder, Move, Delete and the grant form on them and shows "Private folder of <owner>". Admins see them labelled "My templates (owner)". Owners still cannot rename theirs (manage needed). | adminFolders.ts |
| 6 | Policy rows: `admin.folders` (grant.manage, list op, handler DENIED), `membership.status` (admin.ops), `template.restoreFromTrash` now `restoreTargets`. Role matrix tests: 12 ops x 6 roles (no grant, use, edit, manage, admin, add-on), each DENIED asserts `calls.drive` 0 and an unchanged index file. Admin rows now re-read the membership snapshot inside the lock (dispatch `recheck`). | test/unit/server/admin.test.ts, src/server/dispatch/dispatch.ts |
| 7 | Q23: `installTriggers` creates the 3 new triggers, then deletes the old ones. A failed create deletes the new ones it made, keeps the old set, writes `job:triggers:lastError`, leaves `TRIGGERS_VERSION` stale. | src/server/jobs/triggers.ts, health.ts `recordJobError` |
| 8 | `folder.rename` strips the label only when the folder owner differs from the caller (uses `folderLabel`). Stale `search.body` failure: no toast. "Searching text..." goes to the `role=status` region and the list has `aria-busy="true"` until the reply. | folders.ts, src/web/views/library.ts |
| 9 | Loading skeletons with `aria-busy`, empty texts (spec 7), DENIED banner, toast with request ID on SERVER, QUOTA via the existing toast, CONFLICT on stale folder `baseVersion` shown in status with local time and a reload, NOT_FOUND on a removed grant. Busy status at once on every write. | |
| 10 | Tablist (role tablist/tab/tabpanel, roving tabindex, Left, Right, Home, End). Tree keyboard as in the library. Tables hold buttons in tab order. All inputs labelled. Focus: dialogs return to opener; after a folder write the folder heading takes focus; Refresh keeps focus. Lighthouse 100 on admin, admin memberships, trash. | scripts/lighthouse.mjs |
| 11 | All times through `formatTime`. `admin.folders` filters to manage folders server-side; test checks no other address in the response. | |
| 12 | Log lines: unchanged format. A grant line carries `action`, `actor`, `targetId` (the folder ID for `grant.add`, `""` for `grant.remove` since `grantId` is not `id` or `folderId`), result, timing, calls. No principal key. Test asserts the group address is in no log line. The principal sits only in the audit event `before`/`after`. | |
| 13 | docs/ops/smoke.md "Slice 6a", 10 steps, step 8 is DoD 3. | |
| 14 | 10 scopes, no new API. `inlineHtml` and appsscript.json unchanged. | |

## Verified (clean install, this worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | added 559 packages, 16 advisories (14 moderate, 2 high), unchanged |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 49 files, 1120 tests passed. Lines 96.54 (addon 100, server 99.31, shared 100, web 95.89), statements 95.62, branches 89.00, functions 94.18 |
| `npm run build -- --env dev` | Code.js 284.7 KB of 800 KB, index.html 301.4 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | all files formatted |
| `npm run lighthouse` | library 100, editor 100, history 100, admin 100, admin memberships 100, trash 100 |
| New tests on a7e5abb src | 57 failed, 1059 passed. Old library.ts alone: 4 of 19 web admin tests fail, including the stale toast test |

Call counts (scratch test, second call warm, `calls` from the log line), base a7e5abb vs head:

| Op | Base | Head |
|---|---|---|
| sidebar.home (addon) | props 6, cache 8, drive 0, lock 0, dir 0 | same |
| search (addon) | props 5, cache 6, drive 0 | same |
| template.apply (addon) | props 5, cache 8, drive 0, lock 1, dir 1 | same |
| admin.folders | new | props 4, cache 4, drive 0 |
| membership.status | new | props 4, cache 4, drive 0 |
| grant.list | props 4, cache 4 | same |
| template.list trash | props 6, cache 8 | same |
| grant.add (domain) | props 6, cache 8, drive 2, lock 1 | same |
| folder.create top level | props 6, cache 8, drive 2, lock 1 | props 8, cache 10 (admin re-check in the lock) |
| membership.refresh | props 7, cache 8, drive 4, lock 1 | props 8 (resolver property) |
| template.restoreFromTrash | props 6, cache 8, drive 2, lock 1 | same |
| trash.purge (1 item) | NOT_IMPLEMENTED | props 9, cache 12, drive 4, lock 1 |

## Decisions and assumptions (architect to confirm)

- New ops `admin.folders` and `membership.status` (spec 6 lists neither). `admin.folders` throws DENIED in the handler, so that denial has no `evt:*` denied audit row; the log line has result denied.
- `FOLDER_DEPTH_MAX = 5` (src/shared/model/validate.ts). Spec 5.1 names no depth; the task asked for a depth rule. Moving to the top level is not depth-checked (it cannot deepen).
- `TRASH_DAYS` moved to src/shared/model/validate.ts so the web can show days left.
- `trash.purge` empties the whole trash (items and soft-deleted folders) at once; no per-item purge.
- Admin may rename private folders (existing server rule); the admin view keeps Rename on them.
- `template.list` responses carry `canPurge` (admin flag) for the Trash button.

## Left for later

- 6b: Audit log, Usage, Export and import, Config tabs, `job:triggers:lastError` display, backups.
- Spec 6 rows for `admin.folders` and `membership.status`; spec 5.1 depth number; spec 6 status line (restoreFromTrash built).
- `membership.refresh` does not clear `prof:*` (memory item from slice 5).
- A trashed template whose folder was purged is restorable only by admins (no test: the daily purge removes item and folder together).
- Grants have no version: two admins adding the same principal at different levels, last write wins.
- Web coverage on trash.ts and memberships.ts error branches is 80 to 87 percent lines.

## Risks

- `admin.folders` and the rail link: a manage holder sees Admin; a use-only caller does not. The rail reads levels from `folder.list`, the server decides on entry.
- The in-lock admin re-check reads the snapshot cache inside the lock (2 cache calls); on a cache miss it reads `members.json` from Drive inside the lock.
- `installTriggers` briefly holds 6 triggers; limit is 20.

## Files touched

Server: src/server/dispatch/{dispatch,handlers,policy,targets}.ts, src/server/handlers/{admin (new),folders,grants,templates}.ts, src/server/jobs/{daily,health,triggers}.ts, src/server/services.ts, src/shared/model/validate.ts.
Web: src/web/{app,router,dev-harness,styles.css}, src/web/rpc/api.ts, src/web/admin/model.ts (new), src/web/views/{admin,adminFolders,memberships,trash (new),library,tree}.ts.
Tests: test/unit/server/{admin (new),dispatch,jobs,membership}.test.ts, test/unit/web/{admin (new),adminModel (new),logic}.test.ts.
Scripts and docs: scripts/{lighthouse,dev-web}.mjs, docs/ops/smoke.md.

## Commands

`npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build -- --env dev`, `npm run scopes:check`, `npm run format:check`, `npm run lighthouse`. Local look: `npm run dev:web`, then `#/admin`, `#/admin/memberships`, `#/trash`, `?admin=0` for a manage holder, `?fail=DENIED&failOp=admin.folders`.

## Retry 1 (review FAIL 7a9ab77)

Commits efad596, d82cc3e, e00d34e, 5a179ec, 5c5ce65, eece656. Each fix has a test that fails when the changed src file is swapped back to the code before it.

| Item | Change | Test |
|---|---|---|
| Blocker 1 | `PRINCIPAL_KEY_MAX = 254` (src/shared/model/validate.ts). `principalKeyFor` refuses a longer trimmed key with VALIDATION for all 4 types, before the format checks. The add-grant input has `maxlength` 254. | admin.test.ts: group (the group exists in the fake), user, domain, OU over 254; OU at exactly 254 accepted; web test checks `maxLength` |
| Blocker 2 | `dispatch` buffers the denied event (`recordDenied`, target `library`) for any DENIED thrown after the policy check: `admin.folders` refusals and in-lock re-check denials. `membership.status` and the other admin rows were already recorded by `authorize`. No other 6a handler throws DENIED (grep: only admin.ts, plus the trigger guard `refuse`, which is not an op). | buffer holds rows for `admin.folders` and `membership.status`; the in-lock `trash.purge` refusal writes one too |
| Minor 1 | `grant.list` `sourcePath`: admins the full path; others only the folders they can see (level use or more), from the top of the visible part; "" when the source folder is hidden. The web shows "a parent folder (inherited)". | manage holder on Quotes: `/Quotes` and "", no "Sales" in the response; admin: `/Sales/Quotes`, `/Sales` |
| Minor 3 | `targetFolder` in templates.ts: another user's private tree takes no template, admins included, unless the template already lives in that owner's tree. Applied to restore, move, duplicate, create and update with `folderId`. | 5 refusals as admin; admin restore and duplicate inside the owner's tree still allowed |
| Minor 2 | `PURGE_FILES_MAX = 50` body files per `purgeDeleted` call. `trash.purge` returns `{ purged, filesTrashed, itemsPending }`; the Trash status names the pending count. Leftover files belong to no item, so the daily orphan cleanup (files older than 1 h) trashes them. | 53 templates: 50 files trashed, 3 pending, all 53 trashed after `runDaily` 2 h later; web message test |

Bounds of the other 6a string args: folder `name` has `FOLDER_NAME_MAX`. `principalType` and `level` are enums. `folderId`, `parentId`, `grantId`, `id` are only matched against existing records; `parentId` is stored only after `liveFolder` found it. `admin.folders`, `membership.*`, `trash.purge` take no strings. No other unbounded string reaches storage.

Results from a clean install: npm ci 559 packages, 16 advisories (unchanged). lint 0, typecheck 0. 49 files, 1131 tests. Lines 96.56, statements 95.63, branches 89.10, functions 94.19. Code.js 286.9 KB, index.html 301.5 KB. 10 scopes. Format clean. Lighthouse 100 on 6 views.

Left for later: review minor 4 (a failed delete of an old trigger leaves 6 triggers until the next run), minor 5 (spec rows for `admin.folders`, `membership.status`, depth, status line), minor 6 (web error-branch coverage). The web Move and Restore pickers still list other users' private folders for admins; the server refuses them with "Only its owner can put templates into a private folder".
