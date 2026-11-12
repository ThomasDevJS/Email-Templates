# Implementer to reviewer: slice 9 task 1, spike S6 harness

Date: 2026-11-10. Branch `slice/09-s6-harness` from 0729db9. Not merged, not pushed.

## Done

- Home card: section "Spike S6 (temporary)" with "Open S6 harness", last on the card, only when `BUILD_INFO.env` is `dev` (`s6Sections(env)`).
- Harness card `s6`: the draft's To, Cc, Bcc strings as received (`JSON.stringify` per field, `(missing)` when absent), then 4 buttons, each with a bottom label naming the actions its response holds ("body, subject, To 2, Cc 3, Bcc 1").
- Buttons, all through `onS6Apply` with parameter `b`:
  - `new` "New only": body "S6 body", subject "S6 test", To/Cc/Bcc each with its test address.
  - `plus` "Draft plus new": same, each recipient action = the event list for that field, then the test address. Missing field = test address alone.
  - `raw` "Raw Cc again": one Cc action, `s6-cc@migway.com`.
  - `rcpt` "Recipients only": three recipient actions, no body or subject (F1).
- Callback time: `onS6Apply` takes `Date.now()` at entry; the body gets a second line `S6 <button>: <actions>. Callback N ms.`
- Prod: no home section; `onS6Card` and `onS6Apply` pass the guard, then return a pop and read nothing.
- No server op, no server change, no cache write, no log line, no `setSendStatus`. No new scope.
- docs/ops/smoke.md "Spike S6": 8 steps for the tester, F1 retry note, empty result table.

## Deviation from the task

"After each tap the card shows the actions and the callback ms" is not possible. An `UpdateDraftActionResponse` has only the 5 setters plus `build()` (`@types/google-apps-script` 2.0.15, card-service.d.ts lines 968 to 983): no navigation, no notification. So the card shows each button's action list before the tap, and the ms go into the body line. "Raw Cc again" and "Recipients only" carry no body, so their callback ms are not shown anywhere.

## Verified and how (clean install, `rm -rf node_modules && npm ci`, 559 packages)

- `npm run lint`: clean. `npm run typecheck`: clean.
- `npm run test:coverage`: 54 files, 1263 tests passed. Lines 96.7%.
- `npm run build -- --env dev`: Code.js 324.9 KB of 800 KB. `npm run build -- --env prod`: 324.8 KB (warns: prod.json has no execUrl, as before).
- `npm run scopes:check`: "10 scopes, all approved". `npm run format:check`: clean.
- Prod behavior: test/unit/addon/spikeS6Home.test.ts mocks `BUILD_INFO.env` `prod` and `dev`; prod home card has no S6 section. spikeS6.test.ts: prod flows return pop.
- Guard: the existing `it.each([...CALLBACKS])` guard test now runs `onS6Card` and `onS6Apply` too; the allowlist test matches exports and `ENTRY_POINTS`.

## Card Service methods used

`newUpdateDraftActionResponseBuilder`, `setUpdateDraftBodyAction`, `setUpdateDraftSubjectAction`, `setUpdateDraftToRecipientsAction`, `setUpdateDraftCcRecipientsAction`, `setUpdateDraftBccRecipientsAction`, `newUpdateDraftToRecipientsAction().addUpdateToRecipients`, `newUpdateDraftCcRecipientsAction().addUpdateCcRecipients`, `newUpdateDraftBccRecipientsAction().addUpdateBccRecipients`, plus the existing body and subject action methods.

## Harness inventory (remove all in the slice 9 run)

- `src/addon/spikeS6.ts`: whole file.
- `src/addon/cards/spec.ts`: `"onS6Card"`, `"onS6Apply"` in `CALLBACKS`; Reply kind `s6`; `import type { S6Draft }`.
- `src/addon/cards/render.ts`: `s6Response`, `case "s6"`, `import type { S6Draft }`.
- `src/addon/cards/home.ts`: `BUILD_INFO` and `s6Sections` imports, `...s6Sections(BUILD_INFO.env)` in `homeCard`.
- `src/addon/entry.ts`: `onS6Card`, `onS6Apply`, `s6ApplyFlow`/`s6CardFlow` import.
- `src/entry.ts`: exports `onS6Apply`, `onS6Card`.
- `src/shared/entryPoints.ts`: `onS6Card`, `onS6Apply` rows.
- `test/unit/addon/spikeS6.test.ts`, `test/unit/addon/spikeS6Home.test.ts`: whole files.
- `docs/ops/smoke.md`: section "Spike S6" (keep the results elsewhere, for example docs/spikes/, before removal).

Every code site carries the comment `TEMPORARY (spike S6)`; `grep -rn "S6" src test` finds them all.

## Left for later

- Slice 9 tasks 2 to 8 (spec 13.6), after the owner runs the spike.
- Spec 14.1 step 4 says "New only, raw"; the harness gives a separate "Raw Cc again" button, as the task asked.

## Risks

- `build()` may throw on Gmail for recipients-only or Cc-only responses; the tester sees an error toast. That is a spike result, not a harness bug.
- The test addresses are fixed `s6-*@migway.com`. If they are not real mailboxes, nothing breaks: nothing is sent.

## Files touched

src/addon/spikeS6.ts, src/addon/cards/{spec,render,home}.ts, src/addon/entry.ts, src/entry.ts, src/shared/entryPoints.ts, test/unit/addon/spikeS6.test.ts, test/unit/addon/spikeS6Home.test.ts, docs/ops/smoke.md, this handoff, .claude/agent-memory/implementer/MEMORY.md. Nothing under src/web or test/unit/web.

## Commands

`npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build -- --env dev`, `npm run build -- --env prod`, `npm run scopes:check`, `npm run format:check`.
