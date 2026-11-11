# Wording (slice 14)

Rule set: `docs/design/design-system.md`, section "Wording". This file holds the glossary and every text changed in slice 14.

Readers: office staff of a trucking company (recruiters, dispatchers, safety, accounting). Non-technical. English is a second language for many. Admins are one or two office people, also non-technical.

## Rules in use

1. One name per thing, one verb per action (tables below).
2. A button says what happens. Busy text and result follow its verb: "Give access", "Giving access...", "Gave access to ...".
3. An error says what happened and what to do, in one or two sentences. No apology words, no exclamation marks.
4. Sentence case. No all caps. No em or en dashes. A status line and a toast end with a period.
5. An empty state says what belongs here and how to start.
6. Raw technical names appear only under "Technical details" (web) and in the line "Details for your admin: ..." (Gmail panel).
7. One state, one text on every surface. Busy: "The library is busy. Try again in a few seconds." Too many requests: "Service is busy. Try again in a minute." Deleted: "This template was deleted or moved."

## Things

| Term on screen | Meaning | Not used on screen |
|---|---|---|
| template | one saved email text with title, subject, text, tags and recipients | item, record |
| title, subject, text | the three parts of a template | body (one exception below), HTML |
| folder | holds templates and subfolders | |
| My templates | each person's own folder, by the name users see. Every error names it this way: 'The folder "My templates" cannot be deleted.' | private folder, personal folder (in errors) |
| personal folder, personal templates | the kind of folder and the setting, on admin screens only, and always next to the owner or "(each user's My templates)" | private |
| library | the web page with all templates | web app |
| panel | Migway Templates inside Gmail | sidebar, add-on, card |
| field | a blank in a template that gets a value at insert, and nothing else | placeholder, token, chip, variable |
| To, Cc and Bcc; recipients | the address boxes of a template and their addresses | field (for an address box) |
| field the sender fills in | a field whose value the sender types at insert ("Ask the sender...") | prompt, question |
| field name | the name the sender sees above the box | label, prompt label |
| default text | the text a field shows when its value is unknown | fallback |
| sender | the person who inserts a template and sends the email | user (in the editor and the panel) |
| user | any person with a Migway account (admin screens) | actor, caller, principal |
| admin | a person who manages the whole library | owner |
| folder manager | a person with "Can manage" on a folder | manage holder |
| access | who may use, edit or manage a folder | grant, permission, level, principal |
| Can use, Can edit, Can manage | the three kinds of access | use, edit, manage as bare words; level |
| group, user, domain, org unit | who can get access | principal type, OU |
| Groups (tab) | the Google Groups the app reads | memberships, resolver, refresh set |
| version, History | saved states of a template | revision |
| trash | where deleted templates stay 30 days | |
| audit log, entry | the list of who did what, and one line of it | event, row |
| insert count | how often a template was inserted | usage count, applies |
| setting | a switch an admin sets ("Personal templates", "Outside recipients") | config, property |
| Settings and backups (tab) | settings, technical details, background jobs, backups | Config, Environment |
| background job | work the app does by itself on a schedule | trigger, tick |
| backup | the nightly copy of the library data | |
| export file | the file an export downloads and an import reads | JSON, payload, schema |
| Request ID | the code to send to the admin with a problem report | |

## Actions

