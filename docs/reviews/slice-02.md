# Review: slice 2, data and permission layer

Verdict: FAIL

Reviewer run 2026-11-09. Branch `slice/02-data-permissions`, head 2f083e2, base c84cc7e. Node 22, all commands run in the worktree after `rm -rf node_modules dist coverage`.

## Reason for FAIL

One blocker: write handlers authorize against the index read before the lock and never re-check the target folder inside the lock.

- Problem: a concurrent move lets a caller change a template in a folder where the caller holds no level. `template.update` also silently reverts the move.
- Cause: `dispatch.authorize` resolves targets from `context.access().index` (src/server/dispatch/dispatch.ts:99-121). The mutation runs later under the lock on a fresh index. `templateUpdate` sets `folderId = args.folderId || known.folderId` from the pre-lock copy (src/server/handlers/templates.ts:178) and writes it inside the lock. `template.move`, `template.delete` and `template.restoreFromTrash` (`changeItem`, line 204) and `folder.rename/move/delete` (`changeFolder`, optional `baseVersion`) also act on whatever folder the record sits in at commit time. Item `version` does not change on move (spec 5.3: version = currentVersion), so `checkBaseVersion` does not catch it.
- Reproduced in a scratch copy (worktree not edited): ana holds `edit` on A only; item X in A; during ana's body file create (save step 2) the owner moves X to B. ana's `template.update` returns ok, and `index.json` shows X back in A. ana changed an item that sat in B, and the owner's move is lost.
- Fix: inside the lock, compare the record's current folder (and for folders, current parent) with the folders authorized before the lock. On a difference return `CONFLICT` (or re-run the level check on the fresh index). In `templateUpdate`, keep `before.folderId` when `args.folderId` is empty. Add a race test like the existing "detects a conflict inside the lock" test for update, move, delete and folder move.
- Next: implementer fixes on this branch, reruns the command list, updates the handoff. Retry 1 of 2.

## Command results

| Command | Result |
|---|---|
| `rm -rf node_modules dist coverage && npm ci` | PASS, "added 427 packages, and audited 428 packages in 8s". npm audit: 16 vulnerabilities (14 moderate, 2 high), all in the dev tree; lock unchanged by this slice |
| `npm run lint` | PASS, exit 0 |
| `npm run format:check` | PASS, "All matched files use Prettier code style!" |
| `npm run typecheck` | PASS, exit 0 |
| `npm run test:coverage` | PASS, Test Files 21 passed (21), Tests 385 passed (385) |
| coverage | statements 99.15% (1402/1414), branches 94.15% (644/684), functions 100% (477/477), lines 99.45% (1279/1286). Lowest file: indexCache.ts 94.28% lines |
| `npm run build -- --env dev` | PASS, Code.js 100.9 KB of 800 KB, index.html 1.5 KB of 400 KB |
| `npm run build -- --env prod` | PASS, Code.js 100.8 KB, expected "no execUrl" warning. dist/Code.js has 11 top-level functions, equal to `ENTRY_POINTS` |
| `npm run scopes:check` | PASS, "Scope check passed: 10 scopes, all approved." |

## Extra checks

