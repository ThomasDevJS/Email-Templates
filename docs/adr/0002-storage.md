# ADR-0002: Storage, caching and concurrency

Status: Accepted 2026-11-09 (orchestrator, by owner delegation; was Proposed) (revised 2026-11-09 after D15: one project, near-zero maintenance) (Amendment 2026-11-10: lock-free readers, body and side caches) (Amendment 2026-11-10, errata run 3: export, import and backups as built, Proposed) (Amendment 2026-11-10: owner handover, Proposed) (Amendment 2026-11-10: admin settings in `index.json`, D29, Accepted 2026-11-11 with ADR-0008) (Amendment 2026-11-11, errata run 4: export start event and run token, buffer slots, `prof:` hash; Proposed) (Amendment 2026-11-11, slice 19: raw media read for JSON Lines files, job error texts; Proposed)
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
| `usage.json` | `{ rev, items: { id: { applyCount, lastUsedAt } }, recent: { email: [itemId] } }` [entries also carry `days`, applies per UTC day, 30 days kept; Amendment 2026-11-10, errata run 3] | 5-min trigger | 0.5 MB |
| `members.json` | group snapshot (ADR-0003 Part B) | 15-min trigger | under 450 KB |
| `bodies/<itemId>.v<version>.json` | `{ itemId, version, html, plainText, savedAt, savedBy, note, restoredFrom, sha256 }`, immutable. `appProperties`: `itemId`, `version`, `savedBy`, `restoredFrom` | requests, outside lock | 2 to 100 KB each |
| `audit/YYYY-MM.jsonl` | one audit event per line, append-only, one file per month [read with Drive REST media, `readRawText`; Amendment 2026-11-11, slice 19] | daily trigger | 2.4 MB per month |
| `backups/YYYY-MM-DD/` | copies of `index.json`, `favorites.json`, `usage.json` | daily trigger | 1.5 MB per day, 14 kept |

Version history uses no extra index: `files.list` with `appProperties has { key='itemId' and value='<id>' }` returns all versions of one item in one call (100 units [R4 S70]).

Drive access: Advanced Drive service v3 (`Drive.Files.create`, `Drive.Files.update` with a media blob, `Drive.Files.get` with `alt: 'media'`, `Drive.Files.list`). [Slice 19: `Drive.Files.get` with `alt: 'media'` reads one JSON document only; month files and backup copies are read with Drive REST media under both clients, and the Drive prefix in `urlFetchWhitelist` is required in every environment. Amendment 2026-11-11, slice 19.] Fallback if slice 2 shows the Advanced service rejects a `drive.file`-only token: Drive REST v3 through `UrlFetchApp` with `ScriptApp.getOAuthToken()`, same scope, `https://www.googleapis.com/` added to `urlFetchWhitelist`.

### Caching

| Layer | Key | Content | Size | TTL |
|---|---|---|---|---|
| Script Cache | `idx:meta` | `{ rev, chunkCount, builtAt }` | under 1 KB | 6 h |
| Script Cache | `idx:<rev>:<n>` | `index.json` text, 90 KB chunks | 10 chunks at 1x, 94 at 10x | 6 h |
| Script Cache | `fav:<rev>:<n>`, `use:<rev>:<n>`, `gm:<rev>:<n>` | side files, 90 KB chunks | 2, 6, 5 chunks | 6 h |
| Script Cache | `ft:<rev>:<n>` [built as `ft:<bodyFileId>`, one entry per body; Amendment 2026-11-10] | plain-text bodies for search | about 23 chunks at 1x | 6 h |
| Script Cache | `body:<itemId>:<version>[:part]` [built as `bd:<bodyFileId>`, bodies over 90 KB not cached; Amendment 2026-11-10] | sanitized HTML | 90 KB parts | 6 h |
| Script Cache | `prof:<n>` [built as `prof:<sha256 of the lower-case address>`, one entry per profile; Amendment 2026-11-11] | Directory profile map (ADR-0004) | chunked | 6 h |
| Script Cache | `evt:<n>` | buffered apply and denied events [plus `evt:meta`, `evt:dropped`, `evt:lost`; Amendment 2026-11-11] | 90 KB parts | 6 h |
| Script Cache | `exp:<token>` [Amendment 2026-11-11] | export run `{ actor, kind, folderId }` | under 1 KB | 600 s, sliding |
| User Cache (add-on code only, as the user) | `view:<n>`, `body:<itemId>:<version>` | the caller's filtered list, bodies for apply | 2 chunks, 90 KB parts | 10 min |

Rules:

- Chunk sets are keyed by `rev`, so a reader never mixes two builds. Reads use `getAll`, one round trip. A missing chunk triggers a rebuild.
- Script Property `INDEX_REV` names the current revision (80 ms read [R4 S72]). Readers read `INDEX_REV`, then `idx:<rev>:*`. A miss rebuilds under the script lock from `index.json` (1 file read). [Readers take no lock since slice 4b; Amendment 2026-11-10.]
- The 5-min trigger checks `idx:meta` and re-puts every chunk set older than 5 h, so the 6 h TTL never lapses and FIFO eviction is repaired within 5 min. Users pay the coldest path only after an eviction inside a 5-min window.
- The server code never calls `CacheService.getUserCache()`: in the web app it returns the owner's cache, shared by every caller (ADR-0003 Part A).

