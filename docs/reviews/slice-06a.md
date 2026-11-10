# Review: slice 6a (admin view: Folders and grants, Memberships, Trash)

Verdict: FAIL

Branch `slice/06a-admin-folders`, commits ad1980f, 7ebd41e, 5b7cdf0, 2b6b30f, base a7e5abb. Reviewed 2026-11-10.

Two blockers, both small fixes:

1. `grant.add` stores a principal key of any length. src/server/handlers/grants.ts:73 `principalKeyFor` checks format only. Probe: a `manage` holder on Quotes stored a 20,004-character `domain` key (`"a" x 20000 + ".com"`), result ok. A user key `"a" x 20000 + "@x.com"` passes the same regex. Every request then loads that key with the index, and the 3 MB index warning (wireframe 06 Config) can be reached by one manage holder. Criterion d asks for length bounds. Fix: a shared `PRINCIPAL_KEY_MAX` (254, the email address limit, fits domains and OU paths) checked in `principalKeyFor` and in the add-grant input; one test per type.
2. A refused `admin.folders` writes no denied audit row. src/server/handlers/admin.ts:34 throws DENIED inside the handler, after `dispatch` authorized the list op, so `recordDenied` (dispatch.ts) never runs. ADR-0003 Part C (docs/adr/0003-identity-and-permissions.md:144): "Denied requests return `DENIED` and write an audit row." Spec 11 (logging) does not require it; the ADR does. Probe: the log line has `result: denied`; the `evt:*` buffer gets nothing. The admin view entry is the probe a non-manager makes, so the audit log of 6b would miss exactly those. Fix: buffer the same denied event (op `admin.folders`, target `library`) before the throw, or let `dispatch` record a DENIED thrown by a handler; one test that asserts the buffered event.

## Commands (clean install, this worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | added 559 packages, audited 560; 16 advisories (14 moderate, 2 high), unchanged |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0, all files formatted |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 49 files, 1120 tests passed. Lines 96.54 (addon 100, server 99.31, shared 100, web 95.89), statements 95.62, branches 89.00, functions 94.18 |
| `npm run build -- --env dev` | Code.js 284.7 KB of 800 KB, index.html 301.4 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100, admin 100, admin memberships 100, trash 100 |
| New tests on a7e5abb src | 58 failed, 1058 passed (handoff says 57; same picture) |

Call counts (second, warm call, own probe): `admin.folders` props 4, cache 4, drive 0 (admin and manage holder); `membership.status` props 4, cache 4; `grant.list` props 4, cache 4; top-level `folder.create` props 8, cache 10, drive 2, lock 1. Same as the handoff.

The diff changes no appsscript.json, package.json, lock, approved-scopes or lint/ts/vitest config. scripts/ changes: lighthouse.mjs adds 3 views, dev-web.mjs adds route help text. Secret scan of 3,374 added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, github_pat, AKIA, xox, eyJ): 0 hits. Emails added: 12 fixture addresses on example.com and `sales@migway.com`, a placeholder hint for a role group (src/web/admin/model.ts, copied from wireframe 06), not a person. URLs added: none. New network calls: none (no fetch, UrlFetchApp, XMLHttpRequest, WebSocket, sendBeacon).

## Questions a to h

a. Privilege escalation: accept. Probe with Ana holding `manage` on Sales > Quotes only, through `handleRpc`:
- `grant.add` on Sales (above), Other (sibling), HR (other tree): DENIED each.
- `folder.move` Q1 into Other, Other into Quotes, Quotes or Q1 to top level: DENIED (`folderMove` targets folder, old parent, new parent; ROOT needs admin).
- `folder.create` top level: DENIED. `grant.remove` of a grant on Sales: DENIED.
- Bob's private folder: `grant.add`, `folder.rename`, move Q1 into it: DENIED (private level is owner `edit` only, effective.ts `privateLevel`).
- Unknown 26-character ID and `"__proto__"` as `folderId`: NOT_FOUND (lookups use `Array.find`). JSON `{"__proto__":{"folderId":...}}`: VALIDATION, the prototype key is not read.
- Removing her own `manage` grant: ok, after which `admin.folders` answers DENIED. The folder is not orphaned: admins hold `manage` on every folder (ADR-0003 Part C).
- Escalation inside her subtree is by design: a manage holder may grant `manage` on Quotes to anyone.

