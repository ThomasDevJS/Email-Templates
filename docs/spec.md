# Migway Gmail Templates: specification v1

Status: Accepted at G2 2026-11-09. Errata and D21 (template subject) amendment 2026-11-10: Proposed until the owner approves. Errata run 2 (2026-11-10): D24 subject rule, slices 5b, 5c, 6a, 6b, built ops, log `draft` object; Proposed until the owner approves. Errata run 3 (2026-11-10): slices 6a and 6b as built (sections 4.5, 5.1, 5.2, 5.5, 6, 11.1, 13, 16), owner handover (section 16, ADR-0002 Amendment 2026-11-10); Proposed until the owner approves.
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

Amended 2026-11-10 (errata run 3) to match slice 6b. File format and mechanism: ADR-0002 Amendment 2026-11-10 (errata run 3).

- File: JSON, `schemaVersion` 1: header (`exportedAt`, `exportedBy`, `scope`), `folders` (`id, parentId, name`), `grants` (`folderId, principalType, principalKey, level`), `items` (`meta: { id, folderId, title, subject, tags }`, `html`). Live templates, current version only. No history, favorites, usage, audit or `createdBy`.
- Export folder (manage): the folder and its live subtree, grants on those folders only. Export library (admin): every shared folder; private folders and their templates are left out (D11), label "Whole library (shared folders)".
- Paging: each call returns at most 20 templates, so it reads at most 20 bodies from Drive. Pages use an offset. The browser joins them into `migway-templates-<scope>-<date>.json` (`library` or the folder name, local date).
- Import (admin): choose a file and a target folder, then Validate, then Import. Validate writes nothing. Limits checked on the server before any write: 5 MB, 200 templates, 100 folders, `schemaVersion` exactly 1, no duplicate folder `id`.
- Target: a shared folder. A folder in a private tree answers VALIDATION "Templates cannot be imported into a private folder. Pick a shared folder."
- Import creates shared folders only and reuses a folder whose name a live sibling has. It creates no grants: the file's grants are information for the admin. Templates get new IDs. A template whose title already exists in its destination folder is skipped, so a second import adds nothing.
- Bodies pass the sanitizer and placeholder checks; subjects follow section 5.6. A failure answers "Nothing was imported: <what>. Run the import again."
- Report: templates created, skipped, failed; folders created and reused; subjects flattened; one line per skipped or failed record.
- Import is not an owner-change path: section 16, Owner handover.

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

Depth (slice 6a): at most 5 levels, top level included (`FOLDER_DEPTH_MAX`). A create or move that makes a sixth level answers VALIDATION. A move checks the target chain plus the height of the moved subtree. A move to the top level is not depth-checked; it cannot deepen. A move into itself or a subfolder answers VALIDATION.

### 5.2 `grants`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| folderId | string | |
| principalType | `group`, `user`, `domain`, `ou` | `ou` stored, inactive under `groupsapp_direct` |
| principalKey | string, 1 to 254 chars | group email, user email, domain, OU path. Trimmed and lowercased, then at most 254 characters (`PRINCIPAL_KEY_MAX`, the email address limit), checked for all 4 types before the format check; longer answers VALIDATION. Input `maxlength` 254 |
| principalId | string or empty | Directory ID when the resolver provides it (rename safety, [R2 S43]) |
| level | `use`, `edit`, `manage` | |
| createdAt, createdBy | | |

