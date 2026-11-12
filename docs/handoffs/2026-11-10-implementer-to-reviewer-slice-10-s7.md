# Implementer to reviewer: slice 10, spike S7 harness and side-panel interim fix

Date: 2026-11-10. Branch `slice/10-s7-harness` from fe3f7dc. Not merged, not pushed. Add-on and manifest only; nothing under src/web or test/unit/web touched; spike S6 harness unchanged except one test call (`homeCard(view(), "compose")`).

## Done

Permanent:

- `entryOf(event)` (src/addon/event.ts): `compose` when `draftMetadata` is present, else `message` when a message ID is present, else `inbox`. `messageIdOf(event)` reads `gmail.messageId`, then the deprecated `messageMetadata.messageId`; only a non-blank string counts. `AddonEvent` gains `messageMetadata`.
- `Ports.entry` is set from `entryOf(event)` in `ports(event)` (src/addon/entry.ts), so every callback derives the entry from its own event; it never travels in card parameters.
- Interim fix (spec 13.7 last paragraph): `templateItem`, `folderCard`, `homeCard`, `searchCard`, `previewCard` take `entry`. In `inbox` and `message`: rows keep title, labels and tap-to-preview but carry no Insert button; the preview card has no Insert, "Insert body only", "Insert with subject" or draft-subject note; "Edit in library" stays; an empty actions section is dropped. The home card (also its empty state) ends with one text section `TOOLBAR_HINT`, the spec 7.2 footer hint: "Writing an email? Open Migway Templates from the toolbar at the bottom of the draft to insert at the cursor." `compose` is unchanged.
- `onMessageOpen(event)`: guard, then `renderCard(homeFlow(ports(event)))`, as `onHomepage`. Manifest `addOns.gmail.contextualTriggers: [{ "unconditional": {}, "onTriggerFunction": "onMessageOpen" }]`. Scope list unchanged.
- `ButtonSpec.compose` (`"STANDALONE_DRAFT" | "REPLY_AS_DRAFT"`): render.ts calls `TextButton.setComposeAction(action, CardService.ComposedEmailType[...])` in place of `setOnClickAction`. Kept for the panel pass (ADR-0007 section 4).

Temporary (spike S7, dev build and side panel only):

- Home section "Spike S7 (temporary)" with "Open S7 harness", after the S6 section, only when env is `dev` and entry is not `compose`.
- Harness card: event shape (key names and value types of the event, `gmail`, `messageMetadata`, `commonEventObject`), entry, "message ID present" and "access token present" as yes/no. Buttons, all compose actions: "New email" (`STANDALONE_DRAFT`), "Reply", "Reply all" (`REPLY_AS_DRAFT`, disabled with a text line when no message is open), "Notify" (`STANDALONE_DRAFT`, callback `onS7Notify` returns a notification).
- Gmail calls (`s7Call` pure, `s7Run` executes): `GmailApp.setCurrentMessageAccessToken(token)` first, then
  - New email: `GmailApp.createDraft("s7-to@migway.com", "S7 test", "", { htmlBody, cc: "s7-cc@migway.com", bcc: "s7-bcc@migway.com" })`.
  - Reply: `GmailApp.getMessageById(id).createDraftReply("", { htmlBody, cc, bcc })`; Reply all: `createDraftReplyAll` with the same options. No `subject` option (D24).
  - The response: `CardService.newComposeActionResponseBuilder().setGmailDraft(draft).build()`.
- HTML body `S7_HTML`: bold text, a 2-item list, a link to https://www.google.com, one image from www.gstatic.com (the manifest logo URL).
- Refusals, each a notification with the reason, no Gmail call: prod build, missing button parameter, compose entry, no access token, Reply or Reply all with no message ID.
- Visible failures: `s7Visible(run, s7Failure)` wraps flow and render of all 3 harness callbacks; an exception returns one `ActionResponse` with a notification "S7 failed: <message>" and a pushed card "Spike S7 failed" with the same text. The guard runs before the wrapper and still throws, as for every add-on callback.
- No server call, no cache, no log line, no send method. The only write is the draft Gmail opens.
- docs/ops/smoke.md "Spike S7": first line "Open the add-on from Gmail's right side panel for this test, never from a draft's toolbar.", setup, 8 steps of spec 14.2 (step 1 marked "By hand"), empty result table. Callback ms come from the Executions page.

## Verified and how (clean install: `rm -rf node_modules && npm ci`)

