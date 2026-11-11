# Migway Templates: quick start

For everyone who writes email in Gmail on the web.

Migway Templates adds a panel to the Gmail compose window. One click puts a saved template into your message. Templates live in a library web page, sorted in folders. You see the folders shared with you, plus your own folder "My templates".

## Insert a template

1. In Gmail, click Compose or Reply.
2. Click into the message text where the template should go. Do this first: while the panel is open, you cannot type in the draft.
3. Click the Migway Templates icon at the bottom of the compose window. In a narrow window it may sit under "More options".
4. Find the template under "Favorites", "Recent", "Folders" or "Search templates".
5. Click "Insert" next to it. The text goes in where your cursor was.

Click a template's title to see a preview with the subject, the start of the text and "Fields to fill".

## Fill the asked fields

Some templates ask for a value, for example a product name.

1. After "Insert", the panel shows "Fill these fields to insert".
2. Fill every box (plain text, up to 500 characters) and click "Insert".
3. An empty box stops the insert and shows "(!) Fill 1 field: ...". Your draft stays unchanged.
4. "Cancel" goes back without inserting.

Some fields fill themselves from the Migway directory: your name, title, phone, department, and the first name of a single Migway recipient. When a value is unknown, the panel asks you for it. Details: [editor guide](editor-guide.md).

## The subject line

- Empty subject box: "Insert" fills it with the template subject. The preview says "Sets the draft subject."
- Subject already there (typed or a reply): "Insert" keeps it. The preview says "The draft already has a subject. It is kept."
- To replace it anyway: open the preview and click "Insert with subject".
- To keep an empty subject box empty: preview, "Insert body only".
- Replies keep "Re: ...", so they stay in their conversation.
- Forwards should keep their subject too. Not yet verified in Gmail.
- On the fill-in panel, the switch "Replace the subject" decides. It starts on for an empty subject box, off otherwise.

## Templates that add recipients

Some templates add fixed addresses to To, Cc or Bcc, for example safety in Cc. Their row says "Adds Cc 1" and has "Review" in place of "Insert". Review opens a card that lists every address: "outside migway.com" marks an address outside the company, "hidden from other recipients" marks Bcc. Insert adds them and never removes an address already in the draft. An address already there is listed as "Not added". In a reply, or when you typed a To address, the template's To is not added ("The draft already has a To recipient."); type it yourself if you need it. "Insert body only" adds neither the subject nor any address. On the fill-in panel, the switch "Add recipients" decides. Finish typing addresses before you insert: an address that is not yet a chip in the draft can be lost.

## Search, Favorites and Recent

- Type in "Search templates", then click outside the box. Clear the box to get the home panel back.
- Search looks at titles, subjects, tags, folder names and the first lines of the text.
- `folder:sales` and `tag:pricing` narrow the results to folders or tags with a word that starts with that text.
- Favorites: click the star (☆) next to a template in the library. The panel shows up to 10.
- Recent: your last 5 inserted templates. A new insert can take up to about 15 minutes to show there.

## Your own templates in "My templates"

1. In the panel, click "Open library".
2. Select "My templates" in the folder list on the left.
3. Click "+ New template", fill "Title" and the text. "Subject" and "Tags" are optional.
4. Click "Save" or press Ctrl+S. The status reads "Saved as version 1" and the time.

## What admins can see

- Admins see every folder, private ones included. They can open, change, move and delete the templates in your "My templates". The Gmail panel does not show them other people's folders; the library does.
- An audit log records who created, changed, moved, restored or deleted a template, and when, and refused access attempts.
- Each insert writes a server log entry with your address, the template's ID and the time. People with access to the logs can see who inserted which template and when.
- The app keeps your last 20 inserted templates for the "Recent" list. The admin usage page shows counts per template, without names.
- Your message text, your recipients and the values you type into fields are not stored or logged.

## Known limits

- In the library, the first press of "/" (jump to search) may need a second press.
- In History, arrow keys move the selection. Press Enter to show that version.
- A new or changed template can take up to 10 minutes to show in the panel. "Open library" in the panel clears the panel's copy, so the next panel load shows it.
- Closing the library window should reload the panel. Not yet verified in Gmail.
- Gmail on Android and iOS is untested. Use Gmail on the web.

## Messages and who to ask

- "You don't have access to this template. Ask a folder manager.": ask the folder's manager or the Migway Templates admin.
- No Migway Templates icon: ask the Migway Templates admin.
- "Cannot identify your Migway account.": you are signed in to several Google accounts. Use a separate Chrome profile for Migway.
- "Busy, try again." or "Service is busy. Try again in a minute.": wait, then click "Retry".
- "Something went wrong." with a Request ID: send the Request ID to the admin.
