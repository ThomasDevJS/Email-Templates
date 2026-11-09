# ADR-0002: Storage, caching and concurrency

Status: Proposed
Date: 2026-11-09
Deciders: owner (thomas@migway.com), architect

## Context

Data: under 1,000 templates, 100 folders, 500 users, design for 10x (BRIEF A1). Every save creates a version (summary.md section 2). Storage must be private to the server identity, because files shared to users can be opened in Drive and bypass the permission layer [R4 S11; summary.md section 3 item 1]. Firestore and billed services are out (BRIEF 1). Targets with 200 templates: sidebar load under 3 s, apply under 2 s p95, web app list and search under 1 s after first load (BRIEF 9).

| Fact | Value | Source |
|---|---|---|
| Properties | 9 KB per value, 500 KB per store | [R4 S2] |
| Cache | 100 KB per value, 250-char key, 1,000 items, default 600 s, max 21,600 s (6 h), best effort | [R4 S30] |
| Cache eviction | Overflow keeps the 900 items farthest from expiry. Observed FIFO by creation, about 100 items per eviction, reads do not protect | [R4 S30, S66] |
| Latency per read and write pair | Cache about 63 ms, Properties about 80 ms, SpreadsheetApp about 800 ms (third party) | [R4 S72] |
| Advanced Sheets API | 60 reads per min per user per project, 300 per project | [R4 S71] |
| Advanced Drive API | 325,000 units per min per user, read 5 units | [R4 S70] |
| SpreadsheetApp, DriveApp | No published daily cap, "Service invoked too many times" on excess | [R4 S2] |
| Sheets cell | 50,000 characters per cell (third party), 10 million cells per spreadsheet | [A2, A3] |
| LockService | Script, user, document locks. `tryLock`, `waitLock`. Max wait undocumented | [R4 S68, S69] |
| Simultaneous executions | 30 per user, 1,000 per script | [R4 S2] |

All server work runs as the server owner (ADR-0003), so per-user quotas above are the owner's. The Sheets API limit of 60 reads per minute would cap all 500 users together. SpreadsheetApp has no per-minute cap, so the server uses SpreadsheetApp and reads whole tabs once per cache rebuild.

## Options

1. Sheets only. One spreadsheet, tabs for folders, grants, templates (body in a cell), versions, audit. One backup file. Cost: bodies over 50,000 characters need multi-cell chunking [A2]. Version bodies bloat the spreadsheet, and open time grows with file size (opinion, measure). 1,000 templates times 30 versions times 10 KB is 300 MB of cell text.
2. Drive JSON only. One JSON file per template plus index JSON files. No row model for audit and grants. Index updates rewrite a whole file under lock. Listing needs one read per file on a cold cache; per-file DriveApp latency is unpublished [R4 section 7].
3. Sheets index plus Drive bodies. Spreadsheet holds structured rows (folders, grants, items metadata, versions metadata, favorites, usage, group snapshots, audit). Each template version body is one immutable JSON file in a private Drive folder. Index stays small. Versions add files, not rows of text.
4. Properties plus Cache only. 500 KB total cannot hold 1,000 templates [R4 S2]. Cache is best effort and evicts [R4 S30]. Rejected as a store. Kept as config (Properties) and read cache (Cache).
5. Firestore. Excluded by the brief (billed GCP service).

## Decision

Option 3, Sheets index plus Drive bodies, owned by the server identity, with Script Cache in front and a per-user cache in the add-on.

### Layout

- Spreadsheet `Migway Templates Data` (private to the server owner). Tabs and columns are in docs/spec.md section 5: `folders`, `grants`, `items`, `versions`, `favorites`, `usage`, `group_members`, `audit`, `meta`.
- Drive folder `Migway Templates Bodies` (private). One file per version, name `<itemId>.v<version>.json`, content `{ itemId, version, html, plainText, savedAt, savedBy }`. Files are never modified after write. Scope `drive.file` covers files the app creates (spec section 9); slice 2 confirms the Advanced Drive service works with `drive.file` only.
- Script Properties: config only (`SPREADSHEET_ID`, `BODIES_FOLDER_ID`, `INDEX_VERSION`, resolver settings). No secrets exist in this design.

### Caching

