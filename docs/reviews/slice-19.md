# Review: slice 19 (audit month file read through Drive REST)

Date: 2026-11-11. Branch `slice/19-audit-read`, head ad343af (implementer 3687ba5 plus main a9402f5). Slice diff `5065ba1..3687ba5`.

## Final verdict: PASS (retry 1, review on ce47afd)

First review on ad343af: FAIL, kept below. Retry 1 section at the end.

## Verdict (first review): FAIL

The read fix is correct: query, rolls and restore work on JSON Lines, with clean errors and no loss. The privacy check fails. `recordJobError` still stores any exception message in `job:<name>:lastError`, and the Admin page shows it while a job is late. A damaged live `index.json` (Advanced `readText`) still puts file text with addresses into that property on the fixed build (probe 5). 1 must-fix, 5 minors.

## Commands (clean install on ad343af, run by the reviewer)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, npm audit 16 (14 moderate, 2 high; same as earlier slices) |
| `npm run lint` | exit 0, no output |
| `npm run typecheck` | exit 0, no output |
| `npm run test:coverage` | 68 files, 1924 tests passed, 0 failed; all files 97.13 statements, 90.87 branches, 97.96 lines; server/storage 99.48 lines |
| `npm run build -- --env dev` | "Built dev ad343af", Code.js 367.5 KB of 800 KB, index.html 379.2 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |

## Probes

Scratch copies of ad343af (git archive, node_modules linked). Copies deleted after.

1. Fake fidelity. The strict fake throws `HttpResponseException: Response Code: 200. Message: <text>` for non-JSON media and returns the parsed value for JSON, as dev showed. Fix reverted in a copy (`readRawText` back to Advanced `Files.get` with `alt: "media"`): 19 tests fail. 8 are existing tests (adminReports 5: audit.query as admin, pages 50 rows, Drive reads per call, cold 1,000-template export, damaged index.json copy; jobs 2: roll with crash, purge commit failure; storage 1: appends audit lines per month). 11 are new. The 1-line query test passes on the reverted build, as on dev (one line is one JSON document). The implementer's 11 = these 8 plus the 3 storage tests with non-JSON fixtures before their change. Consistent.
2. Query. 1, 2, 500 lines: all rows, `{id}` finds the last line. Blank, `{broken`, `garbage` lines skipped. Non-ASCII (é, CJK, emoji, U+2028) round trips exactly. 6,500 lines, 4,569,500 bytes: total 6,500, 1 media read, second query 0 reads (cache `aud:<month>` keyed by ID and size, code unchanged apart from the read call). Drive calls per query: 2 on a miss, 1 on a hit (adminReports test, `readRawText` metered as a Drive read in metrics.ts).
3. REST errors. HTTP 401, 403, 404, 429, 500: response INTERNAL retryable "Drive REST get failed with HTTP <n>"; no file text, no token in the response or in log lines. Thrown fetch: response "Internal error"; log line has errorName and 3 stack frames, no message. The token travels only in the `Authorization` header; no URL contains it.
4. URL from ID. The file ID goes into the URL unencoded (restDrive.ts:87, also 129, 142, 150, 157). `..` and `%2e%2e` resolve to `https://www.googleapis.com/drive/v3/?alt=media`; `a/../../../oauth2/v1/x` to `https://www.googleapis.com/drive/oauth2/v1/x`; `#` drops `alt=media`. The host stays www.googleapis.com in every case. IDs come only from Drive `files.list` results (`findChild`, `listAuditFiles`); `audit.query` takes a month matched by `^\d{4}-(0[1-9]|1[0-2])$`, never an ID. Minor 1.
5. Rolls. Daily into a 2-line file: appended, pending empty. HTTP 500 on the read, 300 pending events of 700 bytes each (over 200 KB): the 5-minute job throws, 300 kept, 0 Drive writes; `job:tick:lastError` = "AppError: Drive REST get failed with HTTP 500". The daily run then fails `auditRolled` too, 300 kept, its only writes are the backup step (1 folder, 3 copies), none to the audit file. After recovery: file 302 lines, 302 unique, pending order kept. Crash at the index commit after the append: file 302, pending 300; next daily: file 302 unique, pending 0. Implementer tests cover the tick roll over 200 KB and 403/500 in the daily roll.
6. Restore. `readBackup` reads every copy before `withLock` (config.ts:231 vs 238). Damaged `index.json` copy `{not json`: VALIDATION "This backup cannot be read: index.json is not valid JSON", live files unchanged (adminReports.test.ts:1120). Slice 16 test "backup.restore keeps the live list and records liveAdminsKept" passes.
7. Privacy on the fixed build. Live `index.json` set to `{"x": "leak@example.com"\n{`, cold cache, daily via `runJob`: `job:daily:lastError` = `2026-11-09T19:00:00.000Z Error: daily steps failed: auditRolled (HttpResponseException: Response Code: 200. Message: {"x": "leak@example.com"`. Log lines: 0 hits. A thrown fetch writes the Drive URL with the file ID into the same property.

