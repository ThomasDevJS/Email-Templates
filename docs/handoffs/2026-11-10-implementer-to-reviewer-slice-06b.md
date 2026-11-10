# Handoff: implementer to reviewer, slice 6b (Audit log, Usage, Export and import, Config)

Branch `slice/06b-admin-audit`, base 292d7ad. Commits e3bb4c8 (server), 8d83177 (web), 337f2cb (smoke), plus this handoff commit. Not merged, not pushed.

## Done

| # | Criterion | Where |
|---|---|---|
| 1 | `audit.query` (admin): month file `audit/<YYYY-MM>.jsonl` plus `pendingAudit`, duplicate IDs once; filters month, from, to (local day to ISO in the browser), actor, action, result, target; 50 rows per page, newest first; `id` returns one event with before and after for the drawer. Note "Denied and apply events can arrive up to 5 min late." | src/server/handlers/audit.ts, src/server/audit/query.ts, src/web/views/adminAudit.ts |
| 2 | `usage.report` (admin): template, folder, applies in 30 UTC days, last used, most applied first. New optional `days` map per `usage.json` entry, kept to 30 days by `applyUsage`. | src/server/handlers/admin.ts, src/server/audit/usage.ts, src/web/views/adminUsage.ts |
| 3 | `export.folder` (manage, subtree), `export.library` (admin, shared folders only), pages of 20 templates joined in the browser into `migway-templates-<scope>-<date>.json`, `schemaVersion` 1, subjects included. `import` (admin): Validate (`dryRun`, nothing written) then Import into the chosen folder. Bodies through `prepareFor` (sanitize, placeholders), subjects through `oneLine` then SUBJ_TOO_LONG and PH_* checks. Limits on the server: 5 MB, 200 templates, 100 folders. Manage holders see only "Export folder". | src/server/handlers/transfer.ts, src/server/transfer/{format,plan}.ts, src/web/views/adminTransfer.ts |
| 4 | `config.get` (admin): domain, ADMIN_GROUP, MEMBERSHIP_RESOLVER, CALLER_IDENTITY (default `active_user`), INDEX_REV, app version, index size with the 3 MB warning; jobs `tick`, `refreshMembers`, `daily` with schedule, last OK, status ok, late (more than 2 intervals) or never, and the last error when not ok; `job:triggers:lastError` while `TRIGGERS_VERSION` is stale. `backup.list` (dates, newest first). `backup.restore` (admin): confirmation names the date, Cancel focused; under the lock with the in-lock admin re-check; index `rev = current + 1`, current `pendingAudit` kept, one `backup.restore` audit event; `INDEX_REV`, `FAVORITES_REV`, `USAGE_REV` and cache sets published. | src/server/handlers/config.ts, src/web/views/adminConfig.ts |
| 5 | `LATER_SLICE_OPS` and `notImplemented` removed. Role matrix: 9 cases (import Validate and Import) x 6 roles; each DENIED asserts `calls.drive` 0, an unchanged index file and a buffered denied event. In-lock re-check test for `backup.restore` and `import`. | test/unit/server/adminReports.test.ts |
| 6 | Export holds folder names, item `id, folderId, title, subject, tags`, `html` and grants of in-scope folders only. No `createdBy`, no membership, audit or property data (test). `config.get` returns only the listed values; a planted `SOME_TOKEN` property and `STORE` do not appear (test). | |
| 7 | Log lines keep the closed field list. `import`: action, actor, `targetId` = target folder, result, timing, calls. `export.folder`: same with the folder ID; `export.library`: `targetId` "". `backup.restore`: `targetId` "" (the date is not logged). Test: no title, subject or body of an import file in any line. | |
| 8 | `installTriggers` deletes every old trigger even when one delete fails, then throws; `TRIGGERS_VERSION` stays stale; the next run leaves 3 (test). A failed rollback delete no longer hides the create error (test). Event buffer: `BUFFER_MAX` 200, drops counted in `evt:dropped`, `tick` adds one `audit.dropped` event with the count. | src/server/jobs/triggers.ts, src/server/audit/buffer.ts, src/server/jobs/tick.ts |
| 9 | Skeletons with `aria-busy`, empty texts, error toast with request ID and a panel message, DENIED banner, QUOTA toast (tests). Status text at once: "Loading audit events...", "Loading event details...", "Exporting...", "Validating...", "Importing...", "Restoring the backup of <date>...". Times through `formatTime`. | |
| 10 | Tablist with 6 tabs (Left, Right, Home, End, wrap). Filters are labelled controls in a form; Apply submits. The drawer is `openDialog` with `variant: "drawer"`: focus trap, Esc, focus back to Details (test). JSON blocks are focusable for keyboard scroll. Lighthouse 100 on all 10 views. | scripts/lighthouse.mjs |
| 11 | docs/ops/smoke.md "Slice 6b", 10 steps. Step 9 restores a backup on dev data only and says it overwrites `index.json`, `favorites.json`, `usage.json`. | |
| 12 | 10 scopes. appsscript.json, `inlineHtml`, package files unchanged. | |

## Verified (clean install, this worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | added 559 packages, 16 advisories (14 moderate, 2 high), unchanged |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 51 files, 1225 tests passed. Lines 96.60 (addon 100, server 99.31, shared 100, web 95.16), statements 95.68, branches 88.41, functions 94.38 |
| `npm run build -- --env dev` | Code.js 312.6 KB of 800 KB, index.html 316.2 KB of 400 KB (was 301.5) |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | all files formatted |
| `npm run lighthouse` | library, editor, history, admin, admin memberships, admin audit, admin usage, admin export and import, admin config, trash: 100 each |

