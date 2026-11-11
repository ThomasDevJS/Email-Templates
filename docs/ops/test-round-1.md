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

## Before you start

### The build

Open the web app link (the owner gives it). At the bottom of the left menu, under your name, the line reads "Version dev-" followed by 7 letters and digits, for example "Version dev-9773b75". The same value shows in Admin, "Settings and backups", "Technical details", row "App version". Write it at the top of the report. The Gmail cards show no version.

### The accounts

- Owner: an admin of the app, in one Chrome profile.
- Second account: an account of the same domain that is not an admin, in another Chrome profile. It already has the add-on from the earlier 6a run.

In this plan, `<your domain>` is the part after the @ in the owner's address. Test addresses such as `test-cc@<your domain>` belong to nobody; nothing is sent, so no mail goes out.

### The state of dev

- Personal templates are off. The owner turns them on in Admin, "Settings and backups" only where a step says so, and off again in the same part.
- Outside recipients are allowed.
- The shared folder "Smoke 6a" exists. The second account has no access to it at the start.

### How to open the add-on in Gmail

Gmail, "Compose". Click into the text of the draft first. Then click the Migway Templates icon in the bottom toolbar of the draft window. The card opens over the draft. In this plan, "row Insert" means the "Insert" button on a template row, and "tap the name" means a click on the template title, which opens the details card.

### Templates to create once

The owner creates these once in the web editor before part A. In the library: "New template", "Create the template in" "Smoke 6a", "Create". Type the title in "Title" and the subject in "Subject". For To, Cc and Bcc (panel "Details" on the right) type one address and press Enter, so it becomes a chip. Press "Save". Expect: "Saved as version 1, " followed by the time.

To put a field in the text: "Insert field", "Ask the sender...", type the name in "Field name the sender sees", OK. To put the sender phone or the recipient first name: "Insert field", then "Sender phone" or "Recipient first name". In "Subject" the field can be typed as shown.

| Title                | Subject                    | Text                                                                                    | To                      | Cc                                                 | Bcc                      |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------- | ------------------------ |
| T1 plain             | `T1 subject`               | `T1 text.`                                                                              |                         |                                                    |                          |
| T2 fields            | `Load {{ask:Load number}}` | `Hi ` field "Driver name" `, load ` field "Load number" `is ready.` then "Sender phone" |                         |                                                    |                          |
| T3 copies            |                            | `T3 text.`                                                                              |                         | `test-cc@<your domain>`                            | `test-bcc@<your domain>` |
| T4 fields and copies | as T2                      | as T2                                                                                   |                         | `test-cc@<your domain>`                            | `test-bcc@<your domain>` |
| T5 paragraphs        |                            | 3 paragraphs: `Hi team,` then field "PS" alone, then `Thanks`                           |                         |                                                    |                          |
| T6 recipients        | `T6 subject`               | `Hello`                                                                                 | `test-to@<your domain>` | `test-cc@<your domain>` and `test-out@example.com` | `test-bcc@<your domain>` |
| T7 first name        |                            | `Hello ` then "Recipient first name" (no default text; the warning on save is expected) |                         |                                                    |                          |
| T8 escaping          |                            | `<b>A & B</b>` typed as plain text                                                      |                         |                                                    |                          |

T8 goes into a subfolder: Admin, "Folders and access", select "Smoke 6a", "New subfolder", name `R&D <b>`. Then create T8 in that subfolder.

Last: in the library, click the star of "T1 plain" so it is a favorite.

## Part A: web editor

Web app, owner. About 25 minutes.

