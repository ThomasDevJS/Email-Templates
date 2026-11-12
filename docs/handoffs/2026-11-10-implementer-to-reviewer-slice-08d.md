# Handoff: implementer to reviewer, slice 8d (web minors from 8a and 8c reviews)

Branch `slice/08d-web-minors`, base 5f83683, 6 commits. Web only: src/web, test/unit/web, docs/design/screens. No server, shared, add-on, editor, `inlineHtml`, package or lighthouse script change.

## Done

| # | Fix | Where | Test that fails on 5f83683 |
|---|---|---|---|
| 1 | `setInert(el, on)` (inert + aria-hidden) shared by the 390 px panel and `openDialog`. A dialog or drawer makes every body child inert except the backdrop and `#toasts` (alerts stay live); undo runs before focus returns to the opener. Stacked dialogs skip already inert elements. | ui/dialog.ts, app.ts | app.test "makes the page behind a dialog inert..."; adminReports drawer test |
| 2 | Next/Previous page focus the first row of the new page (rows `tabindex=-1`, list as fallback); status names the page. After Import, focus goes to the "Import report" table (`tabindex=-1`). | adminAudit.ts, adminTransfer.ts | adminReports "lists 50 events...", "validates a file..." |
| 3 | Audit actor: avatar, name, full address under it (12 px `--ink-3`, no tooltip). Library By, trash By and history rows keep the tooltip and add sr-only " (address)". | ui/person.ts, history.ts | adminReports "actor ... under the name"; 2 app.test cases |
| 4 | Export sentence names the private folders. Checked: `export.library` uses `libraryFolders` (transfer.ts), which drops every folder in a private tree. | adminTransfer.ts | adminReports "downloads the library..." |
| 5 | Empty trash verbs: button, title, confirm, busy, result all "Empty". `load()` returns false on failure; then the result is "Emptied the trash. The list could not be refreshed." with no count. Server unchanged. | trash.ts, admin/actions.ts | admin.test "says the trash was emptied without a count..." plus 3 updated |
| 6 | `.config` wrapper: Settings, Jobs, Backups all 760 px (measured 276..1036 px at 1440), 200 px first column for facts and jobs. Schedule and Last OK stay on one line. | adminConfig.ts, styles.css | styles.test, adminReports config |
| 7 | Folder actions: `.folder-actions` is a 2 by 2 grid under 860 px. Measured tops at 390: 470, 470, 510, 510. | adminFolders.ts, styles.css | styles.test, admin.test "moves a folder..." |
| 8 | Drawer Target in words ("Sales / Quotes"); "Technical details" h3 with Operation and raw Target (`/Sales/Quotes`). | adminAudit.ts | adminReports drawer test |
| 9 | Stacked label `content: attr(data-label) / ""` (plain `attr()` kept first as fallback). Chromium AX tree at 390: cell "Nov 9, 2:03 PM" (was "Time Nov 9, 2:03 PM"). | styles.css | styles.test |
| 10 | `tr.late` class removed. `NOT_IMPLEMENTED` text removed from `messageOf`: grep of src/server and src/addon finds no sender; only dev-harness.ts throws it for unknown ops, now shown as the generic toast. | adminConfig.ts, ui/status.ts | adminReports config, logic.test |
| 11 | Focus ring on the active item, inside it (`outline-offset: -2px`): history active version (list itself `outline: none`), tree item, grid cell, audit row. | styles.css | styles.test |
| 12 | Status lines: busy "Verbing...", result "Verbed ...", period. See text table. | adminTransfer.ts, admin/model.ts | adminModel, adminReports |

## Changed user-facing texts

