# Handoff: implementer to reviewer, slice 8c (admin view, design direction A)

Branch `slice/08c-ui-admin`, base 8395daf, commits 7a96c6a, fe0618b, c1c7a30, 7bdeb32. Not merged, not pushed.

## Done

- Page title "Admin" is the page's h1 (20 px, 600) in `.page-head`. Section headings in the tabs moved from h3 to h2 so the order stays h1, h2.
- Tab row: underlined, scrolls inside its own row under 860 px (`overflow-x: auto`, hidden scrollbar), focus ring drawn inside the tab (`outline-offset: -4px`) so the row never clips it. The selected tab scrolls into view on load. Tablist roles, keys, routes unchanged.
- New `src/web/views/adminTable.ts`: `adminTable`, `tableRow`, `noteRow`, `toneTag`. Every cell carries `data-label`; under 860 px admin tables stack as "label value" lines (same idea as the 8a trash rows).
- New `src/web/admin/actions.ts` (pure): `actionWords` (one table, op name to words, unknown name as is), `resultTag` (word plus tint), `purgeText`.
- Folders and grants: tree as before (shared tree component); "New top-level folder" (admins) as a ghost button under the tree; folder header h2 with "New subfolder", "Rename...", "Move...", "Delete..."; access table with a type icon (group, person, domain, org unit; the type word is in `sr-only` text before the key), level as a tag, source in `.meta`, Remove as a ghost button; add-grant form as one row with labels; "Enter a principal." now sits under the field with `aria-invalid` and `aria-describedby`.
- Memberships: resolver line as meta text, "Refresh now" right in the header row, numbers right aligned, status as a tag, warning row with the warning icon in `--warn`.
- Audit log: filters as a compact labelled row (2 columns at 390 px), table with time, actor (avatar, short name, full address in `title`), action in words (raw name in `title`), target as a path, result tag, Details as a ghost button. Action and result filter options show words, values stay raw. Status line and pager share a footer row. Drawer: facts list with Action in words plus "Operation" with the raw name in `code`, Result tag, Request ID in `code`, JSON in a wrapping monospace block (`tabindex=0` kept).
- Usage: title in 600, folder as a path, applies right aligned.
- Export and import: two sections, one sentence each, scope radios, Folder plus Export in one row; file field styled; Validate then Import with a one-line hint; report as a small counts table ("Validate report" or "Import report") plus the "Skipped and failed records" table with tags.
- Config: "Settings" as a two-column definition list; Jobs table with status tags ("OK"; "Late" or "Never ran" in the warn tint with the last error under it); backups as a list, one "Restore" per row (accessible name "Restore the backup of <date>") behind the same confirmation. All Restore buttons are disabled while one restore runs.
- Fixes, each with a test:
  1. Empty trash: the dialog counts templates; the result now counts templates the same way and names deleted folders apart (`purgeText`: templates = trash rows before minus after, capped at `purged`; folders = the rest). The harness now purges deleted folders and counts them, as the server does. Test "counts templates in both the dialog and the result when deleted folders go too" fails on base (dialog text, result "Removed 2 items").
  2. Grant add and remove call `app.foldersChanged()`, so the next library view loads folders again. Test "loads the library folders again after a grant change" counts `folder.list` calls; it fails on base (0 calls).
  3. `ConfigView.recipientsExternal?` and `recipientsText` (admin/model.ts): the Config tab shows "Outside recipients" only when `config.get` returns the value. It does not yet; today no row shows (test asserts that).
- Lighthouse: added the dark run "admin audit dark".

## Changed user-facing texts (old, new)

