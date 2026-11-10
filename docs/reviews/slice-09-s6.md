# Review: slice 9 task 1, spike S6 harness

Date: 2026-11-10. Branch `slice/09-s6-harness`, base 0729db9, head ba36778 (38db744, 049e362, d53aafb, ba36778).

## Verdict: PASS

The harness meets criteria 1 to 8. No blocker. 7 minors below; none blocks the owner's spike run.

## Commands (clean install, worktree root)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | pass, 559 packages added |
| `npm run lint` | pass, 0 problems |
| `npm run typecheck` | pass |
| `npm run test:coverage` | pass, 54 files, 1263 tests; lines 96.7% (5076/5249); addon 99.57 (entry.ts:138 uncovered) |
| `npm run build -- --env dev` | pass, Code.js 324.9 KB of 800 KB |
| `npm run build -- --env prod` | pass, Code.js 324.8 KB; bundle holds `env: "prod"`; known warning, prod.json has no execUrl |
| `npm run scopes:check` | pass, "10 scopes, all approved" |
| `npm run format:check` | pass |

Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, AKIA, xox, eyJ): 0 hits. Emails: `s6-to|cc|bcc@migway.com` (spec 14.1 test addresses) and `a|b|c|x@example.com` in tests. URLs added: 0. appsscript.json, scripts/, package files, src/web, test/unit/web: unchanged. Scope diff: none.

## Checks

a. Dev gate. Prod home card has no S6 section (`s6Sections(env)`, spikeS6Home.test.ts mocks both envs). Both flows return `{kind:"pop"}` when `env !== "dev"`; `onS6Apply` also pops on any `b` outside the 4 keys (`hasOwnProperty`, so `__proto__` and `toString` pop). A forged callback name outside ENTRY_POINTS has no stub. Session guard `requireAddonSession` runs first in `respond` for both callbacks. See minor 1 for the env check order.

b. Data handling. Recipient strings go to one `text` widget only; `markup()` (render.ts:20) escapes `& < >` on every text widget, header and label, so `"<b>x</b>" <a@b.c>` and `<a href=...>` render as text. Bottom labels and the body line carry counts only. Action parameters carry `b` only. The flows call no port: no `callServer`, no cache read or write, no `console`. No `setSendStatus` in src (test asserts it on the render).

c. "Draft plus new" spreads the received list, then the test address. Missing field, missing event, and non-array values read as `undefined` and send the test address alone (tests at spikeS6.test.ts:53, :90). Minor 4 covers mixed lists.

d. Actions per button match spec 14.1: New only = body, subject, To, Cc, Bcc (steps 1, 2, 7); Draft plus new = same with draft lists (step 3); Raw Cc again = one Cc action `s6-cc@migway.com` (step 4); Recipients only = To, Cc, Bcc (fallback F1). Body uses the existing MUTABLE_HTML IN_PLACE_INSERT path. No send action.

e. Accepted. `UpdateDraftActionResponse` has no navigation or notification. Step 1 is the only step that records callback ms, and "New only" writes it into the body. Steps 2 to 8 record draft state, which the tester reads from the draft.

f. Smoke "Spike S6" is followable. Every step names the draft state, typing before opening the add-on, the button label as on the card, and what to record. Step 5 and 6 name the button by the step 2 result. The result table rows map to the decision table: step 2 (add or replace), step 3 and 8 (exact strings), step 1 and 1 F1 (combine), step 5 (reply), step 7 (prompt), step 4 (chips).

## Minors

1. The env check runs inside the flow, after `respond`'s prelude: `paramsOf`, `ports(event)` (draftInfo, `getActiveUser`, a `getUserCache()` handle) and `waitSeconds`. Nothing is read from or written to the cache; a forged `notBefore` in prod returns the existing "Service is busy" notify. No harness output. Removed with the harness.
2. Callback ms measures `Date.now()` at entry to the flow's end. It excludes `build()`, response serialization and the Gmail round trip. Smoke step 1 should read it as Apps Script time, not tap-to-draft time.
3. entry.ts:138 (the `s6ApplyFlow` call in `onS6Apply`) has no test; addon lines fell from 100 to 99.57.
4. A list with one non-string element reads as missing: the card shows "(missing)" and "Draft plus new" sends the test address alone. Visible on the card, so the tester sees it.
5. No render-level test with HTML in a recipient string. Safety rests on `markup()` in toWidget, which existing card tests cover.
6. An uncaught `build()` or Gmail error lands in Executions with Google's message text. If Gmail quotes an address there, a tester address reaches the log. The harness cannot prevent it; the tester should discard such entries with the drafts.
7. Step 4 sends a Cc-only response. If step 1 F1 shows recipient-only responses fail, step 4's result says nothing about chips. Smoke could say "skip step 4 if 1 F1 failed".

## Removal inventory

Handoff lists 9 code sites, 2 test files and the smoke section. `grep -rn "S6" src test` matches only those sites. Inventory complete.
