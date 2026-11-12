# Handoff: implementer to reviewer, slice 18 (side-panel insert, D27)

Date: 2026-11-11. Branch `slice/18-side-panel` from `claude/gracious-franklin-3n8zbq` at 702df60. Not pushed, not merged, not deployed.

## Done

- Side-panel rows: "New email" (`inbox`, `STANDALONE_DRAFT`) or "Reply" (`message`, `REPLY_AS_DRAFT`), filled slate, `onCompose {id, as, rc?}`. Compose rows unchanged.
- Row tap: `template.apply` `followUp: true` on every entry; `panelPreview` and the panel `template.getBody` call are gone.
- Panel details card (`panelDetailsCard(state, entry)`): compose inputs, reply first-name hint (`message` only), "Add recipients", no subject switch, no finish-typing line, To line (`message` with a template To), signature line, preview, button section, hint last. Footer `message`: Reply + Reply all, section New email + Edit in library; `inbox`: New email + Edit in library. `onPromptCompose {id, as, version, values, rh}`.
- src/addon/panel.ts: `composeFlow`, `promptComposeFlow`, `failureText`, `panelVisible` (the one catch). Order: `as`, message ID, 500 characters (details), token, message read, one `template.apply`, `rc` or `version`/`rh`, `rendered`, one Gmail call.
- One render function `rendered(body, input)` in flows.ts serves `insertFlow`, `promptInsertFlow` and both panel flows.
- `Ports.gmail` (`GmailPort` = Pick of GmailApp, the S7 shape; a getter in entry.ts). event.ts: `tokenOf`, `addressesOf` (one regex per header), `internalAddress`.
- S7 harness removed: spikeS7.ts, its 2 test files, `onS7*`, Reply kinds `s7`/`s7Error` (now `compose`), the home section. test/fakes/gmail.ts is permanent now (headers, null message, throw per method).
- Docs: quick start "Use the side panel" + forwarding limit; smoke "Spike S7" pointer + "Slice 18" (2 owner checks); test round part G one line, part J 12 steps + table; wording.md verb row + 14 new texts.

## Criteria map (spec 13.11)

| AC | Proof |
|---|---|
| 1, 2 | cards.test "side panel, entry inbox/message"; recipientFlows "side panel rows ... rc"; addon.test setComposeAction; slice 15 compose row tests unchanged |
| 3 | panel.test "New email from a row"; addon.test "New email: token first" |
| 4 | panel.test "Reply from a row" (2 tests) |
| 5 | panel.test "Reply all"; entryOf.test `addressesOf` with `"Doe, Ann"` |
| 6 | panel.test "rendering": T2, same HTML and subject on compose and panel paths, blocked addresses |
| 7 | panel.test "row counts" |
| 8 | cards.test "side panel details card"; recipientFlows "side panel %s"; panel.test "opening the card counts no use" |
| 9 | panel.test "details card press" |
| 10 | panel.test "server failures" (DENIED, NOT_FOUND real server; 9 codes) |
| 11 | panel.test "refused before the server" |
| 12 | panel.test "no uncaught exception" (throw per step); addon.test 3 throw tests |
| 13 | cards.test hint tests; "compose entry keeps Insert" |
| 14 | removed.test "removed in slice 18" (grep, file, manifest 10 scopes + 3 triggers); build; protected diff empty |
| 15 | panel.test "server arguments and logs" (arg keys, no value in `world.lines`, draft 5 keys) |
| 16 | Not run: part J needs Gmail |

## Only Gmail can show (part J)

