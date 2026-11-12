# Review: slice 8c, admin view in design direction A

Verdict: PASS. Branch `slice/08c-ui-admin`, base 8395daf, reviewed at 75ebb53. No blocker. 9 minors, the first one should be fixed in the next server slice.

## Commands (clean install, run in the worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, 559 packages, 16 audit findings (same as 8a) |
| `npm run lint` | exit 0, clean |
| `npm run typecheck` | exit 0, clean |
| `npm run test:coverage` | 56 files, 1295 passed, 0 failed; all files lines 96.45%, branches 88.83% |
| `npm run build -- --env dev` | Code.js 326.7 KB of 800, index.html 352.9 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on all 12 runs, incl. "library dark" and "admin audit dark" |

## 1. Behavior regression

- `git diff --stat 8395daf..HEAD -- src/server src/addon src/shared appsscript.json scripts/lib src/web/editor src/web/views/editor.ts test/unit/web/editor*`: empty. `inlineHtml` (scripts/lib/html.mjs) unchanged. `src/web/ui/dialog.ts` unchanged.
- package.json and package-lock.json unchanged: no new dependency.
- Tests: none deleted, none renamed. 18 removed lines, each replaced by the new text or markup with the same behavior asserted (h3 to h2 headings, "+ Top-level folder", "Removed 1 items", result "denied", Details label, "Download JSON", jobs "late:" text, backup select). Added: 10 tests.
- New admin.test.ts run on the base code: 9 of 23 fail; "loads the library folders again after a grant change" fails with `expected +0 to be 1`, the trash count test fails on the dialog text.
- scripts/lighthouse.mjs adds one dark run only.

## 2. Keyboard and ARIA (Playwright, Chromium, dev harness; base served on a second port for comparison)

- Tablist: ArrowRight, End, Home, ArrowLeft move focus and route; roving tabindex; one h1 "Admin", tab sections h2.
- 390 px: `scrollWidth` 390 on all 6 tabs. Selected tab scrolled into view on load (Config: tab 304 to 374, row edge 374). Focus ring `outline-offset: -4px`, inside the row.
- Audit drawer: Enter opens, focus inside (first focusable, the Before `pre`), 6 Tabs stay inside, Esc closes, focus returns to the row's Details button. Background is not `inert` (no `inert`, no `aria-hidden` on main); it relies on `aria-modal` plus the focus trap. Same on base (dialog.ts unchanged).
- Filters: Result "Denied" plus Apply gives 9 rows. Pager: "Next page" by keyboard loses focus to BODY. Same on base.
- Folder tree: arrows, expand, Enter select the folder. Dialogs: Rename, New subfolder, New top-level folder focus the input; Move focuses the select; Delete, Restore backup and Empty trash focus Cancel. Esc returns focus to the opener in all 6.
- Add grant empty: focus to the principal input, `aria-invalid=true`, error id in `aria-describedby`.
- Import: Import disabled until Validate; after Validate, Tab reaches Import. After Import focus drops to BODY. Same on base.
- Stacked tables at 390: Chromium keeps table semantics (1 table, 51 rows, 300 cells, 6 column heads in the AX tree). Cell names carry the `::before` label: "Time Nov 9, 2:03 PM", "Actor Dev U.". A screen reader that also announces column heads reads the label twice (minor 6).

## 3. Contrast (computed, WCAG 2.1)

| Pair | Light | Dark |
|---|---|---|
| ok on ok-bg | 5.61 | 7.15 |
| warn on warn-bg | 6.29 | 7.42 |
| red on red-bg | 5.73 | 6.51 |
| warn on paper (icon, row) | 7.13 | 9.04 |
| warn on canvas (row hover) | 6.53 | 8.26 |
| ink-2 on select (plain tags) | 6.50 | 6.72 |
| ink on canvas (JSON block) | 14.08 | 12.96 |
| ink-3 on canvas (meta on hover) | 4.52 | 5.85 |

All 4 new pairs are in test/unit/web/contrast.test.ts at 4.5:1. The others were already there.

## 4. Security of the new markup

Patched harness bundle (page.route) with `<img src=x onerror=window.__x=1>"><svg onload=window.__x=2>` in: a folder name, a grant principal, a group name, the admin group, an audit actor, target path, before and after JSON, an audit action name, a template title (usage, trash, import skip line), a backup date and a job error. Import file with the payload as titles. Rename, Move, Delete and Restore dialogs opened on the hostile values. Result: 0 `img`, 0 `svg[onload]`, `window.__x` undefined, payload shown as text everywhere, 0 page errors. Import folder-name lines use the same `line.name` text child (the harness emits no folder lines). `actionWords` uses a Map: "toString", "__proto__" and unknown names come back as text. Only innerHTML in the diff scope: icons.ts sprite (static). No request outside 127.0.0.1.

