# Review: slice 10, spike S7 harness, `entryOf`, side-panel interim fix, contextual trigger

Date: 2026-11-10. Branch `slice/10-s7-harness`, base fe3f7dc, head f7f05a7 (d31b57d, d4482e0, 71b889a, f7f05a7).

## Verdict: PASS

Criteria 1 to 8 are met. No blocker. 6 minors below; none blocks the owner's S7 run.

## Commands (clean install, worktree root)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | pass, 559 packages added, audit 16 (14 moderate, 2 high), same as earlier slices |
| `npm run lint` | pass, 0 problems |
| `npm run typecheck` | pass |
| `npm run test:coverage` | pass, 58 files, 1332 tests; lines 96.48% (5290/5483), branches 89.08%; addon 99.69 lines (entry.ts:153 `onS7Notify` stub uncovered) |
| `npm run build -- --env prod` | pass, Code.js 335.6 KB; bundle holds `env: "prod"`; known warning, prod.json has no execUrl |
| `npm run build -- --env dev` | pass, Code.js 335.7 KB of 800 KB; dist/appsscript.json holds `contextualTriggers` |
| `npm run scopes:check` | pass, "10 scopes, all approved" |
| `npm run format:check` | pass |

Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, AKIA, xox, eyJ): 0 hits. Emails: `s7-to|cc|bcc@migway.com` (spec 14.2 test addresses), `a@b.example`, `user@example.com` in tests. URLs: www.google.com and the manifest logo on www.gstatic.com (S7 body), `https://mail.google.com/` only as text in smoke.md and one test error string. src/server, src/web, scripts/, package files: unchanged. No `send`, `setSendStatus`, `console` or `Logger` in the new code.

## Checks

a. Scopes and trigger. appsscript.json and scripts/approved-scopes.json hold the same 10 scopes; the only manifest change is `contextualTriggers: [{unconditional: {}, onTriggerFunction: "onMessageOpen"}]`. Per ADR-0007 section 1: `createDraft`, `createDraftReply`, `createDraftReplyAll` and `ComposeActionResponse` need `gmail.addons.current.action.compose` plus the event token [A29], [A34]; `getMessageById` needs `gmail.addons.current.message.metadata` [A34]; the reference pages [A32], [A33] list only `mail.google.com`, unverified until S7 step 1. A refusal throws inside `s7Visible`, which returns a notification "S7 failed: <Gmail text>" and a pushed card "Spike S7 failed" (spikeS7Dev.test.ts tests the `Required permissions` text). Whether Gmail shows that response from a compose-action callback is open (see f). `onMessageOpen` is in ENTRY_POINTS (`addon`), calls `requireAddonSession` first and then `homeFlow`, the same as `onHomepage`: 1 User Cache read on a hit, 1 `sidebar.home` call on a miss. A DENIED user gets the same state card as from `onHomepage`. It runs on every message opened with the panel open, 1 add-on execution each. Spec section 10 has no row for it (minor 4).

b. `entryOf`. `draftMetadata !== undefined` decides compose first, so a compose event with `gmail.messageId` stays compose (entryOf.test.ts). The S6 side-panel event (PLAN log 2026-11-10: `gmail` with only `accessToken`, `messageMetadata`, no `draftMetadata`) gives `inbox` or `message`, never compose. Compose action events carry top-level `draftMetadata`: the Insert calls logged `fields: ["draftMetadata","toRecipients","subject"]` in the fifth smoke run (PLAN log, runbook.md:125). No misclassification path found. Undefined and `{}` give `inbox`, which removes Insert; that is the safe side for the panel and only hits compose if Gmail drops `draftMetadata` (minor 5).

