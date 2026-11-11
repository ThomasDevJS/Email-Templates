# Review: slice 8b (editor in direction A, recipients, leave guard, "Reads as")

Verdict: PASS after retry 1 (head 5bd5ec6, reviewed 2026-11-11). Both blockers fixed in Chromium. 5 minor gaps open (see "Retry 1").

First review: FAIL. Head 671c7a7, base 7ce6810. Two blockers. Everything else passed or was minor.

## Blockers

1. Image lands at the wrong place. `insertImage` (src/web/views/editor.ts:600) awaits `naturalWidth` before `editor.run(insertNode(...))`. During the wait the dialog closes and focus returns to the editor; ProseMirror reads the DOM selection and the caret moves to the document start. Chromium, body "Pic", Image, URL, Enter: head stores `<p><img ... width="200">Pic</p>`, base stores `<p>Pic<img ... width="600"></p>`. 4 of 4 runs with Enter; OK by mouse keeps the caret. This breaks the engine-freeze rule (the insert position is engine behavior). Fix: take `editor.view.state.selection.getBookmark()` before the dialog, and insert with `tr.setSelection(bookmark.resolve(tr.doc)).replaceSelectionWith(node)`; add a test that types text, inserts an image with a delayed load and checks the order.
2. Double leave dialog. A second exit while "Leave without saving?" is open opens a second dialog. Chromium: Back twice gives 2 dialogs; Trash click then Back gives 2 dialogs. Cause: `host.onBackForward` (src/web/app.ts:290-302) calls `canLeave` with no check for an open question, and `canLeave` (editor.ts:957) always opens a dialog. Fix: keep the open question in the editor view and have `canLeave` return false without a second dialog while one is open (the newest `leave` replaces the old one); a test for Back twice.

## Commands (clean install, worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages, 16 audit findings (14 moderate, 2 high), same as base |
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test:coverage` | 63 files, 1481 passed, 0 failed; statements 96.12, branches 90.01, functions 95.44, lines 97.01 (web lines 92.58) |
| `npm run build -- --env dev` | Code.js 347.9 KB of 800, index.html 376.9 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on 13 of 13 runs, including editor dark |

## a. Engine freeze

- Round-trip and sanitizer fixtures: no file under test/fixtures or test/unit/shared changed; they pass.
- Test diff: 0 tests deleted. 1 renamed ("shows tokens as chips in history" to "...as blanks in history, a fallback as name or fallback"). Expectations updated to the new names and texts. One assertion removed (app.test.ts, `.version` "Version 3" after Ctrl+S); the `role=status` check right before it now reads the header "Saved as version 3, h:mm" and covers it. Nothing weakened.
- Chromium, base and head harness, keyboard only, capture of the `html` sent by `template.create` and by a later unchanged `template.update`: bold over a blank, delete a blank with one Backspace, copy and paste a blank, undo and redo, link: 5 of 5 identical on both builds and stable over reload. Image plus table: differs (blocker 1). Width: 800 px image stores 600 on both; 200 px image stores 200 on head, 600 on base (intended, item 10).
- Shortcuts, schema parse and conflict handling unchanged in code (schema.ts diff touches `toDOM` and labels only; `serializeDoc` untouched).

## b. Recipients (Chromium, head harness)

| Input | Result |
|---|---|
| paste `a@x.com, b@y.com; c@z.com d@w.com\ne@v.com` | 5 chips |
| `Name <a@b.c>` | 2 chips "name", "<a@b.c>", both red, RCPT_FORMAT under To (spec forbids display names; extracting the address would help, minor) |
| `x@y.com.` | red chip, RCPT_FORMAT |
| 11 in Cc | "Cc holds 11 addresses. Use at most 10 per field." |
| 21 total | "To, Cc and Bcc hold 21 addresses together. Use at most 20." under To |
| `s@migway.com` in To and `S@Migway.com` in Cc | RCPT_DUPLICATE under Cc, Cc chip red |
| `A@X.com a@x.com A@x.COM` | 1 chip |
| outside address, `?external=deny` | red chip, RCPT_EXTERNAL text, server refuses the save with the same text |
| 300 characters | RCPT_TOO_LONG |
| `<img src=x onerror=...>@x.y`, `"><svg onload=...>@a.b` | split into text chips, RCPT_FORMAT, no element created, counter 0 |

- Save sends exactly the chips shown in 10 of 10 cases (text left in the input is committed first).
- `use` caller (T-SUPPORT): no toolbar, no Save, no × on chips, inputs hidden; the server refuses `template.update` below edit (unchanged).
- Unreadable lists: `?unreadable=cc,bcc` only changes the restore reply. Restore shows "Restored as version 5. The Cc and Bcc addresses of version 1 could not be read and were left empty. Add them again in the editor." A live item with a malformed list cannot reach the editor: the index shape check (src/shared/model/shape.ts:61-63) refuses the index first. A malformed version file is restored as `[]` by the server, with the notice. The editor then loads `[]` and Save sends `[]`: no extra loss in the editor. The loss happens at restore, by the slice 9 design. Minor: the harness keeps the lists while saying they were left empty, so the dev view contradicts its own notice (dev-harness.ts:1059).

