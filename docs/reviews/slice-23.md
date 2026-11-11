# Review: slice 23, folder tree collapse by mouse

Verdict: FAIL. 2 must-fix, 4 minors. The chevron, keyboard, layout and checks are clean. Two pointer paths reopen or close the tree when the user did not ask for it.

Branch `slice/23-tree-collapse`, head 8101c13, base 8e82a07 (merge base with `claude/gracious-franklin-3n8zbq`). Reviewed 2026-11-11.

## Commands (worktree 8101c13, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1989 tests passed; statements 97.18, branches 91, lines 98.03 |
| `npm run build -- --env dev` | "Built dev 8101c13", Code.js 373.5 KB of 800 KB, index.html 381.2 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run lighthouse` | 16 of 16 runs at 100 |
| `git diff --stat 8e82a07 8101c13 -- src/server src/addon src/shared appsscript.json package.json package-lock.json scripts` | empty |

All 3 new tests (app.test, admin.test, styles.test "chevron") fail on a base copy and pass on head. Added lines: 0 keys or tokens, 0 addresses, 0 URLs.

## Must-fix

1. `src/web/views/tree.ts:209`: every `render` re-adds the ancestors of the selected folder to `expanded`, so a collapsed ancestor reopens without any action on the tree.
   - Library: select Sales / Quotes, collapse Sales by its chevron. "Duplicate" on a list row (`template.duplicate`, `folder.list`, `template.list`) reopens Sales. Every `app.reload()` does the same: move, delete, duplicate, restore and import (`rowActions.ts:45,49`, `trash.ts:55`, `adminTransfer.ts:319`).
   - Admin "Folders and access": the same collapse, then "Rename..." on the selected folder reopens Sales (`adminFolders.ts:110`).
   - These do not reopen it: 10 s idle (no timer exists), a star in the list (`favorite.set`, no reload), "Give access".
   - Fix: re-expand ancestors only when the selection changes. Change line 209 to `if (folderId !== selected) for (const id of ancestorsOf(folders, folderId)) expanded.add(id);` and move it before `selected = folderId` (line 206). Add one test per tree: collapse an ancestor, render again with the same folder, the ancestor stays closed.
2. `src/web/views/tree.ts:111`: a double-click on the name of a closed parent opens it, then closes it. The first click opens and expands the row; the second click finds the row selected and open, so it collapses it. Head ends at `Sales[-]` selected; base ended at `Sales[+]`. This happens in the library and in Admin. Fix: take the event and skip the toggle on a repeat click, `onclick: (event: MouseEvent) => { if (event.detail > 1) return; ... }`. Add a test with `detail: 2`.

## Probes (dev harness, Chromium 1243, head port 5191, base 5193)

### 1. Chevron

Library and Admin: one chevron click opens Sales, the next closes it. 0 server calls. Hash unchanged. Focus on the Sales row. `aria-expanded` goes true, then false. A chevron click never selects the row.

### 2. Name click

Name click on Sales (closed): opens the folder and expands it (Admin: 1 `grant.list`). Again: collapses it, the folder stays open, 0 calls. A third click expands it and opens it again. Name click on Quotes: opens Quotes, Sales stays open.

### 3. Collapse an ancestor of the selection

The page, heading and hash stay. The selected row is hidden, and the tab stop moves to Sales. It stays closed through 10 s idle. It reopens on the next `render`: a navigation, any library reload, or an Admin folder write. See must-fix 1 for the reopens that happen without a tree action.

### 4. Keyboard and layout

- The same 17-key script (arrows, Home, End, Enter, Space) on base and head gives identical tree states, tab stops and final hash in the library and in Admin.
- One focusable element per tree.
- The chevron `span.tree-toggle`: no tabindex, no role, `aria-hidden="true"`, 16 by 16 px box. `elementFromPoint` hits it at ±11.5 px from its center and misses at 12.5 px, so the target is 24 by 24 px.
- The text of every row starts at x 33, y 6 in a 30 px row on base and head (9 rows, library and Admin).

### 5. Double-click and long names at 390 px

- Double-click on a name: must-fix 2.
- Double-click on a chevron: two toggles, the same as two clicks; no folder opens.
- Sales renamed to 60 characters at 390 px. One chevron click toggles once, in Admin and in the library menu panel. `scrollLeft` stays 0. The Admin page is 463 px wide at 390 px with that name on base and head (minor 1).

## Minors

1. Admin at 390 px with a 60-character folder name scrolls sideways (document 463 of 390 px); base is the same.
2. A double-click on an Admin folder name sends 2 `grant.list` calls (each click opens the folder).
3. The chevron has no hover style of its own (handoff, Left).
4. On touch, a tap just outside the 24 px target opens the folder (handoff, Risks).

## Only the owner can check

- Mouse and touch on desktop Chrome and a phone in Google's frame; test-round-1 part A step 14.

# Re-review: retry 1

Verdict: FAIL. 1 must-fix, 2 minors. Both first-round must-fix items are closed. A new path leaves a selected folder hidden.

Retry diff `8101c13..a26e7f3` (one source commit, a26e7f3). Reviewed 2026-11-11.

## Commands (worktree a26e7f3, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci`, `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1992 tests passed; statements 97.2, branches 91.02, lines 98.04 |
| `npm run build -- --env dev` | "Built dev a26e7f3", Code.js 373.5 KB of 800 KB, index.html 381.3 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 of 16 runs at 100 |

No change in `src/server`, `src/addon` or `src/shared`. Both new admin.test cases fail on a copy of 8101c13: "keeps a closed parent closed after a folder write redraws the tree" and "leaves a closed parent open after a double-click on its name". The app.test deep-link case passes there; it guards existing behavior.

## Must-fix

1. A click on the editor breadcrumb of a folder inside a closed parent leaves that folder hidden.
   - Steps: library, select Sales / Quotes, close Sales by its arrow, open "Price quote 2026", click "Quotes" in the editor breadcrumb (`src/web/views/editor.ts:607`, `app.go`).
   - Result: library "Quotes" with Sales closed and no selected row in the tree. Base: Quotes visible and selected.
   - Cause: `src/web/views/tree.ts:212` opens parents only when `folderId !== opened`. The breadcrumb selects the folder that is already `opened`.
   - Fix: let an explicit selection reveal its folder. For example, add `reveal(folderId)` to `FolderTree`, which clears `opened`, and call it from `app.go` (`src/web/app.ts:276`) and `openScope` (`app.ts:223`) for a library route. Back and Forward (`host.onBackForward`, `app.ts:392`) keep the closed parent. Add a test: close the parent, `go` to the child, the child row is shown and selected.

## Item 1, a closed parent stays closed

Library, Quotes selected, Sales closed by its arrow:

| Action | Sales |
|---|---|
| "Duplicate" on a list row (`template.duplicate`, `folder.list`, `template.list`) | closed |
| "Delete" on a list row (library reload) | closed |
| 10.5 s idle (the app has no refresh timer) | closed |
| Open "Price quote 2026", type, Ctrl+S, Back | closed, hash `?folder=F-QUOTES` |
| Admin, Quotes selected, Sales closed, "Rename..." to Quotes2 | closed |
| Admin, other tab and back | closed; the tab rebuilds with "All folders" selected (base the same) |

New selections:

| Path | Sales |
|---|---|
| Pick HR, Back to Quotes | open, Quotes selected |
| Close Sales, Forward to HR, Back to Quotes | open |
| Deep link `#/library?folder=F-QUOTES` on a new page | open |
| Editor breadcrumb "Quotes" | closed, Quotes hidden (must-fix 1) |
| "All templates", then Back to Quotes | closed, Quotes hidden (minor A) |