c. Interim fix. Insert buttons come only from `templateItem` and `insertButtons`, both gated on `entry === "compose"`. Rows on home, Favorites, Recent, folder and search cards and the preview card have no draft-returning control in `inbox` and `message`. The prompt card opens only from `insertFlow`, so the panel cannot reach it. The hint is on the home card only (also its empty state). A user on a folder, search or preview card sees no Insert and no reason; search replaces the home card and removes the hint. No dead control remains, so the silent failure is gone, but the explanation is missing on 3 of 4 card types (minor 1).

d. Dev gate. Prod `BUILD_INFO.env` is the literal "prod". `s7Sections` returns no section; `s7CardFlow`, `s7ComposeFlow` and `s7NotifyFlow` return the "harness is off" notification before any Gmail access, whatever callback name or `b` parameter is forged (spikeS7.test.ts prod case, 0 fake calls). `onS7Compose` passes the `GmailApp` object, but no method runs in prod. The token is read by `tokenOf` and passed only to `setCurrentMessageAccessToken`; the card shows "yes/no". The message ID appears only as "yes/no" and as the `getMessageById` argument. No log, cache or server call in spikeS7.ts.

e. Drafts. Each tap makes one call (`s7Run`); no send method. New email: `createDraft(to, "S7 test", "", {htmlBody, cc, bcc})`. Reply, Reply all: `getMessageById(id).createDraftReply|createDraftReplyAll("", {htmlBody, cc, bcc})`, no `subject` option; matches ADR-0007 section 2 and spec 4.1a step 5. With no message open the Reply buttons are disabled with a text line, and a forged tap gets the refusal "no message is open" with 0 Gmail calls.

f. Error wrapper. The guard throws outside `s7Visible`. It fails only when the active and effective users differ, which does not happen in Gmail, so the tester has no practical silent path there. If step 6 shows that a compose-action callback cannot return a notification, every refusal and every caught Gmail error in `onS7Compose` is invisible: the tester sees nothing. The harness card predicts most refusals ("access token present", "message ID present", entry). The smoke section does not tell the tester to check Drafts and the Executions page for `onS7Compose` (status, error) when nothing happens (minor 2).

g. Smoke. "Spike S7" opens with the side-panel instruction, lists setup, marks step 1 "By hand", and has 8 steps that map 1:1 to the spec 14.2 steps and its decision table. Steps 3, 4 and 6 do not say to tap "Open S7 harness" again after Gmail reloads the card for an opened message (minor 3).

h. All 8 commands pass from a clean install (table above).

## Minors

1. Hint only on the home card. Folder, search and preview cards in the panel show no Insert and no reason. Fix: add the `TOOLBAR_HINT` section to `folderCard`, `searchCard` and `previewCard` when `entry !== "compose"` (spec 7.2 "Footer hint (both)").
2. Smoke lacks a "nothing happened" check. Add: if no draft, notification or card appears, check Gmail Drafts for an S7 draft and Apps Script Executions for `onS7Compose` (completed or failed, error text).
3. Smoke steps 3, 4, 6: say "tap Open S7 harness" after opening the message or returning to the inbox, since `onMessageOpen` reloads the home card.
4. Spec 10 has no row for `onMessageOpen`. Failures are not cached (`loadView` caches only success), so a user whose `sidebar.home` fails makes 1 UrlFetch and 1 server execution per opened message. Same per-call cost as `onHomepage`, higher frequency. Panel pass: add the row; consider a short negative cache.
5. No smoke step re-checks the compose toolbar after this change. Add one line: open the add-on from a draft's toolbar, open a folder, search, preview; Insert is present on each (regression of AC2).
6. `entryOf` also accepts the deprecated `messageMetadata.messageId`; spec 4.1a step 2 and ADR-0007 section 4 name only `gmail.messageId`. The harness shape lists both fields' names, so S7 step 3 shows which one Gmail fills. Update the spec or drop the fallback after S7.

## Not verified

Gmail behavior: manifest acceptance of `contextualTriggers`, consent prompt, compose-action responses, notifications from compose callbacks. S7 steps 1 to 8 settle them.
