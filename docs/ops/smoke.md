# Smoke test (5 minutes, after each dev deploy)

## Slice 1

1. Gmail, compose: the Migway Templates home card shows within 3 s (since slice 4: Folders, or the empty state).
2. (Removed in slice 4 with the Ping button. Slice 4 step 1 covers the add-on to server round trip.)
3. Open the `execUrl` from `deploy/dev.json`: page shows "Migway Templates", "Signed in as <your email>" and the library (folder tree and template list, since slice 3).
4. Open the same URL in a window signed in to a non-Migway account: Google's access page or "Cannot identify your Migway account" appears, never the app shell.
5. Editor, Executions: each step above logged one JSON line with `level`, `action`, `result`, `durationMs`, `appVersion`, and no template body or token.

## Slice 2

Needs: the dev deployment after `npm run deploy -- dev`, and a second Migway account that is not in `ADMIN_EMAILS` (a pilot editor, D13).

1. Editor, function `setup`, Run. Execution log: one JSON line with `"action":"setup","result":"ok"`. Return value: `created` 8 on the first run, `triggers` 3. Editor, Triggers: `tick` every 5 min, `refreshMembers` every 15 min, `daily` daily 2 to 3 am.
2. Run `setup` again: `created` 0, still 3 triggers.
3. Drive, My Drive: folder "Migway Templates Data" holds `bodies`, `audit`, `backups`, `index.json`, `favorites.json`, `usage.json`, `members.json`. Open `index.json` with a text viewer: `"schemaVersion":1,"rev":1`.
4. Open the dev web app URL. Open Chrome DevTools, Console. In the context menu at the top of the Console (default "top"), pick the frame named `userCodeAppPanel`. Paste this helper once (temporary; slice 3 brings the UI):
   `const call = (op, args) => google.script.run.withSuccessHandler((r) => console.log(op, JSON.stringify(r))).rpc(op, args);`
5. `call("folder.create", { name: "Smoke" })`: `{"ok":true,"data":{"id":"...","name":"Smoke",...}}`. Copy the `id`.
6. `call("template.create", { folderId: "<id>", title: "Smoke test", html: "<p>Hello</p>" })`: `ok` true, `version` 1.
7. Drive: `bodies` holds `<templateId>.v1.json`; `index.json` contains `Smoke test` and 2 entries in `pendingAudit` (`folder.create`, `template.create`).
8. `call("template.list", {})`: one item. `call("folder.list", {})`: `Smoke` plus your private folder "My templates".
9. Second account, same web app, same helper: `call("template.list", {})` returns 0 items; `call("folder.create", { name: "X" })` returns `DENIED`. After 5 min (next `tick`), `index.json` `pendingAudit` holds a `"result":"denied"` event with that account as `actor`.
10. Editor, Executions: each call above wrote one JSON line with `cache` (`hit`, `miss` or `rebuild`) and no `Hello` text.
11. Editor, Script Properties: `job:tick:lastOk` is under 10 min old.

## Slice 3

Needs: the dev deployment after `npm run deploy -- dev`, and the second Migway account from slice 2 (not in `ADMIN_EMAILS`, no grant).

