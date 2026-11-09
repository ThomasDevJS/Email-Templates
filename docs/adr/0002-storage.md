# ADR-0002: Storage, caching and concurrency

Status: Accepted 2026-11-09 (orchestrator, by owner delegation; was Proposed) (revised 2026-11-09 after D15: one project, near-zero maintenance)
Date: 2026-11-09
Deciders: owner (thomas@migway.com), architect

## Context

Data: under 1,000 templates, 100 folders, 500 users, design for 10x (BRIEF A1). Every save creates a version (summary.md section 2). Storage must be private to the server identity, because files shared to users can be opened in Drive and bypass the permission layer [R4 S11; summary.md section 3 item 1]. Firestore and billed services are out (BRIEF 1). Targets with 200 templates: sidebar load under 3 s, apply under 2 s p95, web app list and search under 1 s after first load (BRIEF 9).

Two owner decisions change the forces (PLAN D15, BRIEF 1 Operations):

- One Apps Script project, one manifest, one scope list [R4 S41]. Every scope the storage needs appears on every user's consent screen at self-install. An admin domain install skips the user consent screen [R4 S60].
- Near-zero maintenance. Nobody edits data by hand. Housekeeping runs on triggers. Fewest moving parts.

| Fact | Value | Source |
|---|---|---|
| Properties | 9 KB per value, 500 KB per store | [R4 S2] |
| Cache | 100 KB per value, 250-char key, 1,000 items, max TTL 21,600 s (6 h), best effort | [R4 S30] |
| Cache eviction | Observed FIFO by creation, about 100 items per eviction, reads do not protect | [R4 S30, S66] |
| Latency per read and write pair | Cache about 63 ms, Properties about 80 ms, SpreadsheetApp about 800 ms (third party) | [R4 S72] |
| Drive file read and write latency | No published figure. Measure in slice 2 | [R4 section 7] |
| Advanced Drive API | 325,000 units per min per user, read 5, write 50, list 100 | [R4 S70] |
| Advanced Sheets API | 60 reads and 60 writes per min per user per project | [R4 S71] |
| `DriveApp` scopes | `createFile`, `createFolder` need `drive`; `getFileById` needs `drive` or `drive.readonly`. `drive.file` is not accepted | [A9] |
| Consent text, `spreadsheets` (sensitive) | "See, edit, create, and delete all your Google Sheets spreadsheets" | [R4 S58], [A10] |
| Consent text, `drive.file` (non-sensitive) | "See, edit, create, and delete only the specific Google Drive files you use with this app" | [R4 S57], [A10] |
| LockService | Script, user, document locks. `tryLock`, `waitLock`. Max wait undocumented | [R4 S68, S69] |
| Simultaneous executions | 30 per user, 1,000 per script | [R4 S2] |

All server work runs as the owner (ADR-0003), so per-user quotas above are the owner's.

### Size estimate per record (JSON with field names)

| Record | Bytes | 1x count | 1x size | 10x count | 10x size |
|---|---|---|---|---|---|
| Item metadata (spec 5.3: ids, title, tags, snippet 140 chars, placeholders, audit stamps, version) | about 750 | 1,000 | 0.75 MB | 10,000 | 7.5 MB |
| Folder | about 300 | 100 | 30 KB | 1,000 | 0.3 MB |
| Grant | about 200 | 300 | 60 KB | 3,000 | 0.6 MB |
| Index file total | | | about 0.85 MB | | about 8.4 MB |
| Cache chunks of 90 KB for the index | | | 10 | | 94 |
| Favorites (10 per user, 30 bytes each) | | 500 users | 150 KB | 5,000 users | 1.5 MB |
| Usage (applyCount per item, 20 recent per user) | | | about 0.5 MB | | about 5 MB |
| Audit event (metadata before and after, bodies as references) | about 800 | 3,000 per month (estimate: 100 per day) | 2.4 MB per month | 30,000 per month | 24 MB per month |

## Options