Secret scan of added lines: no keys or tokens. Emails: dev.user@example.com, pat@example.com (test data).

## 5. Words for actions

All 40 policy ops except `ping`, `me`, `profile.me` (any caller, never audited) have a label. All server audit actions (handlers, jobs, dispatch denied rows, import, backup.restore, audit.dropped, triggers.ensure, web.open) have a label. No two ops share a label. Denials keep the action word plus a "Denied" tag. Destructive ops are distinct: "Template moved to trash", "Folder deleted", "Removed from trash for good", "Backup restored".

## 6. The three fixes

1. Empty trash: dialog and result both count templates. Works on the main path. Defect (minor 1): `purgeText(before, rows.length, purged)` infers templates from the list. When the reload after the purge fails, `load()` keeps the old `rows`, so the text reads "Removed 0 templates and N deleted folders" (trash.ts:140, load at trash.ts:229). A template trashed or restored by someone else between page load and click shifts the split too; that window is minutes, wider than the "during the purge" risk in the handoff. The server already knows the split: `purgeDeleted` returns `goneItems` (jobs/daily.ts). The result text should come from the server: add `templates: goneItems.length` to the `trash.purge` reply in the next server slice. Until then, fall back to "Removed n items for good." when the reload fails.
2. Grant add or remove calls `app.foldersChanged()` on success (adminFolders.ts:242). Test fails on base with 0 `folder.list` calls.
3. Outside recipients: base had no such row, so there was no old behavior to fail. `recipientsText` is tested (3 cases); the Config test asserts no row while `config.get` lacks the field. Spec 5.7 `RECIPIENTS_EXTERNAL` is still absent from src/server and src/shared.

## 7. Changed texts

The handoff table misses: new h2 "Settings" and "Jobs" (was a caption); the Validate/Import counts table and its 5 column heads; drawer Result "denied (DENIED)" now "Denied DENIED" (parentheses dropped, adminAudit.ts:77); "Actions" and "Details" column heads now screen-reader only; Restore accessible name "Restore the backup of <date>".

Less clear (minor 3): the admin export sentence says it downloads "the live templates, folders and grants of the scope you choose"; `export.library` skips private folders (transfer.ts:64). Add "shared".

Verbs: Export/Exporting/Exported, Import/Importing/Imported, Restore/Restoring/restored, Add grant/Adding/Added, Remove/Removing/Removed match. Empty trash does not: "Empty trash now..." / "Emptying the trash..." / "Removed n templates" (minor 4, existed before as "Removed n items").

## 8. Bundle

index.html 340.6 to 352.9 KB (+12.3 KB): styles.css 24.9 to 32.2 KB (+7.2 KB), the rest is admin view code and 5 icons. Code.js 326.7 KB. No font, image file or external URL added; only `http://www.w3.org/2000/svg` namespace string.

## 9. Visual

1440, 390 and dark screenshots match the 8a look (tabs, tags, ghost buttons, avatars). Defects, all minor (minor 5):
- config.png: Settings list, Jobs table and Backups list have 3 different widths (about 1055, 1580 and 720 px at 1x).
- folders-390.png: the 4 folder action buttons wrap 3 plus 1, "Delete..." alone on the second row.
- audit-details.png: the drawer Target shows the raw "/Sales/Quotes", the table shows "Sales / Quotes".
- Ghost "Remove" in Admin next to the default "Restore" in Trash (declared difference 4).

## Minors

1. trash.ts:140 purge result wrong when the reload fails or the list is stale; take the template count from the server (`goneItems.length`).
2. Audit actor shows the short name only; the full address sits in `title` (person.ts), which keyboard and touch users cannot reach. "ben@example.com" and "ben@other.org" both read "Ben". The drawer has the full address. Consider the full address as the accessible name in the audit table.
3. adminTransfer.ts:144 export sentence omits that private folders are left out.
4. Empty trash verbs differ across button, busy and result.
5. Visual items in section 9.
6. Stacked tables: label read twice by readers that announce column heads (data-label `::before` plus kept `th`).
7. Handoff text table incomplete (section 7).
8. Pre-existing, unchanged: background behind dialogs not `inert`; focus to BODY after "Next page" and after Import.
9. `tr.late` has no CSS left; kept only as a test hook.
