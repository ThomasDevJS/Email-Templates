# Review: slice 5c (subject rule D24)

Verdict: PASS

Branch `slice/05c-subject-rule`, commits b169d2e, 2508f88, c7a7200, 1611869, base 22b4b7e. Reviewed 2026-11-10.

## Commands (clean install, worktree agent-a5e669bcfeace4e0c)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | added 559 packages, audited 560; 16 advisories (14 moderate, 2 high), unchanged |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run test:coverage` | 46 files, 1001 tests passed. Lines 96.41 (addon 100, server 99.31, shared 100, web 95.52), statements 95.46, branches 89.09, functions 94.15 |
| `npm run build -- --env dev` | Code.js 280.3 KB of 800 KB, index.html 284.9 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100 |
| New tests on 22b4b7e src | 21 failed, 980 passed. Rename test on b169d2e src: 1 failed |

The diff changes no appsscript.json, scripts, package.json, lock or lint/ts/vitest config. Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, AKIA, xox, eyJ): 0 hits. Emails added: 3 fixture addresses on example.com. URLs added: none. New network calls: none.

## Checks

1. Accept. `draftHasSubject` (src/addon/event.ts:40) replaces `isReplyDraft`. Grep of src: no `isReplyDraft` and no `messageMetadata`. `threadId` and `messageId` remain only as names in `DRAFT_FIELDS`. Probe: missing, `null`, `5`, object, `" \t\n "`, `" "` and an undefined event give false. A string in `gmail.subject` or `draftMetadata.subject` gives true.
2. Accept. `replacesSubject` (src/addon/cards/spec.ts:43) probe: undefined/empty true, undefined/filled false, skip false on both, use true on both. Any other choice acts like plain Insert. Prompt card on a typed draft starts with the switch off. Switch on sends "S Pen", switch off sends none. A blank field with the switch on returns `update` and no insert. All 3 paths call `draftHasSubject(event)` on the event of that callback (flows.ts:196, 282, 359). The prompt Insert reads the switch from the form, with no cached value.
3. Accept. Probe event with subject "SECRETSUBJ": the text appears in no request args, User Cache entry, card, params or `draftInfo` output. `draftInfo` gives `{"fields":["draftMetadata","toRecipients","subject"],"to":1,"cc":0,"bcc":0,"hasSubject":true}`. Server probe ran 26 bad inputs on both surfaces, 52 cases in total. They are the earlier diagnostics set, a missing `hasSubject`, and `hasSubject` as a string, "true", 1, null, an object and an array. All 52 answer VALIDATION (protocol.ts:67). No log line holds the marker text, `draft` or `hasSubject`. A valid boolean is logged.
4. Accept with minor 1. Only admins rename private folders. As admin, `folder.rename` keeps "Quotes (2026)" and "Notes (bob@example.com)" on Ana's folder, and it keeps "(ana@example.com)" alone. It strips once: "x (ana@...)" becomes "x". A non-admin owner gets DENIED on renaming their own private folder, as before. The shared folder "Sub (ana@example.com)" is stored as is.
5. Accept. docs/ops/smoke.md:98 "Slice 5c" has 4 steps: empty subject, typed subject with "Insert with subject", reply, and the `hasSubject` log field. "Slice 5b" (smoke.md:85) has steps 1 to 6, its note explains the move, and History now uses "Smoke 3 quote" (fixes 5b minor 1).
6. Accept. preview.ts:76-77 has "The draft already has a subject. It is kept." with "Insert with subject", and "Sets the draft subject." with "Insert body only".

## Minors (not blocking)

1. folders.ts:191-195 also strips the suffix on a folder the caller owns. An admin renaming their own private folder to "Mine (owner address)" gets "Mine". `folder.list` never labels the caller's own folder. Fix: strip only when `folder.ownerEmail` differs from the caller.
2. The value of the Gmail event `subject` is still unconfirmed. Smoke 5c step 4 checks it.
3. Still open from 5b: a stale `search.body` error shows a toast; "Searching text..." is not announced; spec 5.6 and 11, wireframe 02 and ADR-0004 lack D24 and `hasSubject`; subject-only prompts are asked with the switch off.
