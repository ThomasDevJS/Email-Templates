# Review: slice 8b merged with the main line

Verdict: PASS

Head 0a59b34 on `slice/08b-ui-editor`. Merge f1d9c45 (parents 8ff05b9, slice 8b, and fe33d50, main line with slices 11, 12 and 13). Follow-ups 3b3e51c, 60687b7, a4f586c. Reviewed 2026-11-11.

The merge lost nothing from either parent. Nothing is duplicated. Server, add-on and shared code are byte-identical to the main line. All checks pass from a clean install. The 6 meeting points behave as the handoff says in Chromium.

## Checks (clean install)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, 559 packages |
| `npm run lint` | exit 0, 0 problems |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 65 files, 1774 tests passed, 0 failed. Statements 96.97% (6835/7048), branches 90.99% (3557/3909), functions 96.41% (2151/2231), lines 97.77% (6232/6374) |
| `npm run build -- --env dev` | Code.js 358.6 KB of 800, index.html 374.3 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on 15 of 15 (library, editor, history, 6 admin tabs, trash, library personal off, library dark, editor dark, admin audit dark, admin config dark) |

## 1. Nothing lost, nothing doubled

`git show --remerge-diff f1d9c45` read for all 8 conflicted files.

- `src/web/app.ts`: the Back and Forward handler keeps 8b's `returning`, `canLeave`, held route and `host.go(-moved)`. Slice 13's `cancelDialogs()` and `main.focus()` sit inside `open()`. `cancelDialogs` is called in 2 places only: app.ts:311 and editor.ts:1052.
- `src/web/dev-harness.ts`: both doc option lists, both imports. One `PARAMS` (the auto-merged duplicate removed). `devPolicy` reads `settings.recipientsExternal`; `?external=deny` seeds that entry. Ops and URL params: 41 in the result, 0 missing from either parent.
- `src/web/rpc/api.ts`: both type imports. API members: 0 missing from either parent.
- `scripts/lighthouse.mjs`: 11 light plus 4 dark runs = union of 13 (branch) and 14 (main).
- `docs/ops/smoke.md`: sections once each, order 1 ... 6b, 8b, 9, 11, 12, S7. Slice 9 setup names the editor's To, Cc and Bcc fields and "Admin, Config, Settings, Outside recipients: allowed". No Script Property in Slice 9. `RECIPIENTS_EXTERNAL` appears only in Slice 11 steps 1, 2 and 10 (main's cleanup steps).
- `docs/guide/editor-guide.md`: 8b chip text plus the admin setting sentence. No "arrive with the redesign" sentence left in docs/guide or docs/ops.
- Both MEMORY.md files: both sides kept, 149 lines each.

Declared symbols in `src/web` and `scripts` across 8ff05b9, fe33d50 and 0a59b34: 9 names absent from the result, each removed on purpose by one side from the merge base 7ce6810 (`recipientsText`, `templates`, adminConfig `settings` by main; `chipText`, `versionText`, `kind`, editor `fields` const by 8b; `plural` became an export). Names with a higher count than either parent sit in different files (union, no duplicates). Stylesheet: 0 top-level selectors duplicated beyond those already doubled in a parent; the 47 lines from main are the `.setting*` rules only.

## 2. Test suites

- No test file deleted against either parent.
- Lines removed against fe33d50 in test/: every one is also removed by 8b from the merge base. Same for lines removed against 8ff05b9 (all removed by main). No test was weakened by the merge.
- Follow-ups add tests only (editorPanel "merge with the main line", 6 cases; webBundle 2 assertions).

## 3. Meeting points in Chromium (Playwright, dev harness)

a. Library, open Discount approval, edit, Link dialog open, Back: 1 dialog "Leave without saving?", hash and `history.length` (4) unchanged. Back again: still 1. Keep editing: 0 dialogs, 0 inert, length 4, title kept, typing in the body works. Image dialog open plus Back: only the question; Discard leaves to the library, 0 inert. Clean editor with Link open plus Back: library, 0 dialogs, 0 inert. Slice 13 rule: folder-choice dialog in the library plus Back: closed, 0 inert; trash "Empty trash" dialog plus Back: closed, 0 inert; admin audit drawer plus Back: closed, 0 inert.
b. New template, folder Quotes, Create: `#/new?folder=F-QUOTES`, editor loads. Edit then Back: 1 question, route held. Trash link: 1 question.
c. Allowed: Bcc `records@partner.com` shows "outside example.com", error empty, save gives "Saved as version 3". `?external=deny`: same mark plus "Bcc, address 1 is outside example.com. Your admin allows only example.com addresses. Remove it to save." under Bcc; save stays "Unsaved changes". Server refusal: chip added while allowed, `config.set` to deny from another tab, Save: `template.update` answers VALIDATION with problem `RCPT_EXTERNAL` on field bcc (RPC captured).
d. `?sample=freight&personal=off`, T-BOOKED (My templates): note "Personal templates are turned off by your admin. You can still insert this template.", no toolbar, Save hidden, title read-only, Trash leaves with 0 dialogs. T-POD (Billing, shared): toolbar present, no note, edit then Trash asks.
e. Cc `finance.desk@example.com` saved in the editor; library search for the full address and for `finance.desk` lists "Discount approval" only.
f. Library, editor, admin Config (2 `.setting` fieldsets), folder-choice dialog and trash dialog at 1440 and 390, light and dark: 20 shots, 0 px sideways overflow. Computed styles (18 properties per element) of the merge against the parent that owns each view: library, Config, folder choice and trash vs fe33d50: 0 differences; editor vs 8ff05b9: 0 differences. Library vs 8ff05b9 differs by slice 13's library changes only (matches main).

## 4. `cancelDialogs()` placement

Route change: `open()` cancels every dialog and drawer, then renders; focus goes to `main` if it was on body. Held navigation: app.ts does not cancel; the editor's `canLeave` cancels its own link, image or field dialog first (3b3e51c), then asks. After Keep editing the cancelled dialog is gone, nothing is inert, focus returns to the editor and editing works. A clean editor never asks, so `open()` runs and cancels.

## 5. Server and add-on

`git diff fe33d50 0a59b34 -- src/server src/addon src/shared appsscript.json scripts/lib/html.mjs`: empty. Scopes unchanged (10).

## 6. Secret scan

265 added lines (remerge diff plus 3b3e51c, 60687b7, a4f586c, 0a59b34). 0 hits for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, github_pat, AKIA, xox, eyJ. Emails: placeholders only (example.com, partner.com, company.com, s8b-/s9- test addresses at migway.com, safety@migway.com). 0 URLs.

## Gaps

None blocking.

1. Minor: `.claude/agent-memory/implementer/MEMORY.md:126` says Back/Forward runs `cancelDialogs()` first, then `canLeave`. The code calls it in `open()` (app.ts:311) and inside the editor's `canLeave` (editor.ts:1052). Memory only; fix the note.
2. Minor, carried from the handoff: smoke "Slice 8b" has no step for Back with a link dialog open (unit tests only).
3. Minor: the merge test for the deny rule (editorPanel.test.ts:1118) checks the client error only; the server refusal on save is checked here by probe, not by a web test (server tests of slice 11 cover RCPT_EXTERNAL).

Pre-existing, not from the merge: an audit row clicked and then sent Enter can open 2 drawers on fe33d50 too (1 of 3 probe runs).