| Where | Old | New |
|---|---|---|
| Audit status | "Events 1 to 50 of 60." | "Page 1: events 1 to 50 of 60." |
| Audit actor cell | "Dev U." (address in tooltip) | "Dev U." with "dev.user@example.com" under it, no tooltip |
| Drawer | "Operation" in the main list; "Target" "/Sales/Quotes" | "Target" "Sales / Quotes"; new h3 "Technical details" with "Operation" and "Target" "/Sales/Quotes" |
| Export hint (admin) | "...without the trash, older versions, favorites, usage or the audit log." | same, plus "A whole-library export leaves out the private folders (each user's My templates)." |
| Export progress | "Exporting... 20 of 45 templates." | "Exporting 20 of 45 templates..." |
| Validate | "Validate: would create N templates, ..." | "Validated. Import would create N templates, ..." |
| Import | "Imported: N templates, ..." | "Imported N templates, ..." |
| Empty trash body | "Remove all N templates in the trash for good? Deleted folders go too. This cannot be undone." | "Empty the trash? All N templates in it are removed for good, and deleted folders go too. This cannot be undone." |
| Empty trash result | "Removed N templates for good." / "Removed N templates and M deleted folders for good." | "Emptied the trash: N templates removed for good." / "Emptied the trash: N templates and M deleted folders removed for good." |
| Empty trash, reload failed | "Removed 0 templates and N deleted folders for good." (wrong) | "Emptied the trash. The list could not be refreshed." |
| NOT_IMPLEMENTED toast | "This action arrives in a later release." | "Something went wrong. Retry." |
| Screen reader only | library By, trash By, history row: "Ben" | "Ben (ben@example.com)" |
| Screen reader, stacked cells | "Time Nov 9, 2:03 PM" | "Nov 9, 2:03 PM" (column head read once) |

Unchanged: "Empty trash now...", "Empty trash" (title and confirm), "Emptying the trash...".

## Verified and how

Chromium (Playwright, dev harness, 1440x900 and 390x844, light and dark): Next page by Enter puts focus on a `TR` in tbody, status "Page 2: events 51 to 60 of 60."; drawer open sets `.shell` inert, Esc returns focus to "Details"; Delete dialog sets inert and aria-hidden, Esc returns focus to the grid cell and clears both; history list `outline-style` none, active row solid; no page errors, no request outside 127.0.0.1. Screens read: audit, audit-dark, audit-390, drawer, page 2, config, folders 390 and 1440, transfer, history light and dark, tree and grid focus, dialog.

All 22 new or changed assertions fail on 5f83683 source (src/web swapped back, 22 failed, 177 passed).

## Commands (clean install)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages, 16 audit findings (unchanged) |
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test:coverage` | 60 files, 1350 passed; all files lines 96.55% |
| `npm run build -- --env dev` | Code.js 335.7 KB of 800, index.html 355.1 KB of 400 (was 352.9) |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on all 12 runs, library dark and admin audit dark included |

## Screens

- Replaced 8c: audit, audit-dark, audit-390, audit-details, config, folders, folders-390, transfer. 8a: history, history-dark.
- New 8d: audit-actor, audit-drawer, audit-page2, config, folders-390, history-focus, dialog, tree-focus, grid-focus.

## Left for later

- Empty trash split still comes from the list (`before` from page load minus the reloaded count). A trash change by another user between load and click shifts the split. Fix needs `templates: goneItems.length` in the `trash.purge` reply (server slice).
- Export progress text "Exporting N of M templates..." has no test (needs over 20 templates in the harness).
- Delete folder confirm button is primary, not destructive (outside this list).

## Risks

- `content: attr() / ""` alt text: Chromium supports it; an older browser drops the second declaration and keeps the first (label read twice, as before).
- No new color token; `--ink-3` on paper 4.93 and canvas 4.52 already in the contrast table.

## Files touched

src/web/app.ts, src/web/styles.css, src/web/ui/{dialog,person,status}.ts, src/web/admin/{actions,model}.ts, src/web/views/{adminAudit,adminConfig,adminFolders,adminTransfer,history,trash}.ts, test/unit/web/{admin,adminActions,adminModel,adminReports,app,logic}.test.ts, test/unit/web/styles.test.ts (new), docs/design/screens/8a, 8c, 8d.
