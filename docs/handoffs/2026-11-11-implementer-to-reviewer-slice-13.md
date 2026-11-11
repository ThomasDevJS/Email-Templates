# Handoff: implementer to reviewer, slice 13 (last fix round)

Date: 2026-11-11. Branch `slice/13-fix-round`, base 8f6c972 (merge 24a20f7 one below), head 49f4e9c, 12 commits. Not merged, not pushed.

All 14 build items are done. Each has a test that fails on the old code (checked by putting back the old `src` for items 1, 2, 8, 9 and the web tests). Item 15 is the list at the end.

## Done

| # | Fix | Where | Test |
|---|---|---|---|
| 1 | `config.set` takes `{ name, value, baseAt, baseBy }` (the `updatedAt`, `updatedBy` from `config.get`; "" for the default) in place of `from`. A last change other than the base answers CONFLICT with the current entry in `details`; same value still answers `changed: false`. VALIDATION echoes at most 40 characters of the name (`NAME_ECHO_MAX`, cut by code point). `baseAt`, `baseBy` must be strings of at most 254 | src/server/handlers/config.ts; client src/web/rpc/api.ts, harness | settings.test.ts "A, B, A", VALIDATION table (5,000-char and emoji names, bad base, old `from` arg) |
| 2 | `recheckRecipients(context, current, recipients)` runs inside the lock on create, duplicate, update, version restore and import; under `deny` on the fresh index it throws the save's VALIDATION (`problemsError`, shared with `prepareBody`) | body.ts, templates.ts, history.ts, transfer.ts, shared/body/prepare.ts | races.test.ts, 3 tests (switch flipped between authorize and lock) |
| 3 | `backup.restore` event `after` gains `liveSettingsKept: true` | config.ts | settings.test.ts |
| 4 | `trash.purge` answers `templates` and `folders` (from the index read in the lock); `purgeText(templates, folders)`; `emptyTrashQuestion(n)` singular for 1 | jobs/daily.ts, handlers/admin.ts, web admin/actions.ts, views/trash.ts | admin.test.ts (server), adminActions.test.ts, web admin.test.ts |
| 5 | Log line `targetId`: args without `id` or `folderId` log the first non-root target dispatch resolved (`RequestStats.target`). `grant.remove` logs the folder, ok and denied | metrics.ts, dispatch.ts, handle.ts | admin.test.ts |
| 6 | Export: one `export.folder` or `export.library` event per export, with the first page (`offset` 0): actor, `targetId`, `targetPath`, `after: { scope, templates }`, no content. Buffered as a new `change` kind; `tick` moves it to `pendingAudit` (`TickResult.changes`). Audit log label already existed ("Folder exported", "Library exported") | transfer.ts, audit/buffer.ts, jobs/tick.ts | adminReports.test.ts |
| 7 | Full buffer: a denied event is dropped; an apply or change event overwrites a buffered denied slot (one `getAll` of 200 keys, only when full). Every drop counts in `evt:dropped`. Full of applies and changes: the new event is dropped and counted | audit/buffer.ts | jobs.test.ts, 2 tests |
| 8 | Profile cache key `prof:<sha256 of the lower-case address>`. Old `prof:<email>` keys expire in 6 h. Other keys checked: `idx*`, `gm*`, `evt:*`, `bd:<fileId>`, `ft:<fileId>`, `aud:<month>*`, add-on `view*`, `body:<templateId>`; none holds an address | directory/profile.ts | identity.test.ts (no key with `@` after profile.me, sidebar.home, template.list, apply with an internal recipient); `FakeCache.keys()` added |
| 9 | Backdrop mousedown calls `preventDefault`, so focus stays on the opener. `cancelDialogs()` (dialog.ts) cancels every open dialog and drawer, newest first, on browser Back or Forward; the narrow-screen panel already closes in `render`. Focus goes to `main` when it would sit on the body | ui/dialog.ts (2 small hunks), app.ts | web admin.test.ts, 2 tests |
| 10 | Save stays enabled while saving with `aria-disabled` (a busy click does nothing); when Save ends up disabled and had focus, focus moves to the status line (`tabindex=-1`). CONFLICT applies `details` (`conflictEntry`) and shows `conflictText` | views/adminSettings.ts | web adminReports.test.ts, 2 tests |
| 11 | New template on All templates and Favorites when the caller can edit some folder: dialog "New template", select of `editableFolders`, last used folder of the page session preselected, Create opens `#/new?folder=<id>`. No editable folder: no button, slice 11 note unchanged. Harness `?access=use` (shared folders at `use`) | views/library.ts, dev-harness.ts | web app.test.ts, 3 tests |
| 12 | `template.list` always carries `to`, `cc`, `bcc` of visible templates (`recipientsOf`, `[]` for old items). Shared matcher: `SearchFields.addresses` (optional), `Query.words`; a query word that is a prefix of an address (local part, or full address with `@`) scores 1; domain alone 0. Items without addresses score as before. Only `searchItems` (web) passes addresses; the sidebar `search` op does not | shared/search/match.ts, web library/model.ts, templates.ts `listed` | shared search.test.ts (4), web logic.test.ts, server search.test.ts (2) |
| 13 | No-match echo cut by code points | addon/cards/home.ts | cards.test.ts |
| 14 | Smoke "Slice 9" steps 5 and 6 use Admin, Config, Settings, "Outside recipients" | docs/ops/smoke.md lines 145, 146 only | prettier |