## Item 2, double-click

| Probe | Head | Base 8e82a07 |
|---|---|---|
| Double-click on the name of closed Sales | open, selected (library and Admin) | open |
| Double-click on the name of selected, open Sales | closed, selected | open |
| Admin `grant.list` per double-click | 1 (Support 1, Sales 1) | 2 |

The second case closes the row, as one click does now. Base kept it open because base had no click-to-close (minor B).

## Item 3, hover color

The style diff adds only `.tree-toggle:hover svg.i { color: var(--ink) }`. Chromium shows the arrow `rgb(28, 38, 46)` on a selected row `rgb(232, 237, 241)` when hovered.

| Mode | On paper | On canvas | On hover | On select |
|---|---|---|---|---|
| Light (`--ink` #1c262e) | 15.37 | 14.08 | 13.07 | 13.04 |
| Dark (`--ink` #e6eaed) | 14.19 | 12.96 | 11.56 | 10.49 |

All are above 3:1. Row text position and keyboard behavior are unchanged from the first review; no other style line changed.

## Minors

- A. "All templates" (or any route with no folder), then Back to the folder: the folder stays hidden under its closed parent. Back from the editor is the same path, and that path must keep the parent closed. Back keeps the user's state; only an explicit selection must reveal (must-fix 1).
- B. A double-click on the selected, open parent closes it. Base left it open.
- Open from the first review: minors 1 (390 px long name, base the same) and 4 (touch target).

## Only the owner can check

- Mouse, touch and Back in Google's frame; test-round-1 part A step 14.

# Re-review: retry 2

Verdict: PASS. 0 must-fix, 2 minors. The breadcrumb case is fixed. Every probed path follows the rule.

Retry diff `a26e7f3..8db30c1` (one source commit). Reviewed 2026-11-11. Rule: a choice by the user reveals the selected folder; a redraw, browser Back or Forward keeps closed parents closed.

## Commands (worktree 8db30c1, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci`, `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1996 tests passed; statements 97.2, branches 91.02, lines 98.04 |
| `npm run build -- --env dev` | "Built dev 8db30c1", Code.js 373.5 KB of 800 KB, index.html 381.4 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 of 16 runs at 100 |

No change in `src/server`, `src/addon`, `src/shared` or `styles.css`. On a copy of a26e7f3, 2 new tests fail: app.test "opens again when the user picks the folder in the editor breadcrumb" and "changes the open state once on a double-click on the chevron". The other new tests guard behavior that already passed there.

## Reveal paths (Sales closed by its arrow before each)

| Path | Result |
|---|---|
| R1 editor breadcrumb "Quotes" | Sales open, Quotes selected |
| R2 library tree row "Sales" | Sales open and selected |
| R3 sidebar "All templates" | no folder selected; tree unchanged (correct) |
| R4 deep link `#/library?folder=F-QUOTES`, new page | Sales open, Quotes selected |
| R5 Admin row click HR | HR selected |
| R6 Admin "New subfolder" under selected, closed Sales | Sales open, SubNew selected |
| R7 Admin delete SubNew | Sales selected (top level, visible) |
| R8 Admin move Support into "Sales / Quotes", both closed | Sales and Quotes open, Support selected |

The library has no folder link in search results, so that path does not exist.

## Keep paths (Quotes selected, Sales closed)

| Path | Sales |
|---|---|
| K1 Admin "Rename..." of the selected folder inside closed Sales | closed |
| K2 "Duplicate" on a list row | closed |
| K3 "Delete" on a list row (library reload) | closed |
| K4 10.5 s idle (no refresh timer exists) | closed |
| K5 editor edit, Ctrl+S, Back | closed |
| K6 pick HR, browser Back to Quotes | closed, Quotes hidden (minor A) |
| K7 Forward to HR, Back to Quotes | closed |

## Double-clicks (library and Admin, same end states)

| Row state | Double-click on | End state | Admin `grant.list` |
|---|---|---|---|
| Closed parent, not selected | name | open, selected | 1 |
| Selected, open parent | name | closed, selected (minor B) | 0 |
| Selected, closed parent | name | open, selected | 1 |
| Open parent, not selected | name | open, selected | 1 |
| Leaf | name | selected | 1 |
| Any parent | chevron | toggled once, 0 calls | 0 |

## No regression

- A chevron click sends 0 calls and focuses its row.
- The 17-key script gives the same states and hash as base 8e82a07, library and Admin.
- One tab stop per tree. The chevron has no tabindex, no role and `aria-hidden`. Hit test ±11.5 px in, 12.5 px out: a 24 by 24 px target.
- Row text at x 33, y 6 in 30 px rows on base and head.

## Minors

- A. Back or Forward to a folder inside a parent the user closed shows that folder's page with no selected row in the tree. This follows the rule. test-round-1 part A could record it.
- B. A double-click on the selected, open parent closes it once (its first click is a close); base left it open.
- Open from the first review: 390 px long name scrolls in Admin (base the same); touch target.

## Only the owner can check

- Mouse, touch, Back and Forward in Google's frame; test-round-1 part A step 14.
