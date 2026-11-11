# Test round 1 (dev build, before the Workspace deploy)

This plan tests the dev build of Migway Templates: the web editor, the Gmail cards, the admin settings and the second account. Each part runs alone in one sitting. Paste one part at a time to the browser agent, together with "Rules for the browser agent" and "Before you start". Parts F and H are for people, not for the agent.

## Rules for the browser agent

1. Work only in tabs you open yourself. Leave every other tab alone.
2. Send no email. Discard every draft when its step ends (the trash icon "Discard draft" in the draft window).
3. Never type a password.
4. Stop at any sign in page or permission (consent) page. Report the page title and its text, then wait.
5. Before step 1, read the build version (see "The build") and report it.
6. Report each step as pass, fail or blocked, with what you saw. Quote screen text exactly. For a "Record:" line, write the value into the result table of the part.
7. Do not open the Apps Script editor or the browser console. Part H holds those checks.
8. After "Insert" or any button on a Gmail card, wait up to 10 seconds for the card or the draft to change before you read the result.
9. In Gmail, click by element, not by screen position. In the message list click only the one message a step names. Open only automated notification messages, never a personal conversation. If a click changes anything else (a label, the trash, read state, a dialog), undo it at once and report it.

## Before you start

### The build

Open the web app link (the owner gives it). At the bottom of the left menu, under your name, the line reads "Version dev-" followed by 7 letters and digits, for example "Version dev-9773b75". The same value shows in Admin, "Settings and backups", "Technical details", row "App version". Write it at the top of the report. The Gmail cards show no version.

### The accounts

- Owner: an admin of the app, in one Chrome profile.
- Second account: an account of the same domain that is not an admin, in another Chrome profile. It already has the add-on from the earlier 6a run.

In this plan, `<your domain>` is the part after the @ in the owner's address. Where a step says "your name" in a "Last change", "Added by" or "changed this setting" line, the app shows the part of your address before the @. Texts that hold a first name or a phone come from the company directory; when the directory has none, that part is left out. Test addresses such as `test-cc@<your domain>` belong to nobody; nothing is sent, so no mail goes out.

### The state of dev

- Personal templates are off. The owner turns them on in Admin, "Settings and backups" only where a step says so, and off again in the same part.
- Outside recipients are allowed.
- The shared folder "Smoke 6a" exists. The second account has no access to it at the start.

### How to open the add-on in Gmail

Gmail, "Compose". Click into the text of the draft first. Then click the Migway Templates icon (a red "M") in the bottom toolbar of the draft window. In a narrow draft window Gmail moves it into the "⋮" menu of that toolbar, as "Migway Templates". Click nothing else in that toolbar. The card opens over the draft. In this plan, "row Insert" means the "Insert" button on a template row, and "tap the name" means a click on the template title, which opens the details card.

### Templates to create once

The owner creates these once in the web editor before part A. In the library, on "All templates": "New template", "Create the template in" "Smoke 6a", "Create". (Inside the folder "Smoke 6a" the button opens the editor at once, with that folder set.) Type the title in "Title" and the subject in "Subject". For To, Cc and Bcc (panel "Details" on the right) type one address and press Enter, so it becomes a chip. Press "Save". Expect: "Saved as version 1, " followed by the time.

The table writes fields as `{{...}}`. In the text, type the words and spaces exactly as shown, and at each field use the menu: for `{{ask:Name}}` choose "Insert field", "Ask the sender...", type the name in "Field name the sender sees", OK; for `{{sender.phone}}` choose "Insert field", "Sender phone"; for `{{recipient.first_name}}` choose "Insert field", "Recipient first name". In "Subject" type the field as shown.

| Title                | Subject                    | Text                                                                                                             | To                      | Cc                                                 | Bcc                      |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------- | ------------------------ |
| T1 plain             | `T1 subject`               | `T1 text.`                                                                                                       |                         |                                                    |                          |
| T2 fields            | `Load {{ask:Load number}}` | `Hi {{ask:Driver name}}, load {{ask:Load number}} is ready. {{sender.phone}}` (one space before the phone field) |                         |                                                    |                          |
| T3 copies            |                            | `T3 text.`                                                                                                       |                         | `test-cc@<your domain>`                            | `test-bcc@<your domain>` |
| T4 fields and copies | as T2                      | as T2                                                                                                            |                         | `test-cc@<your domain>`                            | `test-bcc@<your domain>` |
| T5 paragraphs        |                            | 3 paragraphs: `Hi team,`, then `{{ask:PS}}` alone, then `Thanks`                                                 |                         |                                                    |                          |
| T6 recipients        | `T6 subject`               | `Hello`                                                                                                          | `test-to@<your domain>` | `test-cc@<your domain>` and `test-out@example.com` | `test-bcc@<your domain>` |
| T7 first name        |                            | `Hello {{recipient.first_name}}` (no default text; the warning on save is expected)                              |                         |                                                    |                          |
| T8 escaping          |                            | `<b>A & B</b>` typed as plain text                                                                               |                         |                                                    |                          |

