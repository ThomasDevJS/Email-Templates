# Review: slice 18 (side-panel New email, Reply, Reply all; D27, ADR-0007)

Date: 2026-11-11. Branch `slice/18-side-panel`, head 504b0ee (implementer 6afcc97 plus main 699b02d). Slice diff `702df60..6afcc97`.

## Verdict: PASS

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
