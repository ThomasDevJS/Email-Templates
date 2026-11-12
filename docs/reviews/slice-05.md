# Review: slice 5 (subject, search, Favorites, Recent, S4 harness removal)

Verdict: **PASS**

Branch `slice/05-search-subject`, head b534836, base 36cd3df. 8 commits, 69 files, +2,999 / -699. Reviewer: reviewer agent, 2026-11-10.

All 14 acceptance criteria hold. No blocker. 6 minors, 2 of them spec text changes for the architect. Spike S5 (Q20, Q21) is unverified until the owner runs smoke "Slice 5" step 1.

## Commands (clean install in the worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, added 559 packages, audited 560, 16 advisories (14 moderate, 2 high), dev tree, unchanged from slice 4b |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| `npm run test:coverage` | exit 0. Test Files 46 passed (46), Tests 952 passed (952). All files: statements 95.33, branches 88.73, functions 93.97, lines 96.33. Lines: addon 100, server 99.31, shared 100, web 95.5 |
| `npm run scopes:check` | exit 0, "Scope check passed: 10 scopes, all approved." |
| `npm run build -- --env dev` | exit 0, Code.js 276.2 KB of 800 KB, index.html 284.2 KB of 400 KB |
| `npm run lighthouse` | exit 0, accessibility library 100, editor 100, history 100 |
| `git status --short` after the chain | empty |

## Secret, scope and network scan (whole diff 36cd3df..b534836)

- Token patterns (AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, github_pat, AKIA, xox, eyJ): 0 hits.
- Added email addresses: ana@, bob@, cy@example.com, eve@ and out@other.example. Test fixtures only. No real person.
- Added URLs: 0. No new `UrlFetchApp`, `fetch`, `XMLHttpRequest` or `sendBeacon`.
- appsscript.json, scripts/, package.json and package-lock.json unchanged. 10 scopes.

## Acceptance criteria

1. Subject: accept. `SUBJ_TOO_LONG`, `SUBJ_LINEBREAK` and `PH_*` with `field: "subject"` in src/shared/placeholders/validate.ts:199-230. `prepareFor` gets the subject on create, update (templates.ts readDraft), duplicate (templates.ts:263) and restore (history.ts:118). Probe: `"a\r\nb"`, `"a b"`, `"a\tb"`, 201 characters and `{{prompt:` are each rejected with the right code.
2. One response: accept. `insertReply` src/addon/cards/spec.ts:109, `insertResponse` src/addon/cards/render.ts:126-138. Spike S5 is smoke "Slice 5" step 1, unverified. No new scope.
3. Sidebar search: accept. src/server/handlers/sidebar.ts:166-194, top 20, visible set of `sidebar.home`, empty query returns `[]`.
4. Favorites: accept. src/server/handlers/favorites.ts, sidebar max 10, library star and "★ Favorites" filter with `aria-pressed`.
5. Recent: accept. `callerRecent` favorites.ts:27, sidebar max 5, hidden when empty.
6. Web app search: accept. `searchItems` src/web/library/model.ts, `search.body` after 300 ms (library.ts:19, 218-235), "/" focus test still green.
7. Ops out of `LATER_SLICE_OPS`: accept. Policy rows policy.ts:52-58 (`template.read` and `favorite`, both USE in matrix.ts:21-23). Role tests test/unit/server/search.test.ts:302-367.
8. S4 removal: accept (point i).
9. Q24: accept. sidebar.ts:247 returns `""` on `followUp`, no Directory read. Probe with `recipientEmailIfInternal` set on a follow-up: `recipientFirstName` is `""`.
10. Warm counters: accept. Pinned in test/unit/server/entry.test.ts; the suite passes.
11. `inlineHtml` unchanged: accept. `git diff 36cd3df -- scripts` is empty.
12. Smoke "Slice 5": accept. 9 steps, step 1 is spike S5. docs/ops/deploy.md:28 names `doGet` and `tick`.
13. 10 scopes, bundles 276.2 KB and 284.2 KB: accept.
14. Green from a clean install: accept (table above).

Data safety: accept (point f).

## Points a to i

a. Subject injection: accept.
- `renderSubject` (render.ts:119-131) reads token values once and joins them. Probe: values with CR LF, U+2028, U+2029, tab, NUL, `{{sender.title}}`, `{{ask:Y}}` and `<b>q</b>` render to one line. Tokens inside values stay literal text. No second pass, no line break.
- Cards: `markup` escapes `& < >` for `setText`, `setTopLabel` and `setBottomLabel` (render.ts:20-22, 44-49). Probe: subject `<a href="https://evil.example">x</a><b>b</b>{{ask:Z}}` reaches the preview card and the prompt switch as `&lt;a href=...&gt;...[Z]`.
- Web app: editor preview uses `textContent` (editor.ts:151). History uses `innerHTML` with `withChips(escapeText(subject))` (history.ts:98-101). Probe: `<img src=x onerror=alert(1)>` renders as text, `&lt;b&gt;` shows literally. Grid, library status and toasts go through `h()` text nodes.