| Where | Old | New |
|---|---|---|
| Folders, root | "+ Top-level folder" (primary, in the detail pane) | "New top-level folder" (ghost, under the tree) |
| Folders, header | "+ Subfolder" | "New subfolder" |
| Grant level options | "use", "edit", "manage" | "Use", "Edit", "Manage" (values unchanged; status "with level use" unchanged) |
| Memberships status | "ok", "error: could not be read" | tag "OK", tag "Could not be read" |
| Audit result cells and filter | "ok", "denied", "conflict", "error" | "OK", "Denied", "Conflict", "Error" |
| Audit action cells and filter | raw op name, for example "template.update" | words, for example "Template updated" |
| Audit Details accessible name | "Details: template.update at ..." | "Details: Template updated at ..." |
| Audit drawer | (none) | new row "Operation" with the raw name |
| Export button (admin) | "Download JSON" | "Export" (matches "Exporting..." and "Exported ...") |
| Export section | (no sentence) | "Downloads the live templates, folders and grants of the scope you choose as one JSON file, without the trash, older versions, favorites, usage or the audit log." (manager: "... of a folder you manage and its subfolders ...") |
| Import sentence | "An export file of up to 5 MB and 200 templates. Validate shows what Import would do; nothing is written before Import." | "Adds the templates of an export file of up to 5 MB and 200 templates to a shared folder as new templates, without the file's grants and without templates whose title is already in their folder." plus "Validate writes nothing and shows what Import would do." |
| Import report lines | kind "folder"/"template", result "skipped"/"failed" | "Folder"/"Template", tags "Skipped"/"Failed" |
| Config jobs status | "ok", "late: <error>", "never ran: <error>" | tag "OK", tag "Late" or "Never ran" with the error on the next line |
| Config backups | select "Backup date" plus "Restore from backup" | list of dates, "Restore" per row |
| Config trigger error | red `.late` text | `.error` text, same words |
| Trash dialog | "Remove all n templates in the trash for good? This cannot be undone." | "Remove all n templates in the trash for good? Deleted folders go too. This cannot be undone." |
| Trash result | "Removed n items for good." | "Removed n templates for good." or "Removed n templates and m deleted folders for good." (singular for 1) |

Docs that quote old texts (not changed in this slice): docs/guide/admin-guide.md lines 120 and 193, docs/ops/smoke.md lines 112, 119, 130, docs/wireframes/06-web-admin.txt lines 26, 59, 105.

## Differences from the design system

1. Tags for results use three new tint tokens (`--ok-bg`, `--warn-bg`, `--red-bg`, light and dark) in place of `--select`; the design system asks for "`--ok` and `--red` tints". Pairs added to `contrast.test.ts` at 4.5:1, plus `--warn` on `--canvas`.
2. "Conflict", "Late", "Never ran", "Skipped" use a warn tint; the design system names only ok and red tints.
3. Admin tables under 860 px stack as label and value lines (generic `data-label`), where library and trash use two-line grid rows; admin tables have 4 to 6 columns of varying kinds.
4. Remove and Details are ghost buttons (task wording); Restore on backups is a default button. No destructive button outside a dialog.
5. Script Property names (ADMIN_GROUP, INDEX_REV, ...) stay as Config terms; they are what the owner types in the script editor.
6. Tab row on narrow screens hides its scrollbar; the cut tab at the edge shows there is more.

## Verified

`rm -rf node_modules && npm ci`: 559 packages, 16 audit findings (same as 8a). `npm run lint`: clean. `npm run typecheck`: clean. `npm run test:coverage`: 56 files, 1295 passed, 10 of them new (admin 3, adminReports 1, adminModel 1, adminActions 5); all files lines 96.45%. `npm run build -- --env dev`: Code.js 326.7 KB of 800, index.html 352.9 KB of 400 (340.6 before). `npm run scopes:check`: 10 scopes approved. `npm run format:check`: clean. `npm run lighthouse`: 100 on all 12 runs, including "admin audit dark".
Playwright at 390 by 844: `scrollWidth` 390 on all 6 tabs (was 665). 1440 by 900 light and dark checked by eye against the 8a screens.
`git diff --stat 8395daf -- src/server src/addon src/shared scripts/lib appsscript.json`: empty.

## Screenshots (docs/design/screens/8c, 1440 by 900 at 2x unless noted)

folders.png (Sales / Quotes selected), memberships.png, audit.png, usage.png, transfer.png, config.png, audit-dark.png, audit-details.png, folders-390.png (full page), audit-390.png.

## Left for later

- Update the guide, smoke and wireframe quotes listed above.
- `config.get` to return `RECIPIENTS_EXTERNAL` (server change; the web row is ready).
- Server-side VALIDATION errors from `grant.add` still show in the status line, not under the field.

## Risks

- `purgeText` derives the template count from the trash list before and after; a template deleted by another user during the purge can shift the split by one.
- The tab row scroll uses `offsetLeft` with `.tabs` as offset parent (`position: relative`).

## Files touched

src/web/styles.css, src/web/ui/icons.ts, src/web/views/{admin,adminAudit,adminConfig,adminFolders,adminTable,adminTransfer,adminUsage,memberships,trash}.ts, src/web/admin/{actions,model}.ts, src/web/rpc/api.ts, src/web/dev-harness.ts, scripts/lighthouse.mjs, test/unit/web/{admin,adminActions,adminModel,adminReports,contrast}.test.ts, docs/design/screens/8c/*.png.
