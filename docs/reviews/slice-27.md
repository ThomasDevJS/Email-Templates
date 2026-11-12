# Review: slice 27, six review minors

Verdict: PASS

Branch slice/27-minors, reviewed at 449ad4b, base 78e3317 (merge base with claude/gracious-franklin-3n8zbq). 14 files, +162 -27: render.ts, choice.ts, skeleton.ts, validate.ts, 6 test files, 2 guides, handoff, implementer memory.

## Commands (worktree, after `npm ci`)

| Command | Result |
| --- | --- |
| `npm ci` | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm run test:coverage` | 0; 76 files, 2119 tests passed; lines 98.15, statements 97.28, branches 91.23, functions 96.83 |
| `npm run build -- --env dev` | 0; Code.js 385.8 KB of 800, index.html 390.3 KB of 400 |
| `npm run scopes:check` | 0; 10 scopes, all approved |
| `npm run format:check` | 0 |
| `npm run lighthouse` | 0; accessibility 100 on 16 pages |
| `npx vitest run test/unit/web` x5 | 5 x 350 of 350 passed |

## Probes

1. Icons (render.ts `withIcon`). A Card Service fake that throws on, or lacks, `newIconImage`, `newMaterialIcon`, `setMaterialIcon`, `setAltText` or `setStartIcon` (10 runs): no error. 3 DecoratedTexts keep "Hint", "Wrong" and "Row", 4 widgets are added, and the card builds. A fault in `setAltText` drops only the error line's icon. With the working fake, 6 cards (a spec with all three line kinds, home, search with and without results, details, an error and item card) give the same call log as the base, call by call.
2. Invisible characters. Every file under src/ (157) scanned for U+E000 to U+F8FF, format characters (zero width, bidi controls, BOM, soft hyphen), NBSP, U+2028/2029 and control characters: 0 hits. The base has 1 (skeleton.ts:22). `MARKER = ""`. 3,109 bodies (fixtures, 3,000 fuzzed, brace samples): scanBody, renderBody and promptsFor equal to the base. braces.test.ts (the 7 ADR examples) passes.
3. validate.ts: the doc comment now sits above `scanSubject`. The diff is 1 line removed and 1 line added. No code moved.
4. Typed fallback with options "Option 1", "Option 12", "A  B": "Option  1", " Option 1 ", "Option 1" and "Option\n1" give 1. "option 1" and "Option 1 2" are refused. "Option 12" gives its own position. Save stores `{{choice:X|A  B|C}}` with the option "A B" (collapsed), so a double-spaced option is never stored. "A  B" and "A B" both match it.
5. Web test waits. `until` now also waits for `[data-blocked]` to clear. The assertions still run first, so a broken feature still fails. 3 features broken in a scratch copy:
   - skeletonRows 8 to 7: app.test.ts fails 1 test.
   - export retries 3 to 0: adminReports.test.ts fails 3 tests, including line 434.
   - "Creating folder..." renamed: admin.test.ts fails 2 tests.
6. Guides. Quick start: "Tick every box, then continue. With a box left empty, the panel does not work." This matches spec 860 and Q82. Admin guide step 18: admin install grants all 10 permissions with no page, matching spec 860. Neither line names a person or an address.
7. Scope of change. The D34 snapshot and appsscript.json have 0 changed lines. 10 scopes.

Secret scan of added lines: 0 keys, tokens, secrets, addresses or URLs.

## Must fix

None.

## Minors

1. The fix for minor 2 recurs in tests. In test/unit/web/admin.test.ts:40, app.test.ts:69 and editorPanel.test.ts:43, the `until` doc comment sits above the `NOW` doc comment and constant, not above `until`. adminReports.test.ts has it right.
2. The handoff names the slice 25/26 flake test (adminReports.test.ts:434). It passed 5 of 5 runs here, but 5 runs cannot prove a 1-in-9 flake is gone.