## What dev wrote while the roll failed (code at 5065ba1)

- `job:daily:lastError`: `<time> Error: daily steps failed: auditRolled (HttpResponseException: Response Code: 200. Message: <audit lines>`, cut at 500 characters. Audit lines carry `actor` addresses, `targetPath` names and `before`/`after` values.
- `job:tick:lastError`: the same exception text, only if `pendingAudit` passed 200 KB on some tick.
- Admin "Settings and backups": the job row shows `lastError` while the job is "Late" or "Never ran" (config.ts:92, adminConfig.ts:45-47). Daily turns Late 48 h after its last success, so admins saw the text on dev from then on.
- Apps Script: `runJob` rethrows, so the Executions page and Cloud Logging (`exceptionLogging: STACKDRIVER`) hold the full message of every failed daily run, and the owner's trigger failure emails quote it. These entries cannot be deleted by the app; they expire under the platform retention.
- `serverLogger` lines: errorCode INTERNAL, errorName, 3 `at` frames. No message text.
- `audit.query` response: "Internal error". Audit rows: reads write none; `errorCode` holds a code only.

The fixed build writes "Drive REST get failed with HTTP <n>" for an HTTP failure of the REST read. Any other exception (damaged live file through Advanced `readText`, a thrown fetch, a platform error) still lands raw in the property and on the Admin page.

## Must-fix

1. src/server/jobs/health.ts:15-19 (`describe`) and src/server/jobs/daily.ts:240-242. Both copy `error.message` into `job:<name>:lastError`, shown by the Admin page. Fix: store `<time> <code> <errorName>` with `toErrorBody(error).code`, and build the daily error as `<step> (<code>)`. Never store a raw message. Have `runJob` (health.ts:61) rethrow a new Error with the same short text, so Executions, Cloud Logging and the failure email stop carrying file text. Update auditRead.test.ts (expects `HTTP <n>` in lastError) and add a test: damaged live `index.json` with an address, daily and tick, property and thrown message free of it.
   Runbook docs/ops/runbook.md:181: replace "Optional cleanup" with a required check step: "After the first OK nightly run on dev, open Project Settings, Script properties, delete `job:daily:lastError`, and delete `job:tick:lastError` if it contains `Response Code: 200`. Executions and Cloud Logging keep the old messages until they expire."

## Minors

1. restDrive.ts:87 (and 129, 142, 150, 157): wrap the ID in `encodeURIComponent`. Host cannot change; the path can (probe 4).
2. HTTP 429 from the REST read answers INTERNAL; QUOTA with the busy text fits better.
3. storage.test.ts:475 now pins the raw `HttpResponseException` for a damaged live `index.json`. The 2 other fixture changes (update, copy) are fine: production `readText` reads only JSON documents, and the new `readRawText` test covers JSON Lines. This third one records a real case: a damaged live file loses "index.json is not valid JSON" and carries its text in the exception. Reading `readIndex`/`readSide` through `readRawText` would restore the message (handoff "left for later").
4. ADR-0002 errata (Drive access via `alt: 'media'`, REST no longer fallback-only, whitelist Drive prefix required everywhere): architect.
5. UrlFetch use: about 1 read per audit page cache miss, 1 per month per roll, 3 per restore; under 100 per day against 20,000 (consumer) or 100,000 (Workspace).

## Scope, scopes, secrets

- Files: storage (5), handlers/audit.ts, runtime.ts, metrics.ts, fakes (3), 2 tests, runbook, smoke, handoff, implementer memory. No change in src/addon, src/web, appsscript.json, docs/spec.md, docs/adr.
- Token: `ScriptApp.getOAuthToken()`, the script's own 10 scopes; the read needs `drive.file` and `script.external_request`, both listed. `https://www.googleapis.com/drive/v3/` is in `urlFetchWhitelist`. No new host.
- Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, eyJ, addresses): 0 hits; only example.com addresses.

## Only dev can show

- `audit.query` for 2026-11 answers rows (REST media read with the owner token on a file the Advanced service created).
- The next nightly run turns "Nightly backup and cleanup" OK and empties `pendingAudit`.
- The exception name the platform uses for a failed Advanced media read (the fake uses `Error`).

## Retry 1

Date: 2026-11-11. Head ce47afd. Diff `0209752..ce47afd`: health.ts (`JobError`, `jobErrorText`, success deletes `lastError`, `runJob` rethrows the safe text), daily.ts (`<step> (<code>)`), codes.ts `errorSummary`, snapshot.ts group warning, driveStore.ts `documentText` fallback, restDrive.ts `fileUrl` and 429, tests, runbook.

