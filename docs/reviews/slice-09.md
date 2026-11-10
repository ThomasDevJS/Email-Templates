# Review: slice 9, template recipients (To, Cc, Bcc)

Verdict: FAIL.

Branch `slice/09-recipients`, base 6c7afc1, head 441ab04 (6 commits: 8d12e62, 8f0e4d3, c2bf572, c0c8cbf, fab1338, 441ab04). Reviewer, 2026-11-10.

## Must fix

1. A missing or malformed draft list wipes the draft field. `draftRecipients` (src/addon/event.ts:108-130, `stringList` and `read`) reads a missing key, a non-array value or a list with one non-string entry as `[]`. `recipientActions` (src/addon/cards/recipients.ts:76-89) then sends that field's action with the template addresses only. Gmail replaces the field (spike S6 step 2), so the draft's real addresses are lost. A missing To also counts as "To empty", so the template To is sent as the whole To. Probe: draft `{toRecipients: ["real@y.z", null]}` gives `to: ["t@example.com"]`. Draft with `ccRecipients` only gives a To action of the template To. The tests assert this behaviour on purpose (test/unit/addon/recipients.test.ts:124 "a missing or bad list is empty", :137 "a missing event list lets To in"). Gmail mobile (D22) and any future event change hit this path with no test on hardware. Fix: return "unknown" per field when no source carries a string list. Send no action for an unknown field, and treat an unknown To as filled (template To listed as "Not added"). Replace the two tests with tests for missing key, non-array, non-string entry and no event.
2. The prompt card does not disclose what spec 5.7 and acceptance criterion 5 require. `switchLabel` (src/addon/cards/recipients.ts:156-163) lists added addresses with "outside <domain>" only. A Bcc address has no "hidden from other recipients" marker. Not-added and `blocked` addresses are not shown. Probe: template with To and Bcc, reply draft: the card shows only "Bcc records@partner.com (outside example.com)". Fix: on the prompt card, show the `recipientWidgets` lines (as on the preview card) next to the switch. Spec 7.1's switch label example then needs an erratum.
3. No card tells the user to finish typing addresses. The orchestrator handoff (Limits) requires the preview card and the quick start to say it. Only the quick start does. docs/spikes/slice-09-s6.md:28 says "The cards and the quick start say", which is false for the cards. Fix: one text line in the preview card Recipients section (and the prompt card) when Insert adds an address.

## Minors

- Version files have no shape check for the lists. A body file with `cc: "x@y.zz"` makes `version.restore` answer INTERNAL and `version.get` return the string (src/server/handlers/history.ts:103, 129). Server-written files only, so low risk.
- Handoff example request: correct op, arg names, `html` and request ID format (src/server/entry.ts:126, src/shared/requestId.ts:18). The browser console must target the app iframe (`userHtmlFrame`), not the top page; the handoff does not say so.
- The `prof:` cache key holding an internal recipient's address for up to 6 h (slice 7 minor) is unchanged by this slice; src/server/directory is not in the diff.
- `template.list` returns the addresses to `use` holders. Spec 6 lists it; `use` holders see them on the preview card anyway. Accepted.

## Checks run (clean install, worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0; 16 audit findings (14 moderate, 2 high), same as earlier slices; lock unchanged |
| `npm run lint` | exit 0, clean |
| `npm run typecheck` | exit 0, clean |
| `npm run test:coverage` | 60 files, 1391 tests passed. All files 95.66 stmts, 89.56 branches, 94.8 funcs, 96.58 lines. addon 100 lines, server 99.31, shared/model 100 |
| `npm run build -- --env dev` | Code.js 345.5 KB of 800 KB (base 335.7), index.html 340.6 KB of 400 KB (unchanged) |
| `npm run scopes:check` | 10 scopes, all approved; manifest not in the diff |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on all 11 views |

Not in the diff: appsscript.json, package.json, package-lock.json, scripts/, src/web, test/unit/web, test/unit/entry.test.ts (warm call counts unchanged and green). `setSendStatus` appears only in comments.

## Secret scan

No hit for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, github_pat, AKIA, xox, eyJ. Added addresses are test or role placeholders (`safety@`, `payroll@`, `s9-*@migway.com`, example.com, partner.com, x.com). One URL: `https://script.google.com/macros/s/TEST/exec` (test port). No owner address in the diff. No new network call.

## Questions a to i