| Verb on screen | Action | Not used for it |
|---|---|---|
| Insert | put a template into a draft | apply, use |
| New email, Reply, Reply all | start a new draft from a template in the side panel (Gmail's own words) | Insert, Send, Compose |
| Save | store the template as a new version | update, write |
| Delete | move a template to the trash, or delete a folder | remove |
| Delete for good | what Empty trash and the 30 days do | purge, remove for good |
| Remove | take one thing off a list: a tag, an address, access, a favorite | delete |
| Restore | bring back a template from the trash, an older version, a backup | recover |
| Move, Rename, Duplicate, Create | as named | |
| Give access, Remove access | add or end a group's, user's or domain's access to a folder | add grant, remove grant, share |
| Export, Import, Check file | download templates, add them from a file, test a file first | validate, dry run |
| Refresh | load fresh data ("Refresh groups", "Refresh" in the panel) | sync, resolve |
| Reload | load the browser page again | refresh the page |
| Retry | the button that repeats the action that failed; in sentences "try again" | |
| Filter | show the audit entries that match | apply |
| Close | close a drawer or a message | dismiss |
| Turn on, Turn off | change a setting | enable, disable |
| Keep editing, Discard changes, Save and leave | the three answers of "Leave without saving?" | |

## Words that never appear on screen

grant, principal, level (alone), op, operation, payload, index, token, RPC, DENIED and every other error code, sanitize, surface, manifest, resolver, trigger, tick, OU, v1, JSON, schema, dry run, record, placeholder, prompt, fallback, chip, snippet, sidebar, web app, Apps Script, script owner, private.

Exceptions, on purpose:

- "Technical details" in Admin shows raw names (`ADMIN_GROUP`, `INDEX_REV`, the internal name of an audit action, raw job names in small type). The runbook finds things by these names.
- The Gmail panel shows "Details for your admin: ..." with the raw network message. `docs/ops/deploy.md` step 10 needs it.
- "Insert body only" stays in the panel. "Insert text only" reads as "plain text, no formatting".
- "Audit log", "Denied", "Conflict", "Error" stay: short result words that staff of a regulated business know. Conflict means someone else saved first.
- Messages for requests the screens cannot send (wrong argument type, unknown op, a damaged data file) keep their developer wording: `src/server/dispatch/args.ts`, `dispatch.ts` (unknown op), `handle.ts`, `shared/model/shape.ts`, `shared/model/settings.ts`, `grants.ts` (type and level names), `config.ts` (setting name and value checks), `audit.ts` (filter formats), `storage/*`, `membership/*`, `jobs/*`.

## Admin-only actions refused (slice 16 retry 1)

A DENIED answer to an admin-only action means the caller lost admin after the page loaded. Text, decided by the orchestrator 2026-11-11: "You are no longer an admin, so nothing was changed. Ask an admin if you need access." (`ADMIN_DENIED_TEXT`, `web/ui/status.ts`). It replaces "You don't have access to this template. Ask a folder manager." on: Add admin, Remove admin, Settings Save, Restore a backup, Export of the whole library, Import and Check file, Empty trash, Refresh groups. Actions open to folder managers (folder and access changes, folder export, restore from trash) keep the folder text.

## Changed texts (220)

`{name}` stands for a value filled in at run time. A cell with " / " lists the texts of one source line. Paths are relative to `src/`. Tests and guides quote the new texts; `src/web/dev-harness.ts` repeats the server texts and is not listed.

Not a text, changed in the same slice: recipient chip announcements ("Added ... to To.") moved from the visible status line to a screen-reader-only live region (`web/views/editor.ts`, defect a).

### Web app: admin screens (108)

| Where | Old text | New text | Reason |
|---|---|---|---|
| `web/admin/actions.ts` | Template moved to trash | Template deleted | one verb: Delete moves a template to the trash |
| `web/admin/actions.ts` | Template body read | Template text read | one name: the template text |
| `web/admin/actions.ts` | Grant added | Access given | "grant" becomes "access" |
| `web/admin/actions.ts` | Grant removed | Access removed | "grant" becomes "access" |
| `web/admin/actions.ts` | Grants listed | Access list viewed | "grant" becomes "access" |
| `web/admin/actions.ts` | Removed from trash for good | Trash emptied | follows the button "Empty trash" |
| `web/admin/actions.ts` | Memberships refreshed | Groups refreshed | the tab is named "Groups" |
| `web/admin/actions.ts` | Memberships viewed | Groups viewed | the tab is named "Groups" |
| `web/admin/actions.ts` | Config viewed | Settings viewed | the tab is named "Settings and backups" |
| `web/admin/actions.ts` | Audit events dropped | Audit entries lost | "event" becomes "entry"; "dropped" becomes "lost" |
| `web/admin/actions.ts` | Admin view opened | Admin opened | one name per surface: Admin, Gmail panel, library |
| `web/admin/actions.ts` | Gmail sidebar opened | Gmail panel opened | one name per surface: Admin, Gmail panel, library |
| `web/admin/actions.ts` | Web app opened | Library opened | one name per surface: Admin, Gmail panel, library |
| `web/admin/actions.ts` | Triggers installed | Background jobs set up | "trigger" is an internal word |
| `web/admin/actions.ts` | Empty the trash? {what} removed for good, and deleted folders go too. This cannot be undone. | Empty the trash? {what} deleted for good, and so are deleted folders. This cannot be undone. | Remove is for lists; what cannot be restored is "deleted for good" |
| `web/admin/actions.ts` | Emptied the trash: {plural(templates, "template")} removed for good. | Emptied the trash: {plural(templates, "template")} deleted for good. | Remove is for lists; what cannot be restored is "deleted for good" |
| `web/admin/actions.ts` | Emptied the trash: {plural(templates, "template")} and {plural(folders, "deleted folder")} removed for good. | Emptied the trash: {plural(templates, "template")} and {plural(folders, "deleted folder")} deleted for good. | Remove is for lists; what cannot be restored is "deleted for good" |
| `web/admin/model.ts` | OU | org unit | "OU" is an internal word |
| `web/admin/model.ts` | Inactive: OU resolution needs the Directory resolver | Not active yet. Org units do not give access in this version. | "OU" is an internal word |
| `web/admin/model.ts` | OU path, for example /Field. Stored, inactive in v1 | Org unit path, for example /Field. Saved, but not active yet. | "OU" is an internal word |
| `web/admin/model.ts` | Users can no longer create, change or delete templates in My templates. Their existing personal templates stay and can still be inserted. Nothing is deleted. Turning it on again restores everything. | Users can no longer create, change or delete templates in My templates. Nothing is deleted: their templates stay, can still be inserted, and can be changed again when you turn this on. | two sentences, the reassurance first |
| `web/admin/model.ts` | Templates can add addresses outside {domain} to To, Cc and Bcc. When off, saving such an address fails and Insert skips it. | Templates can add addresses outside {domain} to To, Cc and Bcc. With "{domain} only", a template with an outside address cannot be saved and Insert skips the address. | the options are "Allowed" and "domain only", so "when off" named nothing on screen |
| `web/admin/model.ts` | Templates keep their outside addresses, but Insert no longer adds them and saving a template with one fails until the address is removed. | Templates keep their outside addresses, but Insert no longer adds them. A template with an outside address cannot be saved until the address is removed. | the options are "Allowed" and "domain only", so "when off" named nothing on screen |
| `web/admin/model.ts` | Validated. Import would create | Checked. Import would create | button "Check file", result "Checked" |
| `web/admin/model.ts` | {path} (inherited) / a parent folder (inherited) | {path} (parent folder) / a parent folder | "inherited" in plain words, under the column "Set on" |
| `web/views/admin.ts` | Folders and grants | Folders and access | "grant" becomes "access" |
| `web/views/admin.ts` | Memberships | Groups | the tab lists Google Groups |
| `web/views/admin.ts` | Config | Settings and backups | "Config" is an abbreviation; the tab holds the settings and the backups |
| `web/views/admin.ts` | You don't have access to the admin view. It is for admins and folder managers. | You don't have access to Admin. It is for admins and folder managers. | one name for the page: Admin |
| `web/views/admin.ts` | The admin view could not be loaded. Use Retry in the message, or reload the page. | Admin could not be loaded. Press Retry in the message, or reload the page. | one name for the page: Admin |
| `web/views/adminAudit.ts` | Source: the month's audit file plus events not yet rolled (daily). Denied and apply events can arrive up to 5 min late. | Refused actions and inserts can take up to 5 minutes to show here. An export entry records the start of an export, not that the file was downloaded. | internal words (rolled, apply); says what an export entry means |
| `web/views/adminAudit.ts` | Actor | User | "actor" is an internal word |
| `web/views/adminAudit.ts` | Target | Template or folder | "target" is an internal word |
| `web/views/adminAudit.ts` | {label} JSON | {label}, raw data | "JSON" is an internal word |
| `web/views/adminAudit.ts` | Event details | Entry details | a log holds entries |
| `web/views/adminAudit.ts` | Loading event details... | Loading entry details... | a log holds entries |
| `web/views/adminAudit.ts` | Audit events | Audit entries | a log holds entries |
| `web/views/adminAudit.ts` | Page {data.page + 1}: events {first + 1} to {first + data.rows.length} of {data.total}. | Page {data.page + 1}: entries {first + 1} to {first + data.rows.length} of {data.total}. | a log holds entries |
| `web/views/adminAudit.ts` | No audit events in {data.month} match these filters. | No audit entries in {data.month} match these filters. Change the filters and press Filter. | a log holds entries |
| `web/views/adminAudit.ts` | Audit events of {data.month} | Audit entries of {data.month} | a log holds entries |
| `web/views/adminAudit.ts` | Loading audit events... | Loading audit entries... | a log holds entries |
| `web/views/adminAudit.ts` | Operation | Internal name | "operation" is an internal word; the raw name stays under Technical details |
| `web/views/adminAudit.ts` | Apply | Filter | the button says what happens; "apply" is the internal word for insert |
| `web/views/adminAudit.ts` | The audit log could not be loaded. Use Retry in the message. | The audit log could not be loaded. Press Retry in the message. | one phrase for the Retry button |
| `web/views/adminAudit.ts` | Target (second use, under Technical details) | Internal ID | the raw value sits next to the internal name |
| `web/views/adminAudit.ts` | {user} (manage), the bare level, or (no level) | {user} (Can manage), (Can edit), (Can use), (admin) or (no access) | the audit drawer uses the words of the access table |
| `web/views/adminConfig.ts` | Last OK | Last good run | plain column name |
| `web/views/adminConfig.ts` | (warning: over {formatBytes(data.indexWarnBytes)}, the index should be split, ADR-0002) | (over {formatBytes(data.indexWarnBytes)}: tell the developer, the library data is too large) | "index" and an ADR number were on screen |
| `web/views/adminConfig.ts` | (warning at {formatBytes(data.indexWarnBytes)}) | (the app warns at {formatBytes(data.indexWarnBytes)}) | "index" and an ADR number were on screen |
| `web/views/adminConfig.ts` | Index size | Library data size | "index" and an ADR number were on screen |
| `web/views/adminConfig.ts` | Jobs | Background jobs | says what the jobs are |
| `web/views/adminConfig.ts` | No backups yet. The daily job makes one each night and keeps 14. | No backups yet. The app makes one each night and keeps the last 14. | "daily job" is an internal word |
| `web/views/adminConfig.ts` | {dates.length} daily copies (14 kept). | {dates.length} nightly backups. The app keeps the last 14. | "daily job" is an internal word |
| `web/views/adminConfig.ts` | Backups could not be loaded. Use Retry in the message. | Backups could not be loaded. Press Retry in the message. | one phrase for the Retry button: "Press Retry" |
| `web/views/adminConfig.ts` | The configuration could not be loaded. Use Retry in the message. | Settings could not be loaded. Press Retry in the message. | one phrase for the Retry button: "Press Retry" |
| `web/views/adminConfig.ts` | Configuration | Settings and backups | the tab name |
| `web/views/adminConfig.ts` | Environment | Technical details | raw property names sit under one heading on both admin screens |
| `web/views/adminConfig.ts` | Trigger reinstall failed: {data.triggersError} | The background jobs could not be set up again: {data.triggersError} | "trigger" is an internal word |
| `web/views/adminConfig.ts` | tick, refreshMembers, daily (job names as the server sends them) | Save insert counts and refused actions / Refresh groups / Nightly backup and cleanup, each followed by the raw name in small type | raw job names were on screen; the runbook still finds a job by its raw name |
| `web/views/adminConfig.ts` | Every change made after {date} is lost: templates, versions, folders, grants, favorites and usage counts go back to that day. Templates emptied from the trash after {date} cannot come back; the server refuses the restore if the backup holds any. The audit log is kept and records the restore. | Everything goes back to {date}: templates, versions, folders, access, favorites and insert counts. Changes made after that day are lost, and templates emptied from the trash after {date} cannot come back. | two sentences; "grants" and "usage counts" become "access" and "insert counts" |
| `web/views/adminFolders.ts` | OU (inactive in v1) | Org unit (not active yet) | "OU" and "v1" are internal words |
| `web/views/adminFolders.ts` | Use | Can use | access levels in plain words (owner note) |
| `web/views/adminFolders.ts` | Edit | Can edit | access levels in plain words (owner note) |
| `web/views/adminFolders.ts` | Manage | Can manage | access levels in plain words (owner note) |
| `web/views/adminFolders.ts` | Principal | Who | "principal", "level", "source" are internal words |
| `web/views/adminFolders.ts` | Level | Access | "principal", "level", "source" are internal words |
| `web/views/adminFolders.ts` | Source | Set on | "principal", "level", "source" are internal words |
| `web/views/adminFolders.ts` | Principal | Give access to | "principal", "level", "source" are internal words |
| `web/views/adminFolders.ts` | Enter a principal. | Enter a group, user or domain. | "principal", "level", "source" are internal words |
| `web/views/adminFolders.ts` | Its grants stop applying. | Access given on this folder ends. | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Remove grant for {label} | Remove access for {label} | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Removing grant... | Removing access... | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Removed the grant for {label}. | Removed access for {label}. | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Only admins can see this folder. Add a grant to share it. | Only admins can see this folder. Give access to share it. | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Adding grant... | Giving access... | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Added {principalType} {principalKey} with level {chosen}. | Gave access to {principalKey}: {levelWord(chosen)}. | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Effective access | Who has access | "grant" becomes "access"; one verb pair: give access, remove access |
| `web/views/adminFolders.ts` | Add grant | Give access | "grant" becomes "access"; the button says what happens |
| `web/views/adminFolders.ts` | Private folder of {folder.ownerEmail}. Private folders cannot be shared, moved or deleted. | Personal folder of {folder.ownerEmail}. Personal folders cannot be shared, moved or deleted. | one name for the My templates folder: personal, as in the setting |
| `web/views/adminFolders.ts` | There is no folder you manage to move it into. | Not moved. A folder can move only into another folder you manage. | says what to do next |
| `web/views/adminTransfer.ts` | as one JSON file, without the trash, older versions, favorites, usage or the audit log. | as one file, without the trash, older versions, favorites, insert counts or the audit log. | "JSON", "grants", "usage", "live", "scope" are internal words |
| `web/views/adminTransfer.ts` | Downloads the live templates, folders and grants of the scope you choose {EXPORT_NOTE} A whole-library export leaves out the private folders (each user's My templates). | Downloads the templates, folders and access of the whole library or of one folder {EXPORT_NOTE} A whole-library export leaves out personal folders (each user's My templates). | "JSON", "grants", "usage", "live", "scope" are internal words |
| `web/views/adminTransfer.ts` | Downloads the live templates, folders and grants of a folder you manage and its subfolders {EXPORT_NOTE} | Downloads the templates, folders and access of a folder you manage and its subfolders {EXPORT_NOTE} | "JSON", "grants", "usage", "live", "scope" are internal words |
| `web/views/adminTransfer.ts` | Export scope | What to export | "JSON", "grants", "usage", "live", "scope" are internal words |
| `web/views/adminTransfer.ts` | Validate | Check file | the button says what happens; busy and result follow it |
| `web/views/adminTransfer.ts` | Validating... / Importing... | Checking file... / Importing... | the button says what happens; busy and result follow it |
| `web/views/adminTransfer.ts` | Validate report / Import report | Check result / Import result | the button says what happens; busy and result follow it |
| `web/views/adminTransfer.ts` | Validate writes nothing and shows what Import would do. | Check file changes nothing. It shows what Import would do. | the button says what happens; busy and result follow it |
| `web/views/adminTransfer.ts` | Skipped and failed records | Skipped and failed templates and folders | "record" and "kind" are internal words |
| `web/views/adminTransfer.ts` | Kind | Type | "record" and "kind" are internal words |
| `web/views/adminTransfer.ts` | The file is larger than {IMPORT_MAX_BYTES / 1024 / 1024} MB. | The file is larger than {IMPORT_MAX_BYTES / 1024 / 1024} MB. Export smaller folders and import them one by one. | says what to do next |
| `web/views/adminTransfer.ts` | Adds the templates of an export file of up to {IMPORT_MAX_BYTES / 1024 / 1024} MB and {IMPORT_ITEMS_MAX} templates to a shared folder as new templates, without the file's grants and without templates whose title is already in their folder. | Adds the templates of an export file (up to {IMPORT_MAX_BYTES / 1024 / 1024} MB, {IMPORT_ITEMS_MAX} templates) to a shared folder as new templates. Access from the file is not imported, and a template whose title is already in its folder is skipped. | two sentences; "grants" becomes "access" |
| `web/views/adminTransfer.ts` | Target folder | Import into | two sentences; "grants" becomes "access" |
| `web/views/adminTransfer.ts` | The export stopped: the server did not answer after 4 tries. Nothing was downloaded. Wait a few minutes, then export again. (shown for every retryable error) | No answer: The export stopped after {done} of {total} templates: the server did not answer after 4 tries. No file was downloaded, so wait a few minutes and export again. | defects b and c: the no-answer text shows only when the server gave no answer; it says how far the export got and that no file exists |
| `web/views/adminTransfer.ts` | (the same text, when the server answered with an error) | The export stopped after {done} of {total} templates and no file was downloaded. Then the server's own message, in this line or in the toast with the request ID. | defect b: a busy or failed server is named by its own message |
| `web/views/adminTransfer.ts` | (no text before the first page) | The export did not start and no file was downloaded. / The export did not start: the server did not answer after 4 tries. No file was downloaded, so wait a few minutes and export again. | defect c: a failed start says that no file exists |
| `web/views/adminUsage.ts` | Applies 30 d | Inserts, 30 days | one verb: insert (was apply, use) |
| `web/views/adminUsage.ts` | Last used | Last inserted | one verb: insert (was apply, use) |
| `web/views/adminUsage.ts` | Applies counted from {data.since} (UTC days). Apply events can arrive up to 5 min late. | Inserts counted since {data.since}. A new insert can take up to 5 minutes to show. | one verb: insert (was apply, use) |
| `web/views/adminUsage.ts` | No templates yet. Usage appears here once templates exist. | No templates yet. Insert counts show here once the library has templates. | one verb: insert (was apply, use) |
| `web/views/adminUsage.ts` | Usage could not be loaded. Use Retry in the message. | Usage could not be loaded. Press Retry in the message. | one phrase for the Retry button |
| `web/views/memberships.ts` | Child groups | Groups inside | plain words for nested groups |
| `web/views/memberships.ts` | Warning: {group} contains {children.join(", ")}. Members of these child groups get no access: the resolver reads direct members only. | Warning: members of {children.join(", ")} get no access through {group}. Add them to {group} directly. | plain words for nested groups |
| `web/views/memberships.ts` | Refresh now | Refresh groups | the button names what it refreshes; busy and result follow it |
| `web/views/memberships.ts` | Refreshing memberships... | Refreshing groups... | the button names what it refreshes; busy and result follow it |
| `web/views/memberships.ts` | Resolver: {data.resolver} (direct members only). Last refresh: {time}. | Members are read from Google (direct members only). Last refresh: {time}. | "resolver" is an internal word |
| `web/views/memberships.ts` | No groups yet. Groups appear here once a grant names one or ADMIN_GROUP is set. | No groups yet. A group shows here once it has access to a folder or is the admin group. | "grant" and a property name were on screen |
| `web/views/memberships.ts` | Groups in the refresh set | Groups the app reads | "refresh set" is an internal word |

### Web app: library, editor, trash, history, status (31)

| Where | Old text | New text | Reason |
|---|---|---|---|
| `web/editor/picker.ts` | Label must be 1 to {LABEL_MAX} characters. | The field name must be 1 to {LABEL_MAX} characters. | one name: field name (was label, question) |
| `web/editor/picker.ts` | Question shown when the template is used | Field name the sender sees | one name: field name (was label, question) |
| `web/editor/picker.ts` | Ask the user | Ask the sender | one name for the person who inserts: the sender (as in "The sender fills in") |
| `web/editor/picker.ts` | Ask the user... | Ask the sender... | one name for the person who inserts: the sender |
| `web/editor/picker.ts` | Fallback must be at most {FALLBACK_MAX} characters. | The default text must be at most {FALLBACK_MAX} characters. | "fallback" becomes "default text" |
| `web/editor/picker.ts` | Fallback cannot contain { } \ < >. | The default text cannot contain { } \ < >. | "fallback" becomes "default text" |
| `web/editor/picker.ts` | Fallback text | Default text | "fallback" becomes "default text" |
| `web/editor/picker.ts` | Up to 80 characters. Leave empty to remove the fallback. | Up to 80 characters. Leave empty to remove the default text. | "fallback" becomes "default text" |
| `web/editor/schema.ts` | Field: {label}, asked at insert | Field: {label}, the sender fills it in | accessible name only: "fallback" becomes "default text", the sender is named |
| `web/editor/schema.ts` | Field: {label}, fallback {fallback} | Field: {label}, default text {fallback} | accessible name only: "fallback" becomes "default text", the sender is named |
| `web/editor/serialize.ts` | Remove the backslash before the placeholder at character {offset} | Remove the backslash before the field at character {offset}. | message text only: "placeholder" becomes "field" |
| `web/ui/status.ts` | This template was removed or moved. | This template was deleted or moved. | one verb: Delete (Remove is for lists) |
| `web/ui/status.ts` | Busy, try again. | The library is busy. Try again in a few seconds. | says what is busy and when to try again |
| `web/ui/status.ts` | Something went wrong. Retry. | Something went wrong. Try again. | a full sentence that also fits a toast without a Retry button |
| `web/ui/status.ts` | Dismiss | Close | one verb for closing: Close |
| `web/ui/status.ts` | Apps Script does not support several signed-in Google accounts. | This app does not work when several Google accounts are signed in. | "Apps Script" is an internal word |
| `web/ui/status.ts` | Changed by {by} at {formatTime(at)}. | {by} changed this at {formatTime(at)}. Reload the page and try again. | says what to do next |
| `web/views/editor.ts` | Nothing yet. To add a question, choose Insert field, then Ask the user. | Nothing yet. To add a field the sender fills in, choose Insert field, then Ask the sender. | "question" and "the user" become "field" and "the sender" |
| `web/views/editor.ts` | Template body | Template text | one name: the template text (was body) |
| `web/views/editor.ts` | Added to the draft when someone inserts this template. Users see every address before it is added. | Added to the draft when someone inserts this template. The sender sees every address before it is added. | the person who inserts is the sender |
| `web/views/editor.ts` | You can use this template but not change it. To change it, ask a folder manager for edit access. | You can use this template but not change it. To change it, ask a folder manager for "Can edit" access. | names the access level as the admin screen shows it |
| `web/views/editor.ts` | Copy failed. Select the text in the editor and press Ctrl+C. | Not copied. Select the text in the editor and press Ctrl+C. | result follows the button "Copy my text" |
| `web/views/library.ts` | No templates match "{query}". Try folder: or tag:. | No templates match "{query}". Try fewer words, or remove folder: and tag: from the search. | the same text as the Gmail panel; the old hint named no action |
| `web/views/library.ts` | Templates could not be loaded. Use Retry in the message, or reload the page. | Templates could not be loaded. Press Retry in the message, or reload the page. | one phrase for the Retry button |
| `web/views/recipients.ts` | Removed {addresses[index] ?? ""} from {name} | Removed {addresses[index] ?? ""} from {name}. | period at the end of a status text |
| `web/views/recipients.ts` | Added {fresh.join(", ")} to {name} | Added {fresh.join(", ")} to {name}. | period at the end of a status text |
| `web/views/trash.ts` | You can edit no folder to restore into. Ask a folder manager. | Not restored. You have no folder you can edit. Ask a folder manager for access. | says what happened and what to do |
| `web/views/trash.ts` | The nightly job deletes the stored versions of {itemsPending} of them. | The stored versions of {itemsPending} of them are deleted tonight. | "nightly job" is an internal word |
| `web/views/trash.ts` | The list could not be refreshed. | Reload the page to see the list. | says what to do next |
| `web/views/trash.ts` | The trash could not be loaded. Use Retry in the message, or reload the page. | The trash could not be loaded. Press Retry in the message, or reload the page. | one phrase for the Retry button |
| `web/views/trash.ts` | Deleted templates stay {TRASH_DAYS} days, then are removed. | Deleted templates stay here {TRASH_DAYS} days. After that they are deleted for good. | Remove is for lists; what cannot be restored is "deleted for good" |

### Gmail add-on cards (6)

| Where | Old text | New text | Reason |
|---|---|---|---|
| `addon/cards/home.ts` | Your private folder is ready: open the library to create one. | Your folder "My templates" is ready. Open the library to create a template. | names the folder as the screen shows it; "private" is not used on screen |
| `addon/cards/states.ts` | Apps Script does not support several signed-in Google accounts. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account. | This app does not work when several Google accounts are signed in. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account. | "Apps Script" is an internal word; same text as the library |
| `addon/cards/states.ts` | Ask the owner to finish setup, then press Retry. | Ask your admin to finish setup, then press Retry. | users know the admin, not the owner of the script |
| `addon/cards/states.ts` | This template was removed or moved. Press Refresh to update the list. | This template was deleted or moved. Press Refresh to update the list. | one verb: Delete (Remove is for lists); same as the library |
| `addon/cards/states.ts` | Network: {failure.message} | Details for your admin: {failure.message} | says who the technical line is for |
| `addon/cards/states.ts` | Busy right now. Press Retry in a few seconds. | The library is busy. Try again in a few seconds. | one busy text on the web pages and the Gmail cards |

### Server and shared messages that reach the screen (75)

| Where | Old text | New text | Reason |
|---|---|---|---|
| `server/dispatch/dispatch.ts` | Cannot identify your account | Cannot identify your Migway account. | same text as the pages and the panel |
| `server/dispatch/dispatch.ts` | This was moved by someone else while you worked. Reload and try again. | Someone else moved this while you worked. Reload the page and try again. | active voice, names the page to reload |
| `server/guards.ts` | Migway Templates is not set up. The owner runs setup once. | Migway Templates is not set up yet. Ask your admin to finish setup. | users know the admin, not the owner of the script; says what to do |
| `server/guards.ts` | Your account is not in the Migway domain. | This is not a Migway account. Sign in with your Migway account. | users know the admin, not the owner of the script; says what to do |
| `server/handlers/audit.ts` | This event was not found. | This audit entry was not found. Reload the list. | a log holds entries; says what to do next |
| `server/handlers/config.ts` | every 5 min | Every 5 minutes | full words |
| `server/handlers/config.ts` | every 15 min | Every 15 minutes | full words |
| `server/handlers/config.ts` | daily, 02:00 to 03:00 | Every night, 02:00 to 03:00 | full words |
| `server/handlers/config.ts` | {lost} templates of the {date} backup were emptied from the trash after that date and would not open. Pick a newer backup. | Not restored. {lost} templates in the backup of {date} were deleted for good after that day and would not open. Pick a newer backup. | says the restore did not happen; "deleted for good" as in the trash |
| `server/handlers/config.ts` | This backup was removed. | This backup no longer exists. Reload the page and pick another. | says what to do next |
| `server/handlers/folders.ts` | Folders can be at most {FOLDER_DEPTH_MAX} levels deep | A folder can be at most {FOLDER_DEPTH_MAX} levels deep. Put it higher up. | says what to do; period |
| `server/handlers/folders.ts` | A folder cannot move into itself or its subfolders | A folder cannot move into itself or its subfolders. | says what to do; period |
| `server/handlers/folders.ts` | Only an empty folder can be deleted | Only an empty folder can be deleted. Move or delete its templates and subfolders first. | says what to do; period |
| `server/handlers/folders.ts` | Private folders and their subfolders cannot move | The folder "My templates" and its subfolders cannot be moved. | errors name the folder as users see it: My templates |
| `server/handlers/folders.ts` | Shared folders cannot move into a private folder | A shared folder cannot move into "My templates". | errors name the folder as users see it: My templates |
| `server/handlers/folders.ts` | Private folders cannot be deleted | The folder "My templates" cannot be deleted. | errors name the folder as users see it: My templates |
| `server/handlers/grants.ts` | Principal must be at most {PRINCIPAL_KEY_MAX} characters | The group, user or domain must be at most {PRINCIPAL_KEY_MAX} characters. | "principal" is an internal word; raw type names were on screen |
| `server/handlers/grants.ts` | {type} needs an email address | Enter the email address of the {type}. | "principal" is an internal word; raw type names were on screen |
| `server/handlers/grants.ts` | domain needs a domain name | Enter a domain name, for example example.com. | "principal" is an internal word; raw type names were on screen |
| `server/handlers/grants.ts` | ou needs a path starting with / | An org unit path starts with /. | "principal" is an internal word; raw type names were on screen |
| `server/handlers/grants.ts` | Private folders cannot be shared | The folder "My templates" cannot be shared. | errors name the folder as users see it: My templates |
| `server/handlers/grants.ts` | Group {key} was not found or its members are not visible | Group {key} was not found or its members are not visible. Check the address. | period; says what to check |
| `server/handlers/indexOps.ts` | {what} was removed or moved. | {what} was deleted or moved. | one verb: Delete (Remove is for lists) |
| `server/handlers/indexOps.ts` | This grant | This access | "grant" becomes "access" |
| `server/handlers/templates.ts` | This template was removed or moved. | This template was deleted or moved. | one verb: Delete |
| `server/handlers/templates.ts` | This template is not in the trash | This template is not in the trash any more. Reload the page. | says what to do next |
| `server/handlers/transfer.ts` | This export is no longer valid (it expired or belongs to another session). Nothing was downloaded. Start the export again. | This export ran out of time or was started in another window. Start the export again. | plain words for an expired export; the web text already says no file was downloaded |
| `server/handlers/transfer.ts` | {first.code}: {first.message}{more} | {first.message}{more} | an error code was on screen in the import report |
| `server/handlers/transfer.ts` | Nothing was imported: the template {record.label}: {tooMany.message} | Nothing was imported because of the template {record.label}. {tooMany.message} | two sentences in place of two colons |
| `server/handlers/transfer.ts` | {codes.length} address{s} dropped: {parts.join(", ")} | {codes.length} address{s} not imported: {parts.join(", ")} | "dropped" becomes "not imported" |
| `server/handlers/transfer.ts` | Its folder was not imported | Its folder was not imported. | period |
| `server/handlers/transfer.ts` | A template with this title is already in this folder | A template with this title is already in this folder. | period |
| `server/handlers/transfer.ts` | Templates cannot be imported into a private folder. Pick a shared folder. | Templates cannot be imported into "My templates". Pick a shared folder. | errors name the folder as users see it: My templates |
| `server/handlers/transfer.ts` | the library could not be written | the library could not be saved | "written" becomes "saved" |
| `server/handlers/transfer.ts` | already in an earlier field | already in To or Cc | "field" is the template blank only; the address boxes are To, Cc and Bcc |
| `server/handlers/transfer.ts` | Nothing was imported: {what}. Run the import again. / Nothing was imported: {what}: {server message}. Run the import again. | Nothing was imported because {what}. Run the import again. / Nothing was imported because {what}. {server message} | one colon chain became two sentences; the server message keeps its own advice |
| `server/handlers/transfer.ts` | Nothing was imported: the library could not be written: 1 problem to fix. Run the import again. (setting changed mid-import) | Nothing was imported. The setting "Outside recipients" changed during the import. Run the import again. | defect d: says what happened and what to do; code, details and outcome unchanged |
| `server/handlers/versions.ts` | Changed by {record.updatedBy} at {record.updatedAt}. | {record.updatedBy} changed this at {record.updatedAt}. Reload the page and try again. | says what to do next |
| `server/lock.ts` | Busy, try again. | The library is busy. Try again in a few seconds. | says what is busy and when to try again; same text as the library |
| `server/pages.ts` | Cannot identify your account | Cannot identify your Migway account | same text as the library and the panel |
| `server/pages.ts` | Apps Script does not support several signed-in Google accounts. | This app does not work when several Google accounts are signed in. | same text as the library and the panel |
| `server/storage/setupStore.ts` | Storage is not set up. The owner runs setup() once. | Migway Templates is not set up yet. Ask your admin to finish setup. | one text for "not set up"; "storage" and "setup()" are internal words |
| `server/transfer/format.ts` | Not a folder record | This entry is not a folder. | "record", "meta", "html", "id" are internal words |
| `server/transfer/format.ts` | Folder needs an id and a name | The folder has no ID or no name. | "record", "meta", "html", "id" are internal words |
| `server/transfer/format.ts` | Template needs meta and html | The template is incomplete in the file. | "record", "meta", "html", "id" are internal words |
| `server/transfer/format.ts` | Template needs a title and text tags | The template has no title, or its tags are not text. | "record", "meta", "html", "id" are internal words |
| `server/transfer/format.ts` | To, Cc and Bcc must be lists of text | To, Cc and Bcc are not lists of addresses. | "record", "meta", "html", "id" are internal words |
| `server/transfer/format.ts` | The file has more than {max} {key}. Export smaller folders and import them one by one. | The file has more than {max} {templates or folders}. Export smaller folders and import them one by one. | "record", "meta", "html", "id" are internal words |
| `server/transfer/format.ts` | The file is larger than {IMPORT_MAX_BYTES / 1024 / 1024} MB | The file is larger than {IMPORT_MAX_BYTES / 1024 / 1024} MB. Export smaller folders and import them one by one. | says what to do next |
| `server/transfer/format.ts` | Unsupported schema version: this app reads version {EXPORT_SCHEMA_VERSION} | This export file has a format this app cannot read. Export the templates again. | "JSON" and "schema version" are internal words |
| `server/transfer/format.ts` | Folders #{first + 1} and #{n + 1} of the file have the same id | Folders #{first + 1} and #{n + 1} of the file have the same ID. Export the templates again. | "JSON" and "schema version" are internal words |
| `server/transfer/plan.ts` | Invalid folder name | The folder name is not valid. | full sentences |
| `server/transfer/plan.ts` | Its parent folder was not imported | Its parent folder was not imported. | full sentences |
| `server/transfer/plan.ts` | Folders can be at most {FOLDER_DEPTH_MAX} levels deep | A folder can be at most {FOLDER_DEPTH_MAX} levels deep. | full sentences |
| `server/transfer/plan.ts` | Its parent chain has a cycle | Its parent folders form a loop in the file. | full sentences |
| `shared/model/recipients.ts` | {address} is in both {To} and {Cc}. Keep it in one field. | {address} is in both {To} and {Cc}. Keep it in one of them. | "field" is the template blank only; the address boxes are To, Cc and Bcc |
| `shared/model/recipients.ts` | {Cc} holds {n} addresses. Use at most {max} per field. | {Cc} holds {n} addresses. Use at most {max} in {Cc}. | "field" is the template blank only; the address boxes are To, Cc and Bcc |
| `shared/model/validate.ts` | {field} must be 1 to {max} characters | {field} must be 1 to {max} characters. | period; says what to do |
| `shared/model/validate.ts` | At most {TAGS_MAX} tags | Use at most {TAGS_MAX} tags. | period; says what to do |
| `shared/placeholders/validate.ts` | Prompt label must be 1 to {LABEL_MAX} characters, without { } \| \ < > | A field name must be 1 to {LABEL_MAX} characters, without { } \| \ < > | "prompt label" becomes "field name" (the editor's word) |
| `shared/placeholders/validate.ts` | A field name must be 1 to {LABEL_MAX} characters, without { } \| \ < > (at character {n}) | A field name must be 1 to {LABEL_MAX} characters, without { } \| \ < > (at character {n}). | "prompt label" becomes "field name" (the editor's word) |
| `shared/placeholders/validate.ts` | Unknown placeholder {name} at character {n}.{suffix} | Unknown field {name} at character {n}.{suffix} | "placeholder" becomes "field"; each text says what to do |
| `shared/placeholders/validate.ts` | Placeholder at character {n} is not valid | The field at character {n} is not valid. Delete it and use Insert field. | "placeholder" becomes "field"; each text says what to do |
| `shared/placeholders/validate.ts` | Placeholder at character {n} is not closed | The field at character {n} is not closed. Add }} after it. | "placeholder" becomes "field"; each text says what to do |
| `shared/placeholders/validate.ts` | Placeholders work in text only ({token.attr} of {token.tag}) | Fields work in text only, not inside a link or image address ({token.attr} of {token.tag}). | "placeholder" becomes "field"; each text says what to do |
| `shared/placeholders/validate.ts` | Use lower case: ask: at character {n} | Use lower case: ask: (at character {n}). | period |
| `shared/placeholders/validate.ts` | Use lower case: {name} (at character {n}) | Use lower case: {name} (at character {n}). | period |
| `shared/placeholders/validate.ts` | Prompts take no fallback in v1 (at character {n}) | A field the sender fills in cannot have default text (at character {n}). | "prompt", "fallback" and "v1" are internal words |
| `shared/placeholders/validate.ts` | Fallback must be at most {FALLBACK_MAX} characters, without { } \ < > (at character {n}) | The default text must be at most {FALLBACK_MAX} characters, without { } \ < > (at character {n}). | "prompt", "fallback" and "v1" are internal words |
| `shared/placeholders/validate.ts` | At most {PROMPTS_MAX} prompts per template (found {n}) | A template can ask the sender for at most {PROMPTS_MAX} fields (found {n}). | "prompt", "fallback" and "v1" are internal words |
| `shared/placeholders/validate.ts` | recipient.first_name has no fallback (at character {n}); users will be asked for it | Recipient first name has no default text (at character {n}). The sender is asked for it when it is unknown. | the field by its screen name; "fallback" becomes "default text"; "users" become "the sender" |
| `shared/placeholders/validate.ts` | Subject must be {SUBJECT_MAX} characters or fewer | The subject must be {SUBJECT_MAX} characters or fewer. | full sentence |
| `shared/placeholders/validate.ts` | Subject must be one line (at character {n}) | The subject must be one line (at character {n}). | full sentence |
| `shared/sanitize/sanitize.ts` | {what} is {bytes} bytes; the limit is {limit} | {what} is too large ({bytes} bytes, the limit is {limit}). Shorten it or remove some formatting. | message text only: "HTML", "body" and bytes alone told nobody what to do |
| `shared/sanitize/sanitize.ts` | Pasted HTML | The pasted text | message text only: "HTML", "body" and bytes alone told nobody what to do |

## Gmail side panel (slice 18)

New texts, spec 7.2. Paths are relative to `src/`.

| Where | Text |
|---|---|
| `addon/cards/sidePanel.ts` | New email / Reply / Reply all (buttons); New email from {title} / Reply with {title} / Reply all with {title} (screen reader) |
| `addon/cards/sidePanel.ts` | To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar. (replaces "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar.") |
| `addon/cards/details.ts` | Leave blank to use the first name of the person you reply to, when known. |
| `addon/cards/details.ts` | A reply goes to the sender, so the template's To is not added. New email adds it. |
| `addon/cards/details.ts` | Gmail adds your signature to replies only. In a new email, use "Insert signature" in its toolbar. |
| `addon/panel.ts` | Open the email you want to answer, then press Reply again. |
| `addon/panel.ts` | This email can no longer be read. Open it again, or use New email. |
| `addon/panel.ts` | Each box takes up to 500 characters. Shorten the long one and try again. |
| `addon/panel.ts` | This template changed. Go back and open it again. |
| `addon/panel.ts` | The recipients of this template changed. Go back and open it again. |
| `addon/panel.ts` | The recipients of this template changed. Tap its name to see them. |
| `addon/panel.ts` | The email is in your Drafts, but Gmail could not open it. Open Drafts to find it. |
| `addon/panel.ts` | This template was deleted or moved. Open the panel again to update the list. |
| `addon/panel.ts` | Something went wrong. Try again. (alone: a side-panel action shows its failure as one sentence in Gmail's error bar, with no request ID or technical message) |

## Web app fix round (slice 20a)

New texts. Paths are relative to `src/`.

| Where | Text |
|---|---|
| `web/index.html`, `web/app.ts` | Loading... (first paint, until the first view draws) |
| `web/app.ts` | Templates could not be loaded. Press Reload to try again. / Reload (button) |
| `web/ui/status.ts` | Migway Templates is not set up yet. Ask your admin to finish setup. (NOT_CONFIGURED; was "Something went wrong. Try again.") |
| `web/views/adminAdmins.ts` | Admins manage every shared folder, its access, settings, imports and backups. Add people by their {domain} address. (was "... shared folder, grants, ..."; spec 7.3 line 533 and wireframe 06 line 119 still quote the old text) |

## Gmail cards fix round (slice 20b)

New texts. Paths are relative to `src/`.

| Where | Text |
|---|---|
| `addon/cards/folder.ts` | Showing {shown} of {total} {favorites / recent templates / folders / results}. Use Search or Open library for the rest. (last line of a list cut to stay under Gmail's 100 widgets per card) |
| `addon/cards/recipients.ts` | A reply adds {n} recipient(s). (label of "Add recipients" on the side-panel details card with an email open, when the template has a To: a reply never adds it) |
| `addon/panel.ts` | Migway Templates is not set up yet. Ask your admin to finish setup. (side-panel action refused for "not set up": the server text, without "then press Retry", because Gmail's error bar has no Retry) |
| `addon/cards/details.ts` | {problem} (the details card change line loses its "(!) " prefix; the red error icon with alt text "Error" carries the meaning, slice 22b) |
