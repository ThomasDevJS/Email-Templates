# Smoke test (5 minutes, after each dev deploy)

## Slice 1

1. Gmail, compose: the Migway Templates home card shows within 3 s (since slice 4: Folders, or the empty state).
2. (Removed in slice 4 with the Ping button. Slice 4 step 1 covers the add-on to server round trip.)
3. Open the `execUrl` from `deploy/dev.json`: the tab is titled "Migway Templates"; the page shows the library (folder tree and template list, since slice 3) and, at the bottom of the left sidebar, your short name and "Version dev-<sha>".
4. Open the same URL in a window signed in to a non-Migway account: Google's access page or "Cannot identify your Migway account" appears, never the app shell.
5. Editor, Executions: each step above logged one JSON line with `level`, `action`, `result`, `durationMs`, `appVersion`, and no template body or token.

## Slice 2

Needs: the dev deployment after `npm run deploy -- dev`, and a second Migway account that is not in `ADMIN_EMAILS` (a pilot editor, D13).

1. Editor, function `setup`, Run. Execution log: one JSON line with `"action":"setup","result":"ok"`. Return value: `created` 8 on the first run, `triggers` 3. Editor, Triggers: `tick` every 5 min, `refreshMembers` every 15 min, `daily` daily 2 to 3 am.
2. Run `setup` again: `created` 0, still 3 triggers.
3. Drive, My Drive: folder "Migway Templates Data" holds `bodies`, `audit`, `backups`, `index.json`, `favorites.json`, `usage.json`, `members.json`. Open `index.json` with a text viewer: `"schemaVersion":1,"rev":1`.
4. Steps 4 to 9 used a temporary console helper that called `rpc(op, args)`. Since slice 3 the server refuses a call without a request ID, so the helper no longer works; slices 3, 6a and 6b cover the same checks through the screens.
5. Editor, Executions: each web app call wrote one JSON line with `cache` (`hit`, `miss` or `rebuild`) and no template text.
6. Editor, Script Properties: `job:tick:lastOk` is under 10 min old.

## Slice 3

Needs: the dev deployment after `npm run deploy -- dev`, and the second Migway account from slice 2 (not in `ADMIN_EMAILS`, no grant).

1. Open the dev web app URL. The library shows skeleton rows, then the folder tree and your short name at the bottom of the left sidebar. Press `/`: the search box takes focus.
2. Admin, "Folders and access", "New top-level folder", name "Smoke 3" (the slice 2 console helper is gone). Back in the library: "Smoke 3" is in the tree. Select it with the arrow keys and Enter: "No templates in Smoke 3." and "New template".
3. "New template". Title "Smoke 3 quote", tag "smoke". In the body type "Hi " then `{{`: the "Insert field" menu opens; pick "Recipient first name". Type ", your price for " then use the toolbar "Insert field" button, "Ask the sender...", type "Product" in "Field name the sender sees", OK. End with a new line and pick "Sender name" from the menu. "Preview as me" shows your Directory name and "[Product]".
4. Press Ctrl+S. The button reads "Saving..." and is disabled, then the status reads "Saved as version 1, HH:MM". The "Problems" tab shows "Warning: Recipient first name has no default text". Select the "Recipient first name" blank, open "Insert field", "Add default text...", type "there" in "Text used when the value is unknown", OK, save: "Saved as version 2", no warning.
5. Bold the "Sender name" chip with Ctrl+B and save (version 3). Drive, `bodies/<id>.v3.json`: `html` holds `<strong>{{sender.name}}</strong>`, `{{recipient.first_name|there}}` and `{{ask:Product}}`; `index.json` item has `placeholders` `["recipient.first_name","sender.name"]`, `prompts` `["Product"]`, a `snippet` and `sizeBytes`.
6. Conflict: open the same template in a second tab, change a word, save (version 4). In the first tab change a word and save: the dialog "This template changed" reads "<your email> saved version 4 at <time> while you edited.", with "Open their version", "Copy my text" and "Cancel". Esc closes it and focus returns to Save. Save again, pick "Open their version": the body shows the second tab's text, the header "Saved as version 4, <time>", and the status "Opened their version. Your changes were discarded."
7. History: "History" lists versions 4 to 1, newest first. Arrow down to version 1, Enter: the preview shows the fields as blanks. Press R, dialog "Create version 5 from version 1?", "Restore": the dialog closes at once, status "Restoring version 1...", then "Restored as version 5."; the list shows "Version 5, ..., current, restored from 1".
8. Paste into the body a link `javascript:alert(1)` copied from a web page and save: the link mark is gone. Drive body file: no `javascript:`.
9. Second account, same URL: the library shows no "Smoke 3" folder. Open `<url>#/edit/<template id>`: banner "You don't have access to this template. Ask a folder manager." with "Back to the library".
10. Editor, Executions: one JSON line per call, `requestId` equals the ID a toast would show (format `XXXXXXXX-XXXXXX`), and no body text, prompt value or token in the log.

## Slice 4

Needs: the dev deployment after `npm run deploy -- dev` (code only: reopen the sidebar), the "Smoke 3" folder and "Smoke 3 quote" template from slice 3, and the second account from slice 2 (no grant).