1. Sheets index plus Drive bodies (the first proposal). Tabs for folders, grants, items, versions, favorites, usage, group snapshots, audit. One immutable Drive file per body version. Read: cache rebuild reads 3 tabs, about 3 x 800 ms = 2.4 s [R4 S72]. Write: one row update plus 2 appends, about 2.4 s, independent of index size. Cost under D15: `SpreadsheetApp` needs `spreadsheets`, so every user consents to "See, edit, create, and delete all your Google Sheets spreadsheets" for an email template tool [A10]. The add-on token then holds that power for every user (least privilege, BRIEF 10). A spreadsheet invites hand edits; an edited cell skips the optimistic version and the audit row. The Advanced Sheets service with `drive.file` avoids the scope but caps the whole product at 60 reads per minute through the owner [R4 S71], and `drive.file` support there is unverified.
2. Drive JSON only. All files private to the owner, all under `drive.file`, accessed through the Advanced Drive service v3 (DriveApp needs `drive`, restricted [A9]). One index file (folders, grants, item metadata), one immutable file per body version, small side files (favorites, usage, membership snapshot), audit as monthly JSON Lines files. Read: cache rebuild reads 1 file. Write: whole-file rewrite of the index under the script lock, cost grows with index size. No spreadsheet scope on the consent screen.
3. Drive JSON index plus Sheets audit tab. Option 2 for data, Sheets only for audit appends. Brings back `spreadsheets` for every user (option 1 cost) to gain append-without-rewrite for one log. Admins read the audit in the admin UI (owner requirement), so the tab offers no reading benefit. With the Advanced Sheets service and `drive.file` instead, audit writes share the 60 per minute owner cap [R4 S71].
4. Properties plus Cache only. 500 KB total cannot hold 1,000 templates [R4 S2]. Cache evicts [R4 S30]. Rejected as a store, kept as config and read cache.
5. Firestore. Excluded by the brief (billed GCP service).

### Comparison with numbers (1x unless stated; Drive figures are assumptions until spike S2b)

| Criterion | 1. Sheets index + Drive bodies | 2. Drive JSON only | 3. Drive index + Sheets audit |
|---|---|---|---|
| Scopes added for storage | `spreadsheets` (sensitive) + `drive.file` | `drive.file` only | `spreadsheets` + `drive.file` |
| Consent text every self-installing user reads | "all your Google Sheets spreadsheets" | "only the specific Google Drive files you use with this app" | "all your Google Sheets spreadsheets" |
| Cache rebuild (coldest sidebar path) | 2.4 s, sidebar total about 4.3 s | 1 file read about 0.6 s (assumed) + parse 30 ms, sidebar total about 2.6 s | as 2 |
| Cache rebuild at 10x | about 3 tabs of 10x rows, over 3 s (opinion) | 8.4 MB read about 2 s (assumed), sidebar total about 4 s | as 2 |
| Save (spec budget 3 s) | about 3.1 s | about 2.1 s (index write about 1 s assumed) | about 2.9 s (plus audit append about 0.8 s) |
| Save at 10x | about 3.1 s | about 4.5 s (8.4 MB write about 3 s assumed) unless sharded | as 2 plus 0.8 s |
| Script lock hold per write | about 1.6 s | about 1.3 s, about 45 writes per min serial | about 2.1 s |
| Apply (budget 2 s) | 1.85 s, cache path | 1.85 s, cache path | 1.85 s |
| Hand edits possible | yes, in the spreadsheet UI | no editable UI; JSON files only | audit tab editable |
| Moving parts | spreadsheet + bodies folder | one folder of JSON files | spreadsheet + folder |

## Decision

Option 2, Drive JSON only. It meets the 3 s sidebar and 2 s apply budgets at 1x with margin on the coldest path (2.6 s against 4.3 s for Sheets). It removes `spreadsheets` from the one consent list. It leaves no spreadsheet for anyone to hand-edit. Sheets would stay only if spike S2b measured a 0.85 MB Drive read above 2 s or a write above 2 s; then the save budget fails and option 1 returns with its consent cost stated to the owner.

### Layout

All files live in one folder `Migway Templates Data`, created by the setup function under the owner identity (files created by hand are invisible to `drive.file`). Script Property `STORE` holds the file and folder IDs as one JSON value (under 1 KB).

