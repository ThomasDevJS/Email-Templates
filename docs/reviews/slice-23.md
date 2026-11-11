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
