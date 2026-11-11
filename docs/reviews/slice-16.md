# Review: slice 16, in-app admins (D32)

Date: 2026-11-11. Branch `slice/16-app-admins`, head 6bf8c86 (merge of main line 223f9bb into implementer head 9aae84e). Slice diff `f85db33..9aae84e`, 30 files, +1475 -32.

## Verdict: FAIL

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
