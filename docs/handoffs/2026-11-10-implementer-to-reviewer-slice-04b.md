# Handoff: implementer to reviewer, slice 4b (smoke fixes)

Branch `slice/04b-smoke-fixes`, based on 43d138f (`claude/gracious-franklin-3n8zbq`). 8 commits plus this handoff, not merged, not pushed:

| Commit | Content |
|---|---|
| 899b80c | Defect 5: one request ID format, generator in src/shared/requestId.ts |
| be82474 | Defect 4: `targetId` on every op log line |
| 6677f10 | Defects 1, 2, 3: editor conflict reload, focus to Save, restore busy state |
| 2f7729f | Defect 7: folder tree keeps focus |
| c7386e5 | Defect 6: row menu, `template.duplicate`, body cache |
| 292e50b | Performance a to c: log metrics, one property read, lock-free index reads, `maintain` in doGet only |
| 4a6cdf5 | Test: folder card from the cached home view |
| 23e1475 | docs/ops/smoke.md fixes and "Slice 4b" section |

## Done, per acceptance criterion

1. Defects 1 to 7, each with a test that fails on 43d138f (checked by reverting src and running the suite: 3 web tests failed for defects 1 to 3, 2 for defect 7; the request ID and `targetId` assertions fail on the old format and the empty field).
   - Defect 1. Cause: client state. A template created in the tab keeps the view's start route `{ folderId }` after the first save (`replaceRoute` changes only the URL). `load()` in src/web/views/editor.ts then took the `else` branch and showed the local copy (`show(current)`) without calling the server. `template.get`, the body cache and the index cache were not involved: `template.get` reads the index through `loadIndex`, and every commit publishes the new `rev`. Fix: `load()` uses the saved ID first. The status text now appears after the reload succeeds.
   - Defect 2. `openDialog` takes `returnFocus`; the conflict dialog passes Save. Before, focus went back to the opener, the editor body after Ctrl+S.
   - Defect 3. Restore's dialog action returns at once; `runRestore` disables Restore, sets `aria-busy` on the list and shows "Restoring version K...".
   - Defect 4. `handleRpc` logs `targetId` = `args.id`, else `args.folderId`, only when the value is a well-formed 26-character ID (body text in `id` gives "").
   - Defect 5. `newRequestId` (8 base-36 time characters, dash, 6 random) in src/shared/requestId.ts. Used by the web client, the add-on (`callServer`), `web.open` (both lines) and the `rpc` fallback. `Utilities.getUuid()` is gone from src.
   - Defect 6. See AC 2.
   - Defect 7. Cause in code: selecting a folder called `app.go`, which re-rendered the whole library and focused `main`; the next arrow key went nowhere. The library now selects in place (`pushRoute`, tree and list redraw), the tree redraws with focus on the selected row, and a click focuses the row it hit. Back and forward still render through the router. Real HtmlService iframe: not verified here (no browser session into Gmail or `/exec`).
2. Row menu (src/web/views/grid.ts, rowActions.ts): column "Actions" with a button `aria-haspopup="menu"`, `aria-label="Actions for <title>"`. Opens with Enter on the Actions cell, Shift+F10 or the ContextMenu key on any cell, or a click. Arrows, Home, End move (existing `openMenu`); Esc closes and focuses the cell (roving tab stop moves to it). Entries by level (`rowActions` in src/web/library/model.ts): edit and above get Edit, Duplicate, Move... (only when another folder with edit exists), History, Delete...; use-only rows get no button. Move lists `moveTargets` (edit folders except the current one). Delete confirms "Delete "<title>"? Deleted templates stay in the trash for 30 days." and calls `template.delete` (soft delete). Status line under the list; focus goes to the copy, the moved row, or the first row after a delete. Server: `template.duplicate` left `LATER_SLICE_OPS`; handler `templateDuplicate` copies title ("Copy of ...", cut to 120), tags and the current body (prepared again) into version 1, audit event `template.duplicate`. Policy row unchanged: `web("template.write", templateCopy)`, edit on source and target. Role tests in test/unit/server/items.test.ts: no grant, use (DENIED), edit, manage (ok), admin (ok), add-on surface (DENIED) for duplicate, move and delete. Default deny holds for all 3.
3. Performance, see the section below. ADR-0003 Pattern A unchanged. New log fields hold numbers only.
4. One format, shared generator (AC 1, defect 5).
5. scripts/lib/html.mjs unchanged (`git diff 43d138f -- scripts` is empty).
6. docs/ops/smoke.md: Slice 3 steps 3, 4, 6, 7 and Slice 4 step 7 now name the controls and texts of the build (dialog field labels, conflict sentence, restore busy text, Delete through the row menu). New "Slice 4b", 8 steps; step 8 lists the timing fields.
7. No scope or manifest change. `scopes:check`: 10 scopes. Spike S4 harness untouched.
8. Results below.

