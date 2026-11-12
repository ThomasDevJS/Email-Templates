# Migway Templates: editor guide

For managers and editors who write templates. The [quick start](user-quick-start.md) covers inserting templates in Gmail.

You edit templates in folders where you hold the level `edit` or `manage`. Every person can edit their own "My templates" folder while an admin has personal templates on; when they are off, "My templates" is read only ("Personal templates are turned off by your admin."). The [admin guide](admin-guide.md) explains levels and grants.

## The library

Open it with "Open library" in the Gmail panel, or with the library address your admin gives you.

| Part | What it does |
|---|---|
| Folder tree (left) | "All templates" and every folder you can see. Arrow keys move, Enter opens, Right and Left expand and collapse |
| "Trash" (below the tree) | Deleted templates of folders you can edit |
| "Search templates" | Filters by title, subject, folder and tag as you type. Press `/` to jump here |
| "Favorites" (left, under "All templates") | Shows only your starred templates. "All templates" shows all again |
| "New template" | New template in the selected folder. Shown only where you can edit |
| Template list | Columns Favorite, Template, Folder, Tags, Updated, By, Actions |

- Search terms match the start of words, ignore case and accents, and allow one typo in words of 5 letters or more.
- `folder:` and `tag:` narrow the list, for example `folder:sales tag:pricing`.
- Words that appear only in the template text show under "Matches in text" after a short "Searching text..." step.
- Times show in your computer's time zone.

## Row menu

Open it with the "Actions" button of a row, or with Shift+F10 on a selected row.

| Item | Result |
|---|---|
| "Edit" | Opens the editor |
| "Duplicate" | Makes "Copy of ..." in the same folder, with the same subject, tags and text, as version 1 |
| "Move..." | Moves the template to another folder. The list holds only folders where you can edit |
| "History" | Opens the version history |
| "Delete..." | Asks `Delete "<title>"? Deleted templates stay in the trash for 30 days.` "Cancel" has the focus; "Delete" confirms |

Each action shows a status at once ("Duplicating...", "Moving...", "Deleting...") and the result when it is done.

Folders are created, renamed, moved and deleted in Admin, "Folders and access". That needs `manage` on the parent folder; top-level folders need an admin.

## The editor

The editor has three parts.

- Header: the folder path (click a folder to open it in the library), the title, the saved state, "History" and "Save". The saved state reads "Saved as version N, <time>" with a check, "Unsaved changes" after an edit, and "Saving..." while it saves.
- The email on a white sheet: the "Subject" line on top, the body under it. Fields show as blanks: a value such as "Sender name" on a light amber background with a dotted line; a field the sender fills in ("Ask the sender") in a dashed box; a value with default text as "Recipient first name or there".
- The panel on the right: "Details", "The sender fills in", and the tabs "Preview as me" and "Problems".

| Details field | Rules |
|---|---|
| "Title" | Required, 1 to 120 characters. Shown in the panel and the library |
| "Folder" | Where the template lives. Changing it moves the template |
| "Tags" | Up to 10 tags, each 1 to 30 characters. Type a tag, then Enter or "Add tag" |
| "To", "Cc", "Bcc" | Addresses added to the draft at Insert. See "Recipients" below |

"The sender fills in" lists each field the sender fills in, from the subject and the text, with how often it is used ("used once", "used 2 times"). "Preview as me" shows the email with your own directory values, the To, Cc and Bcc lines above the subject, and each field the sender fills in as its name in brackets, for example "[Product]". "Problems" holds the errors and warnings of the last save; its tab shows the count and opens by itself when a save fails.

Under about 860 pixels wide (a phone or a narrow window) the panel moves below the sheet and each part opens and closes with its heading.

Users with use access (no edit) see the same screen without the toolbar, "Save" and "History", and the note "You can use this template but not change it. To change it, ask a folder manager for "Can edit" access."

### Toolbar

The toolbar is one Tab stop. Arrow keys move between its buttons; Home and End jump to the first and last. Each button shows its name and shortcut when you point at it.

| Button | Does |
|---|---|
| Undo, Redo | Undo (Ctrl+Z), redo (Ctrl+Y) |
| "Paragraph" | Paragraph, Heading 1, Heading 2, Heading 3. The button shows the current style |
| "Normal" | Text size: Small, Normal, Large, Huge. The button shows the current size |
| "Font" | Font family: Arial, Georgia, Times New Roman, Verdana, Courier New, Trebuchet MS, or Default. Each name in the menu shows in its own face; the current family has a check |
| B, I, U, S | Bold (Ctrl+B), italic (Ctrl+I), underline (Ctrl+U), strikethrough (Ctrl+Shift+X) |
| Text color, Highlight color | Text color and background color |
| Align text | Left, center, right, justify |
| Bulleted list, Numbered list | Lists |
| Quote | Indented quote block |
| Link | Link (Ctrl+K). The address must start with https://, http://, mailto: or tel: |
| Image | Image by its https:// address. The email links to the image; nothing is uploaded. The image keeps its own width; an image wider than 600 pixels is shown 600 pixels wide. A smaller image is never stretched |
| Table | Inserts a table |
| Horizontal line | Inserts a line |
| "Insert field" | Field menu. Typing `{{` in the text opens the same menu |

