# Migway Gmail Templates: specification v1

Status: Accepted at G2 2026-11-09. Errata and D21 (template subject) amendment 2026-11-10: Proposed until the owner approves. Errata run 2 (2026-11-10): D24 subject rule, slices 5b, 5c, 6a, 6b, built ops, log `draft` object; Proposed until the owner approves.
Date: 2026-11-09, amended 2026-11-10
Author: architect. Owner: thomas@migway.com.
Inputs: docs/BRIEF.md, PLAN.md (D1 to D24), docs/research/*.md, ADR-0001 to ADR-0005.

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
        Apply -> draft body updated; template subject set when the draft subject is empty (D21, D24)
    Open library / Edit -> web app in OVERLAY

Web app (same project, /exec, runs as the owner)
  Library  (default view)
    Folder tree | template list | search | favorites filter | trash
  Editor   (?view=editor&id=...)
    Title, subject, folder, tags, body, placeholder menu, preview as me, save
  History  (?view=history&id=...)
    Version list, preview, restore
  Admin    (?view=admin, admins and manage holders)
    Folders and grants | Memberships | Audit log | Usage | Export and import | Config (read only)
```

Private folders (D18, amended 2026-11-10). The library shows admins every private folder. The sidebar does not: `sidebar.home` filters other users' private folders out for admins too, in the handler (`visibleFolders`). The filter grants nothing and hides nothing an admin can reach in the library.

Navigation in the web app is a left rail: Library, Admin (visible to admins and manage holders only). The URL query `view` restores state on reload.

## 3. Topology and identity (summary of ADR-0001, ADR-0003)

One Apps Script project per environment (D15). One manifest, one scope list (section 9), one versioned deployment carrying both entry points (ADR-0005).

| Piece | Runs as | Reads storage | Users consent to |
|---|---|---|---|
| Add-on code (Card Service, compose trigger) | the user | never; calls the same project's `/exec` | the 10 scopes of section 9 at self-install; nothing after the admin domain install [R4 S60] |
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
| 2 | Sidebar preview and prompt cards | docs/wireframes/02-sidebar-prompt.txt | 4 (subject in 5) |
| 3 | Web app library | docs/wireframes/03-web-library.txt | 3 (search, favorites in 5) |
| 4 | Web app editor | docs/wireframes/04-web-editor.txt | 3 (subject field in 5) |
| 5 | Web app history | docs/wireframes/05-web-history.txt | 3 (subject line in 5) |
| 6 | Admin | docs/wireframes/06-web-admin.txt | 6a (shell, Folders and grants, Memberships), 6b (other tabs) |
| 7 | States | docs/wireframes/07-states.txt | 3, 4, 6 |

### 4.1 Flow: apply a template (DoD 1)

1. User opens compose, opens the add-on. Compose trigger reads the add-on User Cache `view:*`; on miss it calls server op `sidebar.home`.
2. Server returns Favorites (max 10), Recent (max 5, from `usage`), top-level folders the caller can `use`, and the caller's filtered list for caching.
3. User taps Insert on a template. The callback calls server op `template.apply` with `{ id, knownVersion, recipientEmailIfInternal }`. The server re-checks `use`, returns body and subject (if version changed), sender profile, internal recipient first name, and buffers the apply event.
4. No prompts and no unresolved values: the add-on renders and returns one `UpdateDraftActionResponse` with `UpdateDraftBodyAction` (`IN_PLACE_INSERT`, `MUTABLE_HTML`) and, when the subject rule of section 5.6 (D24) says so, `UpdateDraftSubjectAction`. One click. Verified on Gmail web: spike S5 on dev-32a446c, smoke "Slice 5c" on dev-848206f.
5. Otherwise the add-on pushes the prompt card. Its Insert calls `template.apply` again with `followUp: true`. The server re-checks `use` on that call and buffers no second apply event, so one Insert tap counts once. A grant removed while the card is open gives DENIED and leaves the draft unchanged. Then the callback validates every field, renders body and subject, inserts. Blank fields keep the card with an error.
6. Usage counts the first Insert tap. A cancelled prompt card still counts in `applyCount` and Recent (accepted, Q14: usage is analytics).

### 4.2 Flow: edit and restore (DoD 2)

1. Editor opens from the library or from the sidebar Edit button (OVERLAY, RELOAD_ADD_ON).
2. Save sends `{ id, baseVersion, title, subject, folderId, tags, html }`. Server sanitizes, validates placeholders and the subject (section 5.6), writes the version (ADR-0002 write sequence). Conflict shows a dialog: "Changed by <name> at <time>. Open their version / Copy my text / Cancel." No silent overwrite.
3. History lists versions with their subject. Restore creates version N+1 from subject and body of version K and writes an audit row.

### 4.3 Flow: grant access (DoD 3)

1. Admin opens Admin > Folders, selects a folder, adds a grant: principal (group email, user email, domain, OU marked inactive in v1), level (use, edit, manage).
2. Server validates the group exists via the resolver, writes `grants`, adds the group to the refresh set, refreshes its snapshot under lock, writes audit.
3. A user outside the group calls `folder.list` or `template.get`: server returns no rows or `DENIED`. Unit test and manual smoke step cover it.

### 4.4 Flow: search

- Sidebar: search input with `onChangeAction`. Server op `search` returns the top 20 visible matches. Operators `folder:<name>` and `tag:<name>`. Empty query shows Home, with no server call. The sidebar matches title, subject, tags, folder path and the 140-character `snippet` of the index item. It never reads full body text (amended 2026-11-10, slice 5 review minor 1).
- Web app: title, subject, folder path and tag filtering runs in the browser on the loaded index. Full body text is searched in the web app only: server op `search.body` runs 300 ms after the last keystroke, reads Script Cache entries `ft:<bodyFileId>` with one `getAll`, and makes at most 25 Drive reads per call for misses. The rest are reported as `skipped` ("N templates were not searched yet."). Results not already listed show under "Matches in text". While the call runs the list shows "Searching text...". Sort: relevance, then the caller's Recent position, then title.
- Matching: case-insensitive, accent-insensitive token prefix match on title (weight 3), subject (2, D21), tags (2), folder (2), body text (1: the snippet in the sidebar, the full text in `search.body`). Every term must match. Query cut at 200 characters. Both ops filter to the caller's visible templates before ranking. Fuzzy tolerance: one typo for terms of 5 or more characters, at half weight.

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
| subject | string, 0 to 200 chars | applied to the draft in v1 (D21, section 5.6). Empty = the draft subject is not touched |
| tags | string array, max 10, each 1 to 30 chars | |
| status | `published` or `draft` | always `published` in v1 |
| currentVersion | integer | |
| bodyFileId | string | Drive file of the current version |
| snippet | string, 140 chars | plain text for lists |
| placeholders | string array | parsed names, subject and body together |
| prompts | string array | normalized labels, subject and body together |
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
| `bodies/<itemId>.v<version>.json` | `{ itemId, version, subject, html, plainText, savedAt, savedBy, note, restoredFrom, sha256 }`, immutable. `subject` added 2026-11-10 (D21); a file without it reads as `""`. Drive `appProperties`: `itemId, version, savedBy, restoredFrom`. Version history = one `files.list` by `itemId` |
| `audit/YYYY-MM.jsonl` | one ADR-0003 Part D event per line, append-only |
| `backups/YYYY-MM-DD/` | copies of `index.json`, `favorites.json`, `usage.json`, 14 kept |

### 5.6 Template subject (D21, amended 2026-11-10)

Mechanism and options in ADR-0004, Amendment 2026-11-10 (subject).

- Field: plain text, 0 to 200 characters after trim. No CR, LF or other control characters (U+0000 to U+001F, U+007F, U+2028, U+2029). Empty is allowed and means "do not touch the draft subject".
- Placeholders: the ADR-0004 grammar applies to the subject as one text run. `\{{` is the escape. Prompts are shared with the body: one label identity is asked once and fills both. Implicit prompts for unresolved values are shared the same way. `PH_TOO_MANY` counts distinct prompts over subject and body together (max 20).
- Rendering: values are inserted as plain text, never HTML-escaped. Every CR, LF, tab and other control character in the rendered result becomes one space; runs of spaces collapse; the result is trimmed.
- Save validation (server, every write: create, update, duplicate, restore, import). Codes carry `field: "subject"` and the character offset: `SUBJ_TOO_LONG` ("Subject must be 200 characters or fewer"), `SUBJ_LINEBREAK` ("Subject must be one line"), and the ADR-0004 `PH_*` codes except `PH_ATTR` and `PH_BACKSLASH`. Import replaces line breaks with one space and reports the count; it rejects only `SUBJ_TOO_LONG` and `PH_*`.
- Apply: `template.apply` and `template.getBody` return `subject` with the body (same `knownVersion` rule). The add-on caches it in `body:<id>` next to the HTML.
- Draft (D24, amended 2026-11-10; replaces the D21 rule "a non-empty rendered subject replaces whatever the draft subject holds"). The Gmail compose event carries `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients` and `subject`. It never carries `threadId` or `messageId` (smoke "Slice 5b", dev-4a233d4) [A13]. The add-on reads the draft subject from the event of the Insert callback (`draftHasSubject`): only a string with a non-space character counts as filled. The template subject is set only when the draft subject is empty or whitespace. A typed, reply or forward subject is kept, so a reply stays in its conversation. Rules per Insert path:

  | Insert path | Draft subject empty | Draft subject filled |
  |---|---|---|
  | One-click Insert (lists), preview Insert | sets it | keeps it |
  | Preview "Insert with subject" (shown when the draft has a subject) | sets it | replaces it |
  | Preview "Insert body only" (shown when the draft subject is empty) | keeps it | keeps it |
  | Prompt card switch "Replace the subject" | starts on, user decides | starts off, user decides |

  An empty rendered subject sends no subject action, so the draft subject is never cleared. Verified in smoke "Slice 5c" on dev-848206f, 4 of 4 (wireframe 02).
- History: each version file stores its subject. Restore of version K copies subject and body of K into version N+1. History shows the subject line of each version.
- Search: subject weight 2 (section 4.4).
- Logs: the subject is template content. It is never logged, like the body.

Script Properties (config and state, no secrets, read and written only by web app and trigger code): `STORE` (JSON of folder and file IDs), `INDEX_REV`, `FAVORITES_REV`, `USAGE_REV` (published revisions of `favorites.json` and `usage.json`, ADR-0002 Amendment 2026-11-10), `DOMAIN`, `ADMIN_GROUP`, `ADMIN_EMAILS`, `MEMBERSHIP_RESOLVER`, `CALLER_IDENTITY`, `IMG_HOSTS`, `LOG_LEVEL`, `TRIGGERS_VERSION`, `job:<name>:lastOk`, `job:<name>:lastError`. The `/exec` URL is a build constant (ADR-0005), so the add-on reads no property.

## 6. Server operations

All ops go through `dispatch`. Level is on the target folder (ADR-0003 Part C).

| Op | Level | Surface |
|---|---|---|
| sidebar.home, folder.list, template.list, search, search.body | use (results filtered) | both |
| template.get, template.getBody, template.apply | use | both |
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

`spike.s4` and its policy row were removed in slice 5.

Status 2026-11-10 (build a7e5abb): `template.getBody` (slice 3) returns the readable body without an apply event; the add-on uses it on a body cache miss. `template.apply` takes `followUp: true` on the prompt card Insert (section 4.1 step 5). `template.duplicate` is built (slice 4b): title "Copy of ...", cut to 120, tags, subject and the current body become version 1; edit on source and target. `search`, `search.body`, `favorite.set` and `favorite.unset` are built (slice 5). `template.restoreFromTrash` has a server handler; its Trash view is slice 6a. Stubs that answer "not implemented" (`LATER_SLICE_OPS`): `trash.purge` (6a), `export.folder`, `export.library`, `import`, `audit.query`, `usage.report`, `config.get`, `backup.list`, `backup.restore` (6b).

## 7. Error, empty and loading states

Error codes and UI (wireframe 07). Guard order: blank caller gives AUTH_NO_USER first, then NOT_CONFIGURED while `DOMAIN` is unset (every caller, in or out of the domain), then the domain check, then the policy row.

| Code | Cause | Sidebar | Web app | Retry |
|---|---|---|---|---|
| NOT_CONFIGURED | Script Property `DOMAIN` unset: `setup()` has not run | "Migway Templates is not set up yet. Ask the owner to finish setup." | Same, full page | no |
| AUTH_NO_USER | blank or non-domain active user | "Cannot identify your Migway account. Sign out of other Google accounts or use a separate Chrome profile." | Same, full page | no |
| DENIED | no level on target | "You don't have access to this template. Ask a folder manager." | Inline banner, item removed from list | no |
| NOT_FOUND | deleted or moved | "This template was removed or moved." + Refresh | Banner + link to library | no |
| CONFLICT | baseVersion stale | n/a | Conflict dialog (4.2) | after choice |
| BUSY | lock not acquired in 10 s | "Busy, try again." + Retry | Toast + Retry | yes |
| QUOTA | Apps Script quota or simultaneous executions | "Service is busy. Try again in a minute." | Toast | yes, after 60 s |
| VALIDATION | placeholder, subject, size or request ID errors | n/a | Inline list under editor with positions | after fix |
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

Default list, 10 scopes (final after spike S2 (a), 2026-11-09):

| Scope | Class | Consent text | Used by | Reason |
|---|---|---|---|---|
| gmail.addons.execute | Non-sensitive, add-on scope | "Run as a Gmail add-on" | add-on | Required at runtime by Gmail for the compose trigger. Verified 2026-11-09 on the dev deployment: without it Gmail raises "Required permissions: gmail.addons.execute". R4 S42 (release note of 2019) is wrong in practice |
| gmail.addons.current.action.compose | Non-sensitive [R4 S8] | "Manage drafts and send emails when you interact with the add-on" | add-on | Insert the template into the draft; set the draft subject (D21, D24). Google's compose guide names no extra scope for `UpdateDraftSubjectAction` [A14]. Spike S5 on dev-32a446c: body and subject actions in one response, no new scope (Q20 closed) |
| gmail.addons.current.message.metadata | Sensitive [R4 S8] | "View your email message metadata when the add-on is running" | add-on | Read To recipients for `recipient.first_name` (D10) |
| script.external_request | Unclassified [R4 S7] | not published | add-on | Call the project's own `/exec` with UrlFetchApp |
| drive.file | Non-sensitive [R4 S57] | "See, edit, create, and delete only the specific Google Drive files you use with this app" | web app, triggers; also in the add-on token | Storage files the app creates (ADR-0002); the `/exec` front door needs a Drive scope in the bearer token [A1] |
| script.projects.readonly | Sensitive (Apps Script API) | "View Google Apps Script projects" | add-on | Spike S2 (a) result 2026-11-09: the web app front door resolves the script project through the caller token. `drive.file` alone and `drive.file` plus `drive.metadata.readonly` gave HTTP 404; with this scope Ping returned ok in 35 ms. Alternative accepted scopes per third-party notes: `drive`, `drive.readonly` (both restricted) |
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
| Search (sidebar) | 1 UrlFetch | 1 execution, 1 Properties read, 6 Script Cache reads, 0 Drive reads (title, subject, tags, folder, snippet) | under 2 s |
| Search (web app) | n/a | 0 (browser filter on the loaded index) or 1 `search.body` execution: 1 Properties read, 7 Script Cache reads with all `ft:<bodyFileId>` entries warm, 1 Drive read per missing entry, at most 25 per call | under 1 s |
| Favorite set or unset | n/a | 1 execution, 1 lock, 1 Drive read and 1 Drive write of `favorites.json`, 1 property write (`FAVORITES_REV`) | not set |
| Save template | n/a | 1 execution, 1 Drive file create, 1 lock, 1 `index.json` write (change and audit event together), cache refresh | under 3 s (about 2.1 s at 1,000 items) |
| Membership refresh (trigger, 15 min) | n/a | up to 30 GroupsApp reads, 1 Drive file write | 2,880 GroupsApp reads per day max, under 10,000 [R4 S2] |
| `tick` (trigger, 5 min) | n/a | 1 lock, 1 `usage.json` write when events exist, cache re-puts | 288 runs per day |
| `daily` (trigger) | n/a | 1 month-file append, purge, backup copies (3 files) | 1 run per day |

Daily ceilings at 500 users and 20 applies per user per day: 10,000 applies, about 20,000 server executions including sidebar loads. UrlFetch per user about 60 per day against 100,000 [R4 S2]. Trigger runtime about 27 min per day against 6 h [R4 S2]. Simultaneous executions are the tightest limit: 30 for the owner [R4 S2]; expected peak under 5.

## 11. Logging format

One JSON line per request and per trigger run, via `console.log(JSON.stringify(entry))`. Add-on executions log nothing; their phase times and the `draft` object reach the server line.

```
{"ts":"2026-11-10T14:03:22.120Z","level":"info","requestId":"MWARO9CA-YG9VT8","surface":"addon","action":"template.apply","actor":"user@migway.com","targetId":"01JC7...","result":"ok","errorCode":"","durationMs":412,"cache":"hit","appVersion":"42","calls":{"props":1,"cache":9,"drive":0,"lock":1,"dir":0},"timing":{"startupMs":40,"totalMs":420,"propsMs":3,"cacheMs":60,"driveReadMs":0,"driveWriteMs":0,"lockMs":35,"dirMs":0,"addonPreMs":310,"addonTokenMs":20,"prevFetchMs":0,"prevTotalMs":0}}
```

Fields added 2026-11-10 (slice 4b):

| Field | Content |
|---|---|
| `requestId` | One format on both surfaces: `XXXXXXXX-XXXXXX`, 8 base-36 time characters, a dash, 6 random, upper case. Pattern `^[0-9A-Z]{8}-[0-9A-Z]{6}$`, generator and check in src/shared/requestId.ts. The server enforces it on add-on and web calls before parsing: any other value answers VALIDATION "Request ID must have the format XXXXXXXX-XXXXXX", and the log line and audit events carry a server-made ID. Client text never reaches the log |
| `action` | The op name only when the policy table knows it, else `""` |
| `targetId` | `args.id`, else `args.folderId`, only when it is a well-formed 26-character ID, else `""` |
| `calls` | Service calls in this execution: `props` (Script Properties), `cache` (Script Cache), `drive`, `lock` (`tryLock`), `dir` (Admin Directory). Integers |
| `timing` server keys | `startupMs` (bundle evaluation to handler start), `totalMs` (to the log line), `propsMs`, `cacheMs`, `driveReadMs`, `driveWriteMs`, `lockMs`, `dirMs` |
| `timing` add-on keys | `addonPreMs` (add-on start to this call), `addonTokenMs` (`getOAuthToken`), `prevFetchMs` and `prevTotalMs` (the previous server call of the same add-on execution). The server keeps only these 4 keys, whole ms from 0 to 600,000, and drops anything else |

Field added 2026-11-10 (slices 5b and 5c), add-on calls only:

| Field | Content |
|---|---|
| `draft` | `{ fields, to, cc, bcc, hasSubject }`. `fields`: the compose event field names present, each from the fixed list `messageId`, `threadId`, `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients`, `subject`, in that order. A field counts as present when its value is not undefined, null or "". `to`, `cc`, `bcc`: recipient counts, integers 0 to 1,000. `hasSubject`: boolean, true when the draft subject has a non-space character. The server requires exactly these 5 keys; any other key, name, repeated name, count or a non-boolean `hasSubject` answers VALIDATION "Draft fields must come from the fixed list", and the rejected value is not logged |

Example: `"draft":{"fields":["draftMetadata","toRecipients","subject"],"to":1,"cc":0,"bcc":0,"hasSubject":true}`.

Rules: levels `debug`, `info`, `warn`, `error`; `debug` off in prod (`LOG_LEVEL`). `actor` and `targetId` are in every line. No line holds a recipient address, subject text, body text, prompt value or token: `draft` carries names, counts and one boolean only. Never log template bodies, subjects, prompt values, recipient addresses or tokens. `calls` and `timing` hold numbers only. Errors add `errorName` and the first 3 stack frames. Logs appear in the Apps Script executions view on the default GCP project and in Cloud Logging on the standard project (2.5b).

## 12. Measurable targets (BRIEF 9)

Web Gmail, dev deployment, 200 pilot templates:

| Target | Value | Measured by |
|---|---|---|
| Apply, click to body update | under 2 s p95 (BRIEF 9). D23 open, assumption in force: 3 s accepted for apply in v1 | `durationMs` logs plus stopwatch on 20 applies (slice 4) |
| Sidebar initial load | under 3 s | logs plus stopwatch on 10 cold opens (slice 4) |
| Web app list and search after first load | under 1 s | browser performance marks (slice 5) |
| UI-only permission checks | zero; every op passes `dispatch` | policy completeness test, role matrix test (slice 2) |
| Sanitizer fixtures | 30 or more pass (plan 40) | vitest (slice 3) |
| Keyboard | every web app action reachable, focus visible, labels on all inputs | manual checklist (slices 3, 5, 6) |
| Lighthouse accessibility | 90 or higher | Lighthouse on 4 views (slice 6) |

Gmail web is the only acceptance client for v1 (D22). Android and iOS are best effort and untested (BRIEF A7).

### 12.1 Measured 2026-11-10 (facts, no architecture change)

Dev build 9bbd262, Gmail web on Chrome, smoke run through the Claude Chrome extension. Times from the Apps Script execution log unless marked "observed". Source: docs/handoffs/2026-11-10-orchestrator-to-implementer-slice-04b.md.

| Point | Add-on function | Add-on duration | doPost duration | Handler `durationMs` | Target | Met |
|---|---|---|---|---|---|---|
| First sidebar open | onComposeOpen | 4.064 s (about 6 s on screen, observed) | 1.381 s | 250 (`sidebar.home`) | under 3 s | no |
| Open folder | onOpenFolder | 3.005 s | 1.437 s | 346 (`sidebar.home`) | under 3 s | no |
| Insert, no prompt, first use | onInsert | 4.07 s | 2.419 s | 1314 (`template.apply`) | under 2 s p95 | no |
| Prompt card Insert | onPromptInsert | 2.083 s | 0.671 s | 78 | under 2 s p95 | no |
| Prompt card Insert | onPromptInsert | 2.317 s | 0.902 s | 89 | under 2 s p95 | no |
| Spike S4 F9 | onSpikeInsert | 1.692 s callback | n/a | 55 | under 2 s p95 | callback only, no stopwatch |
| Web app save | n/a | n/a | n/a | n/a | under 3 s | no, about 10 s (observed) |
| Web app library first load | n/a | n/a | n/a | n/a | not set; list under 1 s after first load | 4 to 10 s (observed) |

- doPost spends 0.6 to 1.1 s outside the handler: platform start and parsing of the 266 KB bundle.
- The add-on spends 1.4 to 2.7 s outside the server call: token, two UrlFetch hops (POST to `/exec`, GET of the 302 target), Card Service rendering.
- Spike S4 callbacks on Gmail web: 1,285 to 2,910 ms per fixture (server 55 to 1,015 ms).
- Slice 4b cut per-request Properties reads from 7 to 12 down to 1 or 2, removed the read-path lock and the Drive body read on a warm body cache. Call counts before and after: docs/handoffs/2026-11-10-implementer-to-reviewer-slice-04b.md.

After slice 4b (source: PLAN D23 and log 2026-11-10):

| Point | Build | Value | Target | Met |
|---|---|---|---|---|
| Add-on execution with no server call | dev-637ce77 | 1.1 to 2.7 s | n/a | n/a |
| Apply with one server call | dev-637ce77 | 2.2 to 5.2 s; handler code 0.2 to 0.6 s of it | under 2 s p95 | no. D23: 3 s accepted for v1 (assumption) |
| Web app save, warm | dev-32a446c | Duration 4.2 to 5.2 s; Drive writes 2.0 to 2.7 s of it | under 3 s | no |

- D23 is open with the owner. Assumption in force: 3 s accepted for apply in v1, measured again on `/exec` at prod setup. Option recorded in D23: insert from the add-on cache with a 10 min permission lag. The 6 larger proposals from the 4b handoff stay unbuilt until the owner decides (Q22).

## 13. Slice map

| Spec section | Slice |
|---|---|
| 1 Scope | all |
| 2 Information architecture | 3 (web shell), 4 (sidebar) |
| 3 Topology and identity | 1 (one project, one manifest, one deployment per environment, boundary test), 2 (dispatch, caller identity, spike S2) |
| 4 Screens 1, 2 and flow 4.1 | 4 |
| 4 Screens 3, 4 and flow 4.2 save | 3 |
| 4 Screen 5 and flow 4.2 restore | 3 (built); subject line in 5 |
| Flow 4.4 search, favorites, Recent, subject (5.6) | 5; library fixes 5b; subject rule D24 5c |
| Trash view, `template.restoreFromTrash`, `trash.purge` | 6a |
| 4 Screen 6: admin shell, Folders and grants, Memberships, flow 4.3 | 6a |
| 4 Screen 6: Audit log, Usage, Export and import, Config; flow 4.5 | 6b |
| 4 Screen 7 states | 3 (web), 4 (sidebar), 6a and 6b (admin) |
| 5 Data model, JSON files, reserved fields | 2 |
| 6 Server operations and policy table | 2 (dispatch and policy), 3 to 6 (handlers) |
| 7 Error, empty, loading states | 3, 4, 6 |
| 8 Accessibility | 3, 5, 6a, 6b |
| 9 OAuth scopes and scope check | 1 |
| 16 Operations: `setup()`, triggers, job health | 1 (`setup()` and empty trigger handlers), 2 (`tick`, `refreshMembers`, `daily` work), 6a (trigger reinstall order, Q23), 6b (job health in Config tab, backup restore) |
| 10 Quota budget, measurements | 2 (spike S2, cache), 4 (apply) |
| 11 Logging | 1 (logger), 2 (audit) |
| 12 Measurable targets | 2, 3, 4, 5, 6a, 6b as listed |
| ADR-0004 placeholder parser and sanitizer | 3; insert spike in 4; spike S4 closed 2026-11-10 on Gmail web (D22), allowlist unchanged, cap 100 KB; harness removal in 5 |
| ADR-0005 repo, CI, deploy, rollback | 1; rollback exercise before slice 7 ends |
| Docs: README, admin install, quick start, runbook | 7 |

### 13.1 Slice 5 contents (one implementer run, amended 2026-11-10)

1. First task, 15 min on the dev deployment: one `UpdateDraftActionResponse` with body and subject actions on Gmail web (Q20, Q21). The result decides the apply path before the rest is built.
2. Subject (D21, section 5.6): item field, save validation codes, shared prompts, rendering, `template.apply` and `template.getBody` return it, body file field, restore copies it, editor field, preview and prompt cards, duplicate and export carry it.
3. Sidebar search: op `search`, top 20, `folder:` and `tag:`, weights of section 4.4.
4. Favorites: `favorite.set`, `favorite.unset`, `favorites.json`, sidebar section (max 10), library star and filter.
5. Recent: sidebar section (max 5) from `usage.json` `recent`.
6. Web app search: browser filter on the loaded index, `search.body` for body text.
7. Removal of the S4 harness: `spike.s4` and its policy row, `onSpikeCard`, `onSpikeInsert`, `src/shared/spike/`, the home card section, smoke steps.
8. Spec 12 measurement: web app list and search under 1 s after first load.

Trash view and `template.restoreFromTrash` go to slice 6 (6a since 2026-11-10, section 13.3). Reasons: slice 5 already holds 8 items across sidebar, web app and server; the Trash view shares the admin slice's folder-delete and `trash.purge` work (restore into a deleted folder needs a target picker, and purge is admin only); soft delete since slice 4b keeps data, and the `daily` purge deletes only after 30 days. Risk until slice 6: a template deleted on dev more than 30 days before slice 6 ships is purged with no restore UI. Mitigation: none needed on dev data; `backups/` keeps 14 days.

### 13.2 Slices 5b and 5c (added 2026-11-10)

- 5b, library fixes from the fourth smoke run (dev-32a446c): `draft` diagnostics in log lines, owner label "My templates (owner address)" on other users' private folders, local time in the web app, busy status on row actions, History focus, Delete dialog focus on Cancel, "Searching text...", `/` on a non-element target. Its reply rule (`threadId` or `messageId` present) failed in Gmail: the event carries neither field (smoke "Slice 5b", dev-4a233d4).
- 5c, subject rule D24 (section 5.6): `draftHasSubject` replaces the reply rule, `hasSubject` in the logged `draft`, `folder.rename` strips the owner label. Smoke "Slice 5c" on dev-848206f: 4 of 4 pass.

### 13.3 Slice 6 split (2026-11-10)

| Slice | Contents |
|---|---|
| 6a | Admin shell (`?view=admin`, rail entry for admins and manage holders); tab Folders and grants (flow 4.3); tab Memberships; Trash view with `template.restoreFromTrash` and `trash.purge`; trigger reinstall order: create the new set, then delete the old (Q23); open review minors |
| 6b | Tab Audit log; tab Usage; tab Export and import, with `subject` in export and the import rules of section 5.6; tab Config with job health and backups (`backup.list`, `backup.restore`) |

### 13.4 Known limits (Gmail web, recorded 2026-11-10)

- The first `/` after a library load may need a second press. The browser gives the app frame no focus before a click or a key press inside it.
- History loads the preview of a version on Enter. Arrow keys move the selection only.
- The compose card is modal on Gmail web. The user places the cursor in the draft body before opening the add-on; Insert (`IN_PLACE_INSERT`) then lands at the cursor.
- "Edit in library" (OVERLAY window close and sidebar reload) is unverified on Gmail web. It is an owner hand check (PLAN Next action).

## 14. Spikes

| ID | Slice | Question | Pass condition |
|---|---|---|---|
| S2 | 2, first task | (a) `drive.file` token passes `/exec` with `DOMAIN`; (b) `getActiveUser` set on token calls; (c) project sharing needed; (d) token call to `/dev` works for editors; (e) Advanced Drive service works on `drive.file` alone | (a), (b), (e) yes; (c), (d) answered |
| S2b | 2 | UrlFetch round trip to `/exec`, add-on start time, Drive read and write of 0.85 MB and 8.4 MB files, `domain_public` fields | p95 recorded in ADR-0002; 0.85 MB read and write each under 2 s (Q17) |
| S4 | 4, first task | Draft insert on Gmail web (ADR-0004 table) | Resolved 2026-11-10: F1 to F9 inserted on Gmail web, 204,837 bytes (F7) included. Allowlist unchanged, cap 100 KB. Android and iOS runs dropped by the owner (D22). Harness removed in slice 5 |
| S5 | 5, first task | Body and subject actions in one `UpdateDraftActionResponse` on Gmail web; subject replaced, not appended; reply drafts (Q20, Q21) | Resolved 2026-11-10 on dev-32a446c: body and subject in one response, no new scope (Q20 closed). A replaced reply subject started a new thread; the event carries no `threadId` or `messageId` (dev-4a233d4). Rule D24 (section 5.6) keeps any filled subject; smoke "Slice 5c" on dev-848206f: the reply stayed in its conversation (Q21 closed) |

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
| Q19 | Dev web app on `/dev` or versioned `/exec` | `/dev` if spike S2 (d) passes: 0 versions per dev deploy. Spike S2 (d) passed 2026-11-10 for a non-owner editor |
| Q20 | Does `UpdateDraftSubjectAction` need a scope beyond `gmail.addons.current.action.compose`, and does Gmail web accept it with `UpdateDraftBodyAction` in one response? | Closed 2026-11-10: spike S5 on dev-32a446c. Body and subject actions work in one response. No new scope; 10 scopes unchanged |
| Q21 | Reply drafts: replacing a reply's subject may split the conversation | Closed 2026-11-10 by D24. A replaced reply subject did start a new thread (dev-32a446c). The event has no `threadId` or `messageId`, but it has `subject`. The template subject is set only on an empty draft subject; the reply stayed in its conversation (smoke "Slice 5c", dev-848206f). The quick start (slice 7) states "Insert with subject" as the override |
| Q22 (D23) | Apply and sidebar targets missed (section 12.1). Apply with one server call measured 2.2 to 5.2 s on dev-637ce77; warm save 4.2 to 5.2 s on dev-32a446c | Open, owner. Assumption in force: 3 s accepted for apply in v1, measured again on `/exec` at prod setup. If the owner wants 2 s: the D23 option, insert from the add-on cache with a 10 min permission lag (ADR-0003 change) |
| Q23 | `installTriggers` deletes the old triggers before it creates the new set; a failed create leaves fewer than 3 until a web app page load (4b review minor 7) | Create the new set first, then delete the old one; record a `job:triggers:lastError` health key the Config tab flags. Slice 6a |
| Q24 | `template.apply` accepts `recipientEmailIfInternal` on `followUp` calls, an event-free first-name lookup (slice 4 review) | Closed in slice 5: `followUp: true` returns `recipientFirstName: ""` with no Directory read |
| Q25 | With "Replace the subject" off, the prompt card still asks prompts that only the subject uses (slice 5 review minor 2, 5c minor 3) | Accept in v1: the value goes nowhere, the draft stays correct. Hiding those fields probably needs a card re-render on each switch change, one more callback per toggle |

## 16. Operations and maintenance

Target (BRIEF 1 Operations): the only recurring human task is deploying a new version. Details in ADR-0003 Part B (triggers) and ADR-0005 (Maintenance).

Triggers. All time-driven, owned by and running as the owner. `setup()` installs them idempotently; the owner runs it once per environment after the first deploy. The trigger version check (amended 2026-11-10, slice 4b) runs in `doGet` and at the end of every `tick`; `rpc` and `doPost` skip it. It reads `TRIGGERS_VERSION` live inside the script lock and reinstalls when it differs, so after a deploy the triggers update on the first web app page load or within 5 min through `tick`, whichever comes first. Limit: a release that renames or removes the `tick` handler needs one web app page load.

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
- [A13] https://developers.google.com/workspace/add-ons/concepts/event-objects, read 2026-11-10 and re-read 2026-11-10 (errata run 2). The page documents 6 Gmail fields: `accessToken`, `bccRecipients`, `ccRecipients`, `messageId`, `threadId`, `toRecipients`; it names no `subject` field and no `draftMetadata` object. `commonEventObject.platform` WEB, IOS, ANDROID. Correction 2026-11-10: the page is incomplete for compose events. Owner smoke runs on Gmail web logged the field names `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients`, `subject` and never `threadId` or `messageId` (smoke "Slice 5b", dev-4a233d4). Smoke "Slice 5c" (dev-848206f) showed `subject` holds the draft subject: `hasSubject` was true with a filled subject, and typed and reply subjects were kept. The earlier note "no subject field" was wrong for the live event.
- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui (compose actions return `UpdateDraftActionResponse`; subject example `setUpdateDraftSubjectAction(CardService.newUpdateDraftSubjectAction().addUpdateSubject(subject))`; one action per example; scopes "required for compose actions" not listed; no mobile note), read 2026-11-10.
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder (setters for body, subject, To, Cc, Bcc on one builder, each returns the builder for chaining; no statement on combining; no scope listed) and https://developers.google.com/apps-script/reference/card-service/update-draft-subject-action (`addUpdateSubject(subject)`: "Updates the subject line of an email draft"), read 2026-11-10.
- [A16] https://developers.google.com/workspace/gmail/api/auth/scopes (`gmail.addons.current.action.compose` "Manage drafts and send emails when you interact with the Google Workspace add-on", non-sensitive), read 2026-11-10.