b. Favorites and Recent leakage: accept.
- The list key is the server caller's email (favorites.ts:19, 55). Probe: `favorite.set` with extra `email`, `user` and `byUser` args for another user writes only the caller's entry.
- `favorite.set` and `favorite.unset` on a folder without `use` give DENIED.
- Every return path filters by the caller's visible IDs: `sidebar.home`, `template.list` and `search` ranking. Probe after `grant.remove`: favorites `[]`, template list favorites `[]`, search `[]`. The owner's favorite in a hidden folder never appears in another user's list.

c. `search` and `search.body`: accept.
- Both filter to visible templates before ranking. `search.body` reads text only for `listed` items (templates.ts:115). Probe: a hidden template's title, subject, `folder:HR` and body word return 0 results.
- Query cut at 200 characters (match.ts:50). Probe: a 120,000-character `search` and a 550,000-character `search.body` finish in 4 ms together. A non-string query gives VALIDATION.
- Drive cap holds. Probe: 30 cold texts give 25 Drive reads, 25 IDs, `skipped: 5`.
- Logs: probe found no query, subject or body word in `world.lines`.

d. `FAVORITES_REV` and `USAGE_REV`: accept, with minor 3.
- Writers run under the script lock: `setFavorite` favorites.ts:56, tick `flushBuffer` tick.ts:55, `upkeepSides` tick.ts:119. Each writer reads the file live from Drive.
- `snapshotProps.setProperty` writes through and updates the copy (metrics.ts:186-188).
- Readers put a cache set only when the file rev equals the published rev (sideCache.ts:53-57).
- With both properties missing, `sidebar.home` reads both files from Drive on every call. Probe: 2 calls, 4 Drive gets. `tick` publishes them within 5 min.

e. `favorite.set` partial write: accept, with minor 4. Probe: Drive `update` fails, the caller gets INTERNAL, `favorites.json` keeps rev 2 with the other user's entry, the property stays 2, the lock is released. Each write spreads the file it read under the lock (favorites.ts:61), so other users' entries survive.

f. Old data: accept. `readIndexDoc` and `withSubject` (data.ts:145-158, driveStore.ts:80, 108). Probe: subject stripped from `index.json` and every version file, cache cleared. `template.apply`, `template.getBody`, `version.get` and `sidebar.home` succeed with 0 Drive creates or updates and subject `""`. `template.duplicate` and `version.restore` also succeed.

g. Switch off: minor 2. Spec 5.6 says that switching off sends no subject action. The code does that (flows.ts:331). Asking a prompt that only the subject uses is a UX cost and does not break the spec.

h. Snippet search: minor 1. Spec 4.4 gives body weight 1 with no source. Section 10 budgets the sidebar search at "about 3 Script Cache reads", so a full-body read through `ft:*` does not fit. The spec should change to say the sidebar matches the 140-character index snippet. The code stays.

i. S4 removal is complete: accept. `spike.s4`, `spikeS4`, `onSpike*`, `s4Fixtures` and `src/shared/spike` have 0 hits in src, test, scripts, docs/ops and appsscript.json. Smoke Slice 4 step 9 points to docs/spikes/slice-04-insert.md. `SidebarHome.isAdmin` is gone. Spec 6 still has the `spike.s4` row, marked "removed in slice 5".

## Minors (non-blocking)

1. src/server/handlers/sidebar.ts:185 matches body terms against the 140-character `item.snippet` only. Fix: amend spec 4.4 (architect).
2. src/addon/flows.ts:323 asks subject-only prompts while "Replace the subject" is off. Fix (opinion): accept, or hide those fields when the card re-renders with the switch off.
3. Environments set up before slice 5 read `favorites.json` and `usage.json` from Drive on every `sidebar.home`, `template.list` and `search` call until the first `tick`. deploy.md:29 states this.
4. A crash between `writeSide` and `setProperty` (sideCache.ts:72-78) leaves readers on the older cached set until the next write. No data loss. The handoff states it.
5. Q21: smoke "Slice 5" step 1 does not record whether a reply compose event carries `gmail.threadId` or `gmail.messageId`. Spec 15 Q21 makes the reply default depend on that answer. Fix: add a boolean check in the S5 run, or record the decision without it.
6. Spec text is stale. Spec 6 status line still lists the 4 ops as stubs. Spec 5.6 Script Properties list lacks `FAVORITES_REV` and `USAGE_REV`. Owner: architect.

## Not verified

- Gmail behaviour: `UpdateDraftSubjectAction` together with the body action, `SwitchControl` form value `"on"`, `TextInput.setOnChangeAction` on blur, `performance.measure` in the HtmlService iframe. These are owner smoke steps 1, 3, 6 and 7.
- Timing-based existence probing (out of scope per brief).