1. Open the dev web app URL. The library shows skeleton rows, then the folder tree and "Signed in as <your email>". Press `/`: the search box takes focus.
2. Create a folder "Smoke 3" with the slice 2 console helper (`call("folder.create", { name: "Smoke 3" })`; folder admin arrives in slice 6). Reload: "Smoke 3" is in the tree. Select it with the arrow keys and Enter: "No templates in Smoke 3." and "+ New template".
3. "+ New template". Title "Smoke 3 quote", tag "smoke". In the body type "Hi " then `{{`: the placeholder menu opens; pick "Recipient first name". Type ", your price for " then use the toolbar "{{ Placeholder" button, "Ask the user...", type "Product" in "Question shown when the template is used", OK. End with a new line and pick "Sender name" from the menu. "Preview as me" shows your Directory name and "[Product]".
4. Press Ctrl+S. The button reads "Saving..." and is disabled, then the status reads "Saved as version 1, HH:MM". The problems list shows "Warning: recipient.first_name has no fallback". Select the "Recipient first name" chip, open "{{ Placeholder", "Add fallback...", type "there" in "Text used when the value is unknown", OK, save: "Saved as version 2", no warning.
5. Bold the "Sender name" chip with Ctrl+B and save (version 3). Drive, `bodies/<id>.v3.json`: `html` holds `<strong>{{sender.name}}</strong>`, `{{recipient.first_name|there}}` and `{{ask:Product}}`; `index.json` item has `placeholders` `["recipient.first_name","sender.name"]`, `prompts` `["Product"]`, a `snippet` and `sizeBytes`.
6. Conflict: open the same template in a second tab, change a word, save (version 4). In the first tab change a word and save: the dialog "This template changed" reads "<your email> saved version 4 at <time> while you edited.", with "Open their version", "Copy my text" and "Cancel". Esc closes it and focus returns to Save. Save again, pick "Open their version": the body shows the second tab's text, "Version 4", and the status "Loaded the latest version. Your changes were discarded."
7. History: "History" lists versions 4 to 1, newest first. Arrow down to version 1, Enter: the preview shows chips. Press R, dialog "Create version 5 from version 1?", "Restore": the dialog closes at once, status "Restoring version 1...", then "Restored as version 5."; the list shows "Version 5, ..., current, restored from 1".
8. Paste into the body a link `javascript:alert(1)` copied from a web page and save: the link mark is gone. Drive body file: no `javascript:`.
9. Second account, same URL: the library shows no "Smoke 3" folder. Open `<url>#/edit/<template id>`: banner "You don't have access to this template. Ask a folder manager." with "Back to the library".
10. Editor, Executions: one JSON line per call, `requestId` equals the ID a toast would show (format `XXXXXXXX-XXXXXX`), and no body text, prompt value or token in the log.

## Slice 4

Needs: the dev deployment after `npm run deploy -- dev` (code only: reopen the sidebar), the "Smoke 3" folder and "Smoke 3 quote" template from slice 3, and the second account from slice 2 (no grant).

1. Gmail web, compose, open Migway Templates. Within 3 s the home card shows "Folders" with "Smoke 3 (1)" and "My templates (n)", and "Open library". Close and reopen within 10 min: the card shows faster (User Cache hit, no `sidebar.home` line in Executions).
2. Tap "Smoke 3": the folder card is titled "Smoke 3" and lists "Smoke 3 quote" with "1 field to fill" and its snippet. Tap the title: the preview shows plain text with "[Recipient first name]", "[Product]" and "[Sender name]", "Fields to fill: Product", Insert and "Edit in library".
3. To: one Migway colleague. Tap Insert: the prompt card asks "Product *". Tap Insert with the field blank: "(!) Fill 1 field: Product" and the draft is unchanged.
4. Enter `<b>A & B</b>`, a new line, `second line`; tap Insert. The body shows the colleague's first name, the text literally (no bold), on 2 lines, and your Directory name in bold. Stopwatch from tap to body change: under 2 s.
5. In the library, create "Smoke 4 plain" in "Smoke 3" with body `Hello {{recipient.first_name|there}}` (no prompts). Back in Gmail, compose with no recipient and open the "Smoke 3" folder card (Open library cleared the cached view). Tap Insert on "Smoke 4 plain": "Hello there" appears at the cursor in one click.
6. Preview "Smoke 3 quote", tap "Edit in library": the editor opens in an overlay on that template. Close it: the sidebar reloads to the home card.
7. In the library, on the "Smoke 4 plain" row, "Actions", "Delete...", "Delete" (since slice 4b), while its folder card is open in another compose window. Tap its Insert: "This template was removed or moved." with Refresh; Refresh shows the home card without it.
8. Second account: compose, open the add-on. The home card shows "No templates shared with you yet." and "Open library".
9. (Removed in slice 5 with the spike S4 harness. Results: docs/spikes/slice-04-insert.md.)
10. Editor, Executions: one JSON line per `sidebar.home` and `template.apply` call, with `surface` `addon`; no recipient address, prompt value or body text. After the next `tick` (5 min), `usage.json` shows `applyCount` for "Smoke 3 quote" and the template in `recent` for your email.

## Slice 4b

Needs: the dev deployment after `npm run deploy -- dev` and the "Smoke 3" folder.