T8 goes into a subfolder: Admin, "Folders and access", select "Smoke 6a", "New subfolder", name `R&D <b>`. Then create T8 in that subfolder.

Last: in the library, click the star of "T1 plain" so it is a favorite.

## Part A: web editor

Web app, owner. About 25 minutes.

1. Library, click "T2 fields". Expect: the header shows "Smoke 6a", the title, "Saved as version" with a time, "History" and "Save". The right panel shows "Details", "The sender fills in" (each field with "used once" or "used n times") and the tabs "Preview as me" and "Problems 0".
2. Library, "All templates", "New template", "Create the template in" "Smoke 6a", "Create". Title `A scratch`, text `one`, "Save". Expect: "Saved as version 1, " and the time.
3. Press Tab until a toolbar button has focus, then the arrow keys. Expect: focus moves along the buttons; Home and End jump to the ends. The hover text "Bold (Ctrl+B)" does not show in screenshots; a person checks it in part H.
4. Select a word, "Font", "Georgia". Expect: the word turns Georgia; "Font" again shows a check on "Georgia". Record: each font name shows in its own face (y/n).
5. Type `{{`. Expect: the "Insert field" menu opens. Pick "Sender name": a chip with the words "Sender name" on an amber background appears. Press Backspace: the chip goes away whole.
6. Type a word. Expect: "Unsaved changes". Click "All templates". Expect: "Leave without saving?" with "Keep editing" focused. Click "Keep editing": the editor stays. Click "All templates" again, then "Save and leave". Expect: the library opens.
7. Open "A scratch". In To type `test-to@<your domain>` and press Enter. In Cc paste or type `test-a@<your domain>, test-out@example.com` and press Enter. Expect: three chips; the outside one says "outside <your domain>".
8. In Bcc type `not-an-address` and press Enter. Expect: "Bcc, address 1 is not an email address. Use the form name@company.com." Remove it with its × button, then "Save". Expect: "Preview as me" shows the To and Cc lines above the subject. Reload the page and open "A scratch": the chips are back.
9. "Insert field", "Ask the sender...", type `Product` in "Field name the sender sees", OK, "Save". Expect: "The sender fills in" lists "Product" with "used once".
10. Click "Image". In "Image address (https)" paste the wide image address the owner gives (wider than 600 pixels), confirm. Repeat with the narrow image address. "Save". Expect: both images show in the text. Open "History" and pick the newest version. Record: the wide image shows 600 pixels wide and the narrow one at its own width (y/n).
11. In "History" pick the version of step 8. Expect: its To and Cc lines show above the subject.
12. Open "A scratch", type a word, select it, click "Link". Expect: "Insert link" opens. Press the browser Back button. Expect: only "Leave without saving?" shows, the link dialog is gone, and the address stays on the editor. Click "Keep editing": no dialog is left and typing works.
13. "Save". Library, on the "A scratch" row, "Actions", "Delete...", "Delete". Expect: the row leaves the list.

| Step | Record                                 | Result |
| ---- | -------------------------------------- | ------ |
| 4    | font names in their own face (y/n)     |        |
| 10   | wide at 600, narrow at own width (y/n) |        |

## Part B: recipients and one click insert

Gmail, owner, the add-on in a draft's toolbar. About 25 minutes. Discard every draft after its step.

1. New draft, click into the text. Open the add-on, folder "Smoke 6a", row Insert on "T1 plain". Expect: "T1 text." at the cursor, Subject "T1 subject". Record: the card closed after the insert (y/n).
2. New draft, row Insert on "T2 fields". Expect: Subject "Load", text "Hi, load is ready." followed by your phone when the directory has one, else nothing. No card, no "{{" left.
3. New draft, row Insert on "T3 copies". Expect: Cc `test-cc@<your domain>` and Bcc `test-bcc@<your domain>` added, the Bcc line visible. Record: the card closed (y/n).
4. Open a received message, "Reply", click into the text, row Insert on "T4 fields and copies". Expect: To kept, Cc and Bcc added, the fields left out of the text. The "Re:" subject does not show in an inline reply; skip it, or check it after "Pop out reply".
5. New empty draft, folder "Smoke 6a". Expect: the row "T6 recipients" says "Adds To 1, Cc 2, Bcc 1". Row Insert. Expect: text "Hello", Subject "T6 subject", all 4 addresses in their boxes, the Bcc line open.
6. New draft. In To type `test-a@<your domain>`, in Cc `test-b@<your domain>`, each followed by Enter so it is a chip. Click into the text, row Insert on "T6 recipients". Expect: To holds only `test-a@`; Cc holds `test-b@`, `test-cc@`, `test-out@`; Bcc holds `test-bcc@`. No address lost. Record: anything on screen said that `test-to@` was not added (y/n). The owner judges whether a notice is needed.
7. New draft, Cc `test-cc@<your domain>` as a chip. Row Insert on "T6 recipients". Expect: one `test-cc@` chip, not two.
8. Open a received message, "Forward", row Insert on "T6 recipients". Expect: To gets `test-to@<your domain>`; the "Fwd:" subject is kept.
9. New draft, type `old` in Subject, click at the start of the text, row Insert on "T1 plain". Expect: the text changes, Subject stays `old`.
10. New draft, no To. Row Insert on "T7 first name". Expect: "Hello" and nothing after it.
11. New draft, To: the second account's address as a chip (the owner gives the address with this part; report the step as blocked without it). Row Insert on "T7 first name". Expect: "Hello" followed by that person's first name, when the directory has one.
12. New draft, row Insert on "T5 paragraphs". Expect: "Hi team," and "Thanks" with no "{{" between them. Record: the empty middle paragraph shows as a blank line (y/n). Yes is accepted for v1.

