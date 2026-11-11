# Handoff: architect to implementer, slice 15 (one-click insert, D31)

Date: 2026-11-11. Build after slice 14 merges. Status of the design: Proposed (ADR-0009; Amendments 2026-11-11 in ADR-0004 and ADR-0006; note in ADR-0007). The removal rule is the owner's decision of 2026-11-11.

## Read first

- docs/spec.md section 7.4 (cards, Flows A, B, C, states, texts, quick start lines, smoke "Slice 15").
- docs/spec.md section 13.9 (work list, 16 acceptance criteria).
- docs/adr/0004-placeholders-and-html-safety.md, "Amendment 2026-11-11": the 4 gap rules, 8 test pairs, the "left alone" list.
- docs/adr/0006-template-recipients.md, "Amendment 2026-11-11": `rc` count check, unknown-field push, risks.
- docs/adr/0009-compose-card-one-click.md: row, details card, home order, footer color, platform facts.
- docs/wireframes/01-sidebar-home.txt and 02-sidebar-prompt.txt (targets; as built at 2f6eae3).

## Decided behavior

1. Every compose row button reads "Insert" and inserts in one click. "Review" goes.
2. A field without a value takes its fallback, else empty text, then the 4 gap rules (body runs and subject).
3. An empty rendered subject sends no subject action (existing rule).
4. Recipients: spec 5.7 rules. The row button carries `rc` ("t,c,b"); a count different from `template.apply` pushes the details card with the change line, no insert.
5. A template address in an unknown draft field pushes the details card, no insert.
6. No notification after insert: `UpdateDraftActionResponse` cannot carry one. The card closes (S6 step 0).
7. Row tap opens the details card: `template.apply` `followUp: true` (no event), optional inputs, subject and recipient switches, recipient lines, preview, footer Insert plus "Edit in library".
8. Details Insert: one `template.apply` without `followUp`; `counted=1` on re-rendered cards sends `followUp: true`.
9. Home: Favorites, Recent minus Favorites, Folders. No search hint. Label: recipient hint, fields hint, path.
10. Footer "Open library": `FILLED` with #2a3c49. Manifest `addOns.common.layoutProperties.secondaryColor` "#2a3c49".

## Changed from the orchestrator's reading

- Marker `[Label]` dropped: owner chose removal. Cleanup rules added.
- "Result notification naming every address": not possible on the platform. Disclosure = row counts before, draft chips after.
- Row hint keeps counts (Q56), Bcc and outside addresses get no extra step (Q57).
- `rh` on rows replaced by the `rc` count check; the details card keeps `rh`.
- Prompt card and preview card merge; "Insert with subject" and "Insert body only" become switch states.

## Files this slice owns (slice 16 runs in parallel)

- src/addon/** (flows, cards, prompts, entry if needed), src/shared/placeholders/render.ts and its tests.
- appsscript.json (one key: `layoutProperties`; scope list unchanged).
- docs/guide/user-quick-start.md (3 lines of spec 7.4) and docs/guide/editor-guide.md.
- One string in src/web/views/editor.ts (line 778 at 2f6eae3): the recipients help text (spec 7.1, D31 bracket). Slice 16 does not touch the editor view.
- docs/ops/smoke.md: a new section "Slice 15" only.
- Do not touch src/server/**, src/shared/permissions/**, src/shared/model/**, the rest of src/web/**, the admin guide or the runbook (slice 16).

## Rules that hold

- No server change (`git diff --stat src/server` empty). No new scope. Never `setSendStatus`.
- No log line gets a value, a removed field or an address.
- Side panel (`inbox`, `message`): no Insert, no inputs, until spike S7.

## Smoke

Spec 7.4 steps 1 to 13. Record in the handoff to the reviewer: step 1 and 4 (card closes), 3 (label wraps or cuts), 10 (outlined button color), 13 (empty paragraph shows a blank line).

## Open questions (spec 15)

Q56 counts on the row; Q57 one click for Bcc and outside; Q58 footer kept, slate; Q59 no search hint; Q60 recipient hint first; Q61 details card open does not count a use. Defaults are the build.