1. Library, click "T2 fields". Expect: the header shows "Smoke 6a", the title, "Saved as version" with a time, "History" and "Save". The right panel shows "Details", "The sender fills in" (each field with "used once" or "used n times") and the tabs "Preview as me" and "Problems 0".
2. Library, "New template", "Create the template in" "Smoke 6a", "Create". Title `A scratch`, text `one`, "Save". Expect: "Saved as version 1, " and the time.
3. Press Tab until a toolbar button has focus, then the arrow keys. Expect: focus moves along the buttons; Home and End jump to the ends; hovering "Bold" shows "Bold (Ctrl+B)".
4. Select a word, "Font", "Georgia". Expect: the word turns Georgia; "Font" again shows a check on "Georgia". Record: each font name shows in its own face (y/n).
5. Type `{{`. Expect: the "Insert field" menu opens. Pick "Sender name": a blank chip appears. Press Backspace: the chip goes away whole.
6. Type a word. Expect: "Unsaved changes". Click "All templates". Expect: "Leave without saving?" with "Keep editing" focused. Click "Keep editing": the editor stays. Click "All templates" again, then "Save and leave". Expect: the library opens.
7. Open "A scratch". In To type `test-to@<your domain>` and press Enter. In Cc paste `test-a@<your domain>, test-out@example.com`. Expect: three chips; the outside one says "outside <your domain>".
8. In Bcc type `not-an-address` and press Enter. Expect: "Bcc, address 1 is not an email address. Use the form name@company.com." Remove it with its × button, then "Save". Expect: "Preview as me" shows the To and Cc lines above the subject. Reload the page and open "A scratch": the chips are back.
9. "Insert field", "Ask the sender...", type `Product` in "Field name the sender sees", OK, "Save". Expect: "The sender fills in" lists "Product" with "used once".
10. Click "Image". In "Image address (https)" paste the wide image address the owner gives (wider than 600 pixels), confirm. Repeat with the narrow image address. "Save". Open "History" and pick the newest version. Record: the wide image shows 600 pixels wide and the narrow one at its own width (y/n).
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
4. Open a received message, "Reply", click into the text, row Insert on "T4 fields and copies". Expect: To and the "Re:" subject kept, Cc and Bcc added, the fields left out of the text.
5. New empty draft, folder "Smoke 6a". Expect: the row "T6 recipients" says "Adds To 1, Cc 2, Bcc 1". Row Insert. Expect: text "Hello", Subject "T6 subject", all 4 addresses in their boxes, the Bcc line open.
6. New draft. In To type `test-a@<your domain>`, in Cc `test-b@<your domain>`, each followed by Enter so it is a chip. Click into the text, row Insert on "T6 recipients". Expect: To holds only `test-a@`; Cc holds `test-b@`, `test-cc@`, `test-out@`; Bcc holds `test-bcc@`. No address lost. Record: anything on screen said that `test-to@` was not added (y/n). The owner judges whether a notice is needed.
7. New draft, Cc `test-cc@<your domain>` as a chip. Row Insert on "T6 recipients". Expect: one `test-cc@` chip, not two.
8. Open a received message, "Forward", row Insert on "T6 recipients". Expect: To gets `test-to@<your domain>`; the "Fwd:" subject is kept.
9. New draft, type `old` in Subject, row Insert on "T1 plain". Expect: the text changes, Subject stays `old`.
10. New draft, no To. Row Insert on "T7 first name". Expect: "Hello" and nothing after it.
11. New draft, To: the second account's address as a chip. Row Insert on "T7 first name". Expect: "Hello" followed by that person's first name, when the directory has one.
12. New draft, row Insert on "T5 paragraphs". Record: the empty middle paragraph shows as a blank line (y/n). Yes is accepted for v1.

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
4. New draft, tap the name "T2 fields". Expect: section "Fields" with "Fill in now, or leave blank and type in the draft." and the boxes "Load number" and "Driver name" (plus "Your phone" when the directory has no phone). Type `Sam` in "Driver name" only, "Insert". Expect: "Hi Sam, load is ready." and Subject "Load".
5. New draft, tap the name "T2 fields". In "Driver name" type `1234567890` fifty times, then one more letter (501 characters). "Insert". Expect: "(!) Shorten to 500 characters: Driver name", the draft unchanged. Delete the last letter, "Insert": the text arrives.
6. New draft, type `old` in Subject, tap the name "T4 fields and copies". Expect: "Replace the subject" off. Turn "Add recipients" off, "Insert". Expect: text only; Subject `old`; To, Cc and Bcc empty.
7. New empty draft, tap the name "T6 recipients", turn "Replace the subject" and "Add recipients" off, "Insert". Expect: "Hello" only; Subject, To, Cc and Bcc stay empty.
8. New draft, To: the second account's address as a chip. Tap the name "T7 first name". Expect: the box "Recipient first name" with "Leave blank to use the To recipient's first name, when known." below it. Leave it blank, "Insert". Expect: "Hello" and that person's first name.
9. New draft, open the folder "Smoke 6a" and leave the card open. Web app tab: open "T3 copies", add Cc `test-cc2@<your domain>`, "Save". Gmail, within 10 minutes, row Insert on "T3 copies". Expect: the details card with "(!) The recipients of this template changed. Check them and press Insert again.", the draft unchanged. "Insert": 2 Cc addresses added. Web app: remove `test-cc2@` from "T3 copies", "Save".
10. New draft, tap the name "T1 plain" and leave the card open. Web app: open "T1 plain", change `T1 text.` to `T1 text again.`, "Save". Gmail: "Insert". Expect: "(!) The template changed. Check the fields and press Insert again.", the draft unchanged. "Insert" again: "T1 text again." arrives. Web app: change the text back to `T1 text.`, "Save".
11. Web app: create `C scratch` in "Smoke 6a" with text `C`. Gmail: new draft, open the add-on, "Open library", close it, open the folder "Smoke 6a" (the list now holds "C scratch"). Web app: delete "C scratch". Gmail: row Insert on "C scratch". Expect: "This template was deleted or moved. Press Refresh to update the list." and "Refresh". "Refresh": the home card shows, without "C scratch".
12. Home card, type `zzqx` in "Search templates" and click outside the box. Expect: `No templates match "zzqx". Try fewer words, or remove folder: and tag: from the search.` Search `paragraphs`. Expect: "Results" with "T5 paragraphs". Clear the box: the home card returns.
13. Tap the name "T1 plain", "Edit in library". Record: what opened (an overlay over Gmail, a new tab, or nothing). Close it. Expect: the add-on shows the home card.