### Concurrency

- One writer at a time. Every write takes `LockService.getScriptLock().tryLock(10000)`. Lock not acquired returns `BUSY` (retryable).
- Optimistic version inside the JSON. `index.json` carries `rev`; every item and folder carries `version`. The client sends `baseVersion`; a mismatch returns `CONFLICT` with the current version, author and time. `rev` guards against writes that bypass the lock (a restore from backup, a future bug): the writer re-reads `rev` inside the lock and aborts on mismatch. Revised 2026-11-09 in slice 2: the writer adopts the file (it reads `index.json` when the cached `rev` differs from the `rev` in its appProperties) instead of aborting, because a crash between save steps 6 and 7 leaves `INDEX_REV` behind by design and aborting would block every write until a rebuild; lost updates are still caught by the item `version` check and the in-lock recheck of target folders.
- Save sequence: (1) sanitize and validate (ADR-0004). (2) Create body file `<id>.v<base+1>.json` outside the lock. (3) Take the lock. (4) Load the index for `INDEX_REV` from cache, else from Drive; check `rev` and the item `version`. (5) Apply the change, append the audit event to `pendingAudit`, set `rev + 1`. (6) Write `index.json` (commit point; the change and its audit event land in one write). (7) Set `INDEX_REV`, put cache chunks. (8) Release. A crash after (6) leaves `INDEX_REV` behind the file; the next writer and the rebuild read `rev` from the file and adopt it.
- Lock hold at 1x: about 1.3 s (index write 1 s assumed, cache and Properties 0.3 s). Serial capacity about 45 writes per minute. Expected peak under 10 per minute (opinion: 50 editors). At 10x the hold reaches about 3.5 s and the save exceeds 3 s; see Revisit.
- Favorites use the same lock and file pattern on `favorites.json` (hold about 0.5 s). [Cache and revision property: Amendment 2026-11-10.]
- An orphan body file (step 2 done, step 6 failed or `CONFLICT`) is trashed by the daily job when its version exceeds the item's current version and it is older than 1 h.

### Version history

- New version on every save. Restore copies version K into version N+1, so history stays linear.
- Retention: all versions in v1 (Q15). 1,000 templates x 50 versions = 50,000 small files. Revisit at 50,000.
- Soft delete sets `deletedAt` and `deletedBy`. The daily job purges items deleted over 30 days ago and trashes their body files.

### Audit storage and admin view

- Security events (create, edit, move, delete, restore, grant change, export, import, backup restore) enter `pendingAudit` inside the same `index.json` write as the change. An event cannot exist without its change, or the reverse. [Export since slice 13: one start event committed through `commit` before any page is served; Amendment 2026-11-11.]
- Apply events and denied requests go to the `evt:*` cache buffer under `tryLock(500)` (fallback: skip buffering, keep the console log line). The 5-min trigger moves apply events into `usage.json` and denied events into `pendingAudit`. Cache eviction can lose up to 5 min of these events (Q14). [Buffer capped at 200 events, drops counted in one `audit.dropped` event per `tick`; ADR-0003 Amendment 2026-11-10, errata run 3. Evicted slots reused, applies take denied slots, busy-lock losses counted: Amendment 2026-11-11.] Every request also writes a structured console log line (ADR-0003 Part D).
- The daily job appends `pendingAudit` to `audit/YYYY-MM.jsonl` outside the lock, then removes the flushed event IDs from `pendingAudit` under the lock. A crash between the two steps duplicates lines; readers drop duplicate IDs. The 5-min trigger flushes early when `pendingAudit` exceeds 200 KB (a bulk import).
- Month file rewrite cost: up to 2.4 MB once per day at 1x.
- Retention: the daily job trashes month files older than 24 months (Q10). 24 files, about 58 MB at 1x.
- Admin view (wireframe 06): month selector, filters, 50 rows per page. The server reads one month file (cached as `aud:<month>:<n>` chunks for 6 h) plus `pendingAudit`, filters, and returns one page. No admin opens Drive or Sheets.

### Backup and export

- Daily job copies `index.json`, `favorites.json`, `usage.json` to `backups/YYYY-MM-DD/` and trashes folders older than 14 days. Bodies and audit files are immutable or append-only, so they need no copy.
- Restore: admin UI "Restore from backup" (admin only) lists the 14 dates. The server copies the chosen files over the live ones under the lock with `rev = current + 1` and writes an audit event. No hand edit of files. [Shape check, write order, undo and purge refusal as built: Amendment 2026-11-10, errata run 3.]
- Export as JSON from the web app: `{ schemaVersion, exportedAt, exportedBy, scope, folders[], grants[], items[{ meta, html }] }`, current versions only. [Fields, paging and the library scope without private folders: Amendment 2026-11-10, errata run 3. Start call, audit event and run token: Amendment 2026-11-11.] Folder export needs `manage`, library export needs admin. The browser downloads a Blob (`allow-downloads` [R4 S46]).
- Import: admin only, same schema, every body passes the sanitizer, IDs remapped, conflicts reported per item. Import is also the migration path from dev to prod and between owners (below). [Import creates no grants and no private folders and stops at 200 templates: Amendment 2026-11-10, errata run 3. Owner change path replaced: Amendment 2026-11-10, owner handover.]

### `drive.file` binding (consequence of option 2)

