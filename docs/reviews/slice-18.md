# Review: slice 18 (side-panel New email, Reply, Reply all; D27, ADR-0007)

Date: 2026-11-11. Branch `slice/18-side-panel`, head 504b0ee (implementer 6afcc97 plus main 699b02d). Slice diff `702df60..6afcc97`.

## Verdict: PASS (first review); Follow-up 1: PASS; Follow-up 2: PASS (see the sections at the end)

No path creates a draft before `template.apply` succeeds. No path sends mail. A reply never gets a To. No message data reaches a log, a cache or a lasting action parameter. 0 must-fix, 7 minors.

## Commands (clean install on 504b0ee, run by the reviewer)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, 559 packages, npm audit 16 (14 moderate, 2 high; same as earlier slices) |
| `npm run lint` | exit 0, no output |
| `npm run typecheck` | exit 0, no output |
| `npm run test:coverage` | 67 files, 1911 tests passed, 0 failed; all files 97.12 statements, 90.87 branches; addon 98.55, addon/cards 100 |
| `npm run build -- --env dev` | "Built dev 504b0ee", Code.js 367.1 KB of 800 KB, index.html 379.2 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |

Merge: `git diff 6afcc97 504b0ee` = PLAN.md and test-round-1.md (3 lines, part C results). `git patch-id` of `src test` is equal for `702df60..6afcc97` and `699b02d..504b0ee`.

## Probes

Scratch copy of 504b0ee (git archive, node_modules linked), 2 probe files, 22 cases on the real server (`setupWorld`) and the recording Gmail fake. Copy deleted after.

1. Same pipeline. 6 templates (plain with link, fields with default text, fields without default, To/Cc/Bcc, recipient first name, `\{{` escape), sender name `Ana <script>alert(1)</script> & "Co"`: panel `createDraft` subject and `htmlBody` equal the compose `insertFlow` output byte for byte, 6 of 6. Reply from `Bob X <BOB@EXAMPLE.COM>` equals compose Insert into a draft with To bob: `<p>Hi Bob</p>`. `\{{x}}` renders as `{{x}}`; markup escaped in the body, plain in the subject.
2. Tampering. A forged `values` parameter and a typed answer, each with `<script>`, `<img onerror>` and `\r\nBcc: evil@...`: subject one line (CR LF become spaces), body escaped, To "". Extra parameters `to`, `cc`, `subject`, `messageId` are ignored; `getMessageById` gets the event's ID. A template of the owner's private folder: DENIED text for `new`, `reply`, `replyAll`, 0 drafts. IDs "", `../x`, 5,000 characters, `<script>`: notification, 0 drafts. Stored To `a@x\r\nBcc: e@x`, `a, b`, `Name <a@x>`: refused at save.
3. Failures. DENIED, NOT_FOUND, QUOTA, BUSY, INTERNAL, NETWORK, AUTH_DOMAIN x 3 actions = 21 runs, 0 `createDraft*`. Gmail calls on a failed Reply: token, `getMessageById`, `getReplyTo`, `getFrom` (4, all reads). Null message, `getFrom` throws, `getCc` throws (Reply all), every header null: UNREADABLE, 0 server calls, 0 drafts. `grep sendEmail|.send(|setSendStatus|sendMail` in src and dist/Code.js: 1 hit, a comment "Never `setSendStatus`" (render.ts:152).
4. Recipients. Reply: `"Bob, B." <  BOB@EXAMPLE.COM >` and ` bob@example.com ` drop the template Cc bob; template To never in any argument. Reply all: template Bcc equal to a message Cc (display-name form) dropped. `undisclosed-recipients:;` and `garbage <<>> @@` give no address, no throw. Setting `deny`: no outside address on new, reply, reply all, details reply. Switch off on a reply: `["", {htmlBody}]`.
5. First name. `recipientEmailIfInternal`: new "", reply internal From "bob@example.com", reply-to outside "" (name falls back), outside From with internal reply-to "bob@example.com", reply all "".
6. Privacy, 10 presses (row and details, 3 actions), secrets in From, To, Cc, message ID, token, typed value, subject: 0 hits in 16 log lines, the User Cache and the Script Cache. Log line keys: action, actor, targetId, result, timing, calls. Details card parameters: `id, version, values, rh, as` (values = sender fields only). No `getBody`, `getPlainBody`, `getRawContent`, `getSubject`, `getThread` in src/addon.
7. Use counting. 10 presses = 10 apply events. Opening details cards: 0. `createDraft` throwing after the apply: 1 counted.
8. Entry. Details card from message A pressed with event message B: `getMessageById("B-other")` (ID read at press time, never stored in the card). Message closed, compose event with `as: reply`, blank ID: NO_MESSAGE, 0 Gmail calls. Compose tests pass unchanged (rows Insert, details, `rc`).

