# Review: slice 5b (reply subject, 7 library fixes)

Verdict: PASS

Branch `slice/05b-reply-subject`, commits f588821 to c50c953, base 236fc97. Reviewed 2026-11-10.

## Commands (clean install, worktree agent-a5e669bcfeace4e0c)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | added 559 packages, audited 560; 16 advisories (14 moderate, 2 high), unchanged |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run test:coverage` | 46 files, 983 tests passed. Lines 96.41 (addon 100, server 99.31, shared 100, web 95.52), statements 95.46, branches 89.07, functions 94.14 |
| `npm run build -- --env dev` | Code.js 279.8 KB of 800 KB, index.html 284.9 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100 |
| New tests on 236fc97 src | 38 failed, 945 passed (9 files). Every item 1 to 8 has a failing test |

`git diff 236fc97..HEAD` touches no appsscript.json, scripts, package.json, lock or lint/ts/vitest config. Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, AKIA, xox, eyJ): 0 hits. Emails added: 6 fixtures on example.com. URLs added: none. New network calls (UrlFetchApp, fetch, XMLHttpRequest, sendBeacon): none.

## Acceptance criteria

1. Accept. Items 1 to 8 done; 38 new tests fail on old src (addon 12, server 3, shared 13, web 10).
2. Accept. `DRAFT_FIELDS` and `requestDraft` in src/shared/model/protocol.ts:19-81; VALIDATION at src/server/dispatch/handle.ts:52; log only via `draftOf` (handle.ts:104). One rule: `isReplyDraft` src/addon/event.ts:277. New-draft path equals 32a446c (see b).
3. Accept. `folderLabel` src/server/handlers/folders.ts:105. Non-admin probe: no other address in any response (see d).
4. Accept. `formatTime` src/web/ui/dom.ts:49; tests stub TZ (New York, Kolkata, UTC).
5. Accept. 10 scopes, appsscript.json unchanged, `inlineHtml` untouched.
6. Accept with minor 1. docs/ops/smoke.md:85-98, 10 steps.
7. Accept. test/unit/server/entry.test.ts pins unchanged and green; `requestDraft` is pure, adds 0 service calls.
8. Accept. All 8 commands green from clean install.

## Judgments

a. Diagnostics. Accept. Probe, 19 bad inputs on both surfaces (addon, webapp_rpc), 38 cases: unknown name, name with "\n", 10,000 unknown names, 10,000 repeated `threadId`, 5,000-character name, counts -1, 1e308, 1001, 1.5, "3", null, extra key, missing key, string draft, array draft, string fields, object in fields, own `__proto__` key, null draft. All answer VALIDATION "Draft fields must come from the fixed list". No log line holds the marker text or a `draft` key; each line is under 3,000 characters. Bad request ID plus bad draft: no marker logged. Accepted bound: `to: 1000`. Add-on probe: an event with threadId, messageId, accessToken, subject and 5,000 recipient addresses gives `{"fields":[...names],"to":1000,"cc":0,"bcc":0}`; no value, `@` or token text in the output (src/addon/event.ts:244-271).

b. `isReplyDraft`. Accept. Reads `gmail`, `draftMetadata`, `messageMetadata` (event.ts:245-249); true on `threadId` or `messageId` with a value other than undefined, null, "" (event.ts:236, 279). Fields absent everywhere: `reply = false`, `replacesSubject(undefined, false) = true`, preview keeps "Insert body only" and "Replaces the draft subject.", prompt switch starts on: same as 32a446c (tests "a new draft ..." in test/unit/addon/flows.test.ts). Fields present everywhere: plain Insert never sets the subject (flows.ts:220, 282). Exit stays open: preview "Insert with subject" sends `subject: "use"` (src/addon/cards/preview.ts:23), and the prompt switch can be turned on. Probe: "Insert with subject" with prompts starts the switch on and sends "S Pen".

c. `replacesSubject` (src/addon/cards/spec.ts:82-88). Probed truth table: undefined/false true, undefined/true false, skip/false false, skip/true false, use/false true, use/true true, any other string or "" equals `!reply`. Matches spec Q21 (skip on one-click in replies, switch default off) and 5.6 for new drafts. Prompt card in a reply with switch on sends the subject (existing test plus probe). Blocked insert (blank field, switch on) returns `update` and no insert reply (flows.ts:357-375).

d. Owner label. Accept. Only callers who see the folder get the label, and only admins see another user's private folder (D18). Probe as non-admin Bob (manage on Sales) with Ana's private template "price secret": `folder.list`, `template.list`, `search`, `search.body`, `sidebar.home` contain no "ana@"; `template.get`, `getBody`, `apply`, `move`, `duplicate`, `create`, `folder.rename` on Ana's objects answer DENIED "You don't have access to this. Ask a folder manager." with no address. The Move list and grid paths read `folder.list` names. Admin sidebar keeps the server filter (own private only, no label). Rename: admin `folder.rename` with the labelled name stores it, giving "My templates (ana@...) (ana@...)" for the admin and "My templates (ana@...)" for Ana. No address reaches a non-owner non-admin. No web or add-on UI calls `folder.rename` yet (grep src/web, src/addon), so the defect is latent: minor 2.

e. Local time. Accept. No server-side formatting for display; no time zone sent. All web times go through `formatTime`: grid (grid.ts:131), history (history.ts:50, 94), editor status and conflict (editor.ts:330, 431), CONFLICT banner (status.ts:28-35). Server CONFLICT text (src/server/handlers/versions.ts:26) still carries ISO UTC; the web replaces it from `details`. The add-on shows no times.

f. Focus. Accept. `main#main` has tabindex -1 (src/web/index.html:25), so `main.focus()` (app.ts:170) adds no tab stop. History list has tabindex 0 (history.ts:28). Delete dialog keeps button order Delete, Cancel; only the initial focus moves (dialog.ts:107). Lighthouse 100 on 3 pages.

g. "Searching text...". Accept. A reply for a query that no longer matches the input is dropped (library.ts:237). A to B: A's reply dropped, B shown. A to B to A: A's reply shown, correct for A. "No templates match" cannot show while the current query is pending (library.ts:188-189, 211-222). Minor 3 on the error path.

## Minors (not blocking)

1. Smoke step 9 (docs/ops/smoke.md:97) presses Down in History of "Smoke 5b plain", which has 1 version after step 1. The selection cannot move. Fix: save the template twice in step 1, or use "Smoke 3 quote".
2. Admin rename starts from the labelled name (folders.ts:124 relabels `name`; folders.ts:187 stores the input as is). Fix in the admin UI slice: send the stored name separately (`baseName`) or strip the label server-side.
3. A failed `search.body` for a stale query still raises a toast (library.ts:244-249). Fix: call `app.fail` only when `query === search.value.trim()`.
4. "Searching text..." sits in the list, outside the `role="status"` region, and `aria-busy` stays "false" (library.ts:213). A screen reader does not hear it.
5. `draftInfo` reports a recipients field as present when its value is a non-array (count 0) (event.ts:252). Harmless for the rule.
6. Spec 5.6 Draft bullet, spec 11 (`draft` field) and wireframe 02 do not yet name the reply rule or "Insert with subject". Orchestrator text.
7. Open from slice 5: prompts used only in the subject are asked with the switch off.
