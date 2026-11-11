# Review: slice 16, in-app admins (D32)

Date: 2026-11-11. Branch `slice/16-app-admins`, head 6bf8c86 (merge of main line 223f9bb into implementer head 9aae84e). Slice diff `f85db33..9aae84e`, 30 files, +1475 -32.

## Final verdict: PASS (retry 1, head 64adc1c)

First review FAIL on 6bf8c86 (2 client texts). Retry 1 fixes both must-fixes and minors 1 to 5; see "Retry 1" at the end.

## First review verdict: FAIL

The security core holds. No probe let a non-admin gain admin, let an admin lock everyone out, or let a change escape the audit. Two client texts of spec 7.3 are wrong or never shown, and a real user reaches both. Both fixes are small and web only.

## Must fix

1. A refused admin in the Admins section reads "You don't have access to this template. Ask a folder manager." (`src/web/views/adminAdmins.ts:56` through `lineText`, text from `src/web/ui/status.ts:42-45`). There is no template, and a folder manager cannot help. Smoke step 5 reaches it: the removed pilot presses Add admin or Remove (and Save in Settings, same text, `adminSettings.ts:106`). Spec 7.3 says "existing DENIED text of section 7", so the spec text is wrong too. Fix: the architect sets one text in spec 7.3 and `docs/design/wording.md` (proposal: "You are no longer an admin. Reload the page."); the implementer shows it for DENIED in the `run` catch of `adminAdmins.ts` and in the Settings Save catch, with a web test each. Same place: do not set `aria-invalid` on the address input for DENIED or for a failed Remove (`adminAdmins.ts:57-58`); the input played no part.
2. The Directory error text "The address could not be checked. Try again." (spec 7.3) never reaches the screen. The server sends it as INTERNAL (`src/server/handlers/admins.ts:82-85`); the client maps every INTERNAL to the toast "Something went wrong. Try again." and leaves the status line empty (Chromium probe, `?fail=INTERNAL&failOp=admin.add`). Fix: add `details: { reason: "ADMIN_CHECK" }` to that error and show the server message in the status line for that reason in `adminAdmins.ts`; keep the code INTERNAL so the log level stays `error`. One web test.

## Minors

1. Level-row re-check uses the pre-lock admin flag (`src/server/dispatch/dispatch.ts:215,226`). Probe: an in-app admin's `grant.add` (manage for herself) authorized before an `admin.remove` and locked after it commits succeeds, and she keeps manage on the folder. Admin rows (`config.set`, `folder.create` at top level, `admin.*`) are refused correctly. The race window is one in-flight request, and the runbook step 5 already reviews grant changes by that actor. Fix when touched: in `recheck` for level rows, build the subject with `subjectFor(..., () => index)`.
2. `change` maps a null edit on `latest` to `[]` (`admins.ts:109`, `?? []`). Unreachable today (same lock, same index), but a future change would wipe the list. Use the edit result from `current`, or throw. It also loads the index twice under the lock (lines 104 and `commitLocked`): one extra `readIndexRev` per change.
3. The handoff says the web client retries INTERNAL 3 times (4 Directory reads per click). Probe with `failTimes=1`: no retry, the first failure shows the toast. One click = one Directory read. Accepted; the handoff line is wrong.
4. Smoke step 4 asks to "Record the Directory error text in Executions". The handler drops the Directory message: the log line carries only the new AppError. The step can still judge the outcome (refusal text vs toast). Reword, or log the raw message at `warn` without the address.
5. "<address> is already an admin." echoes the typed address, so an alias shows the alias (`adminAdmins.ts`, `typed.trim().toLowerCase()`). Show the listed primary address instead.
6. ADR-0008 Amendment says `indexProblem` accepts `admins` absent or an array; the code accepts any value and `adminEntriesOf` drops it. Safer than the ADR; architect to align the text.
7. Remove by an alias answers "not in the list" (no Directory lookup on remove). The UI only sends listed addresses. Accepted.

## Probes (scratch copy of 6bf8c86, `test/fakes/world.ts`, 19 probe tests)

Who is admin. One caller of `isAdminEmail` (`subjectFor`, `snapshot.ts:245`), two callers of `subjectFor` (`context.ts:53` request subject, `dispatch.ts:208` in-lock admin re-check on the in-lock index). No other path decides admin. Stored list variants, all with owner `config.get` still ok (index loads): upper case plus spaces grants (spec rule); plus-address both ways, dot variant, Cyrillic look-alike both ways, display name, array inside the list, nested entry, numeric email, string list, plain object, null, missing `addedBy`, numeric `addedAt`, trailing-dot domain, NUL, zero-width space, `__proto__` entry, empty string: all deny. Subdomain caller: AUTH_DOMAIN. Caller case variants of a listed address: admin. 10,000-entry list: 48 ms, the listed entry is admin, an add answers ADMIN_TOO_MANY.