| Layer | Key | Content | Size | TTL |
|---|---|---|---|---|
| Server Script Cache | `idx:meta` | `{ indexVersion, chunkCount }` | under 1 KB | 6 h |
| Server Script Cache | `idx:<indexVersion>:<n>` | items metadata (id, folderId, title, tags, version, updatedAt, snippet 140 chars, applyCount), 90 KB per chunk | 1,000 items about 400 KB, 5 chunks. 10x: 45 chunks | 6 h |
| Server Script Cache | `acl:<indexVersion>` | folder tree and grants | 100 folders under 30 KB | 6 h |
| Server Script Cache | `ft:<indexVersion>:<n>` | plain-text bodies for search, 90 KB chunks | 1,000 x 2 KB about 23 chunks | 6 h |
| Server Script Cache | `body:<itemId>:<version>[:part]` | sanitized HTML | 90 KB per part | 6 h |
| Server Script Cache | `gm:<groupEmail>` | direct member emails (ADR-0003) | 500 emails about 15 KB | 60 min |
| Server Script Cache | `prof:<n>` | Directory profile map (ADR-0004) | chunked | 6 h |
| Add-on User Cache | `view:<n>` | the caller's filtered sidebar list (id, title, folder, snippet 80 chars, favorite, lastUsed) | 1,000 visible about 150 KB, 2 chunks | 10 min |
| Add-on User Cache | `body:<itemId>:<version>` | body for apply | 90 KB parts | 10 min |

Key budget: under 600 server keys at 10x before bodies, so FIFO eviction hits bodies first. Every chunk set is versioned by `INDEX_VERSION`, so a reader never mixes chunks from two builds. Reads use `getAll` for one round trip. A missing chunk triggers a rebuild.

Rebuild on miss: take the script lock with `tryLock(10000)`, re-check `idx:meta`, read `items`, `folders`, `grants` with one `getDataRange().getValues()` each (about 3 x 800 ms, [R4 S72]), write chunks with `putAll`, release. Concurrent requests that miss wait on the lock, then read the fresh cache. A nightly trigger and every write rebuild proactively, so users rarely pay the miss.

### Concurrency

- Optimistic versions. Each `items` row has `version` (integer). Every write sends `baseVersion`. Last-write-wins is impossible: a mismatch returns `CONFLICT` with the current version, author and time.
- Write sequence for save: (1) sanitize and validate (ADR-0004), (2) write the new body file `<id>.v<base+1>.json` outside the lock, (3) `LockService.getScriptLock().tryLock(10000)`, (4) re-read the row, compare `version` to `baseVersion`, (5) update the row (commit point), append a `versions` row and an `audit` row, increment `INDEX_VERSION`, (6) `SpreadsheetApp.flush()`, release the lock, (7) refresh cache chunks. On conflict at step 4 the orphan body file is trashed. A weekly trigger deletes body files with no `versions` row.
- Lock hold target under 2 s. Lock not acquired in 10 s returns `BUSY` (retryable). LockService max wait is undocumented [R4 S69]; 10 s keeps add-on callbacks under 30 s.
- Moves, deletes, grant changes follow the same pattern with `folders.version` or `items.version`.

### Version history

- New version on every save. Restore copies an old version's body into a new version, so history stays linear (summary.md section 2).
- `versions` row: `itemId, version, fileId, savedAt, savedBy, note, restoredFrom, sizeBytes, sha256`.
- Retention: all versions in v1. 1,000 templates x 50 versions is 50,000 small files, inside Drive limits. Revisit when the bodies folder passes 50,000 files.
- Soft delete sets `deletedAt` and `deletedBy`. Trash keeps 30 days. A daily trigger purges rows and trashes their body files after 30 days.

### Apply events

Apply counts and Recent come from apply events. A synchronous audit row costs one SpreadsheetApp write (hundreds of ms) on the 2 s apply path. Apply events therefore go to a buffer: the server appends them to a Script Cache list under a short script lock (`tryLock(500)`, fallback: direct append). A trigger every 5 min flushes the buffer to `audit` and `usage`. Cache eviction can lose at most 5 min of apply events (analytics only). Security-relevant events (create, edit, move, delete, restore, grant change, export, import, denied writes) are written synchronously inside the write lock.

### Backup and export

