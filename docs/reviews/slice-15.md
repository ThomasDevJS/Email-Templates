# Review: slice 15, one-click insert (D31)

Date: 2026-11-11. Branch `slice/15-one-click`, head 581232a (merge of main 223f9bb into implementer head e9ef9d8). Slice diff `b2d6b2d..e9ef9d8`: 26 files, +1483 / -1306.

## Verdict: PASS

No must-fix. 9 minors below, 3 of them for the architect (spec text).

## Commands (clean install on 581232a)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, 559 packages, 16 audit findings (14 moderate, 2 high, unchanged) |
| `npm run lint` | exit 0, 0 problems |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 67 files, 1818 tests passed. All files: statements 97, branches 90.84, functions 96.41, lines 97.82. addon lines 100, addon/cards 100, render.ts 100 lines (branches 96.15, lines 99 and 122) |
| `npm run build -- --env dev` | exit 0. Code.js 358.2 KB of 800, index.html 376.1 KB of 400 |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run lighthouse` | 15 pages, all 100 |

The new test/unit/shared/gaps.test.ts run against b2d6b2d: 21 of 28 tests fail, so the tests prove the change.

## Scope of the change

- `git diff --stat b2d6b2d..e9ef9d8 -- src/server`: empty. No file under src/shared/permissions or src/shared/model.
- appsscript.json: one added key, `addOns.common.layoutProperties.secondaryColor` "#2a3c49". 10 scopes. urlFetchWhitelist unchanged.
- src/addon/spikeS7.ts and src/addon/entry.ts: unchanged. The S7 sections stay behind `BUILD_INFO.env` (dev only).
- src/web/views/editor.ts: one string, equal to spec 7.1 line 440.
- Merge 581232a: `git show --remerge-diff` is empty. `git diff 223f9bb 581232a` equals `git diff b2d6b2d e9ef9d8` file by file (26 of 26 identical). docs/guide and docs/ops/smoke.md lost nothing; every smoke.md heading occurs once.

## Acceptance criteria (spec 13.9)

"Probe" = own probe on a copy of the head (`git archive`, test/fakes/world.ts, built events). Probe files: scratchpad, deleted after.

| AC | Evidence | Own probe | Result |
|---|---|---|---|
| 1 | recipientFlows "every row has Insert ... (AC 1)", removed.test.ts | Folder row params `{"id":...,"rc":"1,1,1"}`, text "Insert"; grep of src/addon for Review, rowButton, previewCard, promptCard, PROMPTS_MISSING: 0 hits | pass |
| 2 | flows "removes fields without a value ... (AC 2)" | T2 of the smoke list: `{"kind":"insert","html":"<p>Hi, load is ready.</p>","subject":"Load","recipients":{}}` | pass |
| 3 | gaps.test "value order (AC 3)" | fallback `|` renders a gap; phone value renders `555 1<br>2` (same as base) | pass |
| 4 | gaps.test 8 pairs, 6 "left alone" tests | 25 adversarial bodies, below | pass |
| 5 | flows "(AC 5)" | subject `{{ask:Topic}}` gives `"subject":null`; body `a  b` keeps the double space | pass |
| 6 | recipientFlows "(AC 6)" x2 | equal rc: actions equal `recipientActions(lists, draft, true)`; absent rc and malformed rc "1,1": push, change line, `counted=1` | pass |
| 7 | recipientFlows "(AC 7)" | Cc key missing, To a string, Cc with a number entry, no event: 4 of 4 push the details card, no insert; card has the "Add by hand" line | pass |
| 8 | flows "call log ... (AC 8)" | open: 0 events, ops `sidebar.home`, `template.apply {followUp:true}`; shorten re-render then Insert: 1; a second tap on the counted card: still 1; row mismatch then details Insert: +1, second call `followUp:true` | pass |
| 9 | cards "details card (spec 7.4 Flow B)" 5 tests | inputs only "Recipient first name" (with hint) and "Load"; footer `onPromptInsert` params id, version, values, rh | pass |
| 10 | flows "details Insert (spec 7.4 Flow C)" | typed wins; blank removed; see minor 1 | pass |
| 11 | recipientFlows "(AC 11)" | both switches off: `{"html":"<p>Hi, x</p>","subject":null,"recipients":{}}` | pass |
| 12 | cards "lists a template once ..." | favorites [T1], recent [T1,T2]: Favorites, Recent, Folders; recent [T1]: Recent absent; search input has no `hint` | pass |
| 13 | cards label tests | search row "Adds Cc 1 · 1 field to fill · Sales"; folder row "Adds To 1, Cc 1, Bcc 1" (no path) | pass |
| 14 | cards footers, scopes.test, `scopes:check` | footer `{"text":"Open library","style":"filled"}`; render.ts maps filled to FILLED + `setBackgroundColor("#2a3c49")` | pass |
| 15 | removed.test.ts, empty src/server diff | grep above | pass |
| 16 | cards and recipientFlows `it.each(inbox, message)` | inbox and message: no footer, 0 inputs or switches, rows have no button, last section is the toolbar hint, ops `template.getBody` only | pass (unit). Smoke not run |

## Removal and gap rules (src/shared/placeholders/render.ts)

`closeGaps` implements the 4 rules as written. Own probe, 25 bodies through `sanitize`, then `renderBody`, then `sanitize` again:

- Link text only: `<a href=...></a>` kept. Link text `here {{ask:L}}`: `here` (rule 4).
- Bold only, paragraph only, list item, table cell: `<b></b>`, `<p></p>`, `<li></li>`, `<td></td>` kept, per the "left alone" list.
- Two fields in a row, `A {{ask:X}}{{ask:Y}} B` and `A {{ask:X}} {{ask:Y}} {{ask:Z}} B`: `A B`.
- Punctuation: French `Bonjour ! Merci ?` keeps its spaces before `!` and `?` (gap removed, rule 1); German `Hallo; Danke: ok`; Russian `Привет, «» ok`; Spanish `Hola ¡ ¿Qué?`; Chinese `你好 ，谢谢 。` and Arabic `مرحبا ، شكرا ؟` keep a space before full-width or Arabic marks (minor 3); `…` left alone.
- Attribute position: the sanitizer keeps `{{` out of attributes (PH_ATTR at save); `mapTextRuns` touches text runs only. No attribute changed in any output.
- Escape: `Hi \{{ask:N}} and {{ask:M}} \{{x` gives `Hi {{ask:N}} and {{x`.
- Markup characters: `a &lt; {{ask:N}} &gt; b &amp; {{ask:M}}` gives `a &lt; &gt; b &amp;`; value `Ann <b>&'"` in the subject stays plain text, in the body it is escaped by `formatValue` (unchanged).
- Subject: `Quote for`; `{{ask:T}}` and `{{ask:A}} {{ask:B}}` give ""; U+2028 becomes a space; `Re {{ask:A}}: x` gives `Re: x`.
- Sanitizer: `sanitize(output) === output` for all 50 outputs and for 10,000 fuzz outputs.
- New tokens: rules only drop one U+0020 next to a gap, so no rule joins `{` and `{`. `{{{ask:N}}{ask:M}}` renders the literal `{{ask:M}}` with no rule firing; the base does the same (minor 8).
- Base comparison: 5,000 random bodies (tags, entities, escapes, `{`, `}`, NBSP, tab, resolved tokens) x 2 value sets, 9,987 renders without a gap: byte-identical to b2d6b2d. Subjects without a gap: identical.

## Recipients

- Add, never remove: actions are the draft list plus new addresses. To goes only into an empty To (unit tests, reply probe).
- Slice 9 defect: To given as a string, Bcc null, Cc known, template with Cc only: one Cc action `["x@example.com","safety@example.com"]`, no To or Bcc action. An unknown field never gets an action.
- Address already in the draft as `CC <Safety@Example.com>`: no action.
- `deny`: row label "Adds Cc 1", `rc` "0,1,0", insert adds Cc only; the outside Bcc is never added.
- Details card `rh` path: unit test "changed recipients under the open card" passes; probe shows `rh` on the footer.

## Use counting and logs

- One path logs at most one apply event (AC 8 probe). Opening the card logs none. A second tap on a counted card logs none.
- A retry after a failure: a refused call buffers no event. A NETWORK failure after the server buffered the event logs twice on retry; same as base (slices 4 to 14).
- `world.lines`: no draft address, no template address, no typed value, no field label. Only the actor (logged on every op, spec 11).

## Deviations in the implementer handoff

1. Details Insert without `title`: accept. The card reads the title from the cached row or the apply result; no param carries content.
2. `counted=1` on the card pushed by a row Insert: accept. Required for AC 8; probe shows +1 for the path.
3. `replacesSubject(draftHasSubject)`: accept. The choice argument had no caller. Spec 7.4 Flow A step 5 still names two arguments (minor 9).
4. Subject collapses double spaces: accept. Spec 5.6 `oneLine` rule; the AC 5 double-space check runs on the body.
5. `Rendered.missing` read by tests only: accept for this slice. It is unused in src (minor 2).

## Tests deleted and their successors

47 `it`/`describe` titles removed, 67 added. Each removed test has a successor:

- preview card tests (5) -> details card tests in cards.test.ts (Fields, subject switch, Edit at edit or manage, side panel `panelDetailsCard`).
- prompt card tests (4) -> details card: inputs and order, more-than-20 line, subject switch.
- "refuses more than 20 fields" (card and flow) -> "inserts a template with more than 20 fields in one click", "shows at most 20 inputs, then the more-than-20 line".
- "never puts two filled buttons side by side" -> "has one filled button per details card, in the footer".
- "path first" label test -> "recipient hint, fields hint, path" test.
- insert flow and prompt card Insert (12) -> row Insert (Flow A) and details Insert (Flow C) describes; "blocks a blank field" -> "a blank field is removed".
- D24 tests (Insert with subject, body only) -> details switch tests (4).
- recipient flows (13) -> rows with `rc`, Flow A rc and unknown tests, details card with recipients, side panel `it.each`.
- logic: `checkAnswers`/`problemText` -> `tooLong`/`shortenText`/`moreFieldsText`; `replacesSubject` 6 cases -> 2 cases (the choice argument is gone).

## Cards and wording

- Home order Favorites, Recent without favorites, Folders. No search hint. Label order hint, fields, path. Footer filled slate.
- One button per row. Details footer: primary Insert, secondary Edit in library. Input titles are labels (max 40 characters).
- New texts match spec 7.4 word for word. No em or en dash in added lines. Sentence case. No colon before a button.

## Docs

- Quick start: the 3 lines of spec 7.4 present word for word. Editor guide: subject, fields and recipients lines match the cards.
- Smoke "Slice 15": 13 steps plus the record table; quoted texts exist in src (states.ts:85 DENIED text, details.ts, recipients.ts). See minor 6.

## Secrets and network

- Added lines: no key, token or secret pattern. Addresses: a@example.com, b@example.com, new@example.com, a@migway.com (test data). No URL added. No new UrlFetch. No hours of service example.

## Minors

1. src/addon/flows.ts:491 (`values: cardValues`). A re-rendered details card (shorten, version, `rh`) loses the recipient first name. Its Insert sends `followUp: true`, and the server returns `recipientFirstName` "" then. Probe: direct Insert "Hi Bob, 7"; after a shorten re-render "Hi, 7", while the input hint says "Leave blank to use the To recipient's first name". Spec 7.4 Flow C and wireframe 02 conflict here. Architect: carry the resolved values of the counting call into the re-render, or resolve the name on `followUp`.
2. src/shared/placeholders/render.ts:29 and 169. `Rendered.missing` and the subject `missing` have no src reader. Drop them and assert removed fields through `promptsFor` in tests, in a later slice.
3. Rule 2 knows ASCII `, . ; : ! ?` only. Full-width `，。？`, Arabic `، ؟` and Spanish `¡` keep the space before them. Spec conformant ("other punctuation"). Architect: extend the list if Migway sends in those languages.
4. Rendered subject has no length cap: a 500-character value gives a 691-character subject. Base same.
5. test/unit/addon/removed.test.ts misses "The draft already has a subject. It is kept." and the template-literal form of "Review". Own grep: 0 hits in src/addon.
6. docs/ops/smoke.md step 11: an admin tester keeps access after removing a grant (ADR-0003 C). Say "as a user who is not an admin". Spec 7.4 step 11 has the same wording.
7. docs/guide/user-quick-start.md step 5 states "the panel closes" before smoke step 1 confirms it.
8. `{{{ask:N}}{ask:M}}` saves and renders the literal text `{{ask:M}}` into the draft. Pre-existing; no gap rule involved.
9. Spec 7.4 Flow A step 5 (`replacesSubject(undefined, ...)`) and Flow B step 4 (`title` param) describe the old signatures. Architect to update.

## Only a Gmail run shows

- The card closes after a row Insert and after a details Insert (steps 1, 4).
- Label on one line, wrapped or cut (step 3).
- `secondaryColor` honored on "Edit in library" (step 10).
- Empty `<p>` shown as a blank line (step 13); empty `<a>` and `<b>` left in the draft.
- First name resolution on a live draft; the usage count rising by 1 (step 8).
- Smoke "Slice 15" steps 1 to 13 not run: no Gmail here.

## Follow-up 1 (head 04af35b on main c259b5c)

Verdict: PASS. No must-fix. Minors 1, 2 and 5 are closed. Diff `c259b5c..04af35b`: src/addon/flows.ts and src/shared/placeholders/render.ts only, plus tests and the handoff. No change under src/server or src/web.

Commands, clean `npm ci` on 04af35b:

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0, 0 problems |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 67 files, 1825 tests passed; all files lines 97.82, branches 90.84; addon lines 100 |
| `npm run build -- --env dev` | Code.js 358.0 KB of 800, index.html 376.0 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |

The new test "one result on every insert path" fails on c259b5c (1 of 45 in flows.test.ts) and passes on 04af35b.

### 1. Three paths give one result

Own probe: 3 templates x 6 drafts x 3 paths (row Insert, first details Insert, details Insert after a shorten re-render). 18 of 18 combinations give the same body and subject on all 3 paths.

| Template | Internal known (Bob) | Internal not in directory | Outside address | No To | Two To | To unreadable |
|---|---|---|---|---|---|---|
| `Hi {{recipient.first_name}}, {{ask:N}} 7`, subject `Load {{ask:N}} for {{recipient.first_name}}` | `Hi Bob, 7` / `Load for Bob` | `Hi, 7` / `Load for` | same as left | same | same | same |
| `{{recipient.first_name\|there}}` | `Hi Bob, 7` / `S Bob` | `Hi there, 7` / `S there` | same | same | same | same |
| no first-name token | `Hi 7 Ana Lima` / `Load` | same | same | same | same | same |

When the first-name box appears: only when the template holds `{{recipient.first_name}}` without a fallback, on every details card (opened, pushed by a row Insert, re-rendered). It is always empty and carries the hint "Leave blank to use the To recipient's first name, when known." A template with a fallback or without the token shows no box. An outside recipient never fills it (the server resolves only `DOMAIN` addresses). A typed name wins: "Robert" gives `Hi Robert,`. The box never shows a wrong or outside name. A user may wonder why the box is empty when the name is known; the hint answers that (opinion: acceptable).

### 2. Values in action parameters

- `values` holds the 5 keys of `variableValues`: sender name, title, phone, department and the resolved recipient first name. About 111 bytes for the test profile. Typed answers travel as form inputs and never as parameters.
- After the first counting call the card carries the given name (`"recipient.first_name":"Bob"`). The card pushed by a row Insert carried it before this follow-up too. No address travels.
- Logs: `world.lines` holds no name, no draft address and no outside address over all 54 runs.
- Size: only 5 keys can be present, so 10 long values cannot occur. A tampered `values` with 10 extra keys of 2,000 characters (20,081 bytes) is accepted, and the extra keys never reach the draft. Card Service publishes no limit on action parameters. What Gmail does above a limit is unverified.
- Tampered values render through the same `formatValue`. `<script>alert(1)</script>` becomes `&lt;script&gt;...`. `"><img src=x onerror=1>` is escaped. `{{ask:x}}` and `\{{ask:y}}` stay literal text, so the renderer does not parse them again. A fresh non-blank server value overrides a carried one.

### 3. Use counting

Every re-rendered Insert adds 0 apply events (`againApplies+0` in 18 of 18 combinations). AC 8 test unchanged and passing.

### 4. `missing` removed

`grep -rn "\.missing\b" src test`: 0 hits. 7 assertions on `missing` in gaps, placeholders and subject tests were rewritten. 6 now assert the rendered output, and 1 asserts the field list through `promptsFor`. None was dropped without a successor. removed.test.ts checks 18 texts, and src/addon holds none of them.

### Open minors

Minors 3, 4, 6, 7, 8 and 9 above remain open.