>>>
<<<
- Fields work here too. With the cursor in "Subject", "Insert field" types the text form at the cursor. The subject shows the text form, for example `{{ask:Load number}}`.
===
- Fields work here too. With the cursor in "Subject", "Insert field" types the text form at the cursor. The subject shows the text form, for example `{{ask:Load number}}`; while it holds a field, the line "Reads as" under it shows the subject with blanks, as the reader sees it.
## Fields and default text

The "Insert field" menu lists 5 values, "Ask the sender...", "Ask the sender for a date..." and "Ask the sender to choose...".

| Menu item | Text form | Filled with |
|---|---|---|
| "Sender name" | `{{sender.name}}` | Full name from the Migway directory |
| "Sender title" | `{{sender.title}}` | Job title |
| "Sender phone" | `{{sender.phone}}` | Work phone, else the first phone |
| "Sender department" | `{{sender.department}}` | Department |
| "Recipient first name" | `{{recipient.first_name}}` | First name of the To recipient, only with exactly one To address inside Migway |
| "Ask the sender..." | `{{ask:Meeting date}}` | What the user types in the panel |
| "Ask the sender for a date..." | `{{date:Pickup date}}` | The date the sender picks in a calendar, as MM/DD/YYYY |
| "Ask the sender to choose..." | `{{choice:Load status\|Ready\|Late}}` | The option the sender picks from a list |

- Default text: select a blank, open "Insert field", "Add default text...". The text form is `{{recipient.first_name|there}}`. Up to 80 characters.
- A value with no directory entry and no default text becomes a field the sender fills in. In Gmail, "Insert" on the row leaves every field without a value out of the draft, with the space next to it: "Hi [Driver name], thanks" becomes "Hi, thanks". An empty paragraph stays. The sender fills fields first by tapping the template's name, or types the words in the draft. Give a value default text when a sentence must never read with a hole.
- Saving warns about "Recipient first name" without default text: "The sender is asked for it when it is unknown."
- "Ask the sender..." takes a field name of 1 to 40 characters. The same field name used several times is asked once. A field the sender fills in takes no default text.
### Date fields

- A date field shows as "Pickup date (date)". In Gmail the sender picks the day in a calendar; the draft gets it as MM/DD/YYYY, for example 11/12/2026.
- A date left empty is left out, like an empty text field. "Preview as me" shows today's date.
- One field name is either text or a date: `{{ask:Pickup}}` and `{{date:Pickup}}` in one template fail the save. Date fields count toward the 20.

### Choice fields

- "Ask the sender to choose..." asks for a field name and 2 to 20 options, one per line, each up to 100 characters, without `| { } \ < >`. The chip reads "Load status (choice)".
- In Gmail the sender picks from a list that starts at "Choose...". Left there, or on a row "Insert", the field is left out, like an empty text field.
- To change the options, select the chip, then "Insert field", "Edit choices...". "Preview as me" shows the first option.
- One field name used twice needs the same options in the same order. Choice fields count toward the 20.

- At most 20 fields the sender fills in per template, subject and text together. The panel shows at most 20 boxes; with more, the rest are left out of the draft.
- Fields work in text only, never inside a link or image address.
- One field must keep one format. Bolding a whole blank works; bolding half of a typed `{{...}}` is an error.
- `\{{` writes literal double braces.
- A `{` right before a field and another after it is refused: delete one of them. Older templates with it still insert as before; their next save asks for the fix.
- An unknown name fails the save with a hint, for example "Unknown field sender.nmae at character 7. Did you mean sender.name?".

## The Subject field

- Plain text, one line, up to 200 characters. Line breaks are refused on save ("The subject must be one line").
- Fields work here too. With the cursor in "Subject", "Insert field" types the text form at the cursor. The subject shows the text form, for example `{{ask:Load number}}`.
- A field name used in subject and text has one box and fills both. A subject made only of fields without a value leaves the draft subject as it was.
- Empty subject: inserting the template never touches the draft subject.
- In Gmail the template subject fills an empty subject box only. A subject already in the draft is kept unless the sender turns on "Replace the subject" after tapping the template's name. Details: [quick start](user-quick-start.md).