## Criteria (spec 13.11)

| AC | Proof | Own probe |
|---|---|---|
| 1, 2 | cards.test, recipientFlows, addon.test | - |
| 3 | panel.test "New email from a row" | probe 1 |
| 4 | panel.test "Reply from a row" | probes 4, 5 |
| 5 | panel.test "Reply all" | probes 4, 5 |
| 6 | panel.test "rendering" | probe 1 |
| 7 | panel.test "row counts" | probe 2 (rc mismatch seen) |
| 8 | cards.test, panel.test | probe 7, card dump |
| 9 | panel.test "details card press" | probes 2, 4 |
| 10 | panel.test "server failures" | probe 3 |
| 11 | panel.test "refused before the server" | probes 3, 8 |
| 12 | panel.test "no uncaught exception" | probe 3 |
| 13 | cards.test hint tests | card dump: inbox and message end with TOOLBAR_HINT, compose none |
| 14 | removed.test, build | grep `spikeS7|onS7|s7Error|Spike S7` in src and dist: 0; manifest diff empty; 10 scopes; no `https://mail.google.com/` in dist/appsscript.json |
| 15 | panel.test "server arguments and logs" | probe 6 |
| 16 | part J, not run | Gmail only |

Protected paths: `git diff --stat 702df60..6afcc97 -- src/server src/shared/permissions src/shared/model src/web appsscript.json package.json package-lock.json` is empty.

Secrets: no key, token or secret pattern in added lines. Addresses: example.com, outside.example, x.org and `a@`/`c@` of the company domain in test fixtures (already in base docs). No hours-of-service example.

## Minors

1. Reply-To with 2 addresses: panel.ts:147 takes the last one only. Gmail replies to both; the first can get a template Cc again and the first name comes from the second. Fix: dedupe against every reply-to address, name only when exactly one.
2. Details card, entry `message`: "Adds n recipients." counts the template To (plan against an empty draft, flows.ts:321), but Reply adds no To. The To line under it explains. Fix later: count Cc and Bcc only on the message entry.
3. Header reads (`getMessageById`, `getReplyTo`, `getFrom`, `getTo`, `getCc`) run before the permission check. Spec 4.1a step 5 orders it so; reads only, nothing leaves the add-on.
4. Handoff does not state that a failed `createDraft*` after the apply still counts one use (probe 7). Accepted: spec 4.1a step 8 counts every press that reaches `template.apply`.
5. NOT_CONFIGURED notification ends "then press Retry." with no Retry button (handoff names it).
6. Part J steps 13 and 14 (by hand) went to smoke "Slice 18" in place of part J as spec 13.11 says. Content equal; acceptable.
7. Part J step 10 has no "Expect:" (spec text the same). Replacement: "10. Same message. Double-click the row "Reply" on "T1 plain". Expect: 1 or 2 reply drafts in the conversation, no error. Record: how many reply drafts opened (1 or 2). Discard all."

## Leftover doc text (for the orchestrator)

- docs/ops/smoke.md, "Slice 15" step 12, replace with: "12. Side panel, no email open: each row shows "New email", no Insert; tapping a name opens the details card with boxes, "New email" in the footer and no "Replace the subject" switch; "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar." ends the card."
- docs/ops/test-round-1.md, part H step 2, replace with: "2. Fresh consent for the side panel. "Remove access" again. Side panel, inbox, no message open: open the add-on, row "New email" on "T1 plain". Expect: either no prompt, or a consent page; accept it. Record the same three things. Discard the draft."
- docs/ops/test-round-1.md, part H step 3, replace with: "3. Apps Script editor, "Executions": the duration of each `onCompose` run of part J steps 2 to 4. Expect: one run per press. Write each duration into the part J notes."

## Only Gmail can show (part J and smoke "Slice 18")

- Q74: a compose action on a `DecoratedText` row button and a `FixedFooter` button (steps 2, 5).
- Q68: form inputs and the switch in a compose-action callback (steps 5, 6, 9). If lost, Add recipients reads off and nothing is added, silently.
- A7: `getReplyTo`, `getTo`, `getCc` under `gmail.addons.current.message.metadata` (steps 7, 9). A throw makes every Reply say "This email can no longer be read".
- Q69: double press, 1 or 2 drafts (step 10). Q55: fresh consent (smoke Slice 18 check 1).
- Signature place and quoted text in replies (step 7); callback durations (check 2).

