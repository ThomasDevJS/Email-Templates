# Handoff: implementer to reviewer, slice 14 (wording pass)

Date: 2026-11-11. Branch `slice/14-wording`, cut from 6374b7b. 7 commits. Not merged, not pushed, not deployed.

## Done

1. `docs/design/wording.md`: glossary (28 things, 16 actions, words that never appear on screen, 5 exceptions kept on purpose) and a table of 216 changed texts with file, old text, new text and reason. Web admin 108, web library and editor 31, Gmail panel 5, server and shared 72.
2. Access wording: "Who has access", "Give access", "Giving access...", "Gave access to ...", "Remove access"; "Can use", "Can edit", "Can manage"; columns Who, Access, Set on. Tabs "Folders and access", "Groups", "Settings and backups".
3. One name per thing: field, field name, default text (was placeholder, prompt, label, question, fallback); sender (was the user); personal folder (was private); entry (audit, was event); insert (was apply, use); Delete for templates, Remove for lists; Close (was Dismiss); "Check file" (was Validate); "Filter" (was Apply).
4. Errors say what to do: busy, conflict, not found, not set up, import file problems, folder rules, field problems, size limits. No error code in the import report. Raw names sit only under "Technical details" and "Details for your admin: ...".
5. Defect a: recipient chip announcements go to `.sr-only.chip-status` (`role=status`); the visible status line keeps save results (`src/web/views/editor.ts`).
6. Defect b: `exportFailedText` (`src/web/views/adminTransfer.ts`). The "did not answer after 4 tries" text shows only for a NETWORK error. Any other error shows the server's message (toast with request ID, banner text, or the status line).
7. Defect c: a stopped export says "The export stopped after n of m templates ... no file was downloaded". No file is offered. A failed start says "The export did not start".
8. Defect d: `IMPORT_SETTING_CHANGED` (`src/server/handlers/transfer.ts`). Code VALIDATION, `details.problems` and the whole-file refusal are unchanged; only the text differs.
9. Defect e: 8b minor 1 and merge finding 2 (smoke steps), 8b minor 3 (defect a), merge finding 1 (memory note), merge finding 3 (web test: setting turns to deny after load, Save shows the server refusal), slice 13 retry 2 minors 1 (defect b), 3 (audit note: "An export entry records the start of an export, not that the file was downloaded.") and 6 (defect d). Already fixed before this slice: slice 11 minors 3 to 6, slice 12 surrogate cut.
10. Defect f: smoke "Slice 8b" steps 9 (Forward, `Host.go`, `history.length` before and after) and 10 (Back with a link dialog open).
11. Guides and ops docs quote the new texts (admin guide, editor guide, quick start, smoke, runbook, deploy).
12. Job names in words with the raw name in small type (`JOB_WORDS`, `src/web/views/adminConfig.ts`). Harness: `?exportPage=<n>`.

## Verified

Clean install at 8ae2e67 plus the docs-only commits after it:

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages added |
| `npm run lint` | exit 0, 0 problems |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 65 files, 1779 tests pass; statements 97.01%, branches 90.93%, lines 97.82% (6257/6396) |
| `npm run build -- --env dev` | Code.js 360.4 KB of 800 KB, index.html 375.5 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | all files pass |
| `npm run lighthouse` | accessibility 100 on all 15 runs (11 light, 4 dark) |

Tests 1774 to 1779. New: export server error, export stopped midway (pages of 1), `exportFailedText` cases, import with the setting flipped before the commit (code, details, text, second run imports), Save refused by the server after the setting changed. Rewritten: the export no-answer test now uses a NETWORK error. Changed test: chip announcements read from the sr-only region and the visible line stays empty. No test deleted. 2 assertions changed kind: the import report reasons were matched by error code (`SUBJ_TOO_LONG`, `PH_`) and are now matched by their text, because the code left the screen.

`git diff 6374b7b -- scripts test/fixtures package.json package-lock.json appsscript.json` is empty: `inlineHtml`, fixtures, dependencies and scopes are unchanged. Screenshots: not taken, `docs/design/screens/` holds no script.

