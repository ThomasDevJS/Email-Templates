# Review: slice 6b (Audit log, Usage, Export and import, Config)

Verdict: FAIL. One blocker: `backup.restore` writes a parseable backup without a shape check, and one bad copy makes the library unusable, the next restore included.

Reviewed: branch `slice/06b-admin-audit`, head ffd3957, base 292d7ad, 4 commits (e3bb4c8, 8d83177, 337f2cb, ffd3957). Reviewer 2026-11-10.

## Commands (run by the reviewer in the worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, added 559 packages, 16 advisories (14 moderate, 2 high), same as base |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 51 files, 1225 tests passed, 0 failed. Lines 96.6 (addon 100, server 99.31, shared 100, web 95.16), statements 95.68, branches 88.41, functions 94.38 |
| `npm run build -- --env dev` | Code.js 312.6 KB of 800 KB, index.html 316.2 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run lighthouse` | 10 views at 100: library, editor, history, admin, memberships, audit, usage, export and import, config, trash |

Probes: 2 scratch test files (14 cases) on a `git archive` copy with `setupWorld()`. Copy deleted after the run. No file under src/, test/, scripts/ or config was edited.

Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, github_pat, AKIA, xox, eyJ): 0 hits outside the handoff's own list of patterns. Emails added: only `@example.com` test addresses. URLs added: 0. `UrlFetchApp`, `fetch(`, `XMLHttpRequest`, `sendBeacon`, `console.*`: 0 added in src. appsscript.json, package files and `scripts/build.mjs` unchanged, so `inlineHtml` and scopes are unchanged.

## Blocker

1. `backup.restore` trusts the backup shape. `readBackup` casts parsed JSON `as BackupDocs` (src/server/storage/driveStore.ts:156-172); `backupRestore` writes it (src/server/handlers/config.ts:139-166). Probe: backup `index.json` = `{"schemaVersion":1,"rev":3,"items":[]}`. Restore answers ok and writes an index without `folders` and `grants`. Then `template.list`, `config.get` and a second `backup.restore` of a good date all answer INTERNAL: dispatch crashes in `folderMap` (src/shared/permissions/effective.ts) before the handler. Recovery needs a hand edit of `index.json` in Drive, which spec 16 rules out. Probe 2: `favorites.json` copy = `{}` writes `{ rev: null }`; `favorite.set` and `sidebar.home` then answer INTERNAL for every caller. Fix: validate the 3 copies before the lock (arrays `folders`, `grants`, `items`, `pendingAudit`; integer `rev`; objects `byUser`, `items`, `recent`) and answer VALIDATION "This backup cannot be read", index untouched. Add a test per file. Missing copies already answer NOT_FOUND with the index untouched (probe).

## Acceptance criteria

| # | Verdict | Reason |
|---|---|---|
| 1 | accept | `audit.query` merges month file and `pendingAudit`, duplicate IDs once (src/server/audit/query.ts:56-66), 50 rows, `id` returns one event. Drive: 1 list plus at most 1 read. Evt buffer events show after `tick`; the tab says so. |
| 2 | accept | `usage.report` (src/server/handlers/admin.ts:133-163): title, folder path, applies 30 d, last used. No addresses. Reads only. |
| 3 | accept with minors 1, 2, 3 | Validate writes nothing (probe: Drive files and `INDEX_REV` unchanged). Bodies through `prepareFor`, subjects through `oneLine` then SUBJ_TOO_LONG and PH_*. 5 MB, 200 templates, 100 folders on the server. |
| 4 | reject | Blocker 1. Rest accepted: admin re-check in the lock, `rev + 1`, event in `pendingAudit` of the restored index, revs published. |
| 5 | accept | 9 ops wired, `LATER_SLICE_OPS` gone. Policy rows: `export.folder` manage plus `folderArg`, other 8 admin (src/server/dispatch/policy.ts:87-96). Role matrix 9 x 6 in test/unit/server/adminReports.test.ts:182. Probe: use and manage callers get DENIED on all admin ops, both audit paths. |
| 6 | accept | Export holds subtree folders, in-scope grants, live templates only. `config.get` has no property outside the wireframe list. |
| 7 | accept | Probe: no `alert(1)` and no subject text in any log line after an attack import. |
| 8 | accept with minor 4 | Trigger: next run leaves 3 (test/unit/server/jobs.test.ts, slice 6a minor 4 test). Buffer cap 200, drops counted, one `audit.dropped` event per `tick`. |
| 9 | accept | Busy status texts, skeletons, toasts, `formatTime`. |
| 10 | accept | Lighthouse 100 on the 4 new tabs; drawer through `openDialog`. |
| 11 | accept with minor 7 | Smoke "Slice 6b", 10 steps. |
| 12 | accept | 10 scopes, bundles in budget, `inlineHtml` unchanged. Warm counts: see h. |
| 13 | accept | Green from a clean install. |

## Questions a to i

a. Import attack surface: accept, minors 1 to 3.
- `<script>`, `onerror`, `javascript:`: stored body is `<p>hi<img><a rel="noopener noreferrer" target="_blank">l</a></p>`.
- 2 MB body: failed "SIZE: Pasted HTML is too large". Subject CR, LF, U+2028: stored `a b c`, `subjectsFlattened` 1. 5,000-character subject: failed SUBJ_TOO_LONG. 5,000-character title: failed.
- 10,000 templates: VALIDATION "more than 200 items" before any read. Schema version 2 and missing: VALIDATION. Over 5 MB: VALIDATION. `[` nested 200,000 deep: "not a Migway export". Nesting under an extra key: accepted, the key is ignored.
- Folder names `../../etc`, `a/b\c`, `__proto__`, `constructor` are stored as plain names (names are not paths). 5,000 characters and blank: failed with reason. Cycle x and y: failed.
- `__proto__` as a JSON key: `items must be a list`. Prototype keys reach only `Map` and `Set`.
- Existing template ID and folder ID of another folder: new IDs, the existing item is byte-identical after import (probe). Nothing is moved or overwritten.
- Target: non-admin DENIED by policy; `""` VALIDATION; another user's private folder works for an admin (ADR-0003 C) and creates `kind: "shared"` folders inside that private tree (minor 3).
- Midway failure (3rd Drive create throws): index unchanged, 2 orphan body files for the 1 h cleanup, reply INTERNAL "Internal error" with no word on what was written (minor 1). Rerun imports all 5; a third run skips 5.

b. Export exposure: accept.
- Manage holder on `Mine` under `Top`: folders `Mine`, `Sub` only, root `parentId` blanked, no sibling or parent name. Grants: only those on `Mine` and `Sub` (own address and one other user on `Sub`), the same principals `grant.list` shows that holder; the inherited `Top` grant is left out. Deleted template absent. No version history, no `createdBy`.
- Offset is a plain integer, scope recomputed every call: offset -1 and 0.5 VALIDATION, 1e9 empty. A forged offset cannot leave the scope. 20 bodies per page (`EXPORT_PAGE`, src/server/handlers/transfer.ts:46).
- `export.library` leaves out private folders (D11). Accepted under D18 (seeing is not exporting). The admin is told by the label "Whole library (shared folders)" (src/web/views/adminTransfer.ts:110). Conflict for the architect: ADR-0002 lines 140 and 144 and spec 16 name import as the owner-change path. Private templates, all grants (import ignores them) and folders over 200 templates do not survive it. Not a 6b code defect; needs an ADR or slice 7 decision before an owner change.

c. `audit.query`: accept. Admin only on list and `id` paths (probe). Filters are substring and equality, no RegExp; `.*`, `__proto__`, `constructor` match 0 rows. Bad month, result, date: VALIDATION. Drawer JSON goes through `h("pre", ..., JSON.stringify(...))`, a text node (src/web/views/adminAudit.ts:37-48). Events carry item `subject` and `title` and body refs `{ version, fileId, sha256 }`, which fits ADR-0003 line 163. 10 MB month: 1 Drive read and a full parse per call when the text is over the cache; row bound 50 holds (minor 8).

d. `backup.restore`: reject (blocker 1). Admin only; `context.recheck` in the lock; one event in the restored index's `pendingAudit` (probe: 1 `backup.restore` row after restore); index rev and side revs published. Missing backup: NOT_FOUND, index untouched. Malformed JSON: INTERNAL, index untouched. Parseable wrong shape: library unusable (blocker). Risks named by the implementer, neither a blocker:
- Post-backup versions: history hides versions above `currentVersion` (src/server/handlers/history.ts:27-40); `cleanOrphans` trashes them after 1 h (src/server/jobs/daily.ts:149-161). They stay 30 days in Drive trash. Needs one dialog sentence (minor 5).
- Templates purged after the backup date point at trashed bodies. Needs a guard or warning: refuse dates older than the last `trash.purge`, or list affected templates in the confirmation (minor 5).

e. `config.get` returns: `domain`, `adminGroup`, `resolver`, `callerIdentity`, `indexRev`, `appVersion`, `indexBytes`, `indexWarnBytes`, `jobs[]` (`name`, `schedule`, `lastOk`, `status`, `lastError`), `triggersError` (src/server/handlers/config.ts:76-111). No `STORE`, no file ID, no `ADMIN_EMAILS`, no `OWNER_EMAIL`. The only address is the `ADMIN_GROUP` group, which the wireframe lists. Fits spec 16.

f. Usage: accept. Old entries without `days` read as 0 and nothing is written on read (`readSideCached`). `bumpDays` keeps 30 day keys per entry. Rows hold no user address.

g. Buffer and triggers: accept with minor 4. Probe: 260 denied calls fill 200 slots; the next apply is dropped with them, `dropped` 61, `tick` writes one `audit.dropped` row the admin sees. Change events go through `pendingAudit` in the index write and cannot be evicted. Trigger: test pins 4 after a failed delete, then 3.

h. Warm call counts: 1 Properties service call on warm `sidebar.home`, `search` and `template.apply` in production. test/unit/server/entry.test.ts:293-312 runs the real `createServices` path (`snapshotProps` over `meterProps`, src/server/runtime.ts:111-112) and pins `props: 1`, `cache: 8` and `6`, `drive: 0`. The implementer's 6 comes from test/fakes/world.ts:97, which meters the live fake with no snapshot, so it counts `getProperty` calls. No regression.

i. 5 MB upload: unverified on Apps Script. If `google.script.run` refuses the argument, the failure handler maps it to NETWORK, retryable, and the toast shows the platform message (src/web/rpc/client.ts:58-69). The server never runs, so nothing is written. 5 MB covers 200 templates at 25 KB each. Keep it until a smoke step with a 4.9 MB file shows the platform limit (minor 7).

## Minors

1. Import failure after some body writes answers "Internal error" with no word that nothing entered the library (src/server/handlers/transfer.ts:341-345). Catch around the body loop and answer "Nothing was imported. Run it again."
2. Duplicate folder IDs in a file create both folders; the first stays empty (src/server/transfer/plan.ts:116).
3. Import into another user's private folder creates `kind: "shared"` folders inside a private tree (src/server/handlers/transfer.ts:334).
4. A flood of 200 refused calls per 5 min drops apply events too; usage counts lose them, the dropped row does not split applies from denials (src/server/audit/buffer.ts:45).
5. Restore dialog does not say that versions saved after the date leave history in 1 h, and gives no guard for templates purged after the date (src/web/views/adminConfig.ts:102).
6. Restore writes side files after the index commit; a failure between leaves a mixed state (src/server/handlers/config.ts:160-166).
7. Smoke has no near-5 MB import step (docs/ops/smoke.md, Slice 6b).
8. A month file over the Script Cache is read and parsed on every audit call (implementer risk; 24 MB at 10x).
9. Export pages use offsets; a save between pages can repeat or skip one template (src/server/handlers/transfer.ts:107).
10. Spec 5.5 `days`, spec 6 status line and rows, spec 4.5 limits, ADR-0002 export `meta` fields are stale (implementer list).

## Result

FAIL on blocker 1. Retry scope: shape check of the 3 backup copies before the lock, one test per copy, plus minor 1 if cheap.