1. Gmail web, compose, open Migway Templates. Within 3 s the home card shows "Folders" with "Smoke 3" ("1 template" below) and "My templates" ("n templates" below), and "Open library" at the bottom. Close and reopen within 10 min: the card shows faster (User Cache hit, no `sidebar.home` line in Executions).
2. Tap "Smoke 3": the folder card is titled "Smoke 3" and lists "Smoke 3 quote" with "1 field to fill" below the title. Tap the title: the details card is titled "Smoke 3 quote": section "Fields" with "Fill in now, or leave blank and type in the draft." and the box "Product"; the text with "[Recipient first name]", "[Product]" and "[Sender name]"; footer "Insert" and "Edit in library".
3. To: one Migway colleague. Row Insert on "Smoke 3 quote": the text arrives at once with the colleague's first name and without the field (no `[Product]`, no `{{`). Discard the draft.
4. New draft, To: the same colleague. Tap the title "Smoke 3 quote", in "Product" enter `<b>A & B</b>`, a new line, `second line`; tap Insert. The body shows the colleague's first name, the text literally (no bold), on 2 lines, and your Directory name in bold. Stopwatch from tap to body change: under 2 s.
5. In the library, create "Smoke 4 plain" in "Smoke 3" with body `Hello {{recipient.first_name|there}}` (no prompts). Back in Gmail, compose with no recipient and open the "Smoke 3" folder card (Open library cleared the cached view). Tap Insert on "Smoke 4 plain": "Hello there" appears at the cursor in one click.
6. Tap the title "Smoke 3 quote", then "Edit in library": the editor opens in an overlay on that template. Close it: the sidebar reloads to the home card.
7. In the library, on the "Smoke 4 plain" row, "Actions", "Delete...", "Delete" (since slice 4b), while its folder card is open in another compose window. Tap its Insert: "This template was deleted or moved. Press Refresh to update the list." with Refresh; Refresh shows the home card without it.
8. Second account: compose, open the add-on. Personal templates off: the home card shows "No templates shared with you yet. Ask your admin for access to a folder." and no button. Personal templates on: "No templates shared with you yet.", `Your folder "My templates" is ready. Open the library to create a template.` and "Open library".
9. (Removed in slice 5 with the spike S4 harness. Results: docs/spikes/slice-04-insert.md.)
10. Editor, Executions: one JSON line per `sidebar.home` and `template.apply` call, with `surface` `addon`; no recipient address, prompt value or body text. After the next `tick` (5 min), `usage.json` shows `applyCount` for "Smoke 3 quote" and the template in `recent` for your email.

## Slice 4b

Needs: the dev deployment after `npm run deploy -- dev` and the "Smoke 3" folder.

