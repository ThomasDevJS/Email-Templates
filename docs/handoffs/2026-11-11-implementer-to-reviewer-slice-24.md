# Slice 24: page loader and faster screens, D37 (implementer to reviewer)

Branch `slice/24-loader-speed` from `claude/gracious-franklin-3n8zbq` 06123c5. Web only; no change in `src/server`, `src/addon`, `src/shared`, `appsscript.json`.

## Part 1: server calls per step (dev harness, 100 ms latency; "rounds" = waits one after another)

| Step | Before | After |
|---|---|---|
| First load of the library | folder.list, template.list, profile.me: 3 calls, 1 round | same; profile.me no longer blocks |
| Open a folder / revisit a folder | 0 | 0 (the library holds every template in memory) |
| Open a template | me, template.get: 2, 1 round | same |
| Save | template.update, then folder.list + template.list: 3 calls, 2 rounds | template.update: 1 call, 1 round |
| Back to the library | 0 | 0 |
| Open Admin | admin.folders: 1 | 1 |
| Tabs Groups, Audit log, Usage | 1 each | 1 each |
| Tab Export and import, Folders and access | 0 | 0 |
| Tab Settings and backups | backup.list, config.get: 2, 1 round | same |
| Select a folder in Admin | grant.list: 1, blocking | same |
| Revisit a folder in Admin | grant.list: 1, blocking, skeleton | grant.list: 1 in the background; known rows at once, 0 blocking |
| Give access | grant.add, then grant.list: 2 rounds | same |
| Delete a folder | folder.delete, then admin.folders: 2 rounds | same |

No step had independent calls in series (3a: none to do). No first load had 3 serial calls (3d: no combined op).

## Part 2: loader

- `src/web/ui/busy.ts` `createBusy([main, side])`, wired once in `app.ts`: every API call is tracked except `search.body` (typing) and `profile.me` (account name), and `app.background` (same API, untracked).
- While tracked: capture-phase guard drops click, dblclick, mousedown, pointerdown, keydown, beforeinput, paste, drop, contextmenu, submit whose target is in main or the sidebar. Focus never moves (no `inert`). Dialogs and toasts sit outside both regions and keep working. `data-blocked` marks the regions at once.
- After 300 ms: `.busy-bar` (3 px, `var(--slate)` = #2a3c49 in light; moving, static under reduced motion), `aria-busy="true"` on both regions, one polite "Loading" in an sr-only `role=status`. Waits under 300 ms show and announce nothing.
- Ends when the last call settles (answer or error; the error path is unchanged), or after 20 s whatever happens; calls of an expired block no longer count, so a later call blocks and unblocks normally. A call that never answers keeps waiting, with no new error text (no existing path for it outside the first load).
- Chromium 1243 probe, harness latency 1500: bar hidden at 150 ms, shown at 650 ms (3 px, rgb(42, 60, 73), `busy-slide`; `none` with reduced motion); a click in the sidebar during the wait changes nothing; bar gone and page free after the answer.

## Part 3: speed

- c. Save: `AppContext.itemSaved(item)` puts the save's answer into the loaded list (level from its folder; an unknown folder reads the lists again). Saves 2 calls and 1 round per save.
- b. Admin "Who has access": `AdminFolders.grants` keeps each folder's rows for the Admin page (memory only); a revisit draws them at once and reads again via `app.background`; the answer redraws only when it differs, so focus stays; a grant write drops its folder's rows. A lost access shows the existing error in the access area.

## Tests

busy.test.ts (blocks clicks and keys, dialog works, focus stays; bar, aria-busy and Loading only after 300 ms; ends on a throw; ends at 20 s on a call that never answers and blocks again for the next call). app.test "blocks the page while the library loads, but never for the text search"; Ctrl+S test counts folder.list and template.list after a save (1, 1; fails with the old reload: 2, 2). admin.test "shows the access of a folder seen before at once..." (fails on base). styles.test bar and reduced motion. Existing tests that clicked while a load ran now wait for `data-blocked` to clear (admin, app, editorPanel); one test now checks that a tab click during a folder write is dropped.

## Left (saving in calls)

- Admin tab revisit (Groups, Audit log, Usage, Settings and backups): known data at once, refresh in the background: 0 calls saved, 1 blocking round per revisit.
- Give access: use the `grant.add` answer for the row: 1 call per grant (needs the inherited rows, which only `grant.list` computes).
- Delete or create a folder in Admin: drop or add the row from the write's answer: 1 `admin.folders` call per write (the refresh also catches other admins' changes).
- Reopening Admin in the same page: keep the last `admin.folders` answer: 1 blocking call.
- History restore and row actions (Duplicate, Move, Delete) still reload the library: 2 calls each.

## Risks

- Keys typed during a save are dropped (by design: no keys while a write runs). A user who types right after Ctrl+S loses those characters.
- A long export blocks the page during each page call.

## Checks (clean install)

`npm ci` ok; lint, typecheck clean; `npm run test:coverage` 72 files, 2003 passed, lines 98.00; build Code.js 373.5 KB, index.html 383.2 KB of 400; scopes 10 approved; format clean; Lighthouse 16 of 16 at 100. Source lines changed: 187 added, 7 removed.

Files: src/web/ui/busy.ts (new), src/web/app.ts, src/web/styles.css, src/web/views/{admin,adminFolders,context,editor}.ts, test/unit/web/{busy (new),admin,app,editorPanel,styles}.test.ts, docs/ops/test-round-1.md (part M), docs/design/wording.md, this file.

## Retry 1 (review docs/reviews/slice-24.md, FAIL on 2)

| Item | State | Test |
|---|---|---|
| MF1 typing lost during a save | fixed: the guard lets keydown, beforeinput, paste and drop through when the target is a text field (textarea, text-like input, or inside `contenteditable="true"`). Clicks, mousedown and form submits stay blocked; `saving` still stops a second save. Chromium 1243, 3 s save: "ab", Ctrl+S, "cdefgh", Backspace, "xyz" in the title: text ends "abcdefg", title "...xyz", header "Unsaved changes" | app.test "keeps what is typed during a save and then says Unsaved changes; clicks stay blocked" (keys, Backspace, paste in title and text; fails on 815a0cb) |
| MF2 toast Retry starts a second restore | fixed: `restoring` in history.ts; `runRestore` and the Retry's `restore` return while one runs | app.test "starts no second restore from a toast's Retry while one runs" (3 `version.restore`, base 4) |
| Other toast Retry that repeats a write | checked every `app.fail(..., retry)`: editor save (`() => void save()`, guarded by `saving`), history restore (now guarded). The rest repeat reads: app.ts first load and library load, history version preview, Admin, Usage, Audit, Settings, Trash list loads | none |
| Minor 2 late call lost at 20 s | fixed: each call stops counting after its own 20 s | busy.test "keeps blocking for a call that started late..." |

Part M step 2 now checks typing, Backspace and paste during a save.

Left:
- Minor 1: a call that never answers frees the page at 20 s and leaves its busy text ("Duplicating...", `src/web/views/rowActions.ts:32`); no error path exists for an unanswered call.
- Minor 3: NOT_FOUND on a grant remove shows "This template was deleted or moved." (`src/web/ui/status.ts` `messageOf`, same on base).
- Minor 4: a Remove on a held access row during the background read is allowed by design (1 write, error path works).
- Minor 5: in dark mode the bar uses the dark `--slate` (#dfe6eb) for contrast on the dark page; D37 names #2a3c49 for light only (`src/web/styles.css` `.busy-bar::before`).
- A click into another field during a save is blocked (mousedown); Tab moves between fields.