| Check | Result |
|---|---|
| (a) export allowlist | PASS. 11 exports, 4 surfaces in src/shared/entryPoints.ts. entry.test.ts compares bundle exports with `ENTRY_POINTS` both ways; manifest add-on functions must be `addon`; trigger handlers and `setup` must be `trigger` |
| (b) trigger and setup guards | PASS. `triggerAllowed` needs effective = `OWNER_EMAIL` plus active = owner, or blank active and a `triggerUid` of this handler's project trigger. Tests: other user with a real `triggerUid` refused for all 3 jobs with 0 Drive calls; forged and cross-job uid refused. `setupAllowed` needs active = effective; test "refuses a call through google.script.run by another user" plus non-owner editor |
| (c) deny before storage | PASS with note. Path: blank caller, domain, policy row, handler row, web-only surface, then `context.access()` (index and snapshot read), then deny; the handler runs only after. Admin-only rows also load the index before the admin check, which they do not need (cold cache = 1 Drive read before deny). Unknown target IDs answer `NOT_FOUND` before `DENIED` |
| (d) role matrix test | PASS. 17 rows x 4 roles = 68 `it.each` cells copied from ADR-0003 Part C, plus private folder of self, inheritance, child-to-parent leak, move source and target, cycle, unknown folder |
| (e) cache and boundary | PASS. 0 `getUserCache` in src/server. src/addon has 0 references to Drive, DriveApp, GroupsApp, AdminDirectory, CacheService, PropertiesService, LockService or src/server. Boundary test extended |
| (f) save sequence | PASS for the sequence: body file before `withLock`, `writeIndex` is the commit, `publishIndex` sets `INDEX_REV` after. CONFLICT (pre-check and inside lock) and BUSY tested; crash points after body create and after index write tested. Blocker above is a separate defect in the same path |
| (g) audit | PASS. Security events go into `pendingAudit` inside `commitLocked`. Denied events go to `evt:*` under `tryLock(500)`. `rollAudit` appends with `appendUnique` (skips known IDs), then removes flushed IDs under the lock. Apply buffering exists; `template.apply` arrives in slice 4 |
| (h) runtime deps | PASS. `dependencies` is `{}`; package.json and lock unchanged |
| (i) manifest | PASS. 10 scopes equal scripts/approved-scopes.json `default`. urlFetchWhitelist: `https://script.google.com/macros/s/`, `https://script.googleusercontent.com/`, `https://www.googleapis.com/drive/v3/`, `https://www.googleapis.com/upload/drive/v3/` |
| (j) secret scan | PASS. 0 hits for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, JWT prefixes. Emails in added lines: only `@example.com` test addresses (ana, sales, a, admins, x, user, bob, boss, owner, gone, ghost, eu, editor, old, intruder, b, secret.recipient and case variants), `@other.com` (x, intruder, someone), `a@b.com`, `a@B.com`, `x@example.com.evil.com`. No real person. URLs: googleapis.com Drive v3 paths and script.googleusercontent.com only |
| (k) logger | PASS. Logger builds entries from a fixed field list; no message or args field exists. identity.test.ts sends a body, a prompt value and `secret.recipient@example.com` and asserts none appears |
| (l) spike sheets | GAP. Both sheets give clicks and a results table. slice-02-s2.md does not record the 2026-11-09 outcomes: a `drive.file`-only token got HTTP 404 at the front door (fixed by `drive.metadata.readonly`), and `getActiveUser` is set on token calls (curl ping returned the owner). Step 1 lists only 401 and 403 as front door refusals, not 404 |

## Gaps (non-blocking, fix with the retry where cheap)

1. slice-02-s2.md: add the two known outcomes above to the results table and 404 to step 1.
2. No test asserts the required level of each op against spec section 6. The completeness tests check keys and target resolvers, not that `template.delete` maps to `edit`. Rows read by hand: all 40 match spec section 6.
3. Admin-only ops load the index before the admin check (dispatch.ts:110). Check `need.kind === "admin"` from the snapshot first.
4. `purgeTrash` trashes body files outside the lock, then re-filters inside it. An item restored in between keeps its index entry but loses its body files.
5. `refreshSnapshot` reads groups outside the lock and writes `members.json` whole. A `grant.add` that runs `refreshGroup` during a trigger run loses its new group until the next 15-min run.
6. `spikeS2b` leaves `spike-s2b.json` in the data folder if the read or rewrite throws (no `finally` trash).
7. Writer adopts the file's `rev` on mismatch; ADR-0002 says "aborts on mismatch". The handoff documents the choice; ADR-0002 needs one line.

