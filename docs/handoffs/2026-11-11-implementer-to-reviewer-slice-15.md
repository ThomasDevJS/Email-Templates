# Handoff: implementer to reviewer, slice 15 (one-click insert, D31)

Date: 2026-11-11. Branch `slice/15-one-click`, base `claude/gracious-franklin-3n8zbq` (e710a56) plus `slice/14-wording` (e750645) merged in b2d6b2d. Not pushed, not deployed.

## Done

- Gap cleanup: `closeGaps` in src/shared/placeholders/render.ts, run per text run and on the subject; value order typed answer, value, fallback, "". A typed answer now wins over a resolved variable.
- Flow A (`insertFlow`): one `template.apply`, `rc` count check (absent = "0,0,0"), unknown draft field check, else one insert reply with fields removed. A mismatch pushes the details card with `counted=1` and inserts nothing.
- Flow B (`previewFlow`, compose): `template.apply` `followUp: true`, details card (src/addon/cards/details.ts). Side panel keeps `template.getBody` and gets `panelDetailsCard` (no inputs, no switches, no Insert, hint last).
- Flow C (`promptInsertFlow`): `followUp` only with `counted=1`; blank fields removed; shorten, version and `rh` lines re-render with `counted=1`.
- Home: Recent drops favorites, no search hint, label order hint, fields, path; footer `FILLED` slate; manifest `addOns.common.layoutProperties.secondaryColor` "#2a3c49" (10 scopes unchanged).
- Removed: preview.ts, prompt.ts, `rowButton`, `insertButtons`, `withSubjectButton`, `bodyOnlyButton`, `tooManyFieldsCard`, `needsReview`, `SEARCH_HINT`, `SKIP_SUBJECT`, `WITH_SUBJECT`, `hasRecipients`, `checkAnswers`, `isClean`, `problemText`. Their tests moved to the details card.
- Docs: quick start (3 lines of spec 7.4), editor guide, recipients help text in src/web/views/editor.ts line 784, smoke "Slice 15" in docs/ops/smoke.md.

## Acceptance criteria map (spec 13.9)

1. recipientFlows "every row has Insert ... (AC 1)", cards "puts the recipient hint ...", removed.test.ts.
2. flows "removes fields without a value with the gap rules, no card (AC 2)".
3. gaps.test "value order (AC 3)" (body and subject).
4. gaps.test "the 8 test pairs" and "left alone on purpose" (6 tests).
5. flows "a subject of fields without a value only ... (AC 5)"; gaps subject pair.
6. recipientFlows "equal rc ... (AC 6)", "a different or absent rc ... (AC 6)".
7. recipientFlows "... the event cannot read pushes the details card, no insert (AC 7)".
8. flows "opens with template.apply followUp, no getBody", "call log of one user path ... (AC 8)", "one template.apply without followUp, one apply event".
9. cards "details card (spec 7.4 Flow B)" (5 tests), flows "shows an input only for fields without a value", D24 switch tests.
10. flows "details Insert (spec 7.4 Flow C)" (blank removed, typed wins, resolved first name, shorten, version), recipientFlows "changed recipients under the open card".
11. recipientFlows "both switches off ... (AC 11)".
12. cards "lists a template once ...", home test (input without hint).
13. cards "puts the recipient hint, the fields hint and the path ...", folder card test (no path).
14. cards home, search, folder footers `filled`; scopes.test "sets the slate button color"; `npm run scopes:check`.
15. removed.test.ts (12 names and texts); `git diff --stat b2d6b2d..HEAD -- src/server` empty.
16. cards "side panel, entry inbox|message" and recipientFlows "side panel inbox|message ... (AC 16)". Smoke steps 1 to 13: not run (needs Gmail).

## Verified (clean `npm ci`, head of this branch)

- `npm run lint`: 0 problems. `npm run typecheck`: clean.
- `npm run test:coverage`: 67 files, 1817 tests passed; all files 97 % statements, 90.81 % branches.
- `npm run build -- --env dev`: Code.js 358.1 KB of 800, index.html 375.9 KB of 400.
- `npm run scopes:check`: 10 scopes, all approved. `npm run format:check`: clean.
- `npm run lighthouse`: every page 100.

## Deviations from the spec text

- Details Insert params: `id`, `version`, `values`, `rh`, `counted`; no `title` (the card takes the title from the apply result or the cached row).
- The card pushed by a row Insert carries `counted=1`: that row call already buffered the apply event, so the path counts once (AC 8).
- `replacesSubject(draftHasSubject)` takes one argument; the choice parameter had no caller left.
- AC 5 double space: `oneLine` collapses spaces in the subject (spec 5.6), so the double-space check runs on the body.
- `Rendered.missing` kept: tests read it; no src caller uses it now.

## Left for later

- Smoke "Slice 15" on dev; record steps 1, 3, 4, 10, 13 in this file or the review.
- Older smoke sections (Slice 9, 12) still name "Review"; they record past builds.
- Side panel Insert waits for spike S7 (ADR-0009 section 6).

## Risks

- Only Gmail shows: card closes after both Insert paths, label wrap or cut, `secondaryColor` honored, empty paragraph as a blank line.
- The slice 14 docs retry may edit docs/guide/user-quick-start.md and editor-guide.md: expect merge conflicts there.
- A sentence with a hole can be sent (owner accepted, ADR-0004 Amendment 2026-11-11).

## Files touched

src/shared/placeholders/render.ts; src/addon/flows.ts, prompts.ts, cards/{details.ts (new), folder.ts, home.ts, recipients.ts, spec.ts}; deleted cards/preview.ts, cards/prompt.ts; appsscript.json; src/web/views/editor.ts (1 string); test/unit/shared/gaps.test.ts (new); test/unit/addon/{cards, flows, recipientFlows, logic, render}.test.ts, fixtures.ts, removed.test.ts (new); test/unit/scripts/scopes.test.ts; docs/guide/user-quick-start.md, editor-guide.md; docs/ops/smoke.md.

## Commands

`npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build -- --env dev`, `npm run scopes:check`, `npm run format:check`, `npm run lighthouse`.
