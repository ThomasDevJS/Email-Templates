# Slice 8a: UI shell, library, trash, history (implementer to reviewer)

Branch `slice/08a-ui-shell` from `adeeefe`. Commits 6caa3ee (shell and screens), e401b06 (harness sample, Lighthouse), 8b11621 (screenshots), plus this handoff. No server change, no new dependency, no network call.

## Done
- Tokens: light and dark sets from the design system replace the old ones in `src/web/styles.css`; no color outside the two `:root` blocks.
- Icons: `src/web/ui/icons.ts`, 24 mockup symbols plus `menu`, injected once as a hidden sprite; every `svg.i` is `aria-hidden`.
- People: `src/web/ui/person.ts` (`shortName` "Ben K.", `initials` "BK", `person` avatar element).
- Shell (`index.html`, `app.ts`): sidebar with inlined logo, "Templates", All templates, Favorites, folder tree with subtree counts (`folderCounts` in library/model.ts), Trash, Admin for manage holders, account block with name part and version. Top bar and footer removed. Under 860 px: top bar plus menu button (`aria-expanded`, Esc closes and refocuses it).
- Tree: optional root row (`rootLabel: null` in the sidebar, "All folders" in admin), chevron and folder icons, counts as `data-count` CSS content so row text stays the name.
- Library: h1 title with count, search with icon and `/` hint, columns star, Template (title plus subject or snippet, placeholders as "[Label]"), Folder, Tags, Updated, By, row menu icon button. Favorites moved from the toggle to the sidebar and works in place.
- Trash: same table look, Deleted and Days left, row Restore, "Empty trash now..." as default button, its confirm button destructive.
- History: header with "Open in editor" and "Restore this version" (primary), version rows with tags, version on a sheet with the subject line; prompts styled as dashed blanks (`ph ask`).
- Menus: destructive item in red after a divider; menus open leftwards at the right edge. Dialog actions take `destructive`.
- `formatTime(iso, "date" | "time", now)`: "Nov 9, 2:05 PM", year only for another year; editor status uses `"time"`.
- Harness `?sample=freight`: invented freight data for screenshots. Lighthouse requires 100 and adds a library run with `--force-dark-mode`.

## Where the build differs from the mockup or the design system
1. Folder separator "/" uses `--ink-3`: `--line-strong` text is 1.6:1 (accessibility wins).
2. Table avatars use `--avatar-2` #5d6a73: white on the mockup's #7b8992 is 3.6:1.
3. Off star uses `--star-off` #848f97 (3.3:1); `--line-strong` is 1.6:1 for the only visual of the control.
4. Sidebar counts on hover and selected rows use `--ink-2`: `--ink-3` on `--select` is 4.18:1.
5. Input borders keep `--line-strong` (1.58:1) as the design system says; open question whether they "carry meaning".
6. No "Recently used" entry: the design system shell list omits it.
7. Account block has no role: the client cannot tell Admin or Editor without calling `admin.folders`. Name is the address name part ("Dev U."), per the design system.
8. "New template" shows only where the caller can create (a folder with edit); the mockup shows it on All templates, which has no target folder.
9. Rows stay sorted by title (existing behavior); the mockup sorts by date.
10. "Matches in text" stays a second table under an h2 with the same columns: one grid per table keeps the keyboard model.
11. "Showing 7 of 46" dropped (no paging); the key hint line stays.
12. By column shows the name part; the full address is only the tooltip.
13. Favorites has no route: reload or Back returns to All templates.
14. Dark theme puts the logo on a light plate (option given in the design system).
15. Under 860 px Tags and By are hidden; arrow keys skip hidden cells (`shownCell` in grid.ts).
16. The trash "Back to the library" link is gone (sidebar replaces it); history "‹ Editor" became "Open in editor".
17. Status lines have no success check icon: call sites set plain text with no success or error kind.

## Left for 8b and 8c
- Editor: sheet, icon toolbar, "Insert field", 340 px panel, breadcrumb; chips still read "Ask: Label" (shared `chipText`); editor chips lack the `ask` class; sidebar does not mark the template's folder in editor or history.
- Admin: tab row, tables, ok/denied tags; page title is still an h2 (its sub-heads are h3).

