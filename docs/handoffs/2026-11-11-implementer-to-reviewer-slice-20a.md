# Slice 20a: fix round, web app and server (implementer to reviewer)

Branch `slice/20a-fix-web-server` from `claude/gracious-franklin-3n8zbq` 16df87a, head 2aa7ddb. 15 commits, no push, no merge. No change in `src/addon/**`, `src/shared/placeholders/**`, `appsscript.json`, `scripts/**`, `docs/guide/user-quick-start.md`, editor engine (schema, `serializeDoc`, sanitizer, fixtures). Every new test fails on the code before its fix (src reverted, test kept).

| Item | State | Test | Commit |
|---|---|---|---|
| 1 Admin folder list stale across tabs | fixed: `AdminFolders` (admin.ts) holds one list, `refresh()` after folder writes and imports; test-round-1 D14 reload step removed | admin.test "lists a folder created in Folders and access under Export and import" | 26d6b4a |
| 2 Blank first load | fixed: `Loading...` `role=status` in index.html main; 15 s or a failed first load shows "Templates could not be loaded. Press Reload to try again." + Reload; a late answer renders | app.test "shows Loading...", "a failed first load...", "...no answer in 15 seconds..." | bfdd59c |
| 3 8b minor 2 / Back to first entry drops Forward | fixed: start stamps the first entry `{page, at: 0}` | editorPanel "stamps the page's first entry" | ab93e4b, 6c976e5 |
| 3 8b minor 4 caret after insert | fixed: `hold().run` clears the DOM selection first; Chromium probe: "Z" lands after the node (2 of 2 dialogs, start and end) | editor.test "drops the browser's old caret" | 6c976e5 |
| 3 8b minor 5 | fixed 4 of 5: Back+Discard travels `go(moved)`; `me` failure opens the editor; no Bcc note under None; read-only Title borderless. Left: Bcc empty input line | editorPanel "adds no history entry...", "opens when the caller's own details...", "shows no Bcc note under None..."; styles.test "read-only Title" | 8753bad |
| 3 8b merge: 2 audit drawers | fixed: one details load at a time | adminReports "opens one drawer for a click and an Enter" | 615c707 |
| 4 13 minor 2 + double start event | fixed: browser sends one `run` key (request ID format) per click; server keeps `exps:<run>` 60 s, bound to caller and scope, and returns the first token | server adminReports "gives a retried start...", web "sends one run key..." | cdea963 |
| 4 13 minor 4 token entropy | fixed: `newId` random part from SHA-256 of `Utilities.getUuid()` | model.test "takes the random part from a digest" | 70b9f18 |
| 4 13 minor 5 progress total | fixed: progress uses each page's live total. Offset shift on concurrent saves stays (pre-existing) | adminReports "counts progress from the live total" | d3c2116 |
| 5 11 minor 7 | skipped: already fixed, `backup.restore` event carries `liveSettingsKept: true` (config.ts:256, settings.test.ts:81) | none | none |
| 5 14 minors 8, 10 | fixed: `total` null until the start answers; status keeps the reason after the toast | adminReports "words a failed export...", "shows the server's own message..." | c8230de |
| 6 16 Directory warn line | fixed: `requestId` passed, `actor` stays "". Retry 1 minors 2, 3 are docs and dev smoke | admins.test "SERVER (INTERNAL)... ADMIN_CHECK" | 509ed28 |
| 7 19 triggers lastError | fixed: `installAndRecord` deletes `job:triggers:lastError` on success | jobs.test "deletes the other old triggers..." | d518477 |
| 7 19 extra UrlFetch | skipped by decision: the REST read changes the answer for transient and quota failures of the Advanced read (review retry 1 point 4: ok in place of INTERNAL); only a 404 costs 1 extra fetch | none | none |
| 8 17 minors | skipped: all 10 are doc wording; minor 4 (radio keeps Off after Cancel) is the form keeping an unsaved choice | none | none |
| 9 NOT_CONFIGURED text | fixed: web shows `NOT_SET_UP_TEXT` (shared/errors/codes.ts, also used by guards.ts, setupStore.ts) | status.test "shows the server's setup sentence" | 594e148 |
| 10 Admins "grants" | fixed: "Admins manage every shared folder, its access, settings, imports and backups."; test-round-1 I1 updated; smoke.md had no quote | adminReports "shows the list with sources..." | 776b9d1 |
| 11 Workspace deploy docs | fixed: guide part 2 in 21 steps, deploy.md "First prod deploy (2.5b)"; checked against scripts/deploy.mjs, lib/deployConfig.mjs, clasp 3.4.1 | docs links test | 2aa7ddb |

## Left

- 8b minor 5 Bcc box empty input line: the line is the typing input of an editable box (`flex: 1 0 80px`). Hiding it needs a design call (keep a typing line vs. inline input).
- Spec 7.3 line 533 and wireframe 06 line 119 still quote "grants"; spec section 6 does not list the optional `run` arg of `export.* {start: true}`. Architect.
- Item 11 untried: Apps Script API for a new account, two clasp logins on one machine (clasp `--user` exists, deploy.mjs uses the default login), APIs a standard project needs, private listing links.

## Risks

- `go(moved)` after Discard and the first-entry stamp rely on `google.script.history` and `window.history.go` in Google's frame; the harness and jsdom only simulate it.
- The caret fix is verified in headless Chromium 1243 only.
- A failed first load replaces any view, Admin included, with the Reload error.

## Commands (clean install)

`npm ci` ok; `npm run lint` clean; `npm run typecheck` clean; `npm run test:coverage` 68 files, 1948 passed, lines 98.03, branches 91.05; `npm run build -- --env dev` Code.js 369.5 KB of 800, index.html 380.2 KB of 400; `npm run scopes:check` 10 scopes approved; `npm run format:check` clean; `npm run lighthouse` 16 of 16 runs at 100.

Dev only: first-load timing in Google's frame, Back/Forward trips, caret in desktop Chrome, NOT_CONFIGURED page before `setup()`.
