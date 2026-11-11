# Migway Templates: quick start

For everyone who writes email in Gmail on the web.

Migway Templates adds a panel to the Gmail compose window. One click puts a saved template into your message. Templates live in a library web page, sorted in folders. You see the folders shared with you, plus your own folder "My templates".

## Insert a template

1. In Gmail, click Compose or Reply.
2. Click into the message text where the template should go. Do this first: while the panel is open, you cannot type in the draft.
3. Click the Migway Templates icon at the bottom of the compose window. In a narrow window it may sit under "More options".
4. Find the template under "Favorites" (star icon), "Recent" (clock icon), "Folders" or "Search templates". Favorites and Recent show only when they hold a template.
5. Click "Insert" next to it. The text goes in where your cursor was, and the panel closes.

Insert puts the template into the draft at once. Fields you did not fill are left out. Read the draft before you send.

Tap a template's name to see it first and fill in its fields.

## Use the side panel

Migway Templates also opens in the panel on the right side of Gmail. It stays open while you read your email.

- No email open: click "New email" on a template. A new email opens with the template's subject, text and recipients.
- An email open: click "Reply" on a template. Your reply opens in the conversation with the template's text. It goes to the sender and keeps "Re:" in the subject. The template's Cc and Bcc are added; its To is not.
- "Reply all", under "Reply" on the same template, answers everyone on the email and adds the template's Cc and Bcc.
- Click a template's name for "Reply all", "New email", and to fill in fields first. "Add recipients" off leaves out the template's addresses.
- The side panel always starts a new email or a reply. To insert into an email you are already writing, use the Migway Templates button in that email's toolbar.
- Gmail adds your signature to replies only. In a new email, use "Insert signature" in its toolbar.
- Each click makes a draft. A draft you close stays in Drafts; delete it there if you do not need it.

## Fill in fields first

Some templates have fields, for example a driver name. Their row says "2 fields to fill".

- "Insert" on the row leaves those fields out: "Hi [Driver name], thanks" becomes "Hi, thanks". Type the missing words in the draft.
- To fill them first, tap the template's name. The panel shows "Fill in now, or leave blank and type in the draft.", one box per field, the subject, the recipients and the start of the text.
- Fill the boxes you want (plain text, up to 500 characters) and click "Insert". A box left blank is left out of the draft.
- A value over 500 characters stops the insert and shows "(!) Shorten to 500 characters: ...". Your draft stays unchanged.
- Gmail's back arrow goes back to the list without inserting.

Some fields fill themselves from the Migway directory: your name, title, phone, department, and the first name of a single Migway recipient. When a value is unknown, the field uses its default text, or is left out when it has none. Details: [editor guide](editor-guide.md).

## The subject line

- Empty subject box: "Insert" fills it with the template subject.
- Subject already there (typed or a reply): "Insert" keeps it.
- To replace it anyway: tap the template's name, turn on "Replace the subject", click "Insert".
- To keep an empty subject box empty: tap the template's name, turn off "Replace the subject".
- Replies keep "Re: ...", so they stay in their conversation.
- Forwards should keep their subject too. Not yet verified in Gmail.

## Templates that add recipients

Some templates add fixed addresses to To, Cc or Bcc, for example safety in Cc.

Templates that add recipients say so on the row, for example Adds Cc 1. The draft shows the addresses after the insert. Finish typing addresses before you insert.

- "Insert" adds them and never removes an address already in the draft. An address already there is not added again.
- In a reply, or when you typed a To address, the template's To is not added. Type it yourself if you need it.
- Tap the template's name to see every address first: "outside migway.com" marks an address outside the company, "hidden from other recipients" marks Bcc, "Not added" says why an address is left out.
- To insert without the addresses: tap the template's name and turn off "Add recipients".
- When the template's addresses changed since the panel loaded, "Insert" opens the template with "(!) The recipients of this template changed. Check them and press Insert again." Nothing is inserted until you click "Insert" there.

## Search, Favorites and Recent

- Type in "Search templates", then click outside the box. Clear the box to get the home panel back.
- Search looks at titles, subjects, tags, folder names and the first lines of the text.
- `folder:sales` and `tag:pricing` narrow the results to folders or tags with a word that starts with that text.
- Favorites: click the star (☆) next to a template in the library. The panel shows up to 10.
- Recent: your last 5 inserted templates. A new insert can take up to about 15 minutes to show there.

## Your own templates in "My templates"

Your admin decides whether personal templates are on. When they are off, you get no "My templates" folder. If you already have one, you keep it: you can still open, star and insert its templates, but you cannot create, change or delete them. The library then says "Personal templates are turned off by your admin." If you see no folders at all, ask your admin for access to a folder.

1. In the panel, click "Open library" at the bottom.
2. Select "My templates" in the folder list on the left.
3. Click "New template", fill "Title" and the text. "Subject" and "Tags" are optional.
4. Click "Save" or press Ctrl+S. The status reads "Saved as version 1" and the time.

## What admins can see

- Admins see every folder, personal ones included. They can open, change, move and delete the templates in your "My templates". The Gmail panel does not show them other people's folders; the library does.
- Admins can turn personal templates off for everyone. Your templates in "My templates" stay and can still be inserted; nobody can change them until the setting is on again.
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
- Forwarding is not in the side panel. Forward in Gmail, then use the button in the email's toolbar.

## Messages and who to ask

- "You don't have access to this template. Ask a folder manager.": ask the folder's manager or the Migway Templates admin.
- No Migway Templates icon: ask the Migway Templates admin.
- "Cannot identify your Migway account.": you are signed in to several Google accounts. Use a separate Chrome profile for Migway.
- "The library is busy. Try again in a few seconds." or "Service is busy. Try again in a minute.": wait, then click "Retry".
- "Something went wrong." with a Request ID: send the Request ID to the admin.