## Performance

### What changed

- a. Instrumentation. src/server/metrics.ts wraps Script Properties, Script Cache, the script lock, the Drive client and `AdminDirectory.Users` once per execution (runtime.ts). Each request log line gains `calls` `{props, cache, drive, lock, dir}` and `timing` `{startupMs, totalMs, propsMs, cacheMs, driveReadMs, driveWriteMs, lockMs, dirMs}`. `startupMs` runs from bundle evaluation to handler start, `totalMs` to the log line. The add-on sends `timing` `{addonPreMs, addonTokenMs, prevFetchMs, prevTotalMs}` (start to this call, the `getOAuthToken` call, and the previous call of the same execution); the server keeps only these keys with whole ms from 0 to 600,000 (`requestTiming`). Write paths show lock wait, Drive read and write time and cache time through the same fields.
- c. Cuts.
  - One `getProperties()` per request execution (`snapshotProps`); writes go through and update the copy. Triggers read live properties.
  - `loadIndex` takes no script lock. A miss reads Drive and puts the chunks of the published `rev`; it sets `INDEX_REV` only when unset and never moves it. A lagging `INDEX_REV` serves the file and leaves repair to `tick`. Before, a reader waited up to 10 s for the lock on a miss.
  - `maintain` (trigger version check) runs in `doGet` only, not on `rpc` or `doPost`.
  - Body cache: Script Cache `bd:<bodyFileId>`, 6 h, filled on save (create, update, restore, duplicate) and on a miss. Keyed by file ID, so an orphan file of a failed save never shadows the committed body. Over 90 KB: not cached. `template.get`, `template.getBody`, `template.apply` and `template.duplicate` read through it; history reads stay on Drive (they need file metadata).
  - Sender profile: already cached 6 h as `prof:<email>`; unchanged.

### b. Call counts per request, before (43d138f) and after (23e1475)

Measured on the fakes through the real entry points (`doPost` for add-on ops, `rpc` for web ops): every Apps Script service call counted at the global, `Lock` = `tryLock` calls. Caller: a user with edit on one folder, one template, warm Script Cache. UrlFetch on the server is 0 in every row (Advanced Drive); the add-on makes 2 UrlFetch calls per server call (POST to `/exec`, GET of the 302 target).

| Request | Properties | Cache | Drive | Lock | Directory |
|---|---|---|---|---|---|
| `sidebar.home` | 7 / 1 | 4 / 4 | 0 / 0 | 0 / 0 | 0 / 0 |
| `template.apply`, first use | 11 / 1 | 11 / 12 | 1 / 0 | 1 / 1 | 2 / 2 |
| `template.apply`, warm | 8 / 1 | 9 / 9 | 0 / 0 | 1 / 1 | 0 / 0 |
| `template.apply` after a save | 11 / 1 | 9 / 10 | 1 / 0 | 1 / 1 | 0 / 0 |
| `template.list` | 7 / 1 | 4 / 4 | 0 / 0 | 0 / 0 | 0 / 0 |
| `folder.list` | 7 / 1 | 4 / 4 | 0 / 0 | 0 / 0 | 0 / 0 |
| `template.update` | 12 / 2 | 8 / 9 | 3 / 3 | 1 / 1 | 0 / 0 |
| `template.get` | 10 / 1 | 4 / 5 | 1 / 0 | 0 / 0 | 0 / 0 |

Before / after in each cell. test/unit/server/entry.test.ts pins the after values for warm `sidebar.home` and `template.apply` from the log line's `calls`.

### Questions from the handoff