- `npm run lint`: clean. `npm run typecheck`: clean. `npm run format:check`: "All matched files use Prettier code style!"
- `npm run test:coverage`: 58 files, 1332 tests passed. Lines 96.48%, statements 95.48%.
- `npm run build -- --env dev`: "Built dev 71b889a", Code.js 335.7 KB of 800 KB; dist/appsscript.json holds `contextualTriggers`; top-level stubs `onMessageOpen`, `onS7Card`, `onS7Compose`, `onS7Notify` present.
- `npm run build -- --env prod`: Code.js 335.6 KB (warns: prod.json has no execUrl, as before).
- `npm run scopes:check`: "Scope check passed: 10 scopes, all approved."
- Tests: test/unit/addon/entryOf.test.ts (3 entries, undefined, empty, blank and non-string IDs). cards.test.ts: home, folder, search, preview for `inbox` and `message` (no Insert, hint last) and for `compose` (Insert, no hint). addon.test.ts: `onMessageOpen` and `onHomepage` render no Insert alt text and the hint; `onComposeOpen` renders "Insert Welcome". spikeS7.test.ts: call and arguments per button through test/fakes/gmail.ts, token first, no send, 6 refusals with zero Gmail calls, dev gate, shape holds no value, failure wrapper, render of `setComposeAction`, `s7`, `s7Error`. spikeS7Dev.test.ts (mocked `BUILD_INFO`): section placement and gate, `onS7Compose` reaching `setGmailDraft`, a thrown Gmail error shown as text.
- Guard and allowlist tests cover `onMessageOpen` and the 3 S7 callbacks; the manifest test now reads `contextualTriggers`.

## Not verified (needs Gmail, spike S7 run)

- Manifest acceptance of `contextualTriggers` by Apps Script and any consent prompt it causes (S7 step 1). No schema validator exists in the repo; `scopes:check` and the build accept it.
- Whether a compose-action callback may return a notification or an `ActionResponse` with a pushed card (S7 step 6). If not, refusals and failures inside `onS7Compose` may stay invisible; the type definitions do not say.
- `GmailApp.getMessageById` returning null for an unknown ID: typed non-null; the wrapper would show the resulting TypeError.
- Whether `setCurrentMessageAccessToken` is needed or accepted for `createDraft` with no message open (ADR-0007 calls it for all three).

## Left for later

- Header line under the card title per entry (spec 7.2) and the "New email", "Reply" row buttons: Gmail panel pass, after S7.
- Search card and folder card in the side panel show no hint; only the home card does (task scope).
- `draft.via` and the panel apply pipeline (spec 13.7 items 4 to 6).

## Removal list (Gmail panel pass, spec 13.7 item 1)

- src/addon/spikeS7.ts (all symbols: `S7_*`, `S7Button`, `S7Gmail`, `S7Options`, `S7Call`, `s7Call`, `s7Run`, `s7Shape`, `s7Sections`, `s7Card`, `s7CardFlow`, `s7ComposeFlow`, `s7NotifyFlow`, `s7Failure`, `s7Visible`).
- src/addon/entry.ts: `s7Respond`, `onS7Card`, `onS7Compose`, `onS7Notify`, the spikeS7 import.
- src/entry.ts: exports `onS7Card`, `onS7Compose`, `onS7Notify`. src/shared/entryPoints.ts: the 3 rows under "TEMPORARY (spike S7)".
- src/addon/cards/spec.ts: `CALLBACKS` rows `onS7Card`, `onS7Compose`, `onS7Notify`; Reply kinds `s7`, `s7Error`. src/addon/cards/render.ts: cases `s7`, `s7Error`.
- src/addon/cards/home.ts: `s7Sections` import and call.
- test/fakes/gmail.ts, test/unit/addon/spikeS7.test.ts, test/unit/addon/spikeS7Dev.test.ts.
- docs/ops/smoke.md "Spike S7".
- Keep: `entryOf`, `messageIdOf`, `Entry`, `Ports.entry`, the entry parameters, `TOOLBAR_HINT`, `onMessageOpen`, the manifest trigger, `ButtonSpec.compose`, `ComposedEmailType` in the CardService fake.

## Risks

- `onMessageOpen` runs on every message the user opens with the panel open: one execution each; the home view comes from the User Cache `view:*` on a hit.
- If Gmail shows a consent prompt for the contextual trigger, the decision table of spec 14.2 removes the trigger; `onMessageOpen` then has no caller.
- Error text from Gmail can contain the user's own address; it is shown only on the tester's screen and never logged.

## Files touched

appsscript.json; src/addon/{entry,event,flows,spikeS7}.ts; src/addon/cards/{folder,home,preview,render,spec}.ts; src/entry.ts; src/shared/entryPoints.ts; test/fakes/{gmail,output}.ts; test/unit/addon/{addon,cards,entryOf,flows,spikeS6Home,spikeS7,spikeS7Dev}.test.ts; test/unit/server/entry.test.ts; docs/ops/smoke.md.

## Commands

```
rm -rf node_modules && npm ci
npm run lint && npm run typecheck && npm run test:coverage
npm run build -- --env dev && npm run build -- --env prod
npm run scopes:check && npm run format:check
```
