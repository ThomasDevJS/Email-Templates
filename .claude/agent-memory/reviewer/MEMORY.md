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
- Slices 1-5c (2026-11-09/10): all PASS after retries; details in docs/reviews/slice-0*.md. Open minors: readPreviousSnapshot swallows Drive errors; template.get not re-sanitized; prompt Insert renders from body cache; failed trigger reinstall can leave <3 triggers; admin can duplicate others' private templates (D11); QUOTA retry not delayed; PH_BACKSLASH false positive across marks.
  - Add-on: src/addon/flows.ts (logic), cards/*.ts pure data, cards/render.ts Card Service only. Write path shared/body/prepare.ts + server/handlers/body.ts. REQUEST_ID_PATTERN shared, checked on both surfaces.
  - Search shared/search/match.ts; favorites/usage side caches server/cache/sideCache.ts (FAVORITES_REV, USAGE_REV). Q21/D24 draft info in addon/event.ts (draftInfo, draftHasSubject), replacesSubject in cards/spec.ts. folderLabel in handlers/folders.ts.
- Slice 6a (2026-11-10): FAIL (2b6b30f), retry 1 PASS (bb53d6c, 1132 tests, lines 96.56, Code.js 286.0 KB). Retry: PRINCIPAL_KEY_MAX 254 on trimmed lowercased key; dispatch buffers denied event for handler or in-lock DENIED (no double rows); grant.list sourcePath hidden above visible part; PURGE_FILES_MAX 50 after commit. Admin into others' private folders is ADR-0003 C (line 113), not a defect; my minor 3 withdrawn.
  - Minors: grant.list sourcePath leaks ancestor names; trash.purge body loop unbounded; admin restore into others' private folders; failed old-trigger delete leaves 6; spec 6 rows for admin.folders, membership.status.
  - New ops: admin.folders (grant.manage list op), membership.status (admin.ops). Trash: template.list {trash:true} adds folderLive, folderPath, canPurge.
- Slice 6b (2026-11-10): FAIL (ffd3957), retry 1 PASS (f6b567f, 1238 tests, lines 96.68, Code.js 318.9 KB). Retry: shared/model/shape.ts on backup copies (VALIDATION) and every live Drive read (INTERNAL); restore writes sides first, index last, undo; purge guard; import "Nothing was imported"; lineText in 11 places. Shape check verified on data from 9 builds (64078b8..292d7ad). Open: damaged live index blocks backup.restore (runbook); undo failure loses first error.
  - Warm props: production 1 (entry.test.ts:293 pins via snapshotProps). world.ts meters live fake props, so world counts (6) are getProperty calls, not service calls.
  - Minors: import failure says only "Internal error"; dup folder IDs; shared folders inside private tree; buffer flood drops applies; restore dialog silent on post-backup versions and purged bodies; side writes after index commit; no 5 MB smoke step; export offset paging.
  - Architect: export.library drops privates, import drops grants, 200 cap: ADR-0002 owner-change path does not hold.
- Slice 7 docs (2026-11-10): FAIL (039392e), retry 1 PASS (d74ad53, quick start 844 words, 1244 tests). Open minors: temp password delivery after admin reset; quick start "asks" ignores fallback; recipient address as prof: cache key 6 h.
  - Must fix: runbook.md:21 password and 2SV handover person to person (fix: Workspace admin resets, new holder enrolls). Quick start D18 omits insert log lines (actor + targetId) and usage.json recent per email.
  - Minors: Recent "about 5 min" is up to 15 (tick + 10 min view cache); forward subject unverified; grid "By" column; QUOTA Retry not disabled (notice); image width fixed 600; quick start 1,087 words.
- Slice 9 task 1, spike S6 harness (2026-11-10): PASS (ba36778). 54 files, 1263 tests, lines 96.7 (addon 99.57, entry.ts:138), Code.js 324.9 KB, 10 scopes.
  - Harness: src/addon/spikeS6.ts, callbacks onS6Card/onS6Apply (param b), Reply kind s6, env gate in the flow after respond prelude. Removal list in the handoff.
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
- Slice 11 admin settings (2026-11-11): PASS (f84a021). 64 files, 1664 tests, lines 96.68 (server 99.31, web 91.92), Code.js 351.4 KB, index.html 359.5 KB, Lighthouse 100x14, 10 scopes.
  - settings in index.json (shared/model/settings.ts, settingsOf fills defaults per reader). config.set web admin.ops, in-lock recheck, `from` = value (A-B-A overwrite silent). Off rule in levelResolver before admin rule: private = use for owner/admin.
  - Probes all clean: 20 off writes x owner/admin DENIED off text, 4 races, 0 Drive writes on 18 reads, on-again identical, bad backup settings VALIDATION before lock.
  - Minors: recipient policy not re-checked in lock; Save focus to BODY (disabled while focused); client CONFLICT ignores details; name echo unbounded; smoke Slice 9 steps 5-6 use dead property; spec 5.8 grant/admin.folders errata.
  - Daily purges private trash while off (ADR-0008 line 92, accepted).
- Slice 13 fix round (2026-11-11): FAIL (3ca3920, export event only at offset 0, buffer result ignored), retry 1 FAIL (f3f8156, page events evicted by export's own bd:* puts at 1,000 templates), retry 2 PASS (ca18ca9 on c96a38b). 1710 tests, lines 96.79, Code.js 358.6 KB, index.html 361.8 KB, Lighthouse 100x14, 10 scopes.
  - Retry 2 mechanism: export `start: true` commits one export.* event via `commit` into pendingAudit, then token `exp:<newId>` (actor, kind, folderId, 600 s sliding) in Script Cache; pages refuse VALIDATION EXPORT_RESTART without it; pages read bodies with keep=false. Buffer holds apply+denied only; evt:lost "<lost> <seen>"; full buffer reuses evicted slot first.
  - Open minors: retry text "did not answer" for BUSY; NETWORK retry of a landed start writes 2 events; audit "started" gives no partial-download hint; token from Math.random (bound to actor, harmless); in-lock import recheck refuses whole import; spec/ADR export passages for architect.
  - config.set base = updatedAt+updatedBy; recheckRecipients in lock (body.ts); prof:<sha256>; stats.target for log targetId; cancelDialogs on Back/Forward.
  - Dev harness: no export audit row, no recipients in the sample; `failSkip`/`failTimes`/`failOp` simulate failures. Harness CONFLICT patch: page.route on minified names (change per build).
- Slice 8b editor (2026-11-11): FAIL (671c7a7), retry 1 PASS (5bd5ec6, 1498 tests, lines 97.35, index.html 367.7 KB after CSS minify, Lighthouse 100x13). Retry: Editor.hold() bookmark mapped through every tr (image, link, ask); one leave dialog (`asking`); googleHost writes {page, at} state, held Back/Forward travels back via Host.go and ignores the return event; live Problems with field buttons; scripts/web.mjs minifiedStyles (esbuild transform, throws on //, /*, <?, </style).
  - Open minors: no smoke step for Host.go (smoke.md:157); first entry has null state, Back to it still pushes (host.ts:75, app.ts:318); chip texts in visible status line shift toolbar 27 px (editor.ts:743), recommend .sr-only status; caret before node after insert at doc start (base too); Back+Discard extra entry; `me` failure blocks editor.
  - Probes in scratchpad/8b-r1/p: insert.cjs (72 runs), nav.cjs, worst.cjs (history.go no-op/no-state/silent), engine4.cjs (needs 60 ms per key or link selection varies on both builds).

- Slice 8b merge with main fe33d50 (2026-11-11): PASS (a5d4527 on 0a59b34). 65 files, 1774 tests, lines 97.77, Code.js 358.6 KB, index.html 374.3 KB, Lighthouse 100x15, 10 scopes. Server/addon/shared diff vs main empty.
  - Merge method: `git show --remerge-diff <merge>`; symbol union check (git grep declarations per commit, trace absentees to merge base); test lines removed vs one parent must be removed by the other from base; computed-style diff per element vs the parent owning each view (0 diffs).
  - cancelDialogs: app.ts open() (route change) and editor canLeave (before the question). Minor: implementer MEMORY:126 describes it wrong.
- Slice 14 wording (2026-11-11): FAIL (3bad2cb). Code, tests, defects a-f pass; 13 stale quotes in admin-guide 120/194/211, editor-guide 113/125, smoke 114-131 (Slice 6a/6b steps). 65 files, 1779 tests, lines 97.82, Code.js 360.4 KB, index.html 375.5 KB, Lighthouse 100x15, 10 scopes.
  - Import ReportLine has no code field; reasonOf dropped `code:` so SUBJ_/PH_ codes left the response (minor, freeze forbids a field). Chip announcer .sr-only.chip-status verified in Chromium AX tree.
  - Retry 1 PASS (d52d084, review on top): 13 quotes fixed, 40-quote sample 0 misses, src text only + roleWords (actions.ts), 1780 tests, Code.js 360.5 KB, index.html 375.7 KB, Lighthouse 100x15. Open: import code gone from report (minor 1).
  - Doc check method: extract every "quoted" string from guides/smoke, grep first 40 chars in src; read misses by hand (most are composed strings).
- Slice 16 in-app admins D32 (2026-11-11): FAIL (review on 6bf8c86). Security core clean; 2 client texts. 66 files, 1827 tests, lines 97.84, Code.js 366.2 KB, index.html 378.7 KB, Lighthouse 100x16, 10 scopes.
  - Mechanism: index.json `admins` (shared/model/admins.ts adminEntriesOf, ADMINS_MAX 20), isAdminEmail 5th input lazy, subjectFor(email, snap, props, index thunk); dispatch admin-row recheck passes in-lock index. handlers/admins.ts change() = withLock + recheck + commitLocked.
  - Must fix: DENIED shows "...this template. Ask a folder manager." in Admins section (status.ts messageOf); Directory INTERNAL text never shown (generic toast).
  - Minors: level-row recheck uses pre-lock isAdmin (removed admin's in-flight grant.add lands); `?? []` latent wipe admins.ts:109; no auto-retry in web client (handoff wrong); smoke "record Directory text" impossible (raw message not logged).
  - Retry 1 PASS (review on 64adc1c): ADMIN_DENIED_TEXT via adminLineText (status.ts) on 8 admin-only actions; ADMIN_CHECK shown in line; lockedSubject (dispatch.ts) for admin+level rechecks (9 ops DENIED in race, 5 passed on old code); editedList CONFLICT; Directory warn line errorCode reason:status. 68 files, 1882 tests, index.html 379.2 KB, Lighthouse 100x16.

- Slice 15 one-click insert D31 (2026-11-11): PASS (on 581232a, merge of main 223f9bb into e9ef9d8). 67 files, 1818 tests, lines 97.82, Code.js 358.2 KB, index.html 376.1 KB, Lighthouse 100x15, 10 scopes + layoutProperties.secondaryColor.
  - Code: render.ts `closeGaps(parts)` (null = gap); flows.ts Flow A `insertFlow` (rc vs list lengths, unknown -> details card counted=1), Flow B `previewFlow`, Flow C `promptInsertFlow`; cards/details.ts `detailsCard`, `panelDetailsCard`.
  - Probes: 10,000 fuzz renders without a gap byte-identical to base, sanitize idempotent on outputs; apply events per path via readBuffer(world.cache).
  - Follow-up 1 PASS (04af35b, 1825 tests): `cardFields` always lists first name (blank box + hint); Flow C carries `mergedValues` into re-renders; Rendered.missing gone. Probe 3 templates x 6 drafts x 3 paths, 18/18 same. Open: rule 2 ASCII only; subject uncapped; smoke step 11 non-admin; spec 7.4 signatures.
- Slice 17 docs, smoke rewrite + test-round-1.md (2026-11-11): FAIL (review on b942e94). 68 files, 1883 tests, format clean, Code.js 364.7 KB. 79 steps checked.
  - Must fix: D11/I11 audit counts for "this month" ignore earlier smoke rows; D14 leaves "Import test" (uniqueSiblingName blocks rerun); G4 needs drafts rule 2 discards; C4 omits the phone after T2 text.
  - Retry 1 FAIL (ce534ba): D14 "Import into" list is the AdminData from Admin open; foldersTab refresh replaces only its local copy, so a folder made in the same visit is missing (dev harness probe). Missed in round 1.
  - Test plans for a browser agent: check counts against data from earlier runs, rerun of each part, rule conflicts between global rules and steps, cache TTLs (view 600 s).
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
- Read handlers for TOCTOU: authorization data vs data inside the lock. Tests by implementers cover the sequence, not concurrent changes of the target.
- npm audit count from npm ci (16) differs from advisory count in handoffs (3); compare like with like. Runtime: `npm audit --omit=dev` (0 in slice 3).
- Check state conditions against side effects of other ops (e.g. folder.list creates the private folder).
- Handoff "Verified" sections go stale after late commits; rerun everything, trust own numbers.
- Sanitizer probes: use a scratch copy and `sanitizeHtml`; web probes need `// @vitest-environment jsdom` and `--silent=false` to see console output.
- Lighthouse: `npm run lighthouse` uses /opt/pw-browsers/chromium, about 1 min. Coverage text reporter hides 100% files; read the summary lines.
- Destructive restore paths: probe parseable-but-wrong-shape files, then check the next restore still works.
- New read-path validation: replay old builds (git archive per slice commit, probe test with setupWorld, dump files) and feed the dumps to the new check.
- Call counts from test/fakes/world.ts skip snapshotProps; compare with entry.test.ts warm-read test.
- UI slices: Playwright at /opt/node22/lib/node_modules/playwright (npm root -g) (require by absolute path), `chromium.launch()` works; or puppeteer-core with executablePath /opt/pw-browsers/chromium-1243/chrome-linux64/chrome. Dialogs are [role=dialog], not <dialog>. Dev harness `node scripts/dev-web.mjs --port N`. Base comparison: git archive base into scratchpad, symlink node_modules, serve on another port.
- Harness data injection: page.route the HTML and replace `\"literal\"` strings in the JSON-escaped bundle; wrapping google.script.run after load does not work (runner captured at start).
- Contrast: compute every token pair incl. hover (`--hover`), `--select`, button hover fills, disabled at 55% opacity; check overrides for hover as well as selected.
- Run new test files against the base copy to prove fixes fail on old code (copy test file into git-archive base, npx vitest run).
- Overlay panels: Tab past the last item and check where focus lands; check outside click.
- Entry gating by event fields: verify the field exists on action (click) events too, from live logs, before trusting the classifier.
- Replace-type writes (Gmail recipient actions): probe missing, non-array and mixed input; "unknown" must never read as "empty".
- Card Service docs: fetch developers.google.com/apps-script/reference/card-service/<class> with curl; extract <article> text. Unknown MaterialIcon name renders no icon, no error. TextButton unset style = OUTLINED. Labels plain text per add-on widget guide.
- Behaviour-freeze slices: run one probe script on base and head copies, dump replies with text stripped, diff.
- rm -rf with a shell variable path is blocked; use literal absolute paths.
- Merges: diff test dirs and server dirs against both parents; run computed-style diffs on 3 dev-web servers (merge, each parent via git archive).
- Harness RPC capture/taint: addInitScript defines a `google` setter, wrap run as wrap(r,h): withSuccessHandler stores h, withFailureHandler(f) wraps r.withFailureHandler(f), rpc calls r.withSuccessHandler(v=>h(taint(op,v))). Replies are {ok,data,...}: mutate env.data.
- Async UI commands (await before editor.run): probe insert position with keyboard Enter; focus return moves the PM selection.
- Guards/dialogs: probe two exits in a row (click then Back, Back twice) for stacked dialogs. History fixes: test Back to the first entry (no state) separately; patch History.prototype.go and popstate in addInitScript.
- Keyboard engine probes: pace keys (60 ms) before diffing builds; unpaced runs differ on both builds.
- Paged ops: probe audit events at offset > 0 with a busy or full buffer; count the Script Cache puts the same op makes (1,000 items, FIFO); world.clock +7 h for a cold cache.
- Settings or policy read from the request's index: probe a race where the setting flips between authorize and lock, for every write that uses it.
- Privilege lists: probe stored-variant matrix (case, plus, dots, homoglyph, display name, nested, proto) and a level-row race, not only admin rows.

- Merges with memory conflicts: `git show --remerge-diff <merge>` shows how each conflict was resolved; check both sides kept.
- Merge heads: compare `git diff <main> <merge>` with the slice's own diff per file; equal = nothing lost.
- Renderer changes: fuzz head vs base copy in one vitest file importing both src trees.
- Run tokens or capabilities: probe other user, other scope, expiry, replay, eviction, and a right revoked between start and page; grep logs, Drive files and errors for the token.
