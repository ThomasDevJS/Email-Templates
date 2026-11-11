# Review: slice 22, hints and Search button (D36)

Verdict: PASS. 0 must-fix, 4 minors.

Branch `slice/22-hints-search`, head 8b91e3d, base ae600fa (merge base with `claude/gracious-franklin-3n8zbq`). Reviewed 2026-11-11.

## Commands (worktree, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1982 tests passed; all files 97.2 statements, 91 branches, 98.02 lines; addon 98.56 statements |
| `npm run build -- --env dev` | "Built dev 8b91e3d", Code.js 372.5 KB of 800 KB, index.html 380.8 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `git diff --stat ae600fa..8b91e3d -- src/server src/web src/shared appsscript.json package.json package-lock.json` | empty |

## Probes

One vitest probe on `git archive` copies of head and base, both rendered through the recording Card Service.

### 1. Hints

- 7 hostile strings (`a<b>c`, `x & y`, `q "z"`, `</font>`, `<font color=red>`, a script tag, `it's`) went into titles, field labels, folder names, addresses, problems and server messages. Cards: details, panel details, home, search with and without results, folder (45 folders, so the cut line shows) for 3 entries, and 14 state cards.
- 2,492 text calls. 2,359 are byte-identical to the base. 133 equal `<font color="#5f6368">` + base text + `</font>`. 0 other differences. Error lines keep their red, byte-equal to the base. Empty states stay plain.
- Exactly 5 grey texts, word for word as in the base: the fields line, the finish-typing line, the signature line, the toolbar hint and the cut line. None carries user data. The cut line noun is a fixed word and the numbers are counts. Hostile input never reaches a hint.
- Rule check, "guidance on what to do next":
  - The fields line, the toolbar hint and the cut line ("Use Search or Open library for the rest.") are guidance.
  - The signature line states a fact about Gmail, not the template, then gives the next step. It fits.
  - The finish-typing line warns of lost addresses. It is guidance, but grey makes it weaker (minor 2).
- Grey #5f6368 contrast: 6.05:1 on white, 2.66:1 on #202124, 2.25:1 on #2d2e30.

### 2. Search button

- Present on home, results and no-match cards for compose, inbox and message (cardLook snapshot, 9 lines).
- No-match card, compose, actions: `onSearch` SPINNER (box), `onSearch` SPINNER (button), `onOpenLink` NONE. Alt text "Search templates". The box keeps `onChange` (home.ts:67).
- Icon guard (render.ts:77-84): a structural intersection type, with no `any`. With a fake TextButton that lacks `setMaterialIcon`, the card renders without the icon. With one whose `setMaterialIcon` throws, `renderCard` throws "no icon", so the home card fails (minor 1). Google's TextButton reference documents `setMaterialIcon(icon)` with no restriction, so a throw is unlikely.

### 3. Two calls from one click

`search` (sidebar.ts) only reads; it writes nothing. A blur plus a button press gives 2 `onSearch` runs. Each makes 1 server call and returns an `update` of the same results card. Worst case: the card redraws twice and 2 spinners show. No state changes.

### 4. Widget counts (caps of folder.ts, 200 folders, 100 subfolders, 20 favorites, 20 recent)

| Entry | Home | Folder | Search | No match |
|---|---|---|---|---|
| compose | 60 | 63 | 23 | 3 |
| inbox | 61 | 64 | 24 | 4 |
| message | 76 | 84 | 44 | 4 |

The worst cases (76, 84, 44) equal the folder.ts comment. All are under 100.

### 5. Snapshot

The diff of cardLook.test.ts.snap has 9 added lines, all `"buttons: Search",` right after `"input: Search templates",`. 0 removed lines.

### 6. Docs

- Part E step 1 names the outlined Search button. Part J step 1 names the grey line with the "i" icon.
- Older steps that "click outside the box" (part C step 12, smoke steps) still work, because `onChange` remains.
- Part L has 4 steps for a person, and each has "Expect:" or "Record:". Step 2's "flicker of two" is hard to see by eye (minor 3).

### 7. Secrets

Added lines hold 0 keys, tokens or addresses.

## Minors

1. render.ts:83-84: the `typeof` guard covers a missing method, not a throwing one. A throw breaks the home and search cards in both entries. Fix: wrap line 84 in try/catch. Gmail validates at render time, so a host-side rejection would still show as a card error; part L step 2 is the check.
2. recipients.ts:176: the finish-typing line warns of data loss. Grey with an info icon makes it read as optional (opinion). Owner's choice: keep it as a hint, or leave it plain.
3. docs/ops/test-round-1.md:294: replace "a flicker of two" with "Apps Script, Executions: the number of `onSearch` runs at that time (1 or 2)".
4. The grey reaches 2.66:1 on Gmail's dark #202124 if Gmail darkens add-on cards. Part L step 4 records it. Same risk as the slice 21 red.

## Gmail only

- The `info` start icon on a DecoratedText and the `search` icon on a TextButton.
- 1 or 2 search runs per button press after typing.
- Grey hint readability and card background in the dark theme.

# Follow-up 1 (slice 22b): error icon, review minors, popup search row

Verdict: PASS. 0 must-fix, 3 minors.

