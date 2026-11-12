# Slice 27: six review minors (implementer to reviewer)

Branch `slice/27-minors` from `claude/gracious-franklin-3n8zbq` 78e3317. One commit per item group; no screen text changed.

## Done

1. `src/addon/cards/render.ts`: `toIcon` became `withIcon(text, name, alt)`. A missing or throwing icon call returns the DecoratedText without its icon; hint lines, error lines and list rows keep their text (Q80). Test: `render.test.ts` "keeps hint, error and row text when the icon call throws"; it fails on the old code (checked).
2. `src/shared/placeholders/skeleton.ts:22`: `MARKER` is now `""` as an escape.
3. `src/shared/placeholders/validate.ts`: the `scanSubject` doc comment moved from above `braceProblems` to `scanSubject`.
4. `typedPosition` (choice.ts): typed text and each option are trimmed with inner spaces collapsed before the exact, case-kept match. Tests: " Option  1 " matches "Option 1"; "option 1" is still refused.
5. Web tests: `until` in admin, adminReports, app and editorPanel tests now waits for `[data-blocked]` to clear after its check, so every click after an awaited state waits for the loader. `waitStatus` (adminReports, the 1-in-9 flake at line 434) does the same. 3 checks of transient states (skeletons, "Creating folder...") use `vi.waitFor(check, NOW)`. Web tests run 5 times: 350 of 350 each time.
6. Guides: quick start "Tick every box, then continue. With a box left empty, the panel does not work." (Q82); admin guide step 18: Admin install grants all 10 permissions with no page.

## Verified

Clean `npm ci`; lint 0, typecheck 0, format clean; test:coverage 76 files, 2,119 tests, 97.28 % statements; build dev Code.js 385.8 KB, index.html 390.3 KB; scopes 10; Lighthouse 16 pages at 100. D34 snapshot: 0 lines changed.

## Left for later

Nothing from these 6 items.

## Risks

None found. The `until` change makes every test wait for the loader; a future test that asserts a state seen only during a call must use `vi.waitFor(check, NOW)`.

## Files touched

src/addon/cards/render.ts, src/shared/placeholders/{skeleton,validate,choice}.ts, test/unit/addon/render.test.ts, test/unit/shared/choice.test.ts, test/unit/web/{admin,adminReports,app,editorPanel}.test.ts, docs/guide/{user-quick-start,admin-guide}.md.