Screens (Chromium 1243, Playwright, dev harness, UTC), opened and checked: docs/design/screens/13/folder-choice.png, folder-choice-390.png (select focused), trash-confirm.png ("The 1 template in it is"), trash-result.png, settings-conflict.png and settings-conflict-dark.png (Allowed checked, focus on the status line).

## Changed user-facing texts

| Where | Old | New |
|---|---|---|
| Trash confirm, 1 template | "Empty the trash? All 1 templates in it are removed for good, and deleted folders go too. This cannot be undone." | "Empty the trash? The 1 template in it is removed for good, and deleted folders go too. This cannot be undone." (n other than 1 unchanged) |
| Trash result, reload failed | "Emptied the trash. The list could not be refreshed." | "Emptied the trash: 1 template removed for good. The list could not be refreshed." (counts from the server) |
| Trash result | counts inferred from the list | same wording, counts from `trash.purge` |
| Settings CONFLICT | server text "<name> changed this setting. The page now shows the current value." | client text "<name> changed this setting on <local time>. The page now shows the current value." and the current value checked |
| `config.set` VALIDATION | "Setting <whole name> does not exist." | "Setting <first 40 characters> does not exist." |
| Library, All templates and Favorites | no button | "New template" button; dialog title "New template", label "Create the template in", buttons "Create", "Cancel" |
| Import, setting turned to deny during the import | stored the address | "Nothing was imported: the library could not be written: 1 problem to fix. Run the import again." |
| Save, setting turned to deny during the save | stored the address | the save's own VALIDATION "1 problem to fix" with the `RCPT_EXTERNAL` problem |
| Add-on no-match | could end in half an emoji | whole characters |

## Spec and ADR sentences now untrue (for the architect)