| Step | Record                        | Result |
| ---- | ----------------------------- | ------ |
| 13   | what "Edit in library" opened |        |

## Part D: admin settings

Web app, owner; Gmail for steps 9 and 12. About 30 minutes. This part turns personal templates on and off again, and outside recipients off and on again.

1. Admin. Expect: 6 tabs "Folders and access", "Groups", "Audit log", "Usage", "Export and import", "Settings and backups". With a tab focused, Left, Right, Home and End move between them.
2. "Settings and backups". Expect: under "Settings", "Personal templates" on "Off" and "Outside recipients" on "Allowed", each with "Default, never changed." or "Last change: " with a name and a time. "Technical details" lists "Domain", "ADMIN_GROUP", "MEMBERSHIP_RESOLVER", "CALLER_IDENTITY", "INDEX_REV", "App version", "Library data size", and no "RECIPIENTS_EXTERNAL". "Background jobs" lists "Save insert counts and refused actions", "Refresh groups" and "Nightly backup and cleanup", each with a "Last good run" time and the status "OK".
3. Library, select "My templates". Expect: "Personal templates are turned off by your admin. You can still insert these templates."
4. Open the web app in a second tab on Admin, "Settings and backups"; leave it. First tab: "Personal templates", "On", "Save". Expect: no dialog; "Saved. Personal templates are on for every user from their next action." and "Last change: " with your name and the time.
5. Second tab (still shows Off): pick "On", "Save". Expect: a line with your name, "changed this setting on", the time, and "The page now shows the current value."; the setting shows On. Close the second tab.
6. First tab: "Off", "Save". Expect: the dialog "Turn off personal templates?" with "Cancel" focused. "Cancel": the setting stays On. "Off", "Save", "Turn off". Expect: "Saved. Personal templates are off for every user from their next action."
7. "Outside recipients": "<your domain> only", "Save". Expect: the dialog "Allow only <your domain> recipients?". Click "Allow only <your domain>". Expect: "Saved. Only <your domain> recipients are allowed."
8. Library, open "T6 recipients", type a word in the text, "Save". Expect: "Not saved. Fix the problems in the Problems tab." and in "Problems": "Cc, address 2 is outside <your domain>. Your admin allows only <your domain> addresses. Remove it to save." Click "All templates", "Discard changes".
9. Gmail, new empty draft, open the add-on, "Open library", close it, open "Smoke 6a". Expect: the row "T6 recipients" says "Adds To 1, Cc 1, Bcc 1". Row Insert. Expect: 3 addresses, no `test-out@`. Record: anything on screen said that `test-out@` was left out (y/n). The owner judges whether a notice is needed. Discard the draft. New empty draft, tap the name "T6 recipients". Expect: "Not added: test-out@example.com. Outside <your domain>, turned off by your admin." and "Adds 3 recipients.". "Insert": 3 addresses, no `test-out@`. Discard the draft.
10. Admin, "Settings and backups", "Outside recipients": "Allowed", "Save". Expect: no dialog; "Saved. Outside recipients are allowed."
11. "Audit log", this month, "Action" "Setting changed", "Filter". Expect: 4 rows (steps 4, 6, 7, 10) with your name; step 5 wrote none. "Details" on one row. Expect: the drawer "Entry details" with "Before", "After", "Duration", "Request ID" and "App version". Esc closes it and the focus is back on "Details".
12. Wait 5 minutes after part B. "Usage". Expect: "T1 plain" with "Inserts, 30 days" 1 or more and a "Last inserted" time.
13. "Export and import", "One folder and its subfolders", "Folder" "Smoke 6a", "Export". Expect: "Exporting...", then "Exported " with the count and a file name that starts with "migway-templates-smoke-6a-". Record: the file was downloaded (y/n).
14. Admin, "Folders and access", "New top-level folder", name `Import test`. "Export and import": "Export file" the file of step 13, "Import into" "Import test", "Check file". Expect: "Checked. Import would create " with the count and "0 skipped, 0 failed". "Import". Expect: "Imported " with the same count and "0 skipped, 0 failed". The library shows "Import test" with "Smoke 6a" inside. Blocked is fine when the agent cannot pick a file; the owner then does this step by hand.
15. "Settings and backups", "Backups". Expect: at least one date, or "No backups yet. The app makes one each night and keeps the last 14." Do not press "Restore" (part H step 10).