Secret scan of the added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, github_pat, AKIA, xox, eyJ): 0 hits. New network calls: none. `URL.createObjectURL` and an `<a download>` click are local browser APIs.

Call counts (scratch test, second call warm, `calls` of the log line; base 292d7ad vs head):

| Op | Base | Head |
|---|---|---|
| sidebar.home (addon) | props 6, cache 8, drive 0 | same |
| search (addon) | props 5, cache 6, drive 0 | same |
| template.apply (addon) | props 6, cache 9, drive 0, lock 1, dir 1 | same |
| audit.query | NOT_IMPLEMENTED | props 4, cache 6, drive 1 |
| usage.report | NOT_IMPLEMENTED | props 5, cache 6, drive 0 |
| export.folder, export.library (bodies cached) | NOT_IMPLEMENTED | props 4, cache 5, drive 0 |
| config.get | NOT_IMPLEMENTED | props 16, cache 4, drive 0 |
| backup.list | NOT_IMPLEMENTED | props 3, cache 2, drive 1 |
| import Validate (1 template) | NOT_IMPLEMENTED | props 5, cache 4, drive 0 |
| import (1 template) | NOT_IMPLEMENTED | props 9, cache 12, drive 3, lock 1 |
| backup.restore | NOT_IMPLEMENTED | props 10, cache 14, drive 11, lock 1 |

`props` counts reads of the per-request snapshot (one `getProperties` in production), so the 16 of `config.get` cost one read.

Drive bounds per call:
- `audit.query`: 1 `files.list` of the audit folder plus at most 1 read of the month file (cache miss, `aud:<month>` keyed by file ID and size). 1 with the month cached. Plus 1 index read on a cold index cache.
- `export.*`: at most 20 body reads (cache misses), test pins 20 on a cold body cache.
- `import`: 0 reads for Validate; Import writes 1 body file per created template (max 200) plus the index commit.
- `backup.restore`: 2 lists, 3 reads of the copies, index meta and write, 2 side reads and 2 side writes.

## Decisions and assumptions (architect to confirm)

- `export.library` leaves out private folders and their subtrees. Import creates shared folders only, so private templates would become visible under the target. Owner-change migration of private folders is not covered.
- Import does not create grants; the file's grants are informational. Folders whose name a live sibling already has are reused; a template whose title is already in the destination folder is skipped. So a second import of one file adds nothing.
- Import audit: one `import` event per created folder and template (after = record and body ref). 200 templates is about 240 KB, above the 200 KB early flush, so `tick` rolls it.
- Import counts: created, skipped and failed are templates; folders are reported as new, existing and in the lines list. `subjectsFlattened` counts templates whose subject held a control character.
- Usage window: the 30 UTC days ending today. Entries written before this slice have no `days` and show 0 until their next apply. `usage.json` grows by about 30 small keys per active template.
- Restore keeps the current `pendingAudit` (events of the backup's pending list are either still pending or already in a month file) and sets side file revs to `max(live, copy) + 1`.
- `audit.dropped` events use actor `system` and result `error`.
- Config `triggersError` appears only while `TRIGGERS_VERSION` is stale, because `job:triggers:lastError` is never cleared.

## Left for later

- Spec 6 rows for `admin.folders`, `membership.status`; spec 5.5 `usage.json` `days`; spec 4.5 export page size and import limits; spec 6 status line (no stubs left). ADR-0002 export format: actual item `meta` fields. Architect.
- Slice 7: end user docs, rollback exercise, runbook text for restore and import.
- Import of more than 200 templates needs several folder exports. A library-wide migration (dev to prod) needs a split by folder.
- `membership.refresh` does not clear `prof:*` (carried from slice 5).
- Web coverage of error branches in the new tabs is 84 to 93 percent lines.
- The usage table path shows "My templates" for every private folder; the owner label is not applied there.

## Risks

- `backup.restore` of an older date: body versions saved after the backup become orphans (version above the restored current version) and the daily cleanup trashes them after 1 h. Templates purged after the backup point at trashed body files and fail to open. The dialog says changes after the date are lost.
- Add-on User Cache (`view:*`, 10 min) shows pre-restore lists until it expires.
- `google.script.run` payload limit for a 5 MB import string is undocumented (ADR-0002 open question). Unverified on Apps Script.
- An audit month file at 10x (24 MB) is over the Script Cache and is read from Drive on every call.

## Files touched

Server: src/server/audit/{buffer,query (new),usage}.ts, src/server/dispatch/{args,handlers}.ts, src/server/handlers/{admin,audit (new),config (new),folders,transfer (new)}.ts, src/server/jobs/{daily,tick,triggers}.ts, src/server/storage/{driveStore,port}.ts, src/server/transfer/{format,plan}.ts (new), src/shared/model/{data,validate}.ts.
Web: src/web/{router,dev-harness,styles.css}, src/web/rpc/api.ts, src/web/admin/model.ts, src/web/ui/dialog.ts, src/web/views/{admin,adminAudit (new),adminConfig (new),adminTransfer (new),adminUsage (new)}.ts.
Tests: test/unit/server/{adminReports (new),dispatch,jobs}.test.ts, test/unit/web/{adminReports (new),admin,adminModel,logic}.test.ts.
Scripts and docs: scripts/{lighthouse,dev-web}.mjs, docs/ops/smoke.md.

## Commands

`npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build -- --env dev`, `npm run scopes:check`, `npm run format:check`, `npm run lighthouse`. Local look: `npm run dev:web`, then `#/admin/audit`, `#/admin/usage`, `#/admin/transfer`, `#/admin/config`; `?admin=0` for a manage holder; `?fail=QUOTA&failOp=usage.report`.
