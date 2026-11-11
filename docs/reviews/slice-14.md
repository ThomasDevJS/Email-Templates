# Review: slice 14 (wording pass)

Date: 2026-11-11. Branch `slice/14-wording`, head 3bad2cb, base 6374b7b, 7 commits.

## Verdict: FAIL

Code, tests and defects a to f pass. 13 quoted texts in `docs/guide/admin-guide.md`, `docs/guide/editor-guide.md` and `docs/ops/smoke.md` still show texts the screens no longer show. The handoff claims the guides and smoke steps quote the new texts (item 11). A smoke run on dev would fail at Slice 6a steps 4, 5 and 9 and Slice 6b steps 3 to 6.

## Must fix

All are docs-only edits.

| # | File:line | Now | Fix |
|---|---|---|---|
| 1 | `docs/ops/smoke.md:114` | "You don't have access to the admin view." | "You don't have access to Admin." (`src/web/views/admin.ts:65`) |
| 2 | `docs/ops/smoke.md:115` | "The row shows the principal, `use`, "this folder"." | "The row shows the group or user, "Can use", "this folder"." |
| 3 | `docs/ops/smoke.md:119`, `docs/guide/admin-guide.md:211` | "Removed n items for good."; dialog "Remove all n templates in the trash for good? ..." | "Emptied the trash: n templates deleted for good."; dialog "Empty the trash? All n templates in it are deleted for good, and so are deleted folders. This cannot be undone." (`src/web/admin/actions.ts:102,108`) |
| 4 | `docs/ops/smoke.md:128` | "Apply" (2 times) | "Filter" (`src/web/views/adminAudit.ts:127`) |
| 5 | `docs/ops/smoke.md:129` | "0 applies ... 1 apply, last used now" | "Inserts, 30 days" 0, then 1, "Last inserted" now (`src/web/views/adminUsage.ts:12-13`) |
| 6 | `docs/ops/smoke.md:130`, `docs/guide/admin-guide.md:120` | "Download JSON"; "Exporting... n of m templates." | "Export" (admins) or "Export folder"; "Exporting n of m templates..." (`src/web/views/adminTransfer.ts:107,145`) |
| 7 | `docs/ops/smoke.md:131` | "Imported: 1 templates"; "Validate the same file again"; "target" | "Imported 1 templates, 0 skipped, 0 failed. Folders: ..."; "Check file" on the same file again; "Import into" (`src/web/admin/model.ts:238`, `adminTransfer.ts:333`) |
| 8 | `docs/guide/admin-guide.md:194` | pick a "Backup date", "Restore from backup" | press "Restore" next to the date (`src/web/views/adminConfig.ts:153`); the screen has no "Backup date" field and no "Restore from backup" button |
| 9 | `docs/guide/editor-guide.md:113` | "Subject must be one line" | "The subject must be one line" (`src/shared/placeholders/validate.ts:211`) |
| 10 | `docs/guide/editor-guide.md:125` | "(Admin, Config, Settings)" | "(Admin, Settings and backups, Settings)" |

Old texts in the guides are older than this slice (base 6374b7b has them). The slice took the guides on, so they are in scope.

## Checks

### 1. Behavior freeze: pass

- `git diff 6374b7b..3bad2cb -- src`: 47 files. Every server, shared and add-on hunk changes a message or label string, except: `transfer.ts` `recheckOrExplain` and the `IMPORT_SETTING_CHANGED` rethrow in `nothingImported` (defect d, code VALIDATION and `details.problems` kept), `reasonOf` drops the `code: ` prefix (text), `format.ts` `list` names "templates" for key `items` (text).
- Web: `editor.ts` announcer element (defect a), `adminTransfer.ts` progress object and `exportFailedText` (defects b, c), `adminConfig.ts` `jobName` (span with words plus raw name), `dev-harness.ts` `?exportPage=<n>` paging. No change to error codes, op names, policy, permission checks, storage, audit or data shapes.
- Engine files: `schema.ts` changes 2 strings in `chipLabel` (aria-label); `serialize.ts` changes 1 problem message; `sanitize.ts` changes the `tooLarge` texts and their 2 subjects. Parse, serialize and sanitizer rules are untouched. Round-trip and sanitizer suites pass.
- `git diff 6374b7b..3bad2cb -- scripts/lib/html.mjs package.json package-lock.json appsscript.json test/fixtures`: empty. 10 scopes. No new dependency.

