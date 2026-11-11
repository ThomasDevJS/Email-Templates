# Review: slice 13, last fix round

Date: 2026-11-11. Branch `slice/13-fix-round`, base 8f6c972, head 3ca3920 (13 commits). Reviewer.

## Verdict: FAIL

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
