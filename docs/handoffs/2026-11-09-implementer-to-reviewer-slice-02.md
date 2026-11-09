# Handoff: implementer to reviewer, slice 2 (data and permission layer)

Branch `slice/02-data-permissions`, based on bcfe8e9 (orchestrator branch head). 4 commits: fdb6122 (shared logic), 468d6a4 (server layer), 1e1590c (docs), plus this handoff. Not merged.

Rebase: rebased onto origin/claude/gracious-franklin-3n8zbq at c84cc7e (10 default scopes, add-on client follows the 302 by hand). One conflict, docs/ops/deploy.md step 8: kept the slice 2 text with 10 scopes. Manifest keeps the 10 scopes plus the 2 Drive REST whitelist prefixes. Results below are after the rebase.

## Done, per acceptance criterion

1. `src/shared/permissions/`: `principals.ts` (principal set, admin from `ADMIN_EMAILS` or `ADMIN_GROUP` snapshot), `effective.ts` (max level over ancestors, admin = `manage` on every existing folder, private tree: owner `edit`, grants ignored), `levels.ts`, `matrix.ts` (`ROLE_MATRIX`, 17 rows as data, `checkNeed`; `ROOT` target needs admin). Test: 68 matrix cells, plus inheritance, move (source and target), private folder and cycle cases.
2. `src/server/dispatch/policy.ts`: 40 rows = 36 ops of spec section 6 + `ping`, `profile.me`, `spike.s2`, `spike.s2b`. Each row names a matrix action, a target resolver (`targets.ts`) and a surface (`web` ops refused from the add-on). `dispatch` checks caller, domain, row, handler, then resolves targets and denies before the handler; denials go to the `evt:*` buffer. 19 later-slice ops answer `NOT_IMPLEMENTED`. Completeness tests: handlers equal policy keys; policy keys equal the spec list; every level row has targets except the 5 filtered list ops.
3. Entry hardening: `src/shared/entryPoints.ts` allowlist (11 exports, 4 surfaces); test fails on any export not listed. `src/server/guards.ts`: trigger guard, setup guard, `requireDomain`; `src/addon/guard.ts`: add-on callbacks refuse unless active user equals effective user. ADR-0003 Part C "Enforcement mechanism" revised (status Accepted, revision note in the status line and the paragraph).
4. Storage: `port.ts` (the 10 listed methods plus `readIndexRev`, `listBackups`, `listAuditFiles`), `driveStore.ts`, `advancedDrive.ts`, `restDrive.ts` (`DRIVE_CLIENT=rest`), `setupStore.ts` (`ensureStore`, saves `STORE` after each of 8 steps). `index.json` carries `rev` in its appProperties. Fake Drive: `test/fakes/drive.ts`.
5. Cache: `cache/chunked.ts` (90 KB UTF-8 byte chunks, `prefix:rev:n`, `prefix:meta`, one `getAll`), `cache/indexCache.ts` (`INDEX_REV`, rebuild under `tryLock(10000)`, `miss` when the lock is busy). Re-put after 5 h in `jobs/tick.ts`.
6. Write path: `storage/writer.ts` (`mutateIndex`, `commitLocked`), `handlers/templates.ts`, `folders.ts`, `grants.ts`, `versions.ts`. Body file before the lock; writer uses the cached index only when its `rev` equals the file's appProperties `rev`; CONFLICT details `{ currentVersion, updatedBy, updatedAt }`. Sanitize port in `Services.sanitize`, identity default in `runtime.ts`.
7. Membership: `membership/resolver.ts` (`groupsapp_direct`; `directory`, `cloud_identity` throw `NOT_CONFIGURED`), `membership/snapshot.ts` (G = admin group + grant groups, `members.json` and `gm:*`, nested warnings, failed groups keep old members, `refreshGroup` for a new grant group).
8. Audit: `audit/events.ts` (Part D schema, 40 KB cap), `buffer.ts` (`evt:*` under `tryLock(500)`), `roll.ts`, `lines.ts` (appends skip known IDs), `usage.ts`; jobs `tick.ts`, `daily.ts` (roll, purge 30 d, orphans 1 h, backup keep 14, audit keep 24 months), `health.ts` (`job:<name>:lastOk`/`lastError`), `triggers.ts` (`TRIGGERS_VERSION` "1", reinstall on the first web app or doPost request).
9. `directory/profile.ts`: `AdminDirectory.Users.get(email, { viewType: 'domain_public', projection: 'basic' })`, ADR-0004 mapping, `prof:<email>` 6 h, failures not cached. Op `profile.me`.
10. Logger: every request and job writes one line with `cache` (`hit`, `miss`, `rebuild`, or empty for ops without the index). Redaction test sends a body, a prompt value and a recipient address and asserts none reaches the log.
11. `spike.s2` and `spike.s2b` (admin only; s2b web only). Sheets: docs/spikes/slice-02-s2.md, docs/spikes/slice-02-s2b.md.
12. 21 test files, 385 tests. All slice 1 tests kept or ported to the new signatures (dispatch, handle, entry rewritten for the `Services` world).
13. docs/ops/smoke.md "Slice 2" (11 steps); docs/ops/deploy.md step 8 rewritten. Slice 2 adds no scope; the manifest has the 10 from the base branch.

## Decisions the reviewer should check

