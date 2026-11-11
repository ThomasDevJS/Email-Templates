# Reviewer memory

## Project facts
- Owner email is in docs/BRIEF.md and ADR-0002/0003/0005 only. Do not copy it into reviews.
- Spec section 9: 10 default scopes (script.projects.readonly after spike S2 (a); drive.metadata.readonly not in list), conditional list, `https://mail.google.com/` forbidden. Mirror in scripts/approved-scopes.json.
- urlFetchWhitelist (slice 2): script.google.com/macros/s/, script.googleusercontent.com/, googleapis.com/drive/v3/, googleapis.com/upload/drive/v3/.
- One Apps Script project per env; webapp USER_DEPLOYING + DOMAIN; add-on calls own /exec via UrlFetch.
- Build: esbuild IIFE `App` + top-level stubs per export of src/entry.ts. Every export is callable via google.script.run. Allowlist src/shared/entryPoints.ts (11 exports, surfaces webapp_rpc, doPost, trigger, addon).
- Boundary: src/addon must not import src/server or use Drive, GroupsApp, AdminDirectory, getScriptCache, getScriptProperties. src/server must not use getUserCache. ESLint + test/unit/boundary.test.ts.
- Permission layer: src/shared/permissions (matrix 17 rows, levelResolver), src/server/dispatch (policy 40 rows, targets, authorize before handler). Writes: storage/writer.ts mutateIndex/commitLocked.
- docs/* is in .prettierignore except docs/ops.

## How to run checks
- Worktrees under /home/user/Email-Templates/.claude/worktrees/<id>. Use absolute paths.
- Commands: npm ci, lint, format:check, typecheck, test:coverage, build -- --env dev|prod, scopes:check, setup:check.
- Run them in one background chain, logs in the scratchpad (scratchpad is shared across runs; check file mtimes).
- Always reproduce `npm ci` from clean (rm -rf node_modules). If the lock changed, also `npm ci --ignore-scripts --dry-run` in a clean dir.
- Secret scan: grep added lines for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, eyJ; list all emails and URLs.
- gitleaks is not installed locally; verify CI checksum against the upstream checksums.txt via curl.
- Probing behaviour without editing src/ or test/: `git archive HEAD | tar -x` into scratchpad, symlink node_modules, add a probe test, `npx vitest run <file> --silent=false`. Delete the copy after.
- Server-plus-add-on probes: test/fakes/world.ts `setupWorld()`, `world.call(email, op, args, surface)`, `world.lines` for logs; add-on Ports pattern in test/unit/addon/flows.test.ts.

## Slice log
- Slices 1-4b (2026-11-09/10): all PASS after retries. Lessons kept below. Open minors: readPreviousSnapshot swallows Drive errors; template.get not re-sanitized; prompt Insert renders from body cache; failed trigger reinstall can leave <3 triggers; admin can duplicate others' private templates (D11).
  - Add-on: src/addon/flows.ts (logic), cards/*.ts pure data, cards/render.ts only Card Service code. Sanitizer src/shared/sanitize, placeholders src/shared/placeholders. REQUEST_ID_PATTERN shared, checked on both surfaces.

- Slice 5 (2026-11-10): PASS (b534836). 46 files, 952 tests, lines 96.33% (addon 100, server 99.31, shared 100, web 95.5), Code.js 276.2 KB, index.html 284.2 KB, 10 scopes, Lighthouse 100x3.
  - Subject: src/shared/placeholders/subject.ts, renderSubject (one pass, oneLine), insertReply (cards/spec.ts). Cards escape via markup(); history subject via withChips(escapeText()).
  - Search: shared/search/match.ts (QUERY_MAX 200), sidebar `search` on snippet only, `search.body` ft:* + 25 Drive reads cap. Favorites/Recent: handlers/favorites.ts, key = server caller email, filtered by visible IDs; side caches server/cache/sideCache.ts with FAVORITES_REV, USAGE_REV (tick publishes when unset).
  - Minors: spec 4.4 snippet wording; subject-only prompts asked with switch off; 2 Drive reads per home until first tick on pre-5 data; crash between writeSide and setProperty serves stale set; Q21 threadId boolean not in smoke step 1; spec 6 status line and 5.6 property list stale.
  - Spike S5 unverified (owner smoke Slice 5 step 1).

- Slice 5b (2026-11-10): PASS (c50c953). 46 files, 983 tests, lines 96.41 (addon 100, server 99.31, shared 100, web 95.52), Code.js 279.8 KB, index.html 284.9 KB, 10 scopes, Lighthouse 100x3. New tests on old src: 38 fail.
  - Q21: DRAFT_FIELDS/requestDraft in shared/model/protocol.ts (null -> VALIDATION, not logged), draftInfo/isReplyDraft in addon/event.ts, replacesSubject in cards/spec.ts, "Insert with subject" = subject "use".
  - Owner label: folderLabel in server/handlers/folders.ts (folder.list only; sidebar filters others' privates).
  - Minors: smoke 5b step 9 needs 2 versions; admin folder.rename stores labelled name (no UI yet); stale search.body error toasts; "Searching text..." not announced; spec 5.6/11 and wireframe 02 lack reply rule and `draft` field.

- Slice 5c (2026-11-10): PASS (1611869). 1001 tests, lines 96.41, Code.js 280.3 KB, 10 scopes, Lighthouse 100x3. New tests on old src: 21 fail.
  - D24: draftHasSubject (addon/event.ts) reads gmail.subject and draftMetadata.subject; replacesSubject(choice, draftHasSubject). Gmail compose event has no threadId/messageId.
  - DraftInfo.hasSubject boolean, requestDraft requires 5 keys. folder.rename strips " (owner)" on private folders; only admins can rename private folders (owner gets DENIED).
  - Minor: strip also hits admin's own folder.

- Slice 6a (2026-11-10): FAIL (2b6b30f), retry 1 PASS (bb53d6c, 1132 tests, lines 96.56, Code.js 286.0 KB). Retry: PRINCIPAL_KEY_MAX 254 on trimmed lowercased key; dispatch buffers denied event for handler or in-lock DENIED (no double rows); grant.list sourcePath hidden above visible part; PURGE_FILES_MAX 50 after commit. Admin into others' private folders is ADR-0003 C (line 113), not a defect; my minor 3 withdrawn.
  First review: 49 files, 1120 tests, lines 96.54 (addon 100, server 99.31, shared 100, web 95.89), Code.js 284.7 KB, index.html 301.4 KB, 10 scopes, Lighthouse 100x6. New tests on old src: 58 fail.
  - Blocker 1: grant.add principalKey unbounded (grants.ts:73 principalKeyFor); manage holder stored a 20,004-char domain key.
  - Blocker 2: refused admin.folders (handler DENIED, admin.ts:34) writes no denied audit row; ADR-0003 Part C line 144 requires one.
  - Accepted: escalation probes all DENIED (above, sibling, root, private, foreign move); FOLDER_DEPTH_MAX 5; restoreTargets (purged folder = ROOT, admin only); Q23 create-then-delete; in-lock admin re-check (props are snapshot reads in prod).
  - Minors: grant.list sourcePath leaks ancestor names; trash.purge body loop unbounded; admin restore into others' private folders; failed old-trigger delete leaves 6; spec 6 rows for admin.folders, membership.status.
  - New ops: admin.folders (grant.manage list op), membership.status (admin.ops). Trash: template.list {trash:true} adds folderLive, folderPath, canPurge.

- Slice 6b (2026-11-10): FAIL (ffd3957), retry 1 PASS (f6b567f, 1238 tests, lines 96.68, Code.js 318.9 KB). Retry: shared/model/shape.ts on backup copies (VALIDATION) and every live Drive read (INTERNAL); restore writes sides first, index last, undo; purge guard; import "Nothing was imported"; lineText in 11 places. Shape check verified on data from 9 builds (64078b8..292d7ad). Open: damaged live index blocks backup.restore (runbook); undo failure loses first error.
  First review: FAIL (ffd3957). 51 files, 1225 tests, lines 96.6 (addon 100, server 99.31, shared 100, web 95.16), Code.js 312.6 KB, index.html 316.2 KB, 10 scopes, Lighthouse 100x10.
  - Blocker: backup.restore casts backup JSON `as BackupDocs` (driveStore.ts readBackup); index without folders bricks every op incl. the next restore (dispatch folderMap); favorites `{}` writes rev null, sidebar.home INTERNAL. Fix: shape check before the lock.
  - Accepted: import probes (XSS, 2 MB, CR/LF subject, 10k items, proto keys, cycles, existing IDs) all safe; Validate writes nothing; export.folder subtree only, in-scope grants = grant.list visibility; audit drawer is text; config.get has no ADMIN_EMAILS/OWNER_EMAIL/STORE.
  - Warm props: production 1 (entry.test.ts:293 pins via snapshotProps). world.ts meters live fake props, so world counts (6) are getProperty calls, not service calls.
  - Minors: import failure says only "Internal error"; dup folder IDs; shared folders inside private tree; buffer flood drops applies; restore dialog silent on post-backup versions and purged bodies; side writes after index commit; no 5 MB smoke step; export offset paging.
  - Architect: export.library drops privates, import drops grants, 200 cap: ADR-0002 owner-change path does not hold.

- Slice 7 docs (2026-11-10): FAIL (039392e), retry 1 PASS (d74ad53, quick start 844 words, 1244 tests). Open minors: temp password delivery after admin reset; quick start "asks" ignores fallback; recipient address as prof: cache key 6 h.
  First review FAIL (039392e). 52 files, 1244 tests, Code.js 318.9 KB, 10 scopes. 64 doc claims checked against src.
  - Must fix: runbook.md:21 password and 2SV handover person to person (fix: Workspace admin resets, new holder enrolls). Quick start D18 omits insert log lines (actor + targetId) and usage.json recent per email.
  - Minors: Recent "about 5 min" is up to 15 (tick + 10 min view cache); forward subject unverified; grid "By" column; QUOTA Retry not disabled (notice); image width fixed 600; quick start 1,087 words.
  - Confirmed spec/ADR errata: spec 7 NOT_CONFIGURED/AUTH/SERVER texts, spec 8/12 4 vs 10 Lighthouse views, NOT_IMPLEMENTED dead in status.ts, ADR-0004 profile clear not built.

- Slice 9 task 1, spike S6 harness (2026-11-10): PASS (ba36778). 54 files, 1263 tests, lines 96.7 (addon 99.57, entry.ts:138), Code.js 324.9 KB, 10 scopes.
  - Harness: src/addon/spikeS6.ts, callbacks onS6Card/onS6Apply (param b), Reply kind s6, env gate in the flow after respond prelude. Removal list in the handoff.
  - Minors: callback ms excludes build() and Gmail; mixed-type list reads as missing; Gmail error text may quote an address in Executions; step 4 confounded if F1 fails.
  - UpdateDraftActionResponse has no navigation or notification: harness results show in the draft only.
- Slice 8a UI (2026-11-10): FAIL (23bf981), retry 1 PASS (5b0aa2c, 1265 tests, index.html 340.6 KB). Retry: panel modal (main inert + aria-hidden, trapTab exported, matchMedia close), focus selector a[href] (SVG use href was counted), --star #a87400, --star-off #78838b, --field-line #7f8b93/#7c8a94 for field and button borders, contrast.test.ts token pairs (does not check CSS usage).
  First review 52 files, 1256 tests, lines 96.4, Code.js 318.9 KB, index.html 340.0 KB, 10 scopes, Lighthouse 100x11 (incl. library dark). No server/shared change.
  - Must fix: 390 px panel (`.side.open .side-panel` absolute) lets Tab reach search/grid under it; no outside-click close (app.ts:74-86). `--star` #c58a00 2.99 on paper, 2.74 on canvas; star-off 2.80 on `--select` (button hover).
  - Minors: `.owner` on tree hover 4.19; history.ts:113 full address; admin 390 px width 665 (base 506), 8c; input borders 1.58 (design system); disabled buttons exempt.
  - Accepted all 17 mockup differences (17 deferred to 8b). XSS probe via patched harness data clean.
- Slice 10 S7 harness (2026-11-10): PASS (f7f05a7). 58 files, 1332 tests, lines 96.48, Code.js 335.7 KB, 10 scopes, manifest adds contextualTriggers unconditional onMessageOpen.
  - `entryOf` (event.ts): draftMetadata -> compose, else gmail.messageId or messageMetadata.messageId -> message, else inbox. Compose clicks carry top-level draftMetadata (runbook.md:125 fields).
  - Interim fix: Insert only when entry compose (templateItem, preview insertButtons); TOOLBAR_HINT on home card only.
  - Harness src/addon/spikeS7.ts, callbacks onS7Card/onS7Compose/onS7Notify, Reply kinds s7, s7Error; s7Visible wraps after the guard.
  - Minors: hint missing on folder/search/preview; smoke lacks Drafts/Executions check and "reopen harness"; spec 10 no onMessageOpen row, failures uncached (1 server call per message open); no compose regression step; messageMetadata fallback not in spec.

- Slice 8c UI admin (2026-11-10): PASS (75ebb53). 56 files, 1295 tests, lines 96.45, index.html 352.9 KB (+12.3, css +7.2), Lighthouse 100x12 (incl. admin audit dark), 10 scopes. No server/shared/addon/editor change.
  - New: src/web/admin/actions.ts (actionWords Map, resultTag, purgeText), views/adminTable.ts (data-label stacking <860 px, Chromium keeps table roles), tint tokens --ok-bg/--warn-bg/--red-bg.
  - Minors: trash.ts:140 purgeText infers templates from the list (wrong when reload fails); server has goneItems, ask for it. Audit actor short name only (title). Export sentence omits private folders. Config widths uneven.
  - Pre-existing (base too): dialog background not inert; focus to BODY after audit Next page and after Import.

- Slice 8d web minors (2026-11-11): PASS (0cc49c8). 60 files, 1350 tests, lines 96.55, index.html 355.1 KB, Lighthouse 100x12, 10 scopes. Web only.
  - setInert (dialog.ts) on every body child but backdrop and #toasts; 13 dialogs probed. Stacked label `attr() / ""`, AX keeps 6 columnheaders. Focus ring offset -2 px on active item in 4 lists.
  - Minors: backdrop press drops focus to BODY (no preventDefault, base too); Back/Forward leaves dialog open over new route (base too); trash.ts:128 "All 1 templates".
- Slice 9 recipients (2026-11-10): FAIL (441ab04), retry 1 PASS (08955ca, 1414 tests, Code.js 346.6 KB). Retry: DraftRecipients null per field = no action, unknown To = filled, "Add by hand" line; prompt card uses recipientWidgets; FINISH_TYPING line; isStoredList + recipientsUnreadable on restore. Open: card-unknown/tap-known adds silently (rh lacks field state); spec 5.7/7.1 errata. First review: 60 files, 1391 tests, lines 96.58 (addon 100, server 99.31), Code.js 345.5 KB, index.html 340.6 KB unchanged, 10 scopes, Lighthouse 100x11.
  - Must fix: draftRecipients (addon/event.ts) reads missing/non-array/mixed list as [], and REPLACE actions then wipe the draft field (tests assert it). Prompt card switchLabel lacks Bcc marker, Not added, blocked. No "finish typing" line on cards.
  - Accepted: rh over to/cc/bcc/blocked, no rh -> preview card, forged rh -> card; update omission keeps lists, deny then refuses; apply/getBody blocked split; audit admin only; validator rejects injection probes.
  - Code: shared/model/recipients.ts (validateRecipients, importRecipients, splitBlocked), addon/cards/recipients.ts (recipientPlan, recipientActions, rowHint), flows.ts needsReview. Minor: version files have no shape check.

- Slice 12 add-on layout and wording (2026-11-11): PASS (00c91a3). 62 files, 1437 tests, lines 96.67, Code.js 347.8 KB, 10 scopes. Add-on only.
  - Probe base vs head pure flows (6 events x 5 templates, all insert params, prompt switches): 502/526 replies identical incl. 322 draft responses; 24 diffs = Open library moved to fixed footer.
  - New: CardSpec.title optional, ButtonSpec.style filled (slate #2a3c49 via setBackgroundColor) | outlined, item icon (Material names star/schedule/description/folder), SectionSpec.collapseAfter (VISIBLE_ROWS 5), LIBRARY_FOOTER, sidePanel.ts sidePanelHint.
  - Gaps: bottom label `\n`-><br> plus escaping vs Google guide 'labels must use plain text' (unverified, smoke step 1); no-match echoes unbounded query; folder rows repeat header path, snippet gone (wireframe 01 had it); stale smoke.md:47-48, deploy.md:20.
  - Follow-up 9d48a79, 85d6d50: PASS, 1440 tests. Labels escapeText only, one line joined ' · '; folder rows hints only; ECHO_MAX 60 (cut by UTF-16 unit, can split a surrogate pair: minor). Draft responses still identical to base.

## Check next
- Admin can duplicate others' private templates (D11, open since 4b). UNKNOWN_OP reply quotes the op back. Spec 11 lacks calls/timing fields.

## Recurring lessons
- Doc slices: grep every quoted UI string in src; check privacy sections against log fields (actor is logged on every op); read ops steps for secret handling.
- Read the Accepted ADR before calling an admin right a defect (ADR-0003 C: admin = manage everywhere, private included).
- Handler-level DENIED (list ops) bypasses dispatch recordDenied; check the audit row for every DENIED path.
- Check length bounds on every stored client string (principal keys had none for 4 slices).
- Probe files: never use Python splitlines() on files with U+2028; it splits there. Use split("
").
- Side files under a rev property: check missing-property behaviour on old data and the writer order (file, then property).
- Server props are a per-request snapshot since 4b (runtime.ts snapshotProps, triggers live). Any read-check-write across executions under a lock must read live.
- Log fields from clients (requestId, op, timing): check format and length on the server, both surfaces.
- ESLint probes without editing src/: pipe code to `npx eslint --stdin --stdin-filename <existing src file>` (new paths hit the projectService parse error).
- Coverage text reporter hides 100% files; read the summary lines.
- Read handlers for TOCTOU: authorization data vs data inside the lock. Tests by implementers cover the sequence, not concurrent changes of the target.
- npm audit count from npm ci (16) differs from advisory count in handoffs (3); compare like with like. Runtime: `npm audit --omit=dev` (0 in slice 3).
- Check state conditions against side effects of other ops (e.g. folder.list creates the private folder).
- Handoff "Verified" sections go stale after late commits; rerun everything, trust own numbers.
- Sanitizer probes: use a scratch copy and `sanitizeHtml`; web probes need `// @vitest-environment jsdom` and `--silent=false` to see console output.
- Lighthouse: `npm run lighthouse` uses /opt/pw-browsers/chromium, about 1 min.
- Destructive restore paths: probe parseable-but-wrong-shape files, then check the next restore still works.
- New read-path validation: replay old builds (git archive per slice commit, probe test with setupWorld, dump files) and feed the dumps to the new check.
- Call counts from test/fakes/world.ts skip snapshotProps; compare with entry.test.ts warm-read test.
- UI slices: Playwright at /opt/node22/lib/node_modules/playwright (npm root -g) (require by absolute path), `chromium.launch()` works. Dev harness `node scripts/dev-web.mjs --port N`. Base comparison: git archive base into scratchpad, symlink node_modules, serve on another port.
- Harness data injection: page.route the HTML and replace `\"literal\"` strings in the JSON-escaped bundle; wrapping google.script.run after load does not work (runner captured at start).
- Contrast: compute every token pair incl. hover (`--hover`), `--select`, button hover fills, disabled at 55% opacity; check overrides for hover as well as selected.
- Run new test files against the base copy to prove fixes fail on old code (copy test file into git-archive base, npx vitest run).
- Overlay panels: Tab past the last item and check where focus lands; check outside click.
- Entry gating by event fields: verify the field exists on action (click) events too, from live logs, before trusting the classifier.
- Replace-type writes (Gmail recipient actions): probe missing, non-array and mixed input; "unknown" must never read as "empty".
- Card Service docs: fetch developers.google.com/apps-script/reference/card-service/<class> with curl; extract <article> text. Unknown MaterialIcon name renders no icon, no error. TextButton unset style = OUTLINED. Labels plain text per add-on widget guide.
- Behaviour-freeze slices: run one probe script on base and head copies, dump replies with text stripped, diff.
- rm -rf with a shell variable path is blocked; use literal absolute paths.