### 2. Tests: pass

- 0 test cases removed. 7 renamed (titles follow the new words), 5 added: import with the setting flipped before the commit, export with a server answer, export stopped midway (pages of 1), `exportFailedText` cases, Save refused by the server after the setting turned to deny.
- Changed test: "stops after the retries" moved from `fail=BUSY` to `fail=NETWORK`. The BUSY/QUOTA path is now covered by the new QUOTA test (server message in the toast, no "did not answer").
- The 2 import-report assertions (`test/unit/server/adminReports.test.ts:768-771`): line 0 is pinned with `toBe("The subject must be 200 characters or fewer.")`, line 1 with `/^Unknown field /`. Both texts are unique to SUBJ_TOO_LONG and PH_UNKNOWN, so the cases stay pinned, and line 0 is stricter than before. The code does not travel in the response any more: `ReportLine` (`src/server/transfer/plan.ts:15-20`) has `kind`, `name`, `outcome`, `reason` only, and `reasonOf` (`transfer.ts:283-293`) no longer prefixes `first.code`. See minor 1.
- Every renamed text a test asserted is asserted in its new form (54 removed `expect` lines, 79 added; each removed one has its new-text twin).

### 3. Defects

- a. Pass. Chromium (Playwright, dev harness, `#/edit/T-QUOTE?latency=0`): `.sr-only.chip-status` has `role=status`, `aria-live=polite`, 1x1 px, position absolute. The Chromium AX tree shows it as `status` with live=polite, atomic=true. Add to To says "Added late@example.com to To.", Backspace says "Removed late@example.com from To.". A MutationObserver on the visible `.status` line recorded 0 changes across add, remove and Save. Toolbar top stayed at y=56. Save state is in the header (`.saved-state`); the visible line keeps Save failures only.
- b. Pass. `adminTransfer.ts:168-175`: `toRpcError(error).code === ErrorCode.NETWORK` gives the "did not answer after 4 tries" text; any other code gives `lineText(error, app.fail(error))` (server text or "" when a toast shows it). Test with QUOTA: status "The export stopped after 0 of 4 templates and no file was downloaded.", toast "Service is busy. Try again in a minute.".
- c. Pass. Progress `done` counts items fetched before the failing page. Harness `exportPage=1&fail=NETWORK&failSkip=3`: "The export stopped after 2 of 4 templates: ... No file was downloaded ...", 0 clicks, `createObjectURL` not called.
- d. Pass. `IMPORT_SETTING_CHANGED`: 'Nothing was imported. The setting "Outside recipients" changed during the import. Run the import again.'. Test `recipients.test.ts:451-495`: code VALIDATION, `details.problems[0].code` RCPT_EXTERNAL, rev +1 only (no template), second run imports 1 with the address dropped.
- e. Pass for the items listed in the handoff: chip announcer (8b minor 3), web Save refusal test (merge finding 3), export texts (slice 13 minors 1 and 3), audit note "An export entry records the start of an export, not that the file was downloaded." (`adminAudit.ts:20`), mid-import text (minor 6).
- f. Pass. Smoke "Slice 8b" step 9 matches `googleHost.go` (`src/web/host.ts:79-81`, `window.history.go(delta)`) and the guard: Forward with unsaved changes asks, travels back, `history.length` unchanged; Back to the first entry asks again, Discard opens the library. Step 10 matches `cancelDialogs` before the leave question. "Insert link", "Link", "Keep editing", "Discard changes" exist in `src/web`.

### 4. Wording: pass with minors

Grep of string literals in `src/web/views`, `src/web/ui`, `src/web/admin`, `src/web/editor/picker.ts`, `src/addon/cards` and server handler messages for grant, effective access, membership, config, apply, placeholder, fallback, private folder, validate, dismiss, payload, token, DENIED, principal, resolver, prompt, event, OU, v1, JSON, record: no hit on screen outside the 5 documented exceptions and the "Technical details" block. 0 em or en dashes in `src`, guides, ops docs and `wording.md`. 0 exclamation marks in visible strings (1 in harness sample HTML).

Headline changes:

