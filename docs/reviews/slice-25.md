# Review: slice 25, date field `{{date:Label}}` (D38)

Verdict: PASS. 0 must-fix, 6 minors. Grammar, validation, rendering, the Gmail card, the editor and the server path match spec 5.9 and the ADR-0004 amendment. Old templates parse and render as before. The open points are Gmail behavior (Q85 to Q87) and one test that fails now and then.

Branch `slice/25-date-field`, head a4dc24f, base 3ce78a0 (merge base with `claude/gracious-franklin-3n8zbq`). Reviewed 2026-11-12.

## Commands (worktree a4dc24f, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci`, `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | run 1: 2054 of 2055 passed; `admin.test.ts:384` "loads the library folders again after a grant change" failed (expected 1 `folder.list`, got 0) while probes ran in parallel. Runs 2 and 3: 73 files, 2055 passed; statements 97.33, lines 98.2. The file alone 3 times: 33 of 33 passed (minor 6) |
| `npm run build -- --env dev` | Code.js 377.2 KB of 800 KB, index.html 384.9 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 of 16 runs at 100 |

- No change in `src/server`, `appsscript.json`, `scripts` or the package files.
- The D34 snapshot file (`test/unit/addon/__snapshots__`) has 0 changed lines.
- Added lines: 0 keys or tokens, 0 addresses, 0 URLs.

## 1. Grammar and save checks (real `scanBody`, `promptsFor`, `renderBody`, `renderSubject`)

- Old templates: base and head trees in one vitest file. Corpus: the 20 editor fixtures, the sanitizer fixtures and 3,000 random bodies built from `ask`, variable, escape, malformed, case and length tokens, plus `{{dat:`, `{{dates:` and `{{date X}}`. Result: 3,102 inputs, 0 differences, once the new `type: "text"` field is ignored.
- Base refuses `{{date:Pickup}}` with `PH_MALFORMED`, so no stored template can hold one.
- Spec examples:

| # | Result |
|---|---|
| 1 | `<p>Pickup on 11/12/2026.</p>` |
| 2 | `<p>Pickup on.</p>` |
| 3 | subject "Load ready 01/05/2027" |
| 4 | 1 field; "03/09/2027 and 03/09/2027" |
| 5 | `PH_FIELD_TYPE` 'The field "Pickup" is used as text and as a date (at character 19). Rename one of them.' Reversed order: character 20. Subject `{{ask:Pickup}}` with body `{{date:pickup}}`: refused (character 1) |
| 6 | `PH_CASE` "Use lower case: date: (at character 1)." for `Date:` and `DATE:` |
| 7 | `PH_FALLBACK_ASK` text as in the spec |
| 8 | no problem, no field; renders `{{date:Pickup}}` |
| 9 | 11/12/2026 and 11/11/2026 |

- `PH_TOO_MANY` fires for 15 text plus 6 date fields.
- Hostile labels:
  - `<`, `>`, `</font>`, a script tag, 41 or 81 characters, a blank label: `PH_LABEL`.
  - `&` and `"`: accepted. A rendered value `<b>&` is escaped to `&lt;b&gt;&amp;`.
  - Control characters U+0007 and U+0000: accepted as labels. `{{ask:}}` accepts them on base too (minor 1).

## 2. Rendering

`dateText`, run under TZ UTC, America/New_York and Pacific/Kiritimati with identical output:

| Input | Result |
|---|---|
| UTC 00:00 on 11/12 | 11/12/2026 |
| UTC 23:59:59.999 on 11/12 | 11/13/2026 (rounds) |
| Local midnight at UTC-11 | 11/12 |
| Local midnight at UTC+11 | 11/12 |
| Local midnight at UTC+14 | 11/11 (Q87) |
| Local midnight at UTC-12 | 11/13 (Q87) |
| 02/29/2028, 12/31/2026, 01/01/2027 | as written |
| 0 | 01/01/1970 |
| -5 days | 12/27/1969 |
| `"1794441600000"` | 11/12/2026 |

Unpicked (""): array (to `dateText` directly), NaN, Infinity, ±1e20, `"abc"`, `true`, `{}`, "", `undefined`, a year outside 1000 to 9999. `dateValue` reads the first array element. An unpicked date is removed with the gap rules: example 2, and "Pickup on." in the side panel. The card flow with NaN, Infinity, `"Invalid Date"`, `{}`, `[]`, `[NaN]`, `null`, `true` and ±1e20 inserted `<p></p>` every time. 0 drafts with "NaN" or "Invalid Date".

