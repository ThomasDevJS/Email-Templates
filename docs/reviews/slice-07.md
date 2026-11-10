# Review: slice 7 (documentation for v1)

Verdict: FAIL. Two must-fix items, both in the documents: the runbook tells a person to hand over the owner account password, and the quick start privacy section leaves out that every insert is logged with the user's address. Everything else is accurate or a minor.

Branch `slice/07-docs` at 039392e, base fb97d9a, 6 commits. No change in src/, scripts/, appsscript.json, package files (`git diff --stat fb97d9a..HEAD -- src scripts appsscript.json package.json package-lock.json` is empty).

## Commands (run by the reviewer in the worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, 559 packages, 16 audit findings (unchanged) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test` | 52 files, 1244 tests passed |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run build -- --env dev` | Code.js 318.9 KB, index.html 316.5 KB |
| Link test, one link broken (`editor-guide.md` to `editor-guidex.md` in user-quick-start.md) | 1 failed, 5 passed; message lists `"editor-guidex.md"`. Restored with `git checkout`, 6 passed |

## Must fix

1. docs/ops/runbook.md line 21. "The leaving person hands over the dedicated owner account's password and 2-step verification to the next person." This passes a password from person to person, and a 2SV phone cannot be handed over. Fix: the Workspace admin resets the password and the 2-step verification of the dedicated account; the next person sets a new password and enrolls 2SV on a company device or security key. No password passes between people.
2. docs/guide/user-quick-start.md lines 75 to 81 (D18 section). It says the usage page shows counts "without names" and that text, recipients and field values are not logged. Both true. It leaves out that every insert writes a server log line with the user's address, the template ID and the time (the runbook example at lines 101 to 130 is such a line), readable by the owner and project editors in Executions or Cloud Logging, and that `usage.json` keeps each person's last 20 inserted template IDs for Recent (src/server/audit/usage.ts:4). Fix: one bullet, for example "The server log records each insert with your address and the template, for troubleshooting. Admins with access to the logs can see who inserted which template and when."

## Truth check (64 claims verified)

Matched the source or spec (claim, source):

- Quick start: "Search templates", "Favorites", "Folders", "Recent", "Insert", "Open library" (cards/home.ts, folder.ts); "Fields to fill" (preview.ts:185); "Fill these fields to insert", "Cancel", `(!) Fill 1 field:` (prompt.ts, prompts.ts:52); 500 characters (prompts.ts:8); "Sets the draft subject.", "The draft already has a subject. It is kept.", "Insert with subject", "Insert body only" (preview.ts); "Replace the subject" switch default by draft subject (flows.ts:282, 359); search fields and prefix rule (search/match.ts); Favorites 10, Recent 5 (handlers/sidebar.ts:29-30); "My templates" (folders.ts:21); "+ New template", "Title", "Subject", "Tags", "Save", "Saved as version N, HH:MM" (library.ts:101, editor.ts:431); 5 placeholder labels (placeholders/registry.ts); recipient only for one internal To (event.ts:94); 6 h profile cache; panel view 10 min, cleared by Open library (view.ts:17, flows.ts:374); state texts DENIED, AUTH, BUSY, QUOTA, SERVER (cards/states.ts).
- Editor guide: "All templates", "Trash", "★ Favorites", Shift+F10 (grid.ts:76); row menu labels (rowActions.ts:137-173); delete text and 30 days; "Duplicating...", "Moving...", "Deleting..."; "Copy of" (templates.ts:270); limits 120/200/10/30/80/40/20 (validate.ts, grammar.ts, subject.ts, placeholders/validate.ts); "n/200 (optional)"; "Add tag"; "Preview as me"; "‹ Library"; toolbar labels and Ctrl+B/I/U/Shift+X/K (toolbar.ts, setup.ts); schemes https, http, mailto, tel (policy.ts:83); "Add fallback..."; error texts "Unknown placeholder ... at character 7. Did you mean ...?", "Subject must be one line", "users will be asked for it", "Not saved. Fix the problems listed above.", "Error: " prefix, "Subject: " prefix; conflict dialog texts (editor.ts:330-351); "restored from", "Create version N from version K?", R key, "Restored as version N." (history.ts); Trash columns and rules (trash.ts, templates.ts:89); 100 KB (validate.ts:15).
- Admin guide: role matrix equals ADR-0003 Part C, 17 rows; `ADMIN_EMAILS` comma list (principals.ts:49); setup seeds owner (jobs/setup.ts:28); Admin link for `manage` holders (app.ts:123); grant form labels and type names (adminFolders.ts:33-36, 347-366); "Only admins can see this folder. Add a grant to share it."; "(inherited)"; group error (grants.ts:143); "Private folders cannot be shared"; Memberships texts (memberships.ts:32, 37, 99, 104); OU inactive text (admin/model.ts:82); audit filters, columns, 50 rows (audit/query.ts:7), 24 months, `audit.dropped` at 200 (buffer.ts:13); usage columns; export labels, file name, 20 per page (transfer.ts:44); import limits 5 MB, 200, 100 and failure text (transfer.ts:382); Config rows, 3 MB warning, "Trigger reinstall failed: "; 14 backups (daily.ts:11); restore dialog and refusal texts (adminConfig.ts:98-115, config.ts:158, driveStore.ts:203-211); "Empty trash" dialog, "Removed n items for good.", 50 files (daily.ts:69); 10 scopes with reasons equal spec 9, appsscript.json and scripts/approved-scopes.json.
- Runbook: `npm run deploy`, `npm run rollback` (package.json); "Versions used N of 200; prune at 150" (claspOutput.mjs:48); "Migway Templates Data" (setupStore.ts:13); "<file> is damaged: " (driveStore.ts:109); setup republishes index and sides and reinstalls triggers (jobs/setup.ts); trigger schedules 5/15/daily (triggers.ts:22-24); lock 10 s (lock.ts:5); log fields, `calls` and `timing` keys, results, 3 stack frames, `system` actor (logger.ts, metrics.ts, handle.ts:120, daily.ts:15); "Network: Server returned HTTP 401" (serverClient.ts:37); speed figures equal spec 12.1 and PLAN log.

