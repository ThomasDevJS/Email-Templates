# Review: slice 13, last fix round

## Final verdict (retry 2, head c96a38b): PASS

No export data leaves the server without a committed start event. The start commits one `export.*` event into `pendingAudit` through `commit` (lock, recheck, index write) and only then issues a run token; every page needs that token for the same caller and scope, and the dispatch permission check still runs first. The 1,000-template cold export keeps its event and writes 0 `bd:*` entries. All 13 items that passed earlier still pass. Minor gaps are listed under "Retry 2". Merge.

## Retry 1 verdict (head f3f8156): FAIL

A cold library export of 1,000 templates (the brief's stated size) returns all 50 pages and stores 47 of 50 page events. The export's own `bd:*` body cache writes evict its first `evt:*` entries from the 1,000-item Script Cache before `tick`; `audit.dropped` stays 0. See "Retry 1" below. The first review follows.

Date: 2026-11-11. Branch `slice/13-fix-round`, base 8f6c972, head 3ca3920 (13 commits). Reviewer.

## First review verdict: FAIL

Item 6 (export audit event) does not hold. A caller skips the event with `offset` 1. A busy buffer lock or a buffer full of applies loses it while the export still answers ok. The other 13 items pass.

## Must fix

1. `src/server/handlers/transfer.ts:129` records the event only when `offset === 0`. `offset` is any client integer (`optInt`). Probe: `export.library` with `offset: 1` and `offset: 21` on 25 templates returned 24 templates plus the header (folders, grants) and wrote 0 export events after `tick`. The template at index 0 is readable through `template.get`, so the exporter evades the audit fully.
2. `src/server/handlers/transfer.ts:165` ignores the result of `bufferEvent`. Probe with the script lock held elsewhere: export ok, 0 events, `evt:dropped` 0. Probe with 200 buffered applies: export ok, event dropped (counted 1). ADR-0002 line 128 lists export among the security events that enter `pendingAudit` with their change; a lost export event is not acceptable.
   Fix for 1 and 2: write the event on every page call, with `offset` in `after`, and refuse the page (BUSY, retryable) when the event cannot be stored. Either keep the buffer and refuse on `false`, or commit the event into `pendingAudit` through `commitLocked` (ADR-0002 line 128 route; one index write per page of 20). A test: offset 1 writes an event; lock busy and buffer full refuse the page.

## Minor

3. `src/server/handlers/config.ts:302`: a tab loaded before the deploy sends `from` and gets "Setting personalTemplates takes on or off." The text gives no reload hint. No data is written (probe: index unchanged). Fix: when `from` is present answer "This page is out of date. Reload it and save again."
4. `src/server/handlers/transfer.ts:486`: the in-lock recipient re-check refuses the whole import ("Nothing was imported: the library could not be written: 1 problem to fix. Run the import again."). Under `deny` before the lock, spec 5.7 line 264 drops the address and imports. Safe; text and outcome differ from the normal path.
5. `src/server/audit/buffer.ts:62`: an event lost to a busy 500 ms lock is not counted in `evt:dropped` (all kinds, pre-existing). "Every drop is counted" holds for full-buffer drops only. Probe: 250 denied plus 30 applies gave `dropped` 80, exact.
6. Buffer order is denied < apply = change. A buffer full of applies drops the export event (probe). (opinion) Change events should rank above applies; fix 2 makes this moot.
7. `docs/ops/smoke.md:139` still says "Script Property `RECIPIENTS_EXTERNAL` unset". Confirmed for the orchestrator.
8. The handoff lists 11 spec and ADR passages now untrue (ADR-0008 lines 36, 38, 54, 57; spec 302, 350, 363, 443, 575, 577, 578, 695, 719, 757; ADR-0003 lines 103, 185, 187, 201, 208; ADR-0002 lines 100, 101, 128, 129). All checked against the code, all correct. Architect.

## Judgements

a. Item 1: accept. `config.ts:327` compares `updatedAt` and `updatedBy`. Two-admin probe A, B, A: the stale save gets CONFLICT with `details { value: "off", updatedAt, updatedBy }`, index unchanged. Future `baseAt`: CONFLICT. Forged `baseBy`: CONFLICT. Missing base, 255-char base, old `from`: VALIDATION, no write. Correct marker: saved. Non-admin: DENIED with no details (policy `admin.ops`, before the handler); a non-admin learns nothing. Name echo: 40 code points (`echoName`). Old-tab text: gap 3.
b. Item 2: accept. `recheckRecipients` (body.ts:125) runs in the lock in create and duplicate (templates.ts:351), update (templates.ts:391), version restore (history.ts:144), import (transfer.ts:486). Create, update, duplicate and restore answer the save's own VALIDATION with `RCPT_EXTERNAL` (races.test.ts, 3 tests). A save with inside addresses only under `deny`: ok (probe). Import text differs: gap 4.
c. Items 6 and 7: reject item 6 (gaps 1, 2). Event content accepted: actor, `targetId`, `targetPath`, `after { scope, templates }`, no title, subject, body or address (adminReports.test.ts). Item 7 accepted: a denied flood cannot evict apply or change events; count exact under the lock; applies do not evict changes and the reverse (gap 6).
d. Item 5: accept. `stats.target` (dispatch.ts:166) comes from the target resolvers, which return folder IDs found in the index or ROOT (filtered). `targetId` is an ID or "". `folder.create` under a parent now logs the parent ID. No address, title or setting value reaches the line.
e. Item 8: accept. `prof:<sha256 hex>` (profile.ts:61). Other keys: `idx*`, `gm*`, `fav:*`, `use:*`, `evt:*`, `bd:`, `ft:`, `aud:`, `job:`, add-on `view*`, `body:<templateId>`: none holds an address. No salt needed: CacheService has no key listing, and only script code reads keys; that code reads the directory anyway. Old keys are never read and expire in 6 h.
f. Item 12: accept. `listed` (templates.ts:77) adds `recipientsOf` after the `use` filter only. `search` (sidebar) passes no `addresses`; `score` falls back to `termsScore`. Payload bound: 10 per field, 20 per template (`RCPT_TOTAL_MAX`), 254 characters each.
g. Item 11: accept. `editableFolders` keeps level edit or above; a private folder is at `use` while personal templates are off. Chromium: options HR, My templates, Sales, Sales / Onboarding, Sales / Quotes; focus on the select, Tab to Create then Cancel, Escape back to the opener; Create opens `#/new?folder=F-EMPTY`. Nowhere to create: no button (app.test.ts). An admin with personal on also sees others' private folders: ADR-0003 C, accepted.
h. Items 9 and 10 (Chromium 1243, dev harness): accept. Outside click on the folder dialog and on the audit drawer: focus stays on the opener. Back with the folder dialog, Forward with the Empty trash dialog, Back with the audit drawer: 0 dialogs, 0 `[inert]`, 0 `aria-hidden`, focus on `main`. Settings: confirm dialog opens on Cancel; after Save focus is on the status line. Forced CONFLICT (patched harness): "Allowed" checked, "b.admin changed this setting on Nov 11, 9:00 AM. The page now shows the current value.", focus on the status line.
i. Item 3 (config.ts:239 `liveSettingsKept: true`), item 4 (daily.ts:147, web "The 1 template in it is" seen in Chromium), item 13 (home.ts:124 `Array.from`), item 14 (smoke.md:145-146): accept. Line 139: gap 7.
j. Scope: accept. No change in src/web/editor/, views/editor.ts, history.ts, preview.ts, problems.ts, tags.ts, styles.css, appsscript.json, package files, scripts/. dialog.ts: +14 -1, two local hunks.
k. Checks: all pass (below). Secret scan: 0 hits in added lines (the only match is the handoff's list of patterns). Addresses added: example.com, other.org, client.example fixtures; `ops@migway.com` and `buyer.two@migway.com` in test/unit/web/logic.test.ts:265-266 are invented role addresses on the company domain. URLs added: none. No new network call. Scopes unchanged.

Tests that fail on old code: the head test tree on base 8f6c972 gives 408 failed of 1698 (most from the changed `setSetting` fake); the new emoji echo and `grant.remove` targetId tests are among them.

## Commands (worktree, clean install)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, 559 packages, 16 audit findings (unchanged) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 64 files, 1698 passed. Lines 96.73 (addon 100, server 99.31, shared 100, web 92.16) |
| `npm run build -- --env dev` | Code.js 356.0 KB of 800, index.html 361.1 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 14 of 14 views at 100 |

Probes: scratch copy with test/unit/server/probe13.test.ts (config.set, export offset, busy lock, full buffer, flood counts) and a Playwright script against `node scripts/dev-web.mjs`; both deleted from the worktree view (scratchpad only).

## Retry 1

Date: 2026-11-11. Diff `acf07ee..f3f8156` (5 commits, 18 files, +536 -62). Reviewer.

### Verdict: FAIL

Must-fix 1 and 2 hold for the lock and the buffer count. They do not hold for the cache: an export event that entered the buffer can be evicted after its page returned data.

### Must fix

1. `src/server/handlers/transfer.ts:120` stores the page event in the Script Cache, then `readStoredBody` (`src/server/handlers/body.ts:91`) puts one `bd:*` entry per uncached body. The Script Cache holds 1,000 items, oldest first out (ADR-0002 line 19, ADR-0005 line 108, `test/fakes/cache.ts`). Probe (cold cache, 7 h after the saves, page by page, then `tick`): 300 templates: 15 of 15 events stored. 600: 30 of 30. 1,000: 47 of 50 stored, 1,000 templates returned, `dropped` 0. The 3 lost events are pages at offsets 0, 20 and 40 (probe), so the audit log has no record of templates 1 to 60. At 10x most events go. Spec 11.1 line 575 says change events are never dropped.
   Fix options, cheapest first: (a) the export reads bodies without `cacheBody` (stops self-eviction; other traffic can still evict within 5 min, the Q14 risk accepted for applies only); (b) when the buffer holds change events, flush them to `pendingAudit` from the export call itself every k pages; (c) the ADR-0002 line 128 route: `commitLocked` per page (one index write per 20 templates). A test: 1,000 templates, cold cache, every page event in `pendingAudit` after `tick`.

### Minor

2. `src/server/audit/query.ts:148`: the joined row keeps the first page's ID, so the Details drawer opens page 1 only (`after` says 20 templates while the row says all 25). The other page events are in the month file and unreachable in the UI.
3. `src/server/audit/query.ts:137`: two interleaved exports by one admin (two tabs) pair wrongly. Probe: rows "all 25", "1 to 20 of 25", "21 to 25 of 25". Different admins never join (key holds the actor); two sequential exports stay two rows.
4. `src/server/audit/buffer.ts:118`: `evt:lost` undercounts when it expired after 6 h with no loss and at least `evt:lostSeen` new losses arrive before the next `tick`. Plus the documented same-instant race (line 78). Normal case exact (probes 7, 3; flood 81).
5. `src/server/audit/buffer.ts:49`: `weakerSlot` skips evicted keys, so with `evt:meta` at 200 and evicted slots a change event answers BUSY while room exists. BUSY only, no loss.
6. A `manage` holder can fill the 200 slots with cheap `offset: 1e9` calls (no body read), evicting buffered applies (counted) and refusing every export for up to 5 min. Each call is itself audited.
7. `src/web/views/adminTransfer.ts:19` says "Try again in a minute"; a full buffer clears only at `tick`, every 5 min (`src/server/jobs/triggers.ts:22`). The handoff Risks line says 1 minute.
8. Docs for the architect: spec 575 and 578, ADR-0002 line 128, ADR-0003 lines 185 and 208 describe the old export event. Listed in the handoff.

### Judgements

a. Offsets (server probe, 25 templates): absent, 0, 1, 21, 24, 25, 26, 1e9, 2^53-1, 1e300: each ok call stored exactly 1 event, `after { scope, offset, templates, total }` (offset 1: 20 of 25; 21: 4; beyond the end: 0). -1, 1.5, "1", null, NaN, Infinity, true, [1]: VALIDATION, no data, no event. `limit`, `pageSize`, `size`, `count`, `max` 1000: 20 items. No event holds a title, subject, body or grant address; the actor is the exporter.
b. Roles: folder export as `manage` holder writes its event; library export as `manage` holder: DENIED, no data, no change event. Interleaved pages of 2 callers, 12 calls: events = ok calls, all in `pendingAudit` after `tick`. Real concurrency: `bufferEvent` writes under the script lock, so pages serialize or answer BUSY.
c. Lock busy: BUSY, `retryable`, no body in the answer, no event. Full of changes: BUSY, `dropped` unchanged. Rank: 198 changes + 1 apply + 1 denied, export takes the denied slot, the next export the apply slot, the third is BUSY; `dropped` 2, then an apply into the full buffer makes 3. 250 denied + 30 applies + 1 export: 200 events, 30 applies kept, `dropped` 81. Busy-lock losses: 5 applies + 2 denied give one `audit.dropped { dropped: 7 }`; next tick none; 3 more give 3.
d. Item 3 (4,000-template limit): 200 page calls fill the buffer and call 201 answers BUSY until `tick` (probe). At 1,000 templates (50 pages) the buffer never fills. Accept for v1 on its own: BUSY loses no data. It is moot until must-fix 1 is fixed, because eviction starts at about 1,000 body puts.
e. Web export (Chromium 1243, dev harness): `failTimes=2`: done in 613 ms (waits 200 + 400), 1 file. `failTimes=3`: 1,228 ms, 1 file. BUSY always: stops after 1,225 ms with "The export stopped: the server was too busy to record it in the audit log. Nothing was downloaded. Try again in a minute.", 0 `createObjectURL`, 0 download clicks, no toast, Export enabled. The download runs only after the last page (`adminTransfer.ts:135`), so a mid-export BUSY offers nothing (code read; the harness has 4 templates, 1 page).
f. Audit join: sequential exports by one admin stay 2 rows; a partial export reads "templates 1 to 20 of 25"; an offset-1 export reads "templates 2 to 25 of 25"; an `actor` filter keeps total = rows. A month filter splits an export at the month edge (handoff Risks).
g. Minor 3 (`config.set` with `from`): "This page is out of date. Reload it and save again.", index settings unchanged (settings.test.ts, 2 cases). Smoke: one sentence replaced ("Admin, Config, Settings, Outside recipients: allowed."), rest of the paragraph identical (`git diff acf07ee..HEAD -- docs/ops/smoke.md`, 1 line).
h. Regression (Chromium, dev harness): folder dialog opens with focus on the select (HR, My templates, Sales, Sales / Onboarding, Sales / Quotes); outside click and Escape close it with focus on New template; Back closes it, 0 `[inert]`, focus on `main`; Create opens `#/new?folder=F-EMPTY`. Trash: confirm "The 1 template in it is removed for good", focus Cancel; outside click returns focus to the opener; Empty trash gives "Emptied the trash: 1 template removed for good.", focus on the h1. Settings conflict: unit tests pass (Chromium needs a patched harness; first review covered it, no settings UI change since).
i. Scope: retry changes nothing in src/web/views/editor.ts, src/web/editor/, history, preview, problems, tags, src/web/ui/dialog.ts, styles.css, appsscript.json, package files, scripts/.
j. Secret scan of added lines: 0 keys or tokens. Matches: "Secret" fixture strings in tests, `someone.else@example.com`, `a@example.com`, the smoke.md migway.com role addresses (unchanged sentence context). URLs added: none. No new network call. Scopes unchanged.

### Commands (worktree, clean install)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 64 files, 1706 passed, 0 failed. Lines 96.78 (addon 100, server 99.31, shared 100, web 92.2) |
| `npm run build -- --env dev` | Code.js 358.3 KB of 800, index.html 361.7 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 14 of 14 views at 100 |

Probes: scratch copy (`git archive HEAD`) with test/unit/server/probe13r.test.ts (28 tests, all pass), probe13evict.test.ts (1,000 templates: expected 50 events, got 47) and puppeteer-core scripts against `node scripts/dev-web.mjs`. Nothing added to the worktree.

## Retry 2

Date: 2026-11-11. Diff `d0f00be..c96a38b` (7 commits, 18 files, +609 -448). Reviewer.

### Verdict: PASS

### Minor (no merge block)

1. `src/web/views/adminTransfer.ts:19`: "the server did not answer after 4 tries" is shown for BUSY and INTERNAL too, where the server did answer. Suggested: "the server was busy or failed 4 times".
2. `src/web/views/adminTransfer.ts:114`: a start retried after a NETWORK error whose commit had landed writes a second start event. The log over-reports intent; it never under-reports.
3. `src/web/admin/actions.ts:35-36`: "Library export started, 25 templates" does not read as "completed". Nothing in the Audit log says the download may have been partial or abandoned (opinion: one hint line under the table, or "(download not recorded)" in the Details drawer).
4. `src/server/runtime.ts:124`: the token is `newId()`, 26 characters, 16 of them random from `Math.random` (80 bits, not a CSPRNG). Harmless here: the cache entry binds the token to the actor, so a guessed or stolen token of another user is refused (probe).
5. `src/web/views/adminTransfer.ts:122`: progress uses the start's `total`; a page computes the live total. A save during the export can make the text and the file count differ; offsets can shift (pre-existing).
6. First review minor 4 (in-lock recipient re-check refuses the whole import) stays open, as the handoff says.
7. Docs for the architect: the handoff's "Spec and ADR sentences now untrue" list (spec 11.1 lines 575 and 578, 13.5 line 719, 4.5 line 133; ADR-0002 lines 19, 128, 139, 200; ADR-0003 lines 185, 208) checked against the code: correct. The handoff lists `views/adminAudit.ts` as touched; it is unchanged in this diff (no effect).

### Judgements per check

1. No data without a committed start. Server tests plus probe `probe13r2.test.ts` (scratch copy, 5 tests pass). Refused with VALIDATION `EXPORT_RESTART`, no body in the answer: no token at offsets 0, 1, 21, 25, 1000; empty, malformed and unknown tokens; another user's token; library token on a folder page; folder A token on folder B; expired token and replay after expiry; evicted token. With a valid token offsets 1, 21 and 25 give 20, 4 and 0 items. Lock busy at start: BUSY, retryable, rev unchanged, 0 events, 0 `exp:*` keys. Drive `update` fails at start: INTERNAL "Internal error", retryable, rev unchanged, 0 events, 0 `exp:*` keys. The start event is in `pendingAudit` right after the call and in the month file after `tick` (pending 0, 1 file holds its ID). Fields: actor, actorRoles, surface, action `export.folder`, targetType folder, targetId, targetPath "/Sales/Quotes", before null, `after { scope, templates }`, result ok, requestId, appVersion. No title, subject, body or other address.
2. 1,000 templates, cold cache (5 imports, clock +7 h): 1,000 items, 0 `bd:*` puts, event present before and after `tick` (test and probe). 300 other entries put before the run: 300 survive. `readStoredBody(…, false)` at `transfer.ts:209`.
3. Permissions per page: dispatch policy runs before `checkRun`. `manage` holder: own subtree only; HR start and page DENIED; library start DENIED. Library export leaves out the private folder ("PrivNote" absent). Grant removed after page 1: page 2 DENIED, no body. Demoted to edit with a valid token: DENIED.
4. Token hygiene: the token is absent from every log line, every Drive file (index, month file) and every error answer (probe searched all). Cache value `{"actor","kind","folderId"}`, no content. 10 starts at 1,000 templates add 70 cache keys: 10 `exp:*` plus 60 `idx*` chunks of the new revs, the same cache cost as 10 saves. Each start holds the lock for one index write (about 1 s), so one admin makes at most about 600 starts per 10 min, each audited. Bulk eviction needs about 140 starts at this size; a save flood by any edit holder does the same today. No per-user limit for v1 (opinion).
5. Cost: one Drive index write per export run (plus the `idx` chunk puts), versus 0 in slice 12 and 1 per page in retry 1. Busy lock degrades to BUSY retryable with no token; the web retries 3 times.
6. Audit words (unit tests, adminActions.test.ts:78, 85): "Library export started, 25 templates", "Folder export started: Sales / Quotes, 1 template". Details drawer in Chromium: opens with focus in the drawer, Escape returns focus to Details, Back closes it with 0 `[inert]`. The dev harness has no export row, so the export row was not seen in Chromium. Removed names: `joinExportPages`, `exportPageOf`, `ExportPageCounts`, `exportPageText`, `recordExport`, `EXPORT_BUSY_TEXT`, `lostSeen`, buffer kind "change": 0 hits in src and test.
7. Buffer (`probebuf.test.ts`): 250 denied + 30 applies: 200 kept, 30 applies kept, dropped 80. Full of 200 applies: denied refused (counted), apply refused (counted). Two evicted slots: the next denied and the next apply take them with no count; the following apply takes the denied slot (counted); dropped 3. Busy lock: 5 applies + 2 denied give dropped 7, `evt:lost` "7 0"; after `clearBuffer` "7 7", dropped 0; 3 more give "10 7", dropped 3. One `evt:lost` key only.
8. Web export (Chromium 1243, dev harness, `failOp=export.library`): no failure: 1 file. Start BUSY 3 times: 1 file. Start BUSY always: retry text, 0 `createObjectURL`, 0 downloads. Page NETWORK 3 times (`failSkip=1`): 1 file. Page INTERNAL always: retry text, 0 files. Page VALIDATION: stops at once, 0 files. Start DENIED: access text, 0 files. Progress text "Exporting N of T templates..." is unit-tested only (harness has 4 templates, 1 page).
9. Regression (Chromium): folder dialog options HR, My templates, Sales, Sales / Onboarding, Sales / Quotes, focus on the select; outside click closes it with focus on New template; Back closes it, 0 dialogs, 0 `[inert]`, focus on `main`. Trash confirm "The 1 template in it is removed for good", focus Cancel; result "Emptied the trash: 1 template removed for good.", focus on the h1. Settings conflict and reload hint: settings.test.ts passes (no UI change since review 1). Recipient search: logic.test.ts:262 passes; the harness sample has no recipients. 8 related test files: 487 passed.
10. Scope: whole slice (`8f6c972..c96a38b`) changes none of src/web/views/editor.ts, src/web/editor/, history, preview, problems, tags or their tests, styles.css, appsscript.json, package files, scripts/. src/web/ui/dialog.ts +14 -1 (from round 1, unchanged in retry 2).
11. Secret scan of added lines: 0 keys or tokens. Addresses added: `a@example.com`. URLs added: none. No new network call. Scopes unchanged (10, all approved).

### Commands (worktree, clean install)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 64 files, 1710 passed, 0 failed. All files lines 96.79 (addon 100, server 99.31, shared 100, web 92.26) |
| `npm run build -- --env dev` | exit 0. Code.js 358.6 KB of 800, index.html 361.8 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 14 of 14 views at 100 |

Probes: scratch copy (`git archive HEAD`) with test/unit/server/probe13r2.test.ts (5 tests) and probebuf.test.ts (3 tests), all pass; Playwright scripts against `node scripts/dev-web.mjs --port 5392`. Nothing added to the worktree.