| File | Content | Writer | Size 1x |
|---|---|---|---|
| `index.json` | `{ schemaVersion, rev, updatedAt, folders[], grants[], items[], pendingAudit[] }` | requests, under lock | 0.85 MB |
| `favorites.json` | `{ rev, byUser: { email: [itemId] } }` | requests, under lock | 150 KB |
| `usage.json` | `{ rev, items: { id: { applyCount, lastUsedAt } }, recent: { email: [itemId] } }` | 5-min trigger | 0.5 MB |
| `members.json` | group snapshot (ADR-0003 Part B) | 15-min trigger | under 450 KB |
| `bodies/<itemId>.v<version>.json` | `{ itemId, version, html, plainText, savedAt, savedBy, note, restoredFrom, sha256 }`, immutable. `appProperties`: `itemId`, `version`, `savedBy`, `restoredFrom` | requests, outside lock | 2 to 100 KB each |
| `audit/YYYY-MM.jsonl` | one audit event per line, append-only, one file per month | daily trigger | 2.4 MB per month |
| `backups/YYYY-MM-DD/` | copies of `index.json`, `favorites.json`, `usage.json` | daily trigger | 1.5 MB per day, 14 kept |

Version history uses no extra index: `files.list` with `appProperties has { key='itemId' and value='<id>' }` returns all versions of one item in one call (100 units [R4 S70]).

Drive access: Advanced Drive service v3 (`Drive.Files.create`, `Drive.Files.update` with a media blob, `Drive.Files.get` with `alt: 'media'`, `Drive.Files.list`). Fallback if slice 2 shows the Advanced service rejects a `drive.file`-only token: Drive REST v3 through `UrlFetchApp` with `ScriptApp.getOAuthToken()`, same scope, `https://www.googleapis.com/` added to `urlFetchWhitelist`.

### Caching

| Layer | Key | Content | Size | TTL |
|---|---|---|---|---|
| Script Cache | `idx:meta` | `{ rev, chunkCount, builtAt }` | under 1 KB | 6 h |
| Script Cache | `idx:<rev>:<n>` | `index.json` text, 90 KB chunks | 10 chunks at 1x, 94 at 10x | 6 h |
| Script Cache | `fav:<rev>:<n>`, `use:<rev>:<n>`, `gm:<rev>:<n>` | side files, 90 KB chunks | 2, 6, 5 chunks | 6 h |
| Script Cache | `ft:<rev>:<n>` | plain-text bodies for search | about 23 chunks at 1x | 6 h |
| Script Cache | `body:<itemId>:<version>[:part]` | sanitized HTML | 90 KB parts | 6 h |
| Script Cache | `prof:<n>` | Directory profile map (ADR-0004) | chunked | 6 h |
| Script Cache | `evt:<n>` | buffered apply and denied events | 90 KB parts | 6 h |
| User Cache (add-on code only, as the user) | `view:<n>`, `body:<itemId>:<version>` | the caller's filtered list, bodies for apply | 2 chunks, 90 KB parts | 10 min |

Rules:

- Chunk sets are keyed by `rev`, so a reader never mixes two builds. Reads use `getAll`, one round trip. A missing chunk triggers a rebuild.
- Script Property `INDEX_REV` names the current revision (80 ms read [R4 S72]). Readers read `INDEX_REV`, then `idx:<rev>:*`. A miss rebuilds under the script lock from `index.json` (1 file read).
- The 5-min trigger checks `idx:meta` and re-puts every chunk set older than 5 h, so the 6 h TTL never lapses and FIFO eviction is repaired within 5 min. Users pay the coldest path only after an eviction inside a 5-min window.
- The server code never calls `CacheService.getUserCache()`: in the web app it returns the owner's cache, shared by every caller (ADR-0003 Part A).

### Concurrency

