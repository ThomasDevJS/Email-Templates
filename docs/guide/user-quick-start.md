# Migway Templates: quick start

For everyone who writes email in Gmail on the web. Reading time: 5 minutes.

Migway Templates adds a panel to the Gmail compose window. One click puts a saved template into your message. Templates live in a library web page, sorted in folders. You see the folders someone shared with you, plus your own folder "My templates".

## Insert a template

1. In Gmail, click Compose, Reply or Forward.
2. Click into the message text where the template should go. Do this first: while the panel is open, you cannot type in the draft.
3. Click the Migway Templates icon at the bottom of the compose window. The panel shows "Search templates", "Favorites", "Folders" and, once you have inserted a template, "Recent".
4. Find the template: open a folder, or look under Favorites, Recent or the search results.
5. Click "Insert" next to it. The text goes in where your cursor was.

Click a template's title to see a preview first. The preview shows the subject, the start of the text and "Fields to fill". It has its own "Insert" button.

## Fill the asked fields

Some templates ask you for a value, for example a product name or a date.

1. After "Insert", the panel shows "Fill these fields to insert", one box per field.
2. Type a value in every box. Values are plain text, up to 500 characters.
3. Click "Insert". An empty box stops the insert and shows "(!) Fill 1 field: ..." with the field name. Your draft stays unchanged until every box is filled.
4. "Cancel" goes back without inserting. Your values are not kept.

## The subject line

Some templates carry a subject.

- Empty subject box: "Insert" fills it. The preview says "Sets the draft subject."
- Subject already there (typed by you, a reply, a forward): "Insert" keeps it. The preview says "The draft already has a subject. It is kept."
- To replace a subject that is already there: open the preview and click "Insert with subject".
- To keep an empty subject box empty: open the preview and click "Insert body only".
- Replies keep their "Re: ..." subject, so the reply stays in its conversation.
- On the fill-in panel, the switch "Replace the subject" decides. It starts on when the subject box is empty and off when it has text.

## Search, Favorites and Recent

- Type in "Search templates", then click outside the box. The results replace the home panel. Clear the box to get the home panel back.
- Search looks at titles, subjects, tags, folder names and the first lines of the text.
- `folder:sales` keeps templates in a folder with a word that starts with "sales".
- `tag:pricing` keeps templates with a tag that starts with "pricing".
- Favorites: in the library, click the star (☆) next to a template. The panel shows up to 10 favorites.
- Recent: the last 5 templates you inserted. A new insert shows there within about 5 minutes.

## Your own templates in "My templates"

Every person gets one private folder, "My templates". Only you and the admins see it.

1. In the panel, click "Open library". The library opens in a new window.
2. In the folder list on the left, select "My templates".
3. Click "+ New template".
4. Fill "Title". "Subject" and "Tags" are optional. Write the text in the large box.
5. Click "Save" or press Ctrl+S. The status reads "Saved as version 1" and the time.

The editor guide explains the toolbar and history: [editor guide](editor-guide.md).

## Placeholders: blanks that fill themselves

A template can hold blanks that Migway Templates fills when you insert it. In the editor they appear as chips, small labelled boxes in the text. Click "{{ Placeholder" in the toolbar, or type `{{`, to add one.

| Placeholder | Filled with |
|---|---|
| Sender name | your name from the Migway directory |
| Sender title | your job title from the directory |
| Sender phone | your work phone from the directory |
| Sender department | your department from the directory |
| Recipient first name | the first name of the person in To, only when To holds exactly one Migway address |

- A value that is unknown uses the template's fallback text, for example "there" in "Hello there".
- A value that is unknown and has no fallback becomes a field the panel asks you to fill.
- "Ask the user..." adds a question the panel asks every time, for example "Meeting date".
- Directory changes (a new title or phone) show within 6 hours.

## What admins can see

- Admins see every folder, private ones included. They can open, change, move and delete the templates in your "My templates".
- The panel never shows admins other people's "My templates". The library does.
- An audit log records who created, changed, moved, restored or deleted a template, and when. It also records refused access attempts.
- The app counts how often each template is inserted. The admin usage page shows counts per template, without names.
- Your email text, your recipients' addresses and the values you type into fields are not stored or logged.

## Known limits

- In the library, the first press of "/" (jump to search) after the page loads may need a second press.
- In History, the arrow keys move the selection. Press Enter to show that version.
- A new or changed template can take up to 10 minutes to show in the Gmail panel. Clicking "Open library" in the panel clears the panel's copy, so the next panel load shows it.
- Closing the library window that "Open library" or "Edit in library" opened should reload the panel. Not yet verified in Gmail.
- Gmail on Android and iOS: untested. Gmail on the web is the supported client.

## Messages and who to ask

- "You don't have access to this template. Ask a folder manager.": ask the person who manages that folder, or the Migway Templates admin.
- No Migway Templates icon in the compose window: ask the Migway Templates admin.
- "Cannot identify your Migway account.": you are signed in to several Google accounts. Use a separate Chrome profile for Migway.
- "Busy, try again." or "Service is busy. Try again in a minute.": wait, then click "Retry".
- "Something went wrong." with a Request ID: send the Request ID to the admin.