A grant to a principal that already holds one on the folder updates its level (before and after in the audit event). Grants carry no version: two admins writing the same principal at once, the last write wins (spec 13.4). Grants on private folders answer VALIDATION for admins and DENIED for others.

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
| `usage.json` | `{ rev, items: { itemId: { applyCount, lastUsedAt, days } }, recent: { email: [itemId, max 20] } }`. `days` (slice 6b): `{ "YYYY-MM-DD": count }` per UTC day, kept to the 30 days that end on the latest apply; absent in older entries, read as 0 |
| `members.json` | `{ refreshedAt, resolver, groups: { groupEmail: { members[], childGroups[], status } } }` |
| `bodies/<itemId>.v<version>.json` | `{ itemId, version, subject, html, plainText, savedAt, savedBy, note, restoredFrom, sha256 }`, immutable. `subject` added 2026-11-10 (D21); a file without it reads as `""`. Drive `appProperties`: `itemId, version, savedBy, restoredFrom`. Version history = one `files.list` by `itemId` |
| `audit/YYYY-MM.jsonl` | one ADR-0003 Part D event per line, append-only |
| `backups/YYYY-MM-DD/` | copies of `index.json`, `favorites.json`, `usage.json`, 14 kept. Restore: section 16 |

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
| template.create, template.update, template.duplicate, template.delete | edit | web |
| template.restoreFromTrash | edit on the original folder and on the target (`folderId`, optional); a purged original folder needs admin | web |
| template.move | edit on source and target | web |
| version.list, version.get, version.restore | edit | web |
| folder.create (sub), folder.rename, folder.move, folder.delete | manage | web |
| folder.create (top level) | admin | web |
| trash.purge | admin; empties the whole trash (templates and soft-deleted folders), at most 50 body-file deletions per call, the rest by the daily orphan cleanup | web |
| admin.folders | manage on at least one folder: admins get every live folder, manage holders the folders they manage; anyone else DENIED (one denied audit row) | web |
| grant.list, grant.add, grant.remove | manage | web |
| export.folder | manage | web |
| export.library, import, audit.query, usage.report, membership.status, membership.refresh, config.get, backup.list, backup.restore | admin | web |
| me | none beyond a valid caller | both |

`spike.s4` and its policy row were removed in slice 5.

Status 2026-11-10 (build f6b567f, slices 6a and 6b merged): every op in this table has a handler. `LATER_SLICE_OPS` and the "not implemented" answer are removed. `template.getBody` (slice 3) returns the readable body without an apply event; the add-on uses it on a body cache miss. `template.apply` takes `followUp: true` on the prompt card Insert (section 4.1 step 5). `template.duplicate` (slice 4b): title "Copy of ...", cut to 120, tags, subject and the current body become version 1; edit on source and target. `search`, `search.body`, `favorite.set`, `favorite.unset` (slice 5). `admin.folders`, `membership.status`, `trash.purge`, the Trash view of `template.restoreFromTrash` (slice 6a). `export.*`, `import`, `audit.query`, `usage.report`, `config.get`, `backup.list`, `backup.restore` (slice 6b). Admin rows re-read the membership snapshot inside the lock before a write (dispatch `recheck`).

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

### 11.1 Audit and log rules of the admin ops (slices 6a, 6b, added 2026-11-10)

Mechanism: ADR-0003 Amendment 2026-11-10 (errata run 3).

- Denied rows: every DENIED writes one denied audit event: a policy denial, a handler refusal after the policy check (`admin.folders`), or an in-lock re-check (`trash.purge`, admin rows). One call writes at most one row. VALIDATION and NOT_FOUND write none.
- Event buffer: at most 200 apply and denied events between two `tick` runs. Further events are dropped and counted; `tick` writes one `audit.dropped` event (actor `system`, result `error`, `after: { dropped }`). Change events go through `pendingAudit` in the index write and are never dropped.
- Usage: `usage.json` entries carry `days`, apply counts per UTC day, kept 30 days (section 5.5). `usage.report` shows applies in the 30 UTC days ending today.
- Log lines keep the closed field list above. `grant.add`: `targetId` = folder ID; `grant.remove`: `""`. No line carries a principal key. `import`: `targetId` = target folder; `export.folder`: folder ID; `export.library`: `""`; `backup.restore`: `""`, the date is not logged. No line carries a title, subject or body of an import file.
- Audit events: `grant.*` with before and after; one `import` event per created folder and template; `backup.restore` with before `{ rev, items }` and after `{ date, rev, items }`; `trash.purge` one event per purged template and folder; `audit.dropped`. Export writes no audit event in v1 (section 13.5).

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

