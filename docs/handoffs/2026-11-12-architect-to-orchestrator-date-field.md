# Handoff: architect to orchestrator, date field (D38)

Date: 2026-11-12. Branch `architect/date-field` from `claude/gracious-franklin-3n8zbq` at 80e4b77. Not pushed, not merged.

## Files

| File | What |
|---|---|
| docs/adr/0004-placeholders-and-html-safety.md | Amendment 2026-11-12 "date fields", Proposed: platform facts [A45], [A46], [A13]; syntax (3 options), save checks, card widget (3 options), the MM/DD/YYYY conversion, unpicked date, counting, subject, rollout; sources; Q85 to Q90 |
| docs/spec.md | new section 5.9 (grammar, save checks with texts, editor, details card, rendering, 9 examples, files, tests); 7.4 text row; 13 slice row; 15 Q85 to Q90; status line |
| docs/wireframes/02-sidebar-prompt.txt | date picker on the details card |
| docs/wireframes/04-web-editor.txt | menu item, chip, panel line, preview sample |

## Orchestrator defaults: kept and changed

- 1, 4, 5, 6, 7, 8 kept.
- 2 changed: the editor gets a second menu item "Ask the sender for a date..." instead of a choice inside one dialog. Reason: `promptText` (`src/web/ui/dialog.ts`) holds one text box; the menu item reuses it unchanged (Q88).
- 3 changed: the widget is `DatePicker`, not `DateTimePicker`. Reason: in Apps Script the date-only class is `DatePicker` [A45]; `DateTimePicker` asks for a time.

## Conversion

`Math.round(ms / 86_400_000)` days, then UTC month, day, year as MM/DD/YYYY. Exact if Gmail sends 00:00 UTC (card JSON says so for DATE_ONLY). If Gmail sends local midnight, right from UTC-11:59 to UTC+11:59, a day early from UTC+12 (Q87).

## Questions for the owner

Q85 empty picker; Q86 picker in popup and side panel, value in compose callbacks; Q87 time of day of the value; Q88 menu item vs dialog choice; Q89 rollback inserts the token as text; Q90 old open web page.

## Not stated by Google's pages

Whether a `DatePicker` can start empty; Gmail support in the draft popup and side panel; `dateInput` in compose-action callbacks; the time of day of `dateInput.msSinceEpoch`; the number or string type of `msSinceEpoch`; widget count of a picker.

## Q78

Both ADR-0004 amendments of 2026-11-12 change `src/shared/placeholders/validate.ts`. They do not conflict: the brace skeleton removes a date token like any token.

## Not verified

No code was run. Example 9 numbers were computed in Python. The slice map row of slice 23 still says "in review" on the main line; not changed here.
