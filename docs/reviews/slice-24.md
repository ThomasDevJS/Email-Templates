# Review: slice 24, page loader and fewer calls (D37)

Verdict: FAIL. 2 must-fix, 5 minors. The block, the indicator, the end cases, the save speed-up and the Admin access cache work as described. Typed text is now lost silently, and one second write still gets through.

Branch `slice/24-loader-speed`, head 815a0cb, base 06123c5 (merge base with `claude/gracious-franklin-3n8zbq`). Reviewed 2026-11-11.

## Commands (worktree 815a0cb, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci`, `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 72 files, 2003 tests passed; statements 97.13, branches 90.98, lines 98 |
| `npm run build -- --env dev` | "Built dev 815a0cb", Code.js 373.5 KB of 800 KB, index.html 383.2 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 of 16 runs at 100 |
| `git diff --stat 06123c5 815a0cb -- src/server src/addon src/shared appsscript.json package.json package-lock.json scripts` | empty |

## Must-fix

1. Keys typed during a save are dropped with no sign; the base kept them.
   - Cause: `src/web/ui/busy.ts:12-14`: the guard drops `keydown`, `beforeinput` and `paste` in `main` for every tracked call. `app.ts:81` tracks `template.update` and `template.create`.
   - Probe (save delayed 3 s): type " AAA", Ctrl+S, type "BBBBBB" over 2.7 s.
     - Head: the editor ends with "AAA" and shows "Saved as version 3". The 6 characters are gone. Title "XYZ" typed during a save: gone, and "Saved as version 4".
     - Base 06123c5: the editor keeps "AAABBBBBB", saves the text up to "AAA", and shows "Unsaved changes". The title keeps "XYZ", also "Unsaved changes".
   - Smallest safe rule: during the editor's own save, the editor form stays typeable. That covers keys, `beforeinput`, `paste` and `drop` whose target is in the editor's title, subject, recipient boxes or body. Clicks stay blocked. The existing `savedKey` logic (`editor.ts:986`) then leaves the page "Unsaved changes", as in the base. A second save cannot start: `save()` returns while `saving` is true (`editor.ts:962`). Example: `busy.track(work, { typing: editorForm })`, or the guard skips text-entry events whose target is inside an element marked `data-typing`.
   - Fix test-round-1 part M step 2 (`docs/ops/test-round-1.md:311`) to match, and add a test: keys typed during a save stay in the editor and the page stays dirty.