Done 2026-11-10. 6a: review PASS on bb53d6c (docs/reviews/slice-06a.md), merged, dev-292d7ad; owner smoke "Slice 6a" prompt 1 passed, the rest open. 6b: review PASS on f6b567f (docs/reviews/slice-06b.md), merged at 3bffb70, not deployed yet; owner smoke "Slice 6b" follows the 6a run.

### 13.4 Known limits (Gmail web, recorded 2026-11-10)

- The first `/` after a library load may need a second press. The browser gives the app frame no focus before a click or a key press inside it.
- History loads the preview of a version on Enter. Arrow keys move the selection only.
- The compose card is modal on Gmail web. The user places the cursor in the draft body before opening the add-on; Insert (`IN_PLACE_INSERT`) then lands at the cursor.
- "Edit in library" (OVERLAY window close and sidebar reload) is unverified on Gmail web. It is an owner hand check (PLAN Next action).

Added 2026-11-10 (slices 6a, 6b; accepted for v1, each with a v1.1 fix in section 13.5):

- Grant writes in the admin view do not reload the library tree (6b minor R3). A manage holder who removes a grant they depend on sees the old tree until a page reload. Folder writes do reload it.
- 200 refused calls inside 5 min fill the event buffer, and apply events of that window are dropped with the denials (6b minor 4). Usage counts lose them; one `audit.dropped` row records the total.
- An audit month file larger than the Script Cache is read and parsed on every `audit.query` call (6b minor 8). About 2.4 MB per month at 1x, 24 MB at 10x.
- Export pages by offset (6b minor 9). A save between two pages can repeat or skip one template in the file. Export when nobody saves, or compare the count in the status line with the folder.
- A failure inside the restore undo leaves backup side files with the live index and replaces the first error (6b minor R2).
- Grants carry no version: concurrent writes of one principal, last write wins (6a handoff).
- The Usage tab shows "My templates" for every private folder, without the owner label (6b handoff).
- Refusal text says "1 templates" for a count of 1 (6b minor R4).
- A 5 MB import is unverified on Apps Script: `google.script.run` may refuse the argument; the UI then shows a retryable network error and nothing is written (6b minor 7).

### 13.5 Open items for slice 7 and v1.1 (2026-11-10)

| Item | Where | Slice |
|---|---|---|
| Runbook: recovery from a damaged live `index.json` (section 16) | docs/ops | 7 |
| Runbook: owner handover, interim path and B2 path (section 16) | docs/ops | 7 |
| Runbook: restore from backup, import of more than 200 templates (one file per folder) | docs/ops | 7 |
| Smoke step with a 4.9 MB import file | docs/ops/smoke.md | 7 |
| Rollback exercise (ADR-0005) | owner | 7 |
| Owner-run `restoreBackup(date)` editor function (Q31) | src/server | v1.1, before 2.5b if possible |
| B2 server-to-server pull, `READ_ONLY` write refusal (ADR-0002 Amendment, owner handover; Q27) | src/server, Config tab | v1.1, before the first owner change |
| Grant writes call `foldersChanged` | src/web | v1.1 |
| Separate buffer caps for apply and denied events | src/server/audit | v1.1 |
| Audit month read by byte range or a per-month row index | src/server/audit | v1.1, before a month passes 5 MB |
| Export pages by item ID cursor instead of offset | src/server/handlers/transfer.ts | v1.1 |
| One `export` audit event per export (first page) | src/server/handlers/transfer.ts | v1.1 (ADR-0002 lists export as a security event) |
| Restore undo keeps the first error | src/server/handlers/config.ts | v1.1 |
| Plural in the purge refusal; owner label in the Usage tab | src/server, src/web | v1.1 |

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
| Q26 | Prod owner identity (refines Q3, D16) | A dedicated account if Migway has one before 2.5b: a later handover then moves a credential, not data (ADR-0002 Amendment 2026-11-10, owner handover, option D) |
| Q27 | When to build the B2 server-to-server pull for an owner change | v1.1, before the first planned owner change. Until then the interim runbook of section 16 |
| Q28 | Run tests V1 to V4 (section 16) on dev with the pilot's second account | Yes, in the 2.5b dry run, about 30 min. If V1 and V3 pass, the same-project transfer (option C) replaces B2 and needs no code |
| Q29 | Owner change: move all body versions or current versions only | All versions while under 20,000 files (D20 keeps all versions); above that, current versions only and the old data folder kept read-only |
| Q30 | Dev to prod pilot data (2.5b step 5): import loses private templates and grants | The interim runbook (admin-only "Handover" folder) unless B2 exists by 2.5b |
| Q31 | A damaged live `index.json` blocks every op, `backup.restore` included | Owner-run editor function `restoreBackup(date)` with the `setup()` guard, before 2.5b if possible; until then the manual runbook of section 16 |

