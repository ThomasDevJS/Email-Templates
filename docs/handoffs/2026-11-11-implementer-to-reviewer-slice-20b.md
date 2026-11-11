# Handoff: implementer to reviewer, slice 20b (add-on fix round)

Branch `slice/20b-fix-addon`, cut from `claude/gracious-franklin-3n8zbq` at 16df87a. No push, merge or deploy.

## Done

| Item | Finding | Result | Test | Commit |
|---|---|---|---|---|
| 1 | slice-18 FU2 minor 1, 100 widgets | fixed | cardLimit.test.ts (12 tests) | e3ff468, 76499b2 |
| 2.1 | slice-18 minor 1, Reply-To with 2 addresses | fixed | panel.test "a reply-to with 2 addresses ..." | 8f92f61 |
| 2.2 | slice-18 minor 2, "Adds n" counts the To | fixed | cards.test "the Add recipients count follows the press ..." | 81af311 |
| 2.5 | slice-18 minor 5, "press Retry" in a raised error | fixed | panel.test "NOT_CONFIGURED gives its sentence ..." | ca39f57 |
| 3.3 | slice-15 minor 3, rule 2 punctuation | skipped | none | none |
| 3.4 | slice-15 minor 4, subject length | fixed | subject.test "rendered subject length" (3 tests) | 3a913f4 |
| 3.6 | slice-15 minor 6, admin in smoke step 11 | skipped, already fixed | none | none |
| 3.7 | slice-15 minor 7, "the panel closes" | skipped, confirmed in Gmail | none | none |
| 3.8 | slice-15 minor 8, `{{{ask:N}}{ask:M}}` | left | none | none |
| 3.9 | slice-15 minor 9, spec 7.4 signatures | left (architect) | none | none |
| 4 | slice-12 open gaps | skipped, none apply | none | none |
| 5 | row hint shorter | left, proposal below | none | none |

Item details:

- Item 1. `LIST_MAX` and `capped` in src/addon/cards/folder.ts: Favorites 10, Recent 5 (both equal the server caps), Folders 40 (home and folder cards), search results 20. Rows are cut whole, so a row keeps its Reply button set. A cut list ends with "Showing {shown} of {total} {noun}. Use Search or Open library for the rest." Worst case with an email open: home 75 widgets (1 + 21 + 11 + 41 + 1), folder 84 (41 + 40 + pager 2 + hint 1), search 43. The test builds 200 folders, 20 favorites, 20 recent, 100 subfolders, 25 templates in one folder, for compose, inbox and message. The count is checked by the test, not at run time: the builders cannot exceed it once the caps hold. The details card (at most 20 inputs, 20 recipient lines) was 44 in the slice-12 review and has no list to cap.
- Item 2.1. `mailboxesOf` (event.ts) splits a header per mailbox, quoted commas kept, last address of each piece. The first Reply-To address gives the first name; every Reply-To address counts as already in the draft, so no template Cc repeats one.
- Item 2.2. Side panel, email open, template with a To: the switch label reads "A reply adds n recipients." (Cc and Bcc). The `REPLY_TO_LINE` under it says New email adds the To. Without a To, or with no email open, "Adds n recipients." as before. A Cc equal to the sender is still counted (the card does not read the message); the press drops it.
- Item 2.5. NOT_CONFIGURED raises "Migway Templates is not set up yet. Ask your admin to finish setup." (server text). The state card keeps its Retry line. AUTH texts have no button reference.
- Item 3.3. ADR-0004 Amendment 2026-11-11 lists rule 2 as `, . ; : ! ?` and puts "other punctuation" under "Left alone on purpose". Full-width `，。？`, Arabic `، ؟` and `¡ ¿` are other punctuation. The ADR does not allow the change; it needs an ADR amendment first.
- Item 3.4. `capSubject` (subject.ts) in `renderSubject`: 200 UTF-16 units, as the editor `maxlength` and the save check count. A cut through an emoji drops the high surrogate; a trailing space goes. The web preview uses the same `renderSubject`, so it shows the cut too (no src/web change).
- Item 3.6. docs/ops/smoke.md "Slice 15" step 11 already runs as the second account with "Can use" and says why.
- Item 3.7. Test round 1 part B steps 1 and 3 (PLAN.md 2026-11-11) recorded that the card closes after a row Insert.
- Item 4. All 7 gaps closed in the slice-12 follow-up. The follow-up minor (60-character echo splits a surrogate) is fixed: `noMatchText` cuts with `Array.from` (home.ts). Label escaping in Gmail is checked by smoke "Slice 12" step 1, a Gmail run.

## Left

- Item 3.8. `{{{ask:N}}{ask:M}}` saves; with N empty it renders the literal `{{ask:M}}`. Options: (a) a save rule that refuses `{` right before a field or `}` right after one, a new problem code in validate.ts, and templates saved before then fail their next save; (b) render escapes a `{{` formed by a gap; (c) accept, as the review did ("pre-existing"). Needs an ADR-0004 decision.
- Item 3.9. docs/spec.md 7.4 Flow A step 5 still names `replacesSubject(undefined, draftHasSubject)`. Spec is the architect's file.
- Item 5. Proposal, not built: the short form loses facts. Home row before and after:
  - T4: "Adds Cc 1, Bcc 1 · 2 fields to fill · Smoke 6a" to "Cc 1, Bcc 1 · 2 fields"
  - T6: "Adds To 1, Cc 2, Bcc 1 · Smoke 6a" to "To 1, Cc 2, Bcc 1"
  - T2: "2 fields to fill · Smoke 6a" to "2 fields"
  - T4 on a folder card: "Adds Cc 1, Bcc 1 · 2 fields to fill" to "Cc 1, Bcc 1 · 2 fields"
  Lost: the folder on Favorites, Recent and Results rows; "Adds" (the counts are what Insert adds, not what the template holds); "to fill" (wording.md: a field also fills itself from the directory). Folder cards already drop the path. No shorter form keeps every fact, and spec 7.4 fixes the current text. Owner's choice: accept wrapping, or drop one named fact.

## Risks

- Gmail only: the cut line under a collapsed section (it sits after row 5, so it shows only when the section is opened); "A reply adds n recipients." width in the 300 px panel; how Gmail shows the NOT_CONFIGURED sentence in its error bar (part J step 11 rerun).
- 40 folders is an add-on cap only; a library with 41 or more top-level folders shows the line on every home card.

## Files

src/addon/cards/{folder,home,details,recipients}.ts, src/addon/{panel,event}.ts, src/shared/placeholders/{render,subject}.ts, test/unit/addon/{cardLimit,cards,panel}.test.ts, test/unit/shared/subject.test.ts, docs/design/wording.md (3 rows), docs/guide/user-quick-start.md (1 line), docs/ops/test-round-1.md (part J step 9). Protected paths: `git diff --stat 16df87a -- src/server src/web src/shared/permissions src/shared/model appsscript.json package.json package-lock.json` is empty.

## Commands (clean install, head 76499b2 before this handoff)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0 |
| `npm run lint`, `npm run typecheck` | exit 0, no output |
| `npm run test:coverage` | 69 files, 1949 tests passed; all files 97.14 statements, 90.91 branches; addon 98.56 |
| `npm run build -- --env dev` | "Built dev 76499b2", Code.js 369.8 KB of 800 KB, index.html 379.4 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
