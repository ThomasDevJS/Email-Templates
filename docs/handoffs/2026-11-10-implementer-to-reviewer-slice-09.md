# Handoff: implementer to reviewer, slice 9 (template recipients, D26)

Branch `slice/09-recipients`, base `6c7afc1`, 4 commits (8d12e62, 8f0e4d3, c2bf572, c0c8cbf). Not merged, not pushed.

## Done

Spec 13.6 items 2 to 5, 7, 8 and the S6 harness removal. Item 6 (editor fields, History line, library address search) is slice 8b.

1. Shared `validateRecipients` (src/shared/model/recipients.ts): syntax of spec 5.7, 10 per field, 20 together, 254 characters, trim, lower case, repeats in one field dropped, `RCPT_FORMAT`, `RCPT_TOO_LONG`, `RCPT_TOO_MANY`, `RCPT_DUPLICATE`, `RCPT_EXTERNAL` with the spec 7.1 texts, `field` and 1-based `position`. Also `importRecipients` (drop rule), `splitBlocked` (`deny` view), `recipientsOf` (absent reads as `[]`), `externalRule`.
2. Data: `to`, `cc`, `bcc` optional on `Item` and `BodyFile` (additive, the web builds unchanged; `index.html` is byte-identical to the base build). `prepareBody` takes the lists and merges recipient problems into the one VALIDATION `details.problems`. Write paths: create, update, duplicate, restore (from version K's file), import (drop and report), export `meta`. Shape check accepts absence, refuses a present non-list. Old data reads as `[]` with no write. Audit `before`/`after` carry the lists.
3. Server ops: `template.apply` and `template.getBody` return `to`, `cc`, `bcc`, `blocked` on every call. `sidebar.home` and `search` rows carry `rc: [to, cc, bcc]` counts (after `deny`; absent when 0). `me` and `config.get` return `recipientsExternal`. `version.get` returns the version's lists. No new op, no policy row change.
4. Add-on: `recipientPlan` and `recipientActions` in src/addon/cards/recipients.ts; `draftRecipients(event)` in event.ts; recipient actions in `insertResponse`; Review rows; preview card "Recipients" section; prompt card switch `rcpt`; `rh` check; `Ports.hash`.
5. S6 harness removed (src/addon/spikeS6.ts, `onS6Card`, `onS6Apply`, Reply kind `s6`, home section, 2 test files, smoke section). Record: docs/spikes/slice-09-s6.md. S7 harness untouched.
6. docs/ops/smoke.md "Slice 9" (9 steps), one paragraph each in docs/guide/user-quick-start.md and docs/guide/editor-guide.md.

## Truth table as built (REPLACE semantics, spike S6)

| Template address | Draft To empty | Draft To filled |
|---|---|---|
| To | added | not added, "The draft already has a To recipient." |
| Cc, Bcc | added | added |
| already in any draft field (trimmed, lower case, inside `<...>`) | not added, "It is already in the draft." | same |
| `blocked` (`deny`) | never added, "Outside <domain>, turned off by your admin." | same |

Each action carries the draft's list from the tap's event, then the added addresses. A field with nothing added gets no action. "Insert body only" and the switch off send no recipient action. Never `setSendStatus`.

## Decisions to check

- `template.update` keeps the stored list of any of `to`, `cc`, `bcc` left out of the args, so the current editor (no fields until 8b) does not wipe them. Under `deny` a template holding outside addresses then fails its next save with `RCPT_EXTERNAL` (spec 5.7).
- Review button: `onPreview` without prompts, `onInsert` with prompts (prompt card shows the switch with every address Insert adds).
- Disclosure at insert time, independent of the cached view: an Insert without `rh` whose lists are not empty shows the preview card in place of the insert (a view cached before the template gained recipients). With `rh` and other lists: the card is updated with the change line; the draft is not touched.
- The prompt card carries `rh` unless opened by "Insert body only"; no `rh` means no recipients. `subject=skip` keeps its old meaning (no subject switch).
- Import: `RCPT_TOO_MANY` refuses the file: "Nothing was imported: the template <label>: <text>". Dropped addresses give one report line per template, outcome `imported` (new `Outcome` value), reason with counts per cause, never an address; `ImportReport.addressesDropped` totals them.
- `rc` counts and the `deny` filter read `DOMAIN` and `RECIPIENTS_EXTERNAL` from the request's property snapshot: warm `sidebar.home`, `search`, `template.apply` stay at props 1, drive 0 (entry.test.ts unchanged and green).

## Setting recipients for the smoke run (orchestrator)

Web app `/dev` URL, signed in as the owner, browser console on the app page:

```js
google.script.run.withSuccessHandler(console.log).rpc("template.create", {
  folderId: "<shared folder ID>",
  title: "Smoke 9 recipients",
  subject: "Smoke 9",
  html: "<p>Hello</p>",
  to: ["s9-to@migway.com"],
  cc: ["s9-cc@migway.com", "s9-outside@example.com"],
  bcc: ["s9-bcc@migway.com"],
}, "SMOKE009-000001");
```

Op `template.create` (level edit on `folderId`), args `folderId`, `title`, `subject`, `html`, `tags` (optional), `to`, `cc`, `bcc` (string arrays). To change an existing template: op `template.update`, args `id`, `baseVersion` (its `currentVersion`), `title`, `subject`, `html` (send the current values: a missing `html` saves an empty body), and the lists to change. The request ID must match `^[0-9A-Z]{8}-[0-9A-Z]{6}$`. "Smoke 9 plain" is a normal template made in the editor.

## Verified

From a clean install (`rm -rf node_modules && npm ci`):
- `npm run lint`: clean. `npm run typecheck`: clean.
- `npm run test:coverage`: 60 files, 1391 tests passed; all files 95.66% statements, 89.56% branches, 94.8% functions, 96.58% lines.
- `npm run build -- --env dev`: Code.js 345.5 KB of 800 KB (base 335.7 KB), index.html 340.6 KB of 400 KB (unchanged, byte-identical to the base build).
- `npm run scopes:check`: 10 scopes, all approved. `npm run format:check`: clean.
- `npm run lighthouse`: 100 on all 11 views.
- New tests: test/unit/shared/recipients.test.ts (32), test/unit/server/recipients.test.ts (17), test/unit/addon/recipients.test.ts (15, truth table, case, other field, empty and missing list), test/unit/addon/recipientFlows.test.ts (14, real server), render test for the 3 recipient actions.

## Left for later

- Slice 8b: editor fields with chips and outside marker, History recipients line, library address search (Q39), Config row text (8c).
- `domain` in the add-on markers is the caller's domain; the server's `blocked` uses `DOMAIN`. Equal for every allowed caller.
- Spike S6 step 7 (fresh consent) still open, by hand.
- Gmail panel pass: side-panel insert reuses `recipientActions` and `rh`.

## Risks

- Text typed in a recipient field that is not yet a chip is not in the event and a replace drops it. The quick start says so; the card does not.
- Not verified on Gmail: the built code. Smoke "Slice 9" covers it.

## Files touched

src/shared/model/{recipients,data,shape,sidebar}.ts, src/shared/body/prepare.ts, src/shared/entryPoints.ts, src/server/dispatch/args.ts, src/server/handlers/{body,config,history,identity,sidebar,templates,transfer}.ts, src/server/transfer/{format,plan}.ts, src/addon/{entry,event,flows}.ts, src/addon/cards/{recipients,folder,preview,prompt,render,spec,home}.ts, src/entry.ts; deleted src/addon/spikeS6.ts, test/unit/addon/spikeS6*.test.ts; tests above plus updates in addon.test, cards.test, flows.test, render.test, spikeS7Dev.test, server history.test, sidebar.test; docs/ops/smoke.md, docs/guide/user-quick-start.md, docs/guide/editor-guide.md, docs/spikes/slice-09-s6.md.

## Commands

```
git checkout slice/09-recipients
rm -rf node_modules && npm ci
npm run lint && npm run typecheck && npm run test:coverage
npm run build -- --env dev && npm run scopes:check && npm run format:check && npm run lighthouse
```

## Retry 1 (2026-11-11, review docs/reviews/slice-09.md, FAIL at 441ab04)

Commits f0db88a (item 4), 5d75b43 (items 1 to 3), plus this docs commit.

1. Unknown draft lists. `draftRecipients` (src/addon/event.ts) returns per field a list or `null`. The first source holding the key (`draftMetadata`, then `gmail`) decides; an array of strings, empty included, is known; a missing key, null, a string, an object or an array with a non-string entry is unknown. `recipientActions` (src/addon/cards/recipients.ts) never sends an action for an unknown field. An unknown To counts as filled. `recipientPlan` gains `unknown` (template addresses per unknown field). The cards say: "The draft's Cc recipients could not be read and were not changed. Add by hand: <addresses>." The old tests are replaced by 15 cases (5 bad values x To, Cc, Bcc), unknown To, all 3 unknown (`insertReply` then holds body and subject only), and a real-server flow with an unreadable Cc. The side panel preview (no draft, no insert) lists the addresses as for an empty draft.
2. Prompt card disclosure. `switchLabel` is removed. The prompt card shows the "Add recipients" switch (bottom label "Adds n recipients.", only when Insert adds one), then `recipientWidgets`, the same function the preview card uses: field, "outside <domain>", "hidden from other recipients", "Not added" with the reason, `blocked`, unknown fields.
3. Finish typing. `recipientWidgets` ends with "Finish typing addresses in the draft first: an address still being typed is lost." whenever Insert adds an address, so both cards show it.
4. Version file lists. `isStoredList` (shared, also used by the index shape check) and `unreadableRecipients`. `recipientsOf` reads a list that fails the rule as `[]`, no write. `version.restore` returns `recipientsUnreadable: ["cc", ...]` with the item. Test: a version file with `cc: "x@y.zz"` and `bcc: [1]`: `version.get` gives `[]`, restore succeeds and names both.

Truth table as built:

| Template address | Draft To empty | Draft To filled | Draft field unknown |
|---|---|---|---|
| To | added | not added, "The draft already has a To recipient." | not added, add by hand |
| Cc, Bcc | added | added | not added, add by hand |
| already in a known draft field (any case, inside `<...>`) | not added, "It is already in the draft." | same | same |
| `blocked` (`deny`) | never added | never added | never added |

For the architect (spec 7.1 erratum, not edited here): the prompt card switch bottom label is now "Adds 2 recipients.", followed by the preview card's recipient lines. Spec 7.1 also needs the unknown-field text "The draft's <Field> recipients could not be read and were not changed. Add by hand: <addresses>." and the line "Finish typing addresses in the draft first: an address still being typed is lost." Spec 5.7's truth table needs the "Draft field unknown" column.

Left for later: the `prof:` cache key holding an internal recipient's address (last fix round). Smoke "Slice 9" now says the console must target the app's inner frame `userHtmlFrame`.

Checks from a clean install: see the report of this retry.
