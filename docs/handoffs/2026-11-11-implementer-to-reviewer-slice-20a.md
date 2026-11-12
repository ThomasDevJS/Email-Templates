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

## Retry 1 (review docs/reviews/slice-20a.md, FAIL on 2)

Head after retry: see the last commit on the branch. Each new test fails on the code before its fix.

| Item | State | Test | Commit |
|---|---|---|---|
| MF1 open-script | fixed: `npx clasp open-script <scriptId>` from `deploy/<env>.json` (guide step 9, deploy.md dev 6 and prod 2); clasp switch is `npx clasp logout`, `npx clasp login`, check `npx clasp show-authorized-user` | none (docs) | f22579f |
| MF2 two errors, focus | fixed: first load fails quietly into the banner (no toast), Reload focuses main, no extra toast per Reload | app.test "a failed first load shows one plain error..." | 0fb8fea |
| m1 banner over a drawn view | fixed: the banner replaces only the first view of the page load, and only library, trash, editor; Admin and History get the toast | app.test "a slow first load never replaces an Admin page", "BUSY shows a toast..." (now on #/admin) | 0fb8fea |
| m2 NOT_CONFIGURED first load | fixed: the banner says the setup sentence, no toast | app.test "a first load that is not set up..." | 0fb8fea |
| m3 tab switch during folder write | fixed: `refresh(after)` starts with the write; a tab opened meanwhile waits for the new list | admin.test "a tab opened while a folder write is listed..." | ee1ce1d |
| m6 concurrent starts | fixed: reuse check, commit and `exps:` put in one `withLock` | server adminReports "writes one event for two tries of one click that run at the same time" | c9012eb |
| m7 version number | fixed: step 12 makes version 2 after the editor's version 1 (deploy.mjs `create-version` then `list-versions` count); editor behavior marked not yet tried | none | f22579f |
| m8 which clasp account | fixed: `show-authorized-user` in guide step 4 and deploy.md | none | f22579f |
| m9 errata 5 guide text | fixed: scope reasons for the side panel; prod logo owner in the unknown table | none | f22579f |

Commands run for MF1 (clasp 3.4.1 from node_modules, empty scratch directory): `clasp --version`; `clasp --help`; `clasp <c> --help` for login, create-script, open-script, show-authorized-user, create-deployment, create-version, push, pull, list-versions, logout; `clasp open-script` without ID ("Script ID not set, unable to open IDE."); `clasp --json open-script <example id>` (prints the `/d/<id>/edit` URL); `clasp show-authorized-user` ("You are logged in as ..."); `npm run setup:check`. Read `node_modules/@google/clasp/build/src/commands/open-script.js`, `login.js` (an existing login gets a warning and is replaced), `scripts/deploy.mjs`, `scripts/lib/deployConfig.mjs`, `scripts/lib/claspOutput.mjs`, `package.json` scripts. Every command in both documents exists with the flags written.

Left:
- m4 caret before a menu field (Sender name) inserted at a paragraph start: base behavior, `src/web/editor/setup.ts` `run` (not `hold().run`).
- m5 `src/web/views/adminAudit.ts:152`: a Details click on another row while one loads is ignored; the status already reads "Loading entry details...".
- m3 tail: an import's `folders.refresh()` does not redraw the open "Export and import" lists (`src/web/views/adminTransfer.ts` `send`); redrawing would drop the report.
- m10 spec 6 `run` arg, spec 7.3 line 533, wireframe 06 line 119: architect.
- m11 `src/server/runtime.ts:128` `getUuid` plus `computeDigest` per ID: time on Apps Script not measured (dev).

Checks (clean install): `npm ci` ok; lint, typecheck clean; `npm run test:coverage` 69 files, 1969 passed, lines 98.01; build Code.js 371.2 KB, index.html 380.8 KB; scopes 10 approved; format clean; Lighthouse 16 of 16 at 100.
