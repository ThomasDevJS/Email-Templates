# Slice 26: choice field `{{choice:Label|A|B}}` (D39, D40) and the brace rule (Q78) (implementer to reviewer)

Branch `slice/26-choice-field` from `claude/gracious-franklin-3n8zbq` 047394e. Built from spec 5.10, ADR-0004 Amendment 2026-11-12 "choice fields", and Amendment 2026-11-12 "braces that join around a field", option 1. `src/server` unchanged; no new scope, dependency or network call.

## Done

- Grammar: the ADR regex (groups 1 to 6); prompt segment `type: "choice"` and `options` (trimmed, collapsed, empty ones kept); `choiceToken`. `choice.ts` (new): `chosenOption(raw, options)`, `typedPosition`, `optionsProblem` (the 6 `PH_CHOICE` rules in table order), limits.
- Save checks in `scanBody`: `PH_CHOICE`, `PH_CHOICE_MISMATCH`, general `PH_FIELD_TYPE` ("text", "a date", "a choice" in template order), `choice:` in the lenient pass (`PH_CASE`, `PH_LABEL`, the generic choice text). `PH_TOO_MANY` counts all kinds.
- Brace rule: `skeleton.ts` (new) `joinedBraces(runs)`, called from `scanBody` for the body and the subject (`field: "subject"`). Code `PH_MALFORMED`, the ADR sentence.
- Add-on: widget kind `select`; `toSelect` draws `newSelectionInput` `DROPDOWN`: "Choose..." "0" first, the options "1" to "n", the chosen position selected again on re-render. If the dropdown is missing or throws: a text box `p-<n>-text` with the hint "One of: A, B, C". `fieldValue(event, field, name)` reads a string, a number, an array or nothing; "0" and nothing are not chosen; any other value is refused. `onPromptInsert`: refused choices give "Choose again from the list: <labels>." and come back at "Choose...". `onPromptCompose`: "A choice is not in the template's list. Go back and open it again.". The check runs against the body the same `template.apply` returned. `tooLong` skips date and choice fields.
- Editor: "Ask the sender to choose..." (body and subject), `promptChoice` dialog with its 4 errors, "Edit choices..." on a selected choice chip (`setOptions`), chip `ph ask choice` + muted " (choice)", screen reader name, panel line with options cut to 60 characters, "Preview as me" shows the first option, new empty-panel text.
- Slice 25 review minor: `test/unit/web/admin.test.ts` grant test waits for `data-blocked` to clear before it clicks Library (3 runs green).
- Docs: editor guide (choice section, 4 lines; brace line, 1 line), quick start (1 line), wording.md (14 rows), test round part O (7 steps).

## Spec differences

1. Q94: spec 5.10 asks for "Edit choices..."; built, editing the field name and the options. The command is `setOptions(pos, label, options)`.
2. Fallback text box: named `p-<n>-text`, so a typed option such as "2" never reads as position 2. It uses the hint of Q92 fallback 2 and the spec's refusal sentences; no new text was needed.
3. `src/addon/event.ts` changed (spec: no change): `fieldValue` handles the 4 value shapes and the fallback box.
4. The skeleton pass lives in `src/shared/placeholders/skeleton.ts`, called from `validate.ts` (the ADR names `validate.ts`).
5. `PH_FIELD_TYPE` now names the kinds in template order: a date before a text field reads "used as a date and as text". Slice 25 always said "text and as a date". One slice 25 test changed.
6. Spec is silent on `{{choice:Size}}` (no `|`) and on `}` inside an option (it cuts the lenient match). Both give the generic `PH_CHOICE` text.
7. Spec 5.10 still says "proposal, not decided (Q97)"; built on the coordinator's owner decision of 2026-11-12.

## Verified

- Clean `npm ci`; `lint`, `typecheck`, `format:check` clean.
- `test:coverage`: 76 files, 2,118 tests passed; all files 97.28 % statements.
- `build -- --env dev`: Code.js 385.6 KB of 800; index.html 390.3 KB of 400 (+5.4 KB; nothing cut, 9.7 KB left).
- `scopes:check`: 10 scopes. `lighthouse`: 16 pages, all 100.
- Old bodies: `test/fixtures/oldBodies.expected.json` holds digests of segments, renders and scans of 91 bodies, written on base 047394e before any change (commit b6ba5c7); head gives the same digests.
- Tests: spec examples 1 to 10; the 7 `PH_CHOICE` triggers; spaces around `|`; 2,200 characters; `\{{choice:`; subject; `PH_TOO_MANY` over 3 kinds; `chosenOption` for "0", "", "1", "20", "21", "-1", "1.5", "01", "abc"; 5 value shapes; fallback missing and throwing; hostile options (`<`, `>`, a script tag, 101 characters, a duplicate after trimming, 1 option, 21 options refused at save; `&` and `"` escaped at insert); options changed between card and Insert (version line, new list shown); 20 choice fields under 100 widgets; side panel value and refusal; the 7 brace examples plus the gap case, the subject, old template opens and inserts, its update and duplicate refused, import fails it.
- D34 snapshot (`cardLook.test.ts`): 0 lines changed; `look()` gained a `select` case.

## Left for later

- Multi-select, a free "Other" entry, a default option, drag reordering (out of scope).
- Q92, Q93 need Gmail: part O.

## Risks

- Q92: a Gmail that refuses the dropdown while drawing the card cannot be caught; the fallback covers a missing or throwing builder only.
- index.html has 9.7 KB left under its budget.
- A side-panel refusal comes after `template.apply`, so it counts one use (as the version-changed refusal).

## Files touched

src/shared/placeholders/{grammar,validate,render,choice,skeleton}.ts; src/addon/{event,prompts,flows,panel}.ts; src/addon/cards/{spec,render,details}.ts; src/web/editor/{schema,picker,commands}.ts; src/web/ui/dialog.ts; src/web/views/{preview,editor}.ts; test/fixtures/oldBodies.ts and .expected.json; tests in test/unit/{shared,addon,web,server}; test/fakes/output.ts; docs/guide/{editor-guide,user-quick-start}.md, docs/design/wording.md, docs/ops/test-round-1.md.

## Commands

`rm -rf node_modules && npm ci`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run build -- --env dev`, `npm run scopes:check`, `npm run lighthouse`.
