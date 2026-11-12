# Implementer to reviewer: slice 19, audit month file read

Branch `slice/19-audit-read` from `claude/gracious-franklin-3n8zbq` at 5065ba1. Not pushed, not merged.

## Done

- Cause confirmed in code: `advancedDriveClient.readText` calls `Drive.Files.get(id, { alt: "media" })`. The service parses media as JSON; a JSON Lines file of 2 or more lines throws `HttpResponseException: Response Code: 200`.
- `DriveClient.readRawText(fileId)`: the Drive REST media read (`restMediaReader` in restDrive.ts, UrlFetch with `ScriptApp.getOAuthToken()`) under both clients. `advancedDriveClient(files, blobs, rawMedia)` takes it as a third argument; runtime.ts passes it. No exception message is parsed.
- Callers on the raw read: `audit.query` `monthText` (via `StorePort.readRawText`, which replaces the port's `readText`), `appendAudit` (daily roll and tick roll), and `readBackup` (backup copies checked before a restore).
- `readText` stays on the Advanced service for `index.json`, side files and bodies (one JSON document each).
- Fake made faithful: Advanced `Files.get` with `alt: "media"` returns the parsed value for JSON and throws `HttpResponseException: Response Code: 200. Message: <text>` otherwise. The REST responder returns raw text. `World.urlFetch` answers Drive REST; `installGlobals` answers Drive REST by default.
- Runbook entry "Audit log does not load (fixed in slice 19)"; smoke.md section "Slice 19" (5 steps).

## readText callers (all 6 checked)

| Caller | Content | Affected before |
| --- | --- | --- |
| `audit.query` `monthText` | JSON Lines | yes (the reported defect) |
| `appendAudit` (daily `auditRolled`, tick early flush) | JSON Lines | yes, every roll after the file had 2 lines |
| `readBackup` (`backup.restore`) | JSON, or damaged text | yes for a damaged copy: answered INTERNAL "Internal error" in place of VALIDATION "This backup cannot be read" |
| `readIndex`, `readSide` | JSON | only a non-JSON live file: INTERNAL with the raw service error in place of "index.json is not valid JSON" (left for later) |
| `readBody` | JSON | no |

## Verified (how)

- Strict fake on the old src: 11 tests failed. Existing roll and query tests among them: adminReports "audit.query as admin: ok", "pages 50 rows at a time", "reads Drive at most twice per call...", export "keeps the event of a cold 1,000-template export...", jobs "rolls pendingAudit into the month file...", "leaves body files alone when the purge commit fails...", storage "appends audit lines per month...". Also adminReports "refuses a damaged index.json copy with VALIDATION..." (the backup finding).
- Test-only findings from the strict fake: 3 storage tests stored non-JSON fixture text ("1", "copy me", "{not json") and read it through the Advanced `readText`. Fixtures changed to JSON; the damaged-index test now expects the service error.
- New test/unit/server/auditRead.test.ts (11 tests): query over 1, 2 and 500 lines (list and `{id}`); blank and broken line; 1 media read, then 0 for 2 more queries (cache `aud:<month>` keyed by ID and size); HTTP 403 and 500 answer INTERNAL "Drive REST get failed with HTTP <n>", no event ID in log lines; daily roll into a 2-line file; tick roll of 300 pending events (over 200 KB) into a 2-line file; 403 and 500 during the daily roll keep all 300 pending, `job:daily:lastError` names the HTTP status and no event, the next run moves all 300.
- Storage test per client: `readRawText` returns 1-line and 2-line JSON Lines exactly; Advanced `readText` fails on 2 lines only.

## What an admin saw while the roll failed

- "Nightly backup and cleanup": "OK" until 48 h after its last success, then "Late" with the last error `Error: daily steps failed: auditRolled (HttpResponseException: Response Code: 200. Message: {...` (500 characters of audit lines, addresses included). The other daily steps (backups, purge, cleanup) still ran.
- "Save insert counts and refused actions": "OK" while `pendingAudit` stays under 200 KB; above that every tick fails at the roll and the trigger check after it, "Late" after 10 min.
- No event is lost: the append fails before `pendingAudit` is touched, and the next roll skips IDs already in the file. Recovery needs no manual step.

## Left for later

- `job:<name>:lastError` from failed runs on dev may hold audit lines (personal data in a Script Property); runbook names the optional delete. `recordJobError` writes any exception message; a filter there is outside this slice (src/server/jobs).
- Runbook "Recovery of a damaged index.json": with the Advanced client a non-JSON live file answers "Internal error", not "index.json is damaged". Text or code change for the architect.
- ADR errata for the architect: ADR-0002 "Drive access" says reads use `Drive.Files.get` with `alt: 'media'`; month files and backup copies now use Drive REST media under both clients. ADR-0002 Layout row `audit/YYYY-MM.jsonl` and the Q16 note: the REST client is no longer fallback-only; `urlFetchWhitelist` Drive prefix is required in every environment.

## Risks

- Dev only: the REST media read with the owner's token on a `drive.file` file created by the Advanced service. Same OAuth client, so expected to work; smoke "Slice 19" step 1 shows it.
- Files touched outside the listed set, needed for wiring: src/server/runtime.ts (passes the REST reader), src/server/metrics.ts (meters `readRawText` as a Drive read).

## Files touched

src/server/storage/{driveClient,advancedDrive,restDrive,driveStore,port}.ts, src/server/handlers/audit.ts, src/server/runtime.ts, src/server/metrics.ts, test/fakes/{drive,world,globals}.ts, test/unit/server/storage.test.ts, test/unit/server/auditRead.test.ts (new), docs/ops/runbook.md, docs/ops/smoke.md.

## Commands

`npm ci`; `npm run lint` (clean); `npm run typecheck` (clean); `npm run test:coverage` (68 files, 1924 tests passed, lines 97.96%); `npm run build -- --env dev` (Code.js 367.5 KB of 800 KB); `npm run scopes:check` (10 scopes, all approved); `npm run format:check` (clean).

## Retry 1 (review FAIL, docs/reviews/slice-19.md)

- Must-fix: `errorSummary` (shared/errors/codes.ts) = "<code> <error name>". `job:<name>:lastError` = "<time> <errorSummary>", or for daily a `JobError` "daily steps failed: <step> (<code>)". `runJob` rethrows a `JobError` with that text and deletes `lastError` on success (it did not before). Runbook: required check of `job:tick|refreshMembers|daily|triggers:lastError` after the deploy.
- Places checked for raw messages: health.ts `describe` (fixed), daily.ts step text (fixed), triggers.ts `recordJobError` (fixed through health.ts; `maintain` in entry.ts only logs), membership/snapshot.ts group warning stored in members.json (fixed, same summary), setup (runs in `runJob`), `serverLogger` (errorName and 3 `at` frames, no message), dispatch/handle (`toErrorBody`: AppError text or "Internal error"), audit `errorCode` (code only), admins.ts (message tested by regex, not stored), transfer.ts and transfer/plan.ts (AppError texts only), driveStore `readBackup` (AppError texts only).
- Minor 3: `fileUrl` refuses IDs outside `[A-Za-z0-9_-]` before any request. `encodeURIComponent` alone fails: WHATWG URL reads `%2e%2e` as `..`. Tested with `a/b`, `x?y`, `z#w`, `..`, `%2e%2e`, `.`.
- Minor 4: HTTP 429 answers QUOTA "Service is busy. Try again in a minute."
- Minor 5: `readIndex`, `readSide`, `readBody` read raw once when the Advanced read throws a non-AppError, so a damaged live file answers "index.json is not valid JSON" again.
- Tests: auditRead.test.ts 13 (lastError text, Admin job row shows step and code, damaged index.json with `leak@example.com` in no property, log line or rethrown message for daily and tick, a quoting platform error stored as "INTERNAL Error" and cleared by the next success). Updated texts in jobs (4), entry (1), membership (1), storage (1).
- Commands from a clean install: lint, typecheck clean; 68 files, 1928 tests passed; Code.js 368.3 KB; 10 scopes; format clean.