1. ADR-0008 line 36: "the op carries `from`, the value the admin saw. In the lock, a current value different from `from` answers CONFLICT". Now `baseAt`, `baseBy` (last change) are compared.
2. ADR-0008 line 54 (Args row) and line 57 (Validation row): `from`; the name echo is cut at 40 characters.
3. ADR-0008 line 38: "The restore event lists no settings." The event now holds `liveSettingsKept: true`.
4. Spec 5.8 line 302 and spec 6 line 363: `config.set { name, value, from }`, "Current value different from `from`: CONFLICT". Spec 13 line 757: "`from` conflict".
5. ADR-0003 log table (line 201): `grant.remove` `targetId` `""`. Spec 11.1 line 577: "`grant.remove`: `""`". Now the folder ID. Side effect: `folder.create` under a parent now logs the parent ID (it logged "").
6. ADR-0003 line 208 and spec 11.1 line 578: "Exports write no audit event in v1". Spec 13.5 line 719: the export event row planned for v1.1.
7. ADR-0003 line 185 ("When full, new apply and denied events are dropped") and line 187 ("200 refused calls inside 5 min also drop apply events"); spec 11.1 line 575 ("at most 200 apply and denied events ... Change events go through `pendingAudit` in the index write and are never dropped") and spec 13.5 line 695. Now: denied dropped first; applies and export events take denied slots; an export event can be dropped when the buffer is full of applies and changes, or when the 500 ms buffer lock is busy.
8. ADR-0002 line 101 (`evt:<n>` "buffered apply and denied events"), line 128 ("Security events (... export ...) enter `pendingAudit` inside the same `index.json` write as the change") and line 129. Export events go through the buffer. ADR-0003 line 103 (`tick` flushes apply and denied events): also change events.
9. ADR-0002 line 100: `prof:<n>` key. Now `prof:<sha256 of the address>`.
10. Spec 6 line 350 (`trash.purge`): the result now carries `templates` and `folders` beside `purged`, `filesTrashed`, `itemsPending`.
11. Spec 7 line 443 "Button: New template (edit level only)" and line 331: All templates and Favorites now show the button with a folder choice; spec 5.8 line 331 calls it the "slice 8b folder choice" (built here in the library).

## Left for later

- Smoke "Slice 9" "Needs" line (smoke.md:139) still says "Script Property `RECIPIENTS_EXTERNAL` unset"; outside the two lines this slice may edit.
- The "last used" folder of the folder choice lives for the page session only (module variable). A reload preselects the first folder.
- An export event is lost when the buffer lock is busy over 500 ms (same rule as apply and denied events, Q14).
- Library search on addresses: the harness sample has no template recipients, so no screen shows it; covered by unit tests.

## Risks

- `config.set` args changed: a browser tab loaded before the deploy sends `from` and gets VALIDATION "Setting <name> takes on or off." until it reloads. Admin only, one tab.
- `TickResult` gained `changes`; `denied` still counts denied events only.
- Full buffer path costs one `getAll` of up to 200 keys per apply or export while full.

## Checks (clean install: `rm -rf node_modules && npm ci`)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 64 files, 1698 tests passed. All files 95.85 statements, 89.97 branches, 96.73 lines (addon 100, server 99.31, shared 100, web 92.16 lines) |
| `npm run build -- --env dev` | Code.js 356.0 KB of 800 KB, index.html 361.1 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 14 of 14 views at 100 |

Unchanged: appsscript.json, package files, scripts/ (`inlineHtml`), src/entry.ts, entry point list, test/unit/server/entry.test.ts (warm call counts of `sidebar.home`, `search`, `template.apply` green). Not touched: src/web/views/editor.ts, src/web/editor/, history.ts, preview.ts, problems.ts, tags.ts, styles.css. dialog.ts: 2 local hunks (cancel list, backdrop `preventDefault`).

Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, AKIA, xox, eyJ): 0. Addresses added: test fixtures on example.com, client.example, other.org and invented migway.com role addresses. URLs added: none. No new network call.

## Files touched

src/server: audit/buffer.ts, directory/profile.ts, dispatch/dispatch.ts, dispatch/handle.ts, handlers/admin.ts, body.ts, config.ts, history.ts, templates.ts, transfer.ts, jobs/daily.ts, jobs/tick.ts, metrics.ts. src/shared: body/prepare.ts, search/match.ts. src/web: admin/actions.ts, app.ts, dev-harness.ts, library/model.ts, rpc/api.ts, ui/dialog.ts, views/adminSettings.ts, library.ts, trash.ts. src/addon/cards/home.ts. Tests: 16 files (listed in `git diff --stat`). Docs: docs/ops/smoke.md, docs/design/screens/13/ (6 PNG), this handoff.