Mismatches (minor unless marked):

1. user-quick-start.md:44. "A new insert shows there within about 5 minutes." Recent comes from `tick` (5 min) and then the panel view cache (10 min, view.ts:17); an insert does not clear the view. Correct: up to about 15 minutes, sooner after "Open library".
2. user-quick-start.md:31. "a forward" keeps its subject: not verified in Gmail (PLAN.md line 18, "a forward draft keeps its subject" open by hand). Mark it unverified.
3. editor-guide.md:18. Columns list omits "By". Code: Favorite, Title, Folder, Updated, By, Actions (grid.ts:21).
4. runbook.md:93. "Retry stays disabled 60 s." Retry is clickable; a tap within 60 s shows "Service is busy. Try again in N s." (addon/entry.ts:53-58).
5. editor-guide.md:68 quotes the UI hint "Width is set to 600 pixels or less". The code sets `width="600"` on every image (editor.ts:236), so small images are stretched. Code or hint is wrong; the document copies the hint.
6. admin-guide.md:243. `drive.file` "Used by" omits the add-on: spec 9 says the `/exec` front door needs a Drive scope in the add-on token.
7. user-quick-start.md is 1,087 words with 2 lists and a table: about 2.5 printed pages against "at most 2 pages". The placeholder section (lines 58 to 73) is editor material; a link to the editor guide would cut it.
8. admin-guide.md Part 2 steps 2 and 7 skip deploy.md step 5 (push the code before creating the web app deployment). Step 7 deploys afterwards, so it probably works; it differs from deploy.md and is not yet exercised.
9. test/unit/docs/links.test.ts checks file paths only. Anchors (`admin-guide.md#backups-and-restore`) and reference-style links are not checked. The current anchor resolves.

## Implementer's reported mismatches

1. Spec 7 NOT_CONFIGURED: confirmed. Code shows "Migway Templates is not set up yet." and "The owner runs setup once and deploys; then reopen the sidebar." with a Retry button (states.ts:76-82). Spec says "Ask the owner to finish setup." and Retry "no". The document quotes the code. Spec errata.
2. Spec 7 AUTH_NO_USER: confirmed. Code shows "Cannot identify your Migway account." plus the Chrome profile line, also for AUTH_DOMAIN (states.ts:64-67). Spec errata.
3. Spec 7 TIMEOUT and SERVER: confirmed. Code: "Something went wrong.", "Request ID <id>", Retry button (states.ts:49-60). Same meaning; spec errata.
4. Spec 8 and 12 name 4 Lighthouse views: confirmed. scripts/lighthouse.mjs:14-23 audits 10. Spec stale.
5. `NOT_IMPLEMENTED`: confirmed. Only dev-harness.ts:831 throws it; no server path does. src/web/ui/status.ts:49-50 is dead in production. Code is wrong (BRIEF 10, no dead code); low risk.
6. `membership.refresh` and profiles: confirmed. handlers/admin.ts:89-95 refreshes the group snapshot only; `prof:*` (directory/profile.ts:60) stays up to 6 h. ADR-0004 line 98 is wrong against the code. The documents state 6 h, which matches the code. Amend the ADR, or add a profile generation key in code (Script Cache cannot list keys).

## Security and privacy

- Secret scan of 866 added lines: no key, token, client secret, private key, script ID or deployment ID. IDs are named only as `deploy/<env>.json` fields.
- Emails: `name@migway.com`, `sales-team@migway.com`, `templates-owner@migway.com` (generic). No real person's name. The owner's address does not appear.
- URLs: scope prefix, `https://mail.google.com/` (named as never requested), scheme names, `https://e.com` in a test string.
- No instruction to commit a token, to give the owner account a Workspace admin role (admin-guide.md:213 says it should have none), or to widen sharing of the Drive data folder. Option C transfers ownership; it does not share.
- Password handover: must-fix 1.
- D18: own heading in the quick start, first bullet states it plainly. Insert logging: must-fix 2.
- Scopes: 10 in admin-guide.md, appsscript.json and scripts/approved-scopes.json, identical.

## Readability of the quick start

- Steps 1 to 5 of "Insert a template" can be followed by a non-technical reader. Step 2 explains why to click into the text first.
- Step 3 assumes the icon is visible. In a narrow compose window Gmail can move add-on icons under "More options"; a reader then needs the screen. Add one sentence.
- "Search ... then click outside the box" is needed because the card searches on change; it reads as odd but works.
- Jargon: "panel", "chips", "fallback", "Migway directory", "Request ID". Chips and fallback are explained in place; "directory" is not.

## Result

FAIL. Fix must-fix 1 and 2. Minors 1 to 4 are one-line document edits and should go in the same retry; 5 to 9 can wait. Spec 7, 8, 12 and ADR-0004 errata go to the architect.