`drive.file` grants access per user and per OAuth client (likely; the 2.5b dry run verifies). Two events change one of them: moving prod to a standard GCP project (new client, 2.5b) and a change of owner identity (Q3). Mechanism: 2.5b switches prod to the standard GCP project before the setup function creates any prod data. Pilot data moves from dev to prod by export and import. An owner change is an export, a setup under the new owner, and an import (runbook, slice 7). [Superseded: Amendment 2026-11-10, owner handover.] Sheets with `spreadsheets` would not have this constraint.

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

## Amendment 2026-11-10: lock-free readers, body cache, side caches

Built in slices 4b and 5, reviewed PASS (docs/reviews/slice-04b.md, slice-05.md). The Drive JSON decision stands. Reason for the change: before 4b a reader waited up to 10 s for the script lock on a cache miss, and every request read Script Properties 7 to 12 times (spec 12.1).

Options for the read path:
1. Readers rebuild under the script lock (original rule). One rebuild per miss. A reader queues behind every writer, up to 10 s.
2. Readers take no lock and never publish a revision; writers and `setup` publish. A miss costs one Drive read per reader until the cache is put. No reader waits for a writer.

Decision: option 2. Mechanism:
- One `getProperties()` per request execution (snapshot). Writes go through and update the copy. Triggers read live properties.
- Readers take no script lock. `loadIndex` reads `INDEX_REV`, then `idx:<rev>:*`. On a miss it reads `index.json` and puts the chunks only when the file `rev` equals the published `INDEX_REV`. It never sets or moves `INDEX_REV`. `setup` publishes it under the lock. With `INDEX_REV` missing or behind, readers serve the file from Drive (`cache: "miss"`) and the `tick` trigger rebuilds within 5 min.
- Write paths re-check inside the lock. `loadIndexForWrite` uses the cached index only when its `rev` equals the `rev` in the file's appProperties, else it reads Drive. `commit` re-runs authorization inside the lock. `ensureTriggers` reads `TRIGGERS_VERSION` live inside the lock, so two stale executions reinstall once.
- Bodies: Script Cache `bd:<bodyFileId>`, 6 h, filled on save (create, update, restore, duplicate) and on a miss. Bodies over 90 KB are not cached. The key is the file ID, so an orphan body file of a failed save never shadows the committed body. `template.get`, `template.getBody`, `template.apply` and `template.duplicate` read through it; history reads stay on Drive (they need file metadata). `bd:*` shares Script Cache capacity with index and member chunks; eviction costs Drive reads, never wrong data.
- Search text: Script Cache `ft:<bodyFileId>`, written at save. `search.body` reads all entries with one `getAll` and makes at most 25 Drive reads per call for misses; the rest are reported as `skipped`.
- Side caches: `favorites.json` and `usage.json` go through Script Cache chunk sets keyed by revision, with Script Properties `FAVORITES_REV` and `USAGE_REV` (the `INDEX_REV` pattern). Writers run under the script lock and read the file live from Drive: `favorite.set` and `favorite.unset`, and `tick` (usage flush and side upkeep). Writers write the file, then publish the property. Readers put a chunk set only when the file `rev` equals the published one.

Consequences:
- Warm `sidebar.home`, `search` and `template.apply`: 1 Properties read, 0 Drive reads (pinned in test/unit/server/entry.test.ts).
- Environments set up before slice 5 have no `FAVORITES_REV` or `USAGE_REV`; `sidebar.home`, `template.list` and `search` read both files from Drive on every call until the first `tick` publishes them.
- A crash between the side file write and `setProperty` leaves readers on the older cached set until the next write of that file. No data loss. Accepted (slice 5 review minor 4).
- A reader's late put of `idx:meta` can overwrite a newer one; the next reader misses and reads Drive once. No stale data, because chunk keys carry `rev`.

## Amendment 2026-11-10 (errata run 3): export, import and backups as built

Status: Proposed until the owner approves. Built in slice 6b, review PASS on f6b567f (docs/reviews/slice-06b.md). The options above stand. This section records the mechanism as built.

Export:
- File format, `schemaVersion` 1: `{ schemaVersion, exportedAt, exportedBy, scope: { kind: "library" | "folder", folderId, name }, folders: [{ id, parentId, name }], grants: [{ folderId, principalType, principalKey, level }], items: [{ meta: { id, folderId, title, subject, to, cc, bcc, tags }, html }] }`. [`to`, `cc`, `bcc` added in slice 9, absent = `[]`.]
- Content: live templates, current version only. No version history, no `createdBy` or `updatedBy`, no favorites, usage, audit, membership or property data. The export root has `parentId` "".
- `export.folder` (manage): the folder and its live subtree. Grants only on folders inside that subtree; inherited grants from above are left out.
- `export.library` (admin): every live folder outside a private tree. Private folders and their templates are left out (D11). The UI label is "Whole library (shared folders)".
- Paging: one call returns the header and at most 20 templates (`EXPORT_PAGE`), so it reads at most 20 bodies from Drive (body cache first). Pages use an `offset`; the server recomputes the scope on every call. [Since slice 13 a start call comes first and every page needs its run token; a cache miss is read from Drive and not cached: Amendment 2026-11-11.] The browser joins the pages into `migway-templates-<scope>-<date>.json` (`library` or the folder name, local date).