Tracked risks from slice 1 are closed: every export is guarded (a), and dispatch checks the caller domain (`AUTH_DOMAIN`).

## Not verified

Anything against Google: Advanced Drive on `drive.file`, `alt: 'media'` return types, GroupsApp, AdminDirectory, real `triggerUid` values, `getActiveUser` inside time-driven triggers. Spike S2 and S2b sheets cover them.

## Retry 1

Verdict: PASS

Reviewer run 2026-11-09. Fix commit 6052320 on top of 195ab90. All commands run in the worktree after `rm -rf node_modules dist coverage`.

| Command | Result |
|---|---|
| `npm ci` | PASS, "added 427 packages, and audited 428 packages in 7s" |
| `npm run lint` | PASS, exit 0 |
| `npm run format:check` | PASS, "All matched files use Prettier code style!" |
| `npm run typecheck` | PASS, exit 0 |
| `npm run test:coverage` | PASS, Test Files 22 passed (22), Tests 439 passed (439) |
| coverage | statements 98.97% (1445/1460), branches 94.06% (666/708), functions 99.59% (491/493), lines 99.39% (1318/1326). Only file under 100% functions: membership/snapshot.ts (lines 219, 233) |
| `npm run build -- --env dev` | PASS, Code.js 103.4 KB of 800 KB, index.html 1.5 KB of 400 KB |
| `npm run scopes:check` | PASS, "Scope check passed: 10 scopes, all approved." |

Findings:

1. Blocker fixed. `dispatch.authorize` returns the placement of the authorized targets (each target with its ancestor chain). `handlers/commit.ts` calls `context.recheck` on the index read inside the lock: changed placement gives `CONFLICT` (`reason: "moved"`), and a lower level on the same placement gives `DENIED`. Every write handler now commits through `commit`: template create, update, move, delete and restore, folder create, rename, move and delete, the private folder, and grant add and remove. `templateUpdate` takes `before.folderId` inside the lock. test/unit/server/races.test.ts has 9 tests and arms the race at the 10 s write lock. The original scratch scenario was rerun in a scratch copy (move during the body file create): the update answers `CONFLICT`, and X stays in B with its old title.
2. `purgeTrash` commits the index first, then trashes the body files, and a test covers it. `spikeS2b` trashes its file in `finally`, and a test covers it. `grant.add` reads the group before the commit and merges it after. `refreshSnapshot` and `mergeGroup` re-read `members.json` under the lock, and `refreshSnapshot` keeps groups the index references at write time. 2 tests cover this.
3. The ADR-0002 reason for adopting the file's rev is sound. The `rev` guard exists so a write that bypassed the lock is not lost. Adopting the file keeps that write, and aborting would refuse writes until something republished `INDEX_REV`. Item `version` and the new recheck still catch lost updates.
4. A policy-level test copies spec section 6: 39 rows plus 2 `folder.create` cases, plus a coverage check against `POLICY`. Admin-only rows now read only the snapshot before the deny.
5. The spike sheet records both outcomes in docs/spikes/slice-02-s2.md "Known outcomes": the 404 for `drive.file` alone, then 302 with `drive.metadata.readonly`, and `getActiveUser` set on the token call. Step 1 lists 404. It also records an open item: the add-on still gets 404 at the first hop.
6. Secret scan of 6052320: 0 hits for key or token patterns. Emails: `admins@example.com`, `ana@example.com`, `sales@example.com` only. The diff adds no URLs.

Remaining minor items (track, not blocking):

- `readPreviousSnapshot` returns an empty snapshot on any Drive read error. `mergeGroup` would then write `members.json` with only the new group until the next 15-min refresh. Admins in `ADMIN_EMAILS` keep access. Rethrow in `writeMerged` (slice 3 or 6).
- 2 uncovered functions in snapshot.ts (warning filter, read catch).
- The add-on still gets 404 at the first hop. That is a deploy issue outside this diff, recorded in s2.md.
