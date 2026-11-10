# Handoff: implementer to reviewer, slice 5c (subject rule D24)

Branch `slice/05c-subject-rule`, based on 22b4b7e. 3 commits plus this handoff, not merged, not pushed:

| Commit | Content |
|---|---|
| b169d2e | D24 rule: `draftHasSubject` replaces `isReplyDraft`; `hasSubject` in the draft info |
| 2508f88 | `folder.rename` strips the owner label (5b review minor 2, 7 lines) |
| c7a7200 | docs/ops/smoke.md: "Slice 5c" (4 steps), "Slice 5b" corrections |

## Done

1. `draftHasSubject(event)` (src/addon/event.ts) is the one rule over the event. It reads `subject` in `event.gmail` and `event.draftMetadata`. Only a string with a non-space character counts. A missing field, `null`, a number or a blank string count as no subject, which is the behavior of build 32a446c. `isReplyDraft` and the `messageMetadata` source are gone. `threadId` and `messageId` stay in `DRAFT_FIELDS` as diagnostic names only.
2. The truth table lives in `replacesSubject(choice, draftHasSubject)` (src/addon/cards/spec.ts), with the table in its doc comment:

   | Insert choice | draft subject empty | draft subject filled |
   |---|---|---|
   | plain Insert (list, preview) | sets it | keeps it |
   | "Insert with subject" | sets it | replaces it |
   | "Insert body only" | keeps it | keeps it |

   The prompt card switch starts at the same value and the user's switch state decides at Insert. A template changed under the card resets the switch to on only for an empty draft subject. All 6 cells have a test (test/unit/addon/logic.test.ts), 9 `draftHasSubject` cases, flow tests per path (flows.test.ts "draft subject rule (D24)").
3. Card text: "The draft already has a subject. It is kept." with "Insert with subject", or "Sets the draft subject." with "Insert body only".
4. `DraftInfo.hasSubject` (boolean). `requestDraft` requires exactly the keys `bcc, cc, fields, hasSubject, to` and a boolean `hasSubject`; anything else is VALIDATION. The log line `draft` carries it. Tests check that the subject text appears in neither the payload nor the log.
5. Smoke: "Slice 5c" has 4 steps (empty, typed then "Insert with subject", reply in its conversation, `hasSubject` in the `doPost` log lines). The log rule names `actor` and `targetId` as spec 11 fields; no recipient address, subject text, body text or prompt value. "Slice 5b" lost its reply steps 2 to 5, so its steps renumber 1 to 6. History step names "Smoke 3 quote" (several versions). A note under the `/` step: the first press may need a second one.
6. `folder.rename` on a private folder drops a trailing ` (owner address)` (case-insensitive) before storing.

Old code check: with src of 22b4b7e, 20 tests fail (rule, cards, flows, protocol, log, payload); the rename test fails on b169d2e. The `replacesSubject` cells pass on old code: the function kept its logic, only the input changed.

Warm counters unchanged: the entry.test.ts pins for `sidebar.home`, `search`, `template.apply` pass.

## Left for later

- Smoke "Slice 5c" needs a deploy. If Gmail sends `subject` without its value, `hasSubject` is false everywhere and Insert replaces the subject as in 32a446c.
- Subject-only prompts are still asked with the switch off (5 minor 2).
- Spec 5.6 and 11, wireframe 02, ADR-0004 text for D24 (architect).

## Risks

- The value of the event `subject` is unconfirmed. The rule degrades to 32a446c behavior when it is empty.

## Files touched

src: addon/{entry,event,flows}.ts, addon/cards/{preview,spec}.ts, addon/client/serverClient.ts, server/handlers/folders.ts, shared/log/logger.ts, shared/model/protocol.ts.
test: unit/addon/{addon,cards,flows,logic}.test.ts, unit/server/{folders,handle}.test.ts, unit/shared/protocol.test.ts.
docs: ops/smoke.md, this handoff.

## Commands (clean install, 2026-11-10)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | added 559 packages, audited 560; 16 advisories (14 moderate, 2 high), unchanged |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run test:coverage` | Test Files 46 passed (46), Tests 1001 passed (1001). Statements 95.46, branches 89.09, functions 94.15, lines 96.41. Lines: addon 100, server 99.31, shared 100, web 95.52 |
| `npm run build -- --env dev` | Code.js 280.3 KB of 800 KB, index.html 284.9 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100 |

`git diff 22b4b7e -- scripts appsscript.json package.json package-lock.json` is empty. No new network call, no token patterns; test addresses on example.com.