## 16. Operations and maintenance

Target (BRIEF 1 Operations): the only recurring human task is deploying a new version. Details in ADR-0003 Part B (triggers) and ADR-0005 (Maintenance).

Triggers. All time-driven, owned by and running as the owner. `setup()` installs them idempotently; the owner runs it once per environment after the first deploy. The trigger version check (amended 2026-11-10, slice 4b) runs in `doGet` and at the end of every `tick`; `rpc` and `doPost` skip it. It reads `TRIGGERS_VERSION` live inside the script lock and reinstalls when it differs, so after a deploy the triggers update on the first web app page load or within 5 min through `tick`, whichever comes first. Limit: a release that renames or removes the `tick` handler needs one web app page load.

Reinstall order (Q23, built in slice 6a, hardened in 6b): create the 3 new triggers, then delete every old one. A failed create deletes the new ones it made, keeps the old set, writes `job:triggers:lastError` and leaves `TRIGGERS_VERSION` stale, so the next check retries. A failed delete still deletes the others, then throws; the next run leaves 3. The Config tab shows the error while `TRIGGERS_VERSION` is stale.

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
| Owner identity change: section 16.3 | owner and admin | on staff change |

Template, folder and grant changes and backup restores happen in the web app, done by managers and admins. Role group membership changes happen in Google Groups. Nobody edits code or data files by hand, except the recovery below.

### 16.1 Restore from backup (slice 6b)

- Admin, Config tab, "Restore from backup". The confirmation names the date; Cancel has focus.
- The server reads the 3 copies (`index.json`, `favorites.json`, `usage.json`) and runs the shared shape check before the lock. A missing, unparsable or damaged copy answers VALIDATION "This backup cannot be read: <file> ..."; live files stay untouched.
- Under the lock: admin re-check; refusal when the backup holds templates emptied from the trash since that date ("<n> templates of the <date> backup were emptied from the trash after that date and would not open. Pick a newer backup."). The automatic purge needs 30 days in the trash and backups go back 14, so only a manual "Empty trash now" can cause it.
- Writes `favorites.json`, then `usage.json`, then `index.json` last as the commit point (`rev = current + 1`, current `pendingAudit` kept). A failure before or during the index write puts the side files back. One `backup.restore` audit event.
- The same shape check runs on every Drive read of the live files. A damaged live file answers INTERNAL "<file> is damaged: <problem>" on every op that loads it.

### 16.2 Recovery from a damaged live file (runbook input, slice 7)

A damaged live `index.json` answers INTERNAL on every op, `backup.restore` included: dispatch loads the index first. `backup.list` still answers. Q31 recommends an owner-run `restoreBackup(date)`; until it exists the owner runs these steps:

1. Drive, as the owner: open `Migway Templates Data/backups/`, pick the newest date, download its `index.json`.
2. Open the live `Migway Templates Data/index.json`, File information, Manage versions, Upload new version, pick the downloaded file [A24 in ADR-0002]. Do not upload it as a new file and do not make a copy: a file the app did not create is invisible to it (`drive.file`).
3. Apps Script editor, as the owner: run `setup()`. It is idempotent; it reads `index.json`, republishes `INDEX_REV` and the cache, and reinstalls triggers.
4. Web app: open the library and the Config tab; check `INDEX_REV` and the template count.
5. For a damaged `favorites.json` or `usage.json`: the same steps with that file.

