# Review: slice 8a (UI shell, library, trash, history)

Verdict: FAIL. Two must-fix items: focus escapes behind the narrow-screen panel, and the pressed star is under 3:1 in the light theme. Everything else holds: 1256 tests green, Lighthouse 100 on 11 runs, no server change, no injection, no external request.

Reviewed: `slice/08a-ui-shell` at 23bf981, base adeeefe, commits 6caa3ee, e401b06, 8b11621, 23bf981. Reviewer 2026-11-10.

## Must fix

1. Narrow panel lets focus escape behind it. `src/web/app.ts:74-86`. At 390 px with the panel open, Tab from "Admin" lands on `#search` and then the grid cell, both covered by the absolutely positioned panel (`styles.css` `.side.open .side-panel`, `position: absolute`). The focused element is hidden (WCAG 2.4.11). A click outside the panel does not close it either. Fix: close the panel on `focusout` when `relatedTarget` is outside `#side`, and on a `mousedown` outside `#side`. Add one test in `test/unit/web/app.test.ts` "shell (slice 8a)".
2. Pressed star under 3:1 in light. `src/web/styles.css:30-31`. `--star` #c58a00 stroke is 2.99:1 on `--paper` and 2.74:1 on the hover row (`--canvas`). `--star-fill` #e6a700 is about 2.1:1. The off star on its own button hover (`--select`) is 2.80:1 light, 2.77:1 dark (`--star-off`). Fix: darken `--star` (for example to about #a87400) and `--star-off` so both stay at 3:1 on `--select`.

## Minors

3. Owner label on tree hover is 4.19:1. `src/web/styles.css:497-503` overrides `.owner` for selected rows, not hovered ones (`--ink-3` on `--hover`).
4. History preview heading shows the full address. `src/web/views/history.ts:113` uses `entry.savedBy`; the version rows use `shortName` (line 74).
5. Admin at 390 px scrolls sideways: 665 px wide (base 506 px). Handoff claim "horizontal scroll 0 on every screen" is wrong for the 6 admin tabs. Admin belongs to 8c; carry it there.
6. Input borders `--line-strong` are 1.58:1 light, 2.11:1 dark. Design system accepts it; the search field also has its icon and placeholder. Owner question (difference 5).
7. Disabled buttons fall to 3.09 to 3.59:1 light. WCAG exempts inactive controls; recorded for the owner.

## 1. Behavior regression

- Tests: 0 removed, 0 renamed to a weaker form. 12 added (1244 to 1256).
- Changed assertions, all still asserting the behavior:
  - Tree count 5 to 4: the "All templates" root row moved out of the tree into the sidebar nav. One `ArrowDown` dropped for the same reason; `End` now asserts "My templates" (stronger).
  - Favorites `aria-pressed` to `aria-current` on the sidebar entry, plus heading "Favorites" and return to 4 rows on All templates (stronger).
  - Date regexes follow the new format (`Nov 1, 10:00 AM`); trash "By" reads the avatar tooltip (full address).
  - Favorites empty text "No favorites in All templates..." to "No favorites yet...": wording change, still asserted.
- `git diff --stat adeeefe..slice/08a-ui-shell -- src/server src/addon src/shared appsscript.json scripts/lib/html.mjs`: empty. No server, add-on, shared, manifest or `inlineHtml` change.
- `scripts/lighthouse.mjs`: MIN_SCORE 90 to 100, dark run with `--force-dark-mode`. Accepted.

## 2. Keyboard and ARIA (Chromium, Playwright, dev harness)

| Path | Result |
|---|---|
| Load focuses `main`; Tab order skip link, All templates, Favorites, tree (one stop), Trash, Admin, search, grid (one stop) | works |
| Tree Down, Right (expand), Down, Left (parent), End, Home, Enter (opens Sales, hash `#/library?folder=F-SALES`) | works |
| `/` focuses search | works |
| Grid arrows, End, Home, Enter on title opens `#/edit/T-QUOTE` | works |
| Shift+F10 opens menu (Edit, Duplicate, Move..., History, Delete...), Down moves, Esc returns to the cell | works |
| Star cell Enter toggles `aria-pressed` true to false, focus stays | works |
| Favorites in sidebar: heading "Favorites", 1 row, `aria-current`, focus stays | works |
| Trash: Tab to "Empty trash now...", "Restore Old price list" | works |
| Empty trash dialog: Cancel focused, Tab and Shift+Tab trapped, Esc returns to opener | works |
| Delete dialog: Cancel focused, Esc returns to the cell | works |
| History: listbox focused on open, Down and End move `aria-activedescendant`, Enter previews, R opens Restore dialog, Esc returns to listbox | works (Restore focused by default, unchanged from base, non-destructive) |
| 390 px menu button: name "Menu", `aria-expanded` false to true, `aria-controls="side-panel"`, Esc closes and refocuses it | works |
| 390 px focus inside the open panel | broken: Tab from Admin reaches search and grid under the panel (must fix 1) |
| 390 px grid arrows skip hidden Tags and By (cells 2, 4, 6) | works |