## Retry 1 (after review acf07ee, FAIL)

Commits: 7c060f4, 5250545, 45833aa, 7edc9a7 and the handoff commit. Not merged, not pushed. The run was cut by a machine restart after 7c060f4; the uncommitted work was read, kept, fixed (one misplaced doc comment in data.ts, the audit grouping replaced) and committed.

### Done

| # | Fix | Where | Test |
|---|---|---|---|
| M1, M2 | Every export page writes its own event, whatever `offset`: actor, scope, `targetId`, `targetPath`, `after { scope, offset, templates, total }`; no title, subject, body or address. The event goes into the buffer before any body is read; not stored (lock busy, buffer full of change events) answers BUSY (retryable) with no data | server/handlers/transfer.ts `recordExport` | adminReports.test.ts: offsets 1 and 21 each write an event; lock busy refuses and the answer holds no content; full buffer of changes refuses, full of applies makes room |
| 6 (minor) | Buffer ranks denied < apply < change. A new event of higher rank takes the slot of a lower one; a refused change event throws to its caller | server/audit/buffer.ts | jobs.test.ts |
| 2 | Web export retries a BUSY page 3 times after 200, 400, 600 ms, then stops: "The export stopped: the server was too busy to record it in the audit log. Nothing was downloaded. Try again in a minute." No blob, no download on any failure | web/views/adminTransfer.ts; harness `&failTimes=<n>` | web adminReports.test.ts: 2 BUSY then success downloads 1 file; BUSY always gives the message, 0 clicks, 0 `createObjectURL` |
| 3 | Audit log joins the pages of one export into one row: oldest first, a page joins the open row of the same actor, action and target when its `offset` equals where that row ended and `total` matches. The row carries `exportPage { offset, templates, total }` and reads "Library exported, all 25 templates" or "Folder exported, all 3 templates". A page that continues nothing keeps its own row with its range ("templates 2 to 25 of 25" for an offset-1 export), so a skipped page shows. Rows and `total` count after joining; the drawer opens the first page's event | server/audit/query.ts `joinExportPages`; web admin/actions.ts `rowActionWords` | adminReports.test.ts (pure join, 9 events, 7 rows; audit.query joins 2 pages); adminActions.test.ts |
| 5 (minor 3) | `config.set` with a `from` arg answers VALIDATION "This page is out of date. Reload it and save again."; nothing is written | server/handlers/config.ts `setRequest` | settings.test.ts (2 cases; index settings stay undefined) |
| 6 (minor 5) | Apply and denied events lost to a busy lock count in `evt:lost` (no lock needed); `tick` adds the rise to `audit.dropped` | server/audit/buffer.ts | jobs.test.ts |
| 7 (minor 7) | smoke.md Slice 9 Needs paragraph: the one sentence now reads "Admin, Config, Settings, Outside recipients: allowed." Nothing else in the paragraph changed | docs/ops/smoke.md | prettier |

Old-code check: `git checkout acf07ee -- src`, 5 test files: 10 failed (all the new tests above), 359 passed; `src` restored from HEAD.

### Changed user-facing texts

- Export, BUSY after 3 retries: "The export stopped: the server was too busy to record it in the audit log. Nothing was downloaded. Try again in a minute."
- Server BUSY text of a refused page: "The export could not be recorded in the audit log. Try again in a moment."
- Audit log export row: "Library exported" became "Library exported, all 25 templates" (or a range for a page that continues nothing).
- `config.set` old args: "This page is out of date. Reload it and save again."

### Left for later

- Minor 4: the in-lock recipient re-check refuses the whole import where the normal path drops the address; same safety, different text.
- Minor 6: covered by the rank rule (change above apply); no further change planned.
- First-pass items now done: smoke.md:139 sentence and the busy-lock export loss.
- Spec and ADR passages for the architect, in addition to the list above: ADR-0002 line 128 (export events go through the buffer with refusal on failure), ADR-0003 lines 185, 187 (rank rule, `evt:lost`), spec 11.1 line 575.