| Step | Record                                     | Result |
| ---- | ------------------------------------------ | ------ |
| 1    | card closed (y/n)                          |        |
| 3    | card closed (y/n)                          |        |
| 6    | notice that `test-to@` was not added (y/n) |        |
| 12   | empty paragraph as blank line (y/n)        |        |

## Part C: details card and edge cases

Gmail, owner, the add-on in a draft's toolbar; the web app in a second tab. About 30 minutes. Discard every draft after its step.

1. New empty draft, tap the name "T6 recipients". Expect: the card title "T6 recipients"; the switch "Replace the subject" on with "T6 subject" below it; section "Recipients" with the switch "Add recipients" on and "Adds 4 recipients."; the lines To `test-to@`, Cc `test-cc@`, Cc `test-out@example.com` with "outside <your domain>", Bcc `test-bcc@` with "hidden from other recipients"; "Finish typing addresses in the draft first: an address still being typed is lost."; the text "Hello"; buttons "Insert" and "Edit in library". Click "Insert": the draft gets the same as part B step 5.
2. New draft, To `test-a@<your domain>` as a chip. Tap the name "T6 recipients". Expect: "Not added: test-to@<your domain>. The draft already has a To recipient." and "Adds 3 recipients."
3. Open a received message, "Reply", tap the name "T6 recipients". Expect: "Replace the subject" is off.
4. New draft, tap the name "T2 fields". Expect: section "Fields" with "Fill in now, or leave blank and type in the draft." and the boxes "Load number" and "Driver name" (plus "Your phone" when the directory has no phone). Type `Sam` in "Driver name" only, "Insert". Expect: "Hi Sam, load is ready." followed by your phone when the directory has one, and Subject "Load".
5. New draft, tap the name "T2 fields". In "Driver name" type `1234567890` fifty times, then one more letter (501 characters). "Insert". Expect: "(!) Shorten to 500 characters: Driver name", the draft unchanged. Delete the last letter, "Insert": the text arrives.
6. New draft, type `old` in Subject, tap the name "T4 fields and copies". Expect: "Replace the subject" off. Turn "Add recipients" off, "Insert". Expect: text only; Subject `old`; To, Cc and Bcc empty.
7. New empty draft, tap the name "T6 recipients", turn "Replace the subject" and "Add recipients" off, "Insert". Expect: "Hello" only; Subject, To, Cc and Bcc stay empty.
8. New draft, To: the second account's address as a chip. Tap the name "T7 first name". Expect: the box "Recipient first name" with "Leave blank to use the To recipient's first name, when known." below it. Leave it blank, "Insert". Expect: "Hello" and that person's first name when the directory has one, else "Hello" alone.
9. New draft, open the folder "Smoke 6a" and leave the card open. Web app tab: open "T3 copies", add Cc `test-cc2@<your domain>`, "Save". Gmail, within 10 minutes, row Insert on "T3 copies". Expect: the details card with "(!) The recipients of this template changed. Check them and press Insert again.", the draft unchanged. "Insert": 2 Cc addresses added. Web app: remove `test-cc2@` from "T3 copies", "Save".
10. New draft, tap the name "T1 plain" and leave the card open. Web app: open "T1 plain", change `T1 text.` to `T1 text again.`, "Save". Gmail: "Insert". Expect: "(!) The template changed. Check the fields and press Insert again.", the draft unchanged. "Insert" again: "T1 text again." arrives. Web app: change the text back to `T1 text.`, "Save".
11. Web app: create `C scratch` in "Smoke 6a" with text `C`. Gmail: new draft, open the add-on, "Open library", close it, open the folder "Smoke 6a" (the list now holds "C scratch"). Web app: delete "C scratch". Gmail: row Insert on "C scratch". Expect: "This template was deleted or moved. Press Refresh to update the list." and "Refresh". "Refresh": the home card shows, without "C scratch".
12. Home card, type `zzqx` in "Search templates" and click outside the box. Expect: `No templates match "zzqx". Try fewer words, or remove folder: and tag: from the search.` Search `paragraphs`. Expect: "Results" with "T5 paragraphs". Clear the box: the home card returns.
13. Tap the name "T1 plain", "Edit in library". Record: what opened (an overlay over Gmail, a new tab, or nothing). Close it. Expect: the add-on shows the home card. If nothing opens for the browser agent, report "nothing opened" and go on: Chrome can block the window for an automated click, and the owner repeats this one click by hand (part H).

