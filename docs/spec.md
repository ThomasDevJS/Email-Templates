# Migway Gmail Templates: specification v1

Status: Accepted at G2 2026-11-09. Errata and D21 (template subject) amendment 2026-11-10: Proposed until the owner approves. Errata run 2 (2026-11-10): D24 subject rule, slices 5b, 5c, 6a, 6b, built ops, log `draft` object; Proposed until the owner approves. Errata run 3 (2026-11-10): slices 6a and 6b as built (sections 4.5, 5.1, 5.2, 5.5, 6, 11.1, 13, 16), owner handover (section 16, ADR-0002 Amendment 2026-11-10); Proposed until the owner approves. D26 run (2026-11-10): template recipients To, Cc, Bcc (sections 2, 4.1, 4.2, 4.5, 5.3, 5.5, 5.7, 6, 7.1, 9, 11, 13.6, 14.1, 15; ADR-0006); Proposed until the owner approves. D27 run (2026-11-10): side-panel insert (sections 2, 3, 4.1a, 7.2, 9, 11, 13.7, 14.2, 15; ADR-0007); Proposed until the owner approves. D29 run (2026-11-10): in-app admin settings, personal templates switch, outside recipients switch moved in-app (sections 2, 5.1, 5.5, 5.6 Script Properties, 5.7, 5.8, 6, 7, 7.1, 7.3, 11.1, 13.8, 15, 16; ADR-0008); Proposed until the owner approves. Errata run 4 (2026-11-11): slices 8a to 8d and 9 to 13 as built at 6374b7b (sections 4.1, 4.1a, 4.4, 4.5, 5.6, 5.7, 5.8, 6, 7, 7.1, 7.2, 7.3, 8, 11, 11.1, 13, 14, 15, 16); section 5.8 follows ADR-0008, Accepted 2026-11-11; the rest Proposed until the owner approves. D31 run (2026-11-11): one-click insert for every template and the details card (sections 4, 4.1, 4.1a, 5.6, 5.7, 7, 7.1, 7.2, 7.4, 13, 13.4, 13.9, 14.2, 15; ADR-0009, Amendments 2026-11-11 in ADR-0004 and ADR-0006, note in ADR-0007); Proposed until the owner approves. D32 run (2026-11-11): in-app admin list (sections 2, 5.8, 6, 7.3, 11.1, 13, 13.10, 15; ADR-0003 and ADR-0008 Amendments 2026-11-11); Proposed until the owner approves.
Date: 2026-11-09, amended 2026-11-10 and 2026-11-11
Author: architect. Owner: thomas@migway.com.
Inputs: docs/BRIEF.md, PLAN.md (D1 to D32), docs/research/*.md, ADR-0001 to ADR-0009.

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
        Apply -> draft body updated; template subject set when the draft subject is empty (D21, D24);
                 template To, Cc, Bcc added (D26, section 5.7)
    Open library / Edit -> web app in OVERLAY

Gmail side panel (same add-on code and cards; homepage trigger, and a contextual trigger when a message is open; D27, ADR-0007)
  Home, Folder view, Search, Preview, Prompt card: the same cards as the compose sidebar
    No message open: row button "New email" -> new draft in a compose window (body, subject, To, Cc, Bcc)
    Message open: row button "Reply"; preview adds "Reply all" and "New email" -> reply draft in a compose window
    Footer hint: insert at the cursor from the draft's toolbar

Web app (same project, /exec, runs as the owner)
  Library  (default view)
    Folder tree | template list | search | favorites filter | trash
  Editor   (?view=editor&id=...)
    Title, subject, To, Cc, Bcc, folder, tags, body, placeholder menu, preview as me, save
  History  (?view=history&id=...)
    Version list, preview, restore
  Admin    (?view=admin, admins and manage holders)
    Folders and grants | Memberships | Audit log | Usage | Export and import | Config (Settings: 2 admin switches and the Admins list (D32); environment read only)
```

Two entry points (D27, ADR-0007). The compose toolbar changes the draft being written (`UpdateDraftActionResponse`, insert at the cursor). The side panel cannot reach that draft: it creates a new draft or a reply with compose actions (`ComposeActionResponse`), which Gmail opens in a compose window. `entryOf(event)` decides the entry (`compose`, `message`, `inbox`) in one place.

Private folders (D18, amended 2026-11-10). The library shows admins every private folder. The sidebar does not: `sidebar.home` filters other users' private folders out for admins too, in the handler (`visibleFolders`). The filter grants nothing and hides nothing an admin can reach in the library.

Personal templates switch (D29, ADR-0008, added 2026-11-10). Admins turn personal templates on or off in Admin > Config > Settings; default off. While off, no private folder is created and existing private folders are read and insert only, for their owner and for admins (section 5.8).

Navigation in the web app is a left rail: Library, Admin (visible to admins and manage holders only). The URL query `view` restores state on reload.

## 3. Topology and identity (summary of ADR-0001, ADR-0003)

One Apps Script project per environment (D15). One manifest, one scope list (section 9), one versioned deployment carrying both entry points (ADR-0005).

| Piece | Runs as | Reads storage | Users consent to |
|---|---|---|---|
| Add-on code (Card Service: compose trigger, homepage trigger, contextual trigger `unconditional`; ADR-0007) | the user | never; calls the same project's `/exec` | the 10 scopes of section 9 at self-install; nothing after the admin domain install [R4 S60] |
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
| 2 | Sidebar preview and prompt cards; details card from slice 15 (D31) | docs/wireframes/02-sidebar-prompt.txt | 4 (subject in 5); 15 |
| 3 | Web app library | docs/wireframes/03-web-library.txt | 3 (search, favorites in 5) |
| 4 | Web app editor | docs/wireframes/04-web-editor.txt | 3 (subject field in 5) |
| 5 | Web app history | docs/wireframes/05-web-history.txt | 3 (subject line in 5) |
| 6 | Admin | docs/wireframes/06-web-admin.txt | 6a (shell, Folders and grants, Memberships), 6b (other tabs) |
| 7 | States | docs/wireframes/07-states.txt | 3, 4, 6 |

### 4.1 Flow: apply a template (DoD 1)

1. User opens compose, opens the add-on. Compose trigger reads the add-on User Cache `view:*`; on miss it calls server op `sidebar.home`.
2. Server returns Favorites (max 10), Recent (max 5, from `usage`), top-level folders the caller can `use`, and the caller's filtered list for caching.
3. User taps Insert on a template. The callback calls server op `template.apply` with `{ id, knownVersion, recipientEmailIfInternal }`. The server re-checks `use`, returns body and subject (if version changed), `to`, `cc`, `bcc` and `blocked` (every call, section 5.7), sender profile, internal recipient first name, and buffers the apply event.
[D31, slice 15, Proposed: steps 4 to 7 are replaced by section 7.4. Every row inserts in one click; fields without a value are removed (owner decision 2026-11-11); a row tap opens the details card. The text below is as built until slice 15.]
4. A template with any To, Cc or Bcc address never inserts in one click from a list: the row button reads "Review" and opens the preview card, or the prompt card when the template has prompts (section 5.7, D26). Its Insert is the confirmation.
5. No prompts, no unresolved values and no recipients: the add-on renders and returns one `UpdateDraftActionResponse` with `UpdateDraftBodyAction` (`IN_PLACE_INSERT`, `MUTABLE_HTML`) and, when the subject rule of section 5.6 (D24) says so, `UpdateDraftSubjectAction`. One click. Verified on Gmail web: spike S5 on dev-32a446c, smoke "Slice 5c" on dev-848206f. Recipient actions join the same response: one per field with new addresses, each carrying the draft's list plus the new addresses, because a recipient action replaces the field (spike S6, slice 9, section 5.7).
6. Otherwise the add-on pushes the prompt card. Its Insert calls `template.apply` again with `followUp: true`. The server re-checks `use` on that call and buffers no second apply event, so one Insert tap counts once. A grant removed while the card is open gives DENIED and leaves the draft unchanged. Then the callback validates every field, renders body and subject, inserts. Blank fields keep the card with an error. Recipient lists that changed since the card showed them keep the card with an error (section 5.7).
7. Usage counts the first Insert tap. A cancelled prompt card still counts in `applyCount` and Recent (accepted, Q14: usage is analytics).

### 4.1a Flow: apply from the side panel (D27, added 2026-11-10)

Mechanism and options in ADR-0007. Proposed until the owner approves. Every step after 4 depends on spike S7 (section 14.2). D31 (2026-11-11): after S7 the panel follows the one-click rules of section 7.4 through compose actions (ADR-0009 section 6); steps 3 and 7 then change: no "Review", no blank-field notification.

Built so far (slice 10, layout in slice 12): steps 1 and 2; the manifest entry `contextualTriggers` `unconditional` with `onMessageOpen`; in `inbox` and `message` the cards show no Insert, "Insert with subject" or "Insert body only" and end with the footer hint of section 7.2 (`sidePanelHint`, src/addon/cards/sidePanel.ts); the S7 harness, dev build only. Not built: steps 3 to 8, the panel row and preview buttons, the line under the header (the home card has no header since slice 12).

1. User opens Migway Templates from Gmail's right side panel. With no message open Gmail calls `onHomepage`; with a message open it calls `onMessageOpen` (contextual trigger `unconditional`, event with `gmail.messageId`). Both call `homeFlow` with the cached view `view:*`, as the compose trigger does.
2. `entryOf(event)`: `compose` when `draftMetadata` is present, `message` when a message ID is present (`gmail.messageId`, else the deprecated `messageMetadata.messageId`; only a non-blank string counts), else `inbox`. Lists, search, favorites, Recent, folders and preview are the compose cards; only the row button, the preview buttons, the header line and the footer hint read the entry.
3. Row button: `inbox` "New email", `message` "Reply". Same rules as 4.1 step 4: prompts open the prompt card; recipients show "Review" and open the preview card. Preview buttons: `inbox` "New email"; `message` "Reply", "Reply all", "New email".
4. The button carries `setComposeAction` (`STANDALONE_DRAFT` for New email, `REPLY_AS_DRAFT` for Reply and Reply all). Its callback calls `template.apply` (server re-checks `use`, buffers one apply event; `followUp: true` from the prompt card), renders body and subject, and decides recipients with `recipientActions` against the computed draft (ADR-0007 section 3).
5. Callback calls `GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken)`, then:
   - New email: `GmailApp.createDraft(to, subject, "", { htmlBody, cc, bcc })`. `to`, `cc`, `bcc` comma-joined from the template (minus `blocked`). Subject: the rendered template subject, or "" (D24: a new draft has an empty subject).
   - Reply: `GmailApp.getMessageById(messageId).createDraftReply("", { htmlBody, cc, bcc })`. Gmail sets To and "Re:" subject. Template To is listed "Not added" (D26). No `subject` option (D24).
   - Reply all: `createDraftReplyAll` with the same options. `cc` content follows S7 step 4.
6. Returns `CardService.newComposeActionResponseBuilder().setGmailDraft(draft).build()`. Gmail opens the draft in a compose window. The user edits and sends it.
7. Prompt card in the panel: same fields and switches (`subj` hidden for replies, `rcpt`); footer "Create email" or "Create reply" carries the compose action. A blank field returns the notification "Fill 1 field: <label>" and no draft, or the S7 fallback ("Check" then a confirm card).
8. Errors (DENIED, NOT_FOUND, BUSY, QUOTA, TIMEOUT) return a notification with the section 7 sidebar text and create no draft.
9. Usage and logs as 4.1 step 7 and section 11; the `draft` object gains `via`.

### 4.2 Flow: edit and restore (DoD 2)

1. Editor opens from the library or from the sidebar Edit button (OVERLAY, RELOAD_ADD_ON).
2. Save sends `{ id, baseVersion, title, subject, to, cc, bcc, folderId, tags, html }`. `to`, `cc`, `bcc` are string arrays. Server sanitizes, validates placeholders, the subject (section 5.6) and the recipients (section 5.7), writes the version (ADR-0002 write sequence). Conflict shows a dialog: "Changed by <name> at <time>. Open their version / Copy my text / Cancel." No silent overwrite.
3. History lists versions with their subject and recipients. Restore creates version N+1 from subject, recipients and body of version K, validates them (section 5.7) and writes an audit row.

### 4.3 Flow: grant access (DoD 3)

1. Admin opens Admin > Folders, selects a folder, adds a grant: principal (group email, user email, domain, OU marked inactive in v1), level (use, edit, manage).
2. Server validates the group exists via the resolver, writes `grants`, adds the group to the refresh set, refreshes its snapshot under lock, writes audit.
3. A user outside the group calls `folder.list` or `template.get`: server returns no rows or `DENIED`. Unit test and manual smoke step cover it.

### 4.4 Flow: search

- Sidebar: search input with `onChangeAction`. Server op `search` returns the top 20 visible matches. Operators `folder:<name>` and `tag:<name>`. Empty query shows Home, with no server call. The sidebar matches title, subject, tags, folder path and the 140-character `snippet` of the index item. It never reads full body text (amended 2026-11-10, slice 5 review minor 1).
- Web app: title, subject, folder path and tag filtering runs in the browser on the loaded index. Full body text is searched in the web app only: server op `search.body` runs 300 ms after the last keystroke, reads Script Cache entries `ft:<bodyFileId>` with one `getAll`, and makes at most 25 Drive reads per call for misses. The rest are reported as `skipped` ("N templates were not searched yet."). Results not already listed show under "Matches in text". While the call runs the list shows "Searching text...". Sort: relevance, then the caller's Recent position, then title.
- Recipients (D26, built in slice 13): the web app browser filter also matches template To, Cc and Bcc addresses, weight 1, on the local part prefix or the full address prefix; a domain alone matches nothing. The sidebar `search` op does not match addresses (section 5.7).
- Matching: case-insensitive, accent-insensitive token prefix match on title (weight 3), subject (2, D21), tags (2), folder (2), body text (1: the snippet in the sidebar, the full text in `search.body`). Every term must match. Query cut at 200 characters. Both ops filter to the caller's visible templates before ranking. Fuzzy tolerance: one typo for terms of 5 or more characters, at half weight.

### 4.5 Flow: export and import

Amended 2026-11-10 (errata run 3) to match slice 6b. File format and mechanism: ADR-0002 Amendment 2026-11-10 (errata run 3).

- File: JSON, `schemaVersion` 1: header (`exportedAt`, `exportedBy`, `scope`), `folders` (`id, parentId, name`), `grants` (`folderId, principalType, principalKey, level`), `items` (`meta: { id, folderId, title, subject, to, cc, bcc, tags }`, `html`; `to`, `cc`, `bcc` added 2026-11-10, D26, absent = `[]`). Live templates, current version only. No history, favorites, usage, audit or `createdBy`.
- Export folder (manage): the folder and its live subtree, grants on those folders only. Export library (admin): every shared folder; private folders and their templates are left out (D11), label "Whole library (shared folders)".
- Start (slice 13): the export begins with one call `start: true`. It commits one audit event `export.library` or `export.folder` through `commit` (lock, admin re-check, index write): actor, `targetId` (folder ID or ""), `targetPath` (folder only), `after: { scope, templates }`, no title, subject, body or address. Then it stores a run token as Script Cache `exp:<token>` with `{ actor, kind, folderId }` for 600 s (`EXPORT_RUN_TTL_S`) and answers `{ token, total }`. Lock busy answers BUSY, a Drive failure INTERNAL; both leave no token.
- Paging: each page call carries the token and returns at most 20 templates, so it reads at most 20 bodies (Script Cache hit used, a miss read from Drive and not cached). Pages use an offset. A token that is missing, malformed, expired, evicted, or of another caller or scope answers VALIDATION "This export is no longer valid (it expired or belongs to another session). Nothing was downloaded. Start the export again." before any body is read. Each accepted page extends the token by 600 s. The dispatch permission check runs first on every call. The web app retries a retryable error 3 times (after 200, 400, 600 ms), then stops with "The export stopped: the server did not answer after 4 tries. Nothing was downloaded. Wait a few minutes, then export again." The browser joins the pages into `migway-templates-<scope>-<date>.json` (`library` or the folder name, local date) and downloads only after the last page.
- Audit tab rows: "Library export started, 25 templates", "Folder export started: Sales / Quotes, 12 templates". The event records the start; an abandoned export keeps its event.
- Import (admin): choose a file and a target folder, then Validate, then Import. Validate writes nothing. Limits checked on the server before any write: 5 MB, 200 templates, 100 folders, `schemaVersion` exactly 1, no duplicate folder `id`.
- Target: a shared folder. A folder in a private tree answers VALIDATION "Templates cannot be imported into a private folder. Pick a shared folder."
- Import creates shared folders only and reuses a folder whose name a live sibling has. It creates no grants: the file's grants are information for the admin. Templates get new IDs. A template whose title already exists in its destination folder is skipped, so a second import adds nothing.
- Bodies pass the sanitizer and placeholder checks; subjects follow section 5.6; recipients follow section 5.7 (bad addresses dropped and reported, too many refuses the file). A failure answers "Nothing was imported: <what>. Run the import again."
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
| kind | `shared` or `private` | private = D11. Created only while the personal templates setting is `on` (D29, section 5.8) |
| ownerEmail | email or empty | private folders only |
| sortOrder | integer | |
| createdAt, createdBy, updatedAt, updatedBy | | |
| deletedAt, deletedBy | | soft delete, folder must be empty |
| version | integer | optimistic lock |

Private folders and the switch (D29, added 2026-11-10). `folder.list` creates the caller's private folder ("My templates") on first use only while `settings.personalTemplates` is `on`. While `off`, a folder in a private tree resolves to `use` for its owner and for admins, `none` for everyone else (`levelResolver`, ADR-0008 section 3). Nothing is deleted or moved when the switch changes.

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
| to, cc, bcc | string arrays, max 10 each, 20 together, each address max 254 chars | added to the draft on Insert (D26, section 5.7). Absent = `[]` |
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
| `index.json` | `{ schemaVersion, rev, updatedAt, folders[], grants[], items[], pendingAudit[], settings }`. 0.85 MB at 1,000 items, 8.4 MB at 10,000 (ADR-0002). `settings` (D29, optional): section 5.8 |
| `favorites.json` | `{ rev, byUser: { email: [itemId] } }` |
| `usage.json` | `{ rev, items: { itemId: { applyCount, lastUsedAt, days } }, recent: { email: [itemId, max 20] } }`. `days` (slice 6b): `{ "YYYY-MM-DD": count }` per UTC day, kept to the 30 days that end on the latest apply; absent in older entries, read as 0 |
| `members.json` | `{ refreshedAt, resolver, groups: { groupEmail: { members[], childGroups[], status } } }` |
| `bodies/<itemId>.v<version>.json` | `{ itemId, version, subject, to, cc, bcc, html, plainText, savedAt, savedBy, note, restoredFrom, sha256 }`, immutable. `subject` added 2026-11-10 (D21); a file without it reads as `""`. `to`, `cc`, `bcc` added 2026-11-10 (D26); a file without them reads as `[]`. Drive `appProperties`: `itemId, version, savedBy, restoredFrom`. Version history = one `files.list` by `itemId` |
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
  | Preview "Insert body only" (shown when the draft subject is empty; D26: also when Insert adds an address, and it adds none, section 5.7) | keeps it | keeps it |
  | Prompt card switch "Replace the subject" | starts on, user decides | starts off, user decides |

  [D31, slice 15, Proposed] After slice 15 the table reads:

  | Insert path | Draft subject empty | Draft subject filled |
  |---|---|---|
  | Row Insert (one click) | sets it | keeps it |
  | Details card switch "Replace the subject" | starts on, user decides | starts off, user decides |

  "Insert with subject" = details card with the switch on. "Insert body only" = details card with both switches off. Fields without a value are removed from the subject too; an empty result sends no subject action (section 7.4).

  An empty rendered subject sends no subject action, so the draft subject is never cleared. Verified in smoke "Slice 5c" on dev-848206f, 4 of 4 (wireframe 02).
- History: each version file stores its subject. Restore of version K copies subject and body of K into version N+1. History shows the subject line of each version.
- Search: subject weight 2 (section 4.4).
- Logs: the subject is template content. It is never logged, like the body.

Script Properties (config and state, no secrets, read and written only by web app and trigger code): `STORE` (JSON of folder and file IDs), `INDEX_REV`, `FAVORITES_REV`, `USAGE_REV` (published revisions of `favorites.json` and `usage.json`, ADR-0002 Amendment 2026-11-10), `DOMAIN`, `ADMIN_GROUP`, `ADMIN_EMAILS`, `MEMBERSHIP_RESOLVER`, `CALLER_IDENTITY`, `IMG_HOSTS`, `LOG_LEVEL`, `TRIGGERS_VERSION`, `job:<name>:lastOk`, `job:<name>:lastError`. The `/exec` URL is a build constant (ADR-0005), so the add-on reads no property. `RECIPIENTS_EXTERNAL` left this list on 2026-11-10 (D29): the switch is the admin setting `recipientsExternal` in `index.json` (section 5.8). Since slice 11 no code reads the property (Q50).

### 5.7 Template recipients (D26, added 2026-11-10)

Mechanism and options in ADR-0006. Proposed until the owner approves.

- Fields: `to`, `cc`, `bcc` on the item and in each version file, string arrays, default `[]`. Max 10 per field, 20 together, 254 characters per address (Q33). A record without them reads as `[]`; the shape check refuses a present non-array.
- Normalization at every write: trim, lower case, duplicates inside one field dropped silently. Order kept.
- Syntax: plain `local@domain`, `^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$` after lower casing, no `..`, no label starting or ending with `-`. No display names, no Unicode domains, no placeholders (Q34).
- Outside addresses: allowed by default (D26 update). Outside = domain part differs from Script Property `DOMAIN` (exact, case-insensitive; subdomains are outside; secondary domains Q36). Admin setting `recipientsExternal`: `allow` (default, also when absent) or `deny`, set by an admin in Config > Settings (D29, section 5.8). Built: slice 11 reads `settings.recipientsExternal` from the request's index; Script Property `RECIPIENTS_EXTERNAL` is no longer read.
- Save validation (server, every write: create, update, duplicate, restore, import; not move). Codes carry `field` (`to`, `cc`, `bcc`) and `position` (1-based). Texts in section 7.1: `RCPT_FORMAT`, `RCPT_TOO_LONG`, `RCPT_TOO_MANY`, `RCPT_DUPLICATE` (one address in two fields), `RCPT_EXTERNAL` (`deny` only). No existence check (Q38).
- In-lock re-check (slice 13): `recheckRecipients` runs inside the lock on create, duplicate, update, version restore and import against the fresh index. A switch to `deny` between the first check and the lock gives the save's own VALIDATION with `RCPT_EXTERNAL`. On import it refuses the whole file: "Nothing was imported: the library could not be written: 1 problem to fix. Run the import again." (Q53).
- `template.update` keeps the stored list of any of `to`, `cc`, `bcc` left out of the args; `cc: []` clears Cc. The editor always sends all three since slice 8b.
- `deny` and stored outside addresses: templates keep them. `template.apply` and `template.getBody` return the inside addresses in `to`, `cc`, `bcc` and the outside ones in `blocked`; the add-on adds only the returned lists and the cards list the blocked ones as not added. The editor marks them at load; the next save, a restore of such a version and a duplicate answer `RCPT_EXTERNAL`.
- Import: `RCPT_FORMAT`, `RCPT_TOO_LONG` and (`deny`) `RCPT_EXTERNAL` drop the address and import the template; an address in two fields keeps the first of To, Cc, Bcc; `RCPT_TOO_MANY` refuses the file ("Nothing was imported: ..."). The report gives per template the count of dropped addresses and the reason.
- Who sets them: `edit` on the folder, like body and subject. Private folders allowed (Q37). `use` holders see them on the cards and in the library and cannot change them.
- Apply. `template.apply` returns `to`, `cc`, `bcc`, `blocked` on every call (outside the `knownVersion` rule), filtered by the current switch. The add-on never caches them and never puts them in card parameters. One pure function `recipientActions(template, draft, add)` (src/addon/cards/recipients.ts, with `recipientPlan` for the cards) decides.

  Draft lists (slice 9 retry): `draftRecipients(event)` (src/addon/event.ts) gives per field a list or "unknown" (null). The first source holding the key decides (`draftMetadata`, then `gmail`). An array of strings, empty included, is known. A missing key, null, a string, an object or an array with a non-string entry is unknown. An unknown field never gets an action; an unknown To counts as filled.

  | Template address | Draft To empty (new message, forward) | Draft To filled (reply, typed To) | Draft field unknown |
  |---|---|---|---|
  | To | added | not added, "Not added" with the To reason | not added, "Add by hand" line |
  | Cc, Bcc | added | added | not added, "Add by hand" line |
  | already in a known draft field (trimmed, lower case, part inside `<...>`) | not added, "Not added" | same | same |
  | in `blocked` | never added | never added | never added |

  | Insert path | Recipients |
  |---|---|
  | List row of a template with recipients | no insert; "Review" opens the preview card (or the prompt card when prompts exist) |
  | Preview Insert, "Insert with subject" | added by the table above |
  | Preview "Insert body only" (shown when plain Insert would set the subject or add an address) | none; no subject either |
  | Prompt card switch "Add recipients" (id `rcpt`) | starts on; off adds none |

  [D31, slice 15, Proposed] After slice 15: row Insert adds by the table above in one click, after the `rc` count check; details card switch "Add recipients" starts on, off adds none; a template address in an unknown draft field opens the details card in place of the insert (section 7.4, ADR-0006 Amendment 2026-11-11).

  A field with nothing new sends no action, so it is never rewritten. Recipient actions go in the same `UpdateDraftActionResponse` as body and subject. A recipient action replaces the field (spike S6 step 2), so each action carries the draft's list from the tap's event as received, then the new addresses. Never `setSendStatus`.
- Disclosure. [D31, slice 15, Proposed: one-click rows disclose by the row hint before and the draft's fields after; the row carries `rc` in place of a hash; the details card keeps the lines and `rh` below. ADR-0006 Amendment 2026-11-11.] Every address is shown on a card before it reaches the draft. The preview card section "Recipients" and the prompt card (below its switch) show the same lines (`recipientWidgets`): each added address on its own line with its field; outside addresses carry "outside <caller domain>"; Bcc lines carry "hidden from other recipients"; markers join with " · ". Not-added addresses carry their reason; unknown fields name the addresses to add by hand; the finish-typing line shows whenever Insert adds an address (texts in section 7.1). The card carries `rh`, the first 16 hex characters of a SHA-256 over the template lists and `blocked` it showed; at Insert, a different hash of the `template.apply` lists leaves the draft unchanged and re-renders the card with the change message. `rh` does not cover the draft's known or unknown state: the plan is rebuilt from the tap's event (Q54). An Insert without `rh` whose lists are not empty shows the preview card in place of the insert. Gmail's own outside-recipient warning is not relied on.
- Limit: an address still being typed in a draft field (not yet a chip) is not in the event, and a replace drops it. The cards and the quick start say so.
- Sidebar lists carry counts only: item field `rc: [to, cc, bcc]`. Row label "Adds To 1, Cc 1, Bcc 1" (fields with addresses only), on one line after the folder path and the fields hint, joined by " · " (slice 12).
- History: each version shows a recipients line. Restore copies and validates. Duplicate copies and validates. Export `meta` carries them. A version file whose list fails the shape rule (`isStoredList`) reads as `[]` with no write; `version.restore` then succeeds and returns `recipientsUnreadable: ["cc", ...]`, and the web app says "Restored as version N. The Cc addresses of version K could not be read and were left empty. Add them again in the editor."
- Search: web app library only, weight 1, a term matches the local part prefix or the full address prefix; the domain alone matches nothing. Sidebar `search` unchanged (Q39).
- Audit: `template.*` events carry the item in `before` and `after`, so recipient changes show as a diff. Logs never carry an address (section 11).

### 5.8 Admin settings (D29, added 2026-11-10)

Mechanism and options in ADR-0008, Accepted 2026-11-11. Built in slice 11, hardened in slice 13.

- Storage: optional object `settings` in `index.json`, `{ <name>: { value, updatedAt, updatedBy } }`. Absent object or entry = the default, with `updatedAt` and `updatedBy` `""`. Each reader fills the defaults with `settingsOf` (src/shared/model/settings.ts); `readIndexDoc` leaves the object as stored, so no read path writes a default. Changed only by `config.set` through `commit`, so the change and its audit event are one write and `INDEX_REV` rises. The shape check (`settingsProblem`, called from `indexProblem`) refuses a stored value outside its list.
- Fixed list (one table in src/shared):

  | Name | Values | Default | Effect |
  |---|---|---|---|
  | `personalTemplates` | `on`, `off` | `off` | `off`: no private folder is created; private trees resolve to `use` for owner and admins (section 5.1) |
  | `recipientsExternal` | `allow`, `deny` | `allow` | `deny`: section 5.7, ADR-0006 |

- Delay: the server follows a change from the next request on; writes already running re-check in the lock on the fresh index. Web app controls follow on the next library load. The sidebar view cache can show old lists for up to 10 min; inserting stays allowed under `off`, so the cache exposes nothing the server refuses.
- Two admins (slice 13): `config.set` carries `baseAt` and `baseBy`, the `updatedAt` and `updatedBy` of the entry the admin saw ("" for the default). In the lock, the same new value answers ok with `changed: false` and writes nothing; else a last change other than the base answers CONFLICT with the current entry in `details`, so an A, B, A sequence cannot hide B. The web app applies `details` and shows the section 7.3 conflict text.
- `setup()` writes no settings. `backup.restore` keeps the live `settings`; its audit event `after` holds `liveSettingsKept: true`. Export and import carry none.
- Admins list (D32, added 2026-11-11, Proposed; ADR-0003 and ADR-0008 Amendments 2026-11-11). Optional `index.json` field `admins: [{ email, addedAt, addedBy }]`, absent = `[]`, at most 20. Admin = `ADMIN_EMAILS` or `ADMIN_GROUP` member or in `admins` (trim, lower case, exact). Changed only by `admin.add` and `admin.remove` through `commit`. `appAdminsOf(index)` drops malformed entries, which grant nothing and never fail the index. Every index writer keeps the field. `backup.restore` keeps the live `admins` (event `after` adds `liveAdminsKept: true`). `setup()`, export and import write none. `ADMIN_EMAILS` and `ADMIN_GROUP` stay owner-set Script Properties; no op writes them.

Enforcement points of `personalTemplates` = `off`. One rule in `levelResolver` covers every level check, before the handler and in the in-lock re-check (`commit`). The implementer touches each row below and adds a role matrix test for it; rows marked "test only" need no code beyond the rule.

| Op (section 6) | Today | While off | Change |
|---|---|---|---|
| `folder.list` | creates the caller's private folder (`ensurePrivateFolder`) | creates none; lists an existing private folder at `use` | skip `ensurePrivateFolder` when off |
| `sidebar.home` | own private folder listed | listed when it exists, at `use`; returns `personalTemplates` for the empty card | add the field |
| `template.list`, `search`, `search.body` | own private templates included | included (`use`) | test only |
| `template.get`, `template.getBody`, `template.apply` | `use` | allowed | test only |
| `favorite.set`, `favorite.unset`; Recent | `use` | allowed; favorites and Recent into a private folder keep working | test only |
| `template.create` | `edit` on folder | DENIED for a private target | rule; DENIED text |
| `template.update` | `edit` | DENIED | rule |
| `template.duplicate` | `edit` on source and target | DENIED when either is private | rule |
| `template.delete` | `edit` | DENIED in a private folder | rule |
| `template.restoreFromTrash` | `edit` on original and target | DENIED when either is private | rule |
| `template.move` | `edit` on source and target | DENIED when either is private | rule |
| `version.list`, `version.get`, `version.restore` | `edit` | DENIED in a private folder | rule |
| `folder.create` (sub), `folder.rename`, `folder.move`, `folder.delete` | `manage` (admins only on private; delete already VALIDATION) | DENIED on a private folder | rule |
| `grant.list`, `grant.add`, `grant.remove` | VALIDATION on private | DENIED with the off text for admins (their level is `use`, the row needs `manage`); DENIED for others | none (rule) |
| `export.folder` | `manage` | DENIED on a private folder | rule |
| `export.library` | skips private folders | unchanged | none |
| `import` | VALIDATION for a private target | unchanged | none |
| `admin.folders` | admins get every live folder | private folders drop out of the admin Folders tab (the handler keeps folders at `manage`); the library still lists them for admins at `use` (D18) | none (rule) |
| `trash.purge`, `daily` purge | admin; 30 days | unchanged, private trash included | none |
| `me` | | returns `personalTemplates`, `recipientsExternal` | add fields |
| `config.get`, `config.set` | | settings read and write (section 6) | new |

Client points: library "New template" (in a folder: shown only where the caller holds `edit`; on All templates and Favorites: shown when the caller can edit some folder, with a folder choice of `editableFolders`, built in slice 13; private folders drop out while off; no folder left = no button); editor of a private template while off opens read only with "Personal templates are turned off by your admin. You can still insert this template."; row menu actions by level (already); editor Save on a private template answers DENIED with the off text; Trash view lists only editable folders (private trash drops out while off); add-on home empty card text by `personalTemplates` (section 7); library empty texts (section 7).

Enforcement points of `recipientsExternal` (built in slice 11, `recipientPolicy`): `validateRecipients` policy input on `template.create`, `template.update`, `template.duplicate`, `version.restore`, `import`, before the lock and again inside it (`recheckRecipients`, slice 13, section 5.7); `blocked` in `template.apply` and `template.getBody`; `me`; `config.get`.

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
| trash.purge | admin; empties the whole trash (templates and soft-deleted folders), at most 50 body-file deletions per call, the rest by the daily orphan cleanup. Result `{ purged, templates, folders, filesTrashed, itemsPending }`; `templates` and `folders` (slice 13) are counted on the index read in the lock | web |
| admin.folders | manage on at least one folder: admins get every live folder, manage holders the folders they manage; anyone else DENIED (one denied audit row) | web |
| grant.list, grant.add, grant.remove | manage | web |
| export.folder | manage | web |
| export.library, import, audit.query, usage.report, membership.status, membership.refresh, config.get, backup.list, backup.restore | admin | web |
| config.set | admin, in-lock admin re-check; `{ name, value, baseAt, baseBy }` against the fixed list of section 5.8 (D29, ADR-0008) | web |
| admin.add, admin.remove | admin (any of the 3 sources), in-lock admin re-check on the in-lock index; `{ email }` (D32, section 5.8) | web |
| me | none beyond a valid caller | both |

`spike.s4` and its policy row were removed in slice 5.

Arguments and results for recipients (D26, slice 9, section 5.7): `template.create` and `template.update` take `to`, `cc`, `bcc` (string arrays). `template.duplicate` and `version.restore` copy them and validate. `import` reads them from `meta`. `template.get` and `export.*` return them. `template.list` (web app) always carries `to`, `cc`, `bcc` of each visible template, `[]` for old items (slice 13). `template.apply` and `template.getBody` return `to`, `cc`, `bcc` (inside addresses only when `settings.recipientsExternal` is `deny`) and `blocked` on every call. `version.get` returns the version's lists; `version.restore` adds `recipientsUnreadable` when a list could not be read (section 5.7). `sidebar.home`, `search` and the sidebar lists return `rc: [to, cc, bcc]` counts and no address. `me` returns `recipientsExternal` (`allow` or `deny`) for the editor. No new op and no new policy row.

Arguments and results for export (slice 13, section 4.5): `export.library {}` and `export.folder { folderId }` with `start: true` answer `{ token, total }`; page calls `{ offset, token }` (plus `folderId`) answer `{ header, items, total, next }`.

Arguments and results for settings (D29, slices 11 and 13, section 5.8, ADR-0008 section 2):
- `config.set { name, value, baseAt, baseBy }`. `name` in the fixed list; `value` in that setting's values; `baseAt` and `baseBy` strings of at most 254 characters; any other or extra arg answers VALIDATION (section 7.3 texts). A call that still carries the old arg `from` answers VALIDATION "This page is out of date. Reload it and save again." Result `{ name, value, updatedAt, updatedBy, changed }`. Same as `value`: `changed: false`, no write, no audit event. Last change other than `baseAt`, `baseBy`: CONFLICT with the current entry in `details`.
- `config.get` adds `settings`: per name `{ value, updatedAt, updatedBy }`. D32: also `admins` (`[{ email, addedAt, addedBy }]`) and `breakGlass` (the `ADMIN_EMAILS` addresses).
- `admin.add { email }` (D32): any other or extra arg answers VALIDATION. Checks in order: form (recipient rule of 5.7, after trim and lower case) `ADMIN_FORMAT`; domain part equals `DOMAIN` `ADMIN_OUTSIDE`; Directory `users.get` (`domain_public`, `basic`) not found `ADMIN_NO_ACCOUNT`, other Directory error SERVER; then in the lock: caller still admin, else DENIED; `primaryEmail` already listed: ok `changed: false`, no write; 20 listed `ADMIN_TOO_MANY`; else append `{ email: primaryEmail, addedAt, addedBy: caller }`. Result `{ admins, changed }`.
- `admin.remove { email }` (D32): the caller's own address `ADMIN_SELF`; in the lock: caller still admin, else DENIED; not listed: ok `changed: false`; else remove. Result `{ admins, changed }`. Only `admins` changes; a break-glass or group admin stays admin.
- `me` adds `personalTemplates` (`on`, `off`). `sidebar.home` adds `personalTemplates`.
- While `personalTemplates` is `off`, a DENIED whose target sits in a private tree carries the text "Personal templates are turned off by your admin."

Status 2026-11-10 (build f6b567f, slices 6a and 6b merged): every op in this table has a handler. `LATER_SLICE_OPS` and the "not implemented" answer are removed. `template.getBody` (slice 3) returns the readable body without an apply event; the add-on uses it on a body cache miss. `template.apply` takes `followUp: true` on the prompt card Insert (section 4.1 step 5). `template.duplicate` (slice 4b): title "Copy of ...", cut to 120, tags, subject and the current body become version 1; edit on source and target. `search`, `search.body`, `favorite.set`, `favorite.unset` (slice 5). `admin.folders`, `membership.status`, `trash.purge`, the Trash view of `template.restoreFromTrash` (slice 6a). `export.*`, `import`, `audit.query`, `usage.report`, `config.get`, `backup.list`, `backup.restore` (slice 6b). Admin rows re-read the membership snapshot inside the lock before a write (dispatch `recheck`).

## 7. Error, empty and loading states

Error codes and UI (wireframe 07). Guard order: blank caller gives AUTH_NO_USER first, then NOT_CONFIGURED while `DOMAIN` is unset (every caller, in or out of the domain), then the domain check, then the policy row.

| Code | Cause | Sidebar | Web app | Retry |
|---|---|---|---|---|
| NOT_CONFIGURED | Script Property `DOMAIN` unset: `setup()` has not run | "Migway Templates is not set up yet." "Ask the owner to finish setup, then press Retry." + Retry | server text "Migway Templates is not set up. The owner runs setup once.", full page | no |
| AUTH_NO_USER | blank or non-domain active user | "Cannot identify your Migway account." "Apps Script does not support several signed-in Google accounts. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account." | Same, full page | no |
| DENIED | no level on target | "You don't have access to this template. Ask a folder manager." + Back or Refresh. While personal templates are off and the target is in a private folder the server text is "Personal templates are turned off by your admin." (D29) | Inline banner, item removed from list; same off text | no |
| NOT_FOUND | deleted or moved | "This template was removed or moved. Press Refresh to update the list." + Refresh | "This template was removed or moved." Banner + link to library | no |
| CONFLICT | baseVersion stale | n/a | Conflict dialog (4.2) | after choice |
| BUSY | lock not acquired in 10 s | "Busy right now. Press Retry in a few seconds." + request ID + Retry | "Busy, try again." Toast + Retry | yes |
| QUOTA | Apps Script quota or simultaneous executions | "Service is busy. Try again in a minute." + Retry; a Retry inside the 60 s gives the notification "Service is busy. Try again in <n> seconds." | "Service is busy. Try again in a minute." Toast | yes, after 60 s |
| VALIDATION | placeholder, subject, recipient, size or request ID errors | n/a | Inline list under editor with positions | after fix |
| PROMPTS_MISSING | blank prompt at apply | Prompt card with fields marked. [D31, slice 15: no longer raised; a blank field is removed; over 500 characters re-renders the details card, section 7.4] | n/a | after fill |
| TIMEOUT, SERVER | network or unhandled | "Something went wrong. Press Retry." + request ID + Retry | "Something went wrong. Retry." Banner + request ID | yes |

Sidebar texts as built in slice 12; state cards have no header. Slice 14 (wording pass, in build) may change texts of both columns; this table then follows the code.

### 7.1 Recipient texts (D26, added 2026-11-10)

Save errors (editor field error and Problems list; `field` and `position` from the code):

| Code | Text |
|---|---|
| `RCPT_FORMAT` | "Cc, address 2 is not an email address. Use the form name@company.com." |
| `RCPT_TOO_LONG` | "To, address 1 is longer than 254 characters." |
| `RCPT_TOO_MANY` | "Cc holds 11 addresses. Use at most 10 per field." or "To, Cc and Bcc hold 21 addresses together. Use at most 20." |
| `RCPT_DUPLICATE` | "safety@migway.com is in both To and Cc. Keep it in one field." |
| `RCPT_EXTERNAL` | "Bcc, address 1 is outside migway.com. Your admin allows only migway.com addresses. Remove it to save." |

Sidebar (wireframe 02):
- List row of a template with recipients: label "Adds To 1, Cc 1, Bcc 1" (fields with addresses only), on the row's one label line after the path and fields hint, joined by " · "; button "Review", screen reader text "Review <title>". [D31, slice 15: button "Insert", screen reader "Insert <title>"; the hint moves first on the label line (section 7.4).]
- Preview card, section "Recipients", and the prompt card below its switch: one item per address, top label the field ("To", "Cc", "Bcc"), text the address, bottom label the markers joined by " · ": "outside migway.com", "hidden from other recipients" (Bcc).
- Not added: "Not added: <address>. The draft already has a To recipient." / "Not added: <address>. It is already in the draft." / "Not added: <address>. Outside migway.com, turned off by your admin."
- Unknown draft field: "The draft's Cc recipients could not be read and were not changed. Add by hand: <addresses>."
- Finish typing (when Insert adds an address): "Finish typing addresses in the draft first: an address still being typed is lost."
- Preview card line above the buttons: "Adds 2 recipients." (count of addresses Insert adds; "1 recipient" singular). [D31, slice 15: the details card has no such line; the switch label carries it.]
- Prompt card switch: label "Add recipients", bottom label "Adds 2 recipients." (only when Insert adds one), then the recipient lines above.
- Changed lists at Insert: "The recipients of this template changed. Check them and press Insert again."

Editor (wireframe 04, Details panel, slice 8b):
- Labels "To", "Cc", "Bcc" above each field. Enter, comma, semicolon, space, a pasted list and leaving the field turn the typed text into chips (trim, lower case, repeats dropped). Backspace in the empty input removes the last chip. Each chip has a button "Remove <address> from Cc". The status line announces "Added <addresses> to Cc" and "Removed <address> from Cc".
- Help under the three fields: "Added to the draft when someone inserts this template. Users see every address before it is added." [D31, slice 15: "Added to the draft when someone inserts this template. The row in Gmail shows how many; the draft shows them after the insert."]
- Marker under a valid outside address: "outside migway.com". Under `deny` the chip has the error style and the `RCPT_EXTERNAL` text.
- Bcc help: "Hidden from the other recipients of the email."
- `use` holders see the lists read only, chips without a remove button; an empty field reads "None".

Config tab: [Amended 2026-11-10, D29: the read-only row "Set by the owner in Script Properties (RECIPIENTS_EXTERNAL)" is replaced by the "Outside recipients" setting of section 7.3.]

### 7.2 Side-panel texts (D27, added 2026-11-10)

Wireframe 01, side-panel variant. Entries from `entryOf` (section 4.1a).

| Place | `inbox` (no message open) | `message` (message open) |
|---|---|---|
| Line above the lists (not built; waits for S7) | "Start a new email from a template." | "Reply to this email with a template, or start a new one." |
| Row button | "New email", screen reader "New email from <title>" | "Reply", screen reader "Reply with <title>" |
| Row button, template with recipients | "Review" (as compose) | "Review" |
| Preview buttons | "New email" | "Reply", "Reply all", "New email" |
| Prompt card footer | "Create email" | "Create reply" (or "Create email" when opened from "New email") |
| Footer hint (both; built in slice 10, text of slice 12) | "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar." Last section of home, folder, search and preview cards | same |

D31 (slice 15): panel cards change only where they share code with compose: Recent without favorites, label order, no search hint, the details card in place of the preview card (no inputs, no Insert while the panel inserts nothing). As built until the panel pass (slices 10 and 12): rows and preview cards in `inbox` and `message` carry no Insert or panel button; a tap on a title opens the preview; the hint ends each card. The dev build adds the "Spike S7 (temporary)" section after the hint.

Preview card lines, side panel only:
- Signature: "Your Gmail signature is not added. Use the signature button in the draft." (dropped if S7 shows Gmail adds it.)
- Reply subject: "The reply keeps its subject, so it stays in the conversation." (template has a subject)
- New email: "Opens a new email with this template." Reply: "Opens a reply with this template."
- Recipients: section 7.1 lines; in a reply the template To reads "Not added: <address>. The reply already has a To recipient."

Notifications (compose-action callbacks): "Fill 1 field: <label>" (blank prompt); section 7 sidebar texts for errors. If S7 shows the panel cannot create drafts: the row buttons are removed and the card shows the footer hint as its first line (fallback, ADR-0007).

Empty states:

- Sidebar, no visible templates, personal templates `on`: "No templates shared with you yet. Your private folder is ready: open the library to create one." Button: Open library.
- Sidebar, no visible templates, personal templates `off` (D29): "No templates shared with you yet. Ask your admin for access to a folder." No button.
- Library, no folder visible (personal templates `off`, no grant): "No templates shared with you yet. Ask your admin for access to a folder." No button.
- Library, the caller's own private folder while `off`: "Personal templates are turned off by your admin. You can still insert these templates." Shown above the list; no New template button.
- Sidebar, no favorites (slice 12): the Favorites section is not shown. Recent with no entries is not shown either.
- Sidebar, no search results: `No templates match "<query>". Try fewer words, or remove folder: and tag: from the search.` The query shows at most 60 characters (`ECHO_MAX`, cut by whole characters), then "...".
- Library, empty folder: "No templates in <folder>." Button: New template (edit level only).
- Library, no search results: `No templates match "<query>". Try folder: or tag:.`
- Trash empty: "Trash is empty. Deleted templates stay here for 30 days."
- Admin, folder without grants: "Only admins can see this folder. Add a grant to share it."

Loading states:

- Sidebar: Card Service shows Gmail's own spinner until the card returns. The server keeps it under the 3 s budget. No partial cards.
- Web app: skeleton rows for the list (8 rows), skeleton blocks for editor and history, `aria-busy="true"` on the region. Save button shows "Saving..." and is disabled; status text in a live region: "Saved as version 7".

### 7.3 Settings texts (D29, added 2026-11-10)

Config tab, section "Settings" (wireframe 06). Admins only.

| Place | Personal templates | Outside recipients |
|---|---|---|
| Legend | "Personal templates" | "Outside recipients" |
| Explanation | "Users can create their own templates in My templates. When off, users keep and can insert the personal templates they have, but cannot create, change or delete them." | "Templates can add addresses outside migway.com to To, Cc and Bcc. When off, saving such an address fails and Insert skips it." |
| Radio labels | "On", "Off" | "Allowed", "migway.com only" |
| Last change | "Last change: <name part> on <local time>." or "Default, never changed." | same |
| Save | "Save", busy "Saving...", status "Saved. Personal templates are off for every user from their next action." (or "on") | "Saved. Outside recipients are allowed." / "Saved. Only migway.com recipients are allowed." |
| Confirm dialog (only for `on` to `off`, `allow` to `deny`; Cancel has focus) | Title "Turn off personal templates?" Body "Users can no longer create, change or delete templates in My templates. Their existing personal templates stay and can still be inserted. Nothing is deleted. Turning it on again restores everything." Buttons "Turn off", "Cancel" | Title "Allow only migway.com recipients?" Body "Templates keep their outside addresses, but Insert no longer adds them and saving a template with one fails until the address is removed." Buttons "Allow only migway.com", "Cancel" |
| Conflict (client text; the radio then shows the current value and focus moves to the status line) | "<name part> changed this setting on <local time>. The page now shows the current value." | same |
| Validation (server) | "Setting <name> does not exist." (at most 40 characters of the name, `NAME_ECHO_MAX`) / "Setting personalTemplates takes on or off." / old `from` arg: "This page is out of date. Reload it and save again." | "Setting recipientsExternal takes allow or deny." |

The server CONFLICT message is "<name part> changed this setting. The page now shows the current value."; the client adds the local time. Save stays enabled while saving with `aria-disabled`; when Save ends disabled after it had focus, focus moves to the status line (slice 13).

The domain in the texts is Script Property `DOMAIN`.

Admins (D32, added 2026-11-11, Proposed). Config tab, Settings, section "Admins" after the two switches (wireframe 06). Admins only.

| Place | Text |
|---|---|
| Legend | "Admins" |
| Explanation | "Admins manage every shared folder, grants, settings, imports and backups. Add people by their migway.com address." |
| Row of the in-app list | the address; bottom line "Added by <name part> on <local time>."; button "Remove", screen reader "Remove <address> as admin". No button on the caller's own row |
| Read-only rows | "Set by the owner: <addresses>. These cannot be removed here." (`ADMIN_EMAILS`); "Members of <group>." (`ADMIN_GROUP`, only when set) |
| Empty list | "No admins added here yet." |
| Add | input label "Email address"; button "Add admin", busy "Adding..."; status "<address> is now an admin." / "<address> is already an admin." |
| Remove confirm (Cancel has focus) | Title "Remove <address> as admin?" Body "They lose admin access at their next action. Their templates and folders stay." Buttons "Remove admin", "Cancel" |
| Remove result | "<address> is no longer an admin." / "<address> is not in the list." |
| `ADMIN_FORMAT` | "Enter an email address, for example name@migway.com." |
| `ADMIN_OUTSIDE` | "Only migway.com addresses can be admins." |
| `ADMIN_NO_ACCOUNT` | "No migway.com account has this address. A group goes in the admin group the owner sets." |
| `ADMIN_TOO_MANY` | "The list holds 20 admins. Remove one first." |
| `ADMIN_SELF` | "You cannot remove yourself. Ask another admin." |
| Directory error (SERVER) | "The address could not be checked. Try again." |
| Caller no longer admin (DENIED) | existing DENIED text of section 7 |

After an add or a remove the list shows the op's `admins`; focus moves to the status line.

### 7.4 Compose card: one-click insert and details card (D31, added 2026-11-11)

Proposed until the owner approves. Mechanism and options: ADR-0009 (cards), ADR-0004 Amendment 2026-11-11 (fields), ADR-0006 Amendment 2026-11-11 (recipients). Built in slice 15 (section 13.9). Compose entry only; the side panel keeps its built cards until spike S7 (section 7.2, ADR-0009 section 6). No server change.

Rule for a field without a value (explicit `{{ask:Label}}`, or a variable with no value and no fallback), owner decision 2026-11-11: it is removed. Value order: typed answer, else the variable's value, else its fallback, else "". Then the cleanup of ADR-0004 Amendment 2026-11-11 runs on each text run and on the subject. A gap is where a token rendered as empty text; gaps are handled left to right; "space" is U+0020 only:
1. Space on both sides of the gap: drop the space after it.
2. Space before the gap and one of `, . ; : ! ?` right after it: drop the space before it.
3. Gap at the start of the run with a space after it: drop that space.
4. Gap at the end of the run with a space before it: drop that space.

Subject: the same rules, then `oneLine`; an empty subject sends no subject action. Left alone: spaces across inline tags, non-breaking spaces, tabs, line breaks, the template's own double spaces, other punctuation, and blocks left empty (no paragraph, list item or cell is removed; smoke step 13 records how Gmail shows an empty paragraph). Test pairs: ADR-0004 Amendment 2026-11-11 (8 pairs). Risk: a sentence with a hole can be sent. Mitigations: the row hint "n fields to fill" and the details card for pre-fill.

Home card (wireframe 01):
- Sections in order: search input (title "Search templates", no hint), Favorites (max 10), Recent without any template in Favorites (server max 5, hidden when empty), Folders. Collapse after 5 rows as built.
- Row: start icon of its section, title as text, one bottom label: recipient hint, fields hint, folder path, joined by " · " ("Adds Cc 1, Bcc 1 · 2 fields to fill · Sales / Quotes"). Folder cards drop the path. Empty parts drop out.
- Row button (compose only): "Insert", `FILLED` slate, screen reader "Insert <title>", action `onInsert` with `id`, plus `rc` = "<to>,<cc>,<bcc>" when the row shows a recipient hint.
- Row tap (`onClick`): `onPreview`, opens the details card.
- Footer: "Open library", `FILLED` with background #2a3c49 (FixedFooter requires a filled primary [A40]). Manifest `addOns.common.layoutProperties.secondaryColor` "#2a3c49" for outlined buttons ([A42]; Gmail web support unverified, smoke step 10).
- Folder and search cards: same rows and footer. Search results: each template once.

Flow A, row Insert (`onInsert`):
1. `template.apply` `{ id, knownVersion, recipientEmailIfInternal }`: server re-checks `use`, buffers one apply event.
2. Failure: the section 7 state card is pushed; the draft does not change.
3. Count check: `rc` (absent = "0,0,0") against the lengths of `to`, `cc`, `bcc` of the reply. Different: push the details card with the change line; no insert.
4. Any template address in a draft field that `draftRecipients` reports unknown: push the details card (its "Add by hand" line); no insert.
5. Else render body and subject with no answers (unfilled fields removed, with the cleanup), subject per D24 (`replacesSubject(undefined, draftHasSubject)`), recipients by `recipientActions(lists, draft, true)`. One `UpdateDraftActionResponse`. The card closes (spike S6 step 0).

Flow B, details card (`onPreview`, compose):
1. `template.apply` `{ id, knownVersion, followUp: true }`: same `use` check, no apply event, `recipientFirstName` "" (Q24). Body cached as today.
2. Card, top to bottom: header = title; change line when pushed by Flow A step 3 or a re-render; section "Fields" when the template has fields without a value: line, inputs `p-1` to `p-20`, the more-than-20 line; "Replace the subject" switch (`subj`) with the subject preview as bottom label, only when the template has a subject, default per D24; section "Recipients" when the template has addresses: "Add recipients" switch (`rcpt`, on) when Insert adds one, then the `recipientWidgets` lines (markers, Not added, Add by hand, finish typing); the text preview (600 characters, tokens as `[Label]`).
3. Footer: primary "Insert" (`FILLED`, slate); secondary "Edit in library" (`OUTLINED`) when the caller holds `edit`. Gmail's back arrow returns to the list.
4. Insert parameters: `id`, `title`, `version`, `values` (JSON of the variable values of step 1), `rh` (always), `counted=1` only on a re-rendered card.

Flow C, details Insert (`onPromptInsert`):
1. `template.apply` without `followUp` (one apply event, recipient first name resolved); with `counted=1`, `followUp: true`.
2. New version: re-render with the version line, `counted=1`, switches at their defaults. Other lists (`rh`): re-render with the change line, `counted=1`. A value over 500 characters: re-render with the shorten line and those fields first, `counted=1`.
3. Else: values = card `values`, then each non-blank value of step 1. Answers by field key from the inputs. A typed value wins; a blank field takes a resolved value, else it is removed. Subject only while `subj` is on; recipients only while `rcpt` is on. One `UpdateDraftActionResponse`.

States: section 7 codes unchanged on all three flows. PROMPTS_MISSING is no longer raised by the compose card.

Texts (new or changed; sentence case, no colon before a button):

| Place | Text |
|---|---|
| Details card, fields line | "Fill in now, or leave blank and type in the draft." |
| Details card, input title | the label, no asterisk |
| Details card, input hint of the implicit recipient first name | "Leave blank to use the To recipient's first name, when known." |
| Details card, more than 20 fields | "This template has 23 fields. The first 20 are here. The rest are left out of the draft." |
| Details card, values over 500 characters | "Shorten to 500 characters: Driver name" |
| Details card, version changed | "The template changed. Check the fields and press Insert again." |
| Details card, lists changed (also from a row) | "The recipients of this template changed. Check them and press Insert again." |
| Row button | "Insert" |
| Footer of home, folder and search cards | "Open library" |

Removed texts: "Review" and "Review <title>", "Fill these fields to insert", "Fields to fill: ...", "Sets the draft subject.", "The draft already has a subject. It is kept.", "Adds 2 recipients." above buttons (kept as the switch label), "Insert with subject", "Insert body only", the too-many-fields card, the search hint.

Quick start lines (slice 15, docs/guide/user-quick-start.md): "Insert puts the template into the draft at once. Fields you did not fill are left out. Read the draft before you send." "Tap a template's name to see it first and fill in its fields." "Templates that add recipients say so on the row, for example Adds Cc 1. The draft shows the addresses after the insert. Finish typing addresses before you insert."

Smoke "Slice 15" (Gmail web, compose toolbar, dev build; the implementer copies these steps into docs/ops/smoke.md). Templates: T1 no fields, subject "T1 subject"; T2 subject `Load {{ask:Load number}}`, body `Hi {{ask:Driver name}}, load {{ask:Load number}} is ready. {{sender.phone}}`; T3 Cc `smoke-cc@` and Bcc `smoke-bcc@` (domain test addresses), no fields; T4 T2 plus T3's lists; T5 body of 3 paragraphs "Hi team,", `{{ask:PS}}` alone, "Thanks". Nothing is sent; discard every draft.
1. New draft, cursor in the body. Row Insert on T1: body at the cursor, subject "T1 subject". Record: the card closed (y/n).
2. Row Insert on T2 in a new draft: subject "Load", body "Hi, load is ready." followed by the phone when the Directory has one, else nothing. No card, no "{{" left.
3. Row label of T4 reads "Adds Cc 1, Bcc 1 · 2 fields to fill · <path>" (the hint counts `{{ask:}}` fields). Record: label on one line, wrapped, or cut.
4. Row Insert on T3 in a new empty draft: Cc and Bcc chips added, Bcc line visible. Record: the card closed (y/n).
5. Reply to a received message, row Insert on T4: To and "Re:" subject kept, Cc and Bcc added, unfilled fields removed from the body.
6. Open the add-on (view cached). In the library add a second Cc to T3. Row Insert on T3 within 10 min: details card with "The recipients of this template changed...", draft unchanged. Insert there: 2 Cc added.
7. Row tap on T2: details card shows 2 or 3 inputs, the subject switch on, the preview. Fill Driver name only, Insert: "Hi <name>, load is ready."
8. Details card of T2: 501 characters in Driver name, Insert: shorten line, draft unchanged. Fix, Insert. Admin, Usage after the next 5-minute tick: the apply count of T2 rose by 1, not 2.
9. Details card of T4 in a draft with a subject: subject switch off. Turn "Add recipients" off, Insert: body only, subject and recipients unchanged.
10. Home: a template that is a favorite and recently used shows only under Favorites; no hint under the search input; "Open library" is slate; record the color of "Edit in library" on a details card (slate or blue).
11. Remove your grant on T1's folder in the library, row Insert on T1 (view cached): the DENIED card, draft unchanged.
12. Side panel (no draft): rows show no Insert; a row tap opens the details card with no inputs and no Insert; the hint ends the card.
13. Row Insert on T5: record whether the empty middle paragraph shows as a blank line (y/n). Yes is accepted for v1; it is noted in the handoff.

## 8. Accessibility

- Every web app action reachable by keyboard: Tab order follows visual order; folder tree uses `role="tree"` with arrow keys, Enter opens; list uses `role="grid"` with arrow navigation; shortcuts: `/` focuses search, `Ctrl+S` saves, `Esc` closes dialogs.
- Focus visible on every interactive element (2 px outline, contrast 3:1 against background). Dialogs trap focus and return it to the opener.
- Every input has a visible `<label>`. Icon buttons have `aria-label` ("Add to favorites: Welcome email").
- Text contrast 4.5:1, large text 3:1. No information by color alone (conflict and error also have text and icon).
- Placeholder blanks (slice 8b) have `aria-label` "Field: <label>", "Field: <label>, fallback <text>" or "Field: <label>, asked at insert" (for example "Field: Sender name", "Field: Load number, asked at insert") and are announced as one unit.
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
| gmail.addons.current.action.compose | Non-sensitive [R4 S8] | "Manage drafts and send emails when you interact with the add-on" | add-on | Insert the template into the draft; set the draft subject (D21, D24); add To, Cc and Bcc (D26). Google's pages name no scope for the recipient actions [A14, A15, A25 to A27]; spike S6 checks for a prompt. A new scope stops D26 until the owner approves. Google's compose guide names no extra scope for `UpdateDraftSubjectAction` [A14]. Spike S5 on dev-32a446c: body and subject actions in one response, no new scope (Q20 closed) |
| gmail.addons.current.message.metadata | Sensitive [R4 S8] | "View your email message metadata when the add-on is running" | add-on | Read To recipients for `recipient.first_name` (D10); read To, Cc, Bcc and subject of the draft for D24 and D26 |
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

Side panel (D27, ADR-0007, added 2026-11-10): no new scope. Compose actions (`GmailApp.createDraft`, `createDraftReply`, `createDraftReplyAll`, `ComposeActionResponse`) use `gmail.addons.current.action.compose` ("temporarily create new drafts messages and replies") with the event's `gmail.accessToken`; `getMessageById` and `getFrom` of the open message use `gmail.addons.current.message.metadata` [A29], [A34]. The Apps Script reference pages of those methods list only `mail.google.com` [A32], [A33]; spike S7 settles which holds. The new contextual trigger names no scope in the manifest reference [A37]. Any consent prompt in S7 that names a scope outside the 10 stops the side-panel insert; owner approval needed before any manifest scope change. Reading the Gmail signature would need a restricted scope (`gmail.settings.basic`); not requested (ADR-0007 section 5).

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
| `targetId` | `args.id`, else `args.folderId`, only when it is a well-formed 26-character ID; else (slice 13) the first non-root target folder dispatch resolved (`RequestStats.target`); else `""` |
| `calls` | Service calls in this execution: `props` (Script Properties), `cache` (Script Cache), `drive`, `lock` (`tryLock`), `dir` (Admin Directory). Integers |
| `timing` server keys | `startupMs` (bundle evaluation to handler start), `totalMs` (to the log line), `propsMs`, `cacheMs`, `driveReadMs`, `driveWriteMs`, `lockMs`, `dirMs` |
| `timing` add-on keys | `addonPreMs` (add-on start to this call), `addonTokenMs` (`getOAuthToken`), `prevFetchMs` and `prevTotalMs` (the previous server call of the same add-on execution). The server keeps only these 4 keys, whole ms from 0 to 600,000, and drops anything else |

Field added 2026-11-10 (slices 5b and 5c), add-on calls only:

| Field | Content |
|---|---|
| `draft` | `{ fields, to, cc, bcc, hasSubject }`. `fields`: the compose event field names present, each from the fixed list `messageId`, `threadId`, `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients`, `subject`, in that order. A field counts as present when its value is not undefined, null or "". `to`, `cc`, `bcc`: recipient counts, integers 0 to 1,000. `hasSubject`: boolean, true when the draft subject has a non-space character. The server requires exactly these 5 keys; any other key, name, repeated name, count or a non-boolean `hasSubject` answers VALIDATION "Draft fields must come from the fixed list", and the rejected value is not logged |

Field added 2026-11-10 (D27, ADR-0007), inside `draft`: `via`, one of `compose`, `new`, `reply`, `replyAll`. The server requires it on add-on calls from the Gmail panel pass on and checks it against that list. Panel calls send the counts of the computed draft (ADR-0007 section 3). No message ID, thread ID or address is logged.

Example: `"draft":{"fields":["draftMetadata","toRecipients","subject"],"to":1,"cc":0,"bcc":0,"hasSubject":true}`.

Recipients (D26, added 2026-11-10): no log line carries a template address, a draft address, a domain of either or the `blocked` list. The `draft` object keeps its 5 keys: draft counts before the insert. The apply line gains no field: the server writes it before the add-on computes the recipient actions. Import report lines name the template and the count of dropped addresses only. Audit events are not log lines: `template.*` events keep the whole item in `before` and `after`, recipients included (admin-only audit tab).

Rules: levels `debug`, `info`, `warn`, `error`; `debug` off in prod (`LOG_LEVEL`). `actor` and `targetId` are in every line. No line holds a recipient address, subject text, body text, prompt value or token: `draft` carries names, counts and one boolean only. Never log template bodies, subjects, prompt values, recipient addresses or tokens. `calls` and `timing` hold numbers only. Errors add `errorName` and the first 3 stack frames. Logs appear in the Apps Script executions view on the default GCP project and in Cloud Logging on the standard project (2.5b).

### 11.1 Audit and log rules of the admin ops (slices 6a, 6b, added 2026-11-10)

Mechanism: ADR-0003 Amendment 2026-11-10 (errata run 3).

- Denied rows: every DENIED writes one denied audit event: a policy denial, a handler refusal after the policy check (`admin.folders`), or an in-lock re-check (`trash.purge`, admin rows). One call writes at most one row. VALIDATION and NOT_FOUND write none.
- Event buffer: at most 200 apply and denied events between two `tick` runs (`BUFFER_MAX`). In a full buffer (slice 13) a new event first takes an evicted slot (no drop counted); else an apply event takes the slot of a buffered denied event (the denied event counts as dropped); else the new event is dropped and counted in `evt:dropped`. An event lost to a busy 500 ms buffer lock counts in `evt:lost` ("<lost> <seen>" in one key). `tick` writes one `audit.dropped` event for both (actor `system`, result `error`, `after: { dropped }`). Change events, export start events included, go through `pendingAudit` in the index write and are never dropped.
- Usage: `usage.json` entries carry `days`, apply counts per UTC day, kept 30 days (section 5.5). `usage.report` shows applies in the 30 UTC days ending today.
- Log lines keep the closed field list above. `grant.add` and `grant.remove` (slice 13): `targetId` = folder ID, ok and denied. `folder.create` under a parent logs the parent ID. No line carries a principal key. `import`: `targetId` = target folder; `export.folder`: folder ID; `export.library`: `""`; `backup.restore`: `""`, the date is not logged. No line carries a title, subject or body of an import file.
- Audit events: `grant.*` with before and after; one `import` event per created folder and template; `backup.restore` with before `{ rev, items }` and after `{ date, rev, items, liveSettingsKept: true }`; `trash.purge` one event per purged template and folder; `audit.dropped`. Export (slice 13): one `export.library` or `export.folder` event per run, committed at the start call (section 4.5), `targetType` `library` or `folder`, `after: { scope, templates }`.
- `config.set` (D29, ADR-0008): one audit event per change, `targetType: config`, `targetId` the setting name, `before: { name, value }`, `after: { name, value }`, in the same commit as the change. No event when nothing changed. Log line: `action: config.set`, `targetId: ""` (no `id`, no `folderId`, no folder target), result `ok`, `conflict`, `denied` or `error`; the value is not logged. A non-admin call writes one denied row; VALIDATION writes none.
- `admin.add`, `admin.remove` (D32): one audit event per change in the same commit, `targetType: admin`, `targetId` the address, `before: { email, admin }`, `after: { email, admin }` (booleans). No event when `changed: false`. Log line: `targetId: ""`, no address; result `ok`, `denied`, `error`. A non-admin call writes one denied row; VALIDATION writes none.
- Cache keys hold no address (slice 13): Directory profiles are cached as `prof:<sha256 of the lower-case address>`; old `prof:<email>` keys are never read and expire within 6 h. Export run tokens are `exp:<token>` (section 4.5).

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
| Web UI in design direction A (docs/design/design-system.md): shell, library, trash, history | 8a, done |
| Screen 4 editor in direction A: Details panel with To, Cc, Bcc chips, "The sender fills in", Preview and Problems tabs, "Reads as" line, leave guard, minified styles | 8b, done (merged f88ab0b) |
| Screen 6 admin in direction A | 8c, done |
| Web minors of the 8a and 8c reviews (dialog inert, page focus, audit actor line, export sentence) | 8d, done |
| 5.7 Template recipients (D26), spike S6 | 9, done: S6 passed on dev-ec0ccb2, shared, server and add-on; editor fields in 8b; library address search in 13 |
| 4.1a Side-panel insert (D27), 7.2, spike S7 | 10, done: `entryOf`, `onMessageOpen` contextual trigger, panel cards without Insert, footer hint, S7 harness (dev only). The panel compose actions wait for spike S7 (section 13.7) |
| 5.8 Admin settings (D29), 7.3 | 11, done (section 13.8) |
| 7, 7.2 add-on card layout and texts: no header on home, icons, one-line row labels, collapsed sections, fixed footer "Open library" | 12, done |
| Last fix round: `config.set` base and CONFLICT, in-lock recipient re-check, export start event and run token, buffer slots, log `targetId`, `prof:` hash, `trash.purge` counts, New template folder choice, library address search, settings focus | 13, done |
| Wording pass on web and add-on texts with open review minors | 14, in build; sections 7 to 7.3 follow its result |
| 7.4 One-click insert, details card, home card order (D31) | 15, after 14 merges (section 13.9) |
| 5.8 Admins list, `admin.add`, `admin.remove`, 7.3 Admins texts (D32) | 16, in parallel with 15 (section 13.10) |

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
- The compose card closes after an insert (spike S6 step 0, dev-ec0ccb2); Google's guide does not state it [A14]. An insert response carries no notification [A15], [A44]: the draft is the result (D31, section 7.4).

Added 2026-11-10 (slices 6a, 6b; accepted for v1, each with a v1.1 fix in section 13.5):

- Grant writes in the admin view do not reload the library tree (6b minor R3). A manage holder who removes a grant they depend on sees the old tree until a page reload. Folder writes do reload it.
- 200 refused calls inside 5 min fill the event buffer (6b minor 4). Since slice 13 an apply event takes the slot of a denied event, so applies are dropped only when the buffer holds 200 applies. One `audit.dropped` row records the total.
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
| Separate buffer caps for apply and denied events | src/server/audit | done differently in slice 13: applies take denied slots (section 11.1) |
| Audit month read by byte range or a per-month row index | src/server/audit | v1.1, before a month passes 5 MB |
| Export pages by item ID cursor instead of offset | src/server/handlers/transfer.ts | v1.1 |
| One `export` audit event per export | src/server/handlers/transfer.ts | done in slice 13: one start event through `commit` plus a run token (section 4.5) |
| Restore undo keeps the first error | src/server/handlers/config.ts | v1.1 |
| Plural in the purge refusal; owner label in the Usage tab | src/server, src/web | v1.1 |

### 13.6 Slice 9: template recipients (D26, added 2026-11-10)

Order: slice 8a (shell, library, trash, history), then slice 9, then 8b (editor redesign). Built 2026-11-11: slice 9 (review PASS on 08955ca) built items 1 to 5, 7, 8 without editor fields; 8b built the fields in the Details panel (wireframe 04) and the History recipients line; slice 13 built the library address search.

1. First task, about 20 min on the dev deployment: spike S6 (section 14.1) with a temporary harness card. The result fixes the content of the recipient actions before the rest is built. Harness removed in the same slice.
2. Shared `validateRecipients` (syntax, limits, duplicates, outside rule; the switch was the property `RECIPIENTS_EXTERNAL` in slice 9 and is `settings.recipientsExternal` since slice 11), codes of section 7.1, fixtures for each code and for normalization.
3. Item and version file fields, shape check accepting absence, write paths: create, update, duplicate, restore, import (drop and report), export.
4. `template.apply` and `template.getBody`: `to`, `cc`, `bcc`, `blocked` on every call; `rc` counts in sidebar lists; `me` and `config.get` report the switch.
5. Add-on: `recipientActions` (one place, truth tables of section 5.7, unit tests), "Review" rows, preview card section, "Insert body only" as body only, prompt card switch `rcpt`, `rh` hash check, never `setSendStatus`.
6. Editor fields under Subject with chips and the outside marker; History recipients line; library browser search on addresses.
7. Quick start and editor guide: one paragraph each (what users see, "Insert body only", the To rule in replies).
8. Smoke "Slice 9": new draft, reply, forward, address already present, outside address with `allow` and `deny`, changed recipients under an open card.

### 13.7 Gmail panel pass: side-panel insert (D27, added 2026-11-10)

After slice 9: the panel insert reuses `recipientActions`, the `rh` check and the "Review" rows of slice 9. The panel pass already planned (PLAN Next action: recipient rows, title first, Material icons, filled Insert, footer) carries it.

1. First task, about 30 min on the dev deployment: spike S7 (section 14.2) with a temporary harness. The result decides which panel actions ship. Harness removed in the same pass.
2. Manifest: `addOns.gmail.contextualTriggers` `unconditional` with `onMessageOpen`, only if S7 step 1 shows no consent prompt. Scope list unchanged (build check).
3. `entryOf(event)` in src/addon/event.ts with unit tests for the 3 entries; `rowButton`, `insertButtons`, header line, footer hint as the only readers.
4. Renderer: button flag for `setComposeAction` and reply kind `compose`; callbacks for New email, Reply, Reply all that share the apply pipeline with `onInsert` and `onPromptInsert`.
5. Computed draft for `recipientActions` per action (ADR-0007 section 3); D24 for replies (no subject option).
6. `draft.via` in the add-on call and the server check (section 11).
7. Texts of section 7.2; wireframe 01 side-panel variant.
8. Quick start: one paragraph "Side panel or toolbar" with the 4 differences of ADR-0007 section 2.
9. Smoke "Gmail panel": the S7 cases on the built code, plus prompts, a template with recipients, a DENIED template, and a compose-toolbar Insert (regression).

Interim fix built in slice 10 (review PASS, dev-e2eb0ae): in the panel, rows and preview show no Insert and each card ends with the footer hint. Items 2 and 3 are built too (manifest contextual trigger, `entryOf`). The S7 harness stays in the dev build until S7 runs; items 1 and 4 to 9 wait for it.

### 13.8 Slice 11: admin settings (D29, added 2026-11-10)

After slices 8c (admin redesign) and 9 (recipients) are merged: 11 reuses the 8c Config tab and replaces the `RECIPIENTS_EXTERNAL` reader of 9. No spike: no new scope, no new Google API. Done 2026-11-11: review PASS on f84a021 (docs/reviews/slice-11.md), merged; slice 13 replaced `from` with `baseAt`, `baseBy`.

1. Shared: the fixed settings list (names, values, defaults), defaults filled per reader by `settingsOf` (built; `readIndexDoc` unchanged), shape check entry, fixtures for absent, valid and bad values.
2. Server op `config.set` (section 6): policy row (admin, web), argument checks, base conflict (`baseAt`, `baseBy` since slice 13; `from` in slice 11), no-op on the same value, audit event and log line (section 11.1); `config.get`, `me`, `sidebar.home` fields.
3. Personal templates rule in `levelResolver` (before the admin rule); `folder.list` skips the private folder creation while off; the DENIED text. Role matrix tests: every row of the section 5.8 table, for owner, admin and another user, with the switch on and off; the in-lock re-check refuses a write that started before a change.
4. Recipients: every reader of `RECIPIENTS_EXTERNAL` reads `settings.recipientsExternal`; the property leaves `config.get`.
5. `backup.restore` keeps the live `settings`.
6. Config tab: Settings section (wireframe 06, texts 7.3), radio groups, Save, confirm dialog, conflict reload, last change line. Library and add-on texts of section 7. Lighthouse accessibility 100 on the Config tab.
7. Guides: admin guide (what each setting does, the default, the confirm, who sees it); quick start (one paragraph: personal templates may be off; what a user still can do); editor guide (no change unless the off text needs a line).
8. Smoke "Slice 11" on dev: the deploy reads as `off` and `allow`; owner turns personal templates on and off with a second admin tab open (conflict); a pilot user with a private folder inserts while off and cannot save; a new user gets no private folder while off and gets one after on; `deny` then `allow` with an outside address; the audit tab shows each change.

### 13.9 Slice 15: one-click insert (D31, added 2026-11-11)

After slice 14 merges (both touch src/addon/cards and the add-on texts). Spec 7.4, wireframes 01 and 02, ADR-0009, ADR-0004 and ADR-0006 Amendments 2026-11-11. No spike, no new scope, no server change.

Work: the gap cleanup in src/shared/placeholders/render.ts; Flow A in `insertFlow` (count check, unknown-field push, unfilled fields removed); details card replacing `previewCard` and `promptCard` in compose; Flow C in `promptInsertFlow`; home order and labels; footer style; manifest `layoutProperties.secondaryColor`; quick start lines and editor help text of section 7.4 and 7.1; smoke "Slice 15" into docs/ops/smoke.md.

Acceptance criteria (each checked by a unit test, a build check or the named smoke step):
1. Compose rows on Home, folder and search cards carry one button "Insert", screen reader "Insert <title>", action `onInsert` with `id`, plus `rc` when the row shows a recipient hint. No code path yields "Review" (test over templates with fields, with recipients, with both).
2. Row Insert on a template with `{{ask:A}}` in subject and body returns one insert reply with no `{{` and no label text of A in either, and no card.
3. `renderBody` and `renderSubject`: a value renders the value, a fallback the fallback, neither empty text. Body and subject tests.
4. The 8 input and output pairs of ADR-0004 Amendment 2026-11-11 pass as written, plus one test per item of its "left alone" list (for example `Hi <b>{{ask:Name}}</b>, thanks` keeps the space and the empty `<b></b>`).
5. A subject made of unfilled fields only (`{{ask:Topic}}`) gives an insert reply with no subject action; a template double space away from any gap stays.
6. Row Insert with recipients: equal `rc` gives one insert reply whose recipient actions equal `recipientActions(lists, draft, true)`; a different or absent `rc` with non-empty lists pushes the details card with the change line and returns no insert.
7. A template address in a draft field reported unknown pushes the details card and returns no insert.
8. Call log: the details card opens with `template.apply` `followUp: true` and no `template.getBody` call (compose entry); its Insert calls `template.apply` once without `followUp`; the Insert of a re-rendered card (`counted=1`) sends `followUp: true`. One user path, at most one apply event.
9. Details card structure: inputs only for fields without a value, at most 20 plus the more-than-20 line, no asterisk; subject switch default from `replacesSubject`; recipient switch and `recipientWidgets` lines; text preview; footer primary "Insert" filled slate; secondary "Edit in library" only at `edit` or `manage`.
10. Details Insert: a typed value wins; a blank field takes a resolved value of the Insert call, else it is removed with the cleanup; a value over 500 characters re-renders with "Shorten to 500 characters: <labels>" and no insert; version and `rh` changes re-render as section 7.4 Flow C.
11. Details Insert with both switches off returns the body action only: no subject action, no recipient action.
12. Home card: Recent holds no ID that Favorites holds and is absent when that leaves it empty; the search input has no hint.
13. Row label order: recipient hint, fields hint, path, joined by " · "; folder cards show no path.
14. Home, folder and search footers: primary "Open library" `FILLED` with background #2a3c49. Manifest has `addOns.common.layoutProperties.secondaryColor` "#2a3c49" and the same 10 scopes (build check).
15. Removed from src/addon: "Review", `insertButtons`, `withSubjectButton`, `bodyOnlyButton`, `tooManyFieldsCard`, `needsReview`, `SEARCH_HINT`. `git diff --stat` shows no file under src/server.
16. Side panel entries (`inbox`, `message`): no Insert on rows or on the details card, no inputs on the details card, hint last (unit test per entry). Smoke "Slice 15" steps 1 to 13 run on dev; the handoff records steps 1, 3, 4, 10 and 13.

### 13.10 Slice 16: in-app admins (D32, added 2026-11-11)

Built in parallel with slice 15. Spec 5.8 (Admins list), 6 (`admin.add`, `admin.remove`, `config.get`), 7.3 (Admins texts), 11.1; ADR-0003 and ADR-0008 Amendments 2026-11-11 (D32); wireframe 06. No spike, no new scope (the Directory read uses `admin.directory.user.readonly`, already granted).

Files. Slice 16 owns: src/shared/permissions/**, src/shared/model/** (`appAdminsOf`, index type, shape), src/shared/errors/**, src/server/**, src/web/** except src/web/views/editor.ts, docs/guide/admin-guide.md, docs/ops/runbook.md, the "Slice 16" section of docs/ops/smoke.md. Slice 15 owns src/addon/**, src/shared/placeholders/**, appsscript.json, docs/guide/user-quick-start.md, docs/guide/editor-guide.md, the editor help string in src/web/views/editor.ts, the "Slice 15" section of docs/ops/smoke.md. The second slice to merge resolves docs/ops/smoke.md by keeping both sections.

Acceptance criteria (each checked by a unit test, a build check or the named smoke step):
1. `isAdminEmail` is true for an address in `ADMIN_EMAILS`, in the `ADMIN_GROUP` snapshot, or in `appAdminsOf(index)`, compared trimmed and lower case; false otherwise. A malformed `admins` entry (non-string, other domain, bad form) grants nothing and the index still loads.
2. `subjectFor` reads the index only when the two properties say no (test counts index loads).
3. Role matrix: `admin.add` and `admin.remove` allowed for an in-app, a break-glass and a group admin; DENIED with one denied audit row for a manage holder and a user; refused on the add-on surface.
4. `admin.add` answers `ADMIN_FORMAT`, `ADMIN_OUTSIDE`, `ADMIN_NO_ACCOUNT`, `ADMIN_TOO_MANY` (21st address) in that check order, and VALIDATION for an extra arg; a Directory error other than not found answers SERVER; none of them writes.
5. An alias resolves to the Directory `primaryEmail`, stored lower case.
6. A repeated add and a remove of an unlisted address answer `changed: false`, write nothing and log no audit event.
7. In-lock re-check: a caller removed between the pre-check and the lock gets DENIED and nothing is written; two admins removing each other leave one of them in the list.
8. `admin.remove` of the caller's own address answers `ADMIN_SELF`. No op calls `setProperty` on `ADMIN_EMAILS` or `ADMIN_GROUP` (property store spy over the whole op suite).
9. Each change writes one audit event in the same commit (`targetType: admin`, `targetId` the address, `before` and `after` with `admin` booleans); the log line has `targetId: ""` and no address.
10. After `admin.add` the added person's next request is admin; after `admin.remove` the removed person's next admin op is DENIED (index rev cache test).
11. `admins` survives every index writer: `template.create`, `folder.create`, `grant.add`, `config.set`, `import`, `trash.purge` after an add each read back the same list.
12. `backup.restore` keeps the live `admins`; its event `after` holds `liveAdminsKept: true`.
13. `config.get` returns `admins` and `breakGlass` to admins only.
14. Config tab: the Admins section with the 7.3 texts; no Remove on the caller's row; the remove dialog opens with Cancel focused; after add or remove focus moves to the status line; Lighthouse accessibility 100 on the Config tab.
15. Admin guide and runbook carry the corrections listed below; the scope list stays at 10 (build check).
16. Smoke "Slice 16" steps 1 to 8 run on dev; the handoff records each result.

Smoke "Slice 16" (dev, web app; the implementer copies these steps into docs/ops/smoke.md):
1. Owner opens Admin, Config, Settings. Admins shows "Set by the owner: <owner address>. These cannot be removed here." and "No admins added here yet."
2. Owner adds the pilot user's address. Status "<address> is now an admin."; the row reads "Added by <owner name part> on <time>."; the Audit log tab shows `admin.add`, actor the owner, target the pilot.
3. Pilot reloads the web app: Admin shows the admin tabs; Config opens; the pilot's own row has no Remove button.
4. Pilot tries: an outside address (ADMIN_OUTSIDE text), a made-up migway.com address (ADMIN_NO_ACCOUNT text), a group address (ADMIN_NO_ACCOUNT text), an alias of a real user if one exists (stored as the primary address).
5. With the pilot's Config tab open, the owner removes the pilot (dialog, Cancel focused, "Remove admin"). The pilot changes a setting and presses Save: the DENIED text. Reload: no admin tabs.
6. Pilot in Gmail presses Refresh in the add-on: the sidebar lists only the folders granted to the pilot.
7. Owner restores yesterday's backup (dev only): the Admins list is unchanged; the restore event shows `liveAdminsKept: true`.
8. Owner checks the Audit log: one `admin.add` and one `admin.remove` for the pilot, none for the refused tries.

Corrections for the implementer (text to apply, slice 16):
- docs/guide/admin-guide.md, the line "Admin status is never granted in the app...": replace with "Admins come from 3 places: the Admins list in Admin, Config, Settings; the admin group (`ADMIN_GROUP`); and the owner's list (`ADMIN_EMAILS`). Any admin adds or removes people in the Admins list. Only the owner changes `ADMIN_GROUP` and `ADMIN_EMAILS`, in the Apps Script editor, Project Settings, Script Properties. `setup()` puts the owner in `ADMIN_EMAILS`."
- Admin guide, new steps "Add an admin": open Admin, Config, Settings; type the person's migway.com address under Admins; press Add admin; the person reloads the web app. "Remove an admin": press Remove on the row, then Remove admin; they lose access at their next action. Say: groups go in `ADMIN_GROUP`; you cannot remove yourself; the list holds 20; every change is in the Audit log.
- docs/ops/runbook.md, new section "An admin account is taken over": 1. A Workspace admin suspends the account and resets its sign-in. 2. The owner opens Admin, Audit log, filters on that actor, and lists `admin.add`, `admin.remove`, `config.set`, `grant.*` and `backup.restore` events since the takeover. 3. The owner removes every address that actor added under Admins and adds back any admin it removed. 4. If the account is in `ADMIN_EMAILS`, the owner deletes it from the property; if it is in `ADMIN_GROUP`, a Workspace admin removes it from the group and an admin presses "Refresh memberships now". 5. The owner undoes the settings and grant changes found in step 2.
- Runbook, section "Restore from backup": add "The Admins list and the settings stay as they are now; a restore does not bring back a removed admin."

## 14. Spikes

| ID | Slice | Question | Pass condition |
|---|---|---|---|
| S2 | 2, first task | (a) `drive.file` token passes `/exec` with `DOMAIN`; (b) `getActiveUser` set on token calls; (c) project sharing needed; (d) token call to `/dev` works for editors; (e) Advanced Drive service works on `drive.file` alone | (a), (b), (e) yes; (c), (d) answered |
| S2b | 2 | UrlFetch round trip to `/exec`, add-on start time, Drive read and write of 0.85 MB and 8.4 MB files, `domain_public` fields | p95 recorded in ADR-0002; 0.85 MB read and write each under 2 s (Q17) |
| S4 | 4, first task | Draft insert on Gmail web (ADR-0004 table) | Resolved 2026-11-10: F1 to F9 inserted on Gmail web, 204,837 bytes (F7) included. Allowlist unchanged, cap 100 KB. Android and iOS runs dropped by the owner (D22). Harness removed in slice 5 |
| S5 | 5, first task | Body and subject actions in one `UpdateDraftActionResponse` on Gmail web; subject replaced, not appended; reply drafts (Q20, Q21) | Resolved 2026-11-10 on dev-32a446c: body and subject in one response, no new scope (Q20 closed). A replaced reply subject started a new thread; the event carries no `threadId` or `messageId` (dev-4a233d4). Rule D24 (section 5.6) keeps any filled subject; smoke "Slice 5c" on dev-848206f: the reply stayed in its conversation (Q21 closed) |
| S6 | 9, first task | Body, subject, To, Cc and Bcc actions in one `UpdateDraftActionResponse` on Gmail web; add or replace; new draft, typed recipients, reply, forward; address already present; permission prompt | Passed 2026-11-10 on dev-ec0ccb2 from the compose toolbar (docs/spikes/slice-09-s6.md): all 5 actions apply from one response with no prompt; actions replace a field, so the build sends the draft list plus the new addresses (decision table row 2); event lists are arrays of bare addresses. Step 7 (fresh consent) is still open, by hand; a prompt there stops D26 (Q55) |
| S7 | Gmail panel pass, first task | Compose actions from the side panel: new draft, reply, reply all; scopes; signature; open compose window (D27) | Open. Pass: New email and Reply create drafts with HTML body, subject and recipients, no permission prompt. Steps and fallbacks in section 14.2 |

### 14.1 Spike S6: recipient actions (D26)

Setup: dev build with a harness card "Spike S6" on the home card. Template "S6" with subject "S6 test", To `s6-to@migway.com`, Cc `s6-cc@migway.com`, Bcc `s6-bcc@migway.com` (use three real test addresses of the domain; nothing is sent). Two harness buttons: "New only" sends each recipient action with the template addresses only; "Draft plus new" sends the draft list from the event plus the template addresses. The harness card shows the event's recipient strings on screen (to check the format, for example `Name <address>`); it logs counts only. One Gmail session, about 20 min; discard every draft.

| Step | Draft | Button | Record |
|---|---|---|---|
| 1 | New, empty | New only | body, subject, To, Cc, Bcc set (y/n each); Bcc line opens (y/n); callback ms |
| 2 | New, To `a@` and Cc `b@` typed | New only | `a@`, `b@` still there (add) or gone (replace) |
| 3 | Same as 2 | Draft plus new | all 5 addresses present once (y/n); duplicates of `a@`, `b@` (y/n) |
| 4 | New, Cc `s6-cc@` typed | New only, raw: send `s6-cc@` again | one chip or two |
| 5 | Reply to a received message | the button that kept addresses in step 2 or 3 | To kept, Cc and Bcc added, subject kept, reply stays in its conversation |
| 6 | Forward of a message | same | To added (forward has empty To) |
| 7 | New, empty, from an account with no earlier consent run, or after `Remove access` and re-authorizing | New only | any permission or consent prompt; the scope list it names |
| 8 | The event strings of steps 2 and 5 | none | format of each string as shown on the harness card |

Decision table:

| Result | Build |
|---|---|
| Add semantics (step 2 keeps `a@`, `b@`) | Actions carry the new addresses only; the skip rule prevents duplicates |
| Replace semantics, step 3 keeps every address, event strings exact | Actions carry the draft list as received plus the new addresses |
| Replace semantics and any address lost or altered in step 3 or 5 | Recipient actions only for fields empty in the draft; for a filled field the card lists "Add by hand: <address>" |
| Recipient actions do not combine with body and subject (build throws or Gmail ignores them) | Fallback F1: Insert sends body and subject; the preview card gets a second button "Add recipients" whose callback sends only the recipient actions in its own response; if those do not combine either, one button per field |
| Actions ignored in a reply (step 5) | Card lists "Add by hand: <address>" when the draft's To is filled; owner informed |
| Any permission prompt (step 7) | Stop D26 work. Report the scope to the owner. No manifest change without approval |
| Two chips in step 4 | Skip rule stays (it is built anyway); no change |

Result (owner run, dev-ec0ccb2, compose toolbar, 2026-11-10): step 1 all 5 applied, Bcc line opened; step 2 replace (typed To and Cc gone); step 3 all 5 addresses once; step 4 one chip, a response with only a recipient action works; step 5 reply kept its To and gained Cc and Bcc; step 6 forward To filled; step 8 each list is a JSON array of bare addresses in `draftMetadata`, and `gmail` repeats only the non-empty lists. Step 7 not run. Build: row 2 of the table above. The two earlier runs (dev-c1c7f16, dev-ec0ccb2) came from the side panel and changed no draft.

### 14.2 Spike S7: side-panel compose actions (D27)

Setup: dev build with a harness on the panel home card and the contextual trigger `unconditional` added to the manifest (scope list unchanged). Template "S7" with subject "S7 test", a body with bold text, a list, a link and one `https` image, To `s7-to@`, Cc `s7-cc@`, Bcc `s7-bcc@` (three real test addresses of the domain; nothing is sent). Harness buttons: "New email", "Reply", "Reply all" (each a compose action), and "Notify" (a compose-action button whose callback returns a notification). The harness card shows the event keys and whether `gmail.messageId` is present; it logs names and counts only. One Gmail session on Gmail web, about 30 min; discard every draft.

| Step | Setup | Action | Record |
|---|---|---|---|
| 1 | Account with a fresh consent (or after "Remove access"), panel open, inbox, no message open | Open the add-on, then "New email" | any consent or permission prompt and the scopes it names; error text if `createDraft` asks for `mail.google.com` |
| 2 | Inbox, no message open | "New email" | compose window opens (y/n); body HTML kept (bold, list, link, image); subject "S7 test"; To, Cc, Bcc set; callback ms |
| 3 | Open a received message (panel open) | Read the harness card; "Reply" | `onMessageOpen` called (y/n); `gmail.messageId` present; reply opens in the thread; To = sender; subject "Re: ..."; Cc and Bcc added; quoted earlier message present (y/n) |
| 4 | Message with To and Cc of several people | "Reply all" with `cc: s7-cc@` | original Cc kept and `s7-cc@` added (add) or original Cc gone (replace) |
| 5 | Steps 2 and 3 | none | Gmail signature in the draft (y/n), with a default signature set in Gmail settings |
| 6 | Inbox | "Notify" | notification shown and no draft (y/n); or an error |
| 7 | A compose window already open with typed text | "New email", then "Reply" | second window opens (y/n); typed text in the first window unchanged |
| 8 | Close the new compose window without sending | none | draft left in Drafts (y/n) |
| 9 | Panel card with one text input and a compose-action button (added 2026-11-11, D31) | Type a value, press the button | the callback event holds the value in its form inputs (y/n). No: the panel details card shows no inputs and blank fields are removed |

Decision table:

| Result | Build |
|---|---|
| All pass, no prompt | ADR-0007 as written |
| Step 1 prompt names a scope outside the 10, or `createDraft` needs `mail.google.com` | Stop the panel insert. Ship the hint (option d) and no panel action buttons. Report the scope to the owner (Q44); no manifest change without approval |
| Step 1 prompt only for the contextual trigger (for example `message.readonly`) | Remove the contextual trigger; ship "New email" only; owner decides on the scope (Q40) |
| Step 2 fails from the homepage but step 3 works | Panel offers Reply and Reply all only; inbox state shows the hint |
| Step 2 HTML altered (list, image, link lost) | Record which parts; same limit as compose if it matches spike S4, else the preview card states the lost part |
| Step 4 replace semantics | Reply all passes the original To and Cc (minus the user, read with `getTo`, `getCc`) plus the template Cc (Q45) |
| Step 5 signature added by Gmail | Drop the signature line from the card |
| Step 6 notification fails | Prompt card fallback: "Check" then a confirm card (ADR-0007 section 3) |
| Step 7 first window changed | The add-on cannot detect an open compose window. Owner informed; the quick start warns |
| Step 8 draft left in Drafts | Expected Gmail behavior; quick start says so |

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
| Q32 (D26) | Admin switch for outside recipients: in-app admin setting in v1, or v1.1 | Closed 2026-11-10 by D29: in-app in v1 with the personal templates switch (ADR-0008, slice 11). Superseded earlier recommendation: v1.1, with v1 on Script Property `RECIPIENTS_EXTERNAL` (`allow` default, `deny`), set by the owner, shown read only in the Config tab: 0 extra calls, about 1 h of build. The in-app setting needs an op, a policy row, an audit event and tests (about half a day) and is audited (ADR-0006 section 2) |
| Q33 (D26) | Recipient limits | 10 per field, 20 together, 254 characters per address. Gmail's own limits are far above; templates route to a few role addresses |
| Q34 (D26) | Placeholders in recipient fields | None in v1. A placeholder resolves after the server's validation, so syntax and `deny` would no longer be enforced server-side; `{{ask:...}}` equals typing in Gmail |
| Q35 (D26) | Template To in a reply or a draft with a typed To | Not added; the card lists it as "Not added". No override button in v1 (the preview card would need up to 4 Insert buttons). Revisit if users ask |
| Q36 (D26) | Secondary domains and domain aliases count as inside? | Only `DOMAIN` is inside in v1. If Migway uses more domains (D7 facts), add a comma list property `RECIPIENT_DOMAINS` defaulting to `DOMAIN`; no Directory domain scope |
| Q37 (D26) | Recipients in private folders (D11) | Allowed. The owner of the folder could type the same addresses; the same validation and switch apply |
| Q38 (D26) | Check that an address exists | No. `safety@` is probably a group; a check needs Directory group reads per address; a wrong internal address bounces back to the sender |
| Q39 (D26) | Search by address | Web app library only, local part or full address prefix, weight 1, the caller's visible templates. Sidebar search unchanged |
| Q40 (D27) | Add a contextual trigger (`unconditional`) so the side panel knows the open message and offers Reply | Yes, if spike S7 shows no consent prompt. It costs one execution per message opened with the panel open; the view cache avoids a server call |
| Q41 (D27) | Gmail signature in drafts made from the side panel | Not added in v1; the card says so. Reading it needs a restricted scope (`gmail.settings.basic` or `gmail.readonly`); signatures as templates are v2 |
| Q42 (D27) | Row button with a message open: "Reply" or "Reply all" | "Reply"; "Reply all" and "New email" on the preview card. Matches Gmail's own default |
| Q43 (D27) | A panel draft the user discards still counts as a use | Accept, as for a cancelled prompt card (Q14) |
| Q44 (D27) | If S7 shows `createDraft` needs `https://mail.google.com/` | Do not add it: full mailbox access, banned by the build. Ship the hint only; a copy page in the web app (option c) is a v1.1 item if the owner wants it |
| Q45 (D27) | Reply all if `options.cc` replaces Gmail's copied Cc | Pass the merged list (original To and Cc minus the user, plus template Cc), read with the metadata scope; addresses never logged |
| Q46 (D27) | Forward from the side panel | Not in v1. `ComposedEmailType` has no forward type [A31]; forward from Gmail and use the toolbar |
| Q47 (D29) | Dev reads as `off` after the slice 11 deploy (no settings stored), so the owner and pilot users lose personal creation on dev | Accept. The owner turns it on in Config > Settings if the pilot needs it; prod starts `off` as D29 says |
| Q48 (D29) | While off, owners cannot delete or move their own personal templates, and admins drop to `use` on private folders (one level rule) | Accept. An admin who must clean up or promote a personal template turns the switch on, does the work, turns it off; both changes are audited. The alternative (admins keep `manage`, 7 per-op target checks) costs more code and tests |
| Q49 (D29) | A third setting now (candidates: `IMG_HOSTS`, `LOG_LEVEL`, admin group) | No. `IMG_HOSTS` and `ADMIN_GROUP` are security config and stay owner-set in Script Properties; `LOG_LEVEL` is for the owner. A new setting is one row in the fixed list when asked |
| Q50 (D29) | `RECIPIENTS_EXTERNAL` set on dev before slice 11 is ignored afterwards | No fallback code (built: no code reads the property). The slice 11 smoke checks the dev property; the owner deletes it and sets the value in Config > Settings if it was `deny` |
| Q53 (slice 13) | A switch to `deny` during an import (between the first check and the lock) refuses the whole file; the normal `deny` path drops the address and imports | Accept. The race needs an admin to flip the switch during another admin's import; nothing is written and the text says to run it again, which then drops the address |
| Q54 (slice 9) | `rh` covers the template lists, not each draft field's known or unknown state. A card built with Cc unknown, tapped with Cc known, adds the Cc address the card listed under "Add by hand" | Accept. The address was shown on the card and no draft address is lost. Adding the state to `rh` costs one more card re-render in a case the owner's Gmail runs never produced |
| Q55 (S6) | Spike S6 step 7: a fresh consent run with recipient actions | Owner runs it by hand before prod (about 5 min, "Remove access" then Insert of a template with recipients). A prompt naming a scope outside the 10 stops D26 until the owner approves |
| Q51 (D29) | "Off" hides existing personal templates entirely (option 1) instead of read and insert (option 2) | Option 2. The owner's words name creation; hiding loses users their own texts and breaks favorites and Recent silently. Flip is one value in the rule (`none` for `use`) if the owner wants it |
| Q52 (D29) | Users are told that admins can turn personal templates off | Yes, one sentence in the quick start next to the D18 disclosure |
| Q56 (D31) | Row hint: counts per field ("Adds Cc 1, Bcc 1") or the addresses | Counts. Addresses need a server change and put addresses in the add-on cache, and 2 addresses do not fit one label line. The draft shows the addresses after the insert |
| Q57 (D31) | One click also for a template with a Bcc or an outside address | Yes. Editors set them on purpose, Gmail opens the Bcc line on insert, nothing is sent until Send. Admins who want no outside address set "Outside recipients" to migway.com only |
| Q58 (D31) | Footer "Open library" on the compose card | Keep it, slate filled (API rule) plus the manifest button color; the add-on menu also has "Open library" |
| Q59 (D31) | Search hint under the input | Drop it. The no-match text and the quick start name `folder:` and `tag:` |
| Q60 (D31) | Row label order | Recipient hint first, then fields, then folder path, so a cut label keeps the disclosure. Slice 12 order (path first) if the smoke shows labels wrap |
| Q61 (D31) | Opening the details card no longer counts a use; only Insert counts (changes Q14 for the card) | Accept. Usage then counts inserts, which is what Recent and the Usage tab mean |
| Q62 (D32) | Cap on the in-app Admins list | 20. Admins see every shared folder and the audit; a longer list is a group, which belongs in `ADMIN_GROUP` |
| Q63 (D32) | May an admin remove themself | No. The server refuses and the UI hides the button; another admin removes them. Prevents a one-click loss of access mid-task |
| Q64 (D32) | Check that an added address is a real account | Yes, with the Directory read the app already has (no new scope). A typo in a privilege grant would give admin to whoever gets that address later; recipients keep no check (Q38) |
| Q65 (D32) | Any admin may remove any in-app admin, including the one who added them | Yes, one admin level. The owner's `ADMIN_EMAILS` and the group stay out of the app's reach, so recovery always has an admin |
| Q66 (D32) | Tell the added person by email | No. Sending mail needs a Gmail send scope (new consent). The adder tells them; the Audit log records it |
| Q31 | A damaged live `index.json` blocks every op, `backup.restore` included | Owner-run editor function `restoreBackup(date)` with the `setup()` guard, before 2.5b if possible; until then the manual runbook of section 16 |

## 16. Operations and maintenance

Target (BRIEF 1 Operations): the only recurring human task is deploying a new version. Details in ADR-0003 Part B (triggers) and ADR-0005 (Maintenance).

Settings (D29, section 5.8): `setup()` writes none. A fresh install reads the defaults: personal templates `off`, outside recipients `allow`. A second `setup()` run never resets an admin's choice.

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
- The live `settings` object is kept, like `pendingAudit` (D29, ADR-0008). The event `after` says so: `liveSettingsKept: true`.
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
- [A25] https://developers.google.com/apps-script/reference/card-service/update-draft-to-recipients-action, [A26] .../update-draft-cc-recipients-action, [A27] .../update-draft-bcc-recipients-action (`addUpdate<Field>Recipients(String[])`, "the ... recipients to insert to the email draft"; add or replace, scope and limits not stated), [A28] https://developers.google.com/apps-script/reference/add-ons-response-service/update-draft-action-response-builder (same setters plus `setSendStatus`), read 2026-11-10. Details in ADR-0006.
- [A29] to [A39] (side panel, D27): compose actions guide, ComposeActionResponseBuilder, ComposedEmailType, GmailApp, GmailMessage, workspace scopes, message UI guide, homepages, Gmail manifest, sendAs.get, Card Service class list; URLs and findings in ADR-0007, read 2026-11-10.
- [A40] to [A44] (D31): FixedFooter, TextButtonStyle, add-on manifest `layoutProperties`, DecoratedText, ActionResponseBuilder; URLs and findings in ADR-0009, read 2026-11-11.
- [A16] https://developers.google.com/workspace/gmail/api/auth/scopes (`gmail.addons.current.action.compose` "Manage drafts and send emails when you interact with the Google Workspace add-on", non-sensitive), read 2026-11-10.