2. A second write starts during a write through a toast "Retry".
   - Path: History, a restore fails twice (BUSY), so 2 toasts with "Retry" show. Retry on toast 1, "Restore": the first restore runs and the page is blocked. Toasts sit outside the guarded regions, so Retry on toast 2, "Restore" starts a second `version.restore`. Result: 2 restores in flight. The base behaves the same, but this slice states that no second write can start while one runs.
   - Fix: `src/web/views/history.ts:173` `runRestore` returns at once while a restore runs (a `restoring` flag, as the editor's `saving`). Or `retryButton` (`src/web/ui/status.ts:98`) ignores a click while the page is blocked. Add a test with two retry toasts.

## 1. Block, ways through (library, `template.duplicate` delayed 3 s)

0 calls and no state change for:
- a click on the sidebar tree and on a row "Actions" button;
- Tab plus Enter; Space and Enter on a focused star button; `element.click()` from script; `touchend`;
- right click; typing and a synthetic paste in the search box (value stays empty);
- "/" with focus on the body.

Dialog paths, 1 write each: Delete dialog double-click plus Enter twice; Admin new folder Enter three times; Rename "OK" double-click; Give access Enter twice plus a click. Editor: Back during a save shows "Leave without saving?"; "Save and leave" then does nothing (`saving`); 1 `template.update`. A second browser tab is a separate page with its own loader; the server's lock and versions handle that case, as before.

## 2. The block ends

| Case | Result |
|---|---|
| Answer | free right after it |
| Error (INTERNAL after 1.5 s) | free; 1 toast |
| Never answers | blocked at 19 s; free at 20.6 s; a click then works (`favorite.set`). The line still says "Duplicating..." with no error (minor 1) |
| Overlap: `folder.list` 3 s, `template.list` 0.5 s | blocked at 1.2 s; free at 3.5 s |
| Back during a call | route changes; block holds until the answer, then ends |
| Throw | `busy.test` "ends on a throw" (the promise rejects); `track` settles on either outcome |

## 3. Typing

See must-fix 1.

## 4. Indicator

- A 200 ms call: the bar never shows, `aria-busy` is never set, no "Loading".
- A 1.5 s call: the bar shows at 345 ms. It is 3 px tall, `rgb(42, 60, 73)` (#2a3c49), with animation `busy-slide`. `aria-busy="true"` is set on main and the sidebar. "Loading" is announced once at 345 ms.
- Reduced motion: animation `none`, full width, same color. Dark mode uses `--slate` #dfe6eb (minor 5).
- Focus is the same as the base in all 5 cases: sidebar Trash (`main`), row menu Duplicate (grid cell), Admin tab Groups (the tab), editor title with Ctrl+S (the title), dialog confirm of a new folder (back on the opener, then the folder heading).

## 5. Speed

- Calls per save: head `template.update` (or `template.create`) only; base adds `folder.list` and `template.list`.
- After an update, a move to HR and a create, the rendered "All templates" list and the sidebar counts equal those after a fresh `folder.list` plus `template.list` (forced by an Admin folder write). Text compare: equal on head and on base.
- Server compare (`setupWorld`): the `template.update` and `template.create` answers equal the `template.list` row in all 23 fields for create, update and move. Only `level` differs; the client sets it from the folder. Favorites stay. A stale update answers CONFLICT, and the client path for it is unchanged (no `itemSaved`).
- Admin "Who has access", another admin's change made through direct calls: the revisit shows the held list at once with no block, then the background read shows the change.
- Grant writes carry no `rev` (`grant.remove` sends `grantId` only). A Remove on a stale row (removed by the other admin) answers NOT_FOUND. It shows "This template was deleted or moved." (minor 3), then the list reloads.
- `localStorage`, `sessionStorage` and cookies are empty. The held access lists live in the Admin view only.

## 6, 7

- Web only. index.html 383.2 KB. 10 scopes. Lighthouse 100.
- Part M: 6 steps; steps 1 to 5 have "Expect:", step 6 has "Record:". A person can do each on dev with a second window. Step 2 asserts the dropped-key behavior (must-fix 1).

## Minors

1. A call that never answers frees the page at 20 s and leaves "Duplicating..." with no error or retry.
2. A call started in the last moments before a 20 s expiry is not tracked by the next block: `stop()` bumps `block` for all running calls.
3. NOT_FOUND on a grant remove says "This template was deleted or moved." The base has the same text; the held list makes the case more likely.
4. With the background `grant.list` running, a Remove on a held row is allowed by design. It is still 1 write, and its error path works.
5. The bar is #dfe6eb in dark mode (`--slate`); the decision names #2a3c49 for light only.

## Only the owner can check

- Real latency on dev: the bar time (part M step 6), and how the block feels on 1 to 3 s saves.
- Touch on a phone, IME composition (CJK input) during a block, and paste from the context menu on macOS.
- Two windows with one account, part M step 4.

# Re-review: retry 1

Verdict: FAIL. 1 must-fix, 1 new minor. Both first-round must-fix items are closed. The wider typing rule opens two editor shortcuts during a call.

Retry diff `815a0cb..78172c8` (555a156 code, 78172c8 handoff). Reviewed 2026-11-11.

## Commands (worktree 78172c8, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci`, `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 72 files, 2006 tests passed; lines 98.09 |
| `npm run build -- --env dev` | Code.js 373.5 KB of 800 KB, index.html 383.6 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 of 16 runs at 100 |

No change in `src/server`, `src/addon` or `src/shared`. All 3 new tests fail on a copy of 815a0cb: app.test "keeps what is typed during a save...", busy.test "keeps blocking for a call that started late...", adminReports "starts no second restore from a toast's Retry...". Part M step 2 now matches the behavior: type, Backspace and paste during a save, then "Unsaved changes".

## Must-fix

1. During any call, Ctrl+K in the template text opens "Insert link", and typing `{{` opens the "Insert field" menu.
   - Probe: `template.update` delayed 4 s, Ctrl+S, then each shortcut in the body.
   - Cause: `src/web/ui/busy.ts:69` lets every `keydown` and `beforeinput` through in a contenteditable. The editor keymap (`src/web/editor/setup.ts:73`, `Mod-k`) and the input rule (`setup.ts:50-53`, `bracesRule` calls `onBraces`) then open a dialog and a menu during the call.
   - Neither wrote anything in the probe; a link or field insert is a local edit. The rule set for this check counts any dialog opened during a call as a must-fix.
   - Fix: let the editor ask the loader before it opens UI. Pass `busy.active()` (or `app.busy()`) to the editor; `link` and `onBraces` do nothing while it is true, and the typed `{{` stays as text. Or the guard drops `keydown` with Ctrl, Meta or Alt in text fields except Z, Y, X, C, V and A, and the editor checks the flag for `{{`. Add a test for each shortcut.

## Item 1, typing during a save (3 s)

- Type " AAA", Ctrl+S, type 6 characters in the text and 3 in the title. All 9 are kept. The page shows "Unsaved changes".
- 1 `template.update` was sent, with the text at the moment of Ctrl+S ("... AAA") and the title then.
- A second Ctrl+S, Backspace, Delete, Ctrl+Z and paste during the save: all work, and still 1 `template.update`. Ctrl+Z undoes the whole typing group, as ProseMirror does on base.
- Recipient box: Enter and comma add chips during the save (local; the page stays dirty).

## Item 2, text fields with a call in flight

| Field | Keys | Result |
|---|---|---|
| Editor Title, Subject | Enter, Ctrl+Enter | nothing; no route change |
| Editor Subject | `{{` | no menu |
| Editor body | Ctrl+K, `{{` | dialog and menu open (must-fix 1) |
| Editor Title | Tab, then Space | focus moves to the folder select; Space and ArrowDown on the select do nothing (value stays) |
| Library search | Enter, Ctrl+Enter, ArrowDown plus Enter, Ctrl+S | no route change, no dialog; typing runs `search.body` (not tracked by design) |
| Library search | Tab, then Space and Enter | focus on "New template"; nothing opens |
| Admin "Give access" input during `grant.list` | Enter, Ctrl+Enter, Tab plus Space and Enter | 0 calls |
| Admin "Add admin" input | Enter twice, 150 ms apart (`admin.add` delayed 3 s) | 1 `admin.add` |

A file input is not a text field, so it stays blocked. Selects and buttons stay blocked.

## Items 3 to 5

- Restore: two failed restores, Retry on both toasts: 1 `version.restore` (`restoring`, `history.ts:173`).
- Editor save: two failed saves, Retry on both toasts: 1 `template.update` (`saving`).
- Per-call limits (vitest with fake timers on `createBusy`):

| Case | Result |
|---|---|
| A never answers; B starts at 5 s, answers at 7 s | blocked at 7 s and 19.9 s; free at 20.1 s |
| C never answers; D never answers, started 10 s later | blocked at 20.1 s and 29.9 s; free at 30.2 s |
| A call answered after its own limit | the count stays balanced; the next call blocks and frees normally |
| A rejection | frees at once |

- The 13 ways through from the first review: clicks, Tab plus Enter, Space and Enter on buttons, `element.click()`, touch and right click all do nothing. Typing and paste in the search field now pass (the new rule; the search is not tracked).
- The block always ends: answer, error, never answers (20 s), overlap and Back all checked.

## Minors (new)

- A. Tab moves focus out of a text field during a call. Nothing else happens, because the next control is blocked.

## Only the owner can check

- IME composition and macOS paste during a save; real save times on dev.

# Re-review: retry 2

Verdict: PASS. 0 must-fix, 1 new minor. The retry 1 must-fix is closed.

Retry diff `78172c8..ae2ff12`: `src/web/editor/setup.ts` (`pageBusy`, `bracesRule`, `link`) and 2 tests. Reviewed 2026-11-11.

## Commands (worktree ae2ff12, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci`, `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 72 files, 2008 tests passed; lines 98.12 |
| `npm run build -- --env dev` | Code.js 373.5 KB of 800 KB, index.html 383.7 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 of 16 runs at 100 |

Both new editor.test cases fail on a copy of 78172c8: "while the page is busy, {{ stays as text and opens no picker" and "while the page is busy, Ctrl+K opens nothing and Ctrl+B still bolds".

## Item 1, shortcuts during a call (`template.update` delayed 4 s)

- Ctrl+K on a selection: no dialog. Typed ` {{`: no menu; the braces stay in the text.
- Typing, Backspace, Delete, paste, Ctrl+B, Ctrl+I and Ctrl+U all apply; the result is the same as with no call running.
- Ctrl+Z removes the last typing; Ctrl+Y brings it back.
- After the call: no dialog or menu opens late, the `{{` typed during the call is still in the text, and there is 1 `template.update`. Ctrl+K then opens "Insert link", and a new `{{` opens "Insert field".

## Item 2, keymap and input rules

`setup.ts:71-83` keymap: Mod-z, Mod-y, Shift-Mod-z, Mod-b, Mod-i, Mod-u, Mod-Shift-x, Mod-k, Enter, Mod-], Mod-[. Plus `baseKeymap` (`setup.ts:98`). Only Mod-k opens UI, and it is now guarded. The only input rule in `src/web` is `bracesRule` (`setup.ts:96`), now guarded. `{{` in Subject opens no picker (retry 1 probe). The other keydown handlers edit their own box (tags, recipient chips) or sit on blocked controls.

## Item 3, earlier passes

| Probe | Result |
|---|---|
| Typing during a 3 s save | 6 characters in the text and 3 in the title kept; "Unsaved changes"; 1 `template.update` holding the text at Ctrl+S |
| Restore Retry on two toasts | 1 `version.restore` |
| Editor save Retry on two toasts | 1 `template.update` |
| Ways around the block | the 13 still do nothing, except typing and paste in search, as intended |
| Block end | error, never answers (free at 20.6 s), overlap and Back during a call all free the page |

## Minor (new)

- A. Ctrl+S in the editor during a call that is not a save still starts a save; `saving` only stops a second save. Example: the reload after saving into a folder this page did not know (`app.ts` `itemSaved`). The base is the same; the window is one list read.

Open from earlier rounds: minor 1 (no error text for a call that never answers), 3 (grant NOT_FOUND text), 4, 5, and retry 1 minor A (Tab moves focus).

## Only the owner can check

- IME composition and macOS paste during a save; part M on dev.
