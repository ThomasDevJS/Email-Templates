# Implementer memory
## Environment facts (2026-11-09)
- Worktrees may start at an old commit. Reset to the orchestrator branch `claude/gracious-franklin-3n8zbq` first (task prompt gives the command).
- Worktree guard rejects some heredocs and multi-command scripts (cat > file heredoc, cat-heredoc appends, `cd X && python3 - <<EOF`, `git` plus python, backslash-heavy python). Run `python3 - <<'EOF'` edits alone; new files via Write; fall back to Edit.
- Chromium for browser checks: /opt/pw-browsers/chromium. puppeteer-core and chrome-launcher arrive with lighthouse (dev dep). Scratch scripts that import repo code must live inside the worktree (delete before commit).
- No external binaries (permission classifier). Node 22.23.4, npm 10.9.9; clasp login impossible here.

## Lessons
- Always prove the lock file with `rm -rf node_modules && npm ci` before reporting. Slice 1 failed review on that. Run `prettier --write` before every commit.
- Real runtime uses `Date.now()`; entry tests need `vi.useFakeTimers({ now, toFake: ["Date"] })`.
- Lint traps: `no-unnecessary-type-parameters` (generic used once), `no-confusing-void-expression` (arrow shorthand returning void), `no-dynamic-delete`, `no-misused-spread` on class instances.
- Toolchain (slice 1): typescript 6.0.3 (typescript-eslint 8.72.2 peer `<6.1.0`), eslint 10.14.0 `defineConfig`, vitest 5.1.0, @types/node 22.20.5. Pure build helpers in `scripts/lib/*.mjs`, impure in `scripts/tools.mjs`. Prettier skips docs except docs/ops.

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


## Code map (after slice 4)
- `src/addon/`: entry.ts (12 callbacks, `respond` = guard, QUOTA `notBefore` wait, flow, render), flows.ts (`Ports` = call, User Cache, nowMs, userEmail, execUrl; home, folder, preview, insert, promptInsert, openLink, spike flows), view.ts (`view:*` chunks 600 s, `body:<id>`), event.ts (params, formInputs, `internalRecipient`), prompts.ts (p-n names, 20 fields, 500 chars).
- `src/addon/cards/`: spec.ts (`CardSpec`, `Reply`, `CALLBACKS`), render.ts (only Card Service code, escapes all text), home, folder (20 per page), details (slice 15; preview and prompt cards gone), states (`stateCard`, `waitSeconds`).
- Server: handlers/sidebar.ts (`sidebarHome`, `templateApply`, `senderOf`, `recipientFirstName`), handlers/spikeS4.ts (TEMPORARY). Shared: model/sidebar.ts, placeholders/preview.ts, cache/{chunked,store}.ts (moved from server), spike/s4Fixtures.ts (TEMPORARY).
- `callServer` returns `{ requestId, response }`; blank execUrl gives NOT_CONFIGURED. Unset `DOMAIN` gives NOT_CONFIGURED.
- Tests: test/unit/addon/flows.test.ts wires `Ports.call` to `world.call(..., "addon")` (real server); fixtures.ts holds view data (never import one test file from another: its tests run twice).

## Lessons (slice 4)
- Slice 4 review FAIL: empty state keyed on folders, but every caller owns a private folder. Key empty states on the content the spec names ("no visible templates"), and test with a private folder present.
- Every server-checked action needs a server call right before it acts; cached bodies alone skip the permission check. `template.apply` `followUp: true` = re-check without a second event.

## Code map (after slice 4b)
- shared/requestId.ts (`requestIdNow`); server/metrics.ts (`meter*`, `snapshotProps`: one `getProperties` per request); log `calls`, `timing`; body cache `bd:<bodyFileId>`; web views/rowActions.ts, `AppContext.pushRoute`.

## Lessons (slices 4b to 6b, merged)
- Snapshots break read-check-write; re-read live in the lock.
- Old-code check: `git checkout <base> -- src`, run, `git reset -q; git checkout HEAD -- src` (base-only files: `git rm -f`).
- `handleRpc` enforces `REQUEST_ID_PATTERN` (tests send `TESTREQ0-000001`); every client string in a log needs a server format check and an upper bound.

