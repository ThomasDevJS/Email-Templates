# Migway Gmail Templates: specification v1

Status: Proposed (gate G2, revised 2026-11-09 after D15: one project, Drive-only storage, near-zero maintenance)
Date: 2026-11-09
Author: architect. Owner: thomas@migway.com.
Inputs: docs/BRIEF.md, PLAN.md (D1 to D15), docs/research/*.md, ADR-0001 to ADR-0005.

Citations: [R4 S13] = docs/research/r4-platform-constraints.md source S13. ADR references point to docs/adr/.

## 1. Scope

v1 delivers templates only: create, edit, duplicate, move, soft delete, folders, tags, search, favorites, version history with restore, placeholders, one-click apply in the Gmail compose sidebar, admin UI (folders, grants, audit, export, import). Signatures, attachments, tracking, Chrome extension and public Marketplace listing are out (BRIEF 1). The data model reserves signature fields (section 5.4).

## 2. Information architecture

```
Gmail compose sidebar (add-on code, runs as the user)
  Home: search, Favorites, Recent, Folders
    Folder view (paged, 20 per page)
    Search results (paged)
    Template preview
      Prompt card (only if prompts or unresolved values)
        Apply -> draft body updated
    Open library / Edit -> web app in OVERLAY

Web app (same project, /exec, runs as the owner)
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

One Apps Script project per environment (D15). One manifest, one scope list (section 9), one versioned deployment carrying both entry points (ADR-0005).

| Piece | Runs as | Reads storage | Users consent to |
|---|---|---|---|
| Add-on code (Card Service, compose trigger) | the user | never; calls the same project's `/exec` | the 11 scopes of section 9 at self-install; nothing after the admin domain install [R4 S60] |
| Web app deployment (`USER_DEPLOYING`, `DOMAIN`) | the owner | yes, private | nothing extra (same manifest) |
| Time-driven triggers (section 16) | the owner | yes | nothing |
| Storage: one Drive folder of JSON files (ADR-0002) | owned by the owner, shared with nobody, `drive.file` | | |

Shared stores: Script Cache and Script Properties are read and written only by web app and trigger code. Add-on code uses only its User Cache. A boundary test enforces both rules (ADR-0003 Part A). The trust boundary is the code, which only the owner pushes.

Every web app request passes `dispatch(caller, op, args)`: identify caller, resolve principals from the membership snapshot, compute effective folder level, deny or run (ADR-0003 Part C).

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

JSON files in one private Drive folder (ADR-0002). `index.json` holds the `folders`, `grants` and `items` arrays below; side files hold favorites, usage and the membership snapshot. IDs are 26-character time-sortable strings. Times are ISO 8601 UTC. Every mutable record carries `version`; `index.json` carries `rev`. Tables below list record fields.

### 5.1 `folders`

| Field | Type | Notes |
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

| Field | Type | Notes |
|---|---|---|
| id | string | |
| folderId | string | |
| principalType | `group`, `user`, `domain`, `ou` | `ou` stored, inactive under `groupsapp_direct` |
| principalKey | string | group email, user email, domain, OU path |
| principalId | string or empty | Directory ID when the resolver provides it (rename safety, [R2 S43]) |
| level | `use`, `edit`, `manage` | |
| createdAt, createdBy | | |

### 5.3 `items` (templates now, signatures in v2)

| Field | Type | v1 use |
|---|---|---|
| id | string | |
| kind | `template` or `signature` | always `template` in v1 |
| folderId | string | |
| title | string, 1 to 120 chars | |
| subject | string or empty | reserved, not applied in v1 |
| tags | string array, max 10, each 1 to 30 chars | |
| status | `published` or `draft` | always `published` in v1 |
| currentVersion | integer | |
| bodyFileId | string | Drive file of the current version |
| snippet | string, 140 chars | plain text for lists |
| placeholders | string array | parsed names |
| prompts | string array | normalized labels |
| sizeBytes | integer | sanitized HTML size |
| createdAt, createdBy, updatedAt, updatedBy | | |
| deletedAt, deletedBy | | soft delete, 30-day trash |
| version | integer | equals currentVersion |

### 5.4 Reserved v2 signature fields (reserved names, omitted when empty in v1)

From [R2 lessons]. Present now so v2 needs no migration.

| Field | Type | Meaning |
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

Reserved file `push_log.json` (created in v2): records `id, itemId, userEmail, sendAs, pushedVersion, lastPushedAt, result, htmlLength, errorCode`.

### 5.5 Other files

| File | Content |
|---|---|
| `index.json` | `{ schemaVersion, rev, updatedAt, folders[], grants[], items[], pendingAudit[] }`. 0.85 MB at 1,000 items, 8.4 MB at 10,000 (ADR-0002) |
| `favorites.json` | `{ rev, byUser: { email: [itemId] } }` |
| `usage.json` | `{ rev, items: { itemId: { applyCount, lastUsedAt } }, recent: { email: [itemId, max 20] } }` |
| `members.json` | `{ refreshedAt, resolver, groups: { groupEmail: { members[], childGroups[], status } } }` |
| `bodies/<itemId>.v<version>.json` | `{ itemId, version, html, plainText, savedAt, savedBy, note, restoredFrom, sha256 }`, immutable. Drive `appProperties`: `itemId, version, savedBy, restoredFrom`. Version history = one `files.list` by `itemId` |
| `audit/YYYY-MM.jsonl` | one ADR-0003 Part D event per line, append-only |
| `backups/YYYY-MM-DD/` | copies of `index.json`, `favorites.json`, `usage.json`, 14 kept |

Script Properties (config and state, no secrets, read and written only by web app and trigger code): `STORE` (JSON of folder and file IDs), `INDEX_REV`, `DOMAIN`, `ADMIN_GROUP`, `ADMIN_EMAILS`, `MEMBERSHIP_RESOLVER`, `CALLER_IDENTITY`, `IMG_HOSTS`, `LOG_LEVEL`, `TRIGGERS_VERSION`, `job:<name>:lastOk`, `job:<name>:lastError`. The `/exec` URL is a build constant (ADR-0005), so the add-on reads no property.

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
| export.library, import, audit.query, usage.report, membership.refresh, config.get, backup.list, backup.restore | admin | web |
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

One manifest, one list (D15, ADR-0001). Every self-installing user consents to all default scopes; the admin domain install skips the consent screen [R4 S60]. Prefix `https://www.googleapis.com/auth/` omitted. Consent text from [A10 in ADR-0002].

Default list, 11 scopes (spike S2 in progress, list to be trimmed once the front door rule is known):

| Scope | Class | Consent text | Used by | Reason |
|---|---|---|---|---|
| gmail.addons.execute | Non-sensitive, add-on scope | "Run as a Gmail add-on" | add-on | Required at runtime by Gmail for the compose trigger. Verified 2026-11-09 on the dev deployment: without it Gmail raises "Required permissions: gmail.addons.execute". R4 S42 (release note of 2019) is wrong in practice |
| gmail.addons.current.action.compose | Non-sensitive [R4 S8] | "Manage drafts and send emails when you interact with the add-on" | add-on | Insert the template into the draft |
| gmail.addons.current.message.metadata | Sensitive [R4 S8] | "View your email message metadata when the add-on is running" | add-on | Read To recipients for `recipient.first_name` (D10) |
| script.external_request | Unclassified [R4 S7] | not published | add-on | Call the project's own `/exec` with UrlFetchApp |
| drive.file | Non-sensitive [R4 S57] | "See, edit, create, and delete only the specific Google Drive files you use with this app" | web app, triggers; also in the add-on token | Storage files the app creates (ADR-0002); the `/exec` front door needs a Drive scope in the bearer token [A1] |
| drive.metadata.readonly | Sensitive, not restricted | "See information about your Google Drive files" | add-on | Spike S2 (a) result 2026-11-09: a `drive.file`-only token gets HTTP 404 from the `/exec` and `/dev` front door, because the script project is not a file the app created. Metadata read lets Google resolve the script. Alternative: Pattern B second deployment (ADR-0003 Q6). Owner decision pending |
| script.projects.readonly | Sensitive (Apps Script API) | "View Google Apps Script projects" | add-on | Spike S2 (a) test 2026-11-09: drive.file plus drive.metadata.readonly still gave 404 on both URL forms. The working token from the orchestrator session carried script.projects. Under test |
| userinfo.email | Non-sensitive | "See your primary Google Account email address" | web app | `Session.getActiveUser().getEmail()` caller identity |
| groups | Unverified [R4 S22] | "View and manage your Google Groups" | triggers, web app | GroupsApp membership snapshot (`groupsapp_direct`) |
| admin.directory.user.readonly | Unverified [R4 S59] | "See info about users on your domain" | web app | `domain_public` profiles for sender values and internal recipient first names (ADR-0004) |
| script.scriptapp | Unclassified | not published | web app, `setup()` | Install the 3 time-driven triggers (section 16) |

Removed from the first proposal: `spreadsheets` (storage moved to Drive JSON, ADR-0002), the separate server list (one project).

Conditional, added only when the stated event happens:

| Scope | Event | Reason |
|---|---|---|
| openid | Q7: `getActiveUser` blank on token calls | `getIdentityToken()` for `CALLER_IDENTITY=id_token` |
| openid (second API deployment) | Q6: `drive.file` fails the `/exec` token gate | Recommended: API deployment of the same project, `ANYONE_ANONYMOUS`, ID-token verification; settings are per deployment [A12 in ADR-0003] |
| drive.readonly (restricted) | Q6, last resort, if the API deployment fails | Drive scope the front door accepts |
| admin.directory.group.member.readonly | Groups Reader granted, `MEMBERSHIP_RESOLVER=directory` | Nested membership |
| directory.readonly | Q9: `domain_public` lacks title or phone | `searchDirectoryPeople`, replaces `admin.directory.user.readonly` |

No restricted scope is in the default list. `https://mail.google.com/` must never appear [R4 S7]; the build fails on any scope outside these two tables (ADR-0005). Slice 1 confirms that Cache, Properties and Lock need no extra scope and that the Advanced Drive service runs on `drive.file` alone (Q16).

## 10. Quota budget per user action

Owner = the account that owns the project and the web app deployment. Figures with 200 templates, cache warm unless stated. Latency figures in ADR-0002.

| Action | Add-on (user quotas) | Server (owner quotas) | Target |
|---|---|---|---|
| Sidebar load, add-on cache hit | 1 User Cache getAll | none | under 1 s |
| Sidebar load, add-on cache miss | 1 UrlFetch, 1 User Cache putAll | 1 execution, about 4 Script Cache reads | under 3 s |
| Sidebar load, server rebuild | same | +1 Drive file read (`index.json`), about 10 Script Cache writes, 1 script lock | under 3 s, rare |
| Apply | 1 UrlFetch, 0 to 1 User Cache read | 1 execution, about 4 Script Cache reads, 1 lock of 500 ms max for the event buffer | under 2 s p95 |
| Search (sidebar) | 1 UrlFetch | 1 execution, about 3 Script Cache reads | under 2 s |
| Search (web app) | n/a | 0 (browser) or 1 execution over `ft:*` | under 1 s |
| Save template | n/a | 1 execution, 1 Drive file create, 1 lock, 1 `index.json` write (change and audit event together), cache refresh | under 3 s (about 2.1 s at 1,000 items) |
| Membership refresh (trigger, 15 min) | n/a | up to 30 GroupsApp reads, 1 Drive file write | 2,880 GroupsApp reads per day max, under 10,000 [R4 S2] |
| `tick` (trigger, 5 min) | n/a | 1 lock, 1 `usage.json` write when events exist, cache re-puts | 288 runs per day |
| `daily` (trigger) | n/a | 1 month-file append, purge, backup copies (3 files) | 1 run per day |

Daily ceilings at 500 users and 20 applies per user per day: 10,000 applies, about 20,000 server executions including sidebar loads. UrlFetch per user about 60 per day against 100,000 [R4 S2]. Trigger runtime about 27 min per day against 6 h [R4 S2]. Simultaneous executions are the tightest limit: 30 for the owner [R4 S2]; expected peak under 5.

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
| 3 Topology and identity | 1 (one project, one manifest, one deployment per environment, boundary test), 2 (dispatch, caller identity, spike S2) |
| 4 Screens 1, 2 and flow 4.1 | 4 |
| 4 Screens 3, 4 and flow 4.2 save | 3 |
| 4 Screen 5 and flow 4.2 restore, flow 4.4 search, favorites | 5 |
| 4 Screen 6, flows 4.3 and 4.5 | 6 |
| 4 Screen 7 states | 3 (web), 4 (sidebar), 6 (admin) |
| 5 Data model, JSON files, reserved fields | 2 |
| 6 Server operations and policy table | 2 (dispatch and policy), 3 to 6 (handlers) |
| 7 Error, empty, loading states | 3, 4, 6 |
| 8 Accessibility | 3, 5, 6 |
| 9 OAuth scopes and scope check | 1 |
| 16 Operations: `setup()`, triggers, job health | 1 (`setup()` and empty trigger handlers), 2 (`tick`, `refreshMembers`, `daily` work), 6 (job health in Config tab, backup restore) |
| 10 Quota budget, measurements | 2 (spike S2, cache), 4 (apply) |
| 11 Logging | 1 (logger), 2 (audit) |
| 12 Measurable targets | 2, 3, 4, 5, 6 as listed |
| ADR-0004 placeholder parser and sanitizer | 3; insert spike and allowlist trim in 4 |
| ADR-0005 repo, CI, deploy, rollback | 1; rollback exercise before slice 7 ends |
| Docs: README, admin install, quick start, runbook | 7 |

## 14. Spikes

| ID | Slice | Question | Pass condition |
|---|---|---|---|
| S2 | 2, first task | (a) `drive.file` token passes `/exec` with `DOMAIN`; (b) `getActiveUser` set on token calls; (c) project sharing needed; (d) token call to `/dev` works for editors; (e) Advanced Drive service works on `drive.file` alone | (a), (b), (e) yes; (c), (d) answered |
| S2b | 2 | UrlFetch round trip to `/exec`, add-on start time, Drive read and write of 0.85 MB and 8.4 MB files, `domain_public` fields | p95 recorded in ADR-0002; 0.85 MB read and write each under 2 s (Q17) |
| S4 | 4, first task | Draft insert on web, Android, iOS (ADR-0004 table) | allowlist and size cap updated |

## 15. Open questions for the owner

| ID | Question | Recommendation |
|---|---|---|
| Q1 (D7) | Edition, nested role groups, admin API restrictions | Keep `groupsapp_direct` and flat role groups until answered |
| Q2 | Two Apps Script projects instead of one (BRIEF A2) | Decided 2026-11-09 by the owner (D15): one project, topology 1a |
| Q3 | Prod server owner identity | An existing licensed shared account if one exists; else the owner's account plus a handover runbook |
| Q4 | OU grants inactive in v1 | Accept; mirror OUs as groups if needed |
| Q5 | Admins see private folders | Yes, disclosed in the quick start |
| Q6 | If `drive.file` fails the token gate | Second API deployment of the same project with ID-token verification (adds `openid` only); last resort `drive.readonly` (restricted) |
| Q7 | If `getActiveUser` is blank on token calls | Switch `CALLER_IDENTITY` to `id_token` |
| Q8 | If callers need the project shared | Share prod as Viewer with an all-staff group (code only, no data, no secrets) |
| Q9 | `domain_public` lacks title or phone | Use `searchDirectoryPeople` with `directory.readonly` (owner only) |
| Q10 | Audit retention | 24 months, archive at 300,000 rows |
| Q11 | External recipient first names | Not in v1; fallback or prompt |
| Q12 | Image hosts | Any `https` host, `IMG_HOSTS` to restrict |
| Q13 | BRIEF 2.5a still describes topology 1b ("server project", add-on installed separately) | Orchestrator rewrites 2.5a for one project; `setup()` creates the storage folder, not the owner by hand |
| Q14 | Apply events may lose up to 5 min on cache eviction | Accept, analytics only |
| Q15 | Version retention | Keep all in v1, revisit at 50,000 files |
| Q16 | Advanced Drive service on `drive.file` alone | Spike S2 (e); fallback Drive REST via UrlFetch, same scope |
| Q17 | Thresholds that keep Drive-only storage | 0.85 MB read and write each under 2 s in spike S2b; else ADR-0002 reopens with Sheets and its consent cost |
| Q18 | Prod data in My Drive or a shared drive | Prod owner's My Drive; shared drive only if `setup()` can create its own folder there (2.5b dry run) |
| Q19 | Dev web app on `/dev` or versioned `/exec` | `/dev` if spike S2 (d) passes: 0 versions per dev deploy |

## 16. Operations and maintenance

Target (BRIEF 1 Operations): the only recurring human task is deploying a new version. Details in ADR-0003 Part B (triggers) and ADR-0005 (Maintenance).

Triggers. All time-driven, owned by and running as the owner. `setup()` installs them idempotently; the owner runs it once per environment after the first deploy, and the first web app request after each deploy reinstalls them when `TRIGGERS_VERSION` changes.

| Trigger | Schedule | Work | Runtime per day (estimate) |
|---|---|---|---|
| `tick` | every 5 min | apply events to `usage.json`, denied events to `pendingAudit`, cache re-put before the 6 h TTL, early audit flush above 200 KB | about 10 min |
| `refreshMembers` | every 15 min | membership snapshot to `members.json` and cache | about 16 min |
| `daily` | once a day, 02:00 to 03:00 script time zone | audit roll to `audit/YYYY-MM.jsonl`, trash purge after 30 days, orphan body cleanup, backup (14 kept), audit retention 24 months, job health | about 1 min |

Total about 27 min per day against the 6 h trigger budget; 3 of 20 allowed triggers [R4 S2]. The admin Config tab shows `lastOk` per job and flags a job late by more than 2 intervals.

Human tasks:

| Task | Who | Frequency |
|---|---|---|
| Deploy a new version (`npm run deploy -- prod`) | owner | per release |
| Prune versions in Project History | owner | when deploy output shows 150 of 200: about every 150 prod releases (6 years at 2 per month); dev never in `/dev` mode, else every 6 weeks during Phase 3 |
| Run `setup()` | owner | once per environment |
| Read a trigger failure email, redeploy or roll back | owner | only on failure |
| Remove pilot editors from dev | owner | once, after 2.5b |
| Owner identity change: export, deploy, `setup()`, import | owner and admin | on staff change |

Template, folder and grant changes and backup restores happen in the web app, done by managers and admins. Role group membership changes happen in Google Groups. Nobody edits code or data files by hand.

## Sources

- docs/research/r1 to r4, feature-matrix.md, ux-notes.md, summary.md, read 2026-11-09. Tags [R2 S43], [R4 Sn] as in those files.
- [A1] https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script, third party, read 2026-11-09. Other [An] tags are listed in the ADR that uses them.
