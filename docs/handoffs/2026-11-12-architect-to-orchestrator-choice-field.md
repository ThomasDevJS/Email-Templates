# Handoff: architect to orchestrator, choice field (D39, proposal)

Date: 2026-11-12. Branch `architect/choice-field` from `claude/gracious-franklin-3n8zbq` at 3ce78a0. Not pushed, not merged.

## Files

| File | What |
|---|---|
| docs/adr/0004-placeholders-and-html-safety.md | Amendment 2026-11-12 "choice fields", Proposed: facts [A47], [A46], [A13]; syntax (3 options), limits, save checks, card widget (3 options), where the limit is enforced, unchosen field (2 options), rollout; Q91 to Q97 |
| docs/spec.md | new section 5.10 (grammar, save checks with texts, editor, card, rendering, 10 examples, files, tests); 7.4 text row; 13 slice row; 15 Q91 to Q97; status line |
| docs/wireframes/02-sidebar-prompt.txt, 04-web-editor.txt | dropdown; menu item, dialog, chip, panel line |

## Orchestrator defaults: kept and changed

- 1, 2, 4, 6, 7, 8 kept. Option characters: no escape inside a token exists, so `|`, `{`, `}`, `\`, `<`, `>` and line breaks are refused, in the dialog and at save.
- 3 changed in detail: item values are positions "1" to "20", "Choose..." is "0". The reference does not say an empty value is allowed, and a position keeps user text out of the value.
- 5 changed in place: the answers never reach the web app server (`template.apply` takes no answers; the add-on renders). The check sits in the add-on Insert callbacks `onPromptInsert` and `onPromptCompose`, Apps Script code on Google's servers, against the body of the version the same apply call returned. It is the only limit: the draft stays editable by hand.
- The `PH_FIELD_TYPE` sentence becomes general ("used as <kind> and as <kind>"); for text and date it equals spec 5.9's text word for word, so slice 25 needs no change.

## Overlap with slice 25

Every listed file except `date.ts` is also changed by `slice/25-date-field`. Build after slice 25 merges; extend its `type` field with "choice". `validate.ts` is also touched by Q78.

## Questions for the owner

Q91 unchosen: removed (rec.) or first option; Q92 dropdown in popup and side panel, value in callbacks; Q93 "Choose..." selected, empty value; Q94 "Edit choices..."; Q95 limit only at Insert (accept); Q96 old builds (accept); Q97 build now or later (rec. after slice 25 passes Q85 to Q87).

## Not stated by Google's pages

Gmail support for a dropdown in the draft popup and the side panel; an item with value ""; item text length; unique values; the value in compose-action callbacks; widget count of a `SelectionInput`. Stated: 100 items at most (card JSON).

## Not verified

No code was run. Offsets in examples 5 and 8 counted by hand.