Ops. Denial before data: non-admin `admin.add`/`admin.remove` on the web with a warm cache: Drive 0, Directory 0, one denied row buffered. Cold cache (+7 h): 2 Drive calls, the index read that the ADR-0003 Amendment names as the cost of option 1; Directory 0. Add-on surface (owner and user): DENIED, Drive 0, Directory 0. Arguments: array, comma or semicolon list, embedded newline, NUL, 100,000 characters, 300-character domain, extra field, null, string, array, object with `toString`, display name, `__proto__` key, outside, subdomain, unknown: each refused with VALIDATION or the right reason, Directory 0 before the form and domain checks, no write. A trailing newline is trimmed and accepted (spec: trim). Self-removal with case and space variants: ADMIN_SELF; owner self: ADMIN_SELF. Removing the break-glass owner: `changed: false`, owner still admin; with the owner also in the list, removal leaves the owner admin. Cap race (19 listed, two adds, one lands before the other's lock): second ADMIN_TOO_MANY, length 20. Mutual removal: second DENIED, one left. Admin removed between pre-check and lock: DENIED, nothing written. `setProperty` spy over 34 tests: no write to `ADMIN_EMAILS` or `ADMIN_GROUP`. Mutations: without `context.recheck` in `admins.ts` 2 tests fail; with the re-check reading the request index 2 fail; without `admins: latest.admins` in restore 1 fails.

Escalation. `config.set` with name `admins` or `__proto__`: VALIDATION. Crafted backup holding 2 other admins, restored after a removal: live list kept, removed admin not back. Live index without `admins`, backup with one: field stays absent (file and cache). `import` with `admins` at top level and in an item: ignored. Manage holder through `me`, `folder.list`, `template.list`, `sidebar.home`, `export.folder`, `grant.list`, `admin.folders`: no in-app address in any reply; `audit.query`, `config.get`: DENIED. Old data: index files written by f84a021, e710a56 and f85db33 load on the head; `config.get`, `folder.list`, `admin.add` work and keep folders, grants, settings. Rollback: the f85db33 build reads a head index, ignores the list (in-app admin denied, fail closed) and keeps it on its writes.

Timing. Index chunks are keyed by `INDEX_REV`, which the commit raises; the props snapshot is per request. Added admin: next request admin on web and add-on (`folder.list` shows the folder). Removed: next web op DENIED, next add-on `folder.list` without the folder. The add-on User Cache `view:*` (10 min) stays as the ADR accepts.

Directory. Same call as `lookupProfile` (`domain_public`, `basic`, existing scope). Mapping: "Resource Not Found: userKey" and any text with "not found" (also "Domain not found.", a timeout text naming "not found") answer ADMIN_NO_ACCOUNT; "Not Authorized...", "Service unavailable", "Empty response" answer INTERNAL; non-string or null `primaryEmail` answers ADMIN_NO_ACCOUNT; a primary outside the domain answers ADMIN_OUTSIDE. No list change in any failure. Both wrong mappings refuse; neither adds. Risk accepted; smoke step 4 checks the real texts.

Audit. One event per change in `pendingAudit` in the same index write: `admin.add`/`admin.remove`, actor, `targetType: admin`, `targetId` the address, `before`/`after` `{ email, admin }`. Repeat and unlisted remove: no event. VALIDATION: no event. Non-admin: one buffered denied row with `targetId` "". Log lines: `targetId` "" on all 6, no address in any line (actor only, as ADR-0002 allows).

Web (Chromium, dev harness). Texts match spec 7.3 for legend, explanation, rows ("Added by ... on ..."), read-only rows, empty list (Lighthouse run `admins=none`), label, Add busy "Adding..." with `aria-disabled`, add and remove results, 4 refusal texts. Own row has no Remove; Remove has the name "Remove <address> as admin". Dialog: title and body per spec, Cancel focused, Escape returns focus to the row's Remove, Tab reaches "Remove admin". After add, refusal and remove, focus is on the status line (`role=status`). Keyboard only: Enter in the field submits, the rows read in the AX tree as list "Admins added here". 390 px: no horizontal scroll. Remove busy text "Removing..." is not in spec 7.3 (harmless).

Docs. Admin guide carries the spec replacement line and both step lists; "never granted in the app" is gone from guides and ops. Runbook has "An admin account is taken over" (break-glass owner removes the rogue additions) and the restore line. Smoke "Slice 16" steps 1 to 8 are runnable by a non-developer except minor 4. Merge: `git show --remerge-diff 6bf8c86` is empty; the merge differs from 223f9bb only in the 30 slice files, each with the slice's exact hunks.

## Commands (clean install on 6bf8c86)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 0, 559 packages, npm audit 16 (14 moderate, 2 high), lock unchanged |
| `npm run lint` | 0 problems |
| `npm run typecheck` | clean |
| `npm run test:coverage` | 66 files, 1827 tests passed; lines 97.84, statements 97.02, branches 90.87 (addon 100, server 99.31, shared 100, web 96.13 lines) |
| `npm run build -- --env dev` | Code.js 366.2 KB of 800, index.html 378.7 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 runs, all 100 (new: admin config no admins) |

Diff checks: `appsscript.json`, `package.json`, `package-lock.json`, `scripts/lib/html.mjs`, `src/addon/**`, `src/shared/placeholders/**` untouched by the slice. Secret scan of added lines: no keys or tokens; addresses are `example.com` and `other.org` test data; no URLs; no hours of service examples.

## Only dev can show

- The real Directory error texts for a made-up address, a group address and an outage (smoke step 4).
- Whether `domain_public` returns suspended users and users hidden from the directory (hidden ones are refused, fail closed).
- An alias with its primary in another Workspace domain.
- Smoke steps 1 to 8 end to end, including the Gmail panel after removal.

## Retry 1 (head 64adc1c = 009a43a plus clean merge of main line 9773b75)

Verdict: PASS. No must-fix left. Retry diff `2224afd..009a43a` (first parent), 18 files, +377 -53.

Must-fix 1, DENIED text. Chromium, dev harness, `?fail=DENIED&failOp=<op>`: Add admin, Remove admin, Settings Save (after the "Turn off" dialog), Refresh groups, Empty trash, whole-library Export each show "You are no longer an admin, so nothing was changed. Ask an admin if you need access." (Export prefixes its own "The export did not start..." sentence). No other DENIED text on the page. Folder export as a manage holder (`?admin=0`) keeps the folder text. `aria-invalid` stays off on DENIED for Add and Remove. Text recorded in `docs/design/wording.md`. The 8 new web tests (`adminReports.test.ts` 7, `admin.test.ts` 1) all fail on the 6bf8c86 web code.

Must-fix 2, Directory failure. Server: INTERNAL, `details.reason` ADMIN_CHECK, retryable, list unchanged (3 error shapes). Chromium with `flaky@example.com`: the status line shows "The address could not be checked. Try again.", no toast, field not marked, focus on the status line.

In-lock subject. `lockedSubject` (`dispatch.ts:196`) rebuilds the caller from the snapshot and the in-lock index for admin and level rows; `any` rows return first. Probe, in-app admin removed between dispatch check and lock: `grant.add`, `template.create`, `folder.create` (top level), `folder.rename`, `template.delete`, `admin.add`, `config.set`, `backup.restore`, `trash.purge` all DENIED, 0 writes, 1 denied row each. On 6bf8c86 the first 5 level ops succeeded (4 with a write). Break-glass, group and in-app admins pass `grant.add`, `folder.create`, `config.set` in the lock. A user whose `edit` grant is removed mid-flight: DENIED, 1 row; with the grant: ok. Cost per level write: Drive calls 3 as before; props 13 (was 10, snapshot reads in prod), Script Cache 12 (was 10). Full suite passes, read-count tests included.

`editedList` with a null edit: CONFLICT "The admin list changed while you worked. Reload the page and try again."; `?? []` is gone; no reachable path writes an empty list in place of the real one.

Directory warn line: `action` "directory.users.get", `errorCode` "ADMIN_NO_ACCOUNT:404", "ADMIN_CHECK:503", "ADMIN_CHECK:0" (no `details.code`); no address, no message text, also when the Directory message names the address.

Results: `email` is the stored main address. Alias add returns the main address for add and repeat; the page shows "ana.moreno@example.com is already an admin." for the harness alias.

Regression of first-review checks: `config.set` name `admins` VALIDATION; crafted backup with another admin restores with the live list (removed admin stays out); `import` with `admins` ignored; audit events in the commit; added admin is admin on the next request, removed admin DENIED on the next web op and loses the folder in add-on `folder.list`.

Merges: `git show --remerge-diff 64adc1c` empty. 2224afd resolved 3 conflicts (implementer memory, reviewer memory, smoke.md) by keeping both sides. `src/addon/**`, `src/shared/placeholders/**`, `appsscript.json`, `package*.json`, `scripts/lib/html.mjs` equal 9773b75. Files that differ from 9773b75 are the slice files plus 2 memory files and the handoff.

Commands, clean install on 64adc1c:

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 0, 559 packages, audit 16 (14 moderate, 2 high) |
| `npm run lint` | 0 problems |
| `npm run typecheck` | clean |
| `npm run test:coverage` | 68 files, 1882 tests passed; lines 97.95, statements 97.11, branches 90.87 |
| `npm run build -- --env dev` | Code.js 364.7 KB of 800, index.html 379.2 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 16 runs, all 100 |

Secret scan of the retry diff: no keys, tokens or URLs; addresses are `example.com` test data.

Minors (retry 1):
1. The Directory warn line has `requestId` "" and `actor` "": it sits in the same execution as the `admin.add` line but carries no link to it. Pass the request ID when touched.
2. Spec 7.3 still says "existing DENIED text of section 7" for the Admins section; the architect aligns it with `wording.md`.
3. Open from the first review: smoke "Slice 16" not run on dev (criterion 16); real Directory statuses unverified.