## Recipients (To, Cc, Bcc)

A template can add fixed addresses to To, Cc and Bcc: at most 10 each in To, Cc and Bcc and 20 together, plain `name@company.com` addresses, no template fields.

- Type an address, then Enter, comma, semicolon or space: it becomes a chip. Pasting a list makes one chip per address. Leaving the field does the same. Backspace in the empty field removes the last chip; each chip has its own × button.
- An address outside migway.com shows "outside migway.com" under its chip. Bcc shows "Hidden from the other recipients of the email."
- Mistakes show under To, Cc or Bcc at once, with the same text the save uses: "Cc, address 2 is not an email address. Use the form name@company.com.", "Cc holds 11 addresses. Use at most 10 in Cc.", "safety@migway.com is in both To and Cc. Keep it in one of them.". When an admin set "Outside recipients" to "migway.com only" (Admin, Settings and backups, Settings), an outside chip turns red and Save refuses it: "Bcc, address 1 is outside migway.com. Your admin allows only migway.com addresses. Remove it to save."
- Save always sends all three fields; removing every chip of a field clears it.

Added to the draft when someone inserts this template. The row in Gmail shows how many; the draft shows them after the insert. Senders with "Can use" cannot change them. Insert adds Cc and Bcc always and To only when the draft has no To (a reply keeps its To). Tapping the template's name lists every address; turning off "Add recipients" there adds none. Senders should finish typing their own addresses before inserting.

## Saving and the "This template changed" dialog

1. Click "Save" or press Ctrl+S. The button and the header read "Saving...", then the header reads "Saved as version N, <time>".
2. Errors appear in the "Problems" tab, each as "Error: ...". Field errors name the character position. Subject errors start with "Subject:". Recipient errors also show under their field. The line under the header reads "Not saved. Fix the problems in the Problems tab."
3. When someone else saved a newer version while you edited, the dialog "This template changed" opens: "<name> saved version N at <time> while you edited."
   - "Open their version" loads the newest version: "Opened their version. Your changes were discarded."
   - "Copy my text" puts your text on the clipboard. Then open their version and paste where needed.
   - "Cancel" keeps your text in the editor, unsaved.

Nothing is overwritten without this dialog.

### Leaving with unsaved changes

While the header says "Unsaved changes", leaving the editor asks first: "Leave without saving?" with "Keep editing" (selected), "Discard changes" and "Save and leave". This covers the sidebar, the folder tree, the folder path in the header, "History", and the browser's Back and Forward. "Save and leave" leaves only when the save worked; a failed save or a "This template changed" dialog keeps you in the editor. Closing or reloading the browser tab asks through the browser's own question.

## Version history and restore

1. Row menu "History", or "History" in the editor.
2. Versions are listed newest first, with time, author and "restored from K" where it applies.
3. Arrow keys move the selection. Enter shows that version's To, Cc and Bcc lines (when it has any), subject and text on the right.
4. Press R or "Restore this version". The dialog asks "Create version N from version K?". "Restore" confirms.
5. The status reads "Restored as version N." Restore copies subject, recipients and text into a new version. No version is lost. When the stored addresses of the old version cannot be read, the status adds "The Cc addresses of version K could not be read and were left empty. Add them again in the editor."

All versions are kept.

## Trash and restore

- "Trash" below the folder tree lists deleted templates of folders you can edit, with "Deleted", "By" and "Days left".
- "Restore" puts a template back into its folder.
- When that folder was deleted or you lost edit on it, a dialog asks for another folder.
- After 30 days the nightly job removes a template for good.
- Admins also see "Empty trash now...", which removes every template in the trash at once.

The Trash view is not yet verified in Gmail's library window (its smoke step is still open).

## Size and what the cleanup removes

Every save runs a cleanup on the server. Pasted text from Word, web pages or Gmail goes through it.

- The text may be at most 100 KB (102,400 bytes) after cleanup. A larger one fails to save with "Error: The template text is too large. Shorten it or remove some formatting.".
- Removed with their content: scripts, styles, frames, forms, embedded objects, SVG and similar elements.
- Unknown tags are removed and their text is kept.
- Links that do not start with https://, http://, mailto: or tel: lose the link, for example `javascript:` links.
- Images that are not https:// lose their address.
- Event handlers, IDs and classes are removed. Only a fixed list of inline styles stays (color, fonts, alignment, spacing, borders, sizes).
- Comments are removed.

What survives: paragraphs, headings, bold, italic, underline, lists, quotes, tables, links, https images, colors and fonts.

## Sign-offs and the Gmail signature

Gmail adds each user's own signature below the message. A template that ends with "Best regards" and `{{sender.name}}` then shows the name twice. Leave sign-offs and names at the end to the Gmail signature.