a. Draft integrity: REJECT (must fix 1). Accepted parts, by probe of `recipientActions`: display-name entries (`Name <T@Example.com>`) are kept verbatim and count as present; mixed case and trailing spaces match; duplicates in the draft are kept; 30 draft addresses are kept in order with the new one appended; an address in another field is skipped and its field gets no action; an empty draft gets all 3 actions; a field with nothing to add gets no action (recipients.ts:84). Missing key, non-array and non-string entry: the field reads as empty and the action wipes it. The build neither skips nor refuses.

b. Disclosure: ACCEPT for the preview path, REJECT for the prompt card content (must fix 2). Probes through `insertFlow` with the real server: no `rh` and no prompts gives the preview card (push), confirming the handoff; forged, empty and upper-cased `rh` give the card with the change line and no insert; `subject=use` without `rh` gives the preview card; `subject=skip` inserts with `{}` recipients; reordered lists change the hash and give the card. A cached row without `rc` sends `onInsert` without `rh`, so it gets the preview card. Prompt card: forged `rh` gives the card; no `rh` inserts with no recipients. The hash covers To, Cc, Bcc and `blocked` (recipients.ts:92-99) over server-normalized lower-case lists, so case and order cannot make a different list match. Rows (home, folder, search, favorites, recent) all use `templateItem` -> `rowButton` (src/addon/cards/folder.ts:35-46, 73).

c. Server: ACCEPT. `use` holder update and create: DENIED. Private folder owner can set Bcc (Q37). Omitted lists are kept; `cc: []` clears Cc. With `deny`, an update that omits the lists fails `RCPT_EXTERNAL` on the stored outside address, so omission cannot keep a forbidden address. Duplicate gives VALIDATION `RCPT_EXTERNAL`; restore of a version with an outside address gives VALIDATION. `template.apply` and `template.getBody` return `to: [t@example.com], cc: [], blocked: [out@partner.com]`. Sidebar `rc` counts after `deny`: `[1,0,0]`. Import drops format, external and cross-field duplicates and reports counts. `template.move` does not re-validate (spec 5.7).

d. Exposure: ACCEPT. Outsider `template.apply`, `template.getBody`, `template.get`: DENIED. Outsider `template.list` and `sidebar.home` hold neither the item nor an address. `sidebar.home` for a `use` holder holds no `@`. `search` for a local part returns nothing; `search.body` for an outsider returns nothing. `audit.query` DENIED for `use` and `edit`. The logger writes no message field (src/shared/log/logger.ts:107-127); a probe of all log lines found no template address. The `RCPT_DUPLICATE` text names the address but goes only to the editor that typed it. The add-on test "no draft address reaches the server" passes and the draft object carries counts. Cache key: unchanged (minor above).

e. Injection: ACCEPT. Each rejected with `RCPT_FORMAT`: `"<b>x</b>" <a@b.c>`, a newline pair, `a@b.c, d@e.f`, `x@bücher.de`, `a@b.c>,<evil@x.y`, `a@-b.co`, `a..b@c.de`, `a@b`, `{{x}}@a.bc`. 5,000 characters: `RCPT_TOO_LONG`. Punycode `x@xn--bcher-kva.de` is accepted as plain ASCII. Trailing U+2028 is trimmed. Card text goes through the renderer's escape (render.ts).

f. Old data: ACCEPT. A legacy item and version file (no lists) apply with `[]`, duplicate with `[]`, `version.get` gives `[]`, restore gives `[]`. `indexProblem` accepts a legacy index and refuses a string, a mixed list and null. Existing test "reads as no recipients with no write" passes.

g. S6 harness: ACCEPT. No `spikeS6`, `onS6*`, `s6` reply kind, entry point, test or smoke step remains; only comments cite the spike. S7 is untouched (src/addon/spikeS7.ts not in the diff) and dev only; its test changed only to drop the S6 section from the expected header list.

h. Smoke: ACCEPT with the iframe note. 9 steps. Step 6 relies on `openLinkFlow` dropping the view (flows.ts `clearView`), which it does. Example request matches the code.

i. Clean install and checks: all pass (table above).

## Acceptance criteria

1. Validator: met. 2. Data and write paths: met. 3. Server ops: met. 4. Recipient actions: not met (must fix 1). 5. Disclosure: not met (must fixes 2 and 3). 6. Side panel: met (`templateItem` and `previewCard` show no Insert outside compose). 7. S6 removed, record written: met. 8. Smoke and guides: met.
