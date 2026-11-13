# Migway Gmail Templates: specification v1

Status: Accepted at G2 2026-11-09. Errata and D21 (template subject) amendment 2026-11-10: Proposed until the owner approves. Errata run 2 (2026-11-10): D24 subject rule, slices 5b, 5c, 6a, 6b, built ops, log `draft` object; Proposed until the owner approves. Errata run 3 (2026-11-10): slices 6a and 6b as built (sections 4.5, 5.1, 5.2, 5.5, 6, 11.1, 13, 16), owner handover (section 16, ADR-0002 Amendment 2026-11-10); Proposed until the owner approves. D26 run (2026-11-10): template recipients To, Cc, Bcc (sections 2, 4.1, 4.2, 4.5, 5.3, 5.5, 5.7, 6, 7.1, 9, 11, 13.6, 14.1, 15; ADR-0006); Proposed until the owner approves. D27 run (2026-11-10): side-panel insert (sections 2, 3, 4.1a, 7.2, 9, 11, 13.7, 14.2, 15; ADR-0007); Proposed until the owner approves. D29 run (2026-11-10): in-app admin settings, personal templates switch, outside recipients switch moved in-app (sections 2, 5.1, 5.5, 5.6 Script Properties, 5.7, 5.8, 6, 7, 7.1, 7.3, 11.1, 13.8, 15, 16; ADR-0008); Proposed until the owner approves. Errata run 4 (2026-11-11): slices 8a to 8d and 9 to 13 as built at 6374b7b (sections 4.1, 4.1a, 4.4, 4.5, 5.6, 5.7, 5.8, 6, 7, 7.1, 7.2, 7.3, 8, 11, 11.1, 13, 14, 15, 16); section 5.8 follows ADR-0008, Accepted 2026-11-11; the rest Proposed until the owner approves. D31 run (2026-11-11): one-click insert for every template and the details card (sections 4, 4.1, 4.1a, 5.6, 5.7, 7, 7.1, 7.2, 7.4, 13, 13.4, 13.9, 14.2, 15; ADR-0009, Amendments 2026-11-11 in ADR-0004 and ADR-0006, note in ADR-0007); Accepted 2026-11-11 (owner decision D31, built in slice 15). D32 run (2026-11-11): in-app admin list (sections 2, 5.8, 6, 7.3, 11.1, 13, 13.10, 15; ADR-0003 and ADR-0008 Amendments 2026-11-11); Accepted 2026-11-11 (owner decision D32, built in slice 16). Errata run 5 (2026-11-11): slices 14 to 19 and D33 as built at 16df87a (sections 2, 4, 4.1, 4.1a, 4.5, 5.6, 5.7, 5.8, 6, 7, 7.1, 7.2, 7.3, 7.4, 8, 13, 14, 15, 16); Proposed until the owner approves. Errata run 6 (2026-11-12): slices 20a, 20b, 21, 22 with follow-up 1 as built at 8e82a07, slice 23 in review, the owner's dev tests of 2026-11-11 (sections 4.1a, 4.3, 4.4, 4.5, 6, 7, 7.1, 7.2, 7.3, 7.4, 8, 9, 13, 14, 15); the card look of D34, D35 and D36 is Accepted (owner decisions, built); the rest Proposed until the owner approves. D38 run (2026-11-12): date fields (section 5.9, Q85 to Q90; ADR-0004 Amendment 2026-11-12 "date fields"); Proposed until the owner approves. D39 run (2026-11-12, proposal): choice fields (section 5.10, Q91 to Q97; ADR-0004 Amendment 2026-11-12 "choice fields"); Proposed. Errata run 7 (2026-11-12): slices 23 to 26 as built at 78e3317; sections 5.9 and 5.10 and the three ADR-0004 amendments of 2026-11-12 Accepted (owner decisions D38, D39, D40, Q78, Q91); sections 7, 8, 13, 15 updated. D41 run (2026-11-13): extension surface, requests SR1 to SR4 and SF2 (sections 5.7, 5.11, 6, 11, 13, 13.12, 15; ADR-0010; Amendments 2026-11-13 in ADR-0003 and ADR-0006); Proposed until the owner approves.
Date: 2026-11-09, amended 2026-11-10, 2026-11-11, 2026-11-12 and 2026-11-13
Author: architect. Owner: thomas@migway.com.
Inputs: docs/BRIEF.md, PLAN.md (D1 to D41), docs/research/*.md, ADR-0001 to ADR-0010.

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
    Folders and access | Groups | Audit log | Usage | Export and import | Settings and backups (2 admin switches and the Admins list (D32); technical details, background jobs and backups read only). Tab names since slice 14.
```

Two entry points (D27, ADR-0007). The compose toolbar changes the draft being written (`UpdateDraftActionResponse`, insert at the cursor). The side panel cannot reach that draft: it creates a new draft or a reply with compose actions (`ComposeActionResponse`), which Gmail opens in a compose window. `entryOf(event)` decides the entry (`compose`, `message`, `inbox`) in one place.

Private folders (D18, amended 2026-11-10). The library shows admins every private folder. The sidebar does not: `sidebar.home` filters other users' private folders out for admins too, in the handler (`visibleFolders`). The filter grants nothing and hides nothing an admin can reach in the library.

Personal templates switch (D29, ADR-0008, added 2026-11-10). Admins turn personal templates on or off in Admin, "Settings and backups" tab; default off. While off, no private folder is created and existing private folders are read and insert only, for their owner and for admins (section 5.8).

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
| 2 | Sidebar details card (D31; replaced the preview and prompt cards in slice 15) | docs/wireframes/02-sidebar-prompt.txt | 4 (subject in 5); 15; side panel 18 |
| 3 | Web app library | docs/wireframes/03-web-library.txt | 3 (search, favorites in 5) |
| 4 | Web app editor | docs/wireframes/04-web-editor.txt | 3 (subject field in 5) |
| 5 | Web app history | docs/wireframes/05-web-history.txt | 3 (subject line in 5) |
| 6 | Admin | docs/wireframes/06-web-admin.txt | 6a (shell, Folders and access, Groups), 6b (other tabs); tab names since slice 14 |
| 7 | States | docs/wireframes/07-states.txt | 3, 4, 6 |

### 4.1 Flow: apply a template (DoD 1)

1. User opens compose, opens the add-on. Compose trigger reads the add-on User Cache `view:*`; on miss it calls server op `sidebar.home`.
2. Server returns Favorites (max 10), Recent (max 5, from `usage`), top-level folders the caller can `use`, and the caller's filtered list for caching.
3. User taps Insert on a template. The callback calls server op `template.apply` with `{ id, knownVersion, recipientEmailIfInternal }`. The server re-checks `use`, returns body and subject (if version changed), `to`, `cc`, `bcc` and `blocked` (every call, section 5.7), sender profile, internal recipient first name, and buffers the apply event.
4. As built since slice 15 (D31, section 7.4): every row "Insert" inserts in one click, templates with fields and recipients included. A field without a value takes its default text, else it is removed with the 4 gap rules. The row checks its recipient counts (`rc`) against the apply result; a difference opens the details card and inserts nothing.
5. The add-on returns one `UpdateDraftActionResponse`: `UpdateDraftBodyAction` (`IN_PLACE_INSERT`, `MUTABLE_HTML`), `UpdateDraftSubjectAction` when the subject rule of section 5.6 (D24) says so, and one recipient action per field with new addresses, each carrying the draft's list plus the new addresses (spike S6, section 5.7). Verified on Gmail web: spike S5 on dev-32a446c, smoke "Slice 5c" on dev-848206f, test round 1 part B on dev-56bf795. The compose card closes after the insert (S6 step 0; test round 1 part B steps 1 and 3).
6. A row tap opens the details card (`template.apply` `followUp: true`, no apply event). Its Insert calls `template.apply` once without `followUp`; a re-rendered card carries `counted=1` and sends `followUp: true`, so one path counts once. A grant removed while the card is open gives DENIED and leaves the draft unchanged.
7. Usage counts one apply event per Insert path. Opening the details card counts nothing (Q61).

### 4.1a Flow: apply from the side panel (D27, added 2026-11-10, rewritten 2026-11-11 after spike S7)

Mechanism: ADR-0007, Accepted 2026-11-11, section "Acceptance 2026-11-11" (A1 to A10). Facts: docs/spikes/slice-10-s7.md. Built in slice 18 (section 13.11) with follow-up 1 (failures raise one sentence) and follow-up 2 (D33, "Reply all" on rows); test round 1 part J on dev-5065ba1: 11 of 12 steps pass. Built before it (slices 10 and 12): `entryOf`, the contextual trigger `unconditional` with `onMessageOpen`, panel cards without Insert, `sidePanelHint`, `ButtonSpec.compose`.

1. The user opens Migway Templates from Gmail's right side panel. No message open: `onHomepage`. A message open: `onMessageOpen` (event with `gmail.messageId`, S7 result 2). Both call `homeFlow` with the cached view `view:*`.
2. `entryOf(event)`: `compose` when `draftMetadata` is present, `message` when a message ID is present, else `inbox`. Every callback derives it from its own event.
3. Rows (home, folder, search). `inbox`: one `FILLED` slate button "New email" (`STANDALONE_DRAFT`) in the row. `message` (D33, slice 18 follow-up 2): the row has no button; a `ButtonSet` right under it holds "Reply" (`FILLED` slate) and "Reply all" (`OUTLINED`), both `REPLY_AS_DRAFT`, so a row is 2 widgets. Action `onCompose` with `id`, `as` (`new`, `reply` or `replyAll`) and `rc` as compose rows. A list section collapses after 5 whole rows. The row tap opens the details card (`onPreview`).
4. Details card: `template.apply` `followUp: true` (no apply event). Inputs as compose, "Add recipients" switch, no subject switch, signature line, footer per section 7.2. Its buttons call `onPromptCompose` with `id`, `as` (`new`, `reply`, `replyAll`), `version`, `values`, `rh`.
5. `onCompose` and `onPromptCompose`, in order: `as` in the fixed list; Reply and Reply all need a message ID in the event; a details press checks every box for 500 characters; `GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken)`; Reply and Reply all read the message (`getMessageById`, `getReplyTo`, `getFrom`; Reply all also `getTo`, `getCc`); one `template.apply` without `followUp`, with `recipientEmailIfInternal` = the reply address when internal (Reply only), else ""; the `rc` check (row) or the `version` and `rh` checks (details); render body and subject as compose (section 7.4: typed value, value, default text, else removed); recipients by section 5.7 against the computed draft (ADR-0007 A4).
6. Gmail call: New email `GmailApp.createDraft(to, subject, "", { htmlBody, cc, bcc })`; Reply `message.createDraftReply("", { htmlBody, cc, bcc })`; Reply all `message.createDraftReplyAll("", { htmlBody, cc, bcc })`. `cc` and `bcc` only when not empty; replies get no `subject` option and no To. Return `ComposeActionResponse` with `setGmailDraft(draft)`; Gmail opens the draft (a new window, or an inline reply in the conversation). Gmail puts the user's signature below the text of a reply and none into a new email (test round 1, part G and part J).
7. Every refusal or failure throws an `Error` whose message is one plain sentence of section 7.2 (`panelAnswer`, slice 18 follow-up 1). A notification returned by a compose-action callback is not shown in Gmail (part J step 11), so no callback returns one. No state card, no navigation, no request ID, no technical message. Gmail shows the thrown sentence in its own error card (owner's test on dev, 2026-11-11, Q75 closed): "Error with the add-on. Run time error." then the sentence, then "[line: n, function: panelAnswer, file: Code]". Accepted as is: a compose-action button takes only a draft as its answer, so no other way exists to show the sentence.
8. Usage: one apply event per press that reaches `template.apply` (Q43). Logs: the `draft` object as today; no new key (Q67).
9. The panel never changes a draft that is already open. The hint at the end of the cards says where to do that (section 7.2).

### 4.2 Flow: edit and restore (DoD 2)

1. Editor opens from the library or from the sidebar Edit button (OVERLAY, RELOAD_ADD_ON).
2. Save sends `{ id, baseVersion, title, subject, to, cc, bcc, folderId, tags, html }`. `to`, `cc`, `bcc` are string arrays. Server sanitizes, validates placeholders, the subject (section 5.6) and the recipients (section 5.7), writes the version (ADR-0002 write sequence). Conflict shows the dialog "This template changed": "<name> saved version <n> at <time> while you edited." Buttons "Open their version", "Copy my text", "Cancel". No silent overwrite.
3. History lists versions with their subject and recipients. Restore creates version N+1 from subject, recipients and body of version K, validates them (section 5.7) and writes an audit row.

### 4.3 Flow: grant access (DoD 3)

1. Admin opens Admin, tab "Folders and access", selects a folder, and fills "Give access": type, "Give access to" (group email, user email, domain; OU marked inactive in v1), access (use, edit, manage). The server stores one record in `grants`; the screen lists it under "Who has access" (screen words since slice 14, docs/design/wording.md; errata run 6).
2. Server validates the group exists via the resolver, writes `grants`, adds the group to the refresh set, refreshes its snapshot under lock, writes audit.
3. A user outside the group calls `folder.list` or `template.get`: server returns no rows or `DENIED`. Unit test and manual smoke step cover it.

### 4.4 Flow: search

- Sidebar: search input with `onChangeAction` (Enter or leaving the box), and an outlined "Search" button with the `search` icon, screen reader "Search templates", on the same `onSearch` callback (D36, slice 22). In the compose popup the box and the button share one row (Card Service Columns, slice 22 follow-up 1; owner saw it render on dev 2026-11-11); in the side panel they are stacked, and a popup row that cannot be built falls back to stacked. A press of "Search" right after typing can run `onSearch` twice (the box loses focus, then the button fires): 2 read-only server calls, the same results card drawn twice, nothing written (Q79). Server op `search` returns the top 20 visible matches. Operators `folder:<name>` and `tag:<name>`. Empty query shows Home, with no server call. The sidebar matches title, subject, tags, folder path and the 140-character `snippet` of the index item. It never reads full body text (amended 2026-11-10, slice 5 review minor 1).
- Web app: title, subject, folder path and tag filtering runs in the browser on the loaded index. Full body text is searched in the web app only: server op `search.body` runs 300 ms after the last keystroke, reads Script Cache entries `ft:<bodyFileId>` with one `getAll`, and makes at most 25 Drive reads per call for misses. The rest are reported as `skipped` ("N templates were not searched yet."). Results not already listed show under "Matches in text". While the call runs the list shows "Searching text...". Sort: relevance, then the caller's Recent position, then title.
- Recipients (D26, built in slice 13): the web app browser filter also matches template To, Cc and Bcc addresses, weight 1, on the local part prefix or the full address prefix; a domain alone matches nothing. The sidebar `search` op does not match addresses (section 5.7).
- Matching: case-insensitive, accent-insensitive token prefix match on title (weight 3), subject (2, D21), tags (2), folder (2), body text (1: the snippet in the sidebar, the full text in `search.body`). Every term must match. Query cut at 200 characters. Both ops filter to the caller's visible templates before ranking. Fuzzy tolerance: one typo for terms of 5 or more characters, at half weight.

### 4.5 Flow: export and import

Amended 2026-11-10 (errata run 3) to match slice 6b. File format and mechanism: ADR-0002 Amendment 2026-11-10 (errata run 3).

- File: JSON, `schemaVersion` 1: header (`exportedAt`, `exportedBy`, `scope`), `folders` (`id, parentId, name`), `grants` (`folderId, principalType, principalKey, level`), `items` (`meta: { id, folderId, title, subject, to, cc, bcc, tags }`, `html`; `to`, `cc`, `bcc` added 2026-11-10, D26, absent = `[]`). Live templates, current version only. No history, favorites, usage, audit or `createdBy`.
- Export folder (manage): the folder and its live subtree, grants on those folders only. Export library (admin): every shared folder; private folders and their templates are left out (D11), label "Whole library (shared folders)".
- Start (slice 13): the export begins with one call `start: true`. It commits one audit event `export.library` or `export.folder` through `commit` (lock, admin re-check, index write): actor, `targetId` (folder ID or ""), `targetPath` (folder only), `after: { scope, templates }`, no title, subject, body or address. Then it stores a run token as Script Cache `exp:<token>` with `{ actor, kind, folderId }` for 600 s (`EXPORT_RUN_TTL_S`) and answers `{ token, total }`. Lock busy answers BUSY, a Drive failure INTERNAL; both leave no token.
- Retried start (slice 13, one lock since slice 20a): the start call carries `run`, a key the browser makes once per export click in the request ID form `XXXXXXXX-XXXXXX` (`requestIdNow`). The server keeps Script Cache `exps:<run>` with `{ actor, kind, folderId, token, total }` for 60 s (`EXPORT_RETRY_S`). A start with the same `run`, caller and scope whose token still lives answers the first `{ token, total }` and writes no event. The reuse check, the commit and both cache puts run in one lock (`withLock`, `transfer.ts` `startExport`), so two tries of one click write one event. A `run` that is not a string answers VALIDATION "run: expected a string"; a string in another form, or none, starts a new run. Dispatch checks the caller's level on every try before the handler. A retry that finds `exps:` while the lock is held answers BUSY; the web client retries BUSY (slice 20a re-review minor C).
- Paging: each page call carries the token and returns at most 20 templates, so it reads at most 20 bodies (Script Cache hit used, a miss read from Drive and not cached). Pages use an offset. A token that is missing, malformed, expired, evicted, or of another caller or scope answers VALIDATION "This export ran out of time or was started in another window. Start the export again." before any body is read. Each accepted page extends the token by 600 s. The dispatch permission check runs first on every call. The web app retries a retryable error 3 times (after 200, 400, 600 ms), then stops with "The export stopped after <done> of <total> templates: the server did not answer after 4 tries. No file was downloaded, so wait a few minutes and export again." A server error answer shows "The export stopped after <done> of <total> templates and no file was downloaded." and the server's own message; a failed start shows "The export did not start and no file was downloaded." (slice 14) The browser joins the pages into `migway-templates-<scope>-<date>.json` (`library` or the folder name, local date) and downloads only after the last page.
- Audit tab rows: "Library export started, 25 templates", "Folder export started: Sales / Quotes, 12 templates". The event records the start; an abandoned export keeps its event.
- Import (admin): choose a file and a folder under "Import into", then "Check file", then "Import". "Check file" writes nothing. Limits checked on the server before any write: 5 MB, 200 templates, 100 folders, `schemaVersion` exactly 1, no duplicate folder `id`.
- Target: a shared folder. A folder in a private tree answers VALIDATION 'Templates cannot be imported into "My templates". Pick a shared folder.'
- Import creates shared folders only and reuses a folder whose name a live sibling has. It creates no grants: the file's grants are information for the admin. Templates get new IDs. A template whose title already exists in its destination folder is skipped, so a second import adds nothing.
- Bodies pass the sanitizer and placeholder checks; subjects follow section 5.6; recipients follow section 5.7 (bad addresses dropped and reported, too many refuses the file). A failure answers "Nothing was imported because <what>. Run the import again."
- Report: templates created, skipped, failed; folders created and reused; subjects flattened; one line per skipped or failed record.
- Import is not an owner-change path: section 16, Owner handover.

## 5. Data model

JSON files in one private Drive folder (ADR-0002). `index.json` holds the `folders`, `grants` and `items` arrays below; side files hold favorites, usage and the membership snapshot. IDs are 26-character time-sortable strings (Crockford base 32: 10 time characters, then 16 random ones; since slice 20a the random part comes from SHA-256 of `Utilities.getUuid()`, where it used `Math.random`; format and `isId` unchanged, so old IDs stay valid). Times are ISO 8601 UTC. Every mutable record carries `version`; `index.json` carries `rev`. Tables below list record fields.

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
- Save validation (server, every write: create, update, duplicate, restore, import). Codes carry `field: "subject"` and the character offset: `SUBJ_TOO_LONG` ("The subject must be 200 characters or fewer."), `SUBJ_LINEBREAK` ("The subject must be one line (at character <n>)."), and the ADR-0004 `PH_*` codes except `PH_ATTR` and `PH_BACKSLASH`. Import replaces line breaks with one space and reports the count; it rejects only `SUBJ_TOO_LONG` and `PH_*`.
- Apply: `template.apply` and `template.getBody` return `subject` with the body (same `knownVersion` rule). The add-on caches it in `body:<id>` next to the HTML.
- Draft (D24, amended 2026-11-10; replaces the D21 rule "a non-empty rendered subject replaces whatever the draft subject holds"). The Gmail compose event carries `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients` and `subject`. It never carries `threadId` or `messageId` (smoke "Slice 5b", dev-4a233d4) [A13]. The add-on reads the draft subject from the event of the Insert callback (`draftHasSubject`): only a string with a non-space character counts as filled. The template subject is set only when the draft subject is empty or whitespace. A typed, reply or forward subject is kept, so a reply stays in its conversation. Rules per Insert path:

  | Insert path | Draft subject empty | Draft subject filled |
  |---|---|---|
  | One-click Insert (lists), preview Insert | sets it | keeps it |
  | Preview "Insert with subject" (shown when the draft has a subject) | sets it | replaces it |
  | Preview "Insert body only" (shown when the draft subject is empty; D26: also when Insert adds an address, and it adds none, section 5.7) | keeps it | keeps it |
  | Prompt card switch "Replace the subject" | starts on, user decides | starts off, user decides |

  As built since slice 15 (D31); the table above records slices 5 to 14:

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
- Outside addresses: allowed by default (D26 update). Outside = domain part differs from Script Property `DOMAIN` (exact, case-insensitive; subdomains are outside; secondary domains Q36). Admin setting `recipientsExternal`: `allow` (default, also when absent) or `deny`, set by an admin in Admin, "Settings and backups" tab (D29, section 5.8). Built: slice 11 reads `settings.recipientsExternal` from the request's index; Script Property `RECIPIENTS_EXTERNAL` is no longer read.
- Save validation (server, every write: create, update, duplicate, restore, import; not move). Codes carry `field` (`to`, `cc`, `bcc`) and `position` (1-based). Texts in section 7.1: `RCPT_FORMAT`, `RCPT_TOO_LONG`, `RCPT_TOO_MANY`, `RCPT_DUPLICATE` (one address in two fields), `RCPT_EXTERNAL` (`deny` only). No existence check (Q38).
- In-lock re-check (slice 13): `recheckRecipients` runs inside the lock on create, duplicate, update, version restore and import against the fresh index. A switch to `deny` between the first check and the lock gives the save's own VALIDATION with `RCPT_EXTERNAL`. On import it refuses the whole file: 'Nothing was imported. The setting "Outside recipients" changed during the import. Run the import again.' (Q53, text since slice 14).
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

  As built since slice 15 (D31; the path table above records slices 9 to 14): row Insert adds by the table above in one click, after the `rc` count check; details card switch "Add recipients" starts on, off adds none; a template address in an unknown draft field opens the details card in place of the insert (section 7.4, ADR-0006 Amendment 2026-11-11).

  A field with nothing new sends no action, so it is never rewritten. Recipient actions go in the same `UpdateDraftActionResponse` as body and subject. A recipient action replaces the field (spike S6 step 2), so each action carries the draft's list from the tap's event as received, then the new addresses. Never `setSendStatus`.
- Disclosure. [D31, built in slice 15: one-click rows disclose by the row hint before and the draft's fields after; the row carries `rc` in place of a hash; the details card keeps the lines and `rh` below. ADR-0006 Amendment 2026-11-11.] Slices 9 to 14: every address was shown on a card before it reached the draft. Since slice 15 the details card section "Recipients" shows the lines (`recipientWidgets`): each added address on its own line with its field; outside addresses carry "outside <caller domain>"; Bcc lines carry "hidden from other recipients"; markers join with " · ". Not-added addresses carry their reason; unknown fields name the addresses to add by hand; the finish-typing line shows whenever Insert adds an address (texts in section 7.1). The card carries `rh`, the first 16 hex characters of a SHA-256 over the template lists and `blocked` it showed; at Insert, a different hash of the `template.apply` lists leaves the draft unchanged and re-renders the card with the change message. `rh` does not cover the draft's known or unknown state: the plan is rebuilt from the tap's event (Q54). Since slice 15 the details card Insert always carries `rh`. Gmail's own outside-recipient warning is not relied on.
- Limit: an address still being typed in a draft field (not yet a chip) is not in the event, and a replace drops it. The cards and the quick start say so.
- Sidebar lists carry counts only: item field `rc: [to, cc, bcc]`. [D42, owner to confirm, 2026-11-13: `extension.sync` carries the addresses `to`, `cc`, `bcc`, `blocked` of every template the caller may use, and the extension keeps them in its local copy (section 5.11, ADR-0010 Decision 4, ADR-0006 Amendment 2026-11-13). `sidebar.home`, `search` and the add-on keep counts only and the add-on still never caches addresses.] Row label "Adds To 1, Cc 1, Bcc 1" (fields with addresses only), first on the row's one label line, then the fields hint and the folder path, joined by " · " (slice 15).
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
- Admins list (D32, added 2026-11-11, built in slice 16; ADR-0003 and ADR-0008 Amendments 2026-11-11, Accepted 2026-11-11). Optional `index.json` field `admins: [{ email, addedAt, addedBy }]`, absent = `[]`, at most 20. Admin = `ADMIN_EMAILS` or `ADMIN_GROUP` member or in `admins` (trim, lower case, exact). Changed only by `admin.add` and `admin.remove` through `commit`. `appAdminsOf(index)` drops malformed entries, which grant nothing and never fail the index; `indexProblem` accepts any value of `admins` (a non-array reads as `[]`). Every index writer keeps the field. `backup.restore` keeps the live `admins` (event `after` adds `liveAdminsKept: true`). `setup()`, export and import write none. `ADMIN_EMAILS` and `ADMIN_GROUP` stay owner-set Script Properties; no op writes them.

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

### 5.9 Date fields `{{date:Label}}` (D38, added 2026-11-12)

Accepted 2026-11-12 (owner decision D38; built in slice 25, review PASS, merged; owner test on dev-e93a085 passed, see Q86 and Q87). Owner request 2026-11-12, after every test on dev-744bd1d passed: a field type that opens a calendar picker and inserts the date as MM/DD/YYYY. Mechanism, options and platform facts: ADR-0004 Amendment 2026-11-12 "date fields". Texts below as built at e93a085. Still open: Q85, Q87 (other time zones), Q89, Q90.

Grammar:
- `{{date:Label}}` asks the sender for a date. Label rule as `{{ask:Label}}`: 1 to 40 characters after trim, none of `{ } | \ < >` or a line break; spaces after `{{`, after `date:` and before `}}` are allowed. No default text. `\{{date:X}}` is the escape and renders as text.
- One identity per label (`promptKey`: trimmed, inner spaces collapsed, any letter case), shared by subject and body. `{{date:X}}` used twice is one field and one picker.
- Allowed in the subject and in the body.

Save validation (server through `scanBody`; the editor's Problems list runs the same function):

| Code | Trigger | Text |
|---|---|---|
| `PH_FIELD_TYPE` (new) | one identity used as `{{ask:}}` and as `{{date:}}` in one template | 'The field "<label>" is used as <kind> and as <kind> (at character <n>). Rename one of them.' Kinds "text", "a date", "a choice" in template order (slice 26): "used as text and as a date" when the text field comes first, "used as a date and as text" when the date comes first. `<label>` = first spelling, `<n>` = the later token |
| `PH_CASE` | `{{Date:X}}`, `{{DATE:X}}` | "Use lower case: date: (at character <n>)." |
| `PH_FALLBACK_ASK` | `{{date:X\|y}}` | "A field the sender fills in cannot have default text (at character <n>)." (built text, unchanged) |
| `PH_LABEL` | empty or over 40 characters | built text, unchanged |
| `PH_TOO_MANY` | more than 20 fields, text and date together | built text, unchanged |

Editor (wireframe 04):
- "Insert field" menu, body and subject: one new item after "Ask the sender...": "Ask the sender for a date...". It opens the same dialog as "Ask the sender" with title "Ask the sender for a date", label "Field name the sender sees", hint "1 to 40 characters, for example Pickup date. The sender picks a date; it goes in as MM/DD/YYYY." OK inserts the chip (body) or the token text at the caret (subject). The orchestrator's default was a "Text" or "Date" choice inside one dialog; the dialog is `promptText` with one text box (`src/web/ui/dialog.ts`), so a second menu item reuses it unchanged (Q88).
- Chip: class `ph ask date`, visible text the label, then " (date)" in the muted style of " or ". Screen reader: "Field: <label>, a date the sender picks".
- Panel "The sender fills in": the label, then "date, used once" or "date, used <n> times"; text fields keep "used once". Empty panel: "Nothing yet. To add a field the sender fills in, choose Insert field, then Ask the sender or Ask the sender for a date."
- "Preview as me": the date field shows today's date in the browser's local time as MM/DD/YYYY (a sample); text fields keep `[Label]`. History preview: the chip.

Gmail details card (compose popup and side panel, wireframe 02):
- A date field is a `DatePicker` (Card Service, date only) named `p-<n>` with the label as title, in the place and order a text box would take. No hint line. It starts with no date (`setValueInMsSinceEpoch` not called; Q85). The owner saw it in the draft popup and the side panel (dev-e93a085, Q86 yes).
- Kept value (slice 25): the card keeps a picked date as MM/DD/YYYY in `entered` (converted when read) and turns it back into ms for `setValueInMsSinceEpoch` on a re-rendered card. The ADR text named the ms string; the screen result is the same.
- Fallback (slice 25, ADR option 3): when `newDatePicker` is missing or throws, the card draws a text box `p-<n>` titled with the label and the hint "MM/DD/YYYY". It accepts M/D/YYYY or MM/DD/YYYY of a real day (`typedDateMs`); "" leaves the field out. Anything else is refused with "Enter a date as MM/DD/YYYY: <labels>" (compose: an error line on the re-rendered card; side panel: the thrown sentence, after `template.apply`, so it counts one use). A Gmail that refuses the picker while drawing the card cannot be caught.
- Reading (`src/addon/event.ts`): `dateValue` reads `commonEventObject.formInputs["p-<n>"].dateInput.msSinceEpoch` as a number, a numeric string or the first element of an array; missing or not finite: no date. `formValue` tries it first, then the text value; `fieldValue(event, field, name)` sends choice fields to their own reader (section 5.10).
- Conversion (`dateText` in `src/shared/placeholders/date.ts`): round the ms to the nearest whole UTC day, then month, day and year from the UTC getters, as MM/DD/YYYY with leading zeros; a year outside 1000 to 9999 gives no date. Never the script's or the user's time zone. Tests run under the New York and Auckland zones. The owner's pick came back as the same day in the draft (dev-e93a085, the owner's time zone only; Q87). Mechanism and limits: ADR-0004 Amendment 2026-11-12, section 3.
- The 500-character check skips date fields. One picker is one widget, in place of one text box.

Rendering:
- A picked date is the field's value: the text "11/12/2026", escaped like any value.
- No picked date (row Insert, or picker left empty): the field is removed with the 4 gap rules (D31, section 7.4), as an unfilled `{{ask:}}`.
- Row hint: "n fields to fill" counts date fields (`item.prompts` lists every field label). `rc`, `rh` and the recipient rules do not concern fields.
- Add-on text preview and subject preview: `[Label]`, as for text fields.
- Side panel compose actions: the same reading and render; the value reaches `onPromptCompose` (owner test, Q86 yes).

Examples (input, picked date, result; character numbers count from 1):

| # | Input | Action | Result |
|---|---|---|---|
| 1 | Body `Pickup on {{date:Pickup date}}.` | details card, picks 12 Nov 2026 (`msSinceEpoch` 1794441600000) | `Pickup on 11/12/2026.` |
| 2 | Same body | row Insert, no card | `Pickup on.` (gap rule 2) |
| 3 | Subject `Load ready {{date:Pickup date}}` | picks 5 Jan 2027 (1799107200000) | subject `Load ready 01/05/2027` |
| 4 | Body `{{date:Pickup}} and {{date: pickup }}` | one picker; picks 9 Mar 2027 | `03/09/2027 and 03/09/2027` |
| 5 | Body `{{ask:Pickup}} on {{date:Pickup}}` | save | refused: 'The field "Pickup" is used as text and as a date (at character 19). Rename one of them.' |
| 6 | Body `{{Date:Pickup}}` | save | refused: "Use lower case: date: (at character 1)." |
| 7 | Body `{{date:Pickup\|tomorrow}}` | save | refused: "A field the sender fills in cannot have default text (at character 1)." |
| 8 | Body `\{{date:Pickup}}` | save, insert | saves; inserts the text `{{date:Pickup}}`; no picker |
| 9 | `msSinceEpoch` 1794409200000 (local midnight of 12 Nov 2026 at UTC+9) | conversion | `11/12/2026`; at UTC+13 (1794394800000) the result is `11/11/2026` (Q87) |

As built (slice 25, merged; docs/handoffs/2026-11-12-implementer-to-reviewer-slice-25.md, docs/reviews/slice-25.md):
- Files: `src/shared/placeholders/{grammar,validate,render,date}.ts`; `src/addon/{event,prompts,flows,panel}.ts`; `src/addon/cards/{spec,render,details}.ts`; `src/web/editor/{schema,picker}.ts`; `src/web/views/{preview,editor}.ts`. `load.ts`, `serialize.ts`, `styles.css` (`.ph-or` reused) and `src/server` unchanged.
- Editor texts as specified above (menu item, dialog, chip, screen reader name, panel line, empty panel text, "Preview as me" today's local date in body and subject).
- Tests: examples 1 to 9; `date.test.ts` under 2 zones; `dateInput` as number, string, array, empty array, absent; the fallback missing and throwing; side panel picked, empty and wrong typed. 2,055 tests at merge.
- Test round part N (7 steps) holds the Gmail checks. Owner result on dev-e93a085: picker shown in popup and side panel, picked day written, nothing picked leaves the field out.
- Open minors: labels accept control characters such as U+0000 (as `ask:` always did); a pasted `{{date:X}}` stays text until the template is opened again (as `ask:`); part N has no re-render step.

### 5.10 Choice fields `{{choice:Label|A|B}}` (D39, added 2026-11-12)

Accepted 2026-11-12 (owner decision D39 to build; Q91 decided by the owner: an unchosen choice is left out, "so user would have to type in manually, we dont give false options"; built in slice 26, review PASS, merged e93a085; owner test on dev-e93a085 passed, Q92 yes). Owner idea 2026-11-12: a field where the sender picks one of the options the template author set. Mechanism, options and platform facts: ADR-0004 Amendment 2026-11-12 "choice fields". Texts below as built. Still open: Q93, Q96.

Grammar:
- `{{choice:Label|Option 1|Option 2}}`. Label rule as `{{ask:}}` and `{{date:}}` (1 to 40 characters, none of `{ } | \ < >` or a line break). Then 2 to 20 options, each after `|`, each trimmed and inner spaces collapsed, 1 to 100 characters, none of `| { } \ < >` or a line break, no two equal ignoring letter case. The whole token at most 2,200 characters. No default text. Spaces around `|` are allowed and dropped.
- No escape inside a token exists, so `|`, `{` and `}` cannot be part of an option. `\{{choice:...}}` is the text escape and renders as text.
- One identity per label (`promptKey`), shared by subject and body, one kind per identity. The same label twice with the same options: one field, one dropdown.
- Allowed in the subject and in the body.

Save checks (server through `scanBody`; the editor's Problems list runs the same function). `<label>` = first spelling, `<n>` = character of the token:

| Code | Trigger | Text |
|---|---|---|
| `PH_CHOICE` | fewer than 2 options | 'The field "<label>" needs at least 2 options (at character <n>).' |
| `PH_CHOICE` | more than 20 | 'The field "<label>" has <count> options. Use at most 20 (at character <n>).' |
| `PH_CHOICE` | an empty option (`\|\|`, or `\|` at the end) | 'The field "<label>" has an empty option (at character <n>). Remove the extra \|.' |
| `PH_CHOICE` | an option over 100 characters | 'An option of "<label>" is longer than 100 characters (at character <n>).' |
| `PH_CHOICE` | two equal options | 'The field "<label>" lists "<option>" twice (at character <n>).' (`<option>` = first spelling) |
| `PH_CHOICE` | `{ } \ < >` in an option, `{{choice:X}}` with no `\|`, a `}` inside an option, or the token over 2,200 characters (the lenient pass sees `choice:`; slice 26) | 'The field at character <n> is not a valid choice. Options cannot contain { } \| \\ < >, and a field holds at most 20 options of 100 characters.' |
| `PH_CHOICE_MISMATCH` (new) | the same choice label with other options, or another order | 'The field "<label>" lists other options at character <n>. Use the same options, or rename one of them.' |
| `PH_FIELD_TYPE` | one label in two kinds | 'The field "<label>" is used as <kind> and as <kind> (at character <n>). Rename one of them.' with kinds "text", "a date", "a choice", in template order (as built in slice 26; a date before a text field reads "used as a date and as text") |
| `PH_CASE` | `{{Choice:X\|A\|B}}` | "Use lower case: choice: (at character <n>)." |
| `PH_LABEL`, `PH_TOO_MANY` | as today; `PH_TOO_MANY` counts every kind | built texts |

Editor (wireframe 04):
- "Insert field" menu, body and subject: new item after "Ask the sender for a date...": "Ask the sender to choose...". Dialog title "Ask the sender to choose". Fields: "Field name the sender sees" (hint "1 to 40 characters, for example Load status."), "Options, one per line" (a text area; hint "2 to 20 options, each up to 100 characters. The sender picks one; the first is not chosen for them."). Buttons "Insert" and "Cancel". Errors in the dialog, one at a time: "Enter 2 to 20 options, one per line.", "Each option can be up to 100 characters.", "An option cannot contain | { } \ < >.", 'The option "<option>" is listed twice.' Blank lines are dropped.
- On a selected choice chip the menu shows "Edit choices..." (as "Edit default text..." on a variable chip); it opens the same dialog filled in, title "Edit choices", button "Save" (Q94, built in slice 26). It edits the field name and the options (`setOptions(pos, label, options)` in `commands.ts`).
- Chip: class `ph ask choice`, visible text the label, then " (choice)" in the muted style of " or ". Screen reader: "Field: <label>, the sender chooses from <count> options".
- Panel "The sender fills in": the label, then "choice: <option 1>, <option 2>, ..., used once" (options cut to 60 characters with "..."). Empty panel: "Nothing yet. To add a field the sender fills in, choose Insert field, then one of the Ask the sender items."
- "Preview as me": the first option (a sample); history preview: the chip.
- The subject input takes the token text at the caret, as for the other kinds.

Gmail details card (wireframe 02):
- A choice field is a `SelectionInput` of type `DROPDOWN`, field name `p-<n>`, title the label, no hint, in the place and order a text box would take. Items: "Choose..." (value "0", selected), then each option as written in the token (value its position "1" to "20"). A re-rendered card selects the chosen position again.
- Reading (slice 26, `fieldValue` in `src/addon/event.ts`): the dropdown value arrives as a string, a number, an array (its first element) or not at all; `chosenOption` maps "0", "" and none to not chosen, "1" to the option count to that option, anything else ("21", "-1", "1.5", "01", option text, an object) to refused. Fallback: when `newSelectionInput` is missing or throws, a text box `p-<n>-text` titled with the label, hint "One of: A, B, C" (Q92 fallback 2); the trimmed text must equal one option as written ("" = not chosen, other text = refused; inner double spaces are not collapsed, slice 26 minor 5). The `-text` name keeps a typed "2" from reading as position 2. The dropdown wins when both arrive.
- Check in `onPromptInsert` and `onPromptCompose` against the token of the body of the version the same `template.apply` call returned: "0" or nothing = not chosen; an integer 1 to the option count = that option; anything else = refused. Compose: nothing inserted, the card re-renders with the error line "Choose again from the list: <labels>." and those dropdowns reset to "Choose...". Side panel: throws "A choice is not in the template's list. Go back and open it again." The web app server never sees the answer (section 4.1); ADR-0004 Amendment "choice fields" section 4.
- The 500-character check skips choice fields. One dropdown is one widget, in place of one text box: a card with 20 choice fields stays under 100 widgets (slice 26 test). The owner saw the dropdown in the draft popup and the side panel, and the chosen option arrived (dev-e93a085, Q92 yes). A side-panel refusal comes after `template.apply`, so it counts one use.
- The insert is the only enforced limit. The sender can change the word in the draft before sending.

Rendering:
- A chosen option is the field's value: its text, escaped like any value in the body (`formatValue`), plain in the subject.
- Not chosen (row Insert, or "Choose..." left): removed with the 4 gap rules (D31), as an unfilled `{{ask:}}`. Owner decision Q91 (2026-11-12): left out, the first option is never inserted for the sender.
- Row hint "n fields to fill" counts choice fields. Add-on text and subject previews: `[Label]`.

Examples:

| # | Input | Action | Result |
|---|---|---|---|
| 1 | Body `Status: {{choice:Status\|Approved\|Rejected\|On hold}}` | details card, picks "Rejected" (value "2") | `Status: Rejected` |
| 2 | Body `Load is {{choice:Status\|ready\|late}} today.` | row Insert, no card | `Load is today.` (gap rule 1) |
| 3 | Subject `Load {{choice:Status\|ready\|late}}` | picks "late" | subject `Load late` |
| 4 | Body `{{choice:Size\|S\|M\|L}} and {{choice: size \| S \| M \| L }}` | one dropdown, picks "M" | `M and M` |
| 5 | Body `{{choice:Size\|S\|M}} {{choice:Size\|S\|M\|L}}` | save | refused: 'The field "Size" lists other options at character 21. Use the same options, or rename one of them.' |
| 6 | Body `{{choice:Size\|S}}` | save | refused: 'The field "Size" needs at least 2 options (at character 1).' |
| 7 | Body `{{choice:Size\|S\|s}}` | save | refused: 'The field "Size" lists "S" twice (at character 1).' |
| 8 | Body `{{ask:Size}} {{choice:Size\|S\|M}}` | save | refused: 'The field "Size" is used as text and as a choice (at character 14). Rename one of them.' |
| 9 | Body of example 1, event value "7" (forged) | Insert | nothing inserted; card line "Choose again from the list: Status." |
| 10 | Body `Hi & {{choice:Tone\|<b>bold</b>\|plain}}` | save | refused (the `<` in an option: the last `PH_CHOICE` text); the dialog refuses it before |

As built (slice 26, merged e93a085; docs/handoffs/2026-11-12-implementer-to-reviewer-slice-26.md, docs/reviews/slice-26.md):
- Files: `src/shared/placeholders/{grammar,validate,render,choice,skeleton}.ts`; `src/addon/{event,prompts,flows,panel}.ts`; `src/addon/cards/{spec,render,details}.ts`; `src/web/editor/{schema,picker,commands}.ts`; `src/web/ui/dialog.ts` (`promptChoice`); `src/web/views/{preview,editor}.ts`. `src/server` unchanged. `event.ts` changed, where this section first said no change.
- Old bodies: 91 stored bodies give the same segments, renders and scans before and after (`test/fixtures/oldBodies.expected.json`); the reviewer ran 3,102 bodies with 0 differences.
- Tests: examples 1 to 10; the 7 `PH_CHOICE` triggers; 5 value shapes; forged values (reviewer: 13 kinds, 0 drafts); options changed between card and Insert give the version line; 2,118 tests at merge.
- Test round part O (7 steps) holds the Gmail checks.
- Open minors: a typed fallback option with a double space is refused (minor 5); a side-panel refusal counts one use (minor 4).

### 5.11 Extension surface (D41, added 2026-11-13)

Mechanism and options in ADR-0010. Proposed until the owner approves. Requests SR1 to SR4 and SF2 from the extension session; verdicts in docs/handoffs/2026-11-13-architect-to-orchestrator-extension-requests.md. Numbers marked "to measure" are starting values that the dev measurement run (slice 34) confirms or changes.

Front door of `doPost` (SR2, slice 29). In order, before `JSON.parse` and before dispatch:
1. `event.postData` missing, its `contents` not a string, or a throw while reading it: refuse.
2. Media type = `event.postData.type`, lower case, cut at the first `;`, trimmed. Other than `application/json`: refuse. `application/json; charset=utf-8` passes.
3. Size = the larger of `event.postData.length` (when a whole number >= 0) and `contents.length`; over 262,144: refuse.

A refusal answers the standard envelope `{ ok: false, error: { code: "BAD_REQUEST", message, retryable: false }, serverVersion, durationMs }` with message "Unsupported content type" (steps 1, 2) or "Request too large" (step 3), and writes one warn log line (`action: ""`, `targetId: ""`, `errorCode: BAD_REQUEST`, `actor` from the session). No audit row, no dispatch. `rpc` (web app) is unchanged. No nonce (ADR-0010 Decision 1, option 2 only if owner test 1 fails).

Surface label (SR3, slice 30). The envelope gains an optional field `client`:

```ts
interface RpcRequest {
  op: string; args: unknown; requestId: string; clientVersion: string;
  timing?: ClientTiming; draft?: DraftInfo;
  client?: "addon" | "extension";   // absent = "addon"; any other value: VALIDATION "Client must come from the fixed list"
}
type Entry = "doPost" | "rpc";                                // set by entry.ts only; the only value policy reads
type Surface = "addon" | "extension" | "webapp" | "trigger";  // log line and audit `surface` only
interface DispatchRequest { caller: Caller; op: string; args: unknown; entry: Entry; surface: Surface; requestId: string }
```

- `authorize` refuses a `web` row unless `entry === "rpc"`. Today's rule (`surface === "addon"` refuses) is replaced, so any future entry is refused for `web` ops by default.
- `client` is a client claim, used for log and audit `surface` only. `doPost` with `client: "extension"` runs every check of an add-on call: same caller, same policy, `web` ops DENIED.
- `rpc` always labels `webapp` and ignores `client`.

`extension.sync` (SR4a, slices 31, 33a, 33b). Policy `both("template.read")`, list op, no targets, `checkArgs` before `authorize`. No audit row, no apply event; log `targetId: ""`.

```ts
interface SyncArgs {
  etag: string;                                    // "" on the first sync; else the last etag received
  have: Record<string, { v: number; skip?: true }>; // max 1,000 keys; key = item ID (26 chars); v whole number >= 0
  page: number;                                    // whole number >= 1; 1 = Script Cache only, 0 Drive reads
}
interface SyncData {
  caller: string;                 // Session.getActiveUser, lower case
  etag: string;                   // first 32 hex of SHA-256 over caller, NUL, JSON.stringify(list part); every reply
  list?: SyncList;                // only when etag differs from args.etag
  bodies: { id: string; version: number; html: string }[]; // readableBody(...).html, as template.apply returns it
  more: boolean;                  // a due body was left out by a budget; call again with page + 1 and a new have
  sender: Sender;                 // as ApplyResult.sender
  favorites: string[];            // the caller's list, visible IDs only, newest first
  recent: string[];               // the caller's list, visible IDs only, max 20 (RECENT_MAX)
}
interface SyncList {
  domain: string;                         // Script Property DOMAIN, lower case
  personalTemplates: "on" | "off";
  imgHosts: string[];                     // IMG_HOSTS; [] = any https host
  rules: string;                          // 64 hex, build constant (below)
  folders: { id: string; name: string; parentId: string }[]; // display order of sidebar.home; parentId = nearest visible parent or ""
  templates: SyncTemplate[];              // title order of sidebar.home
}
interface SyncTemplate {
  id: string; folderId: string; title: string; subject: string; tags: string[];
  version: number;                        // item.currentVersion
  level: "use" | "edit" | "manage";
  to: string[]; cc: string[]; bcc: string[]; blocked: string[]; // splitBlocked under recipientsExternal now (D42, owner to confirm)
  prompts: string[];
}
```

- Visible set: `visibleLibrary(context)` in `src/server/handlers/visible.ts`, the one function `sidebar.home`, `search` and `extension.sync` call (moved from `handlers/sidebar.ts` in slice 31).
- Every call runs dispatch and `visibleLibrary` again. Bodies come only from that call's visible set; a `have` key outside it is ignored. A body is due when `have[id]` is absent or `have[id].v` differs from the current version. `skip: true` is accepted and changes nothing on the server: an entry with the current version is not due either way, and a new version is due again.
- Body order: Favorites, Recent, then title order. `bd:*` read in batches of 25 keys.
- Budgets per reply: `SYNC_REPLY_BYTES` 4,000,000 bytes of reply JSON (to measure); `SYNC_DRIVE_READS` 25 Drive reads, `page >= 2` only (to measure); `SYNC_TIME_MS` 8,000 ms of handler time, no new Drive read after it (to measure). The list part is never cut. From page 2, at least 1 due body per reply. A Drive miss is kept in `bd:*` (to measure: index rebuilds during a cold sync).
- `rules`: `scripts/build.mjs` hashes, in ascending path order, each path, NUL, the file text with CRLF turned to LF, NUL; injected as `BUILD_INFO.rules`. The path list (the extension's copied files) lives in one script module; a test fails on a missing path and on an unlisted file under `src/shared/placeholders/`, `src/shared/sanitize/`, `src/shared/html/`.
- Arg errors (`checkArgs`): `have` not an object, over 1,000 keys, a key that is no ID, `v` no whole number, `skip` other than `true`, `etag` over 64 characters, `page` no whole number >= 1, an extra arg: VALIDATION "Sync arguments are malformed", no index read.

`template.apply` additions (SR4b, slice 32):

```ts
interface ApplyArgsAdded {
  applyId?: string;  // ^[0-9A-Z]{8}-[0-9A-Z]{6}$, else VALIDATION "Apply ID must have the format XXXXXXXX-XXXXXX"
  at?: number;       // whole ms since epoch; clamped to [now - 13 h, now]; stored only as after.claimed.at of a refused row
}
interface ApplyResultAdded {
  recorded?: boolean; // only when applyId was sent: true = event stored now or earlier for this applyId; false = buffer lock busy or buffer full, retry
}
```

- Repeat check: Script Cache key `ap:<first 32 hex of SHA-256 of the lower-case caller>`, value = the caller's last 100 `applyId`s, space-separated, TTL 21,600 s. Read and written inside the 500 ms buffer lock with the event (`bufferEvent` option `once`). A repeat stores no event and answers normally with `recorded: true`. Eviction or a retry after 6 h can count twice (accepted).
- Event `ts` and audit `ts` stay server time. `at` never changes usage, Recent or a month file.
- Refused apply with a well-formed `applyId` (one row per `applyId`, same `once` list):

  | Case | Row |
  |---|---|
  | DENIED in dispatch or in the lock | replaces today's folder row: `action: template.apply`, `result: denied`, `errorCode: DENIED`, `targetType: template`, `targetId: <item ID>`, `after: { folderId, applyId, claimed: { at, knownVersion } }`, `surface` as labeled |
  | NOT_FOUND for an item in the index (trashed) | same row with `errorCode: NOT_FOUND` |
  | NOT_FOUND for an ID absent from the index | no row (as today) |
  | no `applyId` | today's rows: folder row for DENIED, none for NOT_FOUND |

Error codes: no new code. `BAD_REQUEST` (front door), `VALIDATION` (`client`, sync args, `applyId`, `at`), `DENIED`, `NOT_FOUND`, and the existing `AUTH_*`, `BUSY`, `QUOTA`, `INTERNAL`, `NOT_CONFIGURED`.

Dev test deployment (SR1, owner step, no slice): one hand-made versioned web app deployment on the dev project, steps in ADR-0010 Decision 7. `deploy/dev.json` unchanged. The URL and deployment ID never go into a file.

Stored bodies (SF2, owner step, no slice): ADR-0010 Decision 8. Owner reads Script Property `IMG_HOSTS` on dev. Empty: closed, nothing to report. Set: Export library, then search the file for an image `src` with `@` before the first `/` after `https://`.

To measure on dev (slice 34, owner with the implementer's script of steps): sum and largest `sizeBytes` over live items; handler and transfer time of page 1, of a full 200-template sync warm and cold, and of one 4 MB reply; whether ContentService returns a 4 MB reply; Drive read time per body; index rebuild lines during a cold sync; the `postData.type` value Apps Script reports for the add-on and the extension.

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
| extension.sync (D41, section 5.11; slices 33a, 33b) | use (results filtered by `visibleLibrary`, as `sidebar.home`); `checkArgs` before `authorize` | both |

`spike.s4` and its policy row were removed in slice 5.

Extension additions (D41, 2026-11-13, section 5.11, ADR-0010; Proposed): `template.apply` takes optional `applyId` and `at` and returns `recorded` when `applyId` was sent; a refused apply with `applyId` writes a template row in place of the folder row. The `web` rule changes from "refused on `addon`" to "served on `rpc` only" (`entry`, slice 30).

Arguments and results for recipients (D26, slice 9, section 5.7): `template.create` and `template.update` take `to`, `cc`, `bcc` (string arrays). `template.duplicate` and `version.restore` copy them and validate. `import` reads them from `meta`. `template.get` and `export.*` return them. `template.list` (web app) always carries `to`, `cc`, `bcc` of each visible template, `[]` for old items (slice 13). `template.apply` and `template.getBody` return `to`, `cc`, `bcc` (inside addresses only when `settings.recipientsExternal` is `deny`) and `blocked` on every call. `version.get` returns the version's lists; `version.restore` adds `recipientsUnreadable` when a list could not be read (section 5.7). `sidebar.home`, `search` and the sidebar lists return `rc: [to, cc, bcc]` counts and no address. `me` returns `recipientsExternal` (`allow` or `deny`) for the editor. No new op and no new policy row.

Arguments and results for export (slice 13, section 4.5; `run` since slice 13, one lock since slice 20a): start calls `export.library { start: true, run }` and `export.folder { folderId, start: true, run }` answer `{ token, total }`; `run` is optional, a string, and reuses the first start of the same click within 60 s (section 4.5). Page calls `{ offset, token }` (plus `folderId`) answer `{ header, items, total, next }`.

Admin folder list (slice 20a): the Admin page loads `admin.folders` once and every tab reads that one list. A folder write (`folder.create`, `folder.rename`, `folder.move`, `folder.delete`) and an import refresh it with one `admin.folders` call; "Export and import" ("Folder", "Import into") then shows the change on its next open with 0 calls of its own. A tab opened while the refresh runs waits for the new list. An import does not redraw lists of a tab that is already open (slice 20a minor 3, open).

Arguments and results for settings (D29, slices 11 and 13, section 5.8, ADR-0008 section 2):
- `config.set { name, value, baseAt, baseBy }`. `name` in the fixed list; `value` in that setting's values; `baseAt` and `baseBy` strings of at most 254 characters; any other or extra arg answers VALIDATION (section 7.3 texts). A call that still carries the old arg `from` answers VALIDATION "This page is out of date. Reload it and save again." Result `{ name, value, updatedAt, updatedBy, changed }`. Same as `value`: `changed: false`, no write, no audit event. Last change other than `baseAt`, `baseBy`: CONFLICT with the current entry in `details`.
- `config.get` adds `settings`: per name `{ value, updatedAt, updatedBy }`. D32: also `admins` (`[{ email, addedAt, addedBy }]`) and `breakGlass` (the `ADMIN_EMAILS` addresses).
- `admin.add { email }` (D32): any other or extra arg answers VALIDATION. Checks in order: form (recipient rule of 5.7, after trim and lower case) `ADMIN_FORMAT`; domain part equals `DOMAIN` `ADMIN_OUTSIDE`; Directory `users.get` (`domain_public`, `basic`) not found `ADMIN_NO_ACCOUNT`, other Directory error INTERNAL with `details.reason` `ADMIN_CHECK` and one warn log line `directory.users.get`, `errorCode` "<reason>:<status>", no address; then in the lock: caller still admin, else DENIED; `primaryEmail` already listed: ok `changed: false`, no write; 20 listed `ADMIN_TOO_MANY`; else append `{ email: primaryEmail, addedAt, addedBy: caller }`. Result `{ admins, changed, email }` (`email` = the stored primary address, slice 16 retry 1). Refusals are VALIDATION with `details.reason` set to the code. A list that cannot be read for the write answers CONFLICT "The admin list changed while you worked. Reload the page and try again."
- `admin.remove { email }` (D32): the caller's own address `ADMIN_SELF`; in the lock: caller still admin, else DENIED; not listed: ok `changed: false`; else remove. Result `{ admins, changed, email }`. Only `admins` changes; a break-glass or group admin stays admin.
- `me` adds `personalTemplates` (`on`, `off`). `sidebar.home` adds `personalTemplates`.
- While `personalTemplates` is `off`, a DENIED whose target sits in a private tree carries the text "Personal templates are turned off by your admin."

Status 2026-11-10 (build f6b567f, slices 6a and 6b merged): every op in this table has a handler. `LATER_SLICE_OPS` and the "not implemented" answer are removed. `template.getBody` (slice 3) returns the readable body without an apply event; the add-on uses it on a body cache miss. `template.apply` takes `followUp: true` on the prompt card Insert (section 4.1 step 5). `template.duplicate` (slice 4b): title "Copy of ...", cut to 120, tags, subject and the current body become version 1; edit on source and target. `search`, `search.body`, `favorite.set`, `favorite.unset` (slice 5). `admin.folders`, `membership.status`, `trash.purge`, the Trash view of `template.restoreFromTrash` (slice 6a). `export.*`, `import`, `audit.query`, `usage.report`, `config.get`, `backup.list`, `backup.restore` (slice 6b). Admin rows re-read the membership snapshot inside the lock before a write (dispatch `recheck`). Since slice 16 retry 1 `recheck` builds the caller's subject in the lock for every write, admin and level rows alike (`lockedSubject`: the snapshot read again plus the in-app admin list of the in-lock index), so an admin removed after the dispatch check is refused with nothing written.

## 7. Error, empty and loading states

Error codes and UI (wireframe 07). Guard order: blank caller gives AUTH_NO_USER first, then NOT_CONFIGURED while `DOMAIN` is unset (every caller, in or out of the domain), then the domain check, then the policy row.

| Code | Cause | Sidebar | Web app | Retry |
|---|---|---|---|---|
| NOT_CONFIGURED | Script Property `DOMAIN` unset: `setup()` has not run | "Migway Templates is not set up yet." "Ask your admin to finish setup, then press Retry." + Retry | Toast "Migway Templates is not set up yet. Ask your admin to finish setup." + request ID (`NOT_SET_UP_TEXT`, slice 20a). On the first load: the banner with the same sentence and "Reload" in place of the page, plus one toast with the same sentence from the account call (`app.ts:389`, Q81) | no |
| AUTH_NO_USER, AUTH_DOMAIN | blank or non-domain active user | "Cannot identify your Migway account." "This app does not work when several Google accounts are signed in. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account." | The same sentences, full page | no |
| DENIED | no level on target | "You don't have access to this template. Ask a folder manager." + Back, or Refresh on a root card. The compose card shows this text for every DENIED; the add-on ops are `use` ops, which stay allowed while personal templates are off | Inline banner, item removed from list. While personal templates are off and the target is in a private folder: the server text "Personal templates are turned off by your admin." (D29). On an admin-only action: "You are no longer an admin, so nothing was changed. Ask an admin if you need access." (slice 16 retry 1; section 7.3) | no |
| NOT_FOUND | deleted or moved | "This template was deleted or moved. Press Refresh to update the list." + Refresh | "This template was deleted or moved." Banner + link to library | no |
| CONFLICT | baseVersion stale | n/a | Conflict dialog (4.2); other writes: "<name> changed this at <time>. Reload the page and try again." | after choice |
| BUSY | lock not acquired in 10 s | "The library is busy. Try again in a few seconds." + request ID + Retry | "The library is busy. Try again in a few seconds." Toast + Retry | yes |
| QUOTA | Apps Script quota, simultaneous executions, or Drive REST HTTP 429 (slice 19) | "Service is busy. Try again in a minute." + Retry; a Retry inside the 60 s gives the notification "Service is busy. Try again in <n> seconds." | "Service is busy. Try again in a minute." Toast; Retry disabled for 60 s | yes, after 60 s |
| VALIDATION | field, subject, recipient, size or request ID errors | n/a | Inline list under editor with positions | after fix |
| PROMPTS_MISSING | blank field at insert | Not raised since slice 15 (D31): a blank field is removed; over 500 characters re-renders the details card (section 7.4) | n/a | n/a |
| TIMEOUT, NETWORK, SERVER (INTERNAL) | network or unhandled | "Something went wrong. Press Retry." + request ID + Retry; NETWORK adds "Details for your admin: <message>" | "Something went wrong. Try again." Toast + request ID + Retry | yes |

Texts as built at 8e82a07, after the wording pass of slice 14. The glossary of record is docs/design/wording.md. Sidebar state cards have no header (slice 12). The side panel action callbacks show none of these cards; their sentences are in section 7.2. Look of the sidebar state cards (D35, D36, slices 21 and 22 follow-up 1): the first line of each card is an error line, red #b32025 with the `error` icon (alt text "Error") at its start and no "(!) " prefix; the lines after it ("Request ID ...", "Details for your admin: ...", "Ask your admin to finish setup, then press Retry.") are plain. Every card button shows Gmail's spinner while its callback runs (section 7.2, Loading states).

### 7.1 Recipient texts (D26, added 2026-11-10)

Save errors (editor field error and Problems list; `field` and `position` from the code):

| Code | Text |
|---|---|
| `RCPT_FORMAT` | "Cc, address 2 is not an email address. Use the form name@company.com." |
| `RCPT_TOO_LONG` | "To, address 1 is longer than 254 characters." |
| `RCPT_TOO_MANY` | "Cc holds 11 addresses. Use at most 10 in Cc." or "To, Cc and Bcc hold 21 addresses together. Use at most 20." |
| `RCPT_DUPLICATE` | "safety@migway.com is in both To and Cc. Keep it in one of them." |
| `RCPT_EXTERNAL` | "Bcc, address 1 is outside migway.com. Your admin allows only migway.com addresses. Remove it to save." |

Sidebar (wireframe 02), as built since slice 15:
- List row of a template with recipients: the recipient hint "Adds To 1, Cc 1, Bcc 1" (fields with addresses only) goes first on the row's one label line, then the fields hint and the path, joined by " · "; button "Insert", screen reader "Insert <title>" (section 7.4).
- Details card, section "Recipients": switch "Add recipients" with bottom label "Adds 2 recipients." ("1 recipient" singular; only when Insert adds one), then one item per address, top label the field ("To", "Cc", "Bcc"), text the address, bottom label the markers joined by " · ": "outside migway.com", "hidden from other recipients" (Bcc).
- Not added: "Not added: <address>. The draft already has a To recipient." / "Not added: <address>. It is already in the draft." / "Not added: <address>. Outside migway.com, turned off by your admin."
- Unknown draft field: "The draft's Cc recipients could not be read and were not changed. Add by hand: <addresses>."
- Finish typing (compose details card, when Insert adds an address): "Finish typing addresses in the draft first: an address still being typed is lost." Plain text: slice 22 made it a grey hint, follow-up 1 made it plain again, because it warns of a lost address.
- Changed lists at Insert, and a row whose counts differ: "The recipients of this template changed. Check them and press Insert again." as the first line of the details card, an error line (red, `error` icon with alt text "Error"; the "(!) " prefix was removed in slice 22 follow-up 1).
- A row Insert adds no notice: an outside address left out under `deny`, or a template To skipped because the draft has a To, shows only on the details card (test round 1, part B step 6 and the slice 17 note; owner's judgment, Q77).

Editor (wireframe 04, Details panel, slice 8b):
- Labels "To", "Cc", "Bcc" above each field. Enter, comma, semicolon, space, a pasted list and leaving the field turn the typed text into chips (trim, lower case, repeats dropped). Backspace in the empty input removes the last chip. Each chip has a button "Remove <address> from Cc". A screen-reader-only live region announces "Added <addresses> to Cc." and "Removed <address> from Cc." (slice 14).
- Help under the three fields (since slice 15): "Added to the draft when someone inserts this template. The row in Gmail shows how many; the draft shows them after the insert."
- Marker under a valid outside address: "outside migway.com". Under `deny` the chip has the error style and the `RCPT_EXTERNAL` text.
- Bcc help: "Hidden from the other recipients of the email."
- `use` holders see the lists read only, chips without a remove button; an empty field reads "None".

Admin, "Settings and backups" tab: the "Outside recipients" setting of section 7.3 (D29; the read-only row of `RECIPIENTS_EXTERNAL` is gone since slice 11).

### 7.2 Side-panel texts (D27, added 2026-11-10, rewritten 2026-11-11 for slice 18)

Wireframes 01 and 02, side-panel variants. Entries from `entryOf` (section 4.1a). Mechanism: ADR-0007 "Acceptance 2026-11-11" and its Amendments 2026-11-11 (D33) and 2026-11-12 (Q75, Q55). As built at 8e82a07 (slice 18 with follow-ups 1 and 2; slices 20b, 21, 22). Q68 and Q74 are settled yes in the owner's Gmail (part J): typed values and the "Add recipients" switch reach the press, and compose actions work on row and footer buttons.

| Place | `inbox` (no message open) | `message` (message open) |
|---|---|---|
| Row buttons | "New email" (`FILLED` slate) in the row, screen reader "New email from <title>" | "Reply" (`FILLED` slate) and "Reply all" (`OUTLINED`) in a button row under the title (D33), screen reader "Reply with <title>", "Reply all with <title>" |
| Row label | as compose (section 7.4) | same |
| Details card footer, primary (`FILLED` slate) | "New email" | "Reply" |
| Details card footer, secondary (`OUTLINED`) | "Edit in library" (edit or manage only) | "Reply all" |
| Details card, last button section (`OUTLINED`) | none | "New email"; "Edit in library" (edit or manage only) |
| Details card, input hint of the implicit recipient first name | none | "Leave blank to use the first name of the person you reply to, when known." |
| Details card, template with a To address | none | "A reply goes to the sender, so the template's To is not added. New email adds it." |
| Details card, signature line (before the text preview) | 'Gmail adds your signature to replies only. In a new email, use "Insert signature" in its toolbar.' A hint line (grey, `info` icon; D36, slice 22) | same |
| Hint, last section of home, folder, search and details cards | "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar." A hint line (D36, slice 22) | same |
| "Add recipients" bottom label | "Adds n recipients." | "A reply adds n recipients." (slice 20b): the count leaves out the template To, which a reply never adds. A template Cc already on the email is counted, so the label can be 1 higher than what the press adds (slice 20b minor 1, Q84) |

Unchanged from compose (section 7.4): the fields line, input titles, the more-than-20 line, the `recipientWidgets` lines without the finish-typing line, the text preview, "Open library" footer on home, folder and search cards, the list caps and the cut line. The search box and the "Search" button are stacked (no Columns in the side panel, slice 22 follow-up 1). No "Replace the subject" switch in the panel. No line above the lists.

Screen reader text of the details buttons: "New email from <title>", "Reply with <title>", "Reply all with <title>".

Failure sentences of the panel action callbacks (ADR-0007 A8 as amended by slice 18 follow-up 1). Each is the message of a thrown `Error`. A notification from a compose-action callback is not shown in Gmail (part J step 11). Gmail shows the sentence in its own error card (owner, dev, 2026-11-11; Q75 closed, accepted as is): "Error with the add-on. Run time error." then the sentence, then "[line: n, function: panelAnswer, file: Code]". The add-on adds no request ID and no technical text; the bracket line is Gmail's:

| Case | Text |
|---|---|
| QUOTA | "Service is busy. Try again in a minute." |
| BUSY | "The library is busy. Try again in a few seconds." |
| DENIED | "You don't have access to this template. Ask a folder manager.", or "Personal templates are turned off by your admin." when the server sends that text |
| NOT_FOUND | "This template was deleted or moved. Open the panel again to update the list." |
| TIMEOUT, NETWORK, SERVER, any throw before a draft exists | "Something went wrong. Try again." |
| NOT_CONFIGURED | "Migway Templates is not set up yet. Ask your admin to finish setup." (slice 20b: the error card has no Retry button, so "then press Retry" is dropped) |
| AUTH_NO_USER, AUTH_DOMAIN | the 2 lines of the account state card joined by one space: "Cannot identify your Migway account. This app does not work when several Google accounts are signed in. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account." (199 characters; slice 20b minor 3) |
| Message cannot be read | "This email can no longer be read. Open it again, or use New email." |
| Reply without an open message | "Open the email you want to answer, then press Reply again." |
| A box over 500 characters | "Each box takes up to 500 characters. Shorten the long one and try again." |
| New template version | "This template changed. Go back and open it again." |
| Other lists (`rh`) | "The recipients of this template changed. Go back and open it again." |
| Row counts differ (`rc`) | "The recipients of this template changed. Tap its name to see them." |
| Gmail refuses the draft | "Something went wrong. Try again." |
| Draft made, not opened | "The email is in your Drafts, but Gmail could not open it. Open Drafts to find it." |

Quick start lines (slice 18, docs/guide/user-quick-start.md, new section "Use the side panel" after "Insert a template"):
- "Migway Templates also opens in the panel on the right side of Gmail. It stays open while you read your email."
- "No email open: click "New email" on a template. A new email opens with the template's subject, text and recipients."
- "An email open: click "Reply" on a template. Your reply opens in the conversation with the template's text. It goes to the sender and keeps "Re:" in the subject. The template's Cc and Bcc are added; its To is not."
- ""Reply all", under "Reply" on the same template, answers everyone on the email and adds the template's Cc and Bcc." (D33)
- "Click a template's name for "Reply all", "New email", and to fill in fields first. "Add recipients" off leaves out the template's addresses."
- "The side panel always starts a new email or a reply. To insert into an email you are already writing, use the Migway Templates button in that email's toolbar."
- "Gmail adds your signature to replies only. In a new email, use "Insert signature" in its toolbar."
- "Each click makes a draft. A draft you close stays in Drafts; delete it there if you do not need it."
- Known limits, one line: "Forwarding is not in the side panel. Forward in Gmail, then use the button in the email's toolbar."

Empty states:

- Sidebar, no visible templates, personal templates `on`: "No templates shared with you yet." 'Your folder "My templates" is ready. Open the library to create a template.' Button: Open library.
- Sidebar, no visible templates, personal templates `off` (D29): "No templates shared with you yet. Ask your admin for access to a folder." No button.
- Library, no folder visible (personal templates `off`, no grant): "No templates shared with you yet. Ask your admin for access to a folder." No button.
- Library, the caller's own private folder while `off`: "Personal templates are turned off by your admin. You can still insert these templates." Shown above the list; no New template button.
- Sidebar, no favorites (slice 12): the Favorites section is not shown. Recent with no entries is not shown either.
- Sidebar, no search results: `No templates match "<query>". Try fewer words, or remove folder: and tag: from the search.` The query shows at most 60 characters (`ECHO_MAX`, cut by whole characters), then "...".
- Library, empty folder: "No templates in <folder>." Button: New template (edit level only).
- Library, no search results: `No templates match "<query>". Try fewer words, or remove folder: and tag: from the search.` (same text as the sidebar since slice 14)
- Trash empty: "Trash is empty. Deleted templates stay here for 30 days."
- Admin, folder without access entries: "Only admins can see this folder. Give access to share it."

Loading states:

- Sidebar: every card action sets `LoadIndicator.SPINNER` except "Back" (`onBack`) and the library links (`onOpenLink`), which answer at once with no server or Gmail call (D35, slice 21, `toAction` in `src/addon/cards/render.ts`, the one place that builds actions). Covered: row and footer buttons, row taps, the search box and the "Search" button, the side-panel compose buttons. The owner saw the spinner on compose Insert, search and side-panel actions (dev, 2026-11-11). The server keeps a card under the 3 s budget. No partial cards.
- Web app, first paint (slice 20a): the page HTML holds "Loading..." (`role="status"`) in `main`, so the first paint shows it before any script runs. The script swaps it for the skeleton. If the first `folder.list` and `template.list` fail, or give no answer within 15 s (`FIRST_LOAD_MS`), `main` shows one banner (`role="alert"`) "Templates could not be loaded. Press Reload to try again." with the button "Reload", and no toast; focus stays on `main`. "Reload" shows "Loading..." and tries again. A late answer replaces the banner with the page. The banner replaces only the first view, and only the library, the editor or Trash (`WAITS_FOR_LOAD`); Admin and History keep their page and show the usual toast. Not set up: the banner says "Migway Templates is not set up yet. Ask your admin to finish setup." plus one toast (Q81).
- Web app: skeleton rows for the list (8 rows), skeleton blocks for editor and history, `aria-busy="true"` on the region. Save button shows "Saving..." and is disabled; status text in a live region: "Saved as version 7, 2:05 PM" (local time; the date for an older save).
- Web app loader (D37, slice 24, merged after retry 2; `src/web/ui/busy.ts` `createBusy([main, side])`): while any tracked call runs, a capture-phase guard drops click, dblclick, mousedown, pointerdown, keydown, beforeinput, paste, drop, contextmenu and submit inside the page and the sidebar. Text fields (text area, text-like input, `contenteditable`) keep keydown, beforeinput, paste and drop, so typing, Backspace, paste and undo during a save are kept and the header then says "Unsaved changes"; clicks into another field stay blocked, Tab still moves focus. In the editor Ctrl+K and `{{` open no dialog during a call. Focus never moves; dialogs and toasts sit outside both regions and keep working. Untracked: `search.body` (typing) and `profile.me` (account name), and `app.background` reads. After 300 ms (`BUSY_SHOW_MS`): a 3 px bar at the top (#2a3c49 in light mode, the dark `--slate` #dfe6eb in dark mode, still under reduced motion), `aria-busy="true"` on both regions, one polite "Loading" in a `role="status"`. Waits under 300 ms show nothing. The block ends when the last call settles, or for each call after 20 s (`BUSY_MAX_MS`); the call keeps its own error path. A second save cannot start while one runs (`saving`); a toast "Retry" cannot start a second restore (`restoring`).
- Calls per step since slice 24: a save is 1 call (`template.update`; its answer updates the loaded list) where it was 3 in 2 rounds; Admin "Who has access" shows a folder's held rows at once on a revisit and reads `grant.list` in the background, redrawing only when the answer differs; a grant write drops that folder's held rows. First load stays 3 parallel calls (`folder.list`, `template.list`, `profile.me`). Still 2 calls: Duplicate, Move, Delete, history restore (they reload the library); Admin tab revisits, Give access and folder create or delete read again. Open: a call that never answers frees the page at 20 s and leaves its busy text, for example "Duplicating..." (slice 24 minor 1).

### 7.3 Settings texts (D29, added 2026-11-10)

Admin, tab "Settings and backups", section "Settings" (wireframe 06). Admins only. Texts as built after slice 14.

| Place | Personal templates | Outside recipients |
|---|---|---|
| Legend | "Personal templates" | "Outside recipients" |
| Explanation | "Users can create their own templates in My templates. When off, users keep and can insert the personal templates they have, but cannot create, change or delete them." | 'Templates can add addresses outside migway.com to To, Cc and Bcc. With "migway.com only", a template with an outside address cannot be saved and Insert skips the address.' |
| Radio labels | "On", "Off" | "Allowed", "migway.com only" |
| Last change | "Last change: <name part> on <local time>." or "Default, never changed." | same |
| Save | "Save", busy "Saving...", status "Saved. Personal templates are off for every user from their next action." (or "on") | "Saved. Outside recipients are allowed." / "Saved. Only migway.com recipients are allowed." |
| Confirm dialog (only for `on` to `off`, `allow` to `deny`; Cancel has focus) | Title "Turn off personal templates?" Body "Users can no longer create, change or delete templates in My templates. Nothing is deleted: their templates stay, can still be inserted, and can be changed again when you turn this on." Buttons "Turn off", "Cancel" | Title "Allow only migway.com recipients?" Body "Templates keep their outside addresses, but Insert no longer adds them. A template with an outside address cannot be saved until the address is removed." Buttons "Allow only migway.com", "Cancel" |
| Conflict (client text; the radio then shows the current value and focus moves to the status line) | "<name part> changed this setting on <local time>. The page now shows the current value." | same |
| Validation (server) | "Setting <name> does not exist." (at most 40 characters of the name, `NAME_ECHO_MAX`) / "Setting personalTemplates takes on or off." / old `from` arg: "This page is out of date. Reload it and save again." | "Setting recipientsExternal takes allow or deny." |

The server CONFLICT message is "<name part> changed this setting. The page now shows the current value."; the client adds the local time. Save stays enabled while saving with `aria-disabled`; when Save ends disabled after it had focus, focus moves to the status line (slice 13).

The domain in the texts is Script Property `DOMAIN`.

Admins (D32, added 2026-11-11, built in slice 16). Tab "Settings and backups", section "Admins" after the two switches (wireframe 06). Admins only.

| Place | Text |
|---|---|
| Legend | "Admins" |
| Explanation | "Admins manage every shared folder, its access, settings, imports and backups. Add people by their migway.com address." (slice 20a replaced "grants" with "its access", glossary docs/design/wording.md) |
| Row of the in-app list | the address; bottom line "Added by <name part> on <local time>."; button "Remove", screen reader "Remove <address> as admin". No button on the caller's own row |
| Read-only rows | "Set by the owner: <addresses>. These cannot be removed here." (`ADMIN_EMAILS`); "Members of <group>." (`ADMIN_GROUP`, only when set) |
| Empty list | "No admins added here yet." |
| Add | input label "Email address"; button "Add admin", busy "Adding..."; status "<address> is now an admin." / "<address> is already an admin." |
| Remove confirm (Cancel has focus) | Title "Remove <address> as admin?" Body "They lose admin access at their next action. Their templates and folders stay." Buttons "Remove admin", "Cancel"; busy "Removing..." |
| Remove result | "<address> is no longer an admin." / "<address> is not in the list." |
| `ADMIN_FORMAT` | "Enter an email address, for example name@migway.com." |
| `ADMIN_OUTSIDE` | "Only migway.com addresses can be admins." |
| `ADMIN_NO_ACCOUNT` | "No migway.com account has this address. A group goes in the admin group the owner sets." |
| `ADMIN_TOO_MANY` | "The list holds 20 admins. Remove one first." |
| `ADMIN_SELF` | "You cannot remove yourself. Ask another admin." |
| Directory error (INTERNAL, `details.reason` `ADMIN_CHECK`) | "The address could not be checked. Try again." in the status line, no toast |
| List changed during the write (CONFLICT) | "The admin list changed while you worked. Reload the page and try again." |
| Caller no longer admin (DENIED) | "You are no longer an admin, so nothing was changed. Ask an admin if you need access." (`ADMIN_DENIED_TEXT`, slice 16 retry 1). The same text answers DENIED on every admin-only action: Add admin, Remove admin, Settings Save, Restore a backup, whole-library Export, Import and Check file, Empty trash, Refresh groups. Folder-manager actions keep the section 7 DENIED text |

After an add or a remove the list shows the op's `admins`; the result texts name the op's `email`; focus moves to the status line. `aria-invalid` is set on the address input only for a VALIDATION answer to Add.

### 7.4 Compose card: one-click insert and details card (D31, added 2026-11-11)

Accepted 2026-11-11 (owner decision D31). Mechanism and options: ADR-0009 (cards), ADR-0004 Amendment 2026-11-11 (fields), ADR-0006 Amendment 2026-11-11 (recipients), all Accepted 2026-11-11. Built in slice 15 (section 13.9) with follow-up 1; review PASS. This section is the compose entry. The side panel uses the same render and recipient pipeline through compose actions since slice 18 (sections 4.1a and 7.2). No server change.

Gmail facts from the owner's test round 1 (dev-56bf795 and dev-5065ba1): the compose card closes after Insert, from a row and from the details card. "Open library" and "Edit in library" open the library in a new Chrome window (the code asks for `OpenAs.OVERLAY`); whether closing it reloads the card is unverified. In a narrow draft Gmail moves the add-on icon into the "⋮" menu of the draft toolbar.

Rule for a field without a value (explicit `{{ask:Label}}`, or a variable with no value and no fallback), owner decision 2026-11-11: it is removed. Value order: typed answer, else the variable's value, else its fallback, else "". Then the cleanup of ADR-0004 Amendment 2026-11-11 runs on each text run and on the subject. A gap is where a token rendered as empty text; gaps are handled left to right; "space" is U+0020 only:
1. Space on both sides of the gap: drop the space after it.
2. Space before the gap and one of `, . ; : ! ?` right after it: drop the space before it.
3. Gap at the start of the run with a space after it: drop that space.
4. Gap at the end of the run with a space before it: drop that space.

Subject: the same rules, then `oneLine`; an empty subject sends no subject action. Left alone: spaces across inline tags, non-breaking spaces, tabs, line breaks, the template's own double spaces, other punctuation, and blocks left empty (no paragraph, list item or cell is removed; smoke step 13 records how Gmail shows an empty paragraph). Test pairs: ADR-0004 Amendment 2026-11-11 (8 pairs). Risk: a sentence with a hole can be sent. Mitigations: the row hint "n fields to fill" and the details card for pre-fill.

Home card (wireframe 01):
- Sections in order: search input (title "Search templates", no hint) with the "Search" button (D36, section 4.4), Favorites (max 10), Recent without any template in Favorites (server max 5, hidden when empty), Folders. Collapse after 5 rows as built.
- Row: start icon of its section, title as text, one bottom label: recipient hint, fields hint, folder path, joined by " · " ("Adds Cc 1, Bcc 1 · 2 fields to fill · Sales / Quotes"). Folder cards drop the path. Empty parts drop out.
- Row button (compose only): "Insert", `FILLED` slate, screen reader "Insert <title>", action `onInsert` with `id`, plus `rc` = "<to>,<cc>,<bcc>" when the row shows a recipient hint.
- Row tap (`onClick`): `onPreview`, opens the details card.
- Footer: "Open library", `FILLED` with background #2a3c49 (FixedFooter requires a filled primary [A40]). Manifest `addOns.common.layoutProperties.secondaryColor` "#2a3c49" for outlined buttons ([A42]; Gmail web support unverified, smoke step 10) and, since slice 21 (D35), `primaryColor` "#2a3c49" for the add-on top bar; the owner measured the bar at #2A3B48 on dev (2026-11-11).
- Folder and search cards: same rows and footer. Search results: each template once.

Flow A, row Insert (`onInsert`):
1. `template.apply` `{ id, knownVersion, recipientEmailIfInternal }`: server re-checks `use`, buffers one apply event.
2. Failure: the section 7 state card is pushed; the draft does not change.
3. Count check: `rc` (absent = "0,0,0") against the lengths of `to`, `cc`, `bcc` of the reply. Different: push the details card with the change line and `counted=1` (the row call already buffered the apply event); no insert.
4. Any template address in a draft field that `draftRecipients` reports unknown: push the details card (its "Add by hand" line, `counted=1`); no insert.
5. Else render body and subject with no answers (unfilled fields removed, with the cleanup), subject per D24 (`replacesSubject(draftHasSubject)`, one argument since slice 15), recipients by `recipientActions(lists, draft, true)`. One `UpdateDraftActionResponse`. The card closes (spike S6 step 0, test round 1 part B).

Flow B, details card (`onPreview`, compose):
1. `template.apply` `{ id, knownVersion, followUp: true }`: same `use` check, no apply event, `recipientFirstName` "" (Q24). Body cached as today.
2. Card, top to bottom: header = title; change line, an error line (red, `error` icon, alt text "Error"; no "(!) " prefix since slice 22 follow-up 1), when pushed by Flow A or a re-render; section "Fields" when the template has fields without a value: line, inputs `p-1` to `p-20`, the more-than-20 line. The recipient first name counts as such a field whenever the template holds `{{recipient.first_name}}` without default text, on every details card (opened, pushed by a row Insert, re-rendered), because a `followUp` call never resolves it (`cardFields`, follow-up 1); its box starts empty and carries the first-name hint. A template with default text for it, or without it, shows no box; "Replace the subject" switch (`subj`) with the subject preview as bottom label, only when the template has a subject, default per D24; section "Recipients" when the template has addresses: "Add recipients" switch (`rcpt`, on) when Insert adds one, then the `recipientWidgets` lines (markers, Not added, Add by hand, finish typing); the text preview (600 characters, tokens as `[Label]`).
3. Footer: primary "Insert" (`FILLED`, slate); secondary "Edit in library" (`OUTLINED`) when the caller holds `edit`. Gmail's back arrow returns to the list.
4. Insert parameters: `id`, `version`, `values` (JSON of the variable values the card holds), `rh` (always), `counted=1` on a re-rendered card and on a card pushed by Flow A. No `title`: the card takes the title from the cached row or the apply result.

Flow C, details Insert (`onPromptInsert`):
1. `template.apply` without `followUp` (one apply event, recipient first name resolved); with `counted=1`, `followUp: true`.
2. New version: re-render with the version line, `counted=1`, switches at their defaults. Other lists (`rh`): re-render with the change line, `counted=1`. A value over 500 characters: re-render with the shorten line and those fields first, `counted=1`.
3. Else: values = card `values`, then each non-blank value of step 1. Answers by field key from the inputs. A typed value wins; a blank field takes a resolved value, else it is removed. Subject only while `subj` is on; recipients only while `rcpt` is on. One `UpdateDraftActionResponse`. A re-render carries the merged values of each call into the new card, so the row Insert, the first details Insert and a re-rendered Insert give the same body and subject (follow-up 1; the reviewer checked 3 templates against 6 drafts, 18 of 18). One render function `rendered(body, input)` serves every compose and panel path since slice 18.

States: section 7 codes unchanged on all three flows. PROMPTS_MISSING is no longer raised by the compose card.

Texts (new or changed; sentence case, no colon before a button):

| Place | Text |
|---|---|
| Details card, fields line | "Fill in now, or leave blank and type in the draft." |
| Details card, input title | the label, no asterisk |
| Details card, date field (D38, Proposed, section 5.9) | a date picker titled with the label, no hint; inserts MM/DD/YYYY |
| Details card, choice field (D39, proposal, section 5.10) | a dropdown titled with the label, first item "Choose..."; inserts the chosen option |
| Details card, input hint of the implicit recipient first name | "Leave blank to use the To recipient's first name, when known." |
| Details card, more than 20 fields | "This template has 23 fields. The first 20 are here. The rest are left out of the draft." |
| Details card, values over 500 characters | "Shorten to 500 characters: Driver name" |
| Details card, version changed | "The template changed. Check the fields and press Insert again." |
| Details card, lists changed (also from a row) | "The recipients of this template changed. Check them and press Insert again." |
| Row button | "Insert" |
| Footer of home, folder and search cards | "Open library" |

Removed texts: "Review" and "Review <title>", "Fill these fields to insert", "Fields to fill: ...", "Sets the draft subject.", "The draft already has a subject. It is kept.", "Adds 2 recipients." above buttons (kept as the switch label), "Insert with subject", "Insert body only", the too-many-fields card, the search hint.

Look and list caps of the Gmail cards (D34, D35, D36; slices 20b, 21, 22 and 22 follow-up 1; Accepted, owner decisions; mechanism ADR-0009 Amendment 2026-11-12). Applies to compose and side-panel cards alike:
- Layout: today's look stays (D34). Gmail sets fonts, spacing and section lines.
- Filled buttons: background #2a3c49 (`SLATE`). Manifest `primaryColor` and `secondaryColor` #2a3c49.
- Hint lines (`tone: "hint"`): a `DecoratedText` with the `info` icon at the start and the text in grey #5f6368 (`GREY`), wrapped. Exactly 4: the fields line "Fill in now, or leave blank and type in the draft.", the signature line, the toolbar hint (section 7.2) and the cut line below.
- Error lines (`tone: "error"`): a `DecoratedText` with the `error` icon (alt text "Error") at the start and the text in red #b32025 (`RED`), wrapped. They are the details card change line ("The recipients of this template changed. Check them and press Insert again.", "The template changed. Check the fields and press Insert again.", "Shorten to 500 characters: <labels>") and the first line of each state card (section 7). No "(!) " prefix (slice 22 follow-up 1). Follow-up lines, "Not added: ...", "Add by hand: ..." and the finish-typing line stay plain.
- Escaping: the color is a `<font color>` tag around the escaped text; user text never becomes markup (slice 21 review: 728 text calls with 7 hostile strings).
- Contrast: red 6.67:1 and grey 6.05:1 on white. Gmail's dark theme keeps add-on cards white, and the owner read both lines there (dev, 2026-11-11), so the dark-theme risk of the slice 21 and 22 reviews is closed.
- Search: the box and the "Search" button; one row (Columns) in the compose popup, stacked in the side panel (section 4.4).
- List caps (slice 20b; Gmail allows 100 widgets per card): Favorites 10, Recent 5, Folders 40 per card (home and folder cards), search results 20 (`LIST_MAX`). Rows past a cap are dropped whole and the last line of the section is the hint "Showing <shown> of <total> <noun>. Use Search or Open library for the rest." with noun "folders", "favorites", "recent templates" or "results". Only the Folders cap can fire today: the server already caps favorites 10, recent 5 and search 20 (`sidebar.ts`). Templates in folder 41 and later stay reachable by search and in the library. Worst card counts: folder card with an email open 84 widgets, home 76, search 44; compose home 61 (slice 22 follow-up 1 review). In a collapsed section (more than 5 rows) the cut line shows only after the user opens the section.

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
11. As a user who is not an admin: remove that user's access to T1's folder in the library, row Insert on T1 (view cached): the DENIED card, draft unchanged. An admin keeps access after the removal (ADR-0003 Part C).
12. [Replaced by test round 1 part J since slice 18; the side panel now has "New email", "Reply" and "Reply all".]
13. Row Insert on T5: record whether the empty middle paragraph shows as a blank line (y/n). Yes is accepted for v1; it is noted in the handoff.

## 8. Accessibility

- Every web app action reachable by keyboard: Tab order follows visual order; folder tree uses `role="tree"` with arrow keys, Enter opens; list uses `role="grid"` with arrow navigation; shortcuts: `/` focuses search, `Ctrl+S` saves, `Esc` closes dialogs.
- Focus visible on every interactive element (2 px outline, contrast 3:1 against background). Dialogs trap focus and return it to the opener.
- Every input has a visible `<label>`. Icon buttons have `aria-label` ("Add to favorites: Welcome email").
- Text contrast 4.5:1, large text 3:1. No information by color alone (conflict and error also have text and icon).
- Field blanks (slice 8b) have `aria-label` "Field: <label>", "Field: <label>, default text <text>" or "Field: <label>, the sender fills it in" (for example "Field: Sender name", "Field: Load number, the sender fills it in"; slice 14) and are announced as one unit.
- Status changes (saved, restored, error) use `role="status"` or `role="alert"`.
- Editor toolbar buttons use `aria-pressed` for toggles. Toolbar is one tab stop with arrow-key navigation.
- Sidebar: buttons name the target ("Insert Welcome email"), not "Go". Card Service renders native controls. Error lines carry the `error` icon with alt text "Error", so the error is not shown by color alone (slice 22 follow-up 1); hint lines carry the `info` icon. The "Search" button has the screen reader text "Search templates" (D36).
- Folder tree by pointer (slice 23, merged after retry 2; owner test passed on dev-744bd1d; `src/web/views/tree.ts`): the arrow at the start of a row opens or closes that row, opens no folder, sends no call and focuses the row; a click on the name of the selected open folder closes it; a click on any other name opens that folder and expands it. The second click of a double-click is ignored on the name and on the arrow, so a double-click acts once (on the selected open row it closes it once). `render(folders, selected, counts, reveal)`: `reveal` is true only for a choice by the user (a route opened with `app.go`, the first render and a deep link once the folders load, sidebar items, Favorites, All templates, tree rows, the editor breadcrumb, Admin tree clicks, and Admin writes that create, delete or move the selected folder); then the parents of that folder open. Every other render keeps closed parents closed: library reload, Duplicate, save, rename, idle refresh, browser Back and Forward. So Back to a folder inside a parent the user closed shows that folder's page with no selected row in the tree (slice 23 minor A). Keyboard unchanged. The arrow is `aria-hidden`, has no tab stop, and a 24 by 24 px target. Library tree and Admin "Folders and access" tree alike.
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

Side panel (D27, ADR-0007, Accepted 2026-11-11 after spike S7): no new scope. Per action (ADR-0007 A7): `template.apply` as compose; `GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken)`; New email `GmailApp.createDraft` and Reply, Reply all `createDraftReply`, `createDraftReplyAll` on `gmail.addons.current.action.compose`; `getMessageById`, `getReplyTo`, `getFrom`, `getTo`, `getCc` of the open message on `gmail.addons.current.message.metadata`; `ComposeActionResponse` needs none. S7 (dev-56bf795, these 10 scopes) ran `setCurrentMessageAccessToken`, `createDraft`, `getMessageById`, `createDraftReply` and `createDraftReplyAll` with no prompt; `https://mail.google.com/` is not needed (Q44). The header reads are checked in test round part J. Fresh consent (part H, Q55 closed; owner on dev, 2026-11-11, after "Remove access"): Google showed one page with 9 checkbox lines, the 10 scopes less the sign-in email (owner's count; which scope maps to which line was not recorded); after the owner accepted all of them, an Insert with recipients worked with no second prompt. So the recipient actions (D26) and the panel compose actions (D27) need no scope outside the 10. The contextual trigger names no scope [A37]. Reading the Gmail signature would need a restricted scope (`gmail.settings.basic`); not requested: Gmail adds the signature to replies itself (ADR-0007 A5).

Per-scope checkboxes (owner fact, 2026-11-11): the self-install consent page has one checkbox per scope, and a user may untick any of them. An unticked scope breaks the add-on (the owner saw it fail). The admin domain install grants every scope with no page. Hence: install by the Workspace admin for every user (phase 2.5b), and the quick start tells a self-installer to keep every box ticked (Q82).

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

Field planned 2026-11-10 (D27), inside `draft`: `via`. [Dropped 2026-11-11, ADR-0007 A6, Q67: not built, no server change. `draft.fields` already names `draftMetadata` on compose calls and `messageId` on panel calls with a message open; panel calls send counts 0 and `hasSubject` false from `draftInfo(event)`.] No message ID, thread ID or address is logged.

Example: `"draft":{"fields":["draftMetadata","toRecipients","subject"],"to":1,"cc":0,"bcc":0,"hasSubject":true}`.

Recipients (D26, added 2026-11-10): no log line carries a template address, a draft address, a domain of either or the `blocked` list. The `draft` object keeps its 5 keys: draft counts before the insert. The apply line gains no field: the server writes it before the add-on computes the recipient actions. Import report lines name the template and the count of dropped addresses only. Audit events are not log lines: `template.*` events keep the whole item in `before` and `after`, recipients included (admin-only audit tab).

Field `surface` (D41, slice 30): `addon`, `extension`, `webapp`, `trigger`. `extension` comes from the envelope field `client` of a `doPost` call, a client claim used for reporting only; policy reads `entry` (section 5.11). Audit events carry the same value. `extension.sync` lines carry `targetId: ""` and no ID list; `applyId` and `at` are not logged. Front-door refusals (section 5.11) log `action: ""`, `errorCode: BAD_REQUEST`.

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
| 4 Screen 6: admin shell, Folders and grants, Memberships (renamed "Folders and access", "Groups" in slice 14), flow 4.3 | 6a |
| 4 Screen 6: Audit log, Usage, Export and import, Config (renamed "Settings and backups" in slice 14); flow 4.5 | 6b |
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
| Wording pass on web and add-on texts with open review minors; glossary docs/design/wording.md | 14, done (merged 5296c47) |
| 7.4 One-click insert, details card, home card order (D31) | 15, done (merged ab88cbb); follow-up 1: one result on every insert path, first-name box (section 13.9) |
| 5.8 Admins list, `admin.add`, `admin.remove`, 7.3 Admins texts (D32) | 16, done after retry 1 (`ADMIN_DENIED_TEXT`, `ADMIN_CHECK`, `lockedSubject`) (section 13.10) |
| Smoke steps of 16 sections, docs/ops/test-round-1.md | 17, done (docs only) |
| 4.1a, 7.2 Side-panel insert: New email, Reply, Reply all through compose actions; S7 harness removed (D27) | 18, done (merged 5065ba1); follow-up 1: failures raise one sentence; follow-up 2: "Reply" and "Reply all" on rows (D33) (section 13.11) |
| Audit month file read: `readRawText` for JSON Lines, job error texts without platform messages (ADR-0002 Amendment 2026-11-11, slice 19) | 19, done after retry 1 (merged c6e2334) |
| Fix round, web and server: one Admin folder list (section 6), first paint and first-load banner (section 7), export start reuse in one lock (section 4.5), random part of IDs (section 5), guide fixes for phase 2.5b | 20a, done after retry 1 (6c51ea1, dev-ac33552) |
| Fix round, add-on: list caps and cut line (section 7.4), Reply-To with several addresses, "A reply adds n recipients." (section 7.2), rendered subject cap, panel NOT_CONFIGURED sentence | 20b, done (dev deployed) |
| Spinner on card actions, `primaryColor`, red error lines (D35) (sections 7, 7.4) | 21, done after one fix (5f475cb, dev-a57a5f6) |
| Hint lines, "Search" button (D36) (sections 4.4, 7.4) | 22, done (dev-5c018b8); follow-up 1: error icon and no "(!)", popup search row in Columns, finish-typing line plain, button icon guard (c1f2719) |
| Folder tree: arrow toggles a row, second click closes the selected folder, `reveal` only for a user choice (section 8) | 23, done after retry 2 |
| Web loader, 1-call save, held access rows (D37, section 7 Loading states) | 24, done after retry 2 (dev-744bd1d) |
| 5.9 Date fields `{{date:Label}}` (D38): grammar, save checks, editor menu item and chip, Gmail date picker, MM/DD/YYYY | 25, done (owner test passed on dev-e93a085) |
| 5.10 Choice fields `{{choice:Label\|A\|B}}` (D39): grammar, save checks, editor dialog and chip, "Edit choices...", Gmail dropdown, Insert check | 26, done (merged e93a085; owner test passed) |
| Brace rule at save (D40, Q78; ADR-0004 Amendment "braces that join around a field") | 26, done (`skeleton.ts`) |
| Open minors before the org deploy | 27, done (dev-465a068) |
| Image host check with userinfo (SF1, extension finding) | 28, in build (not in this plan) |
| 5.11 Front door of `doPost`: content type and size (SR2) | 29 (section 13.12) |
| 5.11 `client` label, `entry` for policy (SR3) | 30 |
| 5.11 `visibleLibrary` shared by `sidebar.home`, `search`, `extension.sync` | 31 |
| 5.11 `template.apply` `applyId`, `at`, `recorded`, refused-apply row (SR4b) | 32 |
| 5.11 `extension.sync` list part, etag, `rules` (SR4a) | 33a |
| 5.11 `extension.sync` bodies, paging, budgets (SR4a) | 33b |
| 5.11 Measurement run on dev (budgets) | 34 (docs only, owner runs) |

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
| B2 server-to-server pull, `READ_ONLY` write refusal (ADR-0002 Amendment, owner handover; Q27) | src/server, "Settings and backups" tab | v1.1, before the first owner change |
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

[2026-11-11: S7 passed; items 1 and 4 to 9 are slice 18, section 13.11, with the changes of ADR-0007 "Acceptance 2026-11-11" (no `via`, no prompt card, no first line).] Interim fix built in slice 10 (review PASS, dev-e2eb0ae): in the panel, rows and preview show no Insert and each card ends with the footer hint. Items 2 and 3 are built too (manifest contextual trigger, `entryOf`). The S7 harness stays in the dev build until S7 runs; items 1 and 4 to 9 wait for it.

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

Done 2026-11-11: review PASS with 9 minors and 5 accepted deviations (docs/reviews/slice-15.md), follow-up 1 PASS (minors 1, 2, 5). Deviations as built: details Insert carries no `title`; a card pushed by a row Insert carries `counted=1`; `replacesSubject(draftHasSubject)` takes one argument; the subject collapses double spaces (`oneLine`), so the double-space check of criterion 5 runs on the body; `Rendered.missing` was removed in follow-up 1. Open minors 3 (rule 2 knows ASCII punctuation only, Q76), 4 (no cap on the rendered subject, slice 20b), 6 to 9. Criterion 16 is replaced by slice 18. Planning text below.

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

Done 2026-11-11: review FAIL on two screen texts, retry 1 PASS (docs/reviews/slice-16.md). As built against the text below: the tab is "Settings and backups" (not "Config, Settings"); the Groups tab button is "Refresh groups" (not "Refresh memberships now"); a Directory failure is INTERNAL with `details.reason` `ADMIN_CHECK` (criterion 4 said SERVER); every write re-checks the caller in the lock (`lockedSubject`); a refused admin sees `ADMIN_DENIED_TEXT` (section 7.3); results carry `email`. Planning text below.

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

### 13.11 Slice 18: side-panel insert (D27, added 2026-11-11)

Done 2026-11-11: review PASS with 7 minors (docs/reviews/slice-18.md), merged 5065ba1. Part J on dev-5065ba1: 11 of 12 steps pass; Q68 and Q74 settled yes. Step 11 failed (a notification from a compose-action callback is not shown); follow-up 1 replaced every notification with a thrown sentence (section 4.1a step 7), so criteria 7, 10, 11 and 12 below now read "throws the sentence" in place of "notification", and criterion 12 has no "Details for your admin" part. Follow-up 2 (D33): with an email open each row has "Reply" and "Reply all" under its title (criterion 2 as amended). Part J step 11 rerun by the owner on 2026-11-11: Gmail shows its own error card with the sentence (Q75 closed, section 4.1a step 7). Open: the quoted earlier message in a panel reply is unconfirmed; the 100-widget limit at 69 top-level folders is closed by the list caps of slice 20b (section 7.4, worst card 84 widgets). Planning text below.

After spike S7 (passed 2026-11-11, docs/spikes/slice-10-s7.md). Spec 4.1a, 7.2, 9; ADR-0007 "Acceptance 2026-11-11"; wireframes 01 and 02 side-panel variants. No new scope, no manifest change (no trigger changes), no server change.

Files the slice owns: src/addon/** and its tests; docs/guide/user-quick-start.md (section "Use the side panel" and the known-limits line of section 7.2); docs/ops/smoke.md (new section "Slice 18"; the section "Spike S7" becomes one line pointing to docs/spikes/slice-10-s7.md); docs/ops/test-round-1.md (new part J only). Not touched: src/server/**, src/shared/model/protocol.ts, appsscript.json.

Work:
1. Remove the S7 harness (ADR-0007 A10).
2. `Reply` kind `compose` (the `GmailDraft`), rendered as `ComposeActionResponse`; a Gmail port in `Ports` (`setCurrentMessageAccessToken`, `createDraft`, `getMessageById`) so tests pass a recording fake; `tokenOf(event)` moves to event.ts.
3. Row button per entry (`inbox` "New email", `message` "Reply", `compose` "Insert"); callbacks `onCompose` (row) and `onPromptCompose` (details), both in `CALLBACKS` and src/addon/entry.ts, wrapped in one catch.
4. `previewFlow`: `template.apply` `followUp: true` for every entry; `panelPreview` and the panel's `template.getBody` call go away; `panelDetailsCard` becomes the details card with the panel differences of ADR-0007 A2.
5. Computed drafts and Gmail calls of ADR-0007 A3, A4; notifications of section 7.2.
6. `TOOLBAR_HINT` text of section 7.2.
7. Quick start lines of section 7.2; smoke "Slice 18" = test round part J below.

Acceptance criteria (each checked by a unit test, a build check or the named part J step):
1. Entry `inbox`: every row on home, folder and search cards has one button "New email", `FILLED` slate, `compose: STANDALONE_DRAFT`, action `onCompose` with `id`, `as: new`, plus `rc` when the row shows a recipient hint; screen reader "New email from <title>".
2. Entry `message`: the same rows carry "Reply", `REPLY_AS_DRAFT`, `as: reply`, screen reader "Reply with <title>". Entry `compose`: rows unchanged ("Insert", `onInsert`); the slice 15 row tests pass unchanged.
3. New email (row): `setCurrentMessageAccessToken` is the first Gmail call, with the event token; one `template.apply` without `followUp` and with `recipientEmailIfInternal: ""`; then one `createDraft(to, subject, "", options)` where `to` is the template To comma-joined, `subject` the rendered subject, `options.htmlBody` the rendered body, `cc` and `bcc` present only when not empty. The reply kind is `compose`.
4. Reply (row): `getMessageById(event message ID)`; `recipientEmailIfInternal` is the reply-to address, else the From address, inside `<...>`, lower case, only when its domain equals the caller's, else ""; `createDraftReply("", options)` with no `subject` key; the template To is in no argument; template Cc or Bcc addresses equal to the reply address are dropped.
5. Reply all (details): `createDraftReplyAll("", options)`, `recipientEmailIfInternal: ""`, `options.cc` holds only template Cc addresses absent from the reply address, `getTo()` and `getCc()` (header strings with display names and commas parse to bare addresses; test cases with `"Doe, Ann" <ann@x>`).
6. Rendering: T2 of test round 1 by row gives subject "Load" and body "Hi, load is ready." plus the phone part (the slice 15 render tests run through the panel path); blocked addresses appear in no Gmail call argument.
7. Row `rc` differs from the apply lists: notification "The recipients of this template changed. Tap its name to see them.", view cache cleared, no `createDraft*` call.
8. Details card, both panel entries: opened with one `template.apply` `followUp: true` and no `template.getBody` call; inputs as compose; no subject switch; "Add recipients" switch when the plan adds an address; no finish-typing line; the signature line; footer and last section as section 7.2; the hint last.
9. Details press: typed values win; a blank field takes the resolved value, else it is removed; "Add recipients" off gives no `to`, `cc` or `bcc` (empty `recipient` for New email); a box over 500 characters gives the notification and makes no server or Gmail call; a new version or another `rh` gives its notification and no Gmail call.
10. Each server failure code gives the section 7.2 notification and no Gmail call; DENIED and NOT_FOUND clear the view cache.
11. `getMessageById` or a header read that throws or returns null gives "This email can no longer be read. Open it again, or use New email." and no `template.apply` call. `as: reply` or `replyAll` with no message ID in the event gives "Open the email you want to answer, then press Reply again." and no call. An `as` outside `new`, `reply`, `replyAll` gives the SERVER notification and no call.
12. A throw inside `createDraft*` gives "Something went wrong. Try again. Details for your admin: <message>"; a throw after it returned gives the Drafts notification. No callback of the slice can end in an uncaught exception (test with a throwing fake per step).
13. Hint: `inbox` and `message` cards end with the new `TOOLBAR_HINT`; `compose` cards have none.
14. Harness gone: no src/addon/spikeS7.ts, no `onS7` name in src, no `s7` or `s7Error` Reply kind, no "Spike S7" text in src (grep test). Manifest unchanged: the same 10 scopes and the same 3 triggers (build check). `git diff --stat` shows no file under src/server or src/shared/model.
15. Server arguments of every panel call hold only `id`, `knownVersion`, and `recipientEmailIfInternal` or `followUp` (call log test); the `draft` object keeps its 5 keys.
16. Test round part J steps 1 to 12 run on dev; the handoff records steps 5, 6, 7 and 10, which decide Q68, Q69 and Q74.

Test round 1, part J (the implementer adds it to docs/ops/test-round-1.md after part I; Gmail web, dev build of slice 18, browser agent, about 25 minutes). Run it in Gmail's right side panel: click the Migway Templates icon in the panel on the right edge of Gmail, not in a draft's toolbar, except step 12. Needs the templates of "Templates to create once" and one automated notification message in the inbox (from a no-reply sender); open no other message. Discard every draft when its step ends; at the end, Drafts holds no draft of this part.
1. Inbox, no message open, open the add-on in the side panel. Expect: each template row has a "New email" button; the last line of the card reads "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar."; no "Spike S7" section. Record: row labels on one line, wrapped or cut.
2. Row "New email" on "T1 plain". Expect: a new email window with Subject "T1 subject", text "T1 text.", To empty. Record: the window opened (y/n); a Gmail signature is in it (y/n, expected n).
3. Row "New email" on "T6 recipients". Expect: To `test-to@<your domain>`; Cc `test-cc@<your domain>` and `test-out@example.com`; Bcc `test-bcc@<your domain>`; Subject "T6 subject"; text "Hello".
4. Row "New email" on "T2 fields". Expect: Subject "Load"; text "Hi, load is ready." followed by your phone when the directory has one; no "{{".
5. Click the name "T2 fields". Expect: a card with boxes "Load number" and "Driver name", the line 'Gmail adds your signature to replies only. In a new email, use "Insert signature" in its toolbar.', and a "New email" button at the bottom. Type `77` in "Load number" and `Ann` in "Driver name", click "New email". Expect: Subject "Load 77", text "Hi Ann, load 77 is ready.". Record: the typed values arrived (y/n).
6. Back to the list. Click the name "T3 copies", turn off "Add recipients", click "New email". Expect: no Cc and no Bcc. Record: the switch was followed (y/n).
7. Open the one automated notification message. Expect: the card reloads and rows show "Reply". Row "Reply" on "T3 copies". Expect: a reply in the conversation, To the sender, Subject "Re: ...", Cc `test-cc@<your domain>`, Bcc `test-bcc@<your domain>`, text "T3 text.". Record: the signature is there and above or below the text; click the "..." (show trimmed content) in the reply: the earlier message is quoted (y/n).
8. Same message. Row "Reply" on "T6 recipients". Expect: To is only the sender; `test-to@<your domain>` is not added; Cc both test addresses; Bcc `test-bcc@<your domain>`; Subject "Re: ...".
9. Same message. Click the name "T6 recipients". Expect: the line "A reply goes to the sender, so the template's To is not added. New email adds it."; "Reply" and "Reply all" at the bottom; a "New email" button above them. Click "Reply all". Expect: the reply keeps every Cc the message had and adds the 2 template Cc; Bcc `test-bcc@<your domain>`.
10. Same message. Double-click the row "Reply" on "T1 plain". Record: how many reply drafts opened (1 or 2). Discard all.
11. Library in a new tab: "New template" in "Smoke 6a", title "T9 temp", text `T9`, Save. In Gmail, close the message. In the panel click "Open library", close the library window, then open the folder "Smoke 6a" in the panel. Expect: "T9 temp" is listed. In the library tab delete "T9 temp". Panel: row "New email" on "T9 temp". Expect: "This template was deleted or moved. Open the panel again to update the list." and no new email. T9 stays in the trash.
12. Regression, compose toolbar: Compose, click into the text, open Migway Templates from the draft's toolbar, row "Insert" on "T1 plain". Expect: text and subject inserted as in part B.

Part H additions (by hand, owner; the implementer adds them as part J steps 13 and 14 marked "by hand"): 13. Fresh consent: "Remove access", then side panel, inbox, row "New email" on "T1 plain": record any prompt and the scopes it names (replaces part H step 2, which names the removed harness; Q55). 14. Apps Script editor, Executions: the duration of each `onCompose` run of steps 2 to 4, and the `template.apply` lines of part J carry no `test-` address, subject or text.

Decisions taken by part J: step 5 no (values lost) or step 6 no (switch ignored): Q68 fallback. Step 2 or 5 shows no window or an error: Q74 fallback. Step 7 or 9 shows an error naming a scope: owner informed; ADR-0007 A7 fallback. Step 10 two drafts: accepted (Q69).

### 13.12 Slices 29 to 34: extension surface (D41, added 2026-11-13)

Contract in section 5.11, mechanism in ADR-0010. Proposed. One concern per slice. No slice changes `appsscript.json` or `scripts/approved-scopes.json`: no new scope. SR2 and SR3 merge before any SR4 slice.

Order and parallel runs: 29 and 31 in parallel. 30 after 29 (both edit `entry.ts`). 32 after 30. 33a after 30 and 31; 32 and 33a may run in parallel, and the second to merge rebases its lines in `dispatch/dispatch.ts` and `dispatch/policy.ts`. 33b after 33a. 34 after 32 and 33b are on dev. Owner steps SR1 and SF2 run now, beside every slice.

Slice 29, front door (SR2).
- Files: `src/server/entry.ts` (`doPost`), a pure check in a new `src/server/frontDoor.ts`, `test/unit/server/entry.test.ts`, one step in `docs/ops/smoke.md`.
- Acceptance: `application/json`, `application/json; charset=utf-8` and `Application/JSON` pass. `text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`, `""` and a missing `postData` answer BAD_REQUEST "Unsupported content type". Length 262,144 passes; 262,145 answers "Request too large". One warn log line per refusal. Dev deploy, then the owner runs one Insert from the compose toolbar and one side-panel open: both work.
- Security tests: a valid `favorite.set` body sent as `text/plain` leaves `favorites.json` unchanged and calls no handler; malformed JSON as `text/plain` gets the content type message (check before parse); a refusal buffers no event and reads no Drive file.

Slice 30, surface label (SR3).
- Files: `src/shared/model/protocol.ts` (`client`), `src/shared/log/logger.ts` (`Surface`), `src/shared/model/data.ts` (`AuditSurface`), `src/server/entry.ts`, `src/server/dispatch/{handle,dispatch,context}.ts`, tests in `test/unit/server/{handle,dispatch}.test.ts` and `test/unit/shared/`.
- Acceptance: `client` absent labels `addon`; `"extension"` labels log lines and denied rows `extension`; any other value answers VALIDATION and is not logged; `rpc` labels `webapp` whatever `client` holds.
- Security tests: every `web` row of `POLICY`, sent through `handleRpc` with entry `doPost` and `client` `"extension"`, then `"addon"`: DENIED and one denied row each (table test over the live table, so a new `web` row is covered). `authorize` refuses a `web` row for any entry but `rpc`. A `@ts-expect-error` test: a `Surface` value cannot be passed as `entry`.

Slice 31, shared visible set (no behavior change).
- Files: new `src/server/handlers/visible.ts` (`visibleLibrary`, from `handlers/sidebar.ts:55-140`), `src/server/handlers/sidebar.ts`, `test/unit/server/{sidebar,search}.test.ts`, new `visible.test.ts`.
- Acceptance: every existing sidebar and search test passes unchanged. `visibleLibrary` returns folders in display order with nearest visible parent, templates in title order.
- Security tests: an admin gets no other user's private folder; deleted folders and trashed templates are out; a folder without `use` is out while its visible child shows at the top.

Slice 32, apply additions (SR4b).
- Files: `src/server/handlers/sidebar.ts` (`templateApply`), `src/server/audit/buffer.ts` (`once`), `src/server/dispatch/{dispatch,policy}.ts` (`deniedRow`, NOT_FOUND row), `src/shared/model/sidebar.ts` (`recorded`), tests in `test/unit/server/{sidebar,cache,dispatch,races}.test.ts`.
- Acceptance: shapes and rows of section 5.11. The add-on's calls (no `applyId`) answer as before, with no `recorded`.
- Security tests: the same `applyId` twice stores 1 event, both answer `recorded: true`; the same `applyId` from a second caller stores its own event; busy lock answers `recorded: false` and writes no `ap:` entry, and the retry stores; full buffer answers `recorded: false`; `at` 1 day back and 1 h ahead are clamped in the row, and the usage day and `lastUsedAt` come from server time; DENIED with `applyId` writes exactly 1 row, `targetType: template`, and no folder row; an ID absent from the index writes 0 rows; a trashed item writes 1 NOT_FOUND row; 2 refusals with one `applyId` write 1 row; a malformed `applyId` answers VALIDATION with no event and no row; every `ap:` key matches `^ap:[0-9a-f]{32}$` (no address).

Slice 33a, sync list part (SR4a).
- Files: new `src/server/handlers/sync.ts`, new `src/shared/model/sync.ts` (types), `src/server/dispatch/{policy,dispatch,handlers}.ts` (row, `checkArgs`), `scripts/build.mjs`, new `scripts/lib/rules.mjs`, `src/shared/buildInfo.ts` (`rules`), tests in `test/unit/server/sync.test.ts` and `test/unit/scripts/`.
- Acceptance: the list part of section 5.11; `bodies: []` and `more: false` until 33b (not announced to the extension before 33b merges). The etag is the same for two calls on one index; it changes on a grant, admin, setting, `IMG_HOSTS`, title or version change; it differs for two users with the same visible set. `list` is absent when the etag matches. The build hash is the same for an LF and a CRLF copy of one file; a missing listed path fails the build.
- Security tests: bad args (1,001 keys, a non-ID key, `v: 1.5`, `skip: false`, an extra arg) answer VALIDATION with 0 index and 0 Drive reads; an admin's list holds no other user's private folder; under `deny` outside addresses are in `blocked` only; no buffered event, no audit row; the log line holds no ID list.

Slice 33b, sync bodies (SR4a).
- Files: `src/server/handlers/sync.ts`, `src/server/handlers/body.ts` (batch `bd:*` read), `test/unit/server/sync.test.ts`.
- Acceptance: `page: 1` makes 0 Drive reads and answers `more: true` when a due body missed the cache; `page: 2` makes at most 25 Drive reads, stops new reads after 8,000 ms (fake clock), keeps the reply under 4,000,000 bytes, and carries at least 1 due body. Order Favorites, Recent, title. Each `html` equals what `template.apply` returns for that template.
- Security tests: a `have` key of a template the caller cannot use, with `v: 0`, returns no body; a grant removed between page 1 and page 2 gives page 2 a new etag, a list without the template and no body for it; a stored body holding `<script>` returns without it (sanitize on read).

Slice 34, measurement run (docs only). The owner runs the steps of section 5.11 "To measure" on dev; the implementer writes the steps and records the numbers in section 12.1; the architect adjusts the 4 budgets.

## 14. Spikes

| ID | Slice | Question | Pass condition |
|---|---|---|---|
| S2 | 2, first task | (a) `drive.file` token passes `/exec` with `DOMAIN`; (b) `getActiveUser` set on token calls; (c) project sharing needed; (d) token call to `/dev` works for editors; (e) Advanced Drive service works on `drive.file` alone | (a), (b), (e) yes; (c), (d) answered. Platform fact added 2026-11-11 (slice 19, found in test round 1 part D on dev): `Drive.Files.get(id, { alt: "media" })` parses the media as JSON and throws `HttpResponseException: Response Code: 200` when the file text is not one JSON document, so a JSON Lines file of 2 or more lines cannot be read through the Advanced service. Month files and backup copies are read with Drive REST media through `UrlFetchApp` (`readRawText`); ADR-0002 Amendment 2026-11-11 (slice 19). docs/spikes/slice-02-s2.md is not changed by this run |
| S2b | 2 | UrlFetch round trip to `/exec`, add-on start time, Drive read and write of 0.85 MB and 8.4 MB files, `domain_public` fields | p95 recorded in ADR-0002; 0.85 MB read and write each under 2 s (Q17) |
| S4 | 4, first task | Draft insert on Gmail web (ADR-0004 table) | Resolved 2026-11-10: F1 to F9 inserted on Gmail web, 204,837 bytes (F7) included. Allowlist unchanged, cap 100 KB. Android and iOS runs dropped by the owner (D22). Harness removed in slice 5 |
| S5 | 5, first task | Body and subject actions in one `UpdateDraftActionResponse` on Gmail web; subject replaced, not appended; reply drafts (Q20, Q21) | Resolved 2026-11-10 on dev-32a446c: body and subject in one response, no new scope (Q20 closed). A replaced reply subject started a new thread; the event carries no `threadId` or `messageId` (dev-4a233d4). Rule D24 (section 5.6) keeps any filled subject; smoke "Slice 5c" on dev-848206f: the reply stayed in its conversation (Q21 closed) |
| S6 | 9, first task | Body, subject, To, Cc and Bcc actions in one `UpdateDraftActionResponse` on Gmail web; add or replace; new draft, typed recipients, reply, forward; address already present; permission prompt | Passed 2026-11-10 on dev-ec0ccb2 from the compose toolbar (docs/spikes/slice-09-s6.md): all 5 actions apply from one response with no prompt; actions replace a field, so the build sends the draft list plus the new addresses (decision table row 2); event lists are arrays of bare addresses. Step 7 (fresh consent) run by hand by the owner on dev, 2026-11-11 (errata run 6): one consent page, 9 checkbox lines, then an Insert with recipients and no second prompt; D26 needs no new scope (Q55 closed) |
| S7 | Gmail panel pass, first task | Compose actions from the side panel: new draft, reply, reply all; scopes; signature; open compose window (D27) | Passed 2026-11-11 on dev-56bf795 from the side panel (docs/spikes/slice-10-s7.md): New email, Reply and Reply all made drafts with HTML body, subject and recipients, no prompt; Reply all `cc` adds; signature in replies only; a notification works from a compose action; an open window keeps its text. Fresh consent run 2026-11-11 (Q55 closed, section 9). Open: callback ms. Build: slice 18. Part J on dev-5065ba1 (2026-11-11): form inputs reach a compose-action callback (Q68 yes); compose actions work on `DecoratedText` row buttons and `FixedFooter` buttons (Q74 yes); a notification returned by a compose-action callback is not shown (step 11), so failures throw one sentence |

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

Result (owner run, dev-ec0ccb2, compose toolbar, 2026-11-10): step 1 all 5 applied, Bcc line opened; step 2 replace (typed To and Cc gone); step 3 all 5 addresses once; step 4 one chip, a response with only a recipient action works; step 5 reply kept its To and gained Cc and Bcc; step 6 forward To filled; step 8 each list is a JSON array of bare addresses in `draftMetadata`, and `gmail` repeats only the non-empty lists. Step 7 not run in that session; run by hand on 2026-11-11 (section 9, Q55 closed). Build: row 2 of the table above. The two earlier runs (dev-c1c7f16, dev-ec0ccb2) came from the side panel and changed no draft.

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

Result (owner, test round 1 part G, dev-56bf795, 2026-11-11): steps 2 to 8 pass; step 4 add; step 5 signature in the reply only; step 1 (fresh consent) and step 9 (form inputs) not run; callback ms not measured. Decision table row 1 with the changes of ADR-0007 "Acceptance 2026-11-11". Record: docs/spikes/slice-10-s7.md.

## 15. Open questions for the owner

Still open after errata run 7 (2026-11-12), plus Q98 to Q104 from the extension requests (2026-11-13, ADR-0010). Every other row below is closed or has its default built.

| ID | Question | Default in force | Who answers |
|---|---|---|---|
| D1 | Who performs the Workspace admin steps of 2.5b | The owner's Workspace admin | owner |
| D2 | User count, pilot group | Under 500 users, one pilot Google Group | owner |
| D7, Q1 | Workspace edition, nested groups, admin API limits | Business Standard or lower, flat groups | owner or Workspace admin |
| Q22 (D23) | Apply speed target | 3 s p95 accepted for v1; measure on prod `/exec` | owner |
| Q18 | Prod data in My Drive or a shared drive | The dedicated owner account's My Drive | owner |
| Q25 | Subject-only fields asked while "Replace the subject" is off | Accept | owner |
| Q27, Q28, Q29 | Owner-change tooling (B2 pull, tests V1 to V4, versions moved) | v1.1; V1 to V4 in the 2.5b dry run | owner, orchestrator |
| Q30 | Dev templates to prod | Prod starts empty; interim runbook if data must move | owner |
| Q31 | Owner-run `restoreBackup(date)` | Manual runbook of section 16.2 | orchestrator (slice) |
| Q76, Q77, Q79, Q84 | Gap rule 2 ASCII only; no notice on a row Insert; double search run; reply count high | Accept for v1 | owner |
| Q80, Q81 | `toIcon` try/catch; toast before `setup()` | Fix in a minor slice (Q80), accept (Q81) | orchestrator (slice 27 may hold them) |
| Q82 | Per-scope consent checkboxes on self-install | Admin install for every user, which grants all scopes with no page | Workspace admin |
| Q83 | Error icon the only cue besides red | Keep the icon | owner (look in Gmail) |
| Q85, Q93 | Empty date picker; "Choose..." shown first | Start empty; "Choose..." selected | owner (look in Gmail) |
| Q87 | Date for UTC+12 and later | Accept for v1 | owner |
| Q98 (D42, D41) | Template To, Cc, Bcc and `blocked` in `extension.sync` and in the extension's local copy (reverses "counts only" for the extension; the extension session reports the owner said yes on 2026-11-13) | Confirm as D42: the addresses are what a `use` holder already sees on the cards; the copy is wiped after 7 days; the add-on keeps counts only | owner |
| Q99 (SR4b) | Client time `at` of an apply | Server time for usage, Recent and every audit `ts`; `at` kept only as `after.claimed.at` on a refused-apply row. A late event counts on its arrival day | owner (accept) |
| Q100 (SF2) | Is Script Property `IMG_HOSTS` set on dev? | Owner reads it in the dev project's Script Properties. Empty: SF2 closed with no report (any https host was allowed, so nothing bypassed a list). Set: Export library and search the file (section 5.11) | owner |
| Q101 (SR1) | Who refreshes the extension test deployment after a dev deploy | The owner, only when an extension handoff names a server slice it needs (Manage deployments, edit, New version); else it stays on its version | owner |
| Q102 (SR4a) | `extension.sync` also callable from the web app (`both`) | Accept: same caller, same filter, nothing beyond `template.list` plus `template.getBody`; no third surface kind | owner (accept) |
| Q103 (SR2) | Ship slices 29 and 30 before the org deploy (2.5b) even if the extension waits | Yes: the CSRF finding holds without the extension; the dev add-on smoke of slice 29 guards the rollout | owner |
| Q104 (SR4b) | An apply counted twice after a Script Cache eviction of the caller's `ap:` key or a retry after 6 h | Accept: usage counts are informational; the key holds the caller's last 100 apply IDs | owner (accept) |
| Q89, Q90, Q96 | Rollback and old open pages | Accept; runbook line | orchestrator |

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
| Q16 | Advanced Drive service on `drive.file` alone | Spike S2 (e): yes. Since slice 19 both clients also use Drive REST media through UrlFetch for text that is not one JSON document (`readRawText`); `https://www.googleapis.com/drive/v3/` is in `urlFetchWhitelist` in every environment |
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
| Q40 (D27) | Add a contextual trigger (`unconditional`) so the side panel knows the open message and offers Reply | Resolved 2026-11-11 (S7): built in slice 10; `onMessageOpen` runs with the message ID and no prompt. Fresh consent still by hand (Q55) |
| Q41 (D27) | Gmail signature in drafts made from the side panel | Resolved 2026-11-11 (S7 result 4): Gmail adds it to replies, not to a new email. No scope; the details card and the quick start say how to add it to a new email (ADR-0007 A5) |
| Q42 (D27) | Row button with a message open: "Reply" or "Reply all" | Resolved: "Reply"; the details card has "Reply" and "Reply all" in the footer and "New email" below (ADR-0007 A2) |
| Q43 (D27) | A panel draft the user discards still counts as a use | Resolved: yes, one use per press that reaches `template.apply` (ADR-0007 A6) |
| Q44 (D27) | If S7 shows `createDraft` needs `https://mail.google.com/` | Resolved: it does not. S7 made all 3 kinds of draft under the 10 scopes. The scope stays banned |
| Q45 (D27) | Reply all if `options.cc` replaces Gmail's copied Cc | Resolved: it adds (S7 result 3). Only the template's new Cc go in `options.cc` (ADR-0007 A4) |
| Q46 (D27) | Forward from the side panel | Not in v1. `ComposedEmailType` has no forward type [A31]; forward from Gmail and use the toolbar. Quick start says so |
| Q47 (D29) | Dev reads as `off` after the slice 11 deploy (no settings stored), so the owner and pilot users lose personal creation on dev | Accept. The owner turns it on in Admin, "Settings and backups" if the pilot needs it; prod starts `off` as D29 says |
| Q48 (D29) | While off, owners cannot delete or move their own personal templates, and admins drop to `use` on private folders (one level rule) | Accept. An admin who must clean up or promote a personal template turns the switch on, does the work, turns it off; both changes are audited. The alternative (admins keep `manage`, 7 per-op target checks) costs more code and tests |
| Q49 (D29) | A third setting now (candidates: `IMG_HOSTS`, `LOG_LEVEL`, admin group) | No. `IMG_HOSTS` and `ADMIN_GROUP` are security config and stay owner-set in Script Properties; `LOG_LEVEL` is for the owner. A new setting is one row in the fixed list when asked |
| Q50 (D29) | `RECIPIENTS_EXTERNAL` set on dev before slice 11 is ignored afterwards | No fallback code (built: no code reads the property). The slice 11 smoke checks the dev property; the owner deletes it and sets the value in Config > Settings if it was `deny` |
| Q53 (slice 13) | A switch to `deny` during an import (between the first check and the lock) refuses the whole file; the normal `deny` path drops the address and imports | Accept. The race needs an admin to flip the switch during another admin's import; nothing is written and the text says to run it again, which then drops the address |
| Q54 (slice 9) | `rh` covers the template lists, not each draft field's known or unknown state. A card built with Cc unknown, tapped with Cc known, adds the Cc address the card listed under "Add by hand" | Accept. The address was shown on the card and no draft address is lost. Adding the state to `rh` costs one more card re-render in a case the owner's Gmail runs never produced |
| Q55 (S6) | Spike S6 step 7: a fresh consent run with recipient actions | Closed 2026-11-11 (owner on dev, errata run 6): one consent page with 9 checkbox lines, then Insert with recipients and no second prompt. No scope outside the 10. New fact: per-scope checkboxes (Q82) |
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
| Q67 (D27) | Log which panel button made a draft (`via`: new, reply, replyAll) | No. It needs a protocol and server change; nothing reads it. `draft.fields` already tells compose (`draftMetadata`) from the panel with a message open (`messageId`) |
| Q68 (D27) | A compose-action callback may not receive the details card's boxes and switch (S7 step 9 not run) | Closed 2026-11-11: yes, in the owner's Gmail (part J steps 5 and 6). Typed values and the switch reach the press; the fallback is not needed |
| Q69 (D27) | Two quick presses may open two drafts and count two uses | Accept, no guard. Nothing is sent; the user discards one. A 5 s guard would also refuse a wanted second email. Part J step 10 records Gmail's behavior |
| Q70 (D27) | "New email" does not fill the recipient first name from the template's single To | Accept. It would need a second server call per press or an address in card parameters. Reply fills it from the person replied to; Reply all, like a draft with several To, does not |
| Q71 (D27) | No "Replace the subject" switch in the side panel | Accept. A new email always gets the template subject; a reply always keeps "Re: ..." (D24). The user edits the subject in the window that opens |
| Q72 (D27) | Row counts that changed give a notification, not the details card | Accept. Pushing a card from a compose action is unverified; the notification is verified (S7). The user taps the name and sees the new addresses |
| Q73 (D27) | Reply all: a template Cc already in the conversation, or equal to the user's own address, is not added | Accept. The address is on the email already, or Gmail leaves the sender out of a reply all |
| Q74 (D27) | A compose action on a row button (`DecoratedText`) and on a footer button (`FixedFooter`) is unverified; S7 used a `ButtonSet` | Closed 2026-11-11: yes, in the owner's Gmail (part J steps 2 and 5). Since D33 the rows with an email open use a `ButtonSet` under the title |
| Q75 (slice 18 follow-up 1) | How Gmail shows the sentence thrown by a failed side-panel action (error bar look, a prefix such as "Exception:", footer button same as row) | Closed 2026-11-11 (owner on dev): Gmail's own error card, "Error with the add-on. Run time error.", the sentence, "[line: n, function: panelAnswer, file: Code]". Accepted as is (section 4.1a step 7) |
| Q76 (slice 15 minor 3) | Gap rule 2 removes the space before ASCII `, . ; : ! ?` only; full-width and Arabic marks and Spanish `¡` keep the space | Accept for v1. Migway writes in English. Extend the list when a template in another script is reported |
| Q77 (test round 1 part B step 6, slice 17 note) | A row Insert gives no notice when it leaves out an outside address (`deny`) or skips the template To because the draft has one; the details card names both | Accept for v1. An insert response cannot carry a notice [A15, A44]; the row hint counts only the addresses that are added. Owner's judgment; the alternative is to open the details card in those cases, one more click |
| Q78 (slice 20b minor 7, errata run 6) | `{{{ask:N}}{ask:M}}` saved and put the text `{{ask:M}}` into a draft | Closed 2026-11-12: owner decision D40, option 1 ("yes, refuse but if u think there is a better choice please apply it"). Built in slice 26 (`skeleton.ts`). No better choice found: errata run 7 confirms the two refusals the review named (`<p>{</p><p>{</p>` and `{ {{ask:N}} {`) are the costs the ADR accepted |
| Q79 (slice 22 review item 3) | One press of "Search" right after typing can run `onSearch` twice (the box loses focus, then the button fires) | Accept for v1. `search` only reads; the worst case is 2 server calls and the same card drawn twice. Record the run count in part L step 2 (Executions); fix only if users notice a flicker |
| Q80 (slice 22 follow-up 1 minor 1) | `toIcon` has no try/catch (`src/addon/cards/render.ts:98`): a throwing `setMaterialIcon`, `setAltText` or `setStartIcon` breaks every card with a hint or error line | Fix in the next add-on slice: build the icon in a try/catch and call `setStartIcon` only when it built, as `toButton` does. Low risk today: Gmail has drawn start icons since slice 12, and the owner saw the hint icons on dev |
| Q81 (slice 20a re-review minors A and B) | Before `setup()` the first load shows the banner and one toast with the same sentence (`profile.me` in `src/web/app.ts:389` uses `app.fail`); with Trash as the first page its own `template.list` adds a toast under the banner | Accept for v1: only an admin sees it, once, before setup. Cheap fix for a later web slice: skip the toast when the first-load banner shows the same code |
| Q82 (owner's consent test, 2026-11-11) | The self-install consent page has a checkbox per scope; an unticked scope breaks the add-on | Install by the Workspace admin for every user (phase 2.5b), which grants all scopes with no page. Add one quick-start line for self-installers: "Keep every box ticked on Google's consent page." What a user with an unticked scope sees was not recorded |
| Q83 (slice 22 follow-up 1 minor 2) | Error lines carry no "(!)" since follow-up 1; the `error` icon is the only cue besides red | Keep the icon. Part L step 3 records whether Gmail draws it; if not, put the "(!) " prefix back |
| Q84 (slice 20b minor 1) | "A reply adds n recipients." counts a template Cc that is already on the email, so it can be 1 or more too high | Accept for v1 (the press adds the right addresses; only the label is high). Fix later by reading the message headers when the details card opens, or word it "Adds up to n recipients." |
| Q85 (D38) | Can Gmail draw a `DatePicker` with no date? | Open, no problem seen: the owner's test (dev-e93a085) left a date unpicked and the field was left out; whether the picker showed empty was not reported. Default in force: start empty. Part N step records it |
| Q86 (D38) | Picker in the draft popup and the side panel; `dateInput` in `onPromptInsert` and `onPromptCompose` | Closed 2026-11-12: yes, owner on dev-e93a085 (calendar shown in both, the picked day in the draft) |
| Q87 (D38) | `msSinceEpoch` of a date-only pick: time of day not documented | Partly answered: the owner's pick came back as the same day in the owner's time zone (dev-e93a085). Open for other zones: UTC+12 and later get the day before if Gmail sends local midnight. Default: accept for v1 (Migway staff are not in those zones, opinion); recheck if a user there reports it |
| Q88 (D38) | Editor entry: one dialog with a type choice, or a second menu item | Closed: built as the menu item "Ask the sender for a date..." (slice 25); the owner tested it without remark |
| Q89 (D38) | A rollback below the date build inserts `{{date:X}}` (and since slice 26 `{{choice:...}}`) as plain text | Accept. Runbook line: after the first date or choice template is saved, roll back only to e93a085 or later, or first replace those fields |
| Q90 (D38) | A library page opened before the deploy shows a date or choice token as plain text with a Problems line; its save still works | Accept: a page reload fixes it |
| Q91 (D39) | A choice left at "Choose...", and a choice on a row Insert | Closed 2026-11-12, owner: left out, "so user would have to type in manually, we dont give false options". Built in slice 26 |
| Q92 (D39) | Dropdown in the draft popup and the side panel; value in the Insert callbacks | Closed 2026-11-12: yes, owner on dev-e93a085 (dropdown shown in both, the chosen option in the draft) |
| Q93 (D39) | Does Gmail show "Choose..." as the selected first item? | Open, no problem seen: an unchosen field was left out in the owner's test; the look of the first item was not reported. Default: value "0", selected. Part O step records it |
| Q94 (D39) | Editing the options of a chip already in the text | Closed: built in slice 26, "Edit choices..." edits the field name and the options |
| Q95 (D39) | The limit holds only at Insert; the draft stays editable; the web app server never sees the answer | Closed: built as recommended; the owner's idea said "at least once editing the template in the UI" |
| Q96 (D39) | Old builds during a deploy | Accept, as Q89 and Q90 |
| Q97 (D39) | Build the choice field now or later | Closed 2026-11-12: built in slice 26 on the owner's decision |
| Q31 | A damaged live `index.json` blocks every op, `backup.restore` included | Owner-run editor function `restoreBackup(date)` with the `setup()` guard, before 2.5b if possible; until then the manual runbook of section 16 |

## 16. Operations and maintenance

Target (BRIEF 1 Operations): the only recurring human task is deploying a new version. Details in ADR-0003 Part B (triggers) and ADR-0005 (Maintenance).

Settings (D29, section 5.8): `setup()` writes none. A fresh install reads the defaults: personal templates `off`, outside recipients `allow`. A second `setup()` run never resets an admin's choice.

Triggers. All time-driven, owned by and running as the owner. `setup()` installs them idempotently; the owner runs it once per environment after the first deploy. The trigger version check (amended 2026-11-10, slice 4b) runs in `doGet` and at the end of every `tick`; `rpc` and `doPost` skip it. It reads `TRIGGERS_VERSION` live inside the script lock and reinstalls when it differs, so after a deploy the triggers update on the first web app page load or within 5 min through `tick`, whichever comes first. Limit: a release that renames or removes the `tick` handler needs one web app page load.

Reinstall order (Q23, built in slice 6a, hardened in 6b): create the 3 new triggers, then delete every old one. A failed create deletes the new ones it made, keeps the old set, writes `job:triggers:lastError` and leaves `TRIGGERS_VERSION` stale, so the next check retries. A failed delete still deletes the others, then throws; the next run leaves 3. The tab "Settings and backups" shows "The background jobs could not be set up again: <error>" while `TRIGGERS_VERSION` is stale.

| Trigger | Schedule | Work | Runtime per day (estimate) |
|---|---|---|---|
| `tick` | every 5 min | apply events to `usage.json`, denied events to `pendingAudit`, cache re-put before the 6 h TTL, early audit flush above 200 KB | about 10 min |
| `refreshMembers` | every 15 min | membership snapshot to `members.json` and cache | about 16 min |
| `daily` | once a day, 02:00 to 03:00 script time zone | audit roll to `audit/YYYY-MM.jsonl`, trash purge after 30 days, orphan body cleanup, backup (14 kept), audit retention 24 months, job health | about 1 min |

Total about 27 min per day against the 6 h trigger budget; 3 of 20 allowed triggers [R4 S2]. The Admin tab "Settings and backups" shows the last good run per job under its screen name ("Save insert counts and refused actions", "Refresh groups", "Nightly backup and cleanup", raw name in small type) and flags a job late by more than 2 intervals.

Job errors (slice 19 retry 1, ADR-0002 Amendment 2026-11-11, slice 19): `job:<name>:lastError` holds "<time> <code> <error name>", or for `daily` "<time> daily steps failed: <step> (<code>)", at most 500 characters. A platform error message is never stored, shown or rethrown, because it can quote file text. A success deletes `lastError`. The runbook (docs/ops/runbook.md, "Required after deploying this build") names the check of the 4 `lastError` properties after the deploy of slice 19.

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

- Admin, tab "Settings and backups", section "Backups", button "Restore" on a date. The confirmation names the date; Cancel has focus.
- The server reads the 3 copies (`index.json`, `favorites.json`, `usage.json`) and runs the shared shape check before the lock. A missing, unparsable or damaged copy answers VALIDATION "This backup cannot be read: <file> ..."; live files stay untouched.
- Under the lock: admin re-check; refusal when the backup holds templates emptied from the trash since that date ("Not restored. <n> templates in the backup of <date> were deleted for good after that day and would not open. Pick a newer backup."). The automatic purge needs 30 days in the trash and backups go back 14, so only a manual "Empty trash now..." can cause it.
- Writes `favorites.json`, then `usage.json`, then `index.json` last as the commit point (`rev = current + 1`, current `pendingAudit` kept). A failure before or during the index write puts the side files back. One `backup.restore` audit event.
- The live `settings` object is kept, like `pendingAudit` (D29, ADR-0008). The event `after` says so: `liveSettingsKept: true`.
- The same shape check runs on every Drive read of the live files. A damaged live file answers INTERNAL "<file> is damaged: <problem>" on every op that loads it; a live file that is not JSON answers "<file> is not valid JSON" (the Advanced read throws, then one raw read; slice 19 retry 1). Backup copies are read raw, so a damaged copy answers VALIDATION "This backup cannot be read: ...".

### 16.2 Recovery from a damaged live file (runbook input, slice 7)

A damaged live `index.json` answers INTERNAL on every op, `backup.restore` included: dispatch loads the index first. `backup.list` still answers. Q31 recommends an owner-run `restoreBackup(date)`; until it exists the owner runs these steps:

1. Drive, as the owner: open `Migway Templates Data/backups/`, pick the newest date, download its `index.json`.
2. Open the live `Migway Templates Data/index.json`, File information, Manage versions, Upload new version, pick the downloaded file [A24 in ADR-0002]. Do not upload it as a new file and do not make a copy: a file the app did not create is invisible to it (`drive.file`).
3. Apps Script editor, as the owner: run `setup()`. It is idempotent; it reads `index.json`, republishes `INDEX_REV` and the cache, and reinstalls triggers.
4. Web app: open the library and the Admin tab "Settings and backups"; check `INDEX_REV` under "Technical details" and the template count.
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