1. Library, "Smoke 3", "New template", title "Smoke 4b", body "one", Save: "Saved as version 1, <time>". Open `<url>#/edit/<its id>` in a second tab, add the word "two", Save: "Saved as version 2, <time>". First tab: add the word "three" in the body, Ctrl+S with the cursor in the body: dialog "This template changed". Esc: focus is on Save. Save again, "Open their version": the body reads "one two", the header "Saved as version 2, <time>", status "Opened their version. Your changes were discarded."
2. "History", arrow to version 1, R, "Restore": the dialog closes at once and the status reads "Restoring version 1...", then "Restored as version 3."
3. Library, reload. Tab (no click) until a folder row has a focus ring. Arrow down, Enter: the list heading names that folder and the focus ring stays on the row. Arrow up, Enter: the list changes again. Click another folder: the focus ring moves to it and arrows work.
4. Grid: focus the "Smoke 4b" title cell, Shift+F10: menu "Edit", "Duplicate", "Move...", "History", "Delete...". Arrow keys move, Esc closes it and the focus ring is back on the cell. End, Enter on the "Actions" cell opens the same menu.
5. "Duplicate": status `Duplicated as "Copy of Smoke 4b".`, focus on the copy. Its menu, "Move...": the list holds only folders where you have edit, never "Smoke 3" itself (an admin also sees other accounts' "My templates"). Pick "My templates", "Move": status `Moved "Copy of Smoke 4b" to My templates.`
6. Copy's menu, "Delete...": `Delete "Copy of Smoke 4b"? Deleted templates stay in the trash for 30 days.` "Cancel" keeps it; "Delete" removes it from the list with status `Deleted "Copy of Smoke 4b".`
7. Editor, Executions: the `web.open` line and every `rpc` and `doPost` line carry a `requestId` in the format `XXXXXXXX-XXXXXX`; the `version.restore` line of step 2 has `targetId` = the template ID.
8. Timing: every `rpc` and `doPost` line has `calls` (props, cache, drive, lock, dir) and `timing` (`startupMs` script load to handler start, `totalMs` script load to log line, `propsMs`, `cacheMs`, `driveReadMs`, `driveWriteMs`, `lockMs`, `dirMs`); add-on lines add `addonPreMs`, `addonTokenMs` and, from the second call of one callback, `prevFetchMs` and `prevTotalMs`. A warm `sidebar.home` or `template.apply` shows `"props":1` and `"drive":0`. Copy the add-on function durations (onComposeOpen, onOpenFolder, onInsert, onPromptInsert) next to these fields into the slice 4b timing table of the handoff.

## Slice 5

Needs: the dev deployment after `npm run deploy -- dev` (reopen the sidebar), the "Smoke 3" folder and "Smoke 3 quote" template, the second account from slice 2 (no grant), and one `tick` run after the deploy (5 min).

1. Spike S5 (Q20, Q21). Library, "Smoke 3 quote", Subject `Quote for {{ask:Product}}`, Save. Gmail web: (a) new compose, type `old` in Subject, open the add-on, tap the title "Smoke 3 quote", turn "Replace the subject" on, fill "Product" with `Pen`, Insert: record whether the body changed and whether Subject reads exactly `Quote for Pen` (replaced, not appended). (b) Open any received message, Reply, tap the title of the same template, turn "Replace the subject" on, fill "Product", Insert: record body and subject the same way, and whether the thread still groups the reply after sending it to yourself. (c) If Gmail asks for a new permission or shows an error, stop: no further steps; report the text. Write the results into the slice 5 handoff.
2. New compose, empty Subject. Tap the title "Smoke 3 quote": the details card shows "Replace the subject" on, with `Quote for [Product]` below it. New compose with Subject `keep`, tap the title: "Replace the subject" is off; fill "Product", Insert: the body changes, Subject stays `keep`.
3. New compose, empty Subject, tap the title, turn "Replace the subject" off, fill "Product", Insert: Subject stays empty. New compose, row Insert on "Smoke 3 quote" with nothing filled: the body arrives without the field and Subject reads `Quote for`.
4. Library editor of "Smoke 3 quote": Subject shows `n/200 (optional)`; put the cursor in Subject, "Insert field", "Sender name": `{{sender.name}}`appears at the cursor; "Preview as me" shows "Subject: " with your name. Type`{{sender.nmae}}` in Subject, Save: "Error: Subject: Unknown field sender.nmae at character ...". Fix and save. "History": the version preview shows the "Subject:" line; restore an older version: its subject comes back.
5. Library: star "Smoke 3 quote" with the mouse, then another row with Tab to its star cell and Enter: "Added ... to favorites.", star filled. "Favorites" in the left menu shows only starred rows; "All templates" shows all again.
6. Library search: `/`, type `quote for`: "Smoke 3 quote" (subject match). Type a word that is only in a body: it appears under "Matches in text" within 1 s. `folder:smoke tag:smoke` filters. DevTools, Performance, User Timing: `library.list` under 50 ms, `library.body` under 1 s.
7. Gmail, compose, open the add-on (Open library cleared the cached view): "Favorites" lists the starred templates with their folder path; "Recent" lists templates inserted in steps 1 to 3 after the next `tick`, without the ones already under "Favorites". Type `quote` in "Search templates" and leave the field: results replace Home; clear the field: Home returns.
8. Second account: compose, open the add-on: no "Favorites" or "Recent" entries from your templates. With no template at all the card shows only the empty state of Slice 4 step 8 (no search box); else search `quote` shows `No templates match "quote". Try fewer words, or remove folder: and tag: from the search.`.
9. Editor, Executions: `search`, `favorite.set` and `search.body` lines carry `action`; a warm `sidebar.home`, `search` and `template.apply` show `"props":1` and `"drive":0`. No subject text, body text or query text in any line. Script Properties: `FAVORITES_REV` and `USAGE_REV` are set.

## Slice 5b

Needs: the dev deployment of this build (reopen the sidebar), "Smoke 3 quote" (Subject `Quote for {{ask:Product}}`), the second account from slice 2, which has opened the library once (its personal folder exists). The compose card is modal: in every Gmail step, click into the draft body first, then open the add-on. The reply checks of the first version (old steps 2 to 5) moved to "Slice 5c": the compose event carries no `threadId` or `messageId` (fifth smoke run).

1. Library, "Smoke 3", New template: Title `Smoke 5b plain`, Subject `Plain 5b`, body `Hello`, Save. The status reads "Saved as version 1, HH:MM" with your clock's time, not UTC. The grid "Updated" column and History show the same local time.
2. Sidebar (Slice 5 step 7): compose, click into the body, open the add-on. "Favorites" lists the starred templates with their folder path; "Recent" lists the templates you inserted that are not favorites, after the next `tick` (5 min). Type `quote` in "Search templates" and leave the field: results replace Home. Clear the field: Home returns.
3. Owner labels, as admin: the library tree and the Move dialog list show "My templates" once for your own folder and "My templates (second account address)" for the second account's folder. Second account, library: only its own "My templates", no address.
4. Row actions: Duplicate "Smoke 5b plain": "Duplicating..." shows at once, then "Duplicated as ...". Move the copy: "Moving..." at once. Delete the copy: the dialog opens with Cancel focused (Enter closes it, nothing is deleted); open it again, press Delete: "Deleting..." at once.
5. History of "Smoke 3 quote" (several versions) from the row menu: press the Down arrow at once, without a click: the selection moves to the next version.
6. Search: reload the library, wait for the list, press `/` once without clicking: the search box has focus (record if a click was still needed). Type a word that is only in a body: "Searching text..." shows, then "Matches in text"; "No templates match" never shows in between. Type `zzqx`: "Searching text...", then `No templates match "zzqx". Try fewer words, or remove folder: and tag: from the search.`.

Note on step 6: the first `/` after a load may need a second press. The browser gives the app frame no focus before a click or a key press inside it.

## Slice 5c

Needs: the dev deployment of this build (reopen the sidebar), "Smoke 5b plain" (Subject `Plain 5b`, no prompts) and "Smoke 3 quote" (Subject `Quote for {{ask:Product}}`). The compose card is modal: in every Gmail step, click into the draft body first, then open the add-on.

1. Empty subject: Compose, leave Subject empty, click into the body, open the add-on, tap the title "Smoke 5b plain": the details card shows "Replace the subject" on, with `Plain 5b` below it. Insert: body `Hello`, Subject exactly `Plain 5b`.
2. Typed subject: Compose, type `old` in Subject, click into the body, open the add-on, row Insert on "Smoke 5b plain": the body changes, Subject stays `old`. Tap the title "Smoke 5b plain": "Replace the subject" is off; turn it on, Insert: Subject becomes `Plain 5b`. Tap the title "Smoke 3 quote": "Replace the subject" is off.
3. Reply: open any received message, press Reply, click into the body, open the add-on, Insert "Smoke 5b plain": the body changes, Subject stays `Re: ...`. Send the reply to yourself: it stays in its conversation.
4. Log: Apps Script editor, Executions, open the `doPost` runs of steps 1 to 3. Each `template.apply` line carries `"draft":{"fields":[...],"to":n,"cc":n,"bcc":n,"hasSubject":...}`: `false` in step 1, `true` in steps 2 and 3. If step 2 or 3 shows `false`, Gmail sends the field without its value and Insert replaces the subject as in build 32a446c: report it. Every line has `actor` and `targetId` (spec 11); no line has a recipient address, subject text, body text or prompt value.

## Slice 6a

Needs: the dev deployment of this build, the owner account (admin) in one Chrome profile and the second account (not in `ADMIN_EMAILS`) in another. Optional: one Google Group whose members the owner can see, with the second account as a direct member. Without a group, use a user grant in step 4.

1. Owner, web app: the rail shows Admin. Open it (or `?view=admin`): tabs "Folders and access" and "Groups", no other tab. Left and Right move between the tabs.
2. "New top-level folder", name `Smoke 6a`: the status shows "Creating folder..." at once, then the folder is selected. "Who has access" says "Only admins can see this folder. Give access to share it." Add a subfolder `Inner`, rename it `Inner 2`, delete `Inner 2` (Cancel has the focus first; Delete confirms).
3. In the library, create template `Smoke 6a secret` in `Smoke 6a`.
4. Second account, web app: no `Smoke 6a` in the tree, no Admin in the rail; `?view=admin` shows "You don't have access to Admin." and no folder. Gmail, the add-on in a draft's toolbar: no `Smoke 6a secret` (the card shows the empty state, or search `secret` finds nothing).
5. Owner, Admin, `Smoke 6a`: "Give access": type Group, the group address, access "Can use" (or type User, the second account, "Can use"). A group the owner cannot see answers "was not found or its members are not visible. Check the address." The row shows the group or user, "Can use", "this folder".
6. Second account: reload. The library shows `Smoke 6a` and the template; row Insert in a draft's toolbar inserts it. Admin is still absent (use only).
7. Owner, Groups: the group (step 5) has a member count; "Refresh groups" shows "Refreshing groups..." then "Refreshed n groups." A group with a group inside shows a "Warning:" row.
8. Owner, Admin, `Smoke 6a`: "Remove" on the access row. Second account, reload: `Smoke 6a` is gone; opening the template link answers "You don't have access". This is BRIEF 13 DoD 3.
9. Owner, library: delete `Smoke 6a secret`. Trash (under the folder tree) lists it with the deleted time in local time and 30 days left. Restore: it is back in `Smoke 6a`. Delete it again, then "Empty trash now..." (Cancel has the focus first), "Empty trash": "Emptied the trash: n templates deleted for good."
10. Apps Script editor, Executions: the `grant.add` and `grant.remove` lines carry `action`, `actor` and `targetId` (the folder ID for `grant.add`, empty for `grant.remove`), and no group or user address of the grant.

## Slice 6b

Needs: the dev deployment of this build, the owner account (admin) and the second account (not in `ADMIN_EMAILS`), each in its own Chrome profile. Dev data only: step 9 overwrites the dev library.

1. Owner, Admin: 6 tabs, "Folders and access" to "Settings and backups". Left, Right, Home and End move between them. Second account with `manage` on one folder: only "Folders and access" and "Export and import", and the latter shows only "Export folder".
2. Owner, library: create folder `Smoke 6b`, template `Smoke 6b quote` in it with subject `Quote for {{ask:Customer}}`. Second account: open a template link of a folder it cannot see ("You don't have access").
3. Wait 5 min (the `tick` trigger). Owner, Audit log, this month, "Filter": the "Template created" row of step 2 with your address, time in local time and result "OK". Result "Denied", "Filter": the second account's row from step 2. "Details" on the create row: the drawer "Entry details" shows Before (null) and After, Duration, Request ID and App version; Esc closes it and the focus returns to Details.
4. Usage: `Smoke 6b quote` appears with "Inserts, 30 days" 0; insert it once from a draft's toolbar in Gmail, wait 5 min, reload the tab: "Inserts, 30 days" 1, "Last inserted" now.
5. Export and import: "One folder and its subfolders", Folder `Smoke 6b`, "Export". The status shows "Exporting..." then "Exported 1 templates to migway-templates-smoke-6b-<date>.json." Open the file: `schemaVersion` 1 and the subject of step 2.
6. Create folder `Smoke 6b import`. Import: "Export file" the file, "Import into" `Smoke 6b import`, "Check file": "Checked. Import would create 1 templates, 0 skipped, 0 failed." "Import": "Imported 1 templates, 0 skipped, 0 failed. Folders: 1 new, 0 existing." The library shows `Smoke 6b import / Smoke 6b / Smoke 6b quote` with the subject of step 2. "Check file" on the same file again: "0 templates, 1 skipped".
7. "Settings and backups", "Technical details": domain, ADMIN_GROUP, MEMBERSHIP_RESOLVER, CALLER_IDENTITY, INDEX_REV, app version and the library data size. The jobs table lists `tick`, `refreshMembers`, `daily` with a "Last good run" time in local time and status "OK" (a job without a run for 2 intervals shows "Late" with its last error).
8. "Settings and backups", Backups: at least one date after the first `daily` run (02:00 to 03:00). No date yet: skip step 9.
9. Dev data only. "Restore" next to the newest date: the dialog names the date and has Cancel focused. "Restore <date>": "Restored the backup of <date>." This overwrites `index.json`, `favorites.json` and `usage.json` with the copies of that night, so `Smoke 6b` and everything made after the backup leave the library. Audit log: a `backup.restore` row with your address.
10. Apps Script editor, Executions: the `import`, `export.folder` and `backup.restore` lines carry `action`, `actor`, `targetId` (the folder ID for import and export, empty for the restore), result, timing and calls; no title, subject, body or file content.

## Slice 8b

Needs: the dev deployment of this build (open the web app `/dev` URL), the owner account, the second account from slice 2 with `use` on one shared folder, and a public `https` image wider than 600 pixels plus one narrower than 600 pixels.

1. Open "Smoke 3 quote" from the library. The header shows the folder path, the title, "Saved as version N, <time>" with a check, History and Save. The email sits on a sheet with the Subject line on top; the right panel shows Details, "The sender fills in" (each field with "used once" or "used n times") and the tabs "Preview as me" and "Problems 0".
2. Toolbar: press Tab into it once, then the arrow keys: focus moves along every button, Home and End jump to the ends; hovering a button shows its name and shortcut ("Bold (Ctrl+B)"). Select a word, press B: it turns bold and B shows pressed. Select a word, "Font", "Georgia" (each menu name shows in its own face): the word turns Georgia; "Font" again shows the check on Georgia. Type `{{`: the "Insert field" menu opens; pick "Sender name": a blank appears; Backspace removes it whole. The subject's "Reads as" line shows `Product` as a dashed blank.
3. Type a word: the header says "Unsaved changes". Click "All templates": "Leave without saving?" with "Keep editing" focused. "Keep editing" stays; browser Back asks the same and the address stays on the editor. "Save and leave": the library opens and the template has a new version. Edit again, reload the tab: the browser asks before leaving (record whether it does inside Apps Script). Edit again, Ctrl+S: "Saving...", then "Saved as version N+1, <time>".
4. In To type `s8b-to@migway.com` and press Enter, in Cc paste `s8b-a@migway.com, s8b-outside@example.com`: three chips; the outside one says "outside migway.com". Type `not-an-address` and Enter in Bcc: "Bcc, address 1 is not an email address. Use the form name@company.com." under Bcc. Remove it with its × button, Save. "Preview as me" shows the To and Cc lines above the subject. Reopen the template: the chips are back.
5. Image: insert the wide image, then the narrow one. Open History, pick the new version: the wide image shows 600 pixels wide, the narrow one at its own width (not stretched).
6. History: the version of step 4 shows its To and Cc lines above the subject.
7. Second account, open a template of the `use` folder by its link: no toolbar, no Save, no History; the note "You can use this template but not change it. To change it, ask a folder manager for "Can edit" access."; title, subject and folder cannot be changed; the chips have no × button.
8. Narrow window (about 390 pixels wide, or the browser's device mode): no sideways scroll; the toolbar scrolls inside its row; the panel sits below the sheet with "Details", "The sender fills in" and "Preview" as collapsible headings.
9. Leaving through Forward (the app travels back with `Host.go`): open the library, then "Smoke 3 quote", then "History", then browser Back to the editor. In the browser console note `history.length`. Type a word, press browser Forward: "Leave without saving?" and the address stays on the editor. "Keep editing". Note `history.length` again: the same number. Press browser Back once: the question shows again; "Discard changes": the library opens, not History.
10. Back while a link dialog is open: open "Smoke 3 quote", type a word, select it, click "Link" in the toolbar so "Insert link" is open. Press browser Back: only "Leave without saving?" shows, the link dialog is gone, and the address stays on the editor. "Keep editing": no dialog is left, the typed word is still there and typing in the text works. Without unsaved changes (after Save): open "Insert link", press Back: the dialog closes and the library opens.

## Slice 9

Needs: the dev deployment of this build (reopen the add-on). Set the recipients in the web editor (slice 8b): the To, Cc and Bcc fields in the Details panel on the right; type an address and press Enter to make it a chip, then Save. Template "Smoke 9 recipients" in a shared folder, Subject `Smoke 9`, body `Hello`, To `s9-to@migway.com`, Cc `s9-cc@migway.com` and `s9-outside@example.com`, Bcc `s9-bcc@migway.com`; template "Smoke 9 plain" with body `Plain` and no recipients. Admin, "Settings and backups", Settings, Outside recipients: allowed. Nothing is sent: discard every draft. The compose card is modal: type addresses until each one is a chip, click into the draft body, then open the add-on from the draft's toolbar.

1. New draft, empty. Open the folder: the row "Smoke 9 recipients" says "Adds To 1, Cc 2, Bcc 1" and has Insert. Tap its title: the details card section "Recipients" shows the switch "Add recipients" on with "Adds 4 recipients.", then To `s9-to`, Cc `s9-cc`, Cc `s9-outside@example.com` with "outside migway.com", Bcc `s9-bcc` with "hidden from other recipients", and "Finish typing addresses in the draft first: an address still being typed is lost."; "Replace the subject" is on with `Smoke 9` below it. Insert: body `Hello`, Subject `Smoke 9`, all 4 addresses in their fields, the Bcc line open.
2. New draft, To `a@migway.com` and Cc `b@migway.com` typed as chips. Tap the title: "Not added: s9-to@migway.com. The draft already has a To recipient." and "Adds 3 recipients.". Insert: To holds only `a@`; Cc holds `b@`, `s9-cc@`, `s9-outside@`; Bcc holds `s9-bcc@`. No address lost.
3. Reply to a received message, tap the title: the To line is "Not added" and "Replace the subject" is off. Insert: To and Subject kept, Cc and Bcc added, the draft stays in its conversation. Forward of a message, row Insert: To gets `s9-to@`, the subject is kept.
4. New draft, Cc `s9-cc@migway.com` typed as a chip. Tap the title: "Not added: s9-cc@migway.com. It is already in the draft." Insert: one `s9-cc` chip.
5. Changed recipients under an open card: new draft, tap the title, keep the card open. In the web app, Admin, "Settings and backups", Settings, "Outside recipients": choose "migway.com only", Save, confirm "Allow only migway.com". Tap Insert: the draft does not change and the card shows "(!) The recipients of this template changed. Check them and press Insert again." with "Not added: s9-outside@example.com. Outside migway.com, turned off by your admin." Insert again: every address but `s9-outside@` is added.
6. `deny` on the list: tap "Open library" and close it (this drops the cached list), open the folder: the row says "Adds To 1, Cc 1, Bcc 1". Row Insert in a new draft: 3 addresses added, no `s9-outside@`. Then Admin, "Settings and backups", Settings, "Outside recipients": choose "Allowed" and Save (back to allowed).
7. Both switches off: new draft, tap the title, turn "Replace the subject" and "Add recipients" off, Insert: body `Hello` only; Subject, To, Cc and Bcc stay empty.
8. Regression: new draft, row "Smoke 9 plain" shows Insert and no "Adds" line. One tap inserts `Plain` at the cursor.
9. Apps Script editor, Executions: the `template.apply` lines of steps 1 to 8 carry `"draft":{"fields":[...],"to":n,"cc":n,"bcc":n,"hasSubject":...}`, where `fields` lists names of draft fields (for example `toRecipients`, `subject`), never their values. No line holds `s9-`, `a@migway.com`, `b@migway.com` or `example.com`.

## Slice 11

Needs: the dev deployment of this build; the owner (admin) in two browser tabs on Admin, "Settings and backups"; the pilot account with an existing "My templates" folder holding at least one template; a second domain account that never opened the library ("new user"); a shared folder with the pilot at `use` and one template whose Cc holds `s11-out@example.com`. Nothing is sent: discard every draft.

1. Before the run, Apps Script editor, Script Properties: note whether `RECIPIENTS_EXTERNAL` exists (Q50). If it is `deny`, write that down; the app ignores it from now on.
2. "Settings and backups" tab, Settings: "Personal templates" shows Off and "Default, never changed."; "Outside recipients" shows Allowed and "Default, never changed.". The "Technical details" list has no `RECIPIENTS_EXTERNAL` row.
3. Pilot, library, "My templates": the line "Personal templates are turned off by your admin. You can still insert these templates." and no New template button; the row menu has no Edit, Move, Duplicate or Delete. Gmail draft: the pilot inserts a personal template; the text arrives. Opening one in the editor and pressing Save answers "Personal templates are turned off by your admin."
4. New user, library: no "My templates" folder; with no shared folder: "No templates shared with you yet. Ask your admin for access to a folder." Gmail panel, compose: the same sentence and no button.
5. Owner, tab 1: Personal templates, On, Save: no dialog, "Saved. Personal templates are on for every user from their next action." and "Last change: <owner> on <time>.". New user reloads the library: "My templates" appears. Pilot reloads: New template is back, an edit saves.
6. Owner, tab 2 (not reloaded, still shows Off): pick On, Save: "<owner> changed this setting on <time>. The page now shows the current value."; the group shows On.
7. Owner, tab 1: Off, Save: the dialog "Turn off personal templates?" with Cancel focused; Cancel keeps On; Save, "Turn off": saved. The pilot's templates and favorites are all still listed and insertable.
8. Outside recipients: "example.com only" (migway.com on dev), Save, confirm "Allow only migway.com". Gmail draft, tap the title of the template with `s11-out@example.com`: the details card shows "Not added: s11-out@example.com. Outside migway.com, turned off by your admin." Editor Save of that template answers the `RCPT_EXTERNAL` text. Back to Allowed, Save (no dialog): tap the title again, Insert adds the address.
9. Audit log tab: 4 "Setting changed" rows (steps 5, 7, 8 twice) with before and after in the details; step 6 wrote none. Executions: the `config.set` log lines carry `targetId` "" and no "on", "off", "allow" or "deny".
10. If step 1 found `RECIPIENTS_EXTERNAL`: delete it, and set "migway.com only" in Settings if it was `deny`.

## Slice 12

Needs: the dev deployment of this build (reload Gmail), a user with at least 1 favorite, 1 recent template, 1 template with prompts, the Slice 9 template "Smoke 9 recipients", the template "Smoke 9 plain", and a folder named `R&D <b>` holding one template. Take one screenshot of each card in steps 1 to 7 and attach it to the handoff. Compare each with the card sketches in docs/handoffs/2026-11-11-implementer-to-reviewer-slice-12.md.

1. Draft toolbar, home: no card header (Gmail's bar alone says "Migway Templates"). "Search templates" with no hint below. "Favorites" rows have a star icon, "Recent" rows a clock icon (a favorite is not repeated under "Recent"), "Folders" rows a folder icon and "n templates". Each template row: the title, then one line with the hints that apply and the folder path, for example "Adds Cc 1 · 1 field to fill · Sales". Each row has one "Insert" filled in dark slate. "Open library" sits in a fixed bar at the bottom, filled in dark slate. Check: no row shows `<br>` or `&amp;`; the 4 icons show (star, clock, document, folder); the folder `R&D <b>` reads exactly `R&D <b>`. Report any `&amp;` or `&lt;` you see: labels are plain text in Gmail and the code escapes them.
2. Same card with more than 5 folders or favorites: the section shows 5 rows and a "Show more" control (Gmail's wording) for the rest.
3. Draft toolbar, open a folder: header is the folder path; subfolders first with folder icons, then template rows with a document icon and only their hints below the title (no folder path; nothing for a template without prompts or recipients); "Previous" and "Next" when there are over 20 templates; "Open library" at the bottom.
4. Draft toolbar, search `zzqx`: `No templates match "zzqx". Try fewer words, or remove folder: and tag: from the search.`. Search a real word: "Results" rows with a document icon.
5. Draft toolbar, tap a template title: the details card; header is the template title; the footer has a filled "Insert" and an outlined "Edit in library"; "Replace the subject" and "Add recipients" are switches, not buttons. A template with fields shows the section "Fields" with one box per field.
6. Regression: new draft, row "Smoke 9 plain", tap Insert once: `Plain` appears at the cursor. Discard the draft.
7. Side panel, no message open, then with a message open: the same home, folder, search and details cards, with no Insert on rows or the details card, and no boxes or switches on the details card. Each card ends with "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar." In the dev build the home card shows the section "Spike S7 (temporary)" after that line.
8. State cards: open a folder in the panel, delete one of its templates in the library in another tab, then tap that template's title in the panel: "This template was deleted or moved. Press Refresh to update the list." with Refresh. No card header. DENIED, QUOTA and the request-ID error card are not reachable in a smoke run.

## Slice 16

Needs: the dev deployment of this build; the owner (in `ADMIN_EMAILS`) and the pilot user, each in their own browser; a made-up migway.com address; a group address of migway.com; an alias of a real user if one exists; the pilot has at least one folder grant. Record each result in the handoff.

1. Owner opens Admin, "Settings and backups" tab, Settings. Admins shows "Set by the owner: <owner address>. These cannot be removed here." and "No admins added here yet."
2. Owner adds the pilot user's address. Status "<address> is now an admin."; the row reads "Added by <owner name part> on <time>."; the Audit log tab shows "Admin added", actor the owner, target the pilot.
3. Pilot reloads the web app: Admin shows the admin tabs; "Settings and backups" opens; the pilot's own row has no Remove button.
4. Pilot tries: an outside address ("Only migway.com addresses can be admins."), a made-up migway.com address and a group address (both "No migway.com account has this address. A group goes in the admin group the owner sets."), an alias of a real user if one exists (stored as the primary address; "is already an admin" names the primary address). For the made-up and the group address, open Executions and record the warn line `directory.users.get`: its `errorCode` is the reason and the Directory status, for example `ADMIN_NO_ACCOUNT:404`. A line `ADMIN_CHECK:<status>` means the Directory answer was not read as "not found": record the status and report it.
5. With the pilot's "Settings and backups" tab open, the owner removes the pilot (dialog, Cancel focused, "Remove admin"). The pilot changes a setting and presses Save: "You are no longer an admin, so nothing was changed. Ask an admin if you need access." Reload: no admin tabs.
6. Pilot in Gmail: the home card has no Refresh button, so tap "Open library" and close it (this drops the cached list). The add-on lists only the folders granted to the pilot.
7. Owner restores yesterday's backup (dev only): the Admins list is unchanged; the restore event shows `liveAdminsKept: true`.
8. Owner checks the Audit log: one "Admin added" and one "Admin removed" for the pilot, none for the refused tries. Executions: the `admin.add` and `admin.remove` log lines carry `targetId` "" and no address.

## Slice 15

One-click insert and the details card (spec 7.4, D31). Gmail web, compose toolbar, dev build (`npm run deploy -- dev`, reload Gmail). Nothing is sent: discard every draft after its step.

Templates to create in the library first, in a folder you can edit:

- T1: no fields, subject "T1 subject", any one-line text.
- T2: subject `Load {{ask:Load number}}`, text `Hi {{ask:Driver name}}, load {{ask:Load number}} is ready. {{sender.phone}}`.
- T3: Cc `smoke-cc@<your domain>` and Bcc `smoke-bcc@<your domain>` (test addresses of your domain), no fields.
- T4: the subject and text of T2 plus the Cc and Bcc of T3.
- T5: text of 3 paragraphs: "Hi team,", then `{{ask:PS}}` alone, then "Thanks".

1. New draft, cursor in the text. Row Insert on T1: the text at the cursor, subject "T1 subject". Record: the panel closed (y/n).
2. Row Insert on T2 in a new draft: subject "Load", text "Hi, load is ready." followed by your phone when the directory has one, else nothing. No card, no "{{" left.
3. Under Favorites, Recent or search results, the row of T4 reads "Adds Cc 1, Bcc 1 · 2 fields to fill · <folder path>" (the hint counts the fields the sender fills in). On a folder card the same row shows "Adds Cc 1, Bcc 1 · 2 fields to fill" without the path. Record: the label on one line, wrapped, or cut.
4. Row Insert on T3 in a new empty draft: Cc and Bcc addresses added, the Bcc line visible. Record: the panel closed (y/n).
5. Reply to a received message, row Insert on T4: To and the "Re:" subject kept, Cc and Bcc added, the fields left out of the text.
6. Open the panel (list loaded). In the library add a second Cc to T3. Within 10 minutes, row Insert on T3: the details card with "(!) The recipients of this template changed. Check them and press Insert again.", the draft unchanged. Click "Insert" there: 2 Cc added.
7. Tap the name of T2: the details card shows 2 or 3 boxes, "Replace the subject" on, the preview. Fill "Driver name" only, click "Insert": "Hi <name>, load is ready."
8. Details card of T2: 501 characters in "Driver name", click "Insert": "(!) Shorten to 500 characters: Driver name", the draft unchanged. Shorten it, click "Insert". Admin, Usage after the next 5-minute background job: the insert count of T2 rose by 1, not 2.
9. Details card of T4 in a draft with a subject: "Replace the subject" off. Turn "Add recipients" off, click "Insert": text only, subject and recipients unchanged.
10. Home: a template that is a favorite and recently inserted shows only under Favorites; no hint under "Search templates"; "Open library" is slate. Record: the color of "Edit in library" on a details card (slate or blue).
11. An admin keeps access to every folder, so this step runs as the second account with "Can use" on T1's folder: it opens the add-on (list loaded); the owner removes that access in Admin, "Folders and access". Row Insert on T1 (list still loaded): "You don't have access to this template. Ask a folder manager.", the draft unchanged.
12. Side panel (no draft): rows show no Insert; tapping a name opens the details card with no boxes and no Insert; "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar." ends the card.
13. Row Insert on T5. Record: the empty middle paragraph shows as a blank line (y/n). Yes is accepted for v1.

| Step | Record                              | Result |
| ---- | ----------------------------------- | ------ |
| 1    | panel closed (y/n)                  |        |
| 3    | label one line, wrapped or cut      |        |
| 4    | panel closed (y/n)                  |        |
| 10   | "Edit in library" color             |        |
| 13   | empty paragraph as blank line (y/n) |        |

## Spike S7

Passed 2026-11-11; the record is [docs/spikes/slice-10-s7.md](../spikes/slice-10-s7.md).

## Slice 18

Side-panel New email, Reply and Reply all (spec 4.1a, 7.2, 13.11). Gmail web, dev build (`npm run deploy -- dev`, reload Gmail). The browser agent runs [test round 1 part J](test-round-1.md#part-j-side-panel), steps 1 to 12. The owner adds two checks by hand:

1. Fresh consent (Q55, replaces part H step 2): Google Account, "Security", third-party access, "Remove access" for Migway Templates. Then side panel, inbox, row "New email" on "T1 plain". Record any prompt and the scopes it names. A prompt for a scope outside the approved 10 stops the side-panel actions until the owner approves it.
2. Apps Script editor, "Executions" (replaces part H step 3): the duration of each `onCompose` run of part J steps 2 to 4. The `template.apply` lines of part J carry no `test-` address, subject or text.

| Check | Record                         | Result |
| ----- | ------------------------------ | ------ |
| 1     | prompt, scopes, error text     |        |
| 2     | `onCompose` ms, steps 2 to 4   |        |
| 2     | log lines free of values (y/n) |        |

## Slice 19

Audit month files of 2 or more lines load (dev build, `npm run deploy -- dev`). Run as an admin.

1. Admin, "Audit log" tab, current month: the list loads, with no "The audit log could not be loaded." message.
2. Rename a folder, then reload the tab: the row "Folder renamed" of today shows at the top. Open it: the details drawer shows before and after.
3. Choose the previous month, if listed, and back: both load.
4. Admin, "Settings and backups": after the next 5-minute job, "Save insert counts and refused actions" shows "OK".
5. The next morning: "Nightly backup and cleanup" shows "OK", and the Audit log still shows yesterday's rows (now read from the month file).
