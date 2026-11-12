# Review: slice 26, choice field and brace rule (D39, D40)

Verdict: PASS

Branch slice/26-choice-field, reviewed at f4e0697, base 047394e. 44 files, +1828 -104. Spec 5.10, ADR-0004 amendments "choice fields" and "skeleton rule".

## Commands (worktree, after `npm ci`)

| Command | Result |
| --- | --- |
| `npm ci` | 0; 16 audit findings (14 moderate, 2 high), same as earlier slices |
| `npm run lint` | 0, no output |
| `npm run typecheck` | 0 |
| `npm run test:coverage` | 0; 76 files, 2118 tests passed; lines 98.14, statements 97.28, branches 91.23, functions 96.82 |
| `npm run build -- --env dev` | 0; Code.js 385.6 KB of 800, index.html 390.3 KB of 400 |
| `npm run scopes:check` | 0; 10 scopes, all approved |
| `npm run format:check` | 0; clean |
| `npm run lighthouse` | 0; accessibility 100 on 16 pages |
| `npx vitest run test/unit/web` x9 | 8 x 350 passed; 1 run had 1 failure in adminReports.test.ts:434 ("retries a page ... after the start"). The test and src/web/admin are unchanged in this slice; the next 6 runs passed. Pre-existing timing flake. |

## Probes

1. Grammar and save checks. Spec examples 1 to 8 and 10 match. Also correct: 21 options, a 101-character option, duplicates (also after space collapse), empty options, each of `{ } \ < >` and `|`, no options, `Choice:`/`CHOICE:` (PH_CASE), PH_LABEL, other options or order across subject and body (PH_CHOICE_MISMATCH), PH_FIELD_TYPE in template order, escaped `\{{choice:...}}` stays text. Old bodies: 3,102 bodies, base vs head, 0 render or scan differences.
2. Forged values at Insert (compose). "21", "-1", "1.5", "1e0", " 1", "01", option text, the label, an object, a 10,000-character string, legacy "9", typed "2": all refused with "Choose again from the list: Status.", 0 drafts. ["2","3"] takes the first. "2" and 2 give the second option. Options changed since the card was drawn: "The template changed. Check the fields and press Insert again.", 0 drafts. Side panel: CHOICE_REFUSED, 0 drafts.
3. Escaping. Option text is escaped exactly like an ask value (`&amp;`, `&quot;`, `&#39;`, `&amp;amp;`). A `<b>` option is refused at save (VALIDATION). Dropdown item texts are plain.
4. Unchosen fields. "0", [] and a date input leave the field out ("Status:"); row Insert gives "Load is today.". D34 card snapshot, src/server, appsscript.json, package files and scripts: 0 changed lines.
5. Fallback text box `p-<n>-text`. "Rejected" accepted. The dropdown wins when both arrive. A typed "2" is refused, not read as a position.
6. Editor (Playwright, dev harness). Menu lists "Ask the sender to choose..."; the dialog has labelled, described name and options fields; errors for 1 option, `|`, duplicates, 101 characters; blank lines are dropped. Chip "Load status (choice)", aria label "Field: Load status, the sender chooses from 2 options". Panel line "choice: a, b, used once". "Edit choices..." shows only with a choice chip selected, prefills label and options, and rewrites the token. Preview shows the first option. During a 3 s save the toolbar menu does not open. Pasted token text stays text (escaped `\{{`), same as ask tokens on base.
7. Brace rule. The 7 ADR examples match, including the subject at character 6. 20 ordinary texts: 0 false refusals. Old template with the pattern opens and inserts as before; next save and duplicate are refused; import reports it failed; export carries it unchanged.
8. Size. index.html +5.35 KB minified, all choice or brace code. Largest 3: picker.ts +1.35 KB, validate.ts +1.17 KB, choice.ts +0.81 KB. Then dialog.ts +0.62, skeleton.ts +0.58. Nothing dead found. 9.7 KB left under the 400 KB budget.
9. Docs. Part O has 7 steps and records Q92 (dropdown shows, chosen word arrives, side panel) and Q93 ("Choose..." shown first). Editor guide, quick start and wording.md updated.

Secret scan of added lines: 0 keys, tokens, client secrets or email addresses. No new URLs or network calls.

## Must fix

None.

## Minors

1. src/shared/placeholders/skeleton.ts:22: `MARKER` is a literal U+E000 character. Use `""` so it is visible in review and diffs.
2. src/shared/placeholders/validate.ts:319: the doc comment "The subject as one text run..." now sits above `braceProblems`, not the code it describes.
3. Brace rule joins runs with nothing between them: `<p>{</p><p>{</p>` around a field across paragraphs, and `{ {{ask:N}} {` (spaces removed after tokens), are refused. Consistent with the ADR text; architect should confirm.
4. A side-panel refusal counts one apply (handoff difference 6, same as the version-changed refusal).
5. The typed fallback trims but does not collapse inner spaces, while option matching at save does. "Ready  now" typed with two spaces is refused.
6. Pre-existing flake: adminReports.test.ts:434 failed 1 run in 9.

## Only Gmail can show

Q92: whether SelectionInput DROPDOWN draws in compose and the side panel, and the chosen value arrives; a Gmail that refuses the dropdown while drawing the card cannot be caught. Q93: whether "Choose..." shows first. Part O steps 3 to 6.
