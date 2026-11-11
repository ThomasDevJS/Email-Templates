# Review: slice 8b (editor in direction A, recipients, leave guard, "Reads as")

Verdict: FAIL. Head 671c7a7, base 7ce6810, reviewed 2026-11-11.

Two blockers. Everything else passes or is minor.

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