No page errors. No request outside 127.0.0.1.

## 3. Contrast (computed from the tokens in `src/web/styles.css`)

Under 4.5:1 for text:
- Light `--ink-3` on `--hover` 4.19, on `--select` 4.18, on `--blank-bg` 4.41. In use only for the owner label on hover (minor 3). Counts on hover and selected use `--ink-2` (6.52, 6.50).
- Disabled buttons light 3.09 to 3.59, dark `--ink-2` disabled 3.66 (exempt, minor 7).

Under 3:1 for icons, rings, borders:
- `--star` light 2.99 on paper, 2.74 on canvas; `--star-off` 2.80 light and 2.77 dark on `--select` (must fix 2).
- `--line-strong` 1.58 light, 2.11 dark (minor 6).

Passing pairs of note: `--ink-3` on paper 4.93, on canvas 4.52; placeholder 4.93; tags `--ink-2` on `--select` 6.50 light, 6.72 dark; `kbd` 7.02; counts 4.93 on paper; `--blank-ink` on paper 9.30, on `--blank-bg` 8.32; dark `--ink-3` on `--select` 4.74; focus ring 9.68 or more on every fill, both themes; dark logo on the `#f4f5f6` plate: red 6.11, slate 10.45.

Implementer's three darkened colors confirmed: folder separator `--ink-3` 4.93 (mockup `--line-strong` 1.58); table avatars white on #5d6a73 5.56 (mockup #7b8992 3.60); off star #848f97 3.30 on paper, 3.03 on the hover row.

## 4. Security of the new markup

- New `innerHTML`: `icons.ts:49` (static `SYMBOLS` only) and `history.ts:117` (static label plus `withChips(escapeText(subject))`, as before). New `style`: tree `padding-left` from a number. `data-count` holds a number.
- Names, initials, titles, tags, folder names and owner labels go through `h()` as text nodes.
- Probe: harness data patched to put `<img src=x onerror=...>` and `"><svg onload=...>` into the caller address, an author address, folder "HR", the title and tag of "Welcome email" and the trash title. On library, folder view, trash, history, editor and admin: 0 injected elements, both flags unset, strings shown as text in the tree, tags, avatars (initials "MX") and account block.

## 5. Dates

`formatTime` in America/New_York, now 2026-11-10: today "Nov 10, 9:05 AM"; this year "Mar 2, 4:07 AM"; another year "Dec 31, 2024, 6:59 PM"; invalid and blank ""; `"time"` "9:05 AM". The only other date code in src/web is `admin/model.ts` `localDate` and `localDayStart` (file names and date input values, machine format, unchanged). Accepted.

## 6. Freight sample

Names Ben Kowalski, Ana Moreno, Thomas Olsen, all at example.com. `dist/index.html` has 0 matches for `freight`, `FREIGHT`, `sample`, `ben.kowalski`, "Rate confirmation".

## 7. Bundle

`index.html` 340.0 KB of 400 KB (was 316.5 KB, +23.5 KB). Sources: `styles.css` 11,067 to 24,740 bytes, `index.html` shell 858 to 5,157 bytes (logo 2,652), `icons.ts` 3,425 bytes, plus view code. `dist/index.html`: `url(` 0, `@import` 0, `src=` 0, `http` 12 (SVG namespace and existing validation strings, no request).

Secret scan of the diff: no key, token or secret. Emails: example.com only. URLs: `http://www.w3.org/2000/svg`.

## 8. The 17 differences

| # | Verdict | Reason |
|---|---|---|
| 1 | accept | 4.93 vs 1.58 |
| 2 | accept | 5.56 vs 3.60 |
| 3 | accept, partial | 3.30 on paper; still 2.80 on the button hover (must fix 2) |
| 4 | accept | 6.50 on `--select` |
| 5 | accept as owner question | design system says `--line-strong` |
| 6 | accept | design system shell list omits Recently used |
| 7 | accept | no role data without an extra call |
| 8 | accept | All templates has no target folder |
| 9 | accept | existing behavior |
| 10 | accept | keeps one grid per table |
| 11 | accept | no paging exists |
| 12 | accept | design system "name part" |
| 13 | accept | Back returns to All templates; no history entry lost |
| 14 | accept | design system option |
| 15 | accept | design system two-line rows |
| 16 | accept | sidebar replaces the link |
| 17 | accept for 8b | status check icon belongs with the editor saved status |

Visual defects in the screenshots: history heading shows the full address (minor 4); Dispatch starts collapsed where the mockup shows it expanded (accepted, the tree expands on click or Right); otherwise rows, type, tags, avatars, stars and row menu match the mockup at 1440, 390 and dark. No clipped text or overlap seen.

## 9. Commands (clean install, worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages added, 16 audit findings (dev tooling, same as before) |
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test:coverage` | 52 files, 1256 passed; lines 96.4% (addon 100, server 99.31) |
| `npm run build -- --env dev` | Code.js 318.9 KB of 800, index.html 340.0 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on library, editor, history, 6 admin tabs, trash, library dark (11 runs) |
