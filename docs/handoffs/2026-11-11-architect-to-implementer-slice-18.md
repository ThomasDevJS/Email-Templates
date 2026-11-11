# Handoff: architect to implementer, slice 18 (side-panel insert, D27)

Date: 2026-11-11. Spike S7 passed (docs/spikes/slice-10-s7.md). ADR-0007 Accepted 2026-11-11; the new questions Q67 to Q74 carry defaults that the slice builds.

## Read first

- docs/adr/0007-side-panel-insert.md, section "Acceptance 2026-11-11" (A1 to A10). Lines marked [S7] above it are history.
- docs/spec.md: 4.1a (flow), 7.2 (texts, notifications, quick start lines), 9 (scopes), 11 (`via` dropped), 13.11 (work, 16 criteria, test round part J), 15 Q67 to Q74.
- docs/wireframes/01-sidebar-home.txt and 02-sidebar-prompt.txt, side-panel sections.

## Decided

1. Rows: `inbox` "New email" (`STANDALONE_DRAFT`), `message` "Reply" (`REPLY_AS_DRAFT`), `compose` "Insert" unchanged. Callback `onCompose` {id, as, rc}.
2. Row tap: the details card for every entry, opened by `template.apply` `followUp: true`; `panelPreview` and the panel `template.getBody` call go.
3. Panel details card: compose inputs, "Add recipients", no subject switch, no finish-typing line, signature line, new hint last. Footer `message`: "Reply" + "Reply all", then a ButtonSet "New email", "Edit in library". Footer `inbox`: "New email" + "Edit in library". Callback `onPromptCompose` {id, as, version, values, rh}; no `counted`.
4. Order in both callbacks: `as` check, message ID check, 500-character check (details), `setCurrentMessageAccessToken`, message read (Reply, Reply all), one `template.apply`, `rc` or `version` and `rh` checks, render as compose, one Gmail call, `ComposeActionResponse`.
5. Recipients: computed draft of ADR-0007 A4. `cc`, `bcc` options only when not empty. Reply all passes only new template Cc (S7: Gmail adds).
6. First name: Reply only, from reply-to else From, sent as `recipientEmailIfInternal` when internal. New email and Reply all send "".
7. Every refusal is a notification (texts in spec 7.2). One catch around each panel callback; it knows whether a draft exists.
8. Hint text: "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar."
9. Remove the S7 harness (A10). Reply kinds `s7`, `s7Error` become one kind `compose`.

## Files you own

src/addon/** and tests; docs/guide/user-quick-start.md (new section "Use the side panel" and one known-limits line, text in spec 7.2); docs/ops/smoke.md (new section "Slice 18"; section "Spike S7" becomes one pointer line to docs/spikes/slice-10-s7.md); docs/ops/test-round-1.md (new part J only, text in spec 13.11).

Not yours: src/server/**, src/shared/model/protocol.ts, appsscript.json (no trigger or scope changes). Criterion 14 checks it with `git diff --stat`.

## Watch

- Ports gain a Gmail port (`setCurrentMessageAccessToken`, `createDraft`, `getMessageById`) so tests use a recording fake; reuse the `S7Gmail` type shape.
- Header strings (`getTo`, `getCc`, `getFrom`, `getReplyTo`) carry display names; extract addresses with one regex per string, test `"Doe, Ann" <ann@x>`.
- `recipientWidgets` needs a way to skip the finish-typing line in the panel; `FIRST_NAME_HINT` gets a panel variant.
- No address, value, subject or message ID may reach a log, a cache key or card parameters.
- Unverified until part J: compose action on `DecoratedText` and `FixedFooter` buttons (Q74), form inputs in a compose callback (Q68), the header reads under `message.metadata` (A7). Fallbacks are in spec 15; do not build them now.

## For the orchestrator, not the implementer

- Test round part H step 2 and 3 name the removed harness. Part J steps 13 and 14 (by hand) replace them; part H needs one pointer line.
- docs/design/wording.md: add "New email", "Reply", "Reply all" (Gmail's own words for the panel actions) to the verb table.
- PLAN: slice 18 in the slice list; Q67 to Q74 to the owner list.

## Result expected

Review PASS on all 16 criteria of spec 13.11; dev deploy; part J run by the browser agent with steps 5, 6, 7, 10 recorded in the review handoff.