## Follow-up 1 (head 9cbbd87)

Verdict: PASS. 0 must-fix, 3 minors.

Change: `panelAnswer` (src/addon/panel.ts) throws `new Error(<sentence>)` for every refusal; a throw before a draft gives "Something went wrong. Try again.", a throw while rendering after the draft gives the Drafts sentence; the caught error text is dropped. Src diff `f0db075..9cbbd87`: src/addon/panel.ts and src/addon/entry.ts (`panelRespond` only). flows.ts identical (same blob hash). Protected paths and appsscript.json: empty diff. Secret patterns in added lines: 0.

### Commands (clean install on 9cbbd87)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0 |
| `npm run lint`, `npm run typecheck` | exit 0, no output |
| `npm run test:coverage` | 67 files, 1912 tests passed; all files 97.12 statements, 90.86 branches |
| `npm run build -- --env dev` | "Built dev 9cbbd87", Code.js 366.7 KB, index.html 379.2 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |

### Probes (scratch copy, deleted after)

An address and a `ya29.`-style token planted in the event token, the message ID, every header, the template title, subject and body, the sender name, typed boxes, the `as` and `rh` parameters, the server error message and request ID, every Gmail fake error, the server port throw and the render throw. 36 runs:

- 34 failure runs threw. 0 thrown messages hold the address, the token, "planted", a request ID, "Details" or a stack path.
- 31 of 34 messages are sentences of wording.md: NOT_FOUND (real server x3, fake), DENIED (real, fake), QUOTA, BUSY, INTERNAL, NETWORK, VALIDATION, TIMEOUT, null message, throws at the token, `getMessageById`, `getReplyTo`, `getTo`, `getCc`, server port, `hash` (render problem before the draft), no message ID, bad `as`, `rc`, 500 characters, version, `rh`.
- 3 of 34 are state-card lines joined (spec 7.2): NOT_CONFIGURED "Migway Templates is not set up yet. Ask your admin to finish setup, then press Retry.", AUTH_NO_USER and AUTH_DOMAIN (3 sentences). Each line is a wording text; the joined string is not one sentence.
- `createDraft*` calls: 0 on every refusal; 1 on the 3 failed `createDraft*` runs (the failed call itself) and on the render throw after the draft (Drafts sentence).
- Logs: 21 lines, 0 planted strings. A NOT_FOUND refusal logs one warn line `template.apply` with `errorCode` NOT_FOUND, actor, targetId, timing and the server stack frames (code paths only). Refusals before the server (no message, unreadable, 500 characters, bad `as`) log no server line; the run fails in Executions with the sentence and add-on stack frames only.
- Non-compose paths, 3 probes: `previewFlow` of a deleted template (panel) and `insertFlow` of a deleted template (compose) return the state card "This template was deleted or moved. Press Refresh to update the list." with Refresh; `homeFlow` on QUOTA returns the retry card with Request ID and Retry. Unchanged; their tests pass.

### "Details for your admin" left in src/addon

One place: src/addon/cards/states.ts:59, on state cards for NETWORK only. NETWORK failures come from src/addon/client/serverClient.ts only, with fixed texts ("Server returned HTTP n", "Server reply is not JSON", "Server reply has an unknown shape", "Server unreachable", the execUrl line). No src/server file emits NETWORK. The add-on callbacks outside the panel have no catch (`respond`, entry.ts:70), so a platform error goes to Gmail as a failed run and never onto a card. No file or message content can reach a card. Not a must-fix.

### Docs

Part J step 10 now has "Expect:"; step 11 records "sentence, red error bar, or nothing" plus a table row. docs/spikes/slice-10-s7.md "Part J run, 2026-11-11" holds the facts (Q74 and Q68 settled, header reads ran, 1 draft on double press, step 11 defect and fix). Smoke "Slice 15" step 12 and part H steps 2 and 3 carry the replacement texts of this review.

### Minors

1. NOT_CONFIGURED and AUTH_* throw 2 or 3 sentences; NOT_CONFIGURED ends "then press Retry." with no Retry in an error bar. Fix: one sentence per code, e.g. "Migway Templates is not set up yet. Ask your admin." as a new wording row.
2. The dropped Gmail error text (a `createDraft*` refusal) now reaches no screen and no log; an admin cannot tell a Gmail quota from a scope error. Fix later: log the error name only (no message) in the add-on run.
3. Unverified in Gmail: how a compose-action throw shows on a `DecoratedText` row (banner, "Exception:" prefix, or nothing again). Part J step 11 rerun decides.