Branch `slice/22b-error-icon`, head 0b90f44, base 48d1901 (merge base with `claude/gracious-franklin-3n8zbq`).

## Commands (worktree, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1986 tests passed; all files 97.18 statements, 90.99 branches, 98.02 lines; addon 98.56 statements |
| `npm run build -- --env dev` | "Built dev 0b90f44", Code.js 373.5 KB of 800 KB, index.html 380.8 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `git diff --stat 48d1901..0b90f44 -- src/server src/web src/shared appsscript.json package.json package-lock.json docs/spec.md` | empty |

## Probes

The probe is a vitest file run on `git archive` copies of head and base, with the recording Card Service. Factories are wrapped in a Proxy so that one method is missing or throws.

### 1. Error lines

- 7 hostile strings went into the "Shorten" problem (field label), titles, addresses and the server messages of 14 state cards. Cards: details, panel details, home, no-match search and folder for 3 entries. 812 text calls in total:
  - 700 are byte-identical to the base.
  - 105 red lines equal the base with `(!) ` removed (details line) or byte-identical (state cards).
  - 7 finish-typing lines are now plain (item 3).
  - 0 other differences.
- Every red `setText` belongs to a `newDecoratedText`. It is followed by `setWrapText(true)`, `setName("error")`, `setAltText("Error")` and `setStartIcon`.
- State cards: only the first sentence is red. "Request ID", "Details for your admin" and the follow-up lines are byte-identical to the base and plain.
- `failureText` for 14 codes is byte-identical to the base. `(!)` no longer appears anywhere in src. Notifications never carried it.

### 2. Icon failures

| Fault | Result |
|---|---|
| TextButton `setMaterialIcon` throws | card whole, button without icon |
| IconImage `setAltText` throws or is missing | `renderCard` throws |
| IconImage `setMaterialIcon` throws | `renderCard` throws |
| DecoratedText `setStartIcon` throws | `renderCard` throws |

The start-icon path has no guard (minor 1). Gmail has drawn `setStartIcon` + `setMaterialIcon` on template rows since slice 12. `IconImage.setAltText` is in the typings and in Google's IconImage reference. A throw is unlikely.

### 3. Hints

Grey lines are the fields line, the signature line, the toolbar hint and the cut line, unchanged. `FINISH_TYPING` is a plain TextParagraph.

### 4. Popup search row

- Layout: compose gets 1 `newColumns`. Inbox and message get 0 and stay stacked. Both controls keep `onSearch` with SPINNER.
- Fallback when building the row: `newColumns` missing gives the stacked layout. So do `newColumns` throwing, `Column.addWidget` throwing and `HorizontalSizeStyle` missing. The half-built row is dropped.
- Google's Column reference allows TextParagraph, Image, DecoratedText, ButtonSet, TextInput, SelectionInput and DateTimePicker in a column. It sets no limit on actions. Columns are supported in "the dialog displayed when users open the add-on from an email draft".
- The build puts a TextInput and a ButtonSet in the columns, compose only. That matches the reference.
- The box keeps its `name`, so its form value reaches `onSearch` as before (Gmail only).
- Risk: if Gmail refuses the row while drawing, the popup home, results and no-match cards break. No code can catch that. Part L step 3 is the gate before prod.
- The reference says the second column wraps under the first at screen widths of 480 px or less on web.

### 5. Widget counts (row = 3)

| Entry | Home | Folder | Search |
|---|---|---|---|
| compose | 61 | 63 | 24 |
| inbox | 61 | 64 | 24 |
| message | 76 | 84 | 44 |

The worst cases equal the folder.ts comment. The compose home is 61, inside the stated 62 or less.

### 6. Docs and snapshot

- No `(!)` quote is left in docs/ops, wording.md or the quick start. The one in part L step 3 is "with no "(!)"".
- Changed: smoke.md (3 steps), test-round-1.md (parts C, E, K, L), quick start (2 lines), wording.md (1 row).
- Part L has 4 steps, each with "Expect:" or "Record:". Step 3 records the row, the stack and the error icon.
- Architect lines are listed and still say "(!)": spec.md:428 and 581, ADR-0009:92, wireframe 02 lines 49, 51 and 53. spec.md is untouched.
- Snapshot: 1 line drops `(!) `. 3 pairs become one `columns:` line. Nothing else changed.

### 7. Secrets

Added lines hold 0 keys, tokens or addresses.

## Minors

1. render.ts:98-105, 205: a throwing or missing start-icon call (`setAltText`, `setMaterialIcon`, `setStartIcon`) breaks the card that holds a hint or error line. Fix: build the icon in a try/catch in `toIcon`, and add `setStartIcon` only when it built. Same pattern as `toButton`.
2. Without "(!)", the icon is the only non-color signal of an error line. If Gmail draws no `error` icon, red is the only cue. Part L step 3 records the icon. If it is "n", restore the prefix.
3. The architect's 6 "(!)" lines (spec.md:428, 581; ADR-0009:92; wireframe 02:49, 51, 53) are now stale.

## Gmail only

- Columns drawn in the draft popup, and the box value reaching `onSearch` from a column.
- The `error` icon and its alt text.
- Spinner count per Search press.