| Step | Record                                     | Result |
| ---- | ------------------------------------------ | ------ |
| 9    | notice that `test-out@` was left out (y/n) |        |
| 13   | file downloaded (y/n)                      |        |

## Part E: look of the Gmail cards

Gmail, owner. Run it after part B and 5 minutes of waiting, so "Recent" has rows. About 20 minutes. Take one screenshot of each card in steps 1 to 6 and attach it to the report.

1. Add-on in a draft's toolbar, home card. Expect: no card header; "Search templates" with no hint below it; "Favorites" with a star icon row "T1 plain"; "Recent" with clock icon rows and without "T1 plain"; "Folders" with folder icon rows and "n templates" below each.
2. Same card. Expect: each template row has one "Insert" button; "Open library" sits in a fixed bar at the bottom. Record: the color of "Insert" and of "Open library" (dark slate, blue, other).
3. If "T4 fields and copies" is under "Recent", its row reads "Adds Cc 1, Bcc 1 · 2 fields to fill · Smoke 6a". Record: the line fits on one line, wraps, or is cut.
4. Open the folder "Smoke 6a". Expect: the header "Smoke 6a"; the subfolder `R&D <b>` first with a folder icon; then template rows with a document icon and only their hints below the title (no folder path, nothing below "T1 plain"). Record: the folder name reads exactly `R&D <b>`, with no `&amp;` or `&lt;` (y/n).
5. Open `R&D <b>`, tap the name "T8 escaping". Expect: the header "T8 escaping" and the text `<b>A & B</b>` shown as typed, not bold.
6. Tap the name "T2 fields". Expect: the header "T2 fields"; a filled "Insert" and an outlined "Edit in library" at the bottom. Record: the color of "Edit in library".
7. If a section has more than 5 rows: it shows 5 and a "Show more" control. Record: seen, or not testable.
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

For the second tester, with the owner on a call or in chat. About 20 minutes. The owner sends the web app link first. Send no email: when a step says "discard", click the trash icon in the draft window.

1. Open the web app link. Expect: the library opens. There is no folder "Smoke 6a" and no "Admin" in the left menu.
2. Add `?view=admin` to the end of the link and open it. Expect: "You don't have access to Admin. It is for admins and folder managers."
3. Gmail, "Compose", click into the text, click the Migway Templates icon in the bottom toolbar of the draft. Expect: no "Smoke 6a" and no "T1 plain". With nothing shared yet the card says "No templates shared with you yet. Ask your admin for access to a folder." Discard the draft.
4. Owner: Admin, "Folders and access", select "Smoke 6a", "Give access", "Type" "User", the second account's address, "Can use", "Give access". Expect: a row with that person and "Can use".
5. Second tester: reload the library. Expect: "Smoke 6a" with the T templates. Open "T6 recipients". Expect: no toolbar, no "Save", no "History", and the note that starts "You can use this template but not change it." The address chips have no × button.
6. Gmail, "Compose", click into the text, open the add-on. If the card is the same as in step 3, click "Open library", close it, and open the add-on again. Open "Smoke 6a", row Insert on "T1 plain". Expect: "T1 text." and Subject "T1 subject". Discard the draft.
7. "Compose", open the add-on, tap the name "T6 recipients". Expect: the card shows "Insert" and no "Edit in library". Discard the draft.
8. "Compose", To: the owner's address. Click into the text, row Insert on "T7 first name". Expect: "Hello" and the owner's first name. Discard the draft.
9. "Compose", open the add-on, open "Smoke 6a" and leave the card open. Owner: Admin, "Smoke 6a", "Remove" on the second account's row. Second tester: row Insert on "T1 plain". Expect: "You don't have access to this template. Ask a folder manager." and the draft stays empty. Discard the draft.
10. Reload the library. Expect: "Smoke 6a" is gone. Open the address of "T6 recipients" from step 5 again (browser history). Expect: "You don't have access to this template. Ask a folder manager." with "Back to the library".

