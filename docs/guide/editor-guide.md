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
| "★ Favorites" | Shows only your starred templates. Press it again to see all |
| "+ New template" | New template in the selected folder. Shown only where you can edit |
| Template list | Columns Favorite, Title, Folder, Updated, By, Actions |

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

Folders are created, renamed, moved and deleted in Admin, "Folders and grants". That needs `manage` on the parent folder; top-level folders need an admin.

## The editor

| Field | Rules |
|---|---|
| "Title" | Required, 1 to 120 characters. Shown in the panel and the library |
| "Subject" | Optional, up to 200 characters, one line. The counter reads "n/200 (optional)" |
| "Folder" | Where the template lives. Changing it moves the template |
| "Tags" | Up to 10 tags, each 1 to 30 characters. Type a tag, then Enter or "Add tag" |
| Body | The template text, with the toolbar above it |

"Preview as me" on the right shows the template with your own directory values. "History" opens the version history. "‹ Library" goes back.

### Toolbar

The toolbar is one Tab stop. Arrow keys move between its buttons.

| Button | Does |
|---|---|
| B, I, U, S | Bold (Ctrl+B), italic (Ctrl+I), underline (Ctrl+U), strikethrough (Ctrl+Shift+X) |
| "Text" | Paragraph, Heading 1, Heading 2, Heading 3 |
| "Color", "Highlight" | Text color and background color |
| "Size", "Font" | Font size and font family |
| "Align" | Left, center, right, justify |
| "• List", "1. List" | Bulleted and numbered lists |
| "Quote" | Indented quote block |
| "Line" | Horizontal line |
| "Link" | Link (Ctrl+K). The address must start with https://, http://, mailto: or tel: |
| "Image" | Image by its https:// address. Images are linked, not uploaded. The dialog says "Width is set to 600 pixels or less", but every inserted image gets width 600, so a smaller image is stretched |
| "Table" | Inserts a table |
| "{{ Placeholder" | Placeholder menu. Typing `{{` in the text opens the same menu |

## Placeholders and fallbacks

The placeholder menu lists 5 values and one question type.

| Menu item | Text form | Filled with |
|---|---|---|
| "Sender name" | `{{sender.name}}` | Full name from the Migway directory |
| "Sender title" | `{{sender.title}}` | Job title |
| "Sender phone" | `{{sender.phone}}` | Work phone, else the first phone |
| "Sender department" | `{{sender.department}}` | Department |
| "Recipient first name" | `{{recipient.first_name}}` | First name of the To recipient, only with exactly one To address inside Migway |
| "Ask the user..." | `{{ask:Meeting date}}` | What the user types in the panel |

- Fallback: select a chip, open "{{ Placeholder", "Add fallback...". The text form is `{{recipient.first_name|there}}`. Up to 80 characters.
- A value with no directory entry and no fallback becomes a field the user must fill. Nothing is ever inserted blank.
- Saving warns about "Recipient first name" without a fallback: "users will be asked for it".
- "Ask the user..." takes a label of 1 to 40 characters. The same label used several times is asked once. Questions take no fallback.
- At most 20 questions per template, subject and text together.
- Placeholders work in text only, never inside a link address.
- One placeholder must keep one format. Bolding a whole chip works; bolding half of a typed `{{...}}` is an error.
- `\{{` writes literal double braces.
- An unknown name fails the save with a hint, for example "Unknown placeholder sender.nmae at character 7. Did you mean sender.name?".

## The Subject field

- Plain text, one line, up to 200 characters. Line breaks are refused on save ("Subject must be one line").
- Placeholders work here too. With the cursor in "Subject", "{{ Placeholder" types the text form at the cursor.
- A question used in subject and text is asked once and fills both.
- Empty subject: inserting the template never touches the draft subject.
- In Gmail the template subject fills an empty subject box only. A subject already in the draft is kept unless the user picks "Insert with subject". Details: [quick start](user-quick-start.md).

## Recipients (To, Cc, Bcc)

A template can add fixed addresses to To, Cc and Bcc: at most 10 per field and 20 together, plain `name@company.com` addresses, no placeholders. Save refuses a bad address ("Cc, address 2 is not an email address."), an address in two fields, and, when an admin set "Outside recipients" to "migway.com only" (Admin, Config, Settings), any address outside migway.com. Users with use access see every address on a card before Insert and cannot change them. Insert adds Cc and Bcc always and To only when the draft has no To (a reply keeps its To); "Insert body only" adds none. Users should finish typing their own addresses before inserting. The editor fields arrive with the editor redesign; until then the owner sets recipients on request, and saving the template in the editor keeps them.

## Saving and the "This template changed" dialog

1. Click "Save" or press Ctrl+S. The button reads "Saving..." and the status ends with "Saved as version N" and the time.
2. Errors appear in a list above the status, each as "Error: ...". Placeholder errors name the character position. Subject errors start with "Subject:". The status reads "Not saved. Fix the problems listed above."
3. When someone else saved a newer version while you edited, the dialog "This template changed" opens: "<name> saved version N at <time> while you edited."
   - "Open their version" loads the newest version. Your changes are discarded.
   - "Copy my text" puts your text on the clipboard. Then open their version and paste where needed.
   - "Cancel" keeps your text in the editor, unsaved.

Nothing is overwritten without this dialog.

## Version history and restore

1. Row menu "History", or "History" in the editor.
2. Versions are listed newest first, with time, author and "restored from K" where it applies.
3. Arrow keys move the selection. Enter shows that version's subject and text on the right.
4. Press R or "Restore this version". The dialog asks "Create version N from version K?". "Restore" confirms.
5. The status reads "Restored as version N." Restore copies subject and text into a new version. No version is lost.

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

- The text may be at most 100 KB (102,400 bytes) after cleanup. A larger one fails to save with "Error: Body is too large".
- Removed with their content: scripts, styles, frames, forms, embedded objects, SVG and similar elements.
- Unknown tags are removed and their text is kept.
- Links that do not start with https://, http://, mailto: or tel: lose the link, for example `javascript:` links.
- Images that are not https:// lose their address.
- Event handlers, IDs and classes are removed. Only a fixed list of inline styles stays (color, fonts, alignment, spacing, borders, sizes).
- Comments are removed.

What survives: paragraphs, headings, bold, italic, underline, lists, quotes, tables, links, https images, colors and fonts.

## Sign-offs and the Gmail signature

Gmail adds each user's own signature below the message. A template that ends with "Best regards" and `{{sender.name}}` then shows the name twice. Leave sign-offs and names at the end to the Gmail signature.