1. Library, "Smoke 3", "+ New template", title "Smoke 4b", body "one", Save: "Version 1". Open `<url>#/edit/<its id>` in a second tab, add the word "two", Save: "Version 2". First tab: add the word "three" in the body, Ctrl+S with the cursor in the body: dialog "This template changed". Esc: focus is on Save. Save again, "Open their version": the body reads "one two", "Version 2", status "Loaded the latest version. Your changes were discarded."
2. "History", arrow to version 1, R, "Restore": the dialog closes at once and the status reads "Restoring version 1...", then "Restored as version 3."
3. Library, reload. Tab (no click) until a folder row has a focus ring. Arrow down, Enter: the list heading names that folder and the focus ring stays on the row. Arrow up, Enter: the list changes again. Click another folder: the focus ring moves to it and arrows work.
4. Grid: focus the "Smoke 4b" title cell, Shift+F10: menu "Edit", "Duplicate", "Move...", "History", "Delete...". Arrow keys move, Esc closes it and the focus ring is back on the cell. End, Enter on the "Actions" cell opens the same menu.
5. "Duplicate": status `Duplicated as "Copy of Smoke 4b".`, focus on the copy. Its menu, "Move...": the list holds only folders where you have edit, never "Smoke 3" itself (an admin also sees other accounts' "My templates"). Pick "My templates", "Move": status `Moved "Copy of Smoke 4b" to My templates.`
6. Copy's menu, "Delete...": `Delete "Copy of Smoke 4b"? Deleted templates stay in the trash for 30 days.` "Cancel" keeps it; "Delete" removes it from the list with status `Deleted "Copy of Smoke 4b".`
7. Editor, Executions: the `web.open` line and every `rpc` and `doPost` line carry a `requestId` in the format `XXXXXXXX-XXXXXX`; the `version.restore` line of step 2 has `targetId` = the template ID.
8. Timing: every `rpc` and `doPost` line has `calls` (props, cache, drive, lock, dir) and `timing` (`startupMs` script load to handler start, `totalMs` script load to log line, `propsMs`, `cacheMs`, `driveReadMs`, `driveWriteMs`, `lockMs`, `dirMs`); add-on lines add `addonPreMs`, `addonTokenMs` and, from the second call of one callback, `prevFetchMs` and `prevTotalMs`. A warm `sidebar.home` or `template.apply` shows `"props":1` and `"drive":0`. Copy the add-on function durations (onComposeOpen, onOpenFolder, onInsert, onPromptInsert) next to these fields into the slice 4b timing table of the handoff.

## Slice 5

Needs: the dev deployment after `npm run deploy -- dev` (reopen the sidebar), the "Smoke 3" folder and "Smoke 3 quote" template, the second account from slice 2 (no grant), and one `tick` run after the deploy (5 min).

1. Spike S5 (Q20, Q21). Library, "Smoke 3 quote", Subject `Quote for {{ask:Product}}`, Save. Gmail web: (a) new compose, type `old` in Subject, open the add-on, tap Insert on "Smoke 3 quote", fill "Product" with `Pen`, Insert: record whether the body changed and whether Subject reads exactly `Quote for Pen` (replaced, not appended). (b) Open any received message, Reply, Insert the same template: record body and subject the same way, and whether the thread still groups the reply after sending it to yourself. (c) If Gmail asks for a new permission or shows an error, stop: no further steps; report the text. Write the results into the slice 5 handoff.
2. Preview "Smoke 3 quote": "Subject" with `Quote for [Product]`, "Replaces the draft subject.", Insert and "Insert body only". New compose with Subject `keep`, "Insert body only", fill "Product": the body changes, Subject stays `keep`.
3. Insert again; on the prompt card turn "Replace the subject" off, fill "Product", Insert: Subject unchanged. Tap Insert with "Product" blank: "(!) Fill 1 field: Product", draft unchanged.
4. Library editor of "Smoke 3 quote": Subject shows `n/200 (optional)`; put the cursor in Subject, "{{ Placeholder", "Sender name": `{{sender.name}}`appears at the cursor; "Preview as me" shows "Subject: " with your name. Type`{{sender.nmae}}` in Subject, Save: "Error: Subject: Unknown placeholder sender.nmae at character ...". Fix and save. "History": the version preview shows the "Subject:" line; restore an older version: its subject comes back.
5. Library: star "Smoke 3 quote" with the mouse, then another row with Tab to its star cell and Enter: "Added ... to favorites.", star filled. "★ Favorites" shows only starred rows; press it again to see all.
6. Library search: `/`, type `quote for`: "Smoke 3 quote" (subject match). Type a word that is only in a body: it appears under "Matches in text" within 1 s. `folder:smoke tag:smoke` filters. DevTools, Performance, User Timing: `library.list` under 50 ms, `library.body` under 1 s.
7. Gmail, compose, open the add-on (Open library cleared the cached view): "Favorites" lists the starred templates with their folder path; "Recent" lists templates inserted in steps 1 to 3 after the next `tick`. Type `quote` in "Search templates" and leave the field: results replace Home; clear the field: Home returns.
8. Second account: compose, open the add-on: no "Favorites" or "Recent" entries from your templates; search `quote` shows "No templates match quote. Try folder: or tag:.".
9. Editor, Executions: `search`, `favorite.set` and `search.body` lines carry `action`; a warm `sidebar.home`, `search` and `template.apply` show `"props":1` and `"drive":0`. No subject text, body text or query text in any line. Script Properties: `FAVORITES_REV` and `USAGE_REV` are set.

## Slice 5b

Needs: the dev deployment of this build (reopen the sidebar), "Smoke 3 quote" (Subject `Quote for {{ask:Product}}`), the second account from slice 2, which has opened the library once (its private folder exists). The compose card is modal: in every Gmail step, click into the draft body first, then open the add-on. The reply checks of the first version (old steps 2 to 5) moved to "Slice 5c": the compose event carries no `threadId` or `messageId` (fifth smoke run).

1. Library, "Smoke 3", New template: Title `Smoke 5b plain`, Subject `Plain 5b`, body `Hello`, Save. The status reads "Saved as version 1, HH:MM" with your clock's time, not UTC. The grid "Updated" column and History show the same local time.
2. Sidebar (Slice 5 step 7): compose, click into the body, open the add-on. "Favorites" lists the starred templates with their folder path; "Recent" lists the templates you inserted, after the next `tick` (5 min). Type `quote` in "Search templates" and leave the field: results replace Home. Clear the field: Home returns.
3. Owner labels, as admin: the library tree and the Move dialog list show "My templates" once for your own folder and "My templates (second account address)" for the second account's folder. Second account, library: only its own "My templates", no address.
4. Row actions: Duplicate "Smoke 5b plain": "Duplicating..." shows at once, then "Duplicated as ...". Move the copy: "Moving..." at once. Delete the copy: the dialog opens with Cancel focused (Enter closes it, nothing is deleted); open it again, press Delete: "Deleting..." at once.
5. History of "Smoke 3 quote" (several versions) from the row menu: press the Down arrow at once, without a click: the selection moves to the next version.
6. Search: reload the library, wait for the list, press `/` once without clicking: the search box has focus (record if a click was still needed). Type a word that is only in a body: "Searching text..." shows, then "Matches in text"; "No templates match" never shows in between. Type `zzqx`: "Searching text...", then `No templates match "zzqx". Try folder: or tag:.`.

Note on step 6: the first `/` after a load may need a second press. The browser gives the app frame no focus before a click or a key press inside it.

## Slice 5c

Needs: the dev deployment of this build (reopen the sidebar), "Smoke 5b plain" (Subject `Plain 5b`, no prompts) and "Smoke 3 quote" (Subject `Quote for {{ask:Product}}`). The compose card is modal: in every Gmail step, click into the draft body first, then open the add-on.

1. Empty subject: Compose, leave Subject empty, click into the body, open the add-on, preview "Smoke 5b plain": "Sets the draft subject.", Insert and "Insert body only". Insert: body `Hello`, Subject exactly `Plain 5b`.
2. Typed subject: Compose, type `old` in Subject, click into the body, open the add-on, preview "Smoke 5b plain": "The draft already has a subject. It is kept.", Insert and "Insert with subject". Insert: the body changes, Subject stays `old`. Preview again, "Insert with subject": Subject becomes `Plain 5b`. Insert "Smoke 3 quote": the prompt card shows "Replace the subject" off.
3. Reply: open any received message, press Reply, click into the body, open the add-on, Insert "Smoke 5b plain": the body changes, Subject stays `Re: ...`. Send the reply to yourself: it stays in its conversation.
4. Log: Apps Script editor, Executions, open the `doPost` runs of steps 1 to 3. Each `template.apply` line carries `"draft":{"fields":[...],"to":n,"cc":n,"bcc":n,"hasSubject":...}`: `false` in step 1, `true` in steps 2 and 3. If step 2 or 3 shows `false`, Gmail sends the field without its value and Insert replaces the subject as in build 32a446c: report it. Every line has `actor` and `targetId` (spec 11); no line has a recipient address, subject text, body text or prompt value.

## Slice 6a

Needs: the dev deployment of this build, the owner account (admin) in one Chrome profile and the second account (not in `ADMIN_EMAILS`) in another. Optional: one Google Group whose members the owner can see, with the second account as a direct member. Without a group, use a user grant in step 4.

1. Owner, web app: the rail shows Admin. Open it (or `?view=admin`): tabs "Folders and grants" and "Memberships", no other tab. Left and Right move between the tabs.
2. "+ Top-level folder", name `Smoke 6a`: the status shows "Creating folder..." at once, then the folder is selected. Effective access says "Only admins can see this folder. Add a grant to share it." Add a subfolder `Inner`, rename it `Inner 2`, delete `Inner 2` (Cancel has the focus first; Delete confirms).
3. In the library, create template `Smoke 6a secret` in `Smoke 6a`.
4. Second account, web app: no `Smoke 6a` in the tree, no Admin in the rail; `?view=admin` shows "You don't have access to the admin view." and no folder. Sidebar search `secret`: no result.
5. Owner, Admin, `Smoke 6a`: Add grant, type Group, the group address, level use (or type User, the second account, level use). A group the owner cannot see answers "was not found or its members are not visible". The row shows the principal, `use`, "this folder".
6. Second account: reload. The library shows `Smoke 6a` and the template; the sidebar inserts it. Admin is still absent (use only).
7. Owner, Memberships: the group (step 5) has a member count; "Refresh now" shows "Refreshing memberships..." then "Refreshed n groups." A group with a child group shows a "Warning:" row.
8. Owner, Admin, `Smoke 6a`: Remove the grant. Second account, reload: `Smoke 6a` is gone; opening the template link answers "You don't have access". This is BRIEF 13 DoD 3.
9. Owner, library: delete `Smoke 6a secret`. Trash (under the folder tree) lists it with the deleted time in local time and 30 days left. Restore: it is back in `Smoke 6a`. Delete it again, then "Empty trash now..." (Cancel has the focus first), confirm: "Removed n items for good."
10. Apps Script editor, Executions: the `grant.add` and `grant.remove` lines carry `action`, `actor` and `targetId` (the folder ID for `grant.add`, empty for `grant.remove`), and no group or user address of the grant.

## Slice 6b

Needs: the dev deployment of this build, the owner account (admin) and the second account (not in `ADMIN_EMAILS`), each in its own Chrome profile. Dev data only: step 9 overwrites the dev library.

1. Owner, Admin: 6 tabs, "Folders and grants" to "Config". Left, Right, Home and End move between them. Second account with `manage` on one folder: only "Folders and grants" and "Export and import", and the latter shows only "Export folder".
2. Owner, library: create folder `Smoke 6b`, template `Smoke 6b quote` in it with subject `Quote for {{ask:Customer}}`. Second account: open a template link of a folder it cannot see ("You don't have access").
3. Wait 5 min (the `tick` trigger). Owner, Audit log, this month, Apply: the `template.create` row of step 2 with your address, time in local time and result ok. Result filter "denied", Apply: the second account's row from step 2. Details on the create row: the drawer shows before (null) and after JSON, durationMs, request ID and app version; Esc closes it and the focus returns to Details.
4. Usage: `Smoke 6b quote` appears with 0 applies; insert it once from the sidebar, wait 5 min, reload the tab: 1 apply, last used now.
5. Export and import: Folder `Smoke 6b`, "Download JSON". The status shows "Exporting..." then the file name `migway-templates-smoke-6b-<date>.json`. Open the file: `schemaVersion` 1 and the subject of step 2.
6. Create folder `Smoke 6b import`. Import: choose the file, target `Smoke 6b import`, Validate: "would create 1 templates, 0 skipped, 0 failed". Import: "Imported: 1 templates". The library shows `Smoke 6b import / Smoke 6b / Smoke 6b quote` with the subject of step 2. Validate the same file again: "0 templates, 1 skipped".
7. Config: domain, ADMIN_GROUP, MEMBERSHIP_RESOLVER, CALLER_IDENTITY, INDEX_REV, app version and the index size. The jobs table lists `tick`, `refreshMembers`, `daily` with a Last OK time in local time and status ok (a job without a run for 2 intervals shows "late" in red with its last error).
8. Config, Backups: at least one date after the first `daily` run (02:00 to 03:00). No date yet: skip step 9.
9. Dev data only. Restore from backup, pick the newest date: the dialog names the date and has Cancel focused. Confirm: "Restored the backup of <date>." This overwrites `index.json`, `favorites.json` and `usage.json` with the copies of that night, so `Smoke 6b` and everything made after the backup leave the library. Audit log: a `backup.restore` row with your address.
10. Apps Script editor, Executions: the `import`, `export.folder` and `backup.restore` lines carry `action`, `actor`, `targetId` (the folder ID for import and export, empty for the restore), result, timing and calls; no title, subject, body or file content.

## Spike S6

Spec 14.1, about 20 min, one Gmail web session. Needs: the dev deployment of this build (`npm run deploy -- dev`, reopen the sidebar). The section "Spike S6 (temporary)" sits at the end of the home card in the dev build only. Nothing is sent: discard every draft after its step. A and B below are two addresses of your choice; the harness adds `s6-to@migway.com`, `s6-cc@migway.com`, `s6-bcc@migway.com`.

The compose card is modal. In every step, type the recipients first, click into the draft body, then open the add-on, tap "Open S6 harness" and the named button. The harness card shows the draft's To, Cc and Bcc strings as Gmail sent them, and under each button the actions its response holds. The card cannot change after a tap: the draft is the result. "New only" and "Draft plus new" add a second body line with the action list and the callback time in ms.

1. New draft, no recipients. Button "New only". Record y/n for each: body "S6 body", Subject `S6 test`, To, Cc, Bcc set; the Bcc line opens by itself; the callback ms from the body line.
2. New draft, To A, Cc B typed. Button "New only". Record: A and B still there (add) or gone (replace). Copy the card's "Draft recipients as received" text for step 8.
3. Same as step 2, fresh draft. Button "Draft plus new". Record: all 5 addresses present once (y/n); A or B present twice (y/n).
4. New draft, Cc `s6-cc@migway.com` typed. Button "Raw Cc again". Record: one `s6-cc` chip or two.
5. Open a received message, Reply. Button: "New only" if step 2 kept A and B, else "Draft plus new". Record: To kept, Cc and Bcc added, Subject kept, the reply stays in its conversation (send nothing; check the draft sits under the message). Copy the card's received text for step 8.
6. Open a received message, Forward. Same button as step 5. Record: To added (a forward has an empty To).
7. Account with no earlier consent run, or after Google Account, Security, "Remove access" for the add-on and re-authorizing. New draft, no recipients. Button "New only". Record: any permission or consent prompt and the scopes it names. A prompt stops D26 work: no manifest change.
8. No button. From the texts of steps 2 and 5, record the format of each string (for example `Name <address>` or the address alone).

If a response fails (error toast, nothing changes) in step 1, repeat it with "Recipients only" (fallback F1) and record the result.

| Step | Draft                    | Button          | Result | Callback ms | Notes |
| ---- | ------------------------ | --------------- | ------ | ----------- | ----- |
| 1    | New, empty               | New only        |        |             |       |
| 1 F1 | New, empty               | Recipients only |        |             |       |
| 2    | New, To A, Cc B          | New only        |        |             |       |
| 3    | New, To A, Cc B          | Draft plus new  |        |             |       |
| 4    | New, Cc `s6-cc`          | Raw Cc again    |        |             |       |
| 5    | Reply                    |                 |        |             |       |
| 6    | Forward                  |                 |        |             |       |
| 7    | New, fresh consent       | New only        |        |             |       |
| 8    | Event strings of 2 and 5 | none            |        |             |       |