## Left

- `src/web/host.ts:75`, `src/web/app.ts:321`: the first history entry has no state, so Back to it pushes and drops the Forward entries (8b minor 2). Behavior, not text.
- `src/web/editor/commands.ts:101`: after an insert at the document start the caret sits before the new node (8b minor 4).
- 8b minor 5: Back then Discard adds one history entry (`src/web/app.ts:317`); a failed `me` call blocks the editor (`src/web/views/editor.ts:869`); Bcc box empty input line, read-only Title border, Bcc note under "None" (`src/web/views/recipients.ts:205`, `src/web/styles.css`).
- `src/web/views/adminTransfer.ts:136`: a start retried after a lost answer writes a second start entry (slice 13 retry 2 minor 2). `:145`: progress uses the start's total (minor 5). `src/server/runtime.ts:124`: token from `Math.random` (minor 4).
- `src/server/handlers/config.ts:234`: the `backup.restore` audit entry does not say that live settings were kept (slice 11 minor 7).
- `src/web/views/adminAudit.ts:175`: click then Enter on "Details" can open 2 drawers (merge review, pre-existing).
- Developer wording kept for requests the screens cannot send: list in `docs/design/wording.md`, "Exceptions". `src/web/rpc/client.ts:49,65` texts are never shown (the toast uses a fixed text).
- `docs/spec.md` section 7, the wireframes and ADR quotes still hold the old texts (architect). Guides keep some prose about internals (`manage`, `grant.add`, Script Properties) for admins who read logs.
- Not verified in Gmail or on Apps Script: every new text on the real screens, smoke 8b steps 9 and 10.

## Risks

1. Three engine files changed by message text only: `src/web/editor/schema.ts` (2 accessible names in `chipLabel`), `src/web/editor/serialize.ts` (1 message), `src/shared/sanitize/sanitize.ts` (size messages). Parse, `serializeDoc`, sanitizer rules and round-trip fixtures are untouched; the round-trip and sanitizer suites pass.
2. Renamed tabs and buttons break muscle memory and any saved test prompt that names "Config", "Memberships", "Validate", "Add grant" or "Apply".
3. Export: an error with a toast leaves only "The export stopped ... no file was downloaded." in the status line; the server's message is in the toast. A user who closes the toast first sees no reason.
4. "Members are read from Google" drops the resolver ID from the Groups tab; it stays under "Technical details" as `MEMBERSHIP_RESOLVER`.
5. Logs and audit data are unchanged, but texts in old audit `after` data or screenshots still show the old words.

## Files touched

`docs/design/wording.md` (new), this handoff, `.claude/agent-memory/implementer/MEMORY.md`; docs: `docs/guide/{admin-guide,editor-guide,user-quick-start}.md`, `docs/ops/{smoke,runbook,deploy}.md`; add-on: `cards/home.ts`, `cards/states.ts`; server: `dispatch/dispatch.ts`, `guards.ts`, `lock.ts`, `pages.ts`, `storage/setupStore.ts`, `handlers/{audit,config,folders,grants,indexOps,templates,transfer,versions}.ts`, `transfer/{format,plan}.ts`; shared: `model/validate.ts`, `placeholders/validate.ts`, `sanitize/sanitize.ts`; web: `admin/{actions,model}.ts`, `dev-harness.ts`, `editor/{picker,schema,serialize}.ts`, `ui/status.ts`, `views/{admin,adminAudit,adminConfig,adminFolders,adminTransfer,adminUsage,editor,library,memberships,recipients,trash}.ts`; tests: 17 files under `test/unit/{addon,server,shared,web}`.

## Commands

```
git checkout slice/14-wording
rm -rf node_modules && npm ci
npm run lint && npm run typecheck && npm run test:coverage
npm run build -- --env dev && npm run scopes:check && npm run format:check
npm run lighthouse
npm run dev:web   # then open #/admin, #/admin/transfer, #/edit/T-QUOTE with ?latency=0
git diff 6374b7b -- src/web/editor/schema.ts src/web/editor/serialize.ts src/shared/sanitize/sanitize.ts
```