| Text | Judgement |
|---|---|
| Folders and access | Clear. Matches "Who has access" and "Give access". |
| Groups | Fine. The tab lists the Google Groups the app reads; button "Refresh groups" and audit "Groups refreshed" agree. Not confusable with the type "Group" in Give access: both mean a Google Group. |
| Settings and backups | Clear. Holds settings, technical details, background jobs, backups. |
| Give access / Giving access... / Gave access to x: Can use. | One verb across button, busy text, result. |
| Who has access | Clear. Columns Who, Access, Set on. |
| Can use / Can edit / Can manage | Clear. One leftover: the audit drawer shows the bare level (minor 2). |
| Ask the sender | Clear for the template author. |
| default text | Clear. Used in picker, dialog, aria-label, warnings. |
| Unknown field | Clear on its own. "field" also means the To, Cc, Bcc boxes ("Use at most 10 per field", "under the field"): minor 3. |
| Check file / Checking file... / Checked. | One verb. |
| Filter | Clear. Empty state says "Change the filters and press Filter." |
| Inserts, 30 days / Last inserted | Clear. |
| Personal folder | Can mislead a little: users see only "My templates"; server errors say "Personal folders cannot be deleted." Minor 4. |
| Close | Clear. |

### 5. Docs: FAIL

See must-fix 1 to 10. `test/unit/docs/links.test.ts` passes. `docs/spec.md` and wireframes not checked (architect).

### 6. Commands (clean install, worktree at 3bad2cb)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, 559 packages added, 16 audit findings (14 moderate, 2 high, same as before) |
| `npm run lint` | exit 0, 0 problems |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | exit 0, 65 files, 1779 tests pass; statements 97.01, branches 90.93, functions 96.41, lines 97.82 (addon 100, server 99.31, shared 100, web 96.34) |
| `npm run build -- --env dev` | exit 0, Code.js 360.4 KB of 800 KB, index.html 375.5 KB of 400 KB |
| `npm run scopes:check` | exit 0, "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| `npm run lighthouse` | exit 0, accessibility 100 on 15 of 15 runs (11 light, 4 dark) |

### 7. Secrets and content: pass

Added lines: 0 hits for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, eyJ. 17 distinct addresses, all `example.com`, `migway.com` smoke placeholders, `partner.com` test values or `name@company.com`. 0 URLs. 0 hours-of-service examples. No real template content.

## Minors

1. The import report no longer carries the problem code (SUBJ_TOO_LONG, PH_*). `ReportLine` has no code field and the freeze forbids adding one. The admin sees a plain text and support loses the code. Decide whether to accept; adding `code` to `ReportLine` is a data change for a later slice.
2. `src/web/views/adminAudit.ts:79`: the drawer shows "user@x (manage)" with the bare level word. Use the "Can manage" words or "admin".
3. "field" names both a template blank and the To, Cc, Bcc boxes (`shared/model/recipients.ts:176` "per field", editor guide 125 "under the field"). Glossary does not cover the second meaning.
4. "Personal folder" (admin hint, server move, delete, share and import errors) versus "My templates" (what users see) and the setting "Personal templates". Users who never see "personal folder" may not link it to My templates. Option: "your folder My templates" in errors a non-admin can hit (`folders.ts:239,266`).
5. BUSY reads "The library is busy. Try again in a few seconds." on the web and "Busy right now. Press Retry in a few seconds." in the panel (`src/addon/cards/states.ts:51`). QUOTA "Service is busy." names no thing.
6. `src/server/handlers/grants.ts:89`: "The group, user or domain must be at most 254 characters." omits org unit.
7. `src/server/handlers/config.ts:299,311`: "Setting x does not exist." and "Setting x takes ..." keep developer wording; `config.ts` is not in the exceptions list of `wording.md`.
8. `exportFailedText` says "The export did not start" when a start succeeded with total 0 and the first page failed. Rare.
9. Stale code comments with old words: `adminConfig.ts:11` (Tab "Config"), `adminFolders.ts:24` ("Folders and grants", "effective access"), `editor.ts:112` ("Unknown placeholder"), `picker.ts:20` ("Add fallback..."), `picker.ts:42` ("Ask the user" dialog), `schema.ts:214` ("asked at insert", "fallback there").
10. Handoff risk 3 holds: an export error with a toast leaves the reason only in the toast; the status line keeps the stop text.