## Part G: spike S7 in the side panel

This is the one part that tests an unfinished feature: the side panel cannot insert yet, and these steps decide how it will. Run it in the side panel only, never from a draft's toolbar. About 30 minutes. Needs: a default signature in Gmail settings (step 4) and one received message with several people in To and Cc (step 3). Discard every draft after its step.

The section "Spike S7 (temporary)" sits at the end of the side panel home card. "Open S7 harness" opens a card with the event shape, whether a message ID and an access token are present, and 4 buttons. "New email", "Reply" and "Reply all" each open a draft in a compose window: subject "S7 test" (New email only), a text with bold words, a 2 item list, a link to google.com and one image, To `s7-to@migway.com` (New email only), Cc `s7-cc@migway.com`, Bcc `s7-bcc@migway.com`. "Reply" and "Reply all" are greyed out until a message is open. "Notify" should show a notification and open no draft. A failure shows as a notification starting "S7" or a card "Spike S7 failed"; copy its text into Notes. The fresh consent check (old step 1) is part H step 2; the callback times are part H step 3.

1. Inbox, no message open. "Open S7 harness", "New email". Record: a compose window opens (y/n); bold, list, link and image kept; Subject "S7 test"; To, Cc and Bcc set.
2. Open a received message with the side panel open. Record: the add-on card reloads for the message, and the harness card says "message ID present: yes". Tap "Reply". Record: the reply opens in the conversation; To is the sender; Subject "Re: ..."; Cc and Bcc added; the quoted earlier message is there (y/n).
3. Open the message with several people in To and Cc. "Reply all". Record: the original Cc kept and `s7-cc@` added (add), or the original Cc gone (replace).
4. No button. Look at the drafts of steps 1 and 2. Record: the Gmail signature is there (y/n).
5. Inbox. "Notify". Record: a notification shows and no draft opens (y/n), or the error text.
6. Open a new compose window and type a line. Then, in the side panel, "New email", then "Reply" (message open). Record: a second window opens (y/n); the typed line in the first window is unchanged (y/n).
7. Close the new compose window without sending. Record: the draft is left in Drafts (y/n).

| Step | Setup                       | Action           | Result | Callback ms | Notes |
| ---- | --------------------------- | ---------------- | ------ | ----------- | ----- |
| 1    | Inbox, no message           | New email        |        |             |       |
| 2    | Message open                | Reply            |        |             |       |
| 3    | Message with several To, Cc | Reply all        |        |             |       |
| 4    | Drafts of steps 1 and 2     | none             |        |             |       |
| 5    | Inbox                       | Notify           |        |             |       |
| 6    | Compose window with text    | New email, Reply |        |             |       |
| 7    | Close the new window        | none             |        |             |       |

## Part H: checks by hand

For the owner, not for the browser agent. Steps 1 and 2 need the Google Account security page; steps 3 to 7 and 11 need the Apps Script editor; steps 8 and 9 need the browser itself. About 45 minutes.

