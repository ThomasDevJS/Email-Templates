# Migway Gmail Templates: specification v1

Status: Proposed (gate G2)
Date: 2026-11-09
Author: architect. Owner: thomas@migway.com.
Inputs: docs/BRIEF.md, PLAN.md (D1 to D14), docs/research/*.md, ADR-0001 to ADR-0005.

Citations: [R4 S13] = docs/research/r4-platform-constraints.md source S13. ADR references point to docs/adr/.

## 1. Scope

v1 delivers templates only: create, edit, duplicate, move, soft delete, folders, tags, search, favorites, version history with restore, placeholders, one-click apply in the Gmail compose sidebar, admin UI (folders, grants, audit, export, import). Signatures, attachments, tracking, Chrome extension and public Marketplace listing are out (BRIEF 1). The data model reserves signature fields (section 5.4).

## 2. Information architecture

```
Gmail compose sidebar (addon project)
  Home: search, Favorites, Recent, Folders
    Folder view (paged, 20 per page)
    Search results (paged)
    Template preview
      Prompt card (only if prompts or unresolved values)
        Apply -> draft body updated
    Open library / Edit -> web app in OVERLAY

Web app (server project, /exec)
  Library  (default view)
    Folder tree | template list | search | favorites filter | trash
  Editor   (?view=editor&id=...)
    Title, folder, tags, body, placeholder menu, preview as me, save
  History  (?view=history&id=...)
    Version list, preview, restore
  Admin    (?view=admin, admins and manage holders)
    Folders and grants | Memberships | Audit log | Usage | Export and import | Config (read only)
```

Navigation in the web app is a left rail: Library, Admin (visible to admins and manage holders only). The URL query `view` restores state on reload.

## 3. Topology and identity (summary of ADR-0001, ADR-0003)

| Piece | Runs as | Reads storage | Users consent to |
|---|---|---|---|
| addon project (Card Service) | the user | never | 4 scopes (section 9) |
| server project (web app, `USER_DEPLOYING`, `DOMAIN`) | the server owner | yes, private | nothing |
| Storage: spreadsheet, bodies folder, backups folder | owned by the server owner, shared with nobody | | |

Every server request passes `dispatch(caller, op, args)`: identify caller, resolve principals from the membership snapshot, compute effective folder level, deny or run (ADR-0003 Part C).

## 4. Key screens and flows

Wireframes: docs/wireframes/01 to 07. Screen list from docs/research/ux-notes.md section 4.

| # | Screen | Wireframe | Slice |
|---|---|---|---|
| 1 | Sidebar home | docs/wireframes/01-sidebar-home.txt | 4 (search, favorites, recent in 5) |
| 2 | Sidebar prompt card | docs/wireframes/02-sidebar-prompt.txt | 4 |
| 3 | Web app library | docs/wireframes/03-web-library.txt | 3 (search, favorites in 5) |
| 4 | Web app editor | docs/wireframes/04-web-editor.txt | 3 |
| 5 | Web app history | docs/wireframes/05-web-history.txt | 5 |
| 6 | Admin | docs/wireframes/06-web-admin.txt | 6 |
| 7 | States | docs/wireframes/07-states.txt | 3, 4, 6 |

### 4.1 Flow: apply a template (DoD 1)

1. User opens compose, opens the add-on. Compose trigger reads the add-on User Cache `view:*`; on miss it calls server op `sidebar.home`.
2. Server returns Favorites (max 10), Recent (max 5, from `usage`), top-level folders the caller can `use`, and the caller's filtered list for caching.
3. User taps Insert on a template. The callback calls server op `template.apply` with `{ id, knownVersion, recipientEmailIfInternal }`. The server re-checks `use`, returns body (if version changed), sender profile, internal recipient first name, and buffers the apply event.
4. No prompts and no unresolved values: the add-on renders and returns `UpdateDraftActionResponse`, `IN_PLACE_INSERT`, `MUTABLE_HTML`. One click.
5. Otherwise the add-on pushes the prompt card. Apply validates every field, renders, inserts. Blank fields keep the card with an error.

### 4.2 Flow: edit and restore (DoD 2)

1. Editor opens from the library or from the sidebar Edit button (OVERLAY, RELOAD_ADD_ON).
2. Save sends `{ id, baseVersion, title, folderId, tags, html }`. Server sanitizes, validates placeholders, writes the version (ADR-0002 write sequence). Conflict shows a dialog: "Changed by <name> at <time>. Open their version / Copy my text / Cancel." No silent overwrite.
3. History lists versions. Restore creates version N+1 from version K and writes an audit row.

### 4.3 Flow: grant access (DoD 3)

1. Admin opens Admin > Folders, selects a folder, adds a grant: principal (group email, user email, domain, OU marked inactive in v1), level (use, edit, manage).
2. Server validates the group exists via the resolver, writes `grants`, adds the group to the refresh set, refreshes its snapshot under lock, writes audit.
3. A user outside the group calls `folder.list` or `template.get`: server returns no rows or `DENIED`. Unit test and manual smoke step cover it.

### 4.4 Flow: search

- Sidebar: search input with `onChangeAction`. Server op `search` returns the top 20 visible matches. Operators `folder:<name>` and `tag:<name>`. Empty query shows Home.
- Web app: title, folder and tag filtering runs in the browser on the loaded index; body matches come from server op `search.body` over `ft:*` chunks. Sort: relevance, then last used by the caller.
- Matching: case-insensitive, accent-insensitive token prefix match on title (weight 3), tags (2), folder (2), body text (1). Fuzzy tolerance: one typo for terms of 5 or more characters.

### 4.5 Flow: export and import

- Export folder (manage) or library (admin): server builds JSON (ADR-0002), browser downloads `migway-templates-<scope>-<date>.json`.
- Import (admin): upload JSON, server validates schema version, sanitizes every body, maps to a chosen target folder, reports created, skipped and failed counts.

## 5. Data model

Spreadsheet tabs (ADR-0002). IDs are 26-character time-sortable strings. Times are ISO 8601 UTC. Arrays and objects are JSON strings in one cell. Every table with mutable rows carries `version`.

### 5.1 `folders`

| Column | Type | Notes |
|---|---|---|
| id | string | |
| parentId | string or empty | empty = top level |
| name | string, 1 to 80 chars | unique among siblings |
| kind | `shared` or `private` | private = D11 |
| ownerEmail | email or empty | private folders only |
| sortOrder | integer | |
| createdAt, createdBy, updatedAt, updatedBy | | |
| deletedAt, deletedBy | | soft delete, folder must be empty |
| version | integer | optimistic lock |

### 5.2 `grants`

| Column | Type | Notes |
|---|---|---|
| id | string | |
| folderId | string | |
| principalType | `group`, `user`, `domain`, `ou` | `ou` stored, inactive under `groupsapp_direct` |
| principalKey | string | group email, user email, domain, OU path |
| principalId | string or empty | Directory ID when the resolver provides it (rename safety, [R2 S43]) |
| level | `use`, `edit`, `manage` | |
| createdAt, createdBy | | |

### 5.3 `items` (templates now, signatures in v2)

| Column | Type | v1 use |
|---|---|---|
| id | string | |
| kind | `template` or `signature` | always `template` in v1 |
| folderId | string | |
| title | string, 1 to 120 chars | |
| subject | string or empty | reserved, not applied in v1 |
| tags | JSON string array, max 10, each 1 to 30 chars | |
| status | `published` or `draft` | always `published` in v1 |
| currentVersion | integer | |
| bodyFileId | string | Drive file of the current version |
| snippet | string, 140 chars | plain text for lists |
| placeholders | JSON string array | parsed names |
| prompts | JSON string array | normalized labels |
| sizeBytes | integer | sanitized HTML size |
| createdAt, createdBy, updatedAt, updatedBy | | |
| deletedAt, deletedBy | | soft delete, 30-day trash |
| version | integer | equals currentVersion |

### 5.4 Reserved v2 signature fields (columns exist, empty in v1)

From [R2 lessons]. Present now so v2 needs no migration.

| Column | Type | Meaning |
|---|---|---|
| scope | `company`, `department`, `user` or empty | signature audience level |
| targets | JSON `{ groups: [], ous: [], users: [] }` | who the signature applies to, by ID where known |
| priority | integer | first matching rule wins |
| variants | JSON `{ newMail: fileId, reply: fileId, plainText: fileId }` | reply and mobile variants |
| sendAs | email or empty | alias the signature applies to |
| lockedFields | JSON string array | fields users cannot change |
| userEditableFields | JSON string array | fields users may change |
| approvalRequired | boolean | user edits need approval |
| schedule | JSON `{ start, end }` | banner campaigns |

Reserved tab `push_log` (created empty): `id, itemId, userEmail, sendAs, pushedVersion, lastPushedAt, result, htmlLength, errorCode`.

### 5.5 Other tabs

| Tab | Columns |
|---|---|
| versions | itemId, version, fileId, savedAt, savedBy, note, restoredFrom, sizeBytes, sha256 |
| favorites | userEmail, itemId, createdAt |
| usage | userEmail, itemId, applyCount, lastUsedAt |
| group_members | groupEmail, resolver, members (JSON, chunked over rows if over 45,000 chars), childGroups (JSON), refreshedAt |
| audit | ADR-0003 Part D schema |
| meta | key, value (schemaVersion, lastBackupAt, lastRebuildAt) |

Body file JSON (Drive): `{ itemId, version, html, plainText, savedAt, savedBy }`.

Script Properties (config, no secrets): server `SPREADSHEET_ID`, `BODIES_FOLDER_ID`, `BACKUP_FOLDER_ID`, `DOMAIN`, `ADMIN_GROUP`, `ADMIN_EMAILS`, `MEMBERSHIP_RESOLVER`, `CALLER_IDENTITY`, `INDEX_VERSION`, `IMG_HOSTS`, `LOG_LEVEL`. Add-on `SERVER_URL`, `LOG_LEVEL`.

## 6. Server operations

All ops go through `dispatch`. Level is on the target folder (ADR-0003 Part C).

| Op | Level | Surface |
|---|---|---|
| sidebar.home, folder.list, template.list, search, search.body | use (results filtered) | both |
| template.get, template.apply | use | both |
| favorite.set, favorite.unset | use | both |
| template.create, template.update, template.duplicate, template.delete, template.restoreFromTrash | edit | web |
| template.move | edit on source and target | web |
| version.list, version.get, version.restore | edit | web |
| folder.create (sub), folder.rename, folder.move, folder.delete | manage | web |
| folder.create (top level), trash.purge | admin | web |
| grant.list, grant.add, grant.remove | manage | web |
| export.folder | manage | web |
| export.library, import, audit.query, usage.report, membership.refresh, config.get | admin | web |
| me | none beyond a valid caller | both |

## 7. Error, empty and loading states

Error codes and UI (wireframe 07):

| Code | Cause | Sidebar | Web app | Retry |
|---|---|---|---|---|
| AUTH_NO_USER | blank or non-domain active user | "Cannot identify your Migway account. Sign out of other Google accounts or use a separate Chrome profile." | Same, full page | no |
| DENIED | no level on target | "You don't have access to this template. Ask a folder manager." | Inline banner, item removed from list | no |
| NOT_FOUND | deleted or moved | "This template was removed or moved." + Refresh | Banner + link to library | no |
| CONFLICT | baseVersion stale | n/a | Conflict dialog (4.2) | after choice |
| BUSY | lock not acquired in 10 s | "Busy, try again." + Retry | Toast + Retry | yes |
| QUOTA | Apps Script quota or simultaneous executions | "Service is busy. Try again in a minute." | Toast | yes, after 60 s |
| VALIDATION | placeholder or size errors | n/a | Inline list under editor with positions | after fix |
| PROMPTS_MISSING | blank prompt at apply | Prompt card with fields marked | n/a | after fill |
| TIMEOUT, SERVER | network or unhandled | "Something went wrong. Retry." + request ID | Banner + request ID | yes |

Empty states:

- Sidebar, no visible templates: "No templates shared with you yet. Your private folder is ready: open the library to create one." Button: Open library.
- Sidebar, no favorites: "Star templates in the library to pin them here."
- Library, empty folder: "No templates in <folder>." Button: New template (edit level only).
- Library, no search results: "No templates match <query>. Try folder: or tag:."
- Trash empty: "Trash is empty. Deleted templates stay here for 30 days."
- Admin, folder without grants: "Only admins can see this folder. Add a grant to share it."

Loading states:

- Sidebar: Card Service shows Gmail's own spinner until the card returns. The server keeps it under the 3 s budget. No partial cards.
- Web app: skeleton rows for the list (8 rows), skeleton blocks for editor and history, `aria-busy="true"` on the region. Save button shows "Saving..." and is disabled; status text in a live region: "Saved as version 7".

## 8. Accessibility

- Every web app action reachable by keyboard: Tab order follows visual order; folder tree uses `role="tree"` with arrow keys, Enter opens; list uses `role="grid"` with arrow navigation; shortcuts: `/` focuses search, `Ctrl+S` saves, `Esc` closes dialogs.
- Focus visible on every interactive element (2 px outline, contrast 3:1 against background). Dialogs trap focus and return it to the opener.
- Every input has a visible `<label>`. Icon buttons have `aria-label` ("Add to favorites: Welcome email").
- Text contrast 4.5:1, large text 3:1. No information by color alone (conflict and error also have text and icon).
- Placeholder chips have `aria-label` "Placeholder: sender name" and are announced as one unit.
- Status changes (saved, restored, error) use `role="status"` or `role="alert"`.
- Editor toolbar buttons use `aria-pressed` for toggles. Toolbar is one tab stop with arrow-key navigation.
- Sidebar: buttons name the target ("Insert Welcome email"), not "Go". Card Service renders native controls.
- Target: Lighthouse accessibility 90 or higher on library, editor, history, admin (BRIEF 9).

## 9. OAuth scopes

Prefix `https://www.googleapis.com/auth/` omitted. Each scope has one reason.

addon project (every user consents):

| Scope | Class | Reason |
|---|---|---|
| gmail.addons.current.action.compose | Non-sensitive [R4 S8] | Insert the template into the draft |
| gmail.addons.current.message.metadata | Sensitive [R4 S8] | Read To recipients for `recipient.first_name` (D10) |
| script.external_request | Unclassified [R4 S7] | Call the server `/exec` URL with UrlFetchApp |
| drive.file | Non-sensitive [R4 S57] | The server `/exec` front door requires a Drive scope in the bearer token [A1]; `drive.file` grants access to no existing user files. Spike S2 confirms (Q6) |
| openid, userinfo.email | Non-sensitive | Only if `CALLER_IDENTITY=id_token` fallback is activated (Q7) |

server project (server owner consents, users never see these):

| Scope | Class | Reason |
|---|---|---|
| spreadsheets | Sensitive [R4 S58] | Read and write the data spreadsheet |
| drive.file | Non-sensitive [R4 S57] | Create and read body files, backups, exports created by the app |
| groups | Unverified [R4 S22] | GroupsApp membership snapshot (`groupsapp_direct`) |
| admin.directory.user.readonly | Unverified [R4 S59] | `domain_public` profiles for sender values and internal recipient first names |
| userinfo.email | Non-sensitive | `Session.getActiveUser().getEmail()` caller identity |
| script.scriptapp | Unclassified | Time-driven triggers: membership refresh, apply-event flush, purge, backup |
| script.external_request | Unclassified | Drive REST fallback, tokeninfo fallback |
| admin.directory.group.member.readonly | Unverified | Only after Groups Reader is granted and `MEMBERSHIP_RESOLVER=directory` |
| directory.readonly | Unverified | Only if Q9 fallback is needed |

No restricted scope is in the default set. `https://mail.google.com/` must never appear [R4 S7]; the build fails on unknown scopes (ADR-0005).

## 10. Quota budget per user action

Owner = server owner account. Figures with 200 templates, cache warm unless stated. Latency figures in ADR-0002.

| Action | Add-on (user quotas) | Server (owner quotas) | Target |
|---|---|---|---|
| Sidebar load, add-on cache hit | 1 User Cache getAll | none | under 1 s |
| Sidebar load, add-on cache miss | 1 UrlFetch, 1 User Cache putAll | 1 execution, about 4 Script Cache reads | under 3 s |
| Sidebar load, server rebuild | same | +3 tab reads (SpreadsheetApp), about 8 Script Cache writes, 1 script lock | under 5 s, rare |
| Apply | 1 UrlFetch, 0 to 1 User Cache read | 1 execution, about 4 Script Cache reads, 1 lock of 500 ms max for the event buffer | under 2 s p95 |
| Search (sidebar) | 1 UrlFetch | 1 execution, about 3 Script Cache reads | under 2 s |
| Search (web app) | n/a | 0 (browser) or 1 execution over `ft:*` | under 1 s |
| Save template | n/a | 1 execution, 1 Drive file create, 1 lock, 1 row update, 2 row appends, cache refresh | under 3 s |
| Membership refresh (trigger, 15 min) | n/a | up to 30 GroupsApp reads, 1 tab write | 2,880 GroupsApp reads per day max, under 10,000 [R4 S2] |
| Apply-event flush (trigger, 5 min) | n/a | 1 lock, 2 tab writes | 288 runs per day |

Daily ceilings at 500 users and 20 applies per user per day: 10,000 applies, about 20,000 server executions including sidebar loads. UrlFetch per user about 60 per day against 100,000 [R4 S2]. Trigger runtime about 40 min per day against 6 h [R4 S2]. Simultaneous executions are the tightest limit: 30 for the owner [R4 S2]; expected peak under 5.

## 11. Logging format

One JSON line per request and per trigger run, via `console.log(JSON.stringify(entry))`.

```
{"ts":"2026-11-09T14:03:22.120Z","level":"info","requestId":"01JC8...","surface":"addon","action":"template.apply","actor":"user@migway.com","targetId":"01JC7...","result":"ok","errorCode":"","durationMs":412,"cache":"hit","appVersion":"42"}
```

Rules: levels `debug`, `info`, `warn`, `error`; `debug` off in prod (`LOG_LEVEL`). Never log template bodies, prompt values, recipient addresses or tokens. Errors add `errorName` and the first 3 stack frames. Logs appear in the Apps Script executions view on the default GCP project and in Cloud Logging on the standard project (2.5b).

## 12. Measurable targets (BRIEF 9)

Web Gmail, dev deployment, 200 pilot templates:

| Target | Value | Measured by |
|---|---|---|
| Apply, click to body update | under 2 s p95 | `durationMs` logs plus stopwatch on 20 applies (slice 4) |
| Sidebar initial load | under 3 s | logs plus stopwatch on 10 cold opens (slice 4) |
| Web app list and search after first load | under 1 s | browser performance marks (slice 5) |
| UI-only permission checks | zero; every op passes `dispatch` | policy completeness test, role matrix test (slice 2) |
| Sanitizer fixtures | 30 or more pass (plan 40) | vitest (slice 3) |
| Keyboard | every web app action reachable, focus visible, labels on all inputs | manual checklist (slices 3, 5, 6) |
| Lighthouse accessibility | 90 or higher | Lighthouse on 4 views (slice 6) |

## 13. Slice map

| Spec section | Slice |
|---|---|
| 1 Scope | all |
| 2 Information architecture | 3 (web shell), 4 (sidebar) |
| 3 Topology and identity | 1 (two projects, manifests), 2 (dispatch, caller identity, spike S2) |
| 4 Screens 1, 2 and flow 4.1 | 4 |
| 4 Screens 3, 4 and flow 4.2 save | 3 |
| 4 Screen 5 and flow 4.2 restore, flow 4.4 search, favorites | 5 |
| 4 Screen 6, flows 4.3 and 4.5 | 6 |
| 4 Screen 7 states | 3 (web), 4 (sidebar), 6 (admin) |
| 5 Data model, tabs, reserved fields | 2 |
| 6 Server operations and policy table | 2 (dispatch and policy), 3 to 6 (handlers) |
| 7 Error, empty, loading states | 3, 4, 6 |
| 8 Accessibility | 3, 5, 6 |
| 9 OAuth scopes and scope check | 1 |
| 10 Quota budget, measurements | 2 (spike S2, cache), 4 (apply) |
| 11 Logging | 1 (logger), 2 (audit) |
| 12 Measurable targets | 2, 3, 4, 5, 6 as listed |
| ADR-0004 placeholder parser and sanitizer | 3; insert spike and allowlist trim in 4 |
| ADR-0005 repo, CI, deploy, rollback | 1; rollback exercise before slice 7 ends |
| Docs: README, admin install, quick start, runbook | 7 |

## 14. Spikes

| ID | Slice | Question | Pass condition |
|---|---|---|---|
| S2 | 2, first task | `drive.file` token passes `/exec` with `DOMAIN`; `getActiveUser` set on token calls; project sharing needed | first two yes; sharing answered |
| S2b | 2 | UrlFetch round trip to `/exec`, add-on start time, Drive file read time, `domain_public` fields | p95 numbers recorded in ADR-0002 |
| S4 | 4, first task | Draft insert on web, Android, iOS (ADR-0004 table) | allowlist and size cap updated |

## 15. Open questions for the owner

| ID | Question | Recommendation |
|---|---|---|
| Q1 (D7) | Edition, nested role groups, admin API restrictions | Keep `groupsapp_direct` and flat role groups until answered |
| Q2 | Two Apps Script projects instead of one (BRIEF A2) | Accept: users consent to 4 scopes, pilot editors never touch storage |
| Q3 | Prod server owner identity | An existing licensed shared account if one exists; else the owner's account plus a handover runbook |
| Q4 | OU grants inactive in v1 | Accept; mirror OUs as groups if needed |
| Q5 | Admins see private folders | Yes, disclosed in the quick start |
| Q6 | If `drive.file` fails the token gate | Owner chooses `drive.readonly` or an anonymous API project with ID tokens |
| Q7 | If `getActiveUser` is blank on token calls | Switch `CALLER_IDENTITY` to `id_token` |
| Q8 | If callers need the server project shared | Share as Viewer with an all-staff group (code only, no data) |
| Q9 | `domain_public` lacks title or phone | Use `searchDirectoryPeople` with `directory.readonly` (owner only) |
| Q10 | Audit retention | 24 months, archive at 300,000 rows |
| Q11 | External recipient first names | Not in v1; fallback or prompt |
| Q12 | Image hosts | Any `https` host, `IMG_HOSTS` to restrict |
| Q13 | BRIEF 2.5a says "execute as user accessing" | Update to "execute as me, access anyone in Migway" |
| Q14 | Apply events may lose up to 5 min on cache eviction | Accept, analytics only |
| Q15 | Version retention | Keep all in v1, revisit at 50,000 files |

## Sources

- docs/research/r1 to r4, feature-matrix.md, ux-notes.md, summary.md, read 2026-11-09. Tags [R2 S43], [R4 Sn] as in those files.
- [A1] https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script, third party, read 2026-11-09. Other [An] tags are listed in the ADR that uses them.