Import (admin):
- Validate (`dryRun: true`) runs every check and writes nothing. Import runs the same checks again on the index read inside the lock.
- File checks before any write: at most 5 MB (UTF-8), valid JSON, `schemaVersion` exactly 1, at most 100 folders and 200 templates, no two folders with one `id`. A bad record fails alone and carries its reason.
- Target: a live shared folder. A folder in a private tree answers VALIDATION "Templates cannot be imported into a private folder. Pick a shared folder." The picker lists shared folders only.
- Folders are created as `kind: "shared"` under the target. A folder whose name a live sibling already has is reused.
- Templates get new IDs. Bodies pass the sanitizer and placeholder checks. Subject line breaks become one space (counted in `subjectsFlattened`), then SUBJ_TOO_LONG and PH_* apply. A template whose title already exists in its destination folder is skipped, so a second import of one file adds nothing.
- Grants in the file are not created. Existing records are never moved or overwritten.
- Write: body files outside the lock, then one index commit with one `import` audit event per created folder and template. Any failure answers "Nothing was imported: <what>. Run the import again." Body files already written are orphans; the daily cleanup trashes them after 1 h.
- Report: templates created, skipped and failed; folders created and reused; `subjectsFlattened`; one line per skipped or failed record.

Shape check (src/shared/model/shape.ts):
- `index.json`: `schemaVersion` 1, integer `rev`, lists `folders`, `grants`, `items`, `pendingAudit` of records with typed required fields. `favorites.json`: integer `rev`, object `byUser`. `usage.json`: integer `rev`, objects `items` and `recent`. Optional fields (`subject`, `days`, unknown fields) are not checked.
- It runs on every Drive read of the 3 live files. A damaged live file answers INTERNAL "<file> is damaged: <problem>" on every op that loads it.
- The reviewer replayed data written by 9 builds from slice 2 to 6a: no false rejection.

Restore (`backup.restore`, admin):
1. Reads the 3 copies of `backups/<date>/` and runs the shape check before the lock. A missing, unparsable or damaged copy answers VALIDATION "This backup cannot be read: <file> ...". Live files stay untouched.
2. Under the lock: admin re-check. Refusal when the backup holds templates that were live then and were emptied from the trash since; their body files are gone. Trashed templates purged since are dropped from the restored index.
3. Writes `favorites.json`, then `usage.json`, then `index.json` as the commit point: `rev = current + 1`, current `pendingAudit` kept, one `backup.restore` audit event. Side file revs become `max(live, copy) + 1`.
4. A failure before or during the index write puts the replaced side files back with a new rev.
5. Publishes `INDEX_REV`, `FAVORITES_REV`, `USAGE_REV` and the cache sets.

Limits of restore:
- A failure inside the undo leaves backup side files with the live index and replaces the first error (slice 6b minor R2).
- Body versions saved after the backup date sit above the restored `currentVersion`. History hides them; the daily cleanup trashes them after 1 h.
- Readers take no lock, so for under a second a reader can see restored side files with the old index.
- A damaged live `index.json` blocks `backup.restore` too: dispatch loads the index before the handler. Recovery: spec 16 "Recovery from a damaged live file" and Q31.

## Amendment 2026-11-10: owner handover

Status: Proposed until the owner approves. Replaces the owner-change sentences of "Backup and export" and "`drive.file` binding".

### Context

D16: the owner account owns prod, with a handover runbook. This ADR named export and import as the owner-change path. As built (amendment above), that path loses:
- private folders and their templates (library export leaves them out, import refuses a private target);
- all grants (import creates none);
- favorites, usage counts, audit history, version history, item IDs, `createdBy` and dates;
- and it stops at 200 templates, 100 folders and 5 MB per file. 1,000 templates need at least 5 folder files.

Facts:

