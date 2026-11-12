# Handoff: implementer to reviewer, slice 22 follow-up 1 (error icon, review minors, popup search row)

Branch `slice/22b-error-icon`, cut from `claude/gracious-franklin-3n8zbq` at 48d1901. No push, merge or deploy. Commits: a4ec5ac (items 1 to 3), 4c5c560 (docs for item 1), 37dd227 (item 6), 09fd290 (docs for item 6), then this handoff.

## Done

1. Error lines. `tone: "error"` renders like a hint (render.ts `TONES`): wrapped DecoratedText, material icon `error`, `IconImage.setAltText("Error")` (in the typings, so alt text is supported), red #b32025 text through the same escaped `<font>` path. The details card line drops "(!) " (details.ts, the only builder). State cards: the red first sentence gets the same icon. Notifications and raised errors unchanged. Widget counts unchanged (one text widget becomes one DecoratedText).
2. Minor 1. `TextButton.setMaterialIcon` sits in a try/catch; a throw leaves the button without its icon.
3. Minor 2. `FINISH_TYPING` is a plain text widget again.
4. Tests (cardFeedback): "an error line is a wrapped DecoratedText with the error icon, alt text Error, and no (!) on screen"; red test without "(!)"; hints list without FINISH_TYPING; "a button icon that throws leaves the card whole"; recipients.test back to plain. Quotes of "(!) " removed in cards, flows and recipientFlows tests.
6. Popup search row. Compose entry only: a new widget kind `columns` (`fill`, `fit`; spec.ts `Single` = any other widget). render.ts `toColumns` builds Card Service Columns: box `FILL_AVAILABLE_SPACE`, button `FILL_MINIMUM_SPACE`, both `VerticalAlignment.CENTER`. The typings lack Columns, so the call goes through a small local interface. A missing method or enum value throws at build time and falls back to the stacked box and button. Inbox and message keep the stack (research R5: Columns is listed for the draft dialog only). The button keeps its "Search" label: a TextButton without text is not documented as valid, and an icon-only ImageButton with a Material icon is developer preview (R5 line 44). Tests: "compose: box and button in one row of 2 columns; side panel: stacked"; "a Columns build that throws falls back to the stacked box and button".
   - Widget count: Google does not say how Columns counts toward 100. The folder.ts comment counts it as 3 (the row plus 2 widgets). The compose home then stays at 62 or less; side-panel worst cases unchanged (home 76, folder 84, search 44).

D34 snapshot (cardLook) changes:
- 1 line: `"text: (!) The recipients of this template changed. ..."` becomes `"text: The recipients of this template changed. ..."`.
- 3 places (compose home, results, no match): the two lines `"input: Search templates"`, `"buttons: Search"` become `"columns: input: Search templates | buttons: Search"`.

Docs: smoke.md (Slice 9 step 5, Slice 15 steps 6 and 8), test-round-1.md (part C steps 5, 9, 10; part K step 4; part E step 1; part L steps 2 and 3 and table), user-quick-start.md (2 lines) quote the red line without "(!) ". Part L step 2 records how often the spinner showed (once or twice). Step 3 records the error icon, the one-row popup and the stacked side panel. wording.md: one row for the dropped prefix.

## Left for the architect (not my files)

- docs/spec.md:428 "(!) The recipients of this template changed. ..."
- docs/spec.md:581 "change line, prefixed "(!) ""
- docs/adr/0009-compose-card-one-click.md:92 "prefixed "(!) ""
- docs/wireframes/02-sidebar-prompt.txt:49, 51, 53 ("(!) " lines)

## Risks

- Gmail must show: the `error` icon, the row in the popup, and whether Gmail draws Columns in the compose dialog. A refusal while Gmail draws the card is outside the try/catch; it would break the compose home card. Part L step 3 checks it before prod.

## Commands (clean install)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages |
| `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1986 tests passed; 97.18 statements, 90.96 branches |
| `npm run build -- --env dev` | "Built dev 09fd290", Code.js 373.5 KB of 800 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |

`git diff --stat 48d1901 -- src/server src/web src/shared appsscript.json` is empty.