## Code map (after slice 5)
- Subject: shared/placeholders/subject.ts (`SUBJECT_MAX`, `controlIndex`, `oneLine`); `scanBody(html, attrTokens, subject)` scans subject first, `field: "subject"`; `renderSubject`, `promptsFor(html, values, subject)`; `prepareBody(raw, options, subject)`; `prepareFor(props, html, subject)`, `readableBody(props, stored, subject)`.
- Old data: `readIndexDoc`, `withSubject`, `Unmigrated<T>` in shared/model/data.ts (driveStore read + `cachedIndex`).
- Add-on: `insertReply(html, subject)` pure builder (spec.ts); `SUBJECT_SWITCH`, `SWITCH_ON`, `SEARCH_INPUT` in spec.ts; Widget item `toggle`, input `hint`/`onChange`; `searchFlow`, `onSearch`; `folderItem`/`templateItem` in cards/folder.ts.
- Search: shared/search/match.ts (`parseQuery`, `score`, `rank`, `fold`). Server `search` in handlers/sidebar.ts (`visibleTemplates`, `visiblePath`), `searchBody` in templates.ts, `ft:<bodyFileId>` + `bodyTexts` (25 misses) in body.ts.
- Favorites/Recent: handlers/favorites.ts (`callerLists`, `callerRecent`, `favoriteSet/Unset` under lock); cache/sideCache.ts (`FAVORITES_REV`, `USAGE_REV`, `readSideCached`, `publishSide`, `writeSideLocked`); setup and tick publish.
- Web: `searchItems` (library/model.ts), `AppContext.favorites/recent/setFavorite`, grid star + `GridActions.isFavorite/toggleFavorite`, `subjectPickerItems` (picker.ts).

## Code map (after slice 5b)
- D24 (slice 5c): `DRAFT_FIELDS`, `requestDraft` with `hasSubject` (protocol.ts); `draftInfo`, `draftHasSubject` (addon/event.ts); truth table `replacesSubject`, `WITH_SUBJECT` (cards/spec.ts). Gmail compose events carry no threadId/messageId. `ports(event)` sends `draft` on every call; server logs `draft` only when valid, else VALIDATION.
- `folderLabel` in folders.ts: `folder.list` renames other users' private folders "My templates (owner)".

## Code map (after slice 6a)
- Server: handlers/admin.ts (`adminFolders` DENIED for non-managers, `membershipStatus/Refresh` view with counts, `trashPurge`); jobs/daily.ts `purgeDeleted(services, cutoff, source, write)`; targets.ts `restoreTargets`; dispatch `recheck` re-reads the snapshot for admin rows; triggers create-then-delete, `recordJobError` (health.ts); `TRASH_DAYS`, `FOLDER_DEPTH_MAX` in shared/model/validate.ts.
- Web: router `trash`, `admin` (tab folders|memberships), `?view=admin`; views/admin.ts (tablist), adminFolders.ts, memberships.ts, trash.ts; admin/model.ts (pure); tree `rootLabel`; rail Admin link from `manage` levels; harness `?admin=0`, grants, memberships, trash ops.
- Tests: test/unit/server/admin.test.ts (6-role matrix with `calls.drive` 0 on DENIED), test/unit/web/admin.test.ts.

## Code map (after slice 6b)
- Server: handlers/audit.ts (`audit.query`, `aud:<month>` cache keyed `<fileId>.<size>`), audit/query.ts (pure filter, page 50), handlers/config.ts (`config.get`, `jobStatus`, `backup.list`, `backup.restore` via `withLock` + `commitLocked` + `context.recheck`), handlers/transfer.ts (export pages of 20, import Validate/Import), transfer/format.ts (parse, limits), transfer/plan.ts (pure placement). `usageReport` in admin.ts. StorePort `readBackup`, `readText`, `listAuditFiles` sized. Buffer `BUFFER_MAX` 200 + `evt:dropped` -> `audit.dropped`. `LATER_SLICE_OPS` gone. `IMPORT_MAX_BYTES`, `IMPORT_ITEMS_MAX` in shared/model/validate.ts.
- Web: router `ADMIN_TABS` (6), admin.ts `openTab`, views/adminAudit, adminUsage, adminTransfer, adminConfig; dialog `variant: "drawer"`; admin/model.ts `exportFileName`, `localDayStart`, `formatBytes`, `importSummary`. Harness ops for all 8.
- Tests: test/unit/server/adminReports.test.ts, test/unit/web/adminReports.test.ts.