b. Move and delete: accept. Move Sales into its own grandchild: VALIDATION "cannot move into itself or its subfolders". Depth: L1 to L5 ok, L6 VALIDATION; moves check `chain(parent) + subtreeHeight` (folders.ts `checkDepth`). `FOLDER_DEPTH_MAX = 5` (src/shared/model/validate.ts:7) is acceptable: the ancestry walk and `placement` cost grow with depth, and 5 matches wireframe 06. Spec 5.1 needs the number (architect). Non-empty delete: VALIDATION. A folder holding only trashed templates deletes; the templates stay in the trash with `folderLive: false` and stay restorable to a picked folder; grants stay on the soft-deleted folder until the purge removes folder and grants together. Two managers: every write goes through `commit` with the in-lock `recheck`; a concurrent move changes `placement` (CONFLICT), a lost level is DENIED, stale `baseVersion` is CONFLICT (admin.test.ts "answers CONFLICT on a stale folder version"). Depth and cycle checks run on the index read inside the lock.

c. Exposure: accept with minor 1 and blocker 2. `admin.folders` for Ana returns only Quotes and Q1, `isAdmin: false`; fields are the `Folder` record she already gets from `folder.list` (`createdBy`, `updatedBy` of folders she manages). No private folder and no other address. Admin gets every live folder with private ones labelled. `membership.status` is admin only (DENIED for manage, role matrix). `grant.list` on Q1 returns the inherited grant on Sales with `carl@example.com` and `sourcePath: "/Sales"`. Carl holds `use` on Q1 through that grant, so the manager may see him (wireframe 06 shows inherited rows). The name "Sales" of a folder Ana cannot list reaches her (minor 1). Denied audit row: blocker 2.

d. Grants: reject on length (blocker 1), accept the rest. Group, user: email regex; domain: domain regex; OU: path with `/`, stored, shown `active: false`, and the resolver never yields `ou:` principals, so it grants nothing (D17). Group existence: `readGroupNow` through the resolver, VALIDATION when not ok. Duplicate principal on a folder: updates the level of the existing grant, with before and after in the audit event. Private folder: DENIED for non-admins at dispatch, VALIDATION for admins (`checkShareable`). `domain` grant by a manage holder: allowed by ADR-0003 ("Add or remove grants on folder subtree: manage"). `gmail.com` and `x@gmail.com` are stored (probe ok) but inert: `checkDomain` refuses every caller outside `DOMAIN`. Who reads the audit data today: nobody through the app; `audit.query` is still in `LATER_SLICE_OPS` (handlers.ts:39) and its policy row is admin. The owner can read `pendingAudit` in index.json on Drive. Log lines carry no principal (test "validates a group through the resolver and logs the folder, not the principal").

e. Trash: accept with minor 2.
- A caller sees deleted templates where they hold `edit`, resolved through deleted folders; admins also see templates of purged folders. Ana (edit on Sales) sees 0 items whose folder was purged.
- Restore re-checks `edit` on original and target in the lock (`restoreTargets`, recheck by placement).
- Restore into another user's private folder: DENIED for Ana; ok for an admin (minor 3).
- Restore into a deleted folder: NOT_FOUND (`liveFolder`).
- Purged folder, probed by removing the folder from the index: Ana restore DENIED (source ROOT), Ana restore to Sales DENIED, admin restore without target NOT_FOUND "This folder was removed or moved." (the UI shows the picker because `folderLive` is false), admin restore with a target ok.
- `trash.purge`: admin only (DENIED for manage, role matrix). One index commit with one `trash.purge` audit event per template and folder, actor the admin. The admin is re-checked in the lock. Drive trashing of body files runs after the commit, one `listBodies` plus one `trash` per version, unbounded (daily.ts:103, minor 2). A failure there leaves orphans for the daily cleanup; no data loss.