| Step | Record                        | Result |
| ---- | ----------------------------- | ------ |
| 13   | what "Edit in library" opened |        |

## Part D: admin settings

Web app, owner; Gmail for steps 9 and 12. About 30 minutes. This part turns personal templates on and off again, and outside recipients off and on again. Step 14 deletes what it creates, so the part can run again. Before step 1, write down the time on your clock: step 11 counts only audit rows after it.

1. Admin. Expect: 6 tabs "Folders and access", "Groups", "Audit log", "Usage", "Export and import", "Settings and backups". With a tab focused, Left, Right, Home and End move between them.
2. "Settings and backups". Expect: under "Settings", "Personal templates" on "Off" and "Outside recipients" on "Allowed", each with "Default, never changed." or "Last change: " with a name and a time. "Technical details" lists "Domain", "ADMIN_GROUP", "MEMBERSHIP_RESOLVER", "CALLER_IDENTITY", "INDEX_REV", "App version", "Library data size", and no "RECIPIENTS_EXTERNAL". "Background jobs" lists "Save insert counts and refused actions", "Refresh groups" and "Nightly backup and cleanup", each with a "Last good run" time and the status "OK".
3. Library, select "My templates". Expect: "Personal templates are turned off by your admin. You can still insert these templates."
4. Open the web app in a second tab on Admin, "Settings and backups"; leave it. First tab: "Personal templates", "On", "Save". Expect: no dialog; "Saved. Personal templates are on for every user from their next action." and "Last change: " with your name and the time.
5. Second tab (still shows Off): pick "On", "Save". Expect: a line with your name, "changed this setting on", the time, and "The page now shows the current value."; the setting shows On. Close the second tab.
6. First tab: "Off", "Save". Expect: the dialog "Turn off personal templates?" with "Cancel" focused. "Cancel": the dialog closes; "Off" may still look picked, but nothing was saved and "Last change" still shows the time of step 4. "Off", "Save", "Turn off". Expect: "Saved. Personal templates are off for every user from their next action."
7. "Outside recipients": "<your domain> only", "Save". Expect: the dialog "Allow only <your domain> recipients?". Click "Allow only <your domain>". Expect: "Saved. Only <your domain> recipients are allowed."
8. Library, open "T6 recipients", type a word in the text, "Save". Expect: "Not saved. Fix the problems in the Problems tab." and in "Problems": "Cc, address 2 is outside <your domain>. Your admin allows only <your domain> addresses. Remove it to save." Click "All templates", "Discard changes".
9. Gmail, new empty draft, open the add-on, "Open library", close it, open "Smoke 6a". Expect: the row "T6 recipients" says "Adds To 1, Cc 1, Bcc 1". Row Insert. Expect: 3 addresses, no `test-out@`. Record: anything on screen said that `test-out@` was left out (y/n). The owner judges whether a notice is needed. Discard the draft. New empty draft, tap the name "T6 recipients". Expect: "Not added: test-out@example.com. Outside <your domain>, turned off by your admin." and "Adds 3 recipients.". "Insert": 3 addresses, no `test-out@`. Discard the draft.
10. Admin, "Settings and backups", "Outside recipients": "Allowed", "Save". Expect: no dialog; "Saved. Outside recipients are allowed."
11. "Audit log", this month, "Action" "Setting changed", "Filter". Older rows from earlier runs may be listed; look only at rows with today's date and a time after the one you wrote down. Expect: exactly 4 such rows, each with your address in "User": personal templates on (step 4), personal templates off (step 6), outside recipients limited (step 7), outside recipients allowed (step 10). Step 5 wrote none. "Details" on one row. Expect: the drawer "Entry details" with "Before", "After", "Duration", "Request ID" and "App version". Esc closes it and the focus is back on "Details".
12. Wait 5 minutes after part B. "Usage". Expect: "T1 plain" with "Inserts, 30 days" 1 or more and a "Last inserted" time.
13. "Export and import", "One folder and its subfolders", "Folder" "Smoke 6a / R&D <b>", "Export". Expect: "Exporting...", then "Exported 1 templates to " and a file name that starts with "migway-templates-r-d-b-". Record: the file was downloaded (y/n).
14. Admin, "Folders and access", "New top-level folder", name `Import test`. Expect: "Created folder "Import test"." Reload the page and open Admin again (the "Import into" list is read once, when Admin opens; a known gap). "Export and import": "Export file" the file of step 13, "Import into" "Import test", "Check file". Expect: "Checked. Import would create 1 templates, 0 skipped, 0 failed." "Import". Expect: "Imported 1 templates, 0 skipped, 0 failed." The library shows "Import test / R&D <b>" with "T8 escaping". Clean up (only an empty folder can be deleted): in the library, the "T8 escaping" row of "Import test / R&D <b>", "Actions", "Delete...", "Delete"; then Admin, "Folders and access", select "R&D <b>" under "Import test", "Delete...", "Delete"; then the same for "Import test". Expect: "Deleted folder "Import test"." End state: no folder "Import test", the copy of T8 in the trash, so the next run can create the folder again. Blocked is fine when the agent cannot pick a file: then delete the empty folder "Import test" in "Folders and access" ("Delete...", "Delete"), report the step as blocked, and the owner does it by hand.
15. "Settings and backups", "Backups". Expect: at least one date, or "No backups yet. The app makes one each night and keeps the last 14." Do not press "Restore" (part H step 10).

