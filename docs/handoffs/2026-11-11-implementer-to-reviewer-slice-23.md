# Slice 23: folder tree collapse by pointer (implementer to reviewer)

Branch `slice/23-tree-collapse` from `claude/gracious-franklin-3n8zbq` 8e82a07. Owner report: subfolders open on a click but cannot be hidden again by mouse. Cause: the row `onclick` in `src/web/views/tree.ts` only added to `expanded`; only ArrowLeft deleted.

## Done

- `src/web/views/tree.ts`: rows with children wrap the chevron in `span.tree-toggle` (`aria-hidden`, no tabindex). Its click stops propagation, toggles the row, focuses the row, and calls no `onOpen` (no server call). A click on the name of the selected, expanded row collapses it and stays. Any other name click opens and expands, as before. Keys unchanged. `aria-expanded` follows the state.
- `src/web/styles.css`: `.tree-toggle::before { position: absolute; inset: -4px }` gives a 24 by 24 px pointer target around the 16 px icon; layout unchanged.
- Both callers get it: library sidebar (`app.ts`) and Admin "Folders and access" (`adminFolders.ts`).
- Docs: test-round-1.md part A step 14; smoke.md "Slice 3" step 2 sentence.

## What the user sees (item 3)

Collapsing an ancestor of the selected folder hides the selected row; the page, the heading and the selection stay. The row stays collapsed until the next `render` of the tree (a navigation, a library reload, an Admin folder write), which re-expands the ancestors of the selected folder, as before. A chevron click itself never triggers a `render`, so it does not reopen at once (test waits 20 ms after it).

## Verified

| Check | Result |
|---|---|
| app.test "opens and closes a folder by its chevron or a second click..." | pass; fails on the old tree |
| admin.test "closes a folder by its chevron or a second click..." (0 `grant.list`) | pass; fails on the old tree |
| styles.test "gives the tree chevron a 24 by 24 px pointer target" | pass |
| Chromium 1243, dev harness, library and Admin at 1440 | chevron 16 by 16; hit test at ±11.5 px from its center hits the toggle, at 13 px misses; clicks 10 px left and right of center open then close Sales; hash unchanged; focus on Sales |
| `npm ci`, lint, typecheck | clean |
| `npm run test:coverage` | 71 files, 1989 passed, lines 98.03 |
| `npm run build -- --env dev` | Code.js 373.5 KB, index.html 381.2 KB of 400 |
| scopes, format | 10 approved, clean |
| `npm run lighthouse` | 16 of 16 at 100 |
| `src/server`, `src/addon`, `src/shared` | no change |

## Left

- The chevron has no hover style of its own; the row hover covers it.

## Risks

- Touch: the 24 px target sits inside the 30 px row; a tap just outside it opens the folder (as before).

## Files

src/web/views/tree.ts, src/web/styles.css, test/unit/web/app.test.ts, test/unit/web/admin.test.ts, test/unit/web/styles.test.ts, docs/ops/test-round-1.md, docs/ops/smoke.md, this file.

## Retry 1 (review docs/reviews/slice-23.md, FAIL on 2)

| Item | State | Test |
|---|---|---|
| MF1 every render reopened the parents | fixed: `render` opens the parents only for a new selection whose folder is in the list (`opened`); a deep link still opens them once the folders load | admin.test "keeps a closed parent closed after a folder write redraws the tree" (fails on 8101c13); app.test "opens the parents of a folder named in the address..." |
| MF2 double-click closed the parent | fixed: a row click with `detail > 1` is ignored | admin.test "leaves a closed parent open after a double-click on its name" (fails on 8101c13; also checks 1 `grant.list`) |
| Minor 2 two `grant.list` on a double-click | fixed by MF2 | same test |
| Minor 3 chevron hover | fixed: `.tree-toggle:hover svg.i` uses `--ink` | none (CSS) |

What the user sees now (replaces item 3 above): a parent closed by the user stays closed through every redraw (library reload, Duplicate, Admin rename) until the user selects another folder; that new selection opens its own parents.

Left:
- Minor 1: Admin at 390 px with a 60-character folder name scrolls sideways (`src/web/styles.css` `.admin-folders`); same on base.
- Minor 4: on touch, a tap just outside the 24 px target opens the folder (`src/web/styles.css` `.tree-toggle::before`).

## Retry 2 (review docs/reviews/slice-23.md, newest section)

Rule now in code: `FolderTree.render(folders, selected, counts, reveal)`. `reveal` is true for a choice by the user: `app.go` and the route start (`show`, first render, late first-load render), `openScope` (sidebar, Favorites, All templates, tree rows), Admin tree clicks, and Admin writes that change the selection or move it (create, delete, move). A reveal waits until the folder is in the list (deep link before the load). Every other render (library reload, Duplicate, save, rename, idle refresh, browser Back and Forward) keeps closed parents closed.

| Item | State | Test |
|---|---|---|
| MF breadcrumb left the folder hidden | fixed | app.test "opens again when the user picks the folder in the editor breadcrumb" (fails on a26e7f3) |
| Redraw keeps closed parents | kept | app.test "stays closed when the library loads again after Duplicate"; admin.test "keeps a closed parent closed after a folder write..." |
| Minor 2 All templates, Back | decided by the rule: Back keeps the tree as the user left it, so Sales stays closed while the Quotes page shows | app.test "stays closed after All templates and browser Back" |
| Admin move | the moved folder shows under its new parent | admin.test "moves a folder after the dialog" |
| Minor 3 double-click | the chevron also ignores the second click; on a name the first click acts and the second is ignored in every state. A double-click on the selected open row therefore closes it once (its first click is a close) | app.test "changes the open state once on a double-click on the chevron" (fails on a26e7f3); admin.test "leaves a closed parent open after a double-click" |
