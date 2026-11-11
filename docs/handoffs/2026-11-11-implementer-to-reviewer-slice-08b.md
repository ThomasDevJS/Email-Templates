# Handoff: implementer to reviewer, slice 8b (editor in design direction A, recipient fields)

Branch `slice/08b-ui-editor`, base `7ce6810`, 5 commits (cc22749, 6329420, 6dac27a, 4d00ef4, plus this handoff). Not merged, not pushed.

## Done

1. Header: folder path as buttons that open the folder in the library, then the title (`h1`); saved state with the check (`role="status"`): "Saved as version 4, 2:05 PM" (date added when the save was not today, local time), "Unsaved changes", "Saving...", "Not saved yet"; History as a ghost button with the clock icon; Save primary; Ctrl+S unchanged.
2. Toolbar (src/web/editor/toolbar.ts): 5 groups with `role="separator"` dividers: Undo, Redo | "Paragraph" and "Normal" pickers (show the current value) | B, I, U, S letters, Text color, Highlight color | Align text, Bulleted list, Numbered list, Quote | Link, Image, Table, Horizontal line | "Insert field" at the right end in the blank colors. Every button has a name, a tooltip with its shortcut ("Bold (Ctrl+B)"), `aria-pressed` on toggles, `aria-haspopup` on menus; one tab stop, arrows, Home, End (roving tabindex, unchanged code).
3. The sheet: 680 px over `--canvas`, Subject row on top (label, borderless input, counter "n/200 (optional)"), body 15 px / 1.6. Subject keeps validation and "Insert field" at the caret.
4. Blanks: value placeholders amber with a dotted line, prompts in a dashed box, fallback as "name or fallback" (`.ph-or`), no "Ask:" prefix. Same markup in the editor (`toDOM`) and the history preview (`blankHtml`). Accessible names: "Field: Load number, asked at insert", "Field: Recipient first name, fallback there", "Field: Sender name". Atomicity, delete, bold around a blank, copy and paste: existing tests pass.
5. Right panel 340 px: "Details" (Title, Folder, Tags, To, Cc, Bcc), "The sender fills in" (each prompt of subject and body by identity, "used once" / "used n times", `promptUses`), tabs "Preview as me" and "Problems n" (ARIA tabs, arrows; Problems opens by itself when a save fails).
6. Recipient fields (src/web/views/recipients.ts): chips; Enter, comma, semicolon, space, paste of a list and leaving the field make chips (`splitAddresses`: trim, lower case, repeats dropped); Backspace in the empty input removes the last chip; "Remove x from Cc" buttons; "outside <domain>" under a valid outside address; Bcc note; group help. Shared `validateRecipients` on every change with the policy from `me` (domain of the caller's email, `recipientsExternal`); the server's VALIDATION `details.problems` with `field` to/cc/bcc replace them under the field and fill Problems. Chips named by a problem get the error style. Save always sends `to`, `cc`, `bcc`. Load shows the lists; `use` callers see them read-only.
7. Preview: To, Cc, Bcc lines above the subject when the template has recipients; body with "[Label]" as before.
8. Under 860 px: panel below the sheet, each section collapses with its heading button (`aria-expanded`, `aria-controls`); toolbar scrolls inside its row, focus ring inset; 0 px sideways overflow at 390 (measured in Chromium).
9. History: the version sheet shows the version's To, Cc, Bcc lines; restore shows "Restored as version N. The Cc addresses of version K could not be read and were left empty. Add them again in the editor." when the server returns `recipientsUnreadable` (`restoredText`).
10. Image fix: `imageWidth(natural)`: own width up to 600, never stretched, null when the image does not load in 5 s. The dialog hint says so. Tests: unit and a dialog flow with a stubbed `Image`.
11. States: skeleton shaped like the editor (toolbar bar, sheet lines, panel rows, `aria-busy`); read-only for `use` (no toolbar, Save, History; `contenteditable=false`, inputs read-only, folder select disabled and showing its path, chips without ×, note); conflict dialog and toasts use the design-system dialog and toast (behavior unchanged).
12. Wording: list below.

## Changed texts (old, new)

| Where | Old | New |
|---|---|---|
| Header back link | "‹ Library" | folder path buttons ("Dispatch", "Rate confirmations") |
| Header version | "Version 4" | "Saved as version 4, 2:05 PM" / "Unsaved changes" / "Saving..." / "Not saved yet" |
| Status after save | "Saved as version N, time" (status line) | same text, in the header |
| Toolbar | "Text" | "Paragraph" picker, name "Block style: Paragraph" |
| Toolbar | "Size" ("Font size") | "Normal" picker, name "Text size: Normal" |
| Toolbar | "Font" ("Font family") | removed (see differences) |
| Toolbar | "Color", "Highlight" | icons "Text color", "Highlight color" |
| Toolbar | "Align" ("Align text") | icon "Align text" |
| Toolbar | "• List", "1. List" ("1. List, numbered") | icons "Bulleted list", "Numbered list" |
| Toolbar | "Line", "Link", "Image" ("Image by URL"), "Table", "Quote" | icons "Horizontal line", "Link", "Image", "Table", "Quote" |
| Toolbar | (none) | "Undo" (Ctrl+Z), "Redo" (Ctrl+Y) |
| Toolbar | "{{ Placeholder" ("Insert placeholder", tooltip "Insert placeholder (type {{)") | "Insert field" (tooltip "Insert field (type {{)") |
| Placeholder menu name | "Placeholders" | "Insert field" |
| Blank text | "Ask: Meeting date", "Recipient first name \| there" | "Meeting date", "Recipient first name or there" |
| Blank name | "Placeholder: sender name", "Placeholder: ask: meeting date" | "Field: Sender name", "Field: Meeting date, asked at insert", "Field: Recipient first name, fallback there" |
| Link dialog title | "Link" | "Insert link" |
| Image dialog title | "Image" | "Insert image" |
| Image hint | "Images are linked, not uploaded. Width is set to 600 pixels or less." | "The email links to the image; nothing is uploaded. An image wider than 600 pixels is shown 600 pixels wide." |
| Not saved | "Not saved. Fix the problems listed above." | "Not saved. Fix the problems in the Problems tab." |
| Conflict, busy | "Loading the latest version..." | "Opening their version..." |
| Conflict, done | "Loaded the latest version. Your changes were discarded." | "Opened their version. Your changes were discarded." |
| Copy my text | "Your text is on the clipboard. Open their version and paste it where needed." | "Copied your text. Open their version and paste it where needed." |
| Folder of a template outside the caller's edit folders | "Current folder" | its path, "Current folder" only when unknown |
| Preview heading | "Preview as me" (h2) | tab "Preview as me", tab "Problems n" |
| New | | "Details", "The sender fills in", "used once", "used n times", "Nothing yet. To add a question, choose Insert field, then Ask the user.", "None." (read-only), "Preview" (narrow heading), "You can use this template but not change it. To change it, ask a folder manager for edit access.", "None" (empty read-only field), "Remove x from Cc", "outside example.com", "Hidden from the other recipients of the email.", "Added to the draft when someone inserts this template. Users see every address before it is added.", the restore notice above |

## Differences from the mockup or the design system, and why

1. Subject shows token text (`{{ask:Load number}}`), not blanks: the subject is a plain input (wireframe 04, spec 5.6); the task keeps it.
2. Size picker shows "Normal", "Small", "Large", "Huge" in place of "14": the schema's sizes are named, the default has no pixel value.
3. Text color and highlight are two buttons (task item 2); the mockup has one drop icon.
4. Font family picker: removed in the first build, restored in the follow-up (see below).
5. "or" of a fallback in `--ink-2`: `--ink-3` on `--blank-bg` is 4.4:1. Pair added to the contrast table.
6. To, Cc, Bcc labels above the field (wireframe 04); Title, Folder, Tags keep the mockup's left labels. Chips plus the input do not fit a 228 px column.
7. Tags keep the input, "Add tag" and "Up to 10 tags." (behavior unchanged); the mockup shows chips only.
8. "Insert field" border is `--blank-line`; the mockup's `#e9cf86` is no token.
9. Toolbar side padding 16 (mockup 28) so the extra Highlight button fits one row at 1440. It wraps between 860 and about 1400 px.
10. Folder select shows the path ("Dispatch / Rate confirmations"): two folders may share a name.
11. Subject input has no border at rest (mockup); hover shows `--field-line`, focus the ring. Design system asks for a bordered input.
12. Saved time adds the date when the save was not today; the mockup shows the time only.
13. Backspace in an empty recipient input removes the last chip (task); wireframe 04 says it selects it and Delete removes it.
14. Problems count lists the last save (errors and warnings); live recipient errors show under the fields.
15. Spec section 8 says blanks are named "Placeholder: sender name"; the task's "Field: ..." names are built. Spec erratum for the architect.

## Server change

None. The web API gained `me()` (op `me` exists, policy `ANY_CALLER`), `SaveArgs` gained `to`, `cc`, `bcc`, `VersionBody` the lists, `restore` the optional `recipientsUnreadable`. Dev harness: op `me`, lists stored, validated (`prepareBody` with the policy), returned by `version.get`, copied by duplicate and restore; `?external=deny` (seeded templates keep outside addresses), `?unreadable=cc,bcc`; the freight sample's "Rate confirmation" has To, Cc and an outside Bcc.

## Verified

From a clean install (`rm -rf node_modules && npm ci`):
- `npm run lint`: clean. `npm run typecheck`: clean.
- `npm run test:coverage`: 63 files, 1463 tests passed; all files 96.04% statements, 89.89% branches, 95.27% functions, 96.94% lines.
- `npm run build -- --env dev`: Code.js 347.9 KB of 800 KB, index.html 375.1 KB of 400 KB (base 355.1 KB, +20.0 KB: CSS +8.8 KB, script +11.2 KB for the editor view, the chip fields, the shared `validateRecipients` now in the web bundle, the toolbar groups).
- `npm run scopes:check`: 10 scopes, all approved. `npm run format:check`: clean.
- `npm run lighthouse`: 100 on all 13 runs (10 light views, library dark, editor dark (new), admin audit dark).
- Chromium (Playwright) at 1440 x 900 and 390 x 844, light and dark, compared with direction-a-editor.png: 0 px sideways overflow on every shot.
- New tests: test/unit/web/editorPanel.test.ts (15: header states, skeleton, crumbs, panel sections, tabs, chips by key and paste, Backspace, remove, outside mark, spec 7.1 texts, limits, duplicate, save sends and clears lists, `deny` locally and from the server, read-only, image width flow, history line and unreadable notice, `savedText`, `restoredText`, `splitAddresses`); editor.test.ts (blank look and names, toolbar groups, tooltips, pickers, undo and redo, `imageWidth`); logic.test.ts (`blankHtml`, `promptUses`, `recipientLines`, `me` op); styles.test.ts (3 CSS rules jsdom cannot match). Tests updated to the new markup in app.test.ts; none deleted; round-trip fixtures unchanged.

## Screenshots (device scale 2, docs/design/screens/8b/)

editor.png, editor-dark.png, editor-390.png, placeholder-menu.png, link-dialog.png, recipient-error.png (chips, outside mark, a format error and the `deny` error), preview-recipients.png, history-recipients.png, editor-readonly.png.

## Left for later

- Unsaved-changes guard: built in the follow-up (see below).
- Library address search (spec 13.6 item 6, Q39): library view belongs to the admin-settings worktree.
- Spec 8 blank names and the wireframe 04 Backspace rule (items 13 and 15 above): architect.

## Risks

- The image dialog loads the typed URL in the browser to read its width (the same request the editor makes when it shows the image). An image host that blocks the page gets no width: the email shows it at its own size.
- The other worktree changes the library and the harness `config.get`; app.test.ts changed only in the editor and history blocks; `.editor-title` kept on the h1 so the library test needs no edit. CSS lives in one "Editor (slice 8b)" block plus a narrow block inside it.
- Not verified on Google: the editor against the real server (smoke "Slice 8b").

## Files touched

src/web/views/{editor,recipients (new),history,preview,tags}.ts, src/web/editor/{toolbar,schema,commands,setup}.ts, src/web/rpc/api.ts, src/web/ui/icons.ts (highlight), src/web/styles.css, src/web/dev-harness.ts, scripts/lighthouse.mjs; test/unit/web/{editorPanel (new),editor,app,logic,contrast,styles}.test.ts; docs/ops/smoke.md, docs/guide/editor-guide.md, docs/design/screens/8b/*.png, this handoff.

## Commands

```
git checkout slice/08b-ui-editor
rm -rf node_modules && npm ci
npm run lint && npm run typecheck && npm run test:coverage
npm run build -- --env dev && npm run scopes:check && npm run format:check && npm run lighthouse
```

## Follow-up (2026-11-11, coordinator: font picker, guard, "Reads as")

Commits 9c03426, 3099486, 333bbe9, 632fa2b, plus this handoff commit.

1. Font picker restored after "Text size" in the text group: `FONT_FAMILIES` (6 families, as the schema parses) back in schema.ts; the menu draws each name in its face (`MenuItem.font`, one optional field in ui/menu.ts); "Default" removes the family. The button text stays "Font"; its name carries the value ("Font: Georgia", "Font: Default", "Font: Other font" for a pasted family outside the list) and the menu checks the current one. A fixed word keeps the row width: in Chromium at 1440 x 900 the toolbar is one row with 14 px to spare, with no family and with Times New Roman, Trebuchet MS and Courier New set (toolbar gap 1 px, side padding 12, picker text 13 px, chevrons 12 px). Test: each family applies, serializes as `<span style="font-family: ...">`, reads back in the name and the check; round-trip fixtures pass unchanged.
2. Unsaved-changes guard. Route hook in src/web/app.ts: `leaving(leave)` (calls `view.canLeave(leave)`; `app.go` runs through it) and the `host.onBackForward` handler (asks the view; while it asks, the address goes back to the editor route; leaving moves it on). Type: `View.canLeave?(leave): boolean` in views/context.ts. The editor answers true when nothing changed, the caller has no edit, or the view is off the page; else it opens "Leave without saving?" ("Keep editing" focused, "Discard changes", "Save and leave"). `save()` now returns whether it succeeded; "Save and leave" closes the question, saves, and leaves only on success (a failed save shows its toast; a conflict shows "This template changed"). Every exit goes through `app.go` or Back and Forward: sidebar All templates, Favorites, Trash, Admin, folder tree, breadcrumb, History, Back and Forward, another template by address. `beforeunload` is set for the editor's life and prevents the unload only while changes are unsaved.
   - Verified: jsdom tests for the 8 exits (Keep editing stays, address unchanged), no question when clean or read-only, Discard (nothing saved), Save and leave (saved, then left), Back held then Discard (moves on), failed save (BUSY) stays, conflict stays, `beforeunload` prevented only when dirty. Chromium (Playwright): reload with unsaved changes shows the browser's leave prompt on a top page and in a cross-origin iframe with `sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"`. Not verified inside Google's HtmlService frame: smoke "Slice 8b" step 3 records it.
3. "Reads as" line under the Subject, shown only while the subject holds a placeholder: the subject with blanks (`withChips` on the escaped subject, the history markup), label "Reads as" in `--ink-3`. About 20 minutes.

Changed texts (old, new):

| Where | Old | New |
|---|---|---|
| Toolbar | (none; removed in the first build) | "Font" picker, name "Font: Default" / "Font: Georgia" / "Font: Other font"; menu Arial, Georgia, Times New Roman, Verdana, Courier New, Trebuchet MS, Default |
| Leave question | (none) | title "Leave without saving?", body "Your changes to this template are not saved. They are lost if you leave now.", buttons "Keep editing", "Discard changes", "Save and leave" |
| Subject | (none) | "Reads as" line |

Screenshots re-taken at scale 2: editor, editor-dark, editor-390, placeholder-menu, link-dialog, recipient-error, preview-recipients, editor-readonly; new: leave-dialog.png, font-menu.png. history-recipients.png unchanged.

Checks from a clean install: lint and typecheck clean; test:coverage 63 files, 1481 tests, 96.13% statements, 90.03% branches, 95.44% functions, 97.01% lines; build dev Code.js 347.9 KB, index.html 376.9 KB (+1.8 KB over the first build: picker, guard, "Reads as"); scopes:check 10 approved; format:check clean; lighthouse 100 on all 13 runs.

Files: src/web/app.ts (hook), src/web/views/context.ts (`canLeave`), src/web/views/editor.ts, src/web/editor/{schema,toolbar}.ts, src/web/ui/menu.ts, src/web/styles.css, test/unit/web/{editor,editorPanel}.test.ts, docs/guide/editor-guide.md, docs/ops/smoke.md, docs/design/screens/8b/.

## Retry 1 (2026-11-11, review FAIL: 2 blockers, 7 minors, CSS budget)

Commits a630c11 to the handoff commit on `slice/08b-ui-editor`. Not merged, not pushed.

Blockers:
1. Insert position. `Editor.hold()` (src/web/editor/setup.ts) saves a selection bookmark before a dialog opens and maps it through every later transaction; `run(command)` restores it, then runs the unchanged command; `release()` on Cancel. Used by Image (also across the width read), Link and "Ask the user...". Fallback keeps its saved chip position (modal dialog: no edit can move it). An image that fails or takes over 5 s is inserted at the saved place with no width (unchanged rule). Chromium, body "Hello world", caret after "Hello": image (fast, 1.5 s, failing), link and asked field land after "Hello" with Enter and with OK, 10 of 10.
2. One leave dialog. The editor keeps the open question; a second exit attempt focuses its first button and returns false. Chromium: Back twice 1 dialog, Trash then Back 1 dialog.

Minors:
3. `openScope` sets Favorites mode only inside the leave callback (app.ts). Chromium: Favorites, Keep editing, breadcrumb opens "Sales / Quotes", Favorites not current.
4. The panel's outside-press handler ignores presses inside a dialog backdrop; the question returns focus to the control that started the exit, or to the editor body when focus was on the page body. Chromium 390: panel stays open, focus on Trash.
5. History positions: `googleHost` writes `{ page, at }` as the history state; `onBackForward(hash, moved)` reports the distance; a held Back or Forward travels back with `host.go(-moved)` (new `Host.go`, `window.history.go`) and ignores the return trip. Entries from before the page load (no state) fall back to the old push. Chromium: Back twice and Forward, Keep editing: history length unchanged (4, 5); next Back after Forward lands on the library. Harness passes the state through. Not verified in Google's frame: smoke step needed (Forward, Keep editing, Back once: the library opens, not History).
6. Chips announce "Added a@x.com to Cc" (several: "Added a@x.com, b@y.com to Cc") and "Removed a@x.com from Cc" (× and Backspace) in the editor's status region (`ChipOptions.announce`). It is the visible status line, so it shows above the toolbar too.
7. Problems tab: live errors (backslash, placeholder problems in body and subject, recipient problems) plus the last save's other problems, deduplicated by text; redrawn only when the list changes (role=alert). Typing does not switch tabs; a refused save does. Each problem with a field is a button that focuses it (subject, body, To, Cc, Bcc) and opens a collapsed Details section.
8. Details rows (Title, Folder, Tags, To, Cc, Bcc) stack the label above a full-width control: "Dispatch / Rate confirmations" fits at 1440, 1024 and 390. The read-only note moves into the sheet column (680 px, centered with the sheet).
9. smoke.md lines 37, 38, 62 corrected. `chipText` removed; its 3 cases now assert `blankParts`.

Budget: scripts/web.mjs `minifiedStyles` runs esbuild `transform` (loader css, minify, legalComments none) for the production page and the harness page; it throws when the result holds `//`, `/*`, `<?` or `</style`. Verified: the built page's style block has none of the four (test), library, editor and admin audit at 1440 light, 1440 dark and 390 are pixel-identical before and after except 1 to 4 px of the search caret blink. index.html 379.3 KB before, 367.7 KB after (-11.6 KB).

Changed texts (old, new):

| Where | Old | New |
|---|---|---|
| Chip added (status) | (none) | "Added <addresses> to <To/Cc/Bcc>" |
| Chip removed (status) | (none) | "Removed <address> from <To/Cc/Bcc>" |
| smoke.md 37 | "Version 4", "Loaded the latest version. Your changes were discarded." | header "Saved as version 4, <time>", "Opened their version. Your changes were discarded." |
| smoke.md 38 | "the preview shows chips" | "the preview shows the placeholders as blanks" |
| smoke.md 62 | "Version 1", "Version 2", "Loaded the latest version..." | "Saved as version 1, <time>", "Saved as version 2, <time>", "Opened their version..." |

Tests added (all fail on d8de28d): editorPanel (image at the caret by Enter and OK with the caret reset meanwhile, link by Enter and OK, Back twice, Trash then Back, Forward history, Favorites state, 390 focus, focus nowhere, live Problems and links, chip announcements); editor.test (hold through moved selection and typed text, held link range, destroyed editor, asked field, fallback); styles.test (details rows, note); webBundle.test (minified styles). None deleted; round-trip fixtures unchanged. No new color.

Checks from a clean install (`rm -rf node_modules && npm ci`: 559 packages): lint clean; typecheck clean; test:coverage 63 files, 1498 tests, 96.49% statements, 90.39% branches, 95.95% functions, 97.35% lines; build dev Code.js 347.9 KB, index.html 367.7 KB of 400; scopes:check 10 approved; format:check clean; lighthouse 100 on 13 of 13.

Screenshots re-taken at scale 2: editor, editor-dark, editor-390, placeholder-menu, link-dialog, recipient-error, preview-recipients, leave-dialog, font-menu, editor-readonly.

Left for later: Bcc box empty input line, Title input border in read-only, Bcc note under "None" (review h.2, h.5); Back then Discard still pushes the target (one extra entry); `me` failing blocks the editor (review c).

Files: src/web/{app,host,dev-harness,styles.css}, src/web/editor/{setup,picker,schema}.ts, src/web/views/{editor,recipients,problems}.ts, scripts/web.mjs, test/unit/web/{editor,editorPanel,styles}.test.ts, test/unit/scripts/webBundle.test.ts, docs/ops/smoke.md, docs/design/screens/8b/.