### Risks

- An export of n pages now writes n events (25 templates: 2). The buffer holds 200; a library of 4,000 templates fills it in one export, after which applies and denied events lose their slots until `tick` runs (1 minute) and later pages answer BUSY; the web retries for 1.2 s only.
- Joining runs per filtered month page: a time filter that cuts an export in two shows two rows.

### Checks (clean install: `rm -rf node_modules && npm ci`, exit 0)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 64 files, 1706 tests passed. All files 95.89 statements, 89.99 branches, 96.78 lines (addon 100, server 99.31, shared 100, web 92.2) |
| `npm run build -- --env dev` | Code.js 358.3 KB of 800 KB, index.html 361.7 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 14 of 14 views at 100 |

Not touched in retry 1: src/web/views/editor.ts, src/web/editor/, history.ts, preview.ts, problems.ts, tags.ts, ui/dialog.ts, styles.css, appsscript.json, package files, scripts/. Secret scan of added lines: 0 hits, no URLs. Addresses added: example.com fixtures only.

Files touched in retry 1: src/server/audit/buffer.ts, audit/query.ts, handlers/config.ts, handlers/transfer.ts; src/shared/model/data.ts; src/web/admin/actions.ts, dev-harness.ts, rpc/api.ts, views/adminAudit.ts, views/adminTransfer.ts; tests adminReports (server, web), jobs, settings, adminActions; docs/ops/smoke.md; this handoff.

## Retry 2 (after review 4b73c16, FAIL on the export audit record)

Commits 6ec0bf7, ae145a5, d79854c, 2b1992a, 39b6a69 and the handoff commit. Not merged, not pushed.

### Mechanism

- `export.library` and `export.folder` with `start: true` commit one audit event through `commit` (lock, `recheck`, `commitLocked`, `pendingAudit`), the same path as template changes. Event: actor, `targetType` folder or library, `targetId` (folder ID or ""), `targetPath` (folder only), `after { scope, templates }` counted on the index read inside the lock. No title, subject, body or address. Lock busy answers BUSY; a Drive write failure answers INTERNAL; both are retryable and leave no token.
- The start answers `{ token, total }`. The token is `services.newId()` (26 characters, 16 random), stored as `exp:<token>` in the Script Cache with `{ actor, kind, folderId }` for `EXPORT_RUN_TTL_S` 600 s. Each accepted page re-puts it for another 600 s, so a long export keeps its token and a token unused for 10 minutes expires.
- A page call (no `start`) needs a token that matches `isId`, exists in the cache, belongs to the caller and matches the requested scope kind and folder. Otherwise VALIDATION, `EXPORT_RESTART`, no data, before the index or any body is read. The dispatch permission check runs first on every call, unchanged.
- Export pages read bodies with `readStoredBody(services, item, false)`: a cache hit is used, a miss is read from Drive and not cached.
- Web: `exportStart`, then `exportPage(folderId, offset, token)`. Start and pages retry a retryable error (BUSY, QUOTA, INTERNAL, NETWORK) 3 times after 200, 400, 600 ms. The file is built and downloaded only after the last page.

### Removed

- Per-page export events (`recordExport`), the `change` buffer kind, the buffer rank table, `TickResult.changes`.
- `joinExportPages`, `exportPageOf`, `ExportPageCounts` (shared/model/data.ts), `AuditRow.exportPage`, `exportPageText`; their tests. `query.ts`, `data.ts` and `adminAudit.ts` are back to acf07ee apart from the new count field.
- Gap 4: `evt:lostSeen` is gone. `evt:lost` holds "<lost> <seen>" in one key, so both numbers expire or are evicted together. `clearBuffer` re-reads the key before it writes the mark.
- Gap 5: a full buffer first stores a new event (apply or denied) in an evicted slot, with no drop counted. Then an apply takes a denied slot (counted). Then the event is dropped (counted).
- Gap 6 is moot: the buffer no longer refuses any request.