- Export as JSON from the web app: `{ schemaVersion, exportedAt, exportedBy, scope, folders[], grants[], items[{ meta, html }] }`, current versions only. Folder export needs `manage` on the folder, library export needs admin (ADR-0003). The browser downloads the JSON as a Blob (`allow-downloads` sandbox flag [R4 S46]).
- Import: admin only, JSON in the same schema, every body passes the sanitizer, IDs remapped, conflicts reported per item.
- Backup: nightly trigger copies the spreadsheet into `Migway Templates Backups`, keeps 14 copies. Body files are immutable, so they need no copy. Drive file version history covers the spreadsheet between copies.

### Budget with 200 templates

Latency per step. Cache and SpreadsheetApp figures are third party [R4 S72]. UrlFetch to `/exec` and add-on start times are unpublished; the values below are working assumptions that slice 2 measures.

Sidebar load (compose trigger to card shown):

| Step | Warm (add-on cache hit) | Cold (add-on miss, server cache hit) | Coldest (server rebuild) |
|---|---|---|---|
| Add-on execution start (assumed) | 600 ms | 600 ms | 600 ms |
| Add-on User Cache `getAll` | 70 ms | 70 ms | 70 ms |
| UrlFetch to server, incl. redirect (assumed) | 0 | 900 ms | 900 ms |
| Server: identity, membership `gm:*`, `acl`, `idx` `getAll` | 0 | 150 ms | 150 ms |
| Server: rebuild from 3 tabs | 0 | 0 | 2,400 ms |
| Filter and build card | 100 ms | 100 ms | 100 ms |
| Add-on cache write | 0 | 70 ms | 70 ms |
| Total | about 0.8 s | about 1.9 s | about 4.3 s |

The coldest path exceeds 3 s. Proactive rebuild after every write and nightly keeps it rare. Slice 2 reports its frequency.

Apply (click Insert to body updated):

| Step | Time |
|---|---|
| Add-on callback start (assumed) | 500 ms |
| UrlFetch `apply` with `knownVersion` (assumed) | 900 ms |
| Server: permission check from cache, body and profile from cache, buffer event | 200 ms |
| Render placeholders (ADR-0004), build response | 50 ms |
| Gmail applies the insert (unmeasured) | 200 ms |
| Total | about 1.85 s |

Fallback if slice 2 measures p95 above 2 s: apply renders from the add-on cached body (10 min TTL), skips the server call, and sends the queued apply event with the next server call. Revocation latency then rises from about 0 to 10 min.

Web app list and search: the shell loads the caller's index once (one call, under 1.5 s); filtering title, folder and tags runs in the browser (under 50 ms). Body matches come from one server call over `ft:*` chunks (under 1 s with cache).

## Consequences

- Easier: small index, immutable bodies make version history and backups trivial, cache rebuild is 3 tab reads.
- Harder: two stores (spreadsheet and Drive folder) must move together when ownership changes (ADR-0005). Orphan body files need the weekly cleanup.
- All server I/O counts against the owner's quotas and its 30 simultaneous executions [R4 S2]. Peak estimate: 500 users, 10% active in one minute, 3 calls of about 1 s each, about 1 concurrent execution on average. The add-on retries `Too many simultaneous invocations` once after 300 to 600 ms.
- Revisit at 10,000 templates, at 50,000 body files, or if slice 2 measures UrlFetch round trips over 1.2 s.

## Open questions

- Q14. Apply events may lose up to 5 min on cache eviction (analytics only). Recommendation: accept.
- Q15. Keep all versions in v1. Recommendation: accept, revisit at 50,000 files.
- Does the Advanced Drive service work with `drive.file` only for app-created files? Recommendation: verify in slice 2; fallback is Drive REST through UrlFetch with the same scope.
- Do `google.script.run` payloads above 1 MB fail? Undocumented [R4 S49]. Recommendation: page index responses at 500 items; slice 3 measures.

## Sources

- [R4 S2, S11, S30, S46, S49, S66, S68 to S72] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A2] https://www.ablebits.com/office-addins-blog/google-sheets-limits (50,000 characters per cell), third party, read 2026-11-09.
- [A3] https://workspaceupdates.googleblog.com/2022/03/ten-million-cells-google-sheets.html (10 million cells), read 2026-11-09.