## Lessons (slices 5b to 6b)
- Dialog actions close in a microtask (focus asserts need `until`). First admin call after `setupWorld` reads `members.json` (cold `gm:*`).
- 6b review FAIL: data read back from Drive (backups) needs a shape check before it is written (shared/model/shape.ts). Multi-file writes: keep the old copies, write sides first, index last, undo on failure.
- `app.fail(error)?.textContent` leaks banner link text; use `lineText`. jsdom: `vi.stubEnv("TZ", ...)` changes Date local time. A negative test must fail for the reason under test. Check accepted ADRs before following a review fix request.

## Slice 8a (UI shell, 2026-11-10)
- Shell owns the sidebar tree (`createFolderTree(onOpen, null)`), `drawSide` after every load; library implements `View.scope(folderId, favorites)` for in-place selection. Icons `ui/icons.ts`, people `ui/person.ts`, `folderCounts`, `formatTime(iso, "date"|"time", now)`.
- Screens: Playwright `servePage(localPage(webPage({harness:true})))`, `colorScheme`, `timezoneId: "UTC"`. Scratchpad is shared: unique file names. Playwright: createRequire("/opt/node-tools/node_modules/"), dev-web port 5188.
- 8a review FAIL: a panel that covers content must be modal (trap, inert, outside press closes); icon colors need 3:1 on every fill they sit on (paper, canvas, select). `test/unit/web/contrast.test.ts` now gates token pairs. Focus selectors: `a[href]`, never `[href]` (SVG `<use>`).
## Slice 9 (recipients, D26, 2026-11-10; S6 harness removed, record docs/spikes/slice-09-s6.md)
- shared/model/recipients.ts: `validateRecipients`, `importRecipients`, `splitBlocked`, `recipientsOf` (absent = []), `RECIPIENTS_EXTERNAL_KEY`. `to/cc/bcc` OPTIONAL on Item/BodyFile so src/web builds unchanged.
- `prepareBody(raw, opts, subject, {lists, policy})`; server `prepareFor(props, html, subject, lists)`, `recipientPolicy(props)` (body.ts). `template.update` keeps lists left out of args (`keptStringArray`).
- Add-on: cards/recipients.ts (`recipientPlan`, `recipientActions` = draft list + new, REPLACE), `draftRecipients` (event.ts), `Ports.hash` (`rh`).
- Retry 1: draft lists are known or unknown (`DraftRecipients`, null); an unknown field never gets a replace action. `recipientWidgets` is the single source of recipient lines on both cards. Version-file lists: `isStoredList`, `unreadableRecipients`.
## Slice 10 + 18 (side panel, D27; S7 harness removed in 18)
- event.ts `entryOf`, `messageIdOf`, `tokenOf`, `addressesOf`, `internalAddress`; `onMessageOpen`; `ButtonSpec.compose` -> `setComposeAction`; Reply kind `compose` -> ComposeActionResponse.
- src/addon/panel.ts `composeFlow` (row, `onCompose`), `promptComposeFlow` (details, `onPromptCompose`), `failureText`, `panelVisible` (one catch). `Ports.gmail` (`GmailPort`, getter in entry.ts). flows.ts `rendered(body, input)` = the one render step of all 4 paths. cards/sidePanel.ts `COMPOSE_AS`, `composeButton`; `panelDetailsCard(state, entry)`; `recipientWidgets(plan, domain, typing)`.
- Follow-up 1: Gmail showed no notification from a compose action on a row (part J step 11). `panelAnswer` throws `Error(<one plain sentence>)` for every panel failure; flows return `PanelReply` (compose | notify).
- Follow-up 2 (D33): message rows = item without button + ButtonSet Reply/Reply all; `templateItem` returns Widget[], `listSection(header, rows: Widget[][])`.
- test/fakes/gmail.ts `createRecordingGmail(headers|null, failMethod)`; test/unit/addon/panel.test.ts. Commit trailer: use the system attribution lines (model named there), not a model name from an agent prompt.
## Slice 12 (add-on layout and wording, 2026-11-11)
- Model: `title?`, `ButtonSpec.style` filled|outlined (filled = slate `SLATE` via setBackgroundColor), item `icon` (Material name only), `SectionSpec.collapseAfter`, `LIBRARY_FOOTER`.
- `templateItem(t, entry, path, icon)`: one-line bottom label path · hints (path "" on folder cards). Labels get escapeText, never `<br>`. `listSection` drops empty, collapses past `VISIBLE_ROWS` 5.
- `sidePanelHint(entry)` in cards/sidePanel.ts holds `TOOLBAR_HINT` (last section of panel cards).
## Slice 8d (web minors, 2026-11-10)
- `setInert(el, on)` in ui/dialog.ts (inert + aria-hidden) used by the panel and `openDialog` (all body children but the backdrop and #toasts; undo before refocus).
- `person(email, showAddress)`: audit shows the address as a 12 px `--ink-3` line; elsewhere tooltip plus sr-only " (address)".
- Focus ring rule: on the active item (`outline-offset: -2px`), never around a listbox. Stacked labels `content: attr(data-label) / ""`.
- CSS-only fixes get a text test in test/unit/web/styles.test.ts. Old-code check: copy src/web to scratchpad, `git checkout HEAD -- src/web`, run, copy back.
## Slice 8b (editor direction A, 2026-11-11)
- views/editor.ts builds the work area once in `build()` after `loading` (level from `app.items()`; `use` = read-only); `savedText`, `panelSection`, `panelTabs`, `editorSkeleton`. views/recipients.ts `recipientField` (chips, `splitAddresses`, `recipientBlock`). preview.ts `blankHtml`, `promptUses`, `recipientLines`. schema `blankParts`, names "Field: ...". toolbar `GROUPS`, `tooltip`, `Toolbar.placeholder`. commands `imageWidth`. `api.me()`.
- `button { display }` beats `[hidden]`: the editor has `.editor-page [hidden] { display: none }`. Harness `?external=deny` (seeding stays allow), `?unreadable=`.
- Guard: `View.canLeave(leave)`, app.ts `leaving()` + onBackForward hold; editor `dirty()` needs `mount.isConnected` (old apps in tests keep window listeners). Font picker shows fixed "Font" (row width).
- Retry 1: `Editor.hold()` bookmark for dialog inserts; editor keeps one `asking` dialog; `Host.go`, `onBackForward(hash, moved)` from `{page, at}` history state; Problems tab = live errors + save's others; CSS minified in web.mjs `minifiedStyles`. jsdom: `history.go` fires popstate; caret via DOM selection + `selectionchange`.
- Merge with main (slice 11, 13): `cancelDialogs()` runs in 2 places only: `open()` in the Back/Forward handler (app.ts, when the route really changes) and the editor's `canLeave` before its question (so a held question stays one dialog). Harness `devPolicy` reads `settings.recipientsExternal`; `?external=deny` seeds that setting.
## Slice 11 (admin settings, D29, 2026-11-11)
- shared/model/settings.ts: `SETTINGS` list, `settingsOf` (defaults at read, never written), `personalTemplatesOn`, `settingsProblem` (in `indexProblem`), `PERSONAL_OFF_TEXT`. `IndexDoc.settings` optional.
- Off rule in `levelResolver` before the admin rule; dispatch `deniedError(index, targets)` picks the off text. `recipientPolicy(context)` reads the setting; the property reader is gone.
- Tests: `setSetting(world, name, value)` in test/fakes/world.ts; D11 tests turn personal templates on in `beforeEach`. Enforcement table in test/unit/server/settings.test.ts. Harness `?personal=off`, `?access=none`.
## Conventions
- Op names follow spec section 6 (`template.*`, `version.*`), not task aliases; record the mapping in the handoff.
- Arg names: templates `id`, `baseVersion`, `folderId`, `title`, `tags`, `html`; folders `folderId`, `parentId`, `name`; grants `folderId`, `principalType`, `principalKey`, `level`, `grantId`.
- Server code never nests the script lock; tests assert `lock.nestedAcquisitions === 0`.
- Docs: guides in docs/guide (Prettier-ignored), runbook in docs/ops (Prettier-formatted); test/unit/docs/links.test.ts checks links; quote UI text from src.
## Open items handed forward
- Spec 7 sidebar texts (NOT_CONFIGURED, AUTH_NO_USER, SERVER) differ from code; `NOT_IMPLEMENTED` sent only by the harness (web text removed in 8d); `membership.refresh` does not clear `prof:*`.
- Not verified against Google: `getActiveUser` in triggers, triggerUid values, 5 MB `google.script.run` arg, drift check.
## Slice 20a (fix round, 2026-11-11)
- Admin `AdminFolders { current, refresh }` shared by tabs. app.ts `firstLoad` (15 s, Reload), first history entry stamped, held Discard uses `go(moved)`. `hold().run` clears the DOM selection (Chromium caret). Export `run` key -> `exps:<run>` 60 s. `newId` from sha256(getUuid). `NOT_SET_UP_TEXT` in shared/errors/codes.ts.
- Fail-before check: scratchpad script `git diff src > p; git checkout -- src; vitest -t; git apply p` (guard rejects it chained inline). jsdom history is shared across tests in a file: assert history state directly, or wait for both popstates.
## Slice 13 (fix round, 2026-11-11)
- `config.set { name, value, baseAt, baseBy }` (last change marker, not `from`); client `conflictEntry` applies CONFLICT `details`; Save uses `aria-disabled` while busy, focus to the status line.
- `recheckRecipients` (body.ts) inside every write commit; `problemsError` shared with `prepareBody`. `trash.purge` returns `templates`, `folders`.
- Retry 2 (replaces retry 1 export design): `export.* { start: true }` commits one event via `commit` and returns `{ token, total }`; token `exp:<id>` in Script Cache, 600 s sliding, bound to caller and scope; pages without it answer VALIDATION `EXPORT_RESTART`. Pages read bodies with `readStoredBody(..., false)` (no cache fill). Buffer: apply|denied only, evicted slot first, `evt:lost` = "<lost> <seen>" in one key. Audit row `exportTemplates`. Web retries any `retryable` error 3 times; harness `&failTimes=n`, `&failSkip=n`. Seed 1,000 templates fast with 5 imports of 200.
- Old `from` args: reload hint. `RequestStats.target` feeds the log `targetId` when args lack `id`/`folderId`.
- `prof:<sha256>` keys; `FakeCache.keys()`. `cancelDialogs()` on Back/Forward; backdrop `preventDefault`. Library folder choice for New template (`lastNewFolder`); harness `?access=use`.
## Slice 14 (wording, 2026-11-11)
- `docs/design/wording.md` is the glossary (things, actions, words never on screen) and the table of 220 changed texts. Review FAIL on stale doc quotes: after any rename, sweep every quoted text in docs/guide and docs/ops/smoke.md against src (not only the renamed ones); errors say "My templates", address boxes are "To, Cc and Bcc" (never "field"), one text per state on all surfaces. New text: check the glossary first. Access = "Who has access", "Give access", "Can use/edit/manage"; field, field name, default text, sender; personal (never private); Delete vs Remove; entry (audit); insert (never apply).
- Web: `exportFailedText(done, total, answer)` (adminTransfer.ts; null = no answer, NETWORK only); editor chip announcer `.sr-only.chip-status`; `JOB_WORDS` (adminConfig.ts). Server: `IMPORT_SETTING_CHANGED`, `recheckOrExplain` (transfer.ts). Harness `?exportPage=<n>`, `fail=NETWORK`.
- Wording tooling that worked: one batch file (file, old, new, reason) applied by a script that also rewrites the same quotes in test/ and docs/, then a table generated from the rows. The guard blocks `git` chained after other commands and long python heredocs: script files via Write, `git` as its own call.
## Slice 16 (in-app admins, D32, 2026-11-11)
- shared/model/admins.ts `adminEntriesOf`, `appAdminsOf`, `ADMINS_MAX`; `isAdminEmail(..., appAdmins thunk)`; `subjectFor(email, snapshot, props, index thunk)`; dispatch recheck passes the in-lock index. Handler handlers/admins.ts: refusals = VALIDATION + `details.reason`.
- Web views/adminAdmins.ts (form `novalidate`). Harness `?admins=none`. Lock races: `beforeNextLock`. Retry 1: `lockedSubject` for every in-lock re-check; `ADMIN_DENIED_TEXT`; Directory failures log `errorCode` "<reason>:<status>".
## Slice 15 (one-click insert, D31, 2026-11-11)
- render.ts `closeGaps(parts)` (null = gap, 4 rules, U+0020 only); typed answer beats a resolved variable. Tests test/unit/shared/gaps.test.ts.
- flows.ts `applyNow(ports, id, extra)` = one template.apply + cached body; Flow A `insertFlow` (`rc` "t,c,b" vs list lengths, unknown draft field -> details card `counted=1`); Flow B `previewFlow` (compose followUp, side panel getBody + `panelDetailsCard`); Flow C `promptInsertFlow` (`counted=1` -> followUp; `mergedValues`).
- cards/details.ts `detailsCard(DetailsState)`, `panelDetailsCard(view, entry)`; test fixture `details()` in test/unit/addon/fixtures.ts. prompts.ts `tooLong`, `shortenText`, `moreFieldsText`. `replacesSubject(draftHasSubject)`.
- Slice 17 (docs smoke sweep): quote check script: extract double-quoted texts, search src with escapes undone and spaces collapsed; hand-check built texts. Admins never lose folder access: access-loss steps need the second account. Web version shows as "Version dev-<sha>" under the short name; "Signed in as" is sr-only.
## Slice 19 (audit read fix, 2026-11-11)
- Advanced `Drive.Files.get` alt=media parses media as JSON: 2+ line JSON Lines throw "Response Code: 200". `DriveClient.readRawText` = Drive REST media (`restMediaReader`) under both clients; used by audit.query, `appendAudit`, `readBackup`. Fake Files.get now parses/throws like the platform; `World.urlFetch` and `installGlobals` answer Drive REST.
- Worktree guard: python edits via a script file in the scratchpad, run alone; never chain `git` or `rm` with other commands. `job:<name>:lastError` stores raw exception messages (can hold content).
## Slice 20b (add-on fix round, 2026-11-11)
- cards/folder.ts `LIST_MAX` (favorites 10, recent 5, folders 40, results 20) + `capped(rows, max, noun)` ends a cut list with "Showing ... Use Search or Open library for the rest."; test/unit/addon/cardLimit.test.ts counts widgets (< 100) for 3 entries. event.ts `mailboxesOf` (first Reply-To answers). `addsLine(plan, reply)`. subject.ts `capSubject` in `renderSubject`. vitest hides console output here: probe via assertions, not logs.
- Slice 21 (D35): render.ts `toAction` sets the load indicator (`INSTANT` = onBack, onOpenLink get NONE); text widget `tone: "error"` -> `<font color=RED>` around escaped text (state cards: first line). Freeze test cardLook.test.ts snapshot; fake CardService needs each new enum. Slice 22 (D36): `tone: "hint"` = DecoratedText, `info` icon, grey via `colored()`; `hint(text)` in spec.ts; `ButtonSpec.icon` (guarded `setMaterialIcon`, missing from typings); Search button under the box. 22b: tone error = DecoratedText + `error` icon alt "Error", no "(!)"; widget kind `columns` (compose search row, `toColumns` with stacked fallback).
