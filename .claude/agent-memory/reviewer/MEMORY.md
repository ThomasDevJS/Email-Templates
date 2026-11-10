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
- Slice 1 (2026-11-09): FAIL then PASS on retry 1 (501090f). Blocker was npm ci EUSAGE (@types/node peer). 144 tests, 99.34% lines.
- Slice 2 (2026-11-09): FAIL (195ab90, stale authorization under concurrent move), retry 1 fix 6052320: PASS (64078b8). 22 files, 439 tests, 99.39% lines, Code.js 103.4 KB, 10 scopes.
  - Fix: dispatch returns target placement; handlers/commit.ts rechecks inside the lock (CONFLICT reason moved, DENIED on lost level). races.test.ts 9 tests.
  - Open minor: readPreviousSnapshot swallows Drive errors, mergeGroup can then write members.json with one group. Add-on 404 at first hop (deploy issue, s2.md).

- Slice 3 (2026-11-09): PASS (review 8ba6797 on 41575e3). 32 files, 745 tests, lines 94.61% (shared 100, server 99.06, web reported only). Code.js 226.0 KB, index.html 271.0 KB, Lighthouse 100/100/100, 10 scopes.
  - Sanitizer src/shared/sanitize (htmlparser2 12.0.0), placeholders src/shared/placeholders, write path src/shared/body/prepare.ts + server/handlers/body.ts. Web app src/web (ProseMirror, no framework), dev harness scripts/dev-web.mjs.
  - Open minors: template.get not re-sanitized (editor loads through it); QUOTA retry not delayed 60 s; PH_BACKSLASH false positive across mark runs; bodySize dead in src; chrome-launcher undeclared; spec 6 lacks template.getBody; ADR paste-preview sanitize not done.

- Slice 4 (2026-11-10): FAIL (2ac580f), retry 1 PASS (054129a, 846 tests, Code.js 259.2 KB). First review: 40 files, 842 tests, lines 95.95% (addon 100, shared 100, server 99.08), Code.js 258.9 KB, 10 scopes.
  - Blocker: home.ts:54 empty state needs folders AND templates empty; every caller gets a private folder on first folder.list, so the empty state never shows (smoke Slice 4 step 8 fails). Fix: templates.length === 0.
  - Minors: prompt Insert renders from body:<id> cache (6 h) with no re-check; unused payload fields placeholders/own/rev; smoke Slice 1 step 3 stale Ping; setRequiredWidgets not tried.
  - Accepted: unset DOMAIN -> NOT_CONFIGURED; sidebar hides others' private folders from admins (server filter, library still shows); apply event buffered at prompt card open (spec 4.1 step 3).
  - Add-on: src/addon/flows.ts (logic), cards/*.ts pure data, cards/render.ts only Card Service code. Spike S4 harness TEMPORARY (spike.s4, onSpikeCard, onSpikeInsert, src/shared/spike).

- Slice 4b (2026-11-10): FAIL (78a3d34), retry 1 PASS (20bd55a, 891 tests, Code.js 266.5 KB). Retry: shared REQUEST_ID_PATTERN enforced in handleRpc (VALIDATION, server ID logged), action logged only for policy ops, ensureTriggers live re-check, tick runs ensureTriggers, readers never set INDEX_REV (setup publishes). Open: failed reinstall can leave <3 triggers (delete-first); spec 16 wording.
  First review (714adf0): 42 files, 879 tests, lines 96.27% (addon 100, server 99.31, shared 100, web 95.12), Code.js 265.8 KB, index.html 278.2 KB, 10 scopes, Lighthouse 100x3.
  - Blocker: client requestId not format-checked on server. doPost logs any non-empty string (handle.ts:107, protocol.ts:69); rpc accepts [A-Za-z0-9-]{8,64} (entry.ts:123). Fix: shared XXXXXXXX-XXXXXX pattern, replace non-matching IDs on both surfaces.
  - Minors: snapshotProps breaks ensureTriggers double-check (reinstalls twice); maintain only in doGet, deploy.md lacks "open /exec after deploy"; loadIndex sets INDEX_REV when unset from pre-read snapshot (race before first tick); bd:* shares Script Cache capacity; admin can duplicate others' private templates (D11).
  - Accepted: 9bbd262 bundle as JSON literal + (0, eval) (fuzzed 191k strings, round-trips); lock-free loadIndex; body cache bd:<bodyFileId> behind dispatch; requestTiming bounds 0..600000 ints.
  - Defect 7 iframe focus unverified; owner checks Tab into tree, Shift+F10 vs Chrome menu.

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

- Slice 7 docs (2026-11-10): FAIL (039392e). 52 files, 1244 tests, Code.js 318.9 KB, 10 scopes. 64 doc claims checked against src.
  - Must fix: runbook.md:21 password and 2SV handover person to person (fix: Workspace admin resets, new holder enrolls). Quick start D18 omits insert log lines (actor + targetId) and usage.json recent per email.
  - Minors: Recent "about 5 min" is up to 15 (tick + 10 min view cache); forward subject unverified; grid "By" column; QUOTA Retry not disabled (notice); image width fixed 600; quick start 1,087 words.
  - Confirmed spec/ADR errata: spec 7 NOT_CONFIGURED/AUTH/SERVER texts, spec 8/12 4 vs 10 Lighthouse views, NOT_IMPLEMENTED dead in status.ts, ADR-0004 profile clear not built.

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