- Q74: step 2 (row compose button on `DecoratedText`), step 5 (footer compose button on `FixedFooter`). Fallback: `rowButton` in cards/folder.ts returns no button for the panel; `panelDetailsCard` puts every action in the button section (one line each).
- Q68: step 5 (typed values arrive), step 6 (switch off followed), step 9 (Bcc present: the switch's default "on" reached the callback; if form inputs are lost, Add recipients reads off and nothing is added). Fallback: drop `fieldsSection` and the toggle in `panelDetailsCard`; `promptComposeFlow` uses answers {} and add = true.
- A7: steps 7 and 9, `getReplyTo`, `getFrom`, `getTo`, `getCc` under `message.metadata`. Any throw now gives "This email can no longer be read..." (spec AC 11); the ADR A7 fallback ("" and nothing present) is not built.
- Q69: step 10, 1 or 2 drafts.

## Left for later

- docs/ops/smoke.md "Slice 15" step 12 still describes the old panel (no Insert, old hint). Outside my sections.
- test-round-1 part H steps 2 and 3 name the removed harness; smoke "Slice 18" checks 1 and 2 replace them (orchestrator).
- Rule 2 of test-round-1 lost its part G exception sentence (part G is gone).
- The server DENIED message reads "this" ("You don't have access to this. Ask a folder manager."); the panel maps it to the spec 7.2 template text, the personal-off text passes through.
- NOT_CONFIGURED notification ends "then press Retry." (state card lines, as spec 7.2 says) with no Retry button.

## Risks

- `requireAddonSession` stays outside the catch: a wrong-user call still throws (security refusal, as before).
- `internalAddress` trims before the domain check; compose `internalRecipient` now accepts " bob@x " too.
- index.html 379.2 KB of 400 KB (unchanged by this slice).

## Files touched

src/addon/{entry,event,flows,panel}.ts, src/addon/cards/{details,folder,home,recipients,render,sidePanel,spec}.ts, src/entry.ts, src/shared/entryPoints.ts; deleted src/addon/spikeS7.ts, test/unit/addon/spikeS7*.test.ts; test/fakes/gmail.ts; test/unit/addon/{addon,cards,entryOf,flows,panel,recipientFlows,removed}.test.ts; docs/guide/user-quick-start.md, docs/ops/{smoke,test-round-1}.md, docs/design/wording.md.

## Commands (clean install)

- `rm -rf node_modules && npm ci`: added 559 packages.
- `npm run lint`, `npm run typecheck`: no output, exit 0.
- `npm run test:coverage`: 67 files, 1911 tests passed; all files 97.12 % statements, 90.87 % branches.
- `npm run build -- --env dev`: Code.js 367.1 KB of 800 KB, index.html 379.2 KB of 400 KB.
- `npm run scopes:check`: 10 scopes, all approved. `npm run format:check`: clean.
- `git diff --stat 702df60 -- src/server src/shared/permissions src/shared/model src/web scripts/lib/html.mjs appsscript.json package.json package-lock.json`: empty. Lighthouse not run (no web file changed).

## Follow-up 1 (2026-11-11): silent failures in the side panel

Merged `claude/gracious-franklin-3n8zbq` (85e41f0) first.

- Before: `onCompose` and `onPromptCompose` returned an `ActionResponse` with `setNotification(<sentence>)` for every refusal (NOT_FOUND, DENIED, QUOTA, BUSY, unreadable email, no message ID, 500 characters, version, `rh`, `rc`). A throw became the same notification ("... Details for your admin: <error message>"). Part J step 11: Gmail showed none of it.
- Now: `panelAnswer` (src/addon/panel.ts) throws `new Error(<sentence>)` for every refusal. A throw before a draft exists becomes "Something went wrong. Try again."; a throw while building the response after a draft exists becomes the Drafts sentence. The caught error's text is dropped. Request IDs and "Details for your admin" are gone from panel texts. No draft is created on failure.
- Chosen (a). Reason: a thrown error is the one answer an add-on callback always produces; the notification was shown for a `ButtonSet` compose button (S7 result 5) and not for a `DecoratedText` row (step 11). Unverified: how Gmail shows a thrown error from a compose action (the banner look, any prefix such as "Exception:", whether the footer button acts the same). Part J step 11 now records it.
- Not built (b): reloading the list when the panel opens adds one `sidebar.home` per message opened (`onMessageOpen` fires on each), and it would not have caught step 11 (the template was deleted after the folder card loaded). NOT_FOUND and DENIED still clear the cached view.
- Side effect: each refusal is now a failed run in Executions and, with `exceptionLogging: STACKDRIVER`, an error log entry holding the sentence only.
- Tests: panel.test "every failure throws one plain sentence" (NOT_FOUND, DENIED, QUOTA, unreadable email, a throw at the token, `createDraft`, `createDraftReply`, `createDraftReplyAll`, a broken server port, a render throw after the draft; 0 `createDraft*` calls except the failed one; no `@`, request ID, Gmail text, subject or stack line; every sentence is in docs/design/wording.md). addon.test: 4 entry tests expect the throw, one is step 11.
- Docs: part J step 11 records what Gmail shows; docs/spikes/slice-10-s7.md "Part J run, 2026-11-11" (Q68, Q74 settled, header reads ran).
- For the architect: in the reply of part J step 7 the tester saw no quoted earlier message ("..." not seen); S7 step 2 saw a trimmed-quote marker. Unconfirmed; the owner checks by hand.
- Files: src/addon/{panel,entry}.ts; test/unit/addon/{panel,addon}.test.ts; docs/design/wording.md, docs/ops/test-round-1.md, docs/spikes/slice-10-s7.md.

## Follow-up 2 (2026-11-11): Reply and Reply all on rows (D33)

Merged `claude/gracious-franklin-3n8zbq` (97595c6) first.

- Row layout, email open: the `DecoratedText` (icon, title, hint line, tap opens the details card) with no button, then a `ButtonSet` right under it: "Reply" (filled slate) and "Reply all" (outlined), both compose actions `REPLY_AS_DRAFT`, `onCompose {id, as: reply|replyAll, rc?}`. No email open: unchanged, "New email" in the row. Compose: unchanged, "Insert". The details card keeps its footer.
- Code: cards/folder.ts `rowButtons` (1 or 2 buttons), `templateItem` returns 1 or 2 widgets, `listSection` takes rows and collapses after 5 whole rows (10 widgets with a message open). No render change: the `buttons` widget already renders a `ButtonSet`. `composeFlow` already handled `replyAll` (no first name, new Cc only).
- Widget counts with an email open (2 per row): Favorites 10 rows = 20, Recent 5 rows = 10, a folder page of 20 = 40 (pager in its own section), search results 20 = 40. Home with 10 favorites, 5 recent and 30 folders = 62 widgets on the card; the largest section holds 40. Every section stays under 100; no page was shortened.
- Tests: cards.test row widgets for compose, inbox, message (both actions, template ID, `rc`); per-card widget counts; collapse of 2-widget rows. addon.test 3 compose actions rendered. panel.test row "Reply all".
- Docs: quick start one line; part J step 13 (row "Reply all", records layout and readability); smoke Slice 18 now "steps 1 to 13". No new text for wording.md ("Reply all" is listed).
- Erratum for the architect: docs/wireframes/01-sidebar-home.txt "Message open" shows one [Reply] per row; it now has a row of (Reply) [Reply all] under each title.
- Unverified in Gmail: how a `ButtonSet` right under a `DecoratedText` looks in the 300 px panel, and whether a collapsed section that cuts at 10 widgets reads well (part J step 13).
