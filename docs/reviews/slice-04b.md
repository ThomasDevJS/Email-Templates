# Review: slice 4b (smoke defects and performance)

Verdict: FAIL. One blocker: the server does not enforce the request ID format on client-supplied IDs (review item f, AC 4). All 8 commands pass. The rest is accepted, with 5 minors.

Reviewed: `git diff 43f10de..slice/04b-smoke-fixes -- . ':!docs/handoffs' ':!PLAN.md'`, 45 files, +1679 / -236. Head 714adf0. Includes hotfix 9bbd262.

## Blocker

1. Client request IDs reach the log line unchecked on the add-on surface. `handleRpc` logs `requestField(raw, "requestId")` (src/server/dispatch/handle.ts:107); `parseRpcRequest` only requires a non-empty string (src/shared/model/protocol.ts:69). Probe: a `doPost` body with requestId `x\n{"level":"error"} ` plus 5,000 characters was logged in full, line length 5,435. JSON escaping keeps it on one line, so no line injection. Any text a client puts there (a token, body text) still lands in the log, against spec 11 and AC 3. The web path accepts `/^[A-Za-z0-9-]{8,64}$/` (src/server/entry.ts:123), which allows UUIDs and is not the `XXXXXXXX-XXXXXX` format of AC 4. Fix: one shared pattern `^[0-9A-Z]{8}-[0-9A-Z]{6}$` next to `newRequestId` in src/shared/requestId.ts; `handleRpc` replaces a non-matching ID with `requestIdNow()` for both surfaces; `rpc` uses the same pattern; a test per surface. Same treatment advised for `action` (handle.ts:106 logs the raw `op`; pre-existing): log it only when it is a known op.

## Minors (fix in this slice or record in PLAN)

2. The property snapshot defeats the double-check in `ensureTriggers` (src/server/jobs/triggers.ts:39 and 43, snapshot from src/server/runtime.ts:112). Probe: two serialized `doGet` executions that both read the stale `TRIGGERS_VERSION` reinstall twice (6 `create` calls). `installTriggers` deletes first, so the end state is 3 triggers. Fix: read `TRIGGERS_VERSION` live inside the lock.
3. `maintain` runs only in `doGet` (src/server/entry.ts:82). With only the add-on in use after a deploy that bumps `TRIGGERS_VERSION`, the old trigger set stays until someone loads `/exec`. A renamed job handler would fail every run and mail the owner. Today `TRIGGERS_VERSION` is "1" and unchanged, so nothing breaks now. docs/ops/deploy.md has no "open the web app after deploy" step; spec 16 still says "first web app request".
4. `loadIndex` sets `INDEX_REV` when unset (src/server/cache/indexCache.ts:72). Its value comes from the snapshot taken before the Drive read, so a reader racing the first write can set an older rev. Readers then serve that rev until `tick` repairs it (5 min). Only possible between `setup` and the first `tick`. Listed by the implementer; accepted.
5. Body entries `bd:*` share Script Cache capacity with index and member chunks. Eviction costs Drive reads, not wrong data. Accepted; watch `driveReadMs` in the next smoke run.
6. Admins can duplicate a template out of another user's private folder (probe: ok). The matrix gives admins `manage` there (D11), and smoke 4b step 5 says so. Accepted as designed; the owner should know.

## Review items a to h