### Verdict: PASS

The must-fix is fixed. No file text, address or token reaches a property, a log line, a rethrown message, a response or `members.json` in 7 probe cases. 0 must-fix, 2 minors.

### Commands (clean install on ce47afd)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, npm audit 16 (14 moderate, 2 high; unchanged) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 68 files, 1928 tests passed, 0 failed; all files 97.13 statements, 90.95 branches, 97.97 lines |
| `npm run build -- --env dev` | Code.js 368.3 KB of 800 KB, index.html 379.2 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | exit 0, clean |

### Probes (scratch copies of ce47afd and ad343af, deleted after)

1. Leaks. Damaged `index.json`, `usage.json`, `favorites.json`, `members.json`, a body file and the audit month file, each holding `leak@example.com` and `ya29.FAKETOKEN_abc`. Per case: daily, tick and membership refresh through `runJob` (cold cache), then 6 web requests. Fixed build: 0 hits in Script Properties, log lines, other Drive files, rethrown messages (with stack) and responses, in all 6 cases. A group read throwing the same text: warning "Group g@example.com could not be read (INTERNAL Error). Previous members kept.", 0 hits in `members.json` and `membership.status`. On ad343af the same probe hits: properties (index, members), rethrown messages (index, members), `members.json` and `membership.status` (group). The probe finds real leaks.
2. Admin row text. Damaged index: `job:daily:lastError` = "<time> daily steps failed: auditRolled (INTERNAL), purged (INTERNAL), orphans (INTERNAL)"; tick and refreshMembers = "<time> INTERNAL AppError". The row names the job, the step and the code. Responses now say "index.json is not valid JSON", "usage.json is not valid JSON", "favorites.json is not valid JSON".
3. Grep of `src/server` for `.message`, `.stack`, `String(error`, `${error`: 10 uses.
   - health.ts:23: `JobError` message only, built from step names and codes. Safe.
   - triggers.ts:40: wraps a non-Error; stored through `recordJobError`, so code and name only. Safe.
   - admins.ts:104: regex test for "not found", never stored or returned. Safe.
   - transfer.ts:286, 292, 311, 534-538, transfer/plan.ts:51: AppError texts from validators of the admin's own import file and folder names, returned to that admin; `toErrorBody` gives "Internal error" for any other error. Safe, unchanged.
   - driveStore.ts:219: AppError text from `readChecked` ("<name> is not valid JSON", "<name> is damaged: <problem>"); shape.ts problems name fields and positions, never values. Safe.
4. Fallback cost. 20 healthy requests over 5 ops with a cold cache each time: 68 Drive calls, 0 UrlFetch on ad343af and on ce47afd. A healthy JSON file never takes the REST path. Transient Advanced failure on a valid `index.json`: 1 REST media read, request ok (ad343af answered INTERNAL). The fallback is one `try` with one second read; the REST error propagates, so it cannot loop. Damaged index plus REST 500: 1 fetch, INTERNAL "Drive REST get failed with HTTP 500". When the Advanced read fails and REST returns valid JSON, the REST text wins. That is safe: the same file bytes, then the same `readChecked` shape check.
5. `fileUrl`. Refused: `..`, `%2e%2e`, `a/b`, `a?x`, `a#b`, empty, `leak@example.com`, with "Drive REST refused a malformed file ID" (no ID echoed, 0 requests). A 39-character Drive-style ID passes. All 8 fake Drive IDs and all 1928 tests pass the rule.
6. HTTP 429. Query: QUOTA, retryable, "Service is busy. Try again in a minute." Daily roll: "daily steps failed: auditRolled (QUOTA)", 300 pending kept, file unchanged; next run: 302 lines, 302 unique, 0 pending.
7. Job health. `jobStatus` reads only `lastOk`; Late and Never do not depend on `lastError`. A failure keeps `lastOk` and writes `lastError`, so a late job still shows its last error until the next success deletes it.
8. Regression of the first-review probes. 6,500 lines with é, emoji and U+2028 plus a broken line: total 6,500, 1 media read for 2 queries. Roll recovery and crash dedupe: covered by auditRead tests (pass). Restore: damaged-copy VALIDATION tests and slice 16 "keeps the live list" pass; `readBackup` is still before `withLock`.

### Minors (retry 1)

1. `documentText` falls back on any non-AppError, including Advanced quota and 404 errors: 1 extra UrlFetch per failed read. Healthy path unchanged.
2. `job:triggers:lastError` is not deleted by a successful reinstall (`installAndRecord`); the Config tab shows it only while `TRIGGERS_VERSION` is stale. The runbook step covers the old text on dev.

Open from the first review: ADR-0002 errata for the architect. Runbook check (runbook.md, "Required after deploying this build") names all 4 `lastError` properties and the expiry of Executions and Cloud Logging entries.