| Step | Record                                     | Result |
| ---- | ------------------------------------------ | ------ |
| 9    | notice that `test-out@` was left out (y/n) |        |
| 13   | file downloaded (y/n)                      |        |

## Part E: look of the Gmail cards

Gmail, owner. Run it after part B and 5 minutes of waiting, so "Recent" has rows. About 20 minutes. Take one screenshot of each card in steps 1 to 6 and attach it to the report.

1. Add-on in a draft's toolbar. Click "Open library" and close what it opens: the add-on keeps its list for 10 minutes, and this fetches a fresh one. Home card. Expect: no card header; "Search templates" with no hint below it; "Favorites" with a star icon row "T1 plain"; "Recent" with clock icon rows and without "T1 plain"; "Folders" with folder icon rows and "n templates" below each.
2. Same card. Expect: each template row has one "Insert" button; "Open library" sits in a fixed bar at the bottom. Record: the color of "Insert" and of "Open library" (dark slate, blue, other).
3. Find "T4 fields and copies" under "Recent" (part B step 4 inserted it); if it is not there, search `copies` and use the row under "Results". Expect: its row reads "Adds Cc 1, Bcc 1 · 2 fields to fill · Smoke 6a". Record: the line fits on one line, wraps, or is cut.
4. Open the folder "Smoke 6a". Expect: the header "Smoke 6a"; the subfolder `R&D <b>` first with a folder icon; then template rows with a document icon and only their hints below the title (no folder path, nothing below "T1 plain"). Record: the folder name reads exactly `R&D <b>`, with no `&amp;` or `&lt;` (y/n).
5. Open `R&D <b>`, tap the name "T8 escaping". Expect: the header "T8 escaping" and the text `<b>A & B</b>` shown as typed, not bold.
6. Tap the name "T2 fields". Expect: the header "T2 fields"; a filled "Insert" and an outlined "Edit in library" at the bottom. Record: the color of "Edit in library".
7. Look at "Favorites", "Recent" and "Folders". Expect: a section with more than 5 rows shows 5 and a "Show more" control; a section with 5 or fewer shows all. Record: "Show more" seen, or not testable (no section over 5).
8. Close the draft. Open the add-on from Gmail's right side panel with no message open. Expect: the same home card without "Insert" buttons, ending with "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar." and then the section "Spike S7 (temporary)".
9. Side panel, tap the name "T6 recipients". Expect: the details card with a "Subject" line, the recipient lines, the text, "Edit in library", and the same toolbar line last; no boxes, no switches, no "Insert".
10. Open a received message with the side panel open. Expect: the same cards and the same last line.
11. Web app: create `E scratch` in "Smoke 6a". Side panel: "Open library", close it, open the folder "Smoke 6a". Web app: delete "E scratch". Side panel: tap the name "E scratch". Expect: "This template was deleted or moved. Press Refresh to update the list." with "Refresh" and no card header.

| Step | Record                               | Result |
| ---- | ------------------------------------ | ------ |
| 2    | color of "Insert" and "Open library" |        |
| 3    | label on one line, wrapped or cut    |        |
| 4    | `R&D <b>` reads exactly (y/n)        |        |
| 6    | color of "Edit in library"           |        |
| 7    | "Show more" seen, or not testable    |        |

## Part F: second account

For the second tester, with the owner on a call or in chat. About 20 minutes. At the start the second account has no access to "Smoke 6a" and is not an admin; step 9 brings it back to that state. The owner sends the web app link first. Send no email: when a step says "discard", click the trash icon in the draft window.

1. Open the web app link. Expect: the library opens. There is no folder "Smoke 6a" and no "Admin" in the left menu.
2. Add `?view=admin` to the end of the link and open it. Expect: "You don't have access to Admin. It is for admins and folder managers."
3. Gmail, "Compose", click into the text, click the Migway Templates icon in the bottom toolbar of the draft. Expect: no "Smoke 6a" and no "T1 plain". If you see no template at all, the card says "No templates shared with you yet. Ask your admin for access to a folder." If your own "My templates" holds templates from earlier tests, the card lists those instead; that is fine. Discard the draft.
4. Owner: Admin, "Folders and access", select "Smoke 6a", "Give access", "Type" "User", the second account's address, "Can use", "Give access". Expect: a row with that person and "Can use".
5. Second tester: reload the library. Expect: "Smoke 6a" with the T templates. Open "T6 recipients". Expect: no toolbar, no "Save", no "History", and the note that starts "You can use this template but not change it." The address chips have no × button.
6. Gmail, "Compose", click into the text, open the add-on. If the card is the same as in step 3, click "Open library", close it, and open the add-on again. Open "Smoke 6a", row Insert on "T1 plain". Expect: "T1 text." and Subject "T1 subject". Discard the draft.
7. "Compose", open the add-on, tap the name "T6 recipients". Expect: the card shows "Insert" and no "Edit in library". Discard the draft.
8. "Compose", To: the owner's address. Click into the text, row Insert on "T7 first name". Expect: "Hello" and the owner's first name (only "Hello" if the directory has no first name). Discard the draft.
9. "Compose", open the add-on, open "Smoke 6a" and leave the card open. Owner: Admin, "Smoke 6a", "Remove" on the second account's row. Second tester: row Insert on "T1 plain". Expect: "You don't have access to this template. Ask a folder manager." and the draft stays empty. Discard the draft.
10. Reload the library. Expect: "Smoke 6a" is gone. Open the address of "T6 recipients" from step 5 again (browser history). Expect: "You don't have access to this template. Ask a folder manager." with "Back to the library".