Unverified: that Upload new version keeps the file ID and `appProperties` (Google's page does not say). Changes after the backup date are lost, as with a restore. The restored `rev` is lower than the damaged one, so revision numbers repeat once; the writer reads the file whenever its cached `rev` differs from the file's `appProperties` `rev`, so no stale index is written.

### 16.3 Owner handover (D16, runbook input for slice 7)

Decision and options: ADR-0002 Amendment 2026-11-10 (owner handover). Export and import are not the handover path: they lose private folders, grants, favorites, usage, audit and version history, and stop at 200 templates per file.

Order of preference:
1. Dedicated owner account (Q26). A staff change moves the password and 2-step verification. No data moves.
2. B2 server-to-server pull, once built (Q27). Steps: new owner account in `ADMIN_EMAILS` of the old deployment; old project shared with the new owner as editor; new owner deploys a new project and runs `setup()`; old owner sets Script Property `READ_ONLY`; new owner runs the pull from the Config tab until done; template, folder, grant and version counts compared in both Config tabs; the admin moves the domain install to the new deployment; old owner deletes the old triggers and deployment; the old data folder is kept 30 days, then trashed.
3. Interim, until B2 ships or V1 passes. The old owner account stays active; do not suspend or delete it. An admin creates a shared folder "Handover" with no grants and moves each user's private templates into one subfolder per user. Export each top folder of at most 200 templates and import it into the new deployment. Re-add grants by hand from the `grants` list of each file. Each user opens the new library once; the admin moves their templates into their new private folder. Lost: favorites, usage, audit and version history, item IDs.

Tests that need a second owner account (Q28; the pilot account on dev can play it):
- V1. After a transfer of the data files, does the new owner's `drive.file` token in the same project read them?
- V2. Does a token minted by another project's server pass the old `/exec` with `getActiveUser` set?
- V3. After the script project changes owner, does the web app deployment run as the new owner, and what must the new owner authorize?
- V4. Do the web app and triggers of a suspended owner account keep running?

Triggers belong to the account that created them (`getProjectTriggers()` returns only the current user's). `setup()` refuses any account other than the recorded `OWNER_EMAIL`, so option C would need `OWNER_EMAIL` changed in Project Settings first.

## Sources

- docs/research/r1 to r4, feature-matrix.md, ux-notes.md, summary.md, read 2026-11-09. Tags [R2 S43], [R4 Sn] as in those files.
- [A1] https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script, third party, read 2026-11-09. Other [An] tags are listed in the ADR that uses them.
- [A13] https://developers.google.com/workspace/add-ons/concepts/event-objects, read 2026-11-10 and re-read 2026-11-10 (errata run 2). The page documents 6 Gmail fields: `accessToken`, `bccRecipients`, `ccRecipients`, `messageId`, `threadId`, `toRecipients`; it names no `subject` field and no `draftMetadata` object. `commonEventObject.platform` WEB, IOS, ANDROID. Correction 2026-11-10: the page is incomplete for compose events. Owner smoke runs on Gmail web logged the field names `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients`, `subject` and never `threadId` or `messageId` (smoke "Slice 5b", dev-4a233d4). Smoke "Slice 5c" (dev-848206f) showed `subject` holds the draft subject: `hasSubject` was true with a filled subject, and typed and reply subjects were kept. The earlier note "no subject field" was wrong for the live event.
- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui (compose actions return `UpdateDraftActionResponse`; subject example `setUpdateDraftSubjectAction(CardService.newUpdateDraftSubjectAction().addUpdateSubject(subject))`; one action per example; scopes "required for compose actions" not listed; no mobile note), read 2026-11-10.
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder (setters for body, subject, To, Cc, Bcc on one builder, each returns the builder for chaining; no statement on combining; no scope listed) and https://developers.google.com/apps-script/reference/card-service/update-draft-subject-action (`addUpdateSubject(subject)`: "Updates the subject line of an email draft"), read 2026-11-10.
- [A16] https://developers.google.com/workspace/gmail/api/auth/scopes (`gmail.addons.current.action.compose` "Manage drafts and send emails when you interact with the Google Workspace add-on", non-sensitive), read 2026-11-10.