## c. `me`

The client takes the domain from `me.email` and the rule from `me.recipientsExternal` for marks and hints only. The server validates every save with `prepareBody` and the stored setting (no server change in this slice). Minor: `me` failing now blocks the editor from opening (editor.ts:783-792); before, it opened without it.

## d. Leave guard (Chromium)

- Asked with "Keep editing" focused and the three buttons, address unchanged, text kept: sidebar All templates, Favorites, Trash, Admin, breadcrumb, History, folder tree, another template by address, Back, Forward, Trash in the 390 px menu panel (11 of 11).
- Discard leaves, Save and leave saves then leaves. Save and leave with BUSY (toast), CONFLICT (conflict dialog) and VALIDATION (Problems tab) stays with the text intact.
- No question when clean or read-only.
- Back, Keep editing: history length unchanged (3), no entry lost. Back, Discard: one extra entry; a later Back returns to the editor (minor). Forward, Keep editing: an editor entry is pushed after the rejected route, so the next Back lands on that route and asks again (minor, app.ts:301).
- Double dialog: blocker 2.
- Favorites, Keep editing, then Save and the breadcrumb: the library opens in Favorites mode in place of the folder. Cause: `openScope` sets `favoritesOnly` before `app.go` (app.ts:200-204). Minor.
- 390 px: after Keep editing the menu panel is closed and focus is on BODY (the dialog's mousedown counts as an outside click, app.ts:79-81). Minor.
- `beforeunload` fires on the top page in Chromium. If it does not fire in Google's frame, closing or reloading the tab loses every change since the last save without a question. Smoke "Slice 8b" step 3 records whether it fires.

## e. Image request

The dialog accepts only `^https://\S+$` (trimmed), the same scheme rule as the schema (`img[src]` with `https:`). Other schemes stay in the dialog with "Use an https:// address." and no request goes out (checked). The width read is a GET from the author's browser to the image host, the same request the editor makes when it shows the image. `IMG_HOSTS` is checked only by the server sanitizer, so a host outside that list is fetched once before the save strips it.

## f. Accessibility

- Toolbar: `role=toolbar` "Formatting", 20 buttons, 1 tab stop, 4 separators; ArrowRight, End, Home, ArrowLeft wrap as expected; Tab leaves to Subject. All 20 named; toggles carry `aria-pressed`, menus `aria-haspopup`; Bold has `aria-keyshortcuts`.
- Tooltips are `title` attributes: mouse only, not shown on keyboard focus (minor).
- Menus return focus to the editor body, as on base. Link dialog traps Tab (OK, Cancel, input) and returns focus on Esc.
- Blanks: Chromium AX tree gives `image "Field: Product name, asked at insert"` etc., one node each.
- Wording: "Field: Load number, asked at insert" serves a user better. It matches the visible "Insert field" button and says what happens; "Placeholder: ask: load number" is jargon and lower-cased the label. Erratum: spec section 8 line 476 and wireframe 04 line 35 should read `Field: <label>`, `Field: <label>, fallback <text>`, `Field: <label>, asked at insert`.
- Chip fields: visible labels, remove buttons named "Remove x from Cc", errors tied by `aria-describedby` (`rcpt-*-error`, Bcc note, group help). Gap: no live region and no `role=alert` in the chip fields (recipients.ts:82, 131). Adding or removing a chip and a new error are not announced. Minor.
- Contrast recomputed, all pass: ink-2 on blank-bg 6.86 and 6.68 (in table), red on red-bg 5.73 and 6.51 (in table), warn on paper 7.13 and 9.04 (in table), ink on select 13.04 and 10.49 (in table), blank-line on blank-bg 3.52 and 5.82 (UI, Insert field border and blank underline: not in the table, minor).

## g. XSS

Reply hook in Chromium put `<img src=x onerror=...>` and `"><svg onload=...>` into title, tags, subject (with a fallback and a prompt label), To, Cc, Bcc, folder names and library rows, plus the version reply. Editor header, crumbs, folder select, chips, "Reads as", preview recipient lines, preview subject, history sheet lines and subject, library: all text, 0 injected elements, counter 0. "Reads as" escapes the subject before `withChips` (editor.ts:491).

## h. Visual

Library, trash, admin and audit at 1440, 390 and dark: pixel-identical to base (one 2 px diff is the search caret). History differs as intended.

Issues in the 8b shots:
1. editor.png, editor-dark.png: folder select clips "Dispatch / Rate confirmatior" at 1440.
2. Bcc box with an outside mark keeps about 30 px of empty space for the input line; To and Cc boxes do not.
3. Problems tab says "Problems 0" while live errors show under Cc and Bcc (recipient-error.png).
4. editor-390.png: a trailing chevron after the last crumb, then the title on its own line; Subject input clips the token and the counter wraps to its own line.
5. editor-readonly.png: the note band starts 82 px left of the sheet and sits on paper above the canvas; Title input keeps its full border, looking editable; the Bcc note shows under "None".

The 15 listed differences: accepted 1 to 13 and 15. Rejected 14: the Problems count must include the live recipient errors, or the tab must not read 0 while errors show. 10 is accepted with issue 1 fixed. 13 needs a wireframe 04 erratum.

## i. Budget

index.html 376.9 KB: script 329.0 KB (esbuild 321.5 KB: prosemirror-view 96.4, prosemirror-model 44.0, prosemirror-transform 31.2, state 11.6, commands 9.7, history 5.6; src/web/views 56.7, editor.ts 12.1 the largest file; src/web/editor 16.6), CSS 43.0 KB, sprite 2.6 KB. With the other slice (+6 KB) the page is about 383 KB. 20 KB could come from: CSS minification in scripts/web.mjs (41.8 to 30.8 KB, -11.6 KB, `inlineHtml` unchanged); removing CSS rules no screen uses since 8a to 8d (audit needed); `chipText` and other test-only exports; shorter repeated texts. ProseMirror itself cannot shrink.

## j. Scope

- No change in src/server, src/addon, src/shared, appsscript.json, scripts/lib/html.mjs, the library, tree, grid, trash or admin views.
- Web changes outside the editor: app.ts (guard hook), views/context.ts (`canLeave`), ui/menu.ts (`font`), ui/icons.ts (highlight), rpc/api.ts (types and `me`), history.ts, preview.ts, tags.ts (editor only).
- Secret scan of the diff: no keys or tokens; emails are role addresses on example.com, migway.com and partner domains. No new network host; the only outside request is the image read (e).
- Dead code: `chipText` (schema.ts:215) is used only by tests now. Minor.
- Docs: smoke.md:37 and :62 still quote "Version 4" and "Loaded the latest version..." (now "Saved as version..." and "Opened their version..."). Minor.

## Next

Fix blockers 1 and 2, then re-review. Minors can ride along.

## Retry 1

Verdict: PASS. Head 5bd5ec6, retry base d8de28d, engine base 7ce6810. Diff: 28 files, +764 -88.

### Commands (clean install, worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages, 16 audit findings (14 moderate, 2 high), unchanged |
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test:coverage` | 63 files, 1498 passed, 0 failed; statements 96.48, branches 90.36, functions 95.95, lines 97.35 (web 92.85) |
| `npm run build -- --env dev` | Code.js 347.9 KB of 800, index.html 367.7 KB of 400 (was 376.9 at 671c7a7) |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on 13 of 13 runs |

New tests on old code: the 4 changed test files copied into a d8de28d copy, 15 tests fail there (all new retry tests).

### Blocker 1, insert position: fixed

Chromium, head harness, body "Hello world" + "Second para". 72 runs: image (fast 200 px PNG, 1.5 s delay, aborted request), link, table, "Sender name", "Ask the user..."; Enter and OK; caret in the middle, at the start, at the end, a 5-character selection, after an undo, and a document change made while the dialog was open (DOM edit at the paragraph start, read by ProseMirror).

- Every node lands at the saved caret in 72 of 72 runs. The selection is replaced by image, table, blank and asked field. The DOM edit case gives "ZZHello[node] world": the bookmark follows the change.
- Width: fast and slow image store `width="200"`. The failing image stores no width.
- d8de28d, same script: 13 image runs put the image at the document start (12 by Enter, 1 by OK after the DOM edit). Head: 0.
- No leak: open Image, cancel by Esc and by Cancel, move the caret to the end, insert. Then open Link at "He|llo", Esc, insert an image at the end. Stored `<p>Hello world more<img ... width="200"><img ...></p>`: both at the current caret. Focus after a cancel is the editor body.
- A second user action cannot type into the editor while a dialog is open: the dialog makes the page inert.

### Blocker 2, one leave dialog: fixed

| Sequence | Dialogs | Focus on the second attempt | After Keep editing |
|---|---|---|---|
| Back, Back | 1 | Keep editing | Template body |
| Trash, Back | 1 | Keep editing | Trash |
| Breadcrumb, History | 1 | History is inert under the dialog | Quotes |
| Forward, Forward | 1 | Keep editing | Template body |
| 390 px menu Trash, Back | 1 | Keep editing | Trash, panel stays open |

### Gaps 3 to 9

- 3 fixed. Favorites, Keep editing, breadcrumb "Quotes", Discard: "Sales / Quotes", hash `#/library?folder=F-QUOTES`. d8de28d opened Favorites. Favorites then Discard still opens Favorites.
- 4 fixed. 390 px: Keep editing keeps the panel open and focuses Trash.
- 5 fixed for entries this page wrote. Library, Sales, editor, Back, Keep editing: `history.length` 4 before and after, state `at` 2 before and after, 2 popstate events (out and back), no third. Back then Save and leave: one save, library opens; Back then returns to the editor with no question. Back then Discard pushes one entry (declared, left for later).
- 6 fixed, with a visual cost. Each add and each removal writes one status text ("Added a@x.com to Cc", "Removed c@z.com from Cc"). See minor 3.
- 7 fixed. Backslash before a blank, bad subject token, bad To, bad Cc: "Problems 4" while typing, back to 0 as each is fixed. Each item is a button: focus goes to `editor-body`, `subject`, `rcpt-to`, `rcpt-cc` at 1440 and 390. At 390 a collapsed Details section opens first.
- 8 fixed. Folder select 299 px at 1440 and 1024, 358 px at 390, full panel width. The read-only note has the sheet's left edge and width at 1440 (334, 680), 1024 (276, 380) and 390 (12, 366).
- 9 fixed. smoke.md:37, 38, 62 match the app texts. `chipText` has no reference left. Its 3 cases now check `blankParts` (label, fallback, class). The visible "X or Y" text is still checked on the rendered blank (editor.test.ts:95-96).

### CSS minification

- Head page against the same head with minification turned off (scratch copy, `return css.trim()`): library, editor and admin audit at 1440 and 390, light and dark, 12 of 12 pixel-identical on the final run. One earlier run showed 76 to 102 px of differences in the library header; a rerun was identical, so it was timing noise.
- Head against d8de28d: library and admin audit 8 of 8 identical. The editor differs only in the restacked Details rows (gap 8).
- `minifiedStyles` throws on `url(http://...)`, a `/*` in a string, `<?=` and a stray `//`. `</style` in a string is escaped by esbuild to `<\/style`, so no raw `</style` reaches the page.
- `scripts/lib/html.mjs` unchanged. contrast.test.ts reads `src/web/styles.css`, the source file.

### Engine freeze

- No file under test/fixtures or test/unit/shared changed since 7ce6810. serialize.ts and load.ts unchanged.
- The 5 keyboard documents of the first review (T-QUOTE, T-DISCOUNT, T-WELCOME, T-OLD, new): 5 of 5 identical stored HTML on 7ce6810 and head, 2 runs. The script needs 60 ms between keys; without the pause the link selection length varies on both builds alike.

### Scope and secrets

- No change in src/server, src/addon, src/shared, appsscript.json, scripts/lib, library, tree, grid, trash or admin views. app.ts changes: outside press ignores the dialog backdrop (gap 4), `show` helper and `openScope` (gap 3), history return trip (gap 5). dev-harness.ts passes the history state.
- Secret scan of added lines: no keys or tokens. Emails: a@x.com, b@y.com, a@example.com, late@example.com, ops@example.com, b@partner.com. URLs: example.com only. `window.history.go` is no network call.

### Google's frame (gap 5)

Simulated in Chromium: `history.go` does nothing; the change event carries no state; `go` moves but fires no change event. In all 3 cases the edits stay, every Back asks again and Discard leaves. With a no-op `go` the address shows the previous page while the editor stays, until the next Back. No case loses text or leaves the page stuck.

### Minor gaps (open)

1. docs/ops/smoke.md:157 has no step for `Host.go`. The handoff asks for one ("Forward, Keep editing, Back once: the library opens, not History") but smoke.md does not have it. Add it, and record `history.length` before and after.
2. The page's first entry has no state (src/web/host.ts:75 reads `moved` 0), so a Back to it still pushes (app.ts:318) and drops the Forward entries. Library, editor, Back, Keep editing: length 3 kept, current entry replaced. Fix: `navigate(hash, true)` once at start to stamp `{ page, at: 0 }`.
3. Chip announcements use the visible status line (src/web/views/editor.ts:743-745). The first chip moves the toolbar and the sheet down 27 px. The text stays until the next status, and it overwrites "Not saved..." messages. Recommendation: a separate `.sr-only` `role=status` element for chip texts (the class exists, styles.css:136); keep the visible line for save results.
4. After an insert at the document start by Enter, the caret sits before the new node ("#[IMG]Hello"); the next keystroke goes before it. Same on d8de28d. Not an insert-position defect.
5. Declared and left for later: Back then Discard adds one entry; `me` failure blocks the editor; Bcc box empty input line; read-only Title border; Bcc note under "None".

## Next

Merge. Minors 1 to 3 in the next web slice; minor 1 before the next smoke run.