| Fact | Source |
|---|---|
| `drive.file` covers files the app creates, files the user opens with the app, and files the user shares with the app through Google Picker. Google's page does not say whether the grant is per user | [A17] |
| A second user of the same app does not see files the app created for the first user. Picking a folder gives access to the folder, not to the files inside | third party, unverified [A18] |
| Files created by hand are invisible to the app | this ADR, Layout |
| An admin with the Drive and Docs privilege transfers a user's My Drive files to another active user of the organization. A transfer folder appears in the new owner's My Drive. Trashed files do not transfer. Access is unchanged; the previous owner keeps edit access until the account is deleted. File IDs: not stated | [A19] |
| A user transfers ownership per file or folder, inside the organization only. "When you make someone else the owner of a folder, you still own the files inside" | [A20] |
| "Execute as me": "the script always executes as you, the owner of the script". Web apps cease to work when ownership moves to another domain. In a shared drive the web app runs as the user who deployed it | [A21] |
| Installable triggers are not shared with collaborators. When an owner's account is removed, access to scripts without other owners is lost | [A22] |
| `getProjectTriggers()` returns the current user's triggers of the project only | [A23] |
| UrlFetch response and POST payload 50 MB; script runtime 6 min | [R4 S2] |
| A token minted by another OAuth client (the owner's clasp token) passes the `/exec` front door | PLAN log 2026-11-09 (2.5a) |
| `setup()` records `OWNER_EMAIL` on its first run and refuses every other account afterwards; triggers run only as `OWNER_EMAIL` | src/server/guards.ts `setupAllowed`, `triggerAllowed` |

### Options

1. A. Copy the data folder to the new owner and point the new deployment's `STORE` at it. A copy made in the Drive UI is a file the app did not create: invisible under `drive.file`. A copy made by the app as the new owner needs read access to the old files, and `drive.file` gives none (likely, third party [A18]). Cost: no code. Risk: rests on behavior Google does not document; probably fails.
2. B1. Full export and import through the browser. Admin-only export of everything: index with private folders and grants, all body versions with their `appProperties`, favorites, usage, audit month files. An import that writes them unchanged. Cost: large code. The audit files alone reach about 58 MB over 24 months at 1x, above the 5 MB upload cap and the undocumented `google.script.run` payload limit, so the admin moves tens of files by hand.
3. B2. Server-to-server pull. Same content as B1. The new deployment calls the old deployment's `/exec` with the new owner's token and writes every file itself. Cost: code, about one slice (opinion). Rests on verified pieces only (Decision).
4. C. Same project, Drive ownership transfer. The admin transfers the old owner's files (Apps Script project and data folder) to the new owner [A19]. The new owner authorizes, redeploys, sets `OWNER_EMAIL`, runs `setup()`. Cost: no code. Risks: works only if the new owner's `drive.file` token reads files the app created for the old owner (unverified, third party says no [A18]); web app identity after the transfer is unverified; admin transfer moves every My Drive file of the old account; a user transfer leaves the files inside a folder with the old owner [A20], so 1,000 to 50,000 body files would need one transfer each.
5. D. No handover. A dedicated owner account (shared mailbox) that outlives staff changes (D16, Q3). A staff change moves the password and 2-step verification to the next person. Cost: no code, no data move; one Workspace licence unless Migway already has such an account. Risk: a shared credential.
6. E. Shared drive for project and data. Files belong to the organization; the web app runs as the deployer [A21]. `drive.file` is still per user (likely) and triggers are still per user, so a new deployer still cannot read the old files. Q18 stays open. Rejected as a handover path.

| Criterion | A copy | B1 browser | B2 pull | C transfer | D dedicated account |
|---|---|---|---|---|---|
| Private folders, grants, IDs, history, favorites, usage, audit | all, if it works | all | all | all, if it works | nothing moves |
| Code | none | large | about one slice | none | none |
| Relies on unverified platform behavior | yes | `google.script.run` payload | `getActiveUser` for a server token (V2) | yes (V1, V3) | no |
| Old owner account must stay active | no | yes | yes | no (sender not deleted) | n/a |
| Human steps | few | many file moves | about 10 runbook steps | about 8 runbook steps | credential handover |

### Decision (Proposed)

1. Prevent first: option D when Migway has a dedicated account before 2.5b (Q26). Then nothing below runs.
2. When the owner account must change: option B2, the server-to-server pull. It uses facts this project has verified: files the app creates as the new owner are visible to it (`setup()` since slice 1); a token call with `script.projects.readonly` passes `/exec` (spike S2); a foreign-client token passes the front door (2.5a). It needs no new scope.
3. Before building B2, run tests V1 to V4 below on dev with the pilot's second account (Q28, about 30 min). If V1 and V3 pass, option C replaces B2: runbook only, no code.

Mechanism of B2:
- Source (old deployment, old owner). Script Property `READ_ONLY`, set by the owner in Project Settings, makes every write op answer BUSY "Migway Templates is moving to a new owner. Try again later." Reads and apply keep working; apply events during the move stay in the old `usage.json` (accepted, analytics).
- Source op `migrate.manifest` (admin): the index `rev` and the data files (kind, Drive file ID, name, `appProperties`, size), in pages of 500.
- Source op `migrate.read` (admin): the contents of up to 20 files, or one file, per call, under 40 MB per response (the 50 MB cap minus margin).
- Target (new project and new deployment under the new owner, after `setup()` on an empty store). Op `migrate.pull { sourceUrl }` (admin), started from the Config tab. It refuses a target that holds any template.
- Each step runs at most 4 min (6 min limit) and stores its cursor in Script Property `MIGRATE`. The admin presses Continue until done; no trigger is added.
- Each step calls `sourceUrl` with `UrlFetchApp` and `ScriptApp.getOAuthToken()` (the new owner's token). It creates body files with the same names and `appProperties` and records old to new file IDs in a Drive file `migrate-map.json` (about 3 MB at 50,000 versions, too large for Properties). Audit month files are copied unchanged.
- Last step: reads the source index, runs the shape check, requires the `rev` seen at the start (else: "The library changed. Set READ_ONLY and run again."), replaces every `bodyFileId` through the map, writes `favorites.json`, `usage.json`, then `index.json` as the commit point (`rev = source rev + 1`) with one `migrate.pull` audit event, and publishes the revs.
- Moves: folders including private ones, grants, items with their IDs, all body versions, favorites, usage, audit months and `pendingAudit`. Does not move: backups (the target's `daily` starts new ones), `members.json` (`refreshMembers` rebuilds it), Script Properties (setup and runbook), caches.
- Audit `before` and `after` body references keep the old file IDs. `itemId` and `version` still name the version. Accepted.
- Scopes: none new. `script.external_request` and `script.projects.readonly` are in the manifest. `urlFetchWhitelist` already lists `https://script.google.com/macros/s/` and `https://script.googleusercontent.com/`.
- Duration: one Drive create per body version. Small-file create time is unmeasured; at an assumed 0.7 s, 5,000 versions take about 1 h (15 steps), 50,000 about 10 h. Q29 decides between all versions and current versions only.
- The same pull covers dev to prod (ADR-0005 2.5b step 5), so pilot users keep their private templates (Q30).

What needs code (B2, v1.1 or a slice before the first handover, Q27): the `READ_ONLY` write refusal in `dispatch`; `migrate.manifest` and `migrate.read` with admin policy rows; `migrate.pull` with cursor, map file, empty-target check, shape check, final commit and audit event; a Config tab section; tests in the role matrix.

Runbook steps (input for slice 7; spec 16 holds the list): new owner account ready and in `ADMIN_EMAILS` of the source; source project shared with the new owner as editor; new owner deploys a new project and runs `setup()`; owner sets `READ_ONLY` on the source; new owner runs the pull; counts compared in both Config tabs; the admin moves the domain install to the new deployment; old owner deletes old triggers and the old deployment; old data folder kept 30 days, then trashed.

Owner decides: Q26 (dedicated account), Q27 (when to build B2), Q28 (run V1 to V4), Q29 (history scope), Q30 (dev to prod path).

Cannot be verified without a second owner account (the pilot account on dev can play it):
- V1. After an admin or user transfer of the data files, does the new owner's `drive.file` token in the same project read them?
- V2. Does a token minted by another project's server pass the source `/exec` with `getActiveUser` set, so the source admin check works?
- V3. After the script project changes owner, does the existing web app deployment run as the new owner, and what must the new owner authorize?
- V4. Do the web app and triggers of a suspended owner account keep running? The runbook assumes no and keeps the old account active until the move ends.

Interim, until B2 ships or V1 passes (runbook, no code):
1. Keep the old owner account active. Do not suspend or delete it.
2. An admin creates a shared folder "Handover" with no grants (only admins see it) and moves each private template into it, one subfolder per user.
3. Export each top folder of at most 200 templates (`export.folder`); import each into the new deployment.
4. Re-add grants by hand from the `grants` list of each export file.
5. Each user opens the new library once, which creates their private folder. The admin then moves their templates back into it (ADR-0003 Part C gives admins `manage` there).
6. Lost: favorites, usage counts, audit history, version history, item IDs. The old data folder stays readable by the old owner for the audit record.

### Consequences

- Easier: a staff change no longer silently drops private templates and grants. D, when chosen, removes the event.
- Harder: B2 adds 3 ops and a resumable job. The old owner account must stay active during the move.
- Revisit: after V1 to V4 run; when 2.5b picks the prod owner (Q26).

## Amendment 2026-11-10: admin settings in `index.json` (D29)

Status: Accepted 2026-11-11 with ADR-0008 (built in slice 11). Mechanism and options in ADR-0008.

- `index.json` gains an optional `settings` object: `{ personalTemplates: { value, updatedAt, updatedBy }, recipientsExternal: { ... } }`. Absent = defaults (`off`, `allow`). The shape check refuses a stored value outside its list.
- Only `config.set` writes it, through the normal commit: the change and its `pendingAudit` event in one write, `INDEX_REV` raised.
- `backup.restore` keeps the live `settings`, as it keeps the live `pendingAudit`. Export and import carry no settings. `setup()` writes none.
- Script Property `RECIPIENTS_EXTERNAL` is retired from slice 11 on (built: no code reads it). Each reader fills absent defaults with `settingsOf`; `readIndexDoc` leaves `settings` as stored.

## Amendment 2026-11-11 (errata run 4): export audit record, event buffer, cache keys

Status: Proposed until the owner approves. Built in slice 13, review PASS on c96a38b after two FAIL rounds (docs/reviews/slice-13.md). Verified in src at 6374b7b.

Problem: slice 6b wrote no export event, although "Audit storage" lists export as a security event. Two attempts failed review: an event on the page with `offset` 0 only (a client skips it with `offset` 1), then an event per page in the `evt:*` buffer (a cold export of 1,000 templates evicted its own events with `bd:*` body cache writes).

Options:
1. One event per page through the buffer, refusing a page when the event is not stored. Fails at 1,000 templates: the export's own body cache writes evict buffered events before `tick`.
2. One event per page through `commit`. Durable, but one index write (about 1 s under the lock) per 20 templates: 50 writes for 1,000 templates.
3. One start event through `commit`, then a run token every page must carry. One index write per export; no page without a durable event.

Decision: option 3. Mechanism:
- `export.library` and `export.folder` with `start: true` commit one event (actor, `targetType` `library` or `folder`, `targetId`, `targetPath`, `after: { scope, templates }`; no title, subject, body or address) through `commit`: lock, `recheck`, `commitLocked`, `pendingAudit`. Lock busy answers BUSY, a Drive failure INTERNAL; no token then exists.
- The start stores `exp:<token>` in the Script Cache: `{ actor, kind, folderId }`, 600 s (`EXPORT_RUN_TTL_S`). The token is `newId()` (26 characters). Each accepted page re-puts it for 600 s.
- A page call needs a well-formed token present in the cache, of the same caller, scope kind and folder; else VALIDATION `EXPORT_RESTART` before the index or any body is read. The dispatch permission check runs first on every call, so a removed grant stops the next page.
- Pages read bodies with `readStoredBody(services, item, false)`: a cache hit is used, a miss is read from Drive and not cached, so an export cannot evict other cache entries.
- Limits: the event records the start, not a finished download. A token evicted mid-run stops the export; the user starts again and a second event is written. Two tabs write two events. A NETWORK retry of a start whose commit landed writes a second event (the log over-reports, never under-reports).

Event buffer (`evt:*`, apply and denied events only; no change event goes through it):
- In a full buffer a new event first takes an evicted slot (no drop counted); else an apply takes the slot of a denied event (counted); else the event is dropped and counted in `evt:dropped`.
- An event lost to a busy 500 ms buffer lock counts in `evt:lost`, one key holding "<lost> <seen>", written without the lock. `tick` adds the rise to the `audit.dropped` count.

Cache keys hold no address: `prof:<sha256 of the lower-case address>`. Old `prof:<email>` keys are never read and expire within 6 h.

## Amendment 2026-11-11, slice 19: JSON Lines reads and job error texts

Status: Proposed until the owner approves. Built in slice 19, review FAIL on job error texts, retry 1 PASS (docs/reviews/slice-19.md). Merged c6e2334; verified on dev: `audit.query` for 2026-11 answers ok, 70 events, in 968 ms. Checked in src at 16df87a.

Platform fact (owner's test round 1 part D on dev, then a diagnostic build): `Drive.Files.get(id, { alt: "media" })` of the Advanced Drive service parses the media as JSON. For a file whose text is not one JSON document it throws `HttpResponseException: Response Code: 200. Message: <file text>`. A JSON Lines file of 2 or more lines is such a file. So `audit/2026-11.jsonl` became unreadable with its second line, and the daily and 5-minute rolls into that file failed (`appendAudit` reads the file before it appends). No event was lost: the append fails before `pendingAudit` changes, and the next roll skips IDs already in the file. The test fakes did not model the throw. Spike S2 (e) and Q16 tested JSON files only.

Options for reading JSON Lines:
1. A raw read through Drive REST media (`UrlFetchApp` with `ScriptApp.getOAuthToken()`, the client already built as the Q16 fallback), used only for text that is not one JSON document. Same scope (`drive.file`), same OAuth client.
2. Switch every read to the REST client (`DRIVE_CLIENT=rest`). One code path, but every index and body read changes its client on a working build.
3. Store a month as one JSON document (an array). Every roll rewrites and re-parses the whole month, and the dev data needs a migration.
4. Parse the exception message for the file text. Fragile, undocumented, and the message carries personal data into memory and logs.

Decision: option 1. Mechanism:
- `DriveClient.readRawText(fileId)` exists under both clients; the Advanced client takes the REST media reader as its third argument (`advancedDriveClient(files, blobs, rawMedia)`, wired in runtime.ts). `readText` stays on the Advanced service for `index.json`, side files and bodies.
- Callers of `readRawText`: `audit.query` (`monthText`), `appendAudit` (daily roll and the early roll of `tick`), `readBackup` (backup copies before a restore). `readIndex`, `readSide` and `readBody` read raw once when the Advanced read throws an error that is not an `AppError`, so a damaged live file answers "<file> is not valid JSON" with no file text.
- `https://www.googleapis.com/drive/v3/` is in `urlFetchWhitelist` (appsscript.json) in every environment. The REST client is no longer a fallback only.
- File IDs go into the URL only when they hold letters, digits, `-` and `_` (`fileUrl`); any other ID is refused before a request. `encodeURIComponent` alone is not enough: URL parsers read `%2e%2e` as `..`. IDs come from Drive `files.list` results only; `audit.query` takes a month, never an ID.
- HTTP 429 answers QUOTA "Service is busy. Try again in a minute."; other non-2xx answers INTERNAL "Drive REST get failed with HTTP <n>". The fake now throws for non-JSON media like the platform; reverting the fix fails 19 tests.

Options for the stored job error text:
1. Store the exception message, cut to 500 characters (built until slice 19). The Drive error quoted the audit file, addresses included, into `job:daily:lastError`, a Script Property that the Admin page shows while a job is late and that script editors read.
2. Store "<code> <error name>" only, from the error object, never its message.
3. Store nothing; keep only `lastOk`. The admin loses the step and the code that the runbook needs.

Decision: option 2. Privacy rule: no stored, shown or rethrown job error carries a platform message, because a platform message can quote file text. Mechanism: `errorSummary(error)` (src/shared/errors/codes.ts) returns "<code> <error name>". `job:<name>:lastError` = "<time> <errorSummary>", or for `daily` a `JobError` "daily steps failed: <step> (<code>)" built from step names and codes only, at most 500 characters. `runJob` rethrows a `JobError` with the same text and deletes `lastError` on success. The group warning stored in `members.json` uses the same summary. The reviewer damaged 6 files holding an address and a token: 0 hits in properties, log lines, rethrown messages and responses. After the deploy of slice 19 the owner checks and clears the 4 `lastError` properties once (runbook "Required after deploying this build"); Executions and Cloud Logging entries of the failed runs expire on Google's schedule.

Job health while the roll failed (for the runbook): "Nightly backup and cleanup" read "OK" until 48 h after its last success, then "Late"; the other daily steps still ran. "Save insert counts and refused actions" stayed "OK" while `pendingAudit` was under 200 KB.

## Consequences

- Easier: one folder holds all data; one file read rebuilds the cache; the consent list loses `spreadsheets`; no spreadsheet UI exists for hand edits; change and audit commit in one write.
- Harder: every index write rewrites 0.85 MB at 1x and 8.4 MB at 10x. All writes serialize on one script lock. Data access is tied to the owner and the OAuth client (`drive.file`), so ownership and GCP project changes go through export and import. [Owner change: Amendment 2026-11-10, owner handover.]
- All server I/O counts against the owner's quotas and 30 simultaneous executions [R4 S2]. Peak estimate: about 1 concurrent execution on average. The add-on retries `Too many simultaneous invocations` once after 300 to 600 ms.
- Revisit when `index.json` exceeds 3 MB (about 3,500 items) or spike S2b measures a save above 3 s: split items into 16 files `items-<0..f>.json` by the last hex digit of the item ID hash. `schemaVersion` 2 marks it; the server migrates on the first request after deploy, under the lock. Revisit also at 50,000 body files.

## Open questions

- Q14. Apply and denied events may lose up to 5 min on cache eviction (console logs keep them). Recommendation: accept.
- Q15. Keep all versions in v1. Recommendation: accept, revisit at 50,000 files.
- Q16. Resolved 2026-11-09: the Advanced Drive service works on `drive.file` alone (create, update, get media, trash). `alt: media` returns parsed JSON with reordered keys; the adapter re-serializes (docs/spikes/slice-02-s2b.md). [2026-11-11, slice 19: for text that is not one JSON document `alt: media` throws `HttpResponseException: Response Code: 200`; such files go through Drive REST media. Amendment 2026-11-11, slice 19.] `appProperties` list is confirmed at the first version-history use in slice 3.
- Q17. Resolved 2026-11-09: read 549 to 809 ms, write about 1,130 ms for 821 KB. Option 2 stands.
- Q18. Prod data in the prod owner's My Drive or in a shared drive? A shared-drive folder created by hand is not visible to `drive.file`. Recommendation: the prod owner's My Drive (dedicated account, Q3); shared drive only if the 2.5b dry run shows the setup function can create its own folder there.
- Q26. Prod owner identity (refines Q3, D16). Recommendation: a dedicated account if Migway has one before 2.5b; a handover then moves a credential, not data.
- Q27. When to build the B2 pull. Recommendation: v1.1, before the first planned owner change and before the dev to prod move if pilot private templates must survive. Until then the interim runbook applies.
- Q28. Run V1 to V4 on dev with the pilot's second account. Recommendation: yes, in the 2.5b dry run, about 30 min. V1 and V3 passing replaces B2 with option C.
- Q29. Move all body versions or current versions only. Recommendation: all versions (D20 keeps all versions) while the count is under 20,000; above that, current versions only and the old data folder kept read-only for history.
- Q30. Dev to prod pilot data. Recommendation: the interim runbook (private templates through an admin-only "Handover" folder) unless B2 exists by 2.5b.
- Q31. Recovery from a damaged live `index.json`. Recommendation: add an owner-run editor function `restoreBackup(date)` with the `setup()` guard that runs the restore without `dispatch`; until it exists, the manual runbook of spec 16.
- Do `google.script.run` payloads above 1 MB fail? Undocumented [R4 S49]. Recommendation: page index responses at 500 items; slice 3 measures.

## Sources

- [R4 S2, S11, S30, S41, S46, S49, S57, S58, S60, S66, S68 to S72] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A9] https://developers.google.com/apps-script/reference/drive/drive-app (authorization sections of `createFile`, `createFolder`, `getFileById`), read 2026-11-09.
- [A10] https://developers.google.com/identity/protocols/oauth2/scopes (consent descriptions of `spreadsheets`, `drive.file`, `groups`, `admin.directory.user.readonly`, Gmail add-on scopes, `userinfo.email`), read 2026-11-09.
- [A17] https://developers.google.com/workspace/drive/api/guides/api-specific-auth ("Choose Google Drive API scopes": `drive.file` covers files created or opened with the app or shared with it through Google Picker; per-user binding not stated), read 2026-11-10.
- [A18] Third party, unverified: https://groups.google.com/g/google-apps-script-community/c/_W-NKbttfbo, https://nango.dev/blog/fix-google-drive-api-404-file-not-found, Stack Overflow archive https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/68462168/google-drive-api-permission-to-children-files (folder picked in Picker gives no access to its files; app files not visible to other users), read 2026-11-10.
- [A19] https://knowledge.workspace.google.com/admin/drive/transfer-drive-files-to-a-new-owner-as-an-admin (redirect from https://support.google.com/a/answer/1247799), read 2026-11-10.
- [A20] https://support.google.com/drive/answer/2494892 (transfer ownership as a user), read 2026-11-10.
- [A21] https://developers.google.com/apps-script/guides/web (permissions: "Execute as me"; domain and shared drive notes), read 2026-11-10.
- [A22] https://developers.google.com/apps-script/guides/collaborating (installable triggers not shared; owner leaving), read 2026-11-10.
- [A23] https://developers.google.com/apps-script/reference/script/script-app (`getProjectTriggers()`: current user's triggers), read 2026-11-10.
- [A24] https://support.google.com/drive/answer/2409045 (Manage versions, Upload new version; versions may be deleted after 30 days or 100 newer versions; file ID after upload not stated), read 2026-11-10.