1. Fresh consent with recipients (Q55). Google Account, "Security", third party access, "Remove access" for Migway Templates. Gmail, new draft, open the add-on and accept the consent page. Row Insert on "T6 recipients". Record: any further consent prompt, the scopes it names, and any error text naming `https://mail.google.com/`. A prompt for a scope outside the approved 10 stops template recipients until the owner approves it. Discard the draft.
2. Fresh consent for spike S7. "Remove access" again. Side panel, inbox, no message open: open the add-on, "Open S7 harness", "New email". Record the same three things.
3. Apps Script editor, "Executions": the duration of each `onS7Compose` run of part G. Write it into the "Callback ms" column of the part G table.
4. "Executions", the `template.apply` lines of parts B and C. Expect: each carries `draft` with counts and `hasSubject` only, plus `actor` and `targetId`. No line holds `test-`, `example.com`, a subject or a text.
5. "Executions", the `config.set` lines of part D. Expect: `targetId` "" and no "on", "off", "allow" or "deny".
6. "Executions", the `import` and `export.folder` lines of part D. Expect: `action`, `actor`, `targetId` (the folder ID), result, timing and calls; no title, subject, text or file content.
7. "Project Settings", "Script Properties": note whether `RECIPIENTS_EXTERNAL` exists. The app ignores it since slice 11. If it exists, delete it; if it was `deny`, set "<your domain> only" in Admin instead.
8. Back and Forward in the editor (browser console). Web app: library, "T2 fields", "History", then the browser Back button to the editor. Console: note `history.length`. Type a word, press browser Forward. Expect: "Leave without saving?" and the address stays on the editor. "Keep editing". Note `history.length` again: the same number. Press browser Back once: the question shows again. "Discard changes": the library opens, not "History".
9. Window and reload checks. Open "T2 fields", type a word, reload the page. Record: the browser asks before leaving (y/n). Then make the window about 390 pixels wide (or use the browser's device mode). Expect: no sideways scroll; the toolbar scrolls inside its row; the panel sits below the sheet with "Details", "The sender fills in" and "Preview" as headings that open and close.
10. Backup restore (optional, dev data only, after every other part). Admin, "Settings and backups", "Backups", "Restore" next to the newest date. Expect: a dialog that names the date with "Cancel" focused. Confirm. Expect: "Restored the backup of " and the date. This puts back the library of that night: the setup templates and everything made after the backup leave the library. "Audit log": a row for the restore with your name.
11. Admins in the log (part I). "Executions", the runs of part I steps 3 and 4. Expect: one warn line `directory.users.get` each, with `errorCode` like `ADMIN_NO_ACCOUNT:404` and no address. A line `ADMIN_CHECK:` with a status means the Directory answer was not read as "not found": record the status. The `admin.add` and `admin.remove` lines carry `targetId` "" and no address.

| Step | Record                            | Result |
| ---- | --------------------------------- | ------ |
| 1    | prompt, scopes, error text        |        |
| 2    | prompt, scopes, error text        |        |
| 9    | browser asks before leaving (y/n) |        |
| 11   | `errorCode` of each warn line     |        |

## Part I: in-app admins

Web app, owner as the browser agent; two steps for the second tester, marked "Second tester". About 20 minutes. `<second account>` stands for the second tester's address; the owner types it, it is never written into this plan. Part F must not be running at the same time.

1. Admin, "Settings and backups", under "Settings" the section "Admins". Expect: "Admins manage every shared folder, grants, settings, imports and backups. Add people by their <your domain> address."; "Set by the owner: " with your address and "These cannot be removed here."; "Members of " and the group when an admin group is set; "No admins added here yet." when nobody was added.
2. In "Email address" type `someone@example.com`, "Add admin". Expect: "Only <your domain> addresses can be admins." Nothing is added.
3. Type `nobody-test-123@<your domain>` (an address nobody has), "Add admin". Expect: "No <your domain> account has this address. A group goes in the admin group the owner sets."
4. Type a group address of your domain (the owner gives it), "Add admin". Expect: the same text as step 3.
5. Type `<second account>`, "Add admin". Expect: "Adding...", then `<second account>` followed by " is now an admin."; a row with that address, "Added by " with your name and the time, and a "Remove" button.
6. Type `<second account>` again, "Add admin". Expect: `<second account>` followed by " is already an admin." and still one row.
7. Second tester: reload the web app. Expect: "Admin" in the left menu. Open it, "Settings and backups". Expect: the "Admins" section lists your own address with no "Remove" button. Leave this page open and change nothing yet.
8. Owner: "Remove" on the `<second account>` row. Expect: the dialog "Remove <second account> as admin?" with "They lose admin access at their next action. Their templates and folders stay." and "Cancel" focused. "Cancel": the row stays. "Remove" again, "Remove admin". Expect: "Removing...", then `<second account>` followed by " is no longer an admin."; the row is gone.
9. Second tester, in the page still open from step 7: under "Personal templates" pick the other choice and press "Save". Expect: "You are no longer an admin, so nothing was changed. Ask an admin if you need access." Reload: no "Admin" in the left menu.
10. Owner: "Settings and backups". Expect: "Personal templates" still shows the value from before step 9.
11. "Audit log", this month, "Action" "Admin added", "Filter". Expect: one row with your name for step 5. "Action" "Admin removed", "Filter". Expect: one row with your name for step 8. No rows for the refused tries of steps 2 to 4.
