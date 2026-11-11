# Review: slice 21, card feedback (D35)

Verdict: FAIL. The code passes every check. One test-plan step cannot run as written (must-fix 1).

Branch `slice/21-card-feedback`, head 9e338cb, base a807c54. Reviewed 2026-11-11.

## Commands (worktree, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1958 tests passed; all files 97.14 statements, 90.93 branches, 97.97 lines; addon 98.56 statements |
| `npm run build -- --env dev` | "Built dev 9e338cb", Code.js 370.4 KB of 800 KB, index.html 379.4 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `git diff --stat a807c54..9e338cb -- src/server src/web src/shared` | empty |

## Checks

### 1. Spinner

- One builder: `toAction` (render.ts:40) is the only place that calls `newAction`. Its 3 callers are the button click or compose action (render.ts:57-59), the item click (render.ts:90) and the input change (render.ts:111). No other `newAction` exists in src/addon.
- cardFeedback.test renders every card kind for compose, inbox and message, plus 28 state cards. It checks that every one of the 10 `CALLBACKS` appears, with SPINNER on each except `onBack` and `onOpenLink` (NONE).
- `onBack` (entry.ts:151) returns `pop`. It makes no server call and reloads nothing.
- `onOpenLink` (flows.ts:526) clears the user cache view and returns an overlay link. It makes no server or Gmail call. The reload after the overlay closes is Gmail's `RELOAD_ADD_ON`, not this action. Both exceptions are justified.

### 2. Colors

- Every `FILLED` button gets `setBackgroundColor("#2a3c49")` (render.ts:66-67, the one place). The test covers footers.
- The appsscript.json diff is one line: `"primaryColor": "#2a3c49"`. There are 10 scopes. scopes.test.ts checks `layoutProperties` equal to both colors.

### 3. Red lines

- Red widgets: the details card "(!) ..." line (details.ts:196) and the first line of each state card (states.ts:33). That gives 8 distinct texts. Follow-up lines, "Request ID", "Details for your admin", "Not added" and "Add by hand" stay plain.
- Escaping probe: 7 hostile strings (`a<b>c`, `x & y`, `q "z"`, `</font>`, `<font color=red>`, a script tag, `it's`). They went into titles, field labels (through `shortenText`), addresses and server messages. The probe rendered details, panel details, home, no-match search and 14 state cards on head and base. 728 text calls: 623 byte-identical, 105 equal to `<font color="#b32025">` + base text + `</font>`. No inner text holds `<font`, `</font` or `<script`. The "(!)" prefix stays.
- Contrast of #b32025: 6.67:1 on white. On Gmail dark backgrounds it is 2.41:1 on #202124 and 2.04:1 on #2d2e30. The design-system dark red #f0958f gives 7.21:1 on #202124 but 2.23:1 on white.
- No single red reaches 4.5:1 on both white and #202124. A fixed color is acceptable only if Gmail keeps add-on cards light in its dark theme. If Gmail darkens the card, the line fails 4.5:1. Its words stay, but the whole sentence is red, so the text itself is hard to read. Part K must record the card background color in the dark theme (white or dark), as well as readability. If the card is dark, drop the color (the "(!)" words carry the meaning).

### 4. D34 freeze

- cardLook.test.ts and its snapshot were added in 5de6f7f. Neither changed in a later commit (`git diff 5de6f7f 9e338cb` on both: 0 lines).
- Copied into a base copy (a807c54) and run: 5 of 5 tests pass. The snapshot md5 was unchanged after the run.

### 5. Raised errors and notifications

`failureText` for all 14 codes holds no `<`. `stateLines` reads `widget.text`, so the tone adds no markup. A notification's `setText` gets the plain sentence.

### 6. Part K

There are 5 steps, and each has "Expect:" or "Record:". Step 2 is wrong (must-fix 1).

### 7. Secrets

Added lines hold 0 keys or tokens. The only new URL is vitest.dev (snapshot header). No email addresses were added.

## Must-fix

1. docs/ops/test-round-1.md:276, step 2 says "Same popup, before you discard". After the row Insert in step 1 the card closes (PLAN.md:122, part B step 1), so no popup is left. A row "Insert" is also not filled. Filled "Insert" exists only on the details card footer. Fix: "Open the add-on again from the draft's toolbar, click the name "T1 plain". Record: the top bar color; the filled "Insert" and the folder card's "Open library" are dark slate blue-grey (y/n)."

## Minors

1. docs/ops/test-round-1.md:279, step 5 should add "Record: the card background is white or dark". Without it a "n" cannot choose between dropping the red and changing it.
2. The spinner on `onSearch` fires on each change event. Whether Gmail shows it on a text input is untested. Part K has no search step.

## Gmail only

- Spinner on click, change and compose actions (`setComposeAction` with a load indicator is undocumented).
- Whether `primaryColor` colors the toolbar (research Q-R5-3).
- The card background in Gmail's dark theme, and the readability of #b32025 there.
