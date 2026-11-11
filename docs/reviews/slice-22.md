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