## Part G: spike S7 in the side panel

Spike S7 passed on 2026-11-11; its record is docs/spikes/slice-10-s7.md. Part J tests the side panel now.

## Part H: checks by hand

For the owner, not for the browser agent. Steps 1 and 2 need the Google Account security page; steps 3 to 7 and 11 need the Apps Script editor; steps 8 and 9 need the browser itself. About 45 minutes.

1. Fresh consent with recipients (Q55). Google Account, "Security", third party access, "Remove access" for Migway Templates. Gmail, new draft, open the add-on and accept the consent page. Row Insert on "T6 recipients". Expect: the text and the 4 addresses arrive with no second prompt. Record: any further consent prompt, the scopes it names, and any error text naming `https://mail.google.com/`. A prompt for a scope outside the approved 10 stops template recipients until the owner approves it. Discard the draft.
2. Fresh consent for the side panel. "Remove access" again. Side panel, inbox, no message open: open the add-on, row "New email" on "T1 plain". Expect: either no prompt, or a consent page; accept it. Record the same three things. Discard the draft.
3. Apps Script editor, "Executions": the duration of each `onCompose` run of part J steps 2 to 4. Expect: one run per press. Write each duration into the part J notes.
4. "Executions", the `template.apply` lines of parts B and C of this run. Expect: each carries `"draft":{"fields":[...],"to":n,"cc":n,"bcc":n,"hasSubject":...}`, where `fields` lists names of draft fields (for example `toRecipients`, `subject`) and never their values, plus `actor` and `targetId`. No line holds `test-`, `example.com`, a subject or a text.
5. "Executions", the `config.set` lines of part D of this run. Expect: `targetId` "" and no "on", "off", "allow" or "deny".
6. "Executions", the `import` and `export.folder` lines of part D of this run. Expect: `action`, `actor`, `targetId` (the folder ID), result, timing and calls; no title, subject, text or file content.
7. "Project Settings", "Script Properties": note whether `RECIPIENTS_EXTERNAL` exists. Expect: it is absent, or present and ignored (the app stopped reading it in slice 11). If it exists, delete it; if it was `deny`, set "<your domain> only" in Admin instead.
8. Back and Forward in the editor (browser console). Web app: library, "T2 fields", "History", then the browser Back button to the editor. Console: note `history.length`. Type a word, press browser Forward. Expect: "Leave without saving?" and the address stays on the editor. "Keep editing". Note `history.length` again: the same number. Press browser Back once: the question shows again. "Discard changes": the library opens, not "History".
9. Window and reload checks. Open "T2 fields", type a word, reload the page. Record: the browser asks before leaving (y/n). Then make the window about 390 pixels wide (or use the browser's device mode). Expect: no sideways scroll; the toolbar scrolls inside its row; the panel sits below the sheet with "Details", "The sender fills in" and "Preview" as headings that open and close.
10. Backup restore (optional, dev data only, after every other part). Admin, "Settings and backups", "Backups", "Restore" next to the newest date. Expect: a dialog that names the date with "Cancel" focused. Confirm. Expect: "Restored the backup of " and the date. This puts back the library of that night: the setup templates and everything made after the backup leave the library. "Audit log": a row for the restore with your name.
11. Admins in the log (part I). "Executions", the runs of part I steps 3 and 4 of this run. Expect: one warn line `directory.users.get` each, with `errorCode` like `ADMIN_NO_ACCOUNT:404` and no address. A line `ADMIN_CHECK:` with a status means the Directory answer was not read as "not found": record the status. The `admin.add` and `admin.remove` lines carry `targetId` "" and no address.
12. Web editor, any template you can edit: hold the mouse over "Bold" in the toolbar. Expect: the hover text "Bold (Ctrl+B)".
13. Gmail, a draft, open the add-on, click "Open library". Expect: the library opens in a new Chrome window. Tap the name "T1 plain", click "Edit in library". Expect: the editor opens with "T1 plain". Record: each opens (y/n). (Checked by the owner on dev-5065ba1: both open in a new Chrome window, which the browser agent cannot see.)

| Step | Record                            | Result |
| ---- | --------------------------------- | ------ |
| 1    | prompt, scopes, error text        |        |
| 2    | prompt, scopes, error text        |        |
| 9    | browser asks before leaving (y/n) |        |
| 11   | `errorCode` of each warn line     |        |

## Part I: in-app admins

Web app. The browser agent acts as the owner in every step not marked "Second tester"; the second tester does the two marked steps in their own browser. About 20 minutes. `<second account>` stands for the second tester's address: the owner gives it to the agent with this part, and it is never written into this plan. Part F must not run at the same time. Before step 1, write down the time on your clock: step 11 counts only audit rows after it. At the start `<second account>` is not in the Admins list; step 8 brings it back to that state.

1. Admin, "Settings and backups", under "Settings" the section "Admins". Expect: "Admins manage every shared folder, grants, settings, imports and backups. Add people by their <your domain> address."; "Set by the owner: " with your address and "These cannot be removed here."; "Members of " and the group when an admin group is set; "No admins added here yet." when nobody was added.
2. In "Email address" type `someone@example.com`, "Add admin". Expect: "Only <your domain> addresses can be admins." Nothing is added.
3. Type `nobody-test-123@<your domain>` (an address nobody has), "Add admin". Expect: "No <your domain> account has this address. A group goes in the admin group the owner sets."
4. Type a group address of your domain (the owner gives it), "Add admin". Expect: the same text as step 3.
5. Type `<second account>`, "Add admin". Expect: "Adding...", then `<second account>` followed by " is now an admin."; a row with that address, "Added by " with your name and the time, and a "Remove" button.
6. Type `<second account>` again, "Add admin". Expect: `<second account>` followed by " is already an admin." and still one row for that address.
7. Second tester: reload the web app. Expect: "Admin" in the left menu. Open it, "Settings and backups". Expect: the "Admins" section lists your own address with no "Remove" button. Leave this page open and change nothing yet.
8. "Remove" on the `<second account>` row. Expect: the dialog "Remove <second account> as admin?" with "They lose admin access at their next action. Their templates and folders stay." and "Cancel" focused. "Cancel": the row stays. "Remove" again, "Remove admin". Expect: "Removing...", then `<second account>` followed by " is no longer an admin."; the row is gone.
9. Second tester, in the page still open from step 7: under "Personal templates" pick the other choice and press "Save". Expect: "You are no longer an admin, so nothing was changed. Ask an admin if you need access." Reload: no "Admin" in the left menu.
10. "Settings and backups". Expect: "Personal templates" still shows the value from before step 9.
11. "Audit log", this month, "Action" "Admin added", "Filter". Older rows from earlier runs may be listed; look only at rows with today's date and a time after the one you wrote down. Expect: exactly 1 such row, with your address in "User" (step 5). "Action" "Admin removed", "Filter". Expect: exactly 1 such row, with your address in "User" (step 8). The refused tries of steps 2 to 4 wrote none. Step 9 adds a "Setting changed" row with the result "Denied" for the second account (within 5 minutes); it shows only under that action.

## Part J: side panel

Gmail web, dev build of slice 18, browser agent, about 25 minutes. Run it in Gmail's right side panel: click the Migway Templates icon in the panel on the right edge of Gmail, not in a draft's toolbar, except step 12. Needs the templates of "Templates to create once" and one automated notification message in the inbox (from a no-reply sender); open no other message. Discard every draft when its step ends; at the end, Drafts holds no draft of this part. In this part, "row New email" and "row Reply" mean the button on a template row.

1. Inbox, no message open, open the add-on in the side panel. Expect: each template row has a "New email" button; the last line of the card reads "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar."; no "Spike S7" section. Record: row labels on one line, wrapped or cut.
2. Row "New email" on "T1 plain". Expect: a new email window with Subject "T1 subject", text "T1 text.", To empty. Record: the window opened (y/n); a Gmail signature is in it (y/n, expected n).
3. Row "New email" on "T6 recipients". Expect: To `test-to@<your domain>`; Cc `test-cc@<your domain>` and `test-out@example.com`; Bcc `test-bcc@<your domain>`; Subject "T6 subject"; text "Hello".
4. Row "New email" on "T2 fields". Expect: Subject "Load"; text "Hi, load is ready." followed by your phone when the directory has one; no "{{".
5. Click the name "T2 fields". Expect: a card with boxes "Load number" and "Driver name", the line 'Gmail adds your signature to replies only. In a new email, use "Insert signature" in its toolbar.', and a "New email" button at the bottom. Type `77` in "Load number" and `Ann` in "Driver name", click "New email". Expect: Subject "Load 77", text "Hi Ann, load 77 is ready.". Record: the typed values arrived (y/n).
6. Back to the list. Click the name "T3 copies", turn off "Add recipients", click "New email". Expect: no Cc and no Bcc. Record: the switch was followed (y/n).
7. Open the one automated notification message. Expect: the card reloads and rows show "Reply". Row "Reply" on "T3 copies". Expect: a reply in the conversation, To the sender, Subject "Re: ...", Cc `test-cc@<your domain>`, Bcc `test-bcc@<your domain>`, text "T3 text.". Record: the signature is there and above or below the text; click the "..." (show trimmed content) in the reply: the earlier message is quoted (y/n).
8. Same message. Row "Reply" on "T6 recipients". Expect: To is only the sender; `test-to@<your domain>` is not added; Cc both test addresses; Bcc `test-bcc@<your domain>`; Subject "Re: ...".
9. Same message. Click the name "T6 recipients". Expect: "Add recipients" with "A reply adds 3 recipients." below it; the line "A reply goes to the sender, so the template's To is not added. New email adds it."; "Reply" and "Reply all" at the bottom; a "New email" button above them. Click "Reply all". Expect: the reply keeps every Cc the message had and adds the 2 template Cc; Bcc `test-bcc@<your domain>`.
10. Same message. Double-click the row "Reply" on "T1 plain". Expect: 1 or 2 reply drafts in the conversation, no error. Record: how many reply drafts opened (1 or 2). Discard all.
11. Library in a new tab: "New template" in "Smoke 6a", title "T9 temp", text `T9`, Save. In Gmail, close the message. In the panel click "Open library", close the library window, then open the folder "Smoke 6a" in the panel. Expect: "T9 temp" is listed. In the library tab delete "T9 temp". Panel: row "New email" on "T9 temp". Expect: no new email. Record: what Gmail shows (the sentence "This template was deleted or moved. Open the panel again to update the list.", a red error bar with the sentence, or nothing). T9 stays in the trash.
12. Regression, compose toolbar: Compose, click into the text, open Migway Templates from the draft's toolbar, row "Insert" on "T1 plain". Expect: text and subject inserted as in part B.
13. Discard the draft of step 12. Open the automated notification message again, side panel. Expect: each template row shows "Reply" and "Reply all" under its title. Click "Reply all" on the row "T3 copies". Expect: a reply in the conversation that keeps the message's To and Cc, adds Cc `test-cc@<your domain>` and Bcc `test-bcc@<your domain>`, text "T3 text.". Record: the two buttons sit under the title on one line (y/n), the row is readable (y/n).

Decisions taken by this part: step 5 or 6 "n" makes the details card drop its boxes and switch (Q68); no window or an error at step 2 or 5 moves that button into a button row (Q74); an error naming a scope at step 7 or 9 goes to the owner; 2 drafts at step 10 is accepted (Q69). The owner's checks by hand for this part (fresh consent, callback times, log lines) are in docs/ops/smoke.md, section "Slice 18".

| Step | Record                                                        | Result |
| ---- | ------------------------------------------------------------- | ------ |
| 1    | row labels: one line, wrapped or cut                          |        |
| 2    | window opened (y/n); signature in it (y/n)                    |        |
| 5    | typed values arrived (y/n)                                    |        |
| 6    | switch followed (y/n)                                         |        |
| 7    | signature there, above or below; quoted (y/n)                 |        |
| 10   | reply drafts opened (1 or 2)                                  |        |
| 11   | what Gmail shows: sentence, error bar, nothing                |        |
| 13   | buttons on one line under the title (y/n); row readable (y/n) |        |
| 1-13 | pass, fail or blocked per step, with what shows               |        |

## Part K: spinner and colors

Gmail web, dev build of slice 21, browser agent, about 10 minutes. Needs "T1 plain" and "T2 fields" of "Templates to create once". Discard every draft when its step ends. Spinner: Gmail's round progress mark on the card while an action runs.

1. New draft, cursor in the text, open Migway Templates from the draft's toolbar. Open the folder "Smoke 6a", then row "Insert" on "T1 plain". Expect: the text is inserted. Record: a spinner showed after each click (y/n).
2. Same popup, before you discard: Record the color of the bar at the top of the add-on (dark slate blue-grey or grey) and of the filled buttons ("Insert", "Open library"): dark slate blue-grey (y/n).
3. Inbox, no message open, open the add-on in the side panel. Row "New email" on "T1 plain". Expect: a new email window. Record: a spinner showed after the click (y/n); the top bar color (slate or grey).
4. New draft, open the add-on from its toolbar, click the name "T2 fields". Type 501 characters in "Driver name", click "Insert". Expect: "(!) Shorten to 500 characters: Driver name" above the boxes, in red, the draft unchanged. Record: the red line is readable (y/n).
5. Gmail, Settings (gear), "Themes", choose "Dark", save. Repeat step 4. Record: the red line is readable (y/n); the filled "Insert" is readable (y/n). Then choose the theme that was set before, save.

| Step | Record                                         | Result |
| ---- | ---------------------------------------------- | ------ |
| 1    | spinner in the popup (y/n)                     |        |
| 2    | top bar color; filled buttons slate (y/n)      |        |
| 3    | spinner in the side panel (y/n); top bar color |        |
| 4    | red line readable, light theme (y/n)           |        |
| 5    | red line and Insert readable, dark theme (y/n) |        |
