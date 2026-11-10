# Implementer memory

## Environment facts (2026-11-09)
- Worktrees may start at an old commit. Reset to the orchestrator branch `claude/gracious-franklin-3n8zbq` first (task prompt gives the command).
- Worktree guard rejects some heredocs and multi-command scripts it cannot verify (cat > file heredoc, `git` plus python in one command, backslash-heavy python). `python3 - <<'EOF'` edits alone usually pass; new files go through the Write tool; fall back to the Edit tool.
- Chromium for browser checks: /opt/pw-browsers/chromium. puppeteer-core and chrome-launcher arrive with lighthouse (dev dep). Scratch scripts that import repo code must live inside the worktree (delete before commit).
- No external binaries (permission classifier). Node 22.23.4, npm 10.9.9; clasp login impossible here.

## Lessons
- Always prove the lock file with `rm -rf node_modules && npm ci` before reporting. Slice 1 failed review on that. Run `prettier --write` before every commit.
- Boundary checks must match path segments (`../server`, `server/x`), not only `/server/`.
- Test ID generators: an LCG's low bits cycle fast; use high bits (`Math.floor(seq / 65536) % n`), or IDs collide.
- Real runtime uses `Date.now()`; entry tests need `vi.useFakeTimers({ now, toFake: ["Date"] })`.
- `tick` order matters: cache upkeep before anything that calls `loadIndex`, or upkeep never sees a miss.
- Lint traps: `no-unnecessary-type-parameters` (generic used once), `no-confusing-void-expression` (arrow shorthand returning void), `no-dynamic-delete`, `no-misused-spread` on class instances.

## Toolchain decisions (slice 1)
- typescript 6.0.3 (typescript-eslint 8.72.2 peer `<6.1.0`). eslint 10.14.0 `defineConfig`. vitest 5.1.0. @types/node 22.20.5 pinned for vitest's peer range.
- Pure build helpers in `scripts/lib/*.mjs`, impure in `scripts/tools.mjs`. Prettier skips docs except docs/ops.
- Build constants `__APP_ENV__`, `__EXEC_URL__`, `__GIT_SHA__`. Stubs `function name(...args) { return App.name(...args); }`.
- clasp 3.4.1: global `--json`, `-P <dir>`; `.clasp.json` `rootDir` relative to itself; `push --force` overwrites the manifest.

## Code map (after slice 2)
- `src/shared/permissions/`: principals.ts, effective.ts (`levelResolver`, `PRIVATE_OWNER_LEVEL`), levels.ts, matrix.ts (`ROLE_MATRIX` 17 rows, `checkNeed`, `ROOT`, `ANY_CALLER`).
- `src/shared/`: entryPoints.ts (allowlist, `TRIGGER_JOBS`), ids.ts, text.ts, model/data.ts, model/validate.ts, errors/codes.ts (details on AppError).
- `src/server/services.ts`: `Services` port bag (props, cache, lock, session, logger, nowMs, newId, sha256, sanitize, drive, store, groups, directoryUsers, triggers, appVersion, stats). runtime.ts builds it from globals.
- `src/server/dispatch/`: policy.ts (40 rows, action + targets + surface), targets.ts, context.ts (lazy `access()`), dispatch.ts, handle.ts, handlers.ts (`LATER_SLICE_OPS` stubs), args.ts.
- `src/server/handlers/`: folders, templates, grants, identity, spikes, indexOps, versions.
- `src/server/storage/`: port.ts, driveClient.ts, advancedDrive.ts, restDrive.ts, driveStore.ts, setupStore.ts (`STORE`), writer.ts (`mutateIndex`, `commitLocked`).
- `src/server/cache/`: chunked.ts, indexCache.ts (`INDEX_REV`, `loadIndex`, `loadIndexForWrite`).
- `src/server/audit/`: events, buffer (`evt:*`), lines, roll, usage. `src/server/jobs/`: tick, daily, health, triggers, setup.
- `src/server/membership/`: resolver.ts, snapshot.ts. `src/server/directory/profile.ts`. `src/server/guards.ts`. `src/addon/guard.ts`.
- `test/fakes/`: drive.ts (Drive.Files + REST responder, `failNext`), groups.ts (GroupsApp, Directory), world.ts (`setupWorld`, `call`, `ok<T>`), globals.ts (stub all globals from a world), lock.ts counts `nestedAcquisitions`.

