# Handoff: implementer to reviewer, slice 5b (smoke findings, reply subject)

Branch `slice/05b-reply-subject`, based on 236fc97 (`claude/gracious-franklin-3n8zbq`). 6 commits plus this handoff, not merged, not pushed:

| Commit | Content |
|---|---|
| f588821 | Item 1: draft diagnostics, `isReplyDraft`, subject kept in replies |
| d4ae032 | Item 2: owner label on other users' private folders |
| 780bdaf | Item 3: local time in the web app |
| 6f7dda7 | Items 4, 5, 6: busy status, history focus, Delete dialog focus on Cancel |
| 8e85356 | Items 7, 8: "Searching text...", `/` on the first press |
| 8bfadd1 | docs/ops/smoke.md "Slice 5b", 10 steps |

## Done

1. Reply drafts (Q21).
   - Diagnostics: `DRAFT_FIELDS` in src/shared/model/protocol.ts: `messageId`, `threadId`, `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients`, `subject`. `draftInfo(event)` (src/addon/event.ts) reads `event.gmail`, `event.draftMetadata` and `event.messageMetadata`; a field counts as present when its value is not undefined, null or "". Counts are array lengths, capped at 1,000. `ports(event)` in src/addon/entry.ts sends `draft` with every server call of the callback, `onComposeOpen` and `onHomepage` included.
   - Server: `requestDraft(raw)` gives `undefined` (absent), `null` (any name outside the list, a repeated name, another key, a count that is not an integer from 0 to 1,000) or the set in list order. `null` answers VALIDATION "Draft fields must come from the fixed list" (checked after the request ID, before parsing). Only a valid set reaches the log line as `draft`; a rejected one leaves no trace (test greps the line for the client text).
   - Rule: `isReplyDraft(event)` = `threadId` or `messageId` present. Only flows call it. `replacesSubject(choice, reply)` in src/addon/cards/spec.ts: `subject: "skip"` never, `subject: "use"` always, no parameter = `!reply`.
   - The 3 insert paths: one-click Insert in lists and preview Insert send no subject action in a reply. The prompt card switch starts off in a reply. A template changed under the card keeps it off in a reply (`replaceSubject || (changed && !reply)`); in a new draft the old `|| changed` holds. Preview card in a reply: "The subject is kept in replies." and "Insert with subject" (`subject: "use"`) in place of "Insert body only". New drafts behave as 32a446c.
   - Tests: new draft, reply, opt-in in a reply ("Insert with subject", switch on), opt-out in a new draft ("Insert body only", switch off), changed template in a reply (test/unit/addon/flows.test.ts "reply drafts (Q21)"); card test; `draftInfo` and `isReplyDraft` (logic.test.ts); 14 `requestDraft` cases (protocol.test.ts); log and VALIDATION (handle.test.ts); payload of `onComposeOpen` (addon.test.ts).
2. Owner label. `folderLabel` in src/server/handlers/folders.ts: `folder.list` returns `name` "My templates (owner@domain)" for a private folder whose owner is not the caller. Tree, Move list, grid paths and web search read `name`, so all 4 change. Role test: use, edit, manage and no-grant callers each see one private folder, their own, named "My templates", and no other user's address in `name` or `ownerEmail`; the admin sees 4 labelled folders and its own unlabelled.
3. Local time. `formatTime` (src/web/ui/dom.ts) uses the browser's `Date` getters. The CONFLICT banner text is built from `details.updatedAt` in the browser (`conflictText`, src/web/ui/status.ts); the server message still carries UTC. Tests pin `TZ` with `vi.stubEnv` (New York, Kolkata, UTC).
4. Busy status: `act` in src/web/views/rowActions.ts shows "Duplicating...", "Moving...", "Deleting..." before the call.
5. History: `list.focus()` after the first load.
6. Delete dialog: `DialogAction.autofocus`; Cancel has it.
7. Library: `bodyPending` holds the query whose `search.body` is due or running. While it is pending the list shows "Searching text..." and no no-match text; a failed call clears it.
8. `/`: the handler accepts a non-Element target (old code threw `target.closest is not a function` when the key targeted the document). On load the app focuses `main` when the body has focus. Cause in Gmail is unverified: a key pressed before the iframe has focus never reaches the page; smoke step 10 records it.

Every new test fails on 236fc97 src (38 failed, checked with `git checkout 236fc97 -- src`).

Warm counters: `sidebar.home`, `search`, `template.apply` pins in test/unit/server/entry.test.ts pass unchanged (props 1, drive 0). The draft check adds no service call.

## Left for later

- Smoke "Slice 5b" (needs a deploy; clasp not available here). Step 5 confirms or replaces the reply rule.
- In a reply, prompts used only in the subject are still asked with the switch off (slice 5 minor 2).
- An admin renaming another user's private folder starts from the labelled name.
- `internalRecipient` reads only `draftMetadata.toRecipients`; if Gmail fills only `gmail.toRecipients`, first names stay empty. Step 5 shows which field exists.
- Trash view, admin UI, export and import, Q23 trigger order, save speed, spec and ADR text (spec 5.6 and 11: `draft` log field, `Insert with subject`).

## Risks

- `messageId` may be present on a new draft opened while a conversation is open (step 3). Then that draft counts as a reply and keeps its subject; "Insert with subject" is the escape.
- `main.focus()` on load may be blocked by the browser in the HtmlService iframe; no harm then.

## Files touched

src: addon/{entry,event,flows}.ts, addon/client/serverClient.ts, addon/cards/{preview,spec}.ts, server/dispatch/handle.ts, server/handlers/folders.ts, shared/log/logger.ts, shared/model/protocol.ts, web/app.ts, web/ui/{dialog,dom,status}.ts, web/views/{history,library,rowActions}.ts.
test: unit/addon/{addon,cards,flows,logic}.test.ts, unit/server/{folders,handle}.test.ts, unit/shared/protocol.test.ts, unit/web/{app,logic}.test.ts.
docs: ops/smoke.md, this handoff.

## Commands (clean install, 2026-11-10)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | added 559 packages, audited 560; 16 advisories (14 moderate, 2 high), unchanged |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run test:coverage` | Test Files 46 passed (46), Tests 983 passed (983). Statements 95.46, branches 89.07, functions 94.14, lines 96.41. Lines: addon 100, server 99.31, shared 100, web 95.52 |
| `npm run build -- --env dev` | Code.js 279.8 KB of 800 KB, index.html 284.9 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100 |

`git diff 236fc97 -- scripts appsscript.json package.json package-lock.json` is empty. Secret scan of the diff: no token patterns, no new `UrlFetchApp` or `fetch`; added addresses are test fixtures on example.com.