## Follow-up 2 (head a5d4690, D33)

Verdict: PASS. 0 must-fix, 2 minors.

Change: src/addon/cards/folder.ts and home.ts only (`git diff 97595c6 a5d4690 -- src`). Rows with an email open become 2 widgets: the `DecoratedText` (title, hint, tap `onPreview`) and a button set "Reply" (filled) + "Reply all" (outlined), both `onCompose`. Inbox and compose rows keep one button in the row. `listSection` collapses after 5 whole rows. Protected paths (src/server, src/shared, src/web, appsscript.json, package files): empty diff against 97595c6. Secret patterns in added lines: 0.

### Commands (clean install on a5d4690)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0 |
| `npm run lint`, `npm run typecheck` | exit 0, no output |
| `npm run test:coverage` | 68 files, 1932 tests passed; all files 97.15 statements, 90.97 branches |
| `npm run build -- --env dev` | "Built dev a5d4690", Code.js 368.3 KB, index.html 379.2 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |

### Probes (scratch copies of a5d4690 and 78ec3cf, deleted after)

View: 45 templates (half with recipient counts, a third with fields, titles with `<b>&</b>`), 30 top-level folders, 1 subfolder, 10 favorites, 5 recent. Cards: home, folder page 1 (20 rows), folder page 2 (5 rows), search (20 results), for 3 entries, built by both trees.

| Entry | Card | Same JSON as 78ec3cf | Widgets on the card | Sections (widgets/collapse after) | JSON bytes head / base |
|---|---|---|---|---|---|
| compose | home, folder 1, folder 2, search | yes, 4 of 4 | 46, 23, 8, 21 | Favorites 10/5, Folders 30/5 | 9740, 6838, 2208, 6873 (equal) |
| inbox | home, folder 1, folder 2, search | yes, 4 of 4 | 47, 24, 9, 22 | as compose plus hint | equal |
| message | home | no (expected) | 62 | Favorites 20/10, Recent 10, Folders 30/5 | 13,922 / 10,556 |
| message | folder page of 20 | no | 44 | list 40, pager 2 | 12,364 / 7,874 |
| message | search 20 | no | 42 | Results 40 | 12,399 / 7,909 |

- Every message-entry row: 1 item with `onPreview {id}` and no button, then 1 button set of 2 buttons, `REPLY_AS_DRAFT`, `as` reply and replyAll, the row's own `id` (0 mismatches over 75 rows) and the same `rc`. Screen reader "Reply all with <title>".
- Collapse: Favorites cuts after widget 10, a button set; widget 11 is the next row's item. No row is split from its buttons. Folders cut after 5 items.
- Row "Reply all" against the real server: `createDraftReplyAll("", {htmlBody "<p>Hi all</p>", cc safety@, bcc records@})`; template Cc ann@ dropped (on the email's To as `"Doe, Ann" <ann@...>`); template To in no argument; `recipientEmailIfInternal` ""; 1 use. Same template deleted: throws "This template was deleted or moved. Open the panel again to update the list.", 0 drafts.
- Largest response: message home 13.9 KB of JSON (+32 percent); folder page and search +57 percent. All far under any response limit seen so far.

### Card Service limits

docs/research/r4-platform-constraints.md:37 quotes Google: "you can't add more than 100 widgets or 100 card sections to a card", so the limit is per card, not only per section as the handoff says. Largest cards with an email open: home 62 with 30 folders (= 32 + top-level folders), folder page 43 + subfolders, search 42. Nothing here breaks at today's data.

### Minors

1. The home card with an email open passes 100 widgets at 69 top-level folders (before: 84). The folder card passes it at 58 subfolders with a full page (before: 78). No folder cap exists (IMPORT_FOLDERS_MAX 100 is import only). Fix: collapse is not enough; page the Folders section or cap it at 40 with "Open library" for the rest. Pre-existing in kind.
2. Wireframe 01 "Message open" still shows one [Reply] per row (handoff names the erratum for the architect).

Docs: quick start adds one line for "Reply all" under "Reply"; part J step 13 (row "Reply all" on "T3 copies", expects To and Cc kept, Cc and Bcc added, records layout) has "Expect:" and a table row; smoke "Slice 18" runs steps 1 to 13. Only Gmail can show the button set under a `DecoratedText` in the 300 px panel (step 13).