- One writer at a time. Every write takes `LockService.getScriptLock().tryLock(10000)`. Lock not acquired returns `BUSY` (retryable).
- Optimistic version inside the JSON. `index.json` carries `rev`; every item and folder carries `version`. The client sends `baseVersion`; a mismatch returns `CONFLICT` with the current version, author and time. `rev` guards against writes that bypass the lock (a restore from backup, a future bug): the writer re-reads `rev` inside the lock and aborts on mismatch. Revised 2026-11-09 in slice 2: the writer adopts the file (it reads `index.json` when the cached `rev` differs from the `rev` in its appProperties) instead of aborting, because a crash between save steps 6 and 7 leaves `INDEX_REV` behind by design and aborting would block every write until a rebuild; lost updates are still caught by the item `version` check and the in-lock recheck of target folders.
- Save sequence: (1) sanitize and validate (ADR-0004). (2) Create body file `<id>.v<base+1>.json` outside the lock. (3) Take the lock. (4) Load the index for `INDEX_REV` from cache, else from Drive; check `rev` and the item `version`. (5) Apply the change, append the audit event to `pendingAudit`, set `rev + 1`. (6) Write `index.json` (commit point; the change and its audit event land in one write). (7) Set `INDEX_REV`, put cache chunks. (8) Release. A crash after (6) leaves `INDEX_REV` behind the file; the next writer and the rebuild read `rev` from the file and adopt it.
- Lock hold at 1x: about 1.3 s (index write 1 s assumed, cache and Properties 0.3 s). Serial capacity about 45 writes per minute. Expected peak under 10 per minute (opinion: 50 editors). At 10x the hold reaches about 3.5 s and the save exceeds 3 s; see Revisit.
- Favorites use the same lock and file pattern on `favorites.json` (hold about 0.5 s).
- An orphan body file (step 2 done, step 6 failed or `CONFLICT`) is trashed by the daily job when its version exceeds the item's current version and it is older than 1 h.

### Version history

- New version on every save. Restore copies version K into version N+1, so history stays linear.
- Retention: all versions in v1 (Q15). 1,000 templates x 50 versions = 50,000 small files. Revisit at 50,000.
- Soft delete sets `deletedAt` and `deletedBy`. The daily job purges items deleted over 30 days ago and trashes their body files.

### Audit storage and admin view

- Security events (create, edit, move, delete, restore, grant change, export, import, backup restore) enter `pendingAudit` inside the same `index.json` write as the change. An event cannot exist without its change, or the reverse.
- Apply events and denied requests go to the `evt:*` cache buffer under `tryLock(500)` (fallback: skip buffering, keep the console log line). The 5-min trigger moves apply events into `usage.json` and denied events into `pendingAudit`. Cache eviction can lose up to 5 min of these events (Q14). Every request also writes a structured console log line (ADR-0003 Part D).
- The daily job appends `pendingAudit` to `audit/YYYY-MM.jsonl` outside the lock, then removes the flushed event IDs from `pendingAudit` under the lock. A crash between the two steps duplicates lines; readers drop duplicate IDs. The 5-min trigger flushes early when `pendingAudit` exceeds 200 KB (a bulk import).
- Month file rewrite cost: up to 2.4 MB once per day at 1x.
- Retention: the daily job trashes month files older than 24 months (Q10). 24 files, about 58 MB at 1x.
- Admin view (wireframe 06): month selector, filters, 50 rows per page. The server reads one month file (cached as `aud:<month>:<n>` chunks for 6 h) plus `pendingAudit`, filters, and returns one page. No admin opens Drive or Sheets.

### Backup and export

- Daily job copies `index.json`, `favorites.json`, `usage.json` to `backups/YYYY-MM-DD/` and trashes folders older than 14 days. Bodies and audit files are immutable or append-only, so they need no copy.
- Restore: admin UI "Restore from backup" (admin only) lists the 14 dates. The server copies the chosen files over the live ones under the lock with `rev = current + 1` and writes an audit event. No hand edit of files.
- Export as JSON from the web app: `{ schemaVersion, exportedAt, exportedBy, scope, folders[], grants[], items[{ meta, html }] }`, current versions only. Folder export needs `manage`, library export needs admin. The browser downloads a Blob (`allow-downloads` [R4 S46]).
- Import: admin only, same schema, every body passes the sanitizer, IDs remapped, conflicts reported per item. Import is also the migration path from dev to prod and between owners (below).

### `drive.file` binding (consequence of option 2)

`drive.file` grants access per user and per OAuth client (likely; the 2.5b dry run verifies). Two events change one of them: moving prod to a standard GCP project (new client, 2.5b) and a change of owner identity (Q3). Mechanism: 2.5b switches prod to the standard GCP project before the setup function creates any prod data. Pilot data moves from dev to prod by export and import. An owner change is an export, a setup under the new owner, and an import (runbook, slice 7). Sheets with `spreadsheets` would not have this constraint.

### Budget with 200 templates

