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

Needs: the dev deployment of this build (reopen the sidebar), "Smoke 3 quote" (Subject `Quote for {{ask:Product}}`), the second account from slice 2, which has opened the library once (its private folder exists). The compose card is modal: in every Gmail step, click into the draft body first, then open the add-on.

1. Library, "Smoke 3", New template: Title `Smoke 5b plain`, Subject `Plain 5b`, body `Hello`, Save. The status reads "Saved as version 1, HH:MM" with your clock's time, not UTC. The grid "Updated" column and History show the same local time.
2. Reply check (a), new draft from the inbox: Compose, type `old` in Subject, click into the body, open the add-on, preview "Smoke 5b plain": "Replaces the draft subject.", Insert and "Insert body only". Insert: body `Hello`, Subject exactly `Plain 5b`.
3. Reply check (b), new draft while a conversation is open: open any received message, then press Compose (not Reply). Repeat step 2: same result expected. Record the result.
4. Reply check (c), reply: in the open message press Reply, click into the body, open the add-on, preview "Smoke 5b plain": "The subject is kept in replies.", Insert and "Insert with subject". Insert: body changes, Subject stays `Re: ...`. Insert "Smoke 3 quote": the prompt card shows "Replace the subject" off. Send the reply to yourself: it stays in the conversation.
5. Event field names: Apps Script editor, Executions, open the `doPost` runs of steps 2 to 4. Each `template.apply` line carries `"draft":{"fields":[...],"to":n,"cc":n,"bcc":n}`. Write the `fields` list of (a), (b) and (c) into the slice 5b handoff. The rule holds when (c) lists `threadId` or `messageId` and (a) and (b) list neither. Otherwise report: the rule changes in the next slice. No address, subject or ID value appears in any line.
6. Sidebar (Slice 5 step 7): compose, click into the body, open the add-on. "Favorites" lists the starred templates with their folder path; "Recent" lists the templates inserted in steps 2 to 4 after the next `tick` (5 min). Type `quote` in "Search templates" and leave the field: results replace Home. Clear the field: Home returns.
7. Owner labels, as admin: the library tree and the Move dialog list show "My templates" once for your own folder and "My templates (second account address)" for the second account's folder. Second account, library: only its own "My templates", no address.
8. Row actions: Duplicate "Smoke 5b plain": "Duplicating..." shows at once, then "Duplicated as ...". Move the copy: "Moving..." at once. Delete the copy: the dialog opens with Cancel focused (Enter closes it, nothing is deleted); open it again, press Delete: "Deleting..." at once.
9. History of "Smoke 5b plain" from the row menu: press the Down arrow at once, without a click: the selection moves to the next version.
10. Search: reload the library, wait for the list, press `/` once without clicking: the search box has focus (record if a click was still needed). Type a word that is only in a body: "Searching text..." shows, then "Matches in text"; "No templates match" never shows in between. Type `zzqx`: "Searching text...", then `No templates match "zzqx". Try folder: or tag:.`.