## 3. Add-on

- Order: `{{ask:A}} {{date:D1}} {{ask:B}} {{date:D2}}` gives input p-1, date p-2, input p-3, date p-4. The picker has no hint and `valueMs` null. The compose and side-panel tests pass.
- Fallback: `render.test` covers a missing or throwing `newDatePicker`; both give `setHint("MM/DD/YYYY")`.
- Typed values refused with "Enter a date as MM/DD/YYYY: D1" and no draft (compose): 13/01/2026, 02/30/2026, 1/1/26, text, `<b>x</b>`, NaN. 1/1/2026 and " 11/12/2026 " are accepted.
- Difference 4 (side panel): a wrong typed date is refused after `template.apply`, so 1 apply is counted. That is the same order as `TEMPLATE_CHANGED` (`panel.ts:265-270`). In compose a refusal also counts (`counted: true`), as "Shorten to 500" does. Acceptable: it only happens in the text-box fallback.
- Row Insert removes the field; the folder card reads "1 field to fill" and "2 fields to fill". One picker takes the place of one text box, so widget counts do not grow.

## 4. Web (dev harness, Chromium)

- "Insert field" menu: 5 values, "Ask the sender...", "Ask the sender for a date...".
- The dialog title, label and hint match spec 5.9. The hint is linked by `aria-describedby`, and focus starts in the input.
- Chip: class `ph ask date`, text "Pickup date (date)", `aria-label` "Field: Pickup date, a date the sender picks", `role="img"`, `data-ph="{{date:Pickup date}}"`.
- Panel line: "date, used once". "Preview as me" shows 11/12/2026, today's local date.
- Busy block (slice 24): the toolbar "Insert field" click and a typed `{{` open nothing during a save.
- Paste of " A {{date:Delivery}} B {{ask:Ref}} C" by text or HTML clipboard: both tokens stay text in the editor, in the same way. The saved HTML holds `{{date:Delivery}}`.
- Lighthouse 100.

## 5. Server (through `setupWorld`)

- `template.create` and `template.update` refuse all 7 bad cases with VALIDATION: examples 5, 6 and 7, 41 characters, subject ask with body date, subject `{{DATE:X}}`, and `{{date:}}`.
- A good template: `prompts` ["Pickup date", "Driver"]; snippet "Pickup on {{date:Pickup date}} by {{ask:Driver}}.", in the same form as the `ask` template.
- `search.body` finds both templates for "Pickup", "date", "Driver" and "on".
- Export holds the subject and body tokens. Import creates 2 and keeps `prompts` and the subject. An import with `{{ask:X}} {{date:X}}` fails that item.

## 6. Redraw round trip (difference 2)

A 501-character text forced a refusal card, then the redrawn picker value was submitted again. For all 12 values the first read, the redrawn value and the inserted date name the same day. Code only; how Gmail shows a UTC-midnight start value is unknown (Gmail list).

## 7. Docs

- Editor guide, quick start and wording.md: the texts match src.
- Part N: 7 steps; steps 1, 3 and 5 have "Expect:", steps 2, 4, 6 and 7 "Record:". It answers Q85 (step 2), Q86 (steps 2 and 6) and Q87 (steps 3, 4 and 7).

## Minors

1. Date (and text) labels accept control characters such as U+0000 and U+0007. The base does the same for `ask:`.
2. A user at UTC+12 to UTC+14 or at UTC-12 gets the wrong day if Gmail sends local midnight (documented, Q87).
3. Part N has no redraw step. Add one: pick a date, put 501 characters in a text field, "Insert", then check that the picker still shows the picked day and the next "Insert" writes it.
4. A pasted `{{date:X}}` (and `{{ask:X}}`) stays text until the template is opened again. The base behaves the same.
5. The side-panel refusal of a wrong typed date counts one use (difference 4). Accepted; the spec could say so.
6. `test/unit/web/admin.test.ts:384` failed once in 3 coverage runs under load. Likely cause: the library nav click lands while the slice 24 loader still blocks the page. Make the test wait for `data-blocked` to clear.

## Only Gmail can show

- Q85: whether the picker starts empty.
- Q86: the picker in the side panel, and the dateInput shape.
- Q87: the day for each time zone, and the start value of a redrawn picker in a US time zone.