- Op names follow spec section 6 (`template.*`). The task's `item.list/get/create/update/move/delete/restoreFromTrash` map to `template.list/get/create/update/move/delete/restoreFromTrash`.
- Trigger guard is stricter than the task text. "Effective user equals the owner" alone proves nothing: through `google.script.run` the web app runs as the owner for every caller. Rule: effective user = `OWNER_EMAIL`, and either active user = owner, or active user blank and `e.triggerUid` matches a project trigger with the same handler name. A real `triggerUid` sent by another user is refused (test).
- `doGet` also requires the domain, so before `setup` the web app shows the "Cannot identify" page and every op answers `AUTH_DOMAIN`.
- `manifest urlFetchWhitelist` gains `https://www.googleapis.com/drive/v3/` and `https://www.googleapis.com/upload/drive/v3/` for the REST fallback (ADR-0002 named `https://www.googleapis.com/`; these 2 prefixes are narrower). No scope change.
- `template.update` accepts `folderId` (spec 4.2) and checks `edit` on source and target.
- `folder.list` creates the caller's private folder ("My templates") on first use (D11), so this read op may write once per user.
- Grants are one per principal per folder; adding again changes the level.
- `setup` seeds `ADMIN_EMAILS` with the owner when empty.

## Verified (2026-11-09, Node 22.23.4, after `rm -rf node_modules dist coverage`)

- `npm ci`: "added 427 packages, and audited 428 packages in 7s".
- `npm run lint`: exit 0, 0 problems.
- `npm run format:check`: "All matched files use Prettier code style!"
- `npm run typecheck`: exit 0.
- `npm run test:coverage`: "Test Files 21 passed (21)", "Tests 385 passed (385)". Statements 99.15% (1402/1414), Branches 94.15% (644/684), Functions 100% (477/477), Lines 99.45% (1279/1286). Lines per area: shared 100%, server dirs 97.43% to 100%.
- `npm run build -- --env dev` and `--env prod`: "Code.js: 100.9 KB of 800 KB", "index.html: 1.5 KB of 400 KB", expected execUrl warning. `dist/Code.js` has 11 top-level stubs, equal to `ENTRY_POINTS`.
- `npm run scopes:check`: "Scope check passed: 10 scopes, all approved."
- Secret scan of the diff: 0 hits for key, token and secret patterns; emails only `@example.com`, `@other.com`, `@b.com`.
- Not verified: anything against Google. Advanced Drive on `drive.file`, the `alt: 'media'` return type (code accepts string, byte array or blob), GroupsApp and AdminDirectory behaviour, trigger `triggerUid` values, lock re-entrancy (code never nests; fake counts nested acquisitions, tests assert 0).

## Left for later

- Body cache `body:*`, side caches `fav:*`, `use:*`, search text `ft:*` (slices 4 and 5).
- `membership.refresh` does not clear `prof:*` (ADR-0004 says it should); slice 6 with the admin UI.
- Audit reader that drops duplicate IDs (`audit.query`, slice 6). Appends already skip known IDs.
- Placeholder parsing (`placeholders`, `prompts` stored as `[]`) and the sanitizer: slice 3.
- `version.*`, `favorite.*`, `trash.purge` op, export, import, backup restore, config: slices 3 to 6 (policy rows exist).
- OU principals: stored, never in a principal set (`groupsapp_direct` has no org units).
- Folder purge removes a folder whose trashed items are younger; those items then show in no list and are purged later.

## Risks

- Drive multipart uploads are documented up to 5 MB; an index above 5 MB (about 6,000 items) may fail to write. ADR-0002 already splits the index at 3 MB. Spike S2b 10x records the real behaviour.
- `getActiveUser` inside time-driven triggers: code accepts the owner or blank; any other value refuses the job. If Google returns something else, jobs stop and `lastError` stays empty (refusal happens before `runJob`), but the log line has `result: denied`.
- Every request with a level check parses the whole index (0.85 MB at 1x) and the snapshot. Within the ADR-0002 budget; spike S2b and slice 4 measure.
- 2 inline ESLint disables in `test/fakes/world.ts` (`no-unnecessary-type-parameters` on the typed `ok<T>` helper).
- `npm audit`: 3 advisories in clasp's dev-only tree (unchanged from slice 1).

## Files touched

- New: src/shared/{ids.ts, text.ts, entryPoints.ts, model/data.ts, model/validate.ts, permissions/*.ts}; src/addon/guard.ts; src/server/{services.ts, lock.ts, guards.ts}; src/server/{audit,cache,directory,membership,storage,jobs,handlers}/*.ts; src/server/dispatch/{args,context,targets}.ts; test/fakes/{drive,groups,world,globals}.ts; 9 new test files; docs/spikes/slice-02-s2.md, slice-02-s2b.md; this handoff.
- Changed: appsscript.json (urlFetchWhitelist), src/shared/errors/codes.ts, src/addon/entry.ts, src/server/{entry,runtime}.ts, src/server/dispatch/{dispatch,handle,handlers,policy}.ts, test/fakes/{lock,output}.ts, 6 existing test files, docs/adr/0003, docs/ops/{deploy,smoke}.md.
- Deleted: 7 `.gitkeep` placeholders in folders that now hold code.

## Commands

```sh
rm -rf node_modules dist coverage && npm ci
npm run lint && npm run format:check && npm run typecheck
npm run test:coverage
npm run build -- --env dev && npm run build -- --env prod && npm run scopes:check
```