## Code map (after slice 3)
- `src/shared/placeholders/`: grammar.ts (`TOKEN_PATTERN`, `parseText`, `promptKey`), validate.ts (`scanBody`, 7 codes + `PH_NO_FALLBACK`), render.ts (`renderBody`, `promptsFor`, implicit key `{var}<name>`), registry.ts, distance.ts.
- `src/shared/sanitize/`: sanitize.ts (`sanitizeHtml` repeats until stable, 100 KB out, 1 MB in), attrs.ts (own-property lookups), css.ts, policy.ts. `src/shared/html/escape.ts` (canonical escaping, `textRuns`, `mapTextRuns`). `src/shared/body/prepare.ts` (`prepareBody` = write path).
- Server: handlers/body.ts (`IMG_HOSTS`, `prepareFor`, `readableBody`), handlers/history.ts (`version.list/get/restore`), `template.getBody`. `Services.sanitize` removed. `rpc(op, args, requestId)`.
- `src/web/`: app.ts (`startApp(host)`), host.ts (google.script wrapper), router.ts, rpc/{client,api}.ts, editor/{schema,load,serialize,setup,commands,toolbar,picker}.ts, ui/{dom,dialog,menu,status}.ts, views/{library,tree,grid,editor,history,preview,problems,tags,context}.ts, dev-harness.ts.
- scripts/web.mjs (`webPage({harness})`, `servePage`, `DEV_PAGE_VALUES`), dev-web.mjs, lighthouse.mjs. build.mjs uses webPage.
- Tests: test/unit/web/* (jsdom per file, `stubLayout` for ProseMirror), app.test.ts boots harness + app via dynamic import and `vi.resetModules`.

## Lessons (slice 3)
- PM DOMParser reads `element.style` and DOMSerializer writes `style.cssText`: colors become `rgb()`. Parse the `style` attribute text and serialize by hand.
- PM parse collapses trailing whitespace; `<p>Hi </p>` becomes `Hi`.
- htmlparser2 implied closes regroup tags after unwrapping, so one pass is not idempotent; loop until stable.
- `<base target="_top">` in HtmlService sends `#` links to the top window; handle nav in script.
- Lighthouse `label-content-name-mismatch`: aria-label must contain the visible text. Scrollable `pre` needs `tabindex=0`.

## Code map (after slice 4)
- `src/addon/`: entry.ts (12 callbacks, `respond` = guard, QUOTA `notBefore` wait, flow, render), flows.ts (`Ports` = call, User Cache, nowMs, userEmail, execUrl; home, folder, preview, insert, promptInsert, openLink, spike flows), view.ts (`view:*` chunks 600 s, `body:<id>`), event.ts (params, formInputs, `internalRecipient`), prompts.ts (p-n names, 20 fields, 500 chars).
- `src/addon/cards/`: spec.ts (`CardSpec`, `Reply`, `CALLBACKS`), render.ts (only Card Service code, escapes all text), home, folder (20 per page), preview, prompt, states (`stateCard`, `waitSeconds`), spike (TEMPORARY).
- Server: handlers/sidebar.ts (`sidebarHome`, `templateApply`, `senderOf`, `recipientFirstName`), handlers/spikeS4.ts (TEMPORARY). Shared: model/sidebar.ts, placeholders/preview.ts, cache/{chunked,store}.ts (moved from server), spike/s4Fixtures.ts (TEMPORARY).
- `callServer` returns `{ requestId, response }`; blank execUrl gives NOT_CONFIGURED. Unset `DOMAIN` gives NOT_CONFIGURED.
- Tests: test/unit/addon/flows.test.ts wires `Ports.call` to `world.call(..., "addon")` (real server); fixtures.ts holds view data (never import one test file from another: its tests run twice).

## Lessons (slice 4)
- `CacheService.getUserCache()` is typed non-null; a null check fails lint.
- A recording CardService fake needs every enum the code reads (`ContentType`, `UpdateDraftBodyType`, `TextButtonStyle`).
- `vi.mock` of src/shared/buildInfo in its own test file covers the blank execUrl branch.
- Slice 4 review FAIL: empty state keyed on folders, but every caller owns a private folder. Key empty states on the content the spec names ("no visible templates"), and test with a private folder present.
- Every server-checked action needs a server call right before it acts; cached bodies alone skip the permission check. `template.apply` `followUp: true` = re-check without a second event.
- Payload fields need a reader; review flags unused ones as dead.
- When a feature is removed, grep docs/ops for its UI text (Ping lingered in smoke.md).

## Code map (after slice 4b)
- `src/shared/requestId.ts`: `newRequestId`, `requestIdNow` (`XXXXXXXX-XXXXXX`), used by web, add-on, `web.open`, rpc fallback.
- `src/server/metrics.ts`: `newStats`, `meterProps/Cache/Lock/Drive/Directory` (method table `Record<keyof T, true>`, method looked up per call so test monkeypatches work), `snapshotProps` (one `getProperties` per request; triggers live). `Services.startedMs`; `RequestStats` has `calls` and `ms`.
- Log line: `calls`, `timing` (numbers only); add-on sends `timing` (`requestTiming` in protocol.ts filters keys and ranges).
- `loadIndex` is lock-free; `maintain` runs in `doGet` only. Body cache `bd:<bodyFileId>` in handlers/body.ts (`readStoredBody`, `cacheBody`).
- Web: views/rowActions.ts (row menu), grid "Actions" column, `AppContext.pushRoute`, library selects folders in place, `openDialog({ returnFocus })`.


## Lessons (slices 4b to 6b, merged)
- Snapshots break read-check-write; re-read live in the lock.
- Old-code check: `git checkout <base> -- src`, run, `git reset -q; git checkout HEAD -- src` (base-only files: `git rm -f`).
- Call counts: scratch test with Proxy counters or `appendFileSync` of `world.lines`; delete before commit.
- `handleRpc` enforces `REQUEST_ID_PATTERN` (tests send `TESTREQ0-000001`); every client string in a log needs a server format check and an upper bound.

- Prettier may reformat after other edits; run `prettier --write` before every commit.
## Code map (after slice 5)
- Subject: shared/placeholders/subject.ts (`SUBJECT_MAX`, `controlIndex`, `oneLine`); `scanBody(html, attrTokens, subject)` scans subject first, `field: "subject"`; `renderSubject`, `promptsFor(html, values, subject)`; `prepareBody(raw, options, subject)`; `prepareFor(props, html, subject)`, `readableBody(props, stored, subject)`.
- Old data: `readIndexDoc`, `withSubject`, `Unmigrated<T>` in shared/model/data.ts (driveStore read + `cachedIndex`).
- Add-on: `insertReply(html, subject)` pure builder (spec.ts); `SKIP_SUBJECT`, `SUBJECT_SWITCH`, `SWITCH_ON`, `SEARCH_INPUT` in spec.ts; Widget item `toggle`, input `hint`/`onChange`; `searchFlow`, `onSearch`; `folderItem`/`templateItem` live in cards/folder.ts.
- Search: shared/search/match.ts (`parseQuery`, `score`, `rank`, `fold`). Server `search` in handlers/sidebar.ts (`visibleTemplates`, `visiblePath`), `searchBody` in templates.ts, `ft:<bodyFileId>` + `bodyTexts` (25 misses) in body.ts.
- Favorites/Recent: handlers/favorites.ts (`callerLists`, `callerRecent`, `favoriteSet/Unset` under lock); cache/sideCache.ts (`FAVORITES_REV`, `USAGE_REV`, `readSideCached`, `publishSide`, `writeSideLocked`); setup and tick publish.
- Web: `searchItems` (library/model.ts), `AppContext.favorites/recent/setFavorite`, grid star + `GridActions.isFavorite/toggleFavorite`, `subjectPickerItems` (picker.ts).

## Lessons (slice 5)
- Worktree guard rejects bash heredocs with python edits; use scratchpad ed.py (`@@@ path`, `<<<`, `===`, `>>>` blocks) written with the Write tool, or the Edit tool.
- New side-file reads need a published rev property, else readers never cache (warm counter test catches it).

## Code map (after slice 5b)
- D24 (slice 5c): `DRAFT_FIELDS`, `requestDraft` with `hasSubject` (protocol.ts); `draftInfo`, `draftHasSubject` (addon/event.ts); truth table `replacesSubject`, `WITH_SUBJECT` (cards/spec.ts). Gmail compose events carry no threadId/messageId. `ports(event)` sends `draft` on every call; server logs `draft` only when valid, else VALIDATION.
- `folderLabel` in folders.ts: `folder.list` renames other users' private folders "My templates (owner)".
- Web: `formatTime` local; `conflictText` in status.ts; `DialogAction.autofocus`; rowMenu takes `{ busy, done }`; library `bodyPending`.

## Lessons (slice 5b)
- Do not build a rule on undocumented event fields before a diagnostics run; 5b's threadId rule never fired.


## Code map (after slice 6a)
- Server: handlers/admin.ts (`adminFolders` DENIED for non-managers, `membershipStatus/Refresh` view with counts, `trashPurge`); jobs/daily.ts `purgeDeleted(services, cutoff, source, write)`; targets.ts `restoreTargets`; dispatch `recheck` re-reads the snapshot for admin rows; triggers create-then-delete, `recordJobError` (health.ts); `TRASH_DAYS`, `FOLDER_DEPTH_MAX` in shared/model/validate.ts.
- Web: router `trash`, `admin` (tab folders|memberships), `?view=admin`; views/admin.ts (tablist), adminFolders.ts, memberships.ts, trash.ts; admin/model.ts (pure); tree `rootLabel`; rail Admin link from `manage` levels; harness `?admin=0`, grants, memberships, trash ops.
- Tests: test/unit/server/admin.test.ts (6-role matrix with `calls.drive` 0 on DENIED), test/unit/web/admin.test.ts.

## Code map (after slice 6b)
- Server: handlers/audit.ts (`audit.query`, `aud:<month>` cache keyed `<fileId>.<size>`), audit/query.ts (pure filter, page 50), handlers/config.ts (`config.get`, `jobStatus`, `backup.list`, `backup.restore` via `withLock` + `commitLocked` + `context.recheck`), handlers/transfer.ts (export pages of 20, import Validate/Import), transfer/format.ts (parse, limits), transfer/plan.ts (pure placement). `usageReport` in admin.ts. StorePort `readBackup`, `readText`, `listAuditFiles` sized. Buffer `BUFFER_MAX` 200 + `evt:dropped` -> `audit.dropped`. `LATER_SLICE_OPS` gone. `IMPORT_MAX_BYTES`, `IMPORT_ITEMS_MAX` in shared/model/validate.ts.
- Web: router `ADMIN_TABS` (6), admin.ts `openTab`, views/adminAudit, adminUsage, adminTransfer, adminConfig; dialog `variant: "drawer"`; admin/model.ts `exportFileName`, `localDayStart`, `formatBytes`, `importSummary`. Harness ops for all 8.
- Tests: test/unit/server/adminReports.test.ts, test/unit/web/adminReports.test.ts.

## Lessons (slice 6b)
- Dialog actions close in a microtask (focus asserts need `until`). First admin call after `setupWorld` reads `members.json` (cold `gm:*`).
- Fake cache has no `clear`; remove `bd:<fileId>` keys to force body reads.
- 6b review FAIL: data read back from Drive (backups) needs a shape check before it is written (shared/model/shape.ts). Multi-file writes: keep the old copies, write sides first, index last, undo on failure.
## Lessons kept from 5b to 6b
- `app.fail(error)?.textContent` leaks banner link text; use `lineText` for status lines.
- `app.fail(error)?.textContent` leaks banner link text; use `lineText` for status lines. jsdom: `vi.stubEnv("TZ", ...)` changes Date local time.
- A negative test must fail for the reason under test. Check accepted ADRs before following a review fix request.

## Slice 8a (UI shell, 2026-11-10)
- Shell owns the sidebar tree (`createFolderTree(onOpen, null)`), `drawSide` after every load; library implements `View.scope(folderId, favorites)` for in-place selection. Icons `ui/icons.ts`, people `ui/person.ts`, `folderCounts`, `formatTime(iso, "date"|"time", now)`.
- Tests read titles via `.row-title`; sidebar tree via `#side [role="tree"]`. Harness `?sample=freight` for screenshots only.
- Screens: Playwright `chromium.launch()`, context `colorScheme`, `timezoneId: "UTC"`; script in the scratchpad loads repo code by absolute path with `createRequire`. Lighthouse dark: Chrome `--force-dark-mode`.
- The scratchpad is shared with other sessions: an `ed.py` got overwritten. Use unique file names.
- 8a review FAIL: a panel that covers content must be modal (trap, inert, outside press closes); icon colors need 3:1 on every fill they sit on (paper, canvas, select). `test/unit/web/contrast.test.ts` now gates token pairs. Focus selectors: `a[href]`, never `[href]` (SVG `<use>`).

## Slice 9 task 1 (spike S6 harness, 2026-11-10)
- TEMPORARY: src/addon/spikeS6.ts (pure builders, flows gated on env `dev`), `onS6Card`/`onS6Apply`, Reply kind `s6`, `s6Response` in render.ts, home `s6Sections`. Inventory in docs/handoffs/2026-11-10-implementer-to-reviewer-slice-09-s6.md.
- `UpdateDraftActionResponse` cannot update the card or notify; harness results go into the draft body.
- Env-gated card tests: `vi.hoisted` mutable `BUILD_INFO` mock in its own file. Adding to `CALLBACKS` auto-covers the guard test.

## Slice 10 (S7 harness + side-panel interim fix, 2026-11-10)
- Permanent: `entryOf`, `messageIdOf`, `Entry` (event.ts); `Ports.entry` set in `ports(event)`; `templateItem(t, entry, below)`, `folderCard(..., entry)`, `homeCard(view, entry)`, `searchCard(..., entry)`, `previewCard(..., entry)`; `TOOLBAR_HINT` (home.ts); `onMessageOpen` + manifest `contextualTriggers` `unconditional`; `ButtonSpec.compose` -> `setComposeAction`.
- TEMPORARY: src/addon/spikeS7.ts, `onS7Card/Compose/Notify`, Reply kinds `s7`, `s7Error`, test/fakes/gmail.ts. Inventory in docs/handoffs/2026-11-10-implementer-to-reviewer-slice-10-s7.md.
- Harness guard stays outside the error wrapper (the guard test expects a throw). `perl -0pi` multi-file edits pass the worktree guard; python heredocs do not.

## Slice 8c (admin UI, 2026-11-10)
- `views/adminTable.ts` (`adminTable`, `tableRow` with `data-label`, `noteRow`, `toneTag`); `admin/actions.ts` (`actionWords`, `resultTag`, `purgeText`). Tint tokens `--ok-bg`, `--warn-bg`, `--red-bg`.
- Admin h1 then tab h2s (Lighthouse heading order). Admin tables stack under 860 px via `td[data-label]::before`.
- Worktree guard refuses `cmd && python3 - <<EOF`; scratchpad `ed8c.py` (@@@/<<</===/>>>) run alone works. Screens: scratchpad `shoot8c.cjs`, dev server on a fixed port, rebuild by restart.
- Count harness calls in jsdom: wrap `window.google.script.run` (host reads `script.run` per call).

## Conventions
- Op names follow spec section 6 (`template.*`, `version.*`), not task aliases; record the mapping in the handoff.
- Arg names: templates `id`, `baseVersion`, `folderId`, `title`, `tags`, `html`; folders `folderId`, `parentId`, `name`; grants `folderId`, `principalType`, `principalKey`, `level`, `grantId`.
- Server code never nests the script lock; tests assert `lock.nestedAcquisitions === 0`.

## Slice 7 (docs, 2026-11-10)
- Guides in docs/guide (Prettier-ignored), runbook in docs/ops (Prettier-formatted). test/unit/docs/links.test.ts checks relative links of README and the 4 docs.
- D25: prod owned by a dedicated owner account (generic `templates-owner@migway.com`); dev stays; prod starts empty.
- Doc rule: quote UI text from src; mark "not yet verified on dev" (6b not deployed at fb97d9a) and "not yet exercised" (2.5b, recovery, handover).

## Open items handed forward
- Spec 7 sidebar texts (NOT_CONFIGURED, AUTH_NO_USER, SERVER) differ from code; `NOT_IMPLEMENTED` used only by the harness; `membership.refresh` does not clear `prof:*`.
- Smoke step with a 4.9 MB import (spec 13.5) not written.
- Not verified against Google: `getActiveUser` in triggers, triggerUid values, 5 MB `google.script.run` arg, drift check vs Apps Script reformatting.
