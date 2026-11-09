# Smoke test (5 minutes, after each dev deploy)

## Slice 1

1. Gmail, compose: the Migway Templates home card shows within 3 s (since slice 4: Folders, or the empty state).
2. (Removed in slice 4 with the Ping button. Slice 4 step 1 covers the add-on to server round trip.)
3. Open the `execUrl` from `deploy/dev.json`: page shows "Migway Templates" and "Signed in as <your email>"; Ping server shows "Ping ok".
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
3. "+ New template". Title "Smoke 3 quote", tag "smoke". In the body type "Hi " then `{{`: the placeholder menu opens; pick "Recipient first name". Type ", your price for " then use the toolbar "{{ Placeholder" button, "Ask the user...", label "Product". End with a new line and pick "Sender name" from the menu. "Preview as me" shows your Directory name and "[Product]".
4. Press Ctrl+S. The button reads "Saving..." and is disabled, then the status reads "Saved as version 1, HH:MM". The problems list shows "Warning: recipient.first_name has no fallback". Select the "Recipient first name" chip, open "{{ Placeholder", "Add fallback...", enter "there", save: "Saved as version 2", no warning.
5. Bold the "Sender name" chip with Ctrl+B and save (version 3). Drive, `bodies/<id>.v3.json`: `html` holds `<strong>{{sender.name}}</strong>`, `{{recipient.first_name|there}}` and `{{ask:Product}}`; `index.json` item has `placeholders` `["recipient.first_name","sender.name"]`, `prompts` `["Product"]`, a `snippet` and `sizeBytes`.
6. Conflict: open the same template in a second tab, change a word, save (version 4). In the first tab change a word and save: the dialog "This template changed" names you and version 4, with "Open their version", "Copy my text" and "Cancel". Esc closes it and focus returns to Save. Save again, pick "Open their version": the body shows the second tab's text, "Version 4".
7. History: "History" lists versions 4 to 1, newest first. Arrow down to version 1, Enter: the preview shows chips. Press R, confirm "Create version 5 from version 1?": status "Restored as version 5."; the list shows "Version 5 ... restored from 1".
8. Paste into the body a link `javascript:alert(1)` copied from a web page and save: the link mark is gone. Drive body file: no `javascript:`.
9. Second account, same URL: the library shows no "Smoke 3" folder. Open `<url>#/edit/<template id>`: banner "You don't have access to this template. Ask a folder manager." with "Back to the library".
10. Editor, Executions: one JSON line per call, `requestId` equals the ID a toast would show (format `XXXXXXXX-XXXXXX`), and no body text, prompt value or token in the log.

## Slice 4

Needs: the dev deployment after `npm run deploy -- dev` (code only: reopen the sidebar), the "Smoke 3" folder and "Smoke 3 quote" template from slice 3, and the second account from slice 2 (no grant).

1. Gmail web, compose, open Migway Templates. Within 3 s the home card shows "Folders" with "Smoke 3 (1)" and "My templates (n)", "Open library", and "Spike S4 (temporary, admins)". Close and reopen within 10 min: the card shows faster (User Cache hit, no `sidebar.home` line in Executions).
2. Tap "Smoke 3": the folder card is titled "Smoke 3" and lists "Smoke 3 quote" with "1 field to fill" and its snippet. Tap the title: the preview shows plain text with "[Recipient first name]", "[Product]" and "[Sender name]", "Fields to fill: Product", Insert and "Edit in library".
3. To: one Migway colleague. Tap Insert: the prompt card asks "Product *". Tap Insert with the field blank: "(!) Fill 1 field: Product" and the draft is unchanged.
4. Enter `<b>A & B</b>`, a new line, `second line`; tap Insert. The body shows the colleague's first name, the text literally (no bold), on 2 lines, and your Directory name in bold. Stopwatch from tap to body change: under 2 s.
5. In the library, create "Smoke 4 plain" in "Smoke 3" with body `Hello {{recipient.first_name|there}}` (no prompts). Back in Gmail, compose with no recipient and open the "Smoke 3" folder card (Open library cleared the cached view). Tap Insert on "Smoke 4 plain": "Hello there" appears at the cursor in one click.
6. Preview "Smoke 3 quote", tap "Edit in library": the editor opens in an overlay on that template. Close it: the sidebar reloads to the home card.
7. Delete "Smoke 4 plain" in the library while its folder card is open in another compose window. Tap its Insert: "This template was removed or moved." with Refresh; Refresh shows the home card without it.
8. Second account: compose, open the add-on. The home card shows "No templates shared with you yet." and "Open library"; no spike section.
9. Spike S4: run docs/spikes/slice-04-insert.md steps 1 to 6 (fixtures F1 to F9 on Gmail web), then steps 7 to 9 on Android and iOS. Fill in its result tables.
10. Editor, Executions: one JSON line per `sidebar.home`, `template.apply` and `spike.s4` call, with `surface` `addon`; no recipient address, prompt value or body text. After the next `tick` (5 min), `usage.json` shows `applyCount` for "Smoke 3 quote" and the template in `recent` for your email.