## Verified (how)
From `rm -rf node_modules && npm ci` (559 packages): lint clean, typecheck clean, test:coverage 52 files and 1256 tests passed (lines 96.4%), build dev `Code.js 318.9 KB`, `index.html 340.0 KB` of 400 KB (was 316.5 KB), scopes:check 10 approved, format:check clean, lighthouse 100 on all 10 views plus library dark (11 runs). Screens checked with Playwright Chromium at 1440x900 and 390x844, light and dark; horizontal scroll 0 on library, trash, history and editor. Admin at 390 px scrolls sideways (275 px at retry 1), left for 8c. Token contrast pairs computed per theme.

## Screenshots (docs/design/screens/8a, 2x)
library, library-dark, library-390, library-390-menu, trash, history, history-dark, editor, admin.

## Risks
- `--force-dark-mode` is a Chrome flag; if a Chrome update drops it, the dark run audits light silently.
- `<svg><use href>` sprite inside HtmlService's sandboxed iframe is not yet seen on dev.

## Files touched
src/web/{app.ts,index.html,styles.css,dev-harness.ts}, src/web/ui/{icons.ts,person.ts,dom.ts,menu.ts,dialog.ts}, src/web/library/model.ts, src/web/views/{context,grid,library,tree,trash,history,preview,rowActions,editor}.ts, scripts/lighthouse.mjs, test/unit/web/{app,admin,adminReports,logic}.test.ts, docs/design/screens/8a/*.

## Commands
`npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build -- --env dev && npm run scopes:check && npm run format:check && npm run lighthouse`. Screens: `npm run dev:web`, then `?latency=0&sample=freight#/library`.

## Retry 1 (review docs/reviews/slice-08a.md, FAIL)
Commits 20b891f, 3ce7670, 5623fe2 and the screenshot commit.
- Must fix 1: the narrow panel is modal while open (`app.ts` `setPanel`). Tab and Shift+Tab wrap inside `#side` (`trapTab`, now exported from dialog.ts), `main` gets `inert` plus `aria-hidden`, Esc closes and focuses the menu button, a mousedown outside or a nav pick closes it, and growing past 860 px closes it (`matchMedia`). 6 tests in app.test.ts. Found on the way: the focus trap selector `[href]` matched SVG `<use href>`, so the last "focusable" was an icon; now `a[href]`. Checked in Chromium at 390 px: Tab from Admin goes to the menu button, an outside click closes.
- Must fix 2: `--star` and `--star-fill` #a87400: 4.07 paper, 3.73 canvas, 3.45 select. `--star-off` #78838b: 3.88, 3.55, 3.29. Dark: star #e6a700 8.09, 7.38, 5.98; off #7f8b94 4.92, 4.50, 3.64. The pressed star differs by its fill.
- Minor 3: owner label uses `--ink-2` on hovered rows (6.52).
- Minor 4: history heading shows "Ben K."; the full address is the span's `title` and a visually hidden "(address)" in the heading's name.
- Minor 6: new `--field-line` for input, select, textarea and button borders: light #7f8b93 (3.49 paper, 3.20 canvas), dark #7c8a94 (4.84, 4.42). `--line-strong` stays for rules and dividers. The fields look a little firmer than the mockup and still calm (editor.png, library.png).
- New test/unit/web/contrast.test.ts: one table of 40 token pairs, both themes, 4.5:1 text and 3:1 icons, rings and borders; every token must be in the table or in `NOT_PAIRED` with a reason.
- Not done, as agreed: minor 5 (admin at 390 px, 8c), minor 7 (disabled buttons).
- Clean install: lint and typecheck clean, 53 files and 1265 tests passed (lines 96.41%), `index.html` 340.6 KB, scopes 10 approved, format clean, Lighthouse 100 on 11 runs.
- Screenshots retaken; `library-390-menu.png` shows the open panel.