### Tests that fail on d0f00be (`git checkout d0f00be -- src`, 6 files: 11 failed, 381 passed; `src` restored)

- server adminReports: one event per run with content check and audit row count; no data without a committed start (offsets 0, 1, 21, 25, 1000 without token, empty token, malformed token, unknown token, another user's token, another scope's token, both directions); expiry and replay after expiry, sliding life, evicted token; cold 1,000-template export (5 imports of 200, clock +7 h): 1,000 items, 0 `bd:*` puts, the event in `audit.query` before and after `tick`; page reads 20 bodies.
- server jobs: busy-lock count after 6 h (old code reports 2 of 7); evicted slot taken with no drop.
- web adminActions: new words; web adminReports: page retry after the start (`failSkip`), stop text.
- Passes on old code too, kept as guards: BUSY start writes nothing and stores no token; VALIDATION page stops at once with no download.

### Changed texts

- Server, refused page: "This export is no longer valid (it expired or belongs to another session). Nothing was downloaded. Start the export again."
- Web, after 4 failed tries: "The export stopped: the server did not answer after 4 tries. Nothing was downloaded. Wait a few minutes, then export again." Replaces the "Try again in a minute." text.
- Audit log: "Library export started, 25 templates"; "Folder export started: Sales / Quotes, 12 templates". Action filter words: "Library export started", "Folder export started".
- Removed: "The export could not be recorded in the audit log. Try again in a moment."; "Library exported, all 25 templates" and the range forms.

### Spec and ADR sentences now untrue (architect)

- spec 11.1 line 575: "Change events go through `pendingAudit`..." (no change events in the buffer now; the sentence about apply and denied holds).
- spec 11.1 line 578 and ADR-0003 line 208: "Export writes no audit event in v1". Now one event per run, at start.
- spec 13.5 line 719 (follow-up "One `export` audit event per export (first page)"): done in a different form.
- spec 4.5 line 133 and ADR-0002 line 200 (Paging): add the start call, the run token (caller, scope, 10 min sliding) and that pages do not fill the body cache.
- ADR-0003 line 185: also an evicted slot is reused before any drop. Line 187 holds.
- ADR-0002 line 128 is true again for export (event in the index write). Line 19 table: add `exp:<token>`, 600 s.
- spec 4.5 and ADR-0002 line 139: the audit row wording above.

### Left for later

- Minor 4 of the first review (in-lock recipient re-check refuses the whole import).
- An abandoned export still leaves its start event (it records intent, not completion).
- A token evicted by other cache traffic mid-run stops the export; the user starts again (one more start event).

### Risks

- Each export run costs one index write (about 1 s under the lock at 1x).
- Two tabs of one admin get two tokens and write two start events.

### Checks (clean install: `rm -rf node_modules && npm ci`, exit 0)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 64 files, 1710 passed. All files 95.91 statements, 90.04 branches, 96.79 lines (addon 100, server 99.31, shared 100, web 92.26) |
| `npm run build -- --env dev` | Code.js 358.6 KB of 800 KB, index.html 361.8 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 14 of 14 views at 100 |

Not touched in retry 2: src/web/views/editor.ts, src/web/editor/, history.ts, preview.ts, problems.ts, tags.ts, ui/dialog.ts, styles.css, appsscript.json, package files, scripts/, docs/ops/smoke.md, config.ts. No log line carries the token (dispatch logs no args). No new network call. Addresses added: example.com fixtures only.

Files touched in retry 2: src/server/audit/buffer.ts, audit/query.ts, handlers/body.ts, handlers/transfer.ts, jobs/tick.ts; src/shared/model/data.ts; src/web/admin/actions.ts, dev-harness.ts, rpc/api.ts, views/adminAudit.ts, views/adminTransfer.ts; tests adminReports (server, web), jobs, adminActions, recipients, settings; this handoff.
