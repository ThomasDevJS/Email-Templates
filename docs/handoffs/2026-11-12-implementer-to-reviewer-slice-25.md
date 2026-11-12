# Slice 25: date field `{{date:Label}}`, D38 (implementer to reviewer)

Branch `slice/25-date-field` from `claude/gracious-franklin-3n8zbq` 3ce78a0. Built from spec 5.9 and ADR-0004 Amendment 2026-11-12. `src/server` unchanged; no new scope, dependency or network call.

## Done

- Shared: `TOKEN_PATTERN` is the ADR regex (group 1 `ask|date`); prompt segment `type: "text" | "date"`; `dateToken`. `scanBody`: `PH_FIELD_TYPE` at the later token, first spelling in the text; lenient pass knows `date:` (`PH_CASE` "Use lower case: date:", `PH_FALLBACK_ASK`, `PH_LABEL`); `PH_TOO_MANY` counts both. `PromptField.type` (implicit = text). New `date.ts`: `dateText(raw)` (UTC day, `Math.round`, year 1000 to 9999) and `typedDateMs(text)` (M/D/YYYY or MM/DD/YYYY, real days only). `preview.ts` unchanged (`[Label]`).
- Add-on: widget kind `date` (`name`, `title`, `valueMs`); `toDate` draws `newDatePicker`, no hint, `setValueInMsSinceEpoch` only when a value exists; if `newDatePicker` is missing or throws, a text box with hint "MM/DD/YYYY". `dateValue(event, name)` reads `dateInput.msSinceEpoch` as number, string, first of an array; not finite = no date. `formValue` uses it first, so the popup and the side panel read dates the same way. `tooLong(entered, fields)` skips dates; `badDates` refuses a wrongly typed fallback date; `answersByKey` writes MM/DD/YYYY. A re-rendered card sets the picked day back.
- Editor: menu item and dialog (body and subject); chip `ph ask date`, label + muted " (date)" (`.ph-or` reused, no CSS change), screen reader "Field: <label>, a date the sender picks"; panel "date, used once / <n> times"; new empty-panel text; "Preview as me" (body and subject) shows today's local date; history shows the chip. `load.ts`, `serialize.ts` unchanged (`tokenOf` carries the type).
- Docs: editor guide (menu row + 3 lines), quick start (1 line), wording.md (8 rows), test round part N (7 steps).

## Spec differences

1. Wrong typed date (fallback only): spec has no sentence. Used "Enter a date as MM/DD/YYYY: <field names>", in the style of "Shorten to 500 characters". Same text on the details card and as the side-panel refusal.
2. ADR keeps the picked value as a ms string in `entered`; this build keeps MM/DD/YYYY (converted at read) and turns it back into ms for `setValueInMsSinceEpoch`. Same result on screen.
3. The text-box fallback is the ADR's option 3, built at the coordinator's request; the spec does not name it.
4. Side panel: the wrong-date refusal comes after `template.apply` (field types come from the body), so it counts one use, like the existing version-changed refusal.
5. "UTC-11 and UTC+11 at both ends of the day" was read as local midnight in both zones plus the rounding edges (UTC midnight +11:59:59 and -12:00 give the day; +12:00 gives the next). A local 23:59 value is not a date-only pick and is not covered.

## Verified

- `npm ci` from scratch, `lint` clean, `typecheck` clean, `format:check` clean.
- `test:coverage`: 73 files, 2,055 tests passed; all files 97.33 % statements.
- `build -- --env dev`: Code.js 377.2 KB of 800, index.html 384.9 KB of 400.
- `scopes:check`: 10 scopes, all approved. `lighthouse`: 16 pages, all 100.
- Tests: spec examples 1 to 9 (1, 3 end to end through `promptInsertFlow`; 2 row Insert and the "n fields to fill" count; 4 to 8 in `scanBody` and the card); `date.test.ts` under TZ New York and Auckland (1794441600000, numeric string, UTC-8, UTC+9, UTC-11, UTC+11, UTC+13 = 11/11, "", "abc", NaN, year 10000, 02/29/2028, 1st of a month); `dateInput` as number, string, array, empty array, absent, "soon"; fallback missing and throwing; side panel picked, empty and wrong typed; same label as `ask:` and `date:` across subject and body; subject `{{date:}}`; `PH_TOO_MANY` with 15 + 6.
- D34 snapshot (`cardLook.test.ts`): 0 lines changed. `look()` gained a `date` case; no frozen card holds a date field.

## Left for later

- Q78 brace rule, a date format setting, a time picker, a default date (out of scope).
- Q85, Q86, Q87 need Gmail: part N of the test round.
- index.html has 15 KB left under its budget.

## Risks

- Q86: a Gmail that refuses the picker while drawing the card cannot be caught; the fallback only covers a missing or throwing `newDatePicker`.
- Q87: an account at UTC+12 or later gets the day before if Gmail sends local midnight (ADR section 3).
- Q89, Q90: a page loaded before the deploy shows `{{date:X}}` as an error; a rollback inserts the token as text. No migration, as the ADR says.

## Files touched

src/shared/placeholders/{grammar,validate,render,date}.ts; src/addon/{event,prompts,flows,panel}.ts; src/addon/cards/{spec,render,details}.ts; src/web/editor/{schema,picker}.ts; src/web/views/{preview,editor}.ts; tests in test/unit/{shared,addon,web}; docs/guide/{editor-guide,user-quick-start}.md, docs/design/wording.md, docs/ops/test-round-1.md.

## Commands

`rm -rf node_modules && npm ci`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run build -- --env dev`, `npm run scopes:check`, `npm run lighthouse`.