Cache and SpreadsheetApp figures are third party [R4 S72]. Add-on start, UrlFetch to `/exec` and Drive figures are assumptions that spike S2b measures.

Sidebar load:

| Step | Warm (add-on cache hit) | Cold (server cache hit) | Coldest (server rebuild) |
|---|---|---|---|
| Add-on execution start (assumed) | 600 ms | 600 ms | 600 ms |
| User Cache `getAll` | 70 ms | 70 ms | 70 ms |
| UrlFetch to `/exec`, incl. redirect (assumed) | 0 | 900 ms | 900 ms |
| Server: identity, `INDEX_REV`, `gm`, `idx` `getAll` | 0 | 230 ms | 230 ms |
| Server: read `index.json` (0.85 MB, assumed 600 ms), parse, `putAll` | 0 | 0 | 750 ms |
| Filter and build card | 100 ms | 100 ms | 100 ms |
| Add-on cache write | 0 | 70 ms | 70 ms |
| Total | about 0.8 s | about 2.0 s | about 2.7 s |

Apply: add-on start 500 ms, UrlFetch 900 ms, server checks from cache 200 ms, render 50 ms, Gmail insert 200 ms. Total about 1.85 s. Fallback if p95 exceeds 2 s: render from the add-on cached body (10 min TTL), send the apply event with the next call. Revocation latency rises to 10 min.

Save: validate 50 ms, body create 700 ms (assumed), lock 50 ms, load index from cache 150 ms, write index 1,000 ms (assumed), Properties and cache 200 ms. Total about 2.1 s, under the 3 s budget.

Web app list and search: one call loads the caller's filtered index (under 1.5 s); title, folder and tag filtering runs in the browser (under 50 ms). Body matches come from one call over `ft:*` (under 1 s).

## Consequences

- Easier: one folder holds all data; one file read rebuilds the cache; the consent list loses `spreadsheets`; no spreadsheet UI exists for hand edits; change and audit commit in one write.
- Harder: every index write rewrites 0.85 MB at 1x and 8.4 MB at 10x. All writes serialize on one script lock. Data access is tied to the owner and the OAuth client (`drive.file`), so ownership and GCP project changes go through export and import.
- All server I/O counts against the owner's quotas and 30 simultaneous executions [R4 S2]. Peak estimate: about 1 concurrent execution on average. The add-on retries `Too many simultaneous invocations` once after 300 to 600 ms.
- Revisit when `index.json` exceeds 3 MB (about 3,500 items) or spike S2b measures a save above 3 s: split items into 16 files `items-<0..f>.json` by the last hex digit of the item ID hash. `schemaVersion` 2 marks it; the server migrates on the first request after deploy, under the lock. Revisit also at 50,000 body files.

## Open questions

- Q14. Apply and denied events may lose up to 5 min on cache eviction (console logs keep them). Recommendation: accept.
- Q15. Keep all versions in v1. Recommendation: accept, revisit at 50,000 files.
- Q16. Does the Advanced Drive service accept a `drive.file`-only token for create, update, get media and `appProperties` list? Recommendation: spike S2 tests it; fallback Drive REST through UrlFetch with the same scope.
- Q17. Spike S2b thresholds: Drive read of 0.85 MB under 2 s and write under 2 s keep option 2. Recommendation: accept these thresholds now, so a failed spike reopens this ADR with numbers.
- Q18. Prod data in the prod owner's My Drive or in a shared drive? A shared-drive folder created by hand is not visible to `drive.file`. Recommendation: the prod owner's My Drive (dedicated account, Q3); shared drive only if the 2.5b dry run shows the setup function can create its own folder there.
- Do `google.script.run` payloads above 1 MB fail? Undocumented [R4 S49]. Recommendation: page index responses at 500 items; slice 3 measures.

## Sources

- [R4 S2, S11, S30, S41, S46, S49, S57, S58, S60, S66, S68 to S72] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A9] https://developers.google.com/apps-script/reference/drive/drive-app (authorization sections of `createFile`, `createFolder`, `getFileById`), read 2026-11-09.
- [A10] https://developers.google.com/identity/protocols/oauth2/scopes (consent descriptions of `spreadsheets`, `drive.file`, `groups`, `admin.directory.user.readonly`, Gmail add-on scopes, `userinfo.email`), read 2026-11-09.