- First `template.apply` 1314 ms: the first apply of a template ran 11 property reads, 1 Drive body read (not cached on the server before 4b) and 2 Directory lookups (sender and recipient not yet in `prof:*`), plus the 500 ms-max buffer lock. After 4b the Drive read is gone when the body was saved or read in the last 6 h, and the property reads are 1. The 2 Directory calls stay on a cold `prof:*`. Not measured on Apps Script: the next smoke run shows the split in `driveReadMs`, `dirMs`, `lockMs`.
- `onOpenFolder` calling `sidebar.home`: the flow reads the User Cache first; a new test (flows.test.ts) opens the home card and then a folder card on one cache and sees one `sidebar.home`. Likely causes in the smoke run: smoke Slice 4 step 5 opens the folder card right after "Open library", which clears the view by design; or the 10-min TTL; or the User Cache not carrying over from the compose trigger to the action callback in Gmail (unverified). The next run shows it: a `sidebar.home` line with `prevTotalMs` absent and no Open library before it points at the cache.
- doPost spends 0.6 to 1.1 s outside the handler: the execution log duration minus `totalMs` is the platform and bundle load time (266 KB Code.js parsed per execution); `startupMs` is the part after load (services, `getActiveUser`, and before 4b `maintain` with its property reads).
- Add-on spends 1.4 to 2.7 s outside the server call: `addonTokenMs`, the two UrlFetch hops (`prevFetchMs` minus the server's `totalMs`), and Card Service rendering (the remainder of the function duration). Add-on executions still log nothing; their numbers reach the server line.

### Proposals, not built (d)

1. `sidebar.home` and every indexed read: one `getAll` for `idx:meta` and `gm:meta`, one for both chunk sets. Cache calls 4 to 2.
2. `template.apply`: sender and recipient profiles in one `getAll`. Cache calls -1.
3. Apply event buffer without the script lock (one key per request ID plus a time-bucket list). Removes the 500 ms lock from apply; changes ADR-0002 Audit storage.
4. Cache a Directory miss for 10 min. Today a caller without a Directory record costs 1 Directory call on every apply.
5. Folder card freshness (handoff "Not defects"): a Refresh button on the folder card, or a 2-min view TTL. Costs one `sidebar.home` per refresh.
6. Bundle load: the add-on and server share one 266 KB bundle; a smaller server path needs a second project or deployment (architecture change, ADR-0001 and ADR-0005).

## Decisions the reviewer should check

- `loadIndex` may set `INDEX_REV` when it is unset. Two executions racing before the first publish can leave an older value; `tick` compares with the file and repairs within 5 min. Writers never use the cached copy unless its `rev` equals the file's.
- Property snapshot: a request sees properties as of its first read. A property changed by another execution mid-request shows on the next request.
- `maintain` only in `doGet`: after a deploy with changed `TRIGGERS_VERSION`, triggers reinstall on the first page load of the web app (deploy smoke Slice 1 step 3 opens it).
- Body cache entries count against the Script Cache item limit (1,000 in the fake). Heavy use could evict index chunks and cost Drive reads.
- `template.move` and `template.delete` keep `version` (as before 4b). An editor tab open during a Move saves with its old folder value and moves the template back. Pre-existing, not changed.
- Spec section 11 lists the log fields; `calls` and `timing` are new (architect).

## Left for later

Search, favorites, recent, Trash view and restore UI, admin UI, spec and ADR edits (section 11 fields, section 16 trigger check wording, ADR-0002 lock-free reader rule, spec 6 `template.getBody`), proposals 1 to 6, deploy and the smoke run (clasp not available here). Real-iframe check of defect 7 and of the row menu keyboard.

## Risks

- Defect 7 is fixed for the focus loss that jsdom reproduces. If the HtmlService iframe itself does not receive focus from Tab in the top page, that part is outside the app and still open.
- Timing numbers are from Apps Script clocks in two executions; `addonPreMs` starts at bundle evaluation, not at Gmail's click.

## Files touched

src/shared/requestId.ts (new), src/shared/log/logger.ts, src/shared/model/protocol.ts, src/addon/client/serverClient.ts, src/server/metrics.ts (new), src/server/runtime.ts, src/server/services.ts, src/server/entry.ts, src/server/cache/indexCache.ts, src/server/dispatch/{handle,handlers}.ts, src/server/handlers/{body,sidebar,templates}.ts, src/web/app.ts, src/web/dev-harness.ts, src/web/library/model.ts, src/web/rpc/{api,client}.ts, src/web/ui/dialog.ts, src/web/views/{context,editor,grid,history,library,rowActions (new),tree}.ts, test/fakes/world.ts, test/unit/addon/{addon,flows,noExecUrl}.test.ts, test/unit/server/{cache,entry,handle,history,items,metrics (new)}.test.ts, test/unit/shared/requestId.test.ts (new), test/unit/web/{app,logic}.test.ts, docs/ops/smoke.md.

## Commands (worktree, Node 22.23.4, 2026-11-10)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, "added 559 packages, and audited 560 packages in 11s", 16 advisories (14 moderate, 2 high), dev tree |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| `npm run test:coverage` | exit 0, "Test Files 42 passed (42)", "Tests 879 passed (879)". All files: statements 95.25%, branches 88.59%, functions 93.88%, lines 96.27%. Lines: addon 100%, server 99.31%, shared 100%, web 95.12% |
| `npm run build -- --env dev` | exit 0, "Code.js: 265.8 KB of 800 KB", "index.html: 278.2 KB of 400 KB" |
| `npm run scopes:check` | exit 0, "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100 |

## Retry 1

Review docs/reviews/slice-04b.md (78a3d34): FAIL, blocker 1. 3 commits on top: d8d25a6, 2e72af4, c59624c. Gaps 5 and 6 left as accepted.

1. Blocker, fixed (d8d25a6). `REQUEST_ID_PATTERN` `^[0-9A-Z]{8}-[0-9A-Z]{6}$` and `isRequestId` live in src/shared/requestId.ts next to the generator. `handleRpc` checks the ID for both surfaces before parsing: any other value answers VALIDATION "Request ID must have the format XXXXXXXX-XXXXXX", and the log line and audit events carry a server-made ID (`requestIdNow()`). `rpc` passes the client value through; its own 8-to-64 pattern is gone. A non-object body still answers BAD_REQUEST. Also from the review: the log's `action` is the op only when the policy table knows it, else "". Tests (entry.test.ts) per surface: 5,000-character ID, newline, UUID, empty, lower case, missing, number, valid; the log line never contains the client text. Test helpers now send valid IDs (`TESTREQ0-000001`).
2. Fixed (2e72af4). `ensureTriggers(services, live)` re-checks `TRIGGERS_VERSION` from `live` inside the lock; `maintain` passes `PropertiesService.getScriptProperties()`. Test: 2 executions with stale snapshots, 1 reinstall, trigger IDs unchanged by the second.
3. Fixed in code (2e72af4): `runTick` also runs `ensureTriggers` (live properties on the trigger surface); `TickResult.triggers` reports it. Picked over a deploy.md step because it needs no human step and costs 1 property read per 5 min; add-on-only use reinstalls within 5 min of a deploy. Limit: a release that renames or removes the `tick` handler itself still needs one web app page load. No deploy.md change.
4. Fixed (c59624c). Readers never set `INDEX_REV`; `loadIndex` puts chunks only when the file's `rev` equals the published one. `runSetup` publishes `INDEX_REV` under the lock (`rebuildIndexLocked`), so the unset case ends at setup. Test: a reader whose snapshot saw no `INDEX_REV` runs after a writer set 5; `INDEX_REV` stays 5.

### Old-code checks for defects 4, 5, 6

Tests of each fix commit run against the src before it (src files added later stayed in place):

| Defect | Tests from | src from | Result |
|---|---|---|---|
| 4 | be82474 | 899b80c | 2 failed (`targetId` test in handle.test.ts, `version.restore` log line in history.test.ts) |
| 5 | 899b80c | 43d138f | 7 failed (callServer and no-execUrl ID format, 3 `web.open` lines, 2 `rpc` ID tests) |
| 6 | c7386e5 | 2f7729f | 14 failed (7 duplicate, role and body-cache server tests, 6 row-menu web tests, 1 `rowActions` logic test) |

Gap 1, 2, 3, 4 tests against the src before each retry commit: 8, 2 and 2 failed.

### Commands (clean install, Node 22.23.4)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, added 559 packages, audited 560, 16 advisories (14 moderate, 2 high), dev tree |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| `npm run test:coverage` | exit 0, "Test Files 42 passed (42)", "Tests 891 passed (891)". Statements 95.28%, branches 88.68%, functions 93.9%, lines 96.27% |
| `npm run build -- --env dev` | exit 0, "Code.js: 266.5 KB of 800 KB", "index.html: 278.2 KB of 400 KB" |
| `npm run scopes:check` | exit 0, "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100 |