- a. Accept. scripts/lib/html.mjs:36 builds the literal at build time; the eval argument is that constant, no runtime value reaches it. No other `eval` or `new Function` in src or scripts. Escaping round-trips: `\//`, `///`, `/*/`, `*/`, `//*`, `/**/`, lone `\ud800`, `\udfff`, U+2028 and U+2029 all eval back to the input; random fuzz of 191,075 strings over `/ * \ " ' \n U+2028 \ud800 a < ?`: 0 mismatches. `</script`, `</SCRIPT` and `<?` are still refused (scriptInlineProblems runs before escaping). Built dist/index.html: one `<script>`, literal 274,061 chars, no `//`, `/*`, `</script`, `<?`, `<!--`; evals to the 269,776-char bundle. The bundle has no `"use strict"`, so indirect eval keeps globals global.
- b. Accept. Index chunk keys carry `rev` and one missing chunk makes a miss (src/shared/cache/chunked.ts), so a reader gets one whole rev or Drive. A reader's late put of rev N can overwrite `idx:meta` after a writer published N+1; the next reader misses and reads Drive (one extra read, no stale data). Writers: `loadIndexForWrite` uses the cache only when its rev equals the file's appProperties rev, and `commit` (src/server/handlers/commit.ts) re-runs authorization inside the lock. `template.duplicate` commits through `addTemplate` and `commit`. races.test.ts passes.
- c. Accept. `readStoredBody` (src/server/handlers/body.ts:32) is called only from handlers after dispatch authorization (template.get, getBody, apply, duplicate). The key is `item.bodyFileId` from the index; the caller sends a template ID, never a file ID, and the only other caller-derived key is `prof:<email>`. Probe: after `template.delete` with a warm body cache, get, getBody and apply answer NOT_FOUND at once; moves change the folder in the index, which authorization reads. Bodies over 90 KB are skipped (body.ts:23); put errors are caught.
- d. Accept with minor 2. Writes update the snapshot copy (src/server/metrics.ts:189), so setup and `ensureStore` read back what they wrote. Triggers, setup and jobs (`job:*` health keys, `refreshMembers`) use live properties (runtime.ts:112, surface "trigger"). The one read-check-write across executions is `ensureTriggers` (minor 2).
- e. Accept with minor 3.
- f. Timing accepted, request IDs rejected (blocker 1). `requestTiming` (protocol.ts) keeps only 4 keys, integers 0 to 600,000. Probe: a string `"5\n"`, `1e9` and an unknown key were dropped. `calls` and server `timing` are numbers from the meters.
- g. Accept. Policy rows: duplicate `templateCopy` (edit on source and target), move `templateMove` (edit on both), delete `itemFolder` (trash level). Tests in test/unit/server/items.test.ts: no grant, use (DENIED), edit, manage (ok), admin (ok), add-on surface (DENIED). Probe with private folders: Bob duplicating Ana's private template (same folder or into his own), duplicating his own into Ana's private folder, moving into it, deleting or reading hers: all DENIED.
- h. Plausible. The cause the fix removes (selection re-rendered the library and focused `main`) is independent of the iframe: src/web/views/library.ts now selects in place, src/web/views/tree.ts:79 focuses the clicked row and :162 keeps focus on redraw. Reverting tree, editor, history and dialog to 43f10de fails 5 tests in app.test.ts, defect tests included. jsdom does not model the HtmlService nested sandbox frames. Owner checks by hand on `/exec` in Chrome: (1) Tab from the page top into the tree without a click lands on a tree row with a focus ring; (2) arrows and Enter then select and focus stays; (3) Shift+F10 in the grid opens the app menu and not Chrome's context menu; (4) Esc returns focus to the cell.

## Acceptance criteria

1. Accept. Defects 1 to 7 fixed; defect 1 cause named (stale `start` route after the first save, editor.ts `load`). Tests fail on the old code (5 web tests rechecked here).
2. Accept. Row menu, keyboard, confirm, soft delete, Move limited to edit folders (`moveTargets`), duplicate out of `LATER_SLICE_OPS`, role tests. Default deny holds.
3. Accept except blocker 1. Pattern A unchanged. Call counts in the handoff table; entry.test.ts pins warm `sidebar.home` and `template.apply`. `targetId` logs only well-formed 26-char IDs.
4. Reject (blocker 1). The generator is shared (src/shared/requestId.ts) and `Utilities.getUuid()` is gone from src; the server does not enforce the format.
5. Accept. html.mjs unchanged since 9bbd262.
6. Accept. docs/ops/smoke.md Slice 3 and 4 steps corrected; "Slice 4b" has 8 steps.
7. Accept. No manifest or approved-scopes change; scopes:check 10. Spike S4 harness untouched.
8. Accept. Results below.

## Security

- Secret scan of the whole diff `43f10de..slice/04b-smoke-fixes` (handoffs and PLAN included): 0 hits for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, github_pat_, AKIA, xox, eyJ, sk-. 0 email addresses added. One URL added: `https://a` in a test.
- Network: no new `UrlFetchApp` or `fetch`. The add-on still calls only its own `/exec`.
- Scopes: no change to appsscript.json or scripts/approved-scopes.json.

## Commands (worktree, 2026-11-10)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, added 559 packages, audited 560; 16 advisories (14 moderate, 2 high), dev tree |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run test:coverage` | exit 0, Test Files 42 passed (42), Tests 879 passed (879). All files: statements 95.25, branches 88.59, functions 93.88, lines 96.27. Lines: addon 100, server 99.31, shared 100, web 95.12 |
| `npm run build -- --env dev` | exit 0, Code.js 265.8 KB of 800 KB, index.html 278.2 KB of 400 KB |
| `npm run scopes:check` | exit 0, "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | exit 0, accessibility library 100, editor 100, history 100 |

Probes ran in a scratch copy (`git archive HEAD`), deleted afterwards. No file under src, test, scripts or config was edited.

## To pass

Fix blocker 1 with tests. Minors 2 and 3 are one-line fixes and a deploy.md step; fix them in the same retry or record them in PLAN.