f. Membership refresh: accept. Admin only. GroupsApp reads run outside the lock, then `writeMerged` takes the lock once; `nestedAcquisitions` is 0 in every admin test. Work is bounded by the referenced groups (admin group plus grant groups), the same as the 15-min job. `prof:*` holds Directory sender values (src/server/directory/profile.ts:60), not group data, so a membership refresh need not clear it.

g. Q23: accept with minor 4. triggers.ts creates 3, then deletes the old set; a failed create deletes the new ones it made, keeps the old set, writes `job:triggers:lastError`, and leaves `TRIGGERS_VERSION` stale (jobs.test.ts 2 tests). After success, every pre-existing trigger is deleted, duplicates included, so 3 remain. `tick` calls `ensureTriggers` once at its end; no loop. `doGet` catches and logs the error.

h. Top-level `folder.create` re-check: accept. 2 extra property reads and 2 extra cache reads in the fake. In production `props` is the per-request snapshot (runtime.ts `snapshotProps`), so the property reads cost nothing; the 2 cache reads hit `gm:*` inside the lock. Limit: a change of `ADMIN_EMAILS` during the request is not seen (snapshot), a change of the admin group membership is.

## Acceptance criteria

1. Accept. Server decides through `admin.folders`; the manage holder gets 2 folders and no tab data of Memberships.
2. Accept except blocker 1.
3. Accept. Counts and child groups, no member addresses (test "reports counts and child groups, never member addresses").
4. Accept. `trash.purge` left `LATER_SLICE_OPS`.
5. Accept. Admin view hides Subfolder, Move, Delete and the grant form on private folders.
6. Accept except blocker 2. 12 ops x 6 roles; each DENIED asserts drive 0 and an unchanged index. `admin.folders` reads the index (cache) before it can decide, as every list op does.
7. Accept (g).
8. Accept. `folder.rename` uses `folderLabel`; stale `search.body` failure returns before the toast; "Searching text..." in the status region and `aria-busy` on the list.
9. Accept. Skeletons with `aria-busy`, DENIED banner, CONFLICT, NOT_FOUND, busy status.
10. Accept. Tablist with roving tabindex, Left, Right, Home, End; Lighthouse 100 on admin, admin memberships, trash; views added to `npm run lighthouse`.
11. Accept with minor 1.
12. Accept. Grant log lines carry no principal.
13. Accept. docs/ops/smoke.md "Slice 6a", 10 steps, step 8 is DoD 3.
14. Accept. 10 scopes, bundles in budget, appsscript.json unchanged, warm call counts of sidebar.home, search, template.apply unchanged (handoff table; own probe matched the new ops).
15. Accept. Green from a clean install.

## Minors (do not block)

1. `grant.list` `sourcePath` (grants.ts:49) shows names of ancestor folders the manager cannot list. Wireframe 06 shows the source, so the architect decides whether the name or "a parent folder" is shown.
2. `trash.purge` trashes body files in one unbounded loop after the commit (daily.ts:103). Large trash can approach the 6-min limit; the orphan cleanup finishes the rest.
3. An admin can restore a template into another user's private folder (templates.ts:433). ADR-0003 allows admin `manage` there; the picker could leave other users' private folders out.
4. A failed delete of an old trigger (triggers.ts:44) leaves 6 triggers until the next run, so jobs can run twice; the 20-trigger limit bounds growth. A throw in the cleanup loop (triggers.ts:41) hides the original error.
5. Spec 6 lacks rows for `admin.folders` and `membership.status`; spec 5.1 lacks the depth number; spec 6 status line still lists `template.restoreFromTrash` as a stub.
6. Web coverage of trash.ts and memberships.ts error branches is 80 to 87 percent lines.

## Retry checklist

- Blocker 1: `PRINCIPAL_KEY_MAX`, server check and input `maxlength`, tests per principal type.
- Blocker 2: denied audit event for a refused `admin.folders`, test on the `evt:*` buffer.
- Rerun all commands above.
