# Handoff: architect to orchestrator, errata run 4

Date: 2026-11-11. Branch `claude/gracious-franklin-3n8zbq`, base 6374b7b. Commits 85de724 (spec), 7d9c91a (ADRs), e3cf0a6 (wireframes), plus this commit. Not pushed.

## Done

- Spec, ADRs and wireframes describe the code at 6374b7b for slices 8a to 8d and 9 to 13. Slice 14 (wording pass) is listed as in build; sections 7 to 7.3 follow its result.
- ADR-0006 Accepted 2026-11-11 with the spike S6 facts and an "As built" section.
- ADR-0008 Accepted 2026-11-11 with an "As built" section; its D29 amendments in ADR-0002, ADR-0003, ADR-0006 marked Accepted with it.
- ADR-0002 and ADR-0003: new "Amendment 2026-11-11 (errata run 4)", Proposed: export start event plus run token (3 options compared), buffer slot reuse, log `targetId`, `prof:` hash.
- ADR-0007 stays Proposed; decision unchanged. Added "Built so far" (slice 10, 12) and fixed 3 stale facts.
- Spec 13 slice map: rows for 8a, 8b, 8c, 8d, 9, 10, 11, 12, 13 as built and 14 in build. Spec 14 S6 row: passed. New Q53, Q54, Q55.

## Verified (grep in src at 6374b7b, not only the handoffs)

- `config.set` args `name, value, baseAt, baseBy`; `from` answers "This page is out of date..."; `NAME_ECHO_MAX` 40; `liveSettingsKept: true` (src/server/handlers/config.ts).
- `settingsOf` fills defaults; `readIndexDoc` leaves `settings` alone. No `RECIPIENTS_EXTERNAL` in src.
- Off rule before the admin rule; `admin.folders` keeps `manage` folders only; `grant.*` row needs `manage`.
- Export: `EXPORT_RUN_TTL_S` 600, `exp:<token>`, `readStoredBody(..., false)`, start through `commit` (transfer.ts).
- Buffer `slotFor`: evicted slot, then denied slot for an apply; `evt:lost` "<lost> <seen>" (audit/buffer.ts).
- `prof:<sha256>` (directory/profile.ts); log `targetId` falls back to `stats.target` (dispatch/handle.ts).
- `trash.purge` result has `templates`, `folders`; `template.list` carries `recipientsOf`; `recheckRecipients` in 4 handlers.
- Add-on: `draftRecipients` null state, `recipientActions` draft list plus new, `recipientWidgets` texts, slice 12 state texts, `TOOLBAR_HINT`, `ECHO_MAX` 60, `QUOTA_WAIT_MS` 60 s.
- Web: blank names `Field: ...` (schema.ts), Backspace removes the last chip, leave-dialog texts, New template folder choice, trash question texts.
- Slice 12 handoff says the QUOTA notification reads "30 seconds"; code counts down the remaining seconds of a 60 s wait ("Try again in <n> seconds"). Spec 7 says the latter.

## Left

- Sections 7 to 7.3 and wireframes 01, 02, 07 need one more pass after slice 14 merges.
- Wireframe 03 and 05 keep their old layout; 03 now points to docs/design/screens/8a. 05 not checked against 8a.
- Web NOT_CONFIGURED shows the server text "Migway Templates is not set up. The owner runs setup once."; the sidebar text differs. Slice 14 may align them.
- ADR-0001, 0004, 0005 not touched (no erratum named or found by grep).

## Risks

- Spec header and ADRs name the owner's address as "Deciders"; already there before this run, public repo (D30 says the owner accepts it).
- Q55: S6 step 7 (fresh consent) never ran; a consent prompt there would stop D26 after the fact.
- The trailer in the commits names a model, as the orchestrator's prompt asked.

## Files touched

docs/spec.md; docs/adr/0002-storage.md, 0003-identity-and-permissions.md, 0006-template-recipients.md, 0007-side-panel-insert.md, 0008-admin-settings.md; docs/wireframes/01-sidebar-home.txt, 02-sidebar-prompt.txt, 03-web-library.txt, 04-web-editor.txt, 06-web-admin.txt, 07-states.txt; .claude/agent-memory/architect/MEMORY.md; this file.

## Commands

```
git log --oneline 6374b7b..HEAD
git diff --stat 6374b7b HEAD
grep -rn "RECIPIENTS_EXTERNAL" src            # no hit
grep -n "baseAt\|NAME_ECHO_MAX\|liveSettingsKept" src/server/handlers/config.ts
grep -n "EXPORT_RUN_TTL_S\|exp:" src/server/handlers/transfer.ts
grep -c "—\|–" docs/spec.md docs/adr/*.md docs/wireframes/*   # all 0
```
