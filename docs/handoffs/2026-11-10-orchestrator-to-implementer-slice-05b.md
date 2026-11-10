# Handoff: orchestrator to implementer, slice 5b (smoke findings, reply subject)

Source: owner smoke runs through the Claude Chrome extension on dev builds 637ce77 (slice 4b) and 32a446c (slice 5), 2026-11-10. The first "My templates" folder stood in for "Smoke 3".

## Verified in Gmail web (no work needed)
- Spike S5, Q20: one `UpdateDraftActionResponse` with body and subject actions works. Subject "old" became exactly "Quote for Pen". No permission prompt, no new scope.
- "Insert body only" and the "Replace the subject" switch keep the draft subject.
- Subject editor field, counter, placeholder insert, unknown-name error, history subject line and restore all pass.
- Favorites star by mouse and keyboard, the favorites filter, title and subject search, `tag:` and `folder:` operators pass.
- The compose card is modal on Gmail web: the body must have focus before the add-on opens. F9 then inserts at the cursor.
- `template.update` on a warm cache: Duration 4.2 to 5.2 s, `totalMs` 3164 to 3730, `driveWriteMs` 2031 to 2729, `cacheMs` 521 to 604, `calls` `{"props":2,"cache":10,"drive":3,"lock":1,"dir":0}`.

## Defects and findings to fix

1. Reply drafts (Q21). Insert of a template with a subject into a reply replaced the subject and Gmail put the sent reply into a new thread. Wanted:
   a. Diagnostics: the add-on sends, with each call, which Gmail event fields are present. Names only, from a fixed list in code (for example `messageId`, `threadId`, `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients`, `subject`), plus the counts of To, Cc and Bcc. The server validates the names against the same fixed list and logs them in the call's line. No values, no addresses.
   b. One pure function decides "this draft is a reply" from the event. First rule: `threadId` or `messageId` is present. The diagnostics of the next smoke run confirm or replace the rule.
   c. In a reply: one-click Insert and the prompt card default to body only; the prompt card switch "Replace the subject" starts off; the preview card says the subject is kept in replies and offers "Insert with subject" as the opt-in. In a new draft nothing changes.
2. An admin sees other users' private folders, all named "My templates" (D18). The tree and the Move list showed two identical names. Label a private folder the caller does not own with its owner, for example "My templates (name@domain)", in the tree, the Move list, folder paths in the grid and search results. The caller's own stays "My templates".
3. Times show UTC ("Saved as version 1, 15:14" at 10:14 local; history too). Show the browser's local time everywhere in the web app.
4. Duplicate showed no status for about 8 s. Duplicate, Move and Delete show a busy status at once ("Duplicating...", "Moving...", "Deleting...").
5. History: the first arrow key after opening did nothing until the list was clicked. Focus the list on open.
6. Delete confirmation: the Delete button has the initial focus. Put it on Cancel.
7. Body search: typing a word that is only in a body first showed `No templates match "price". Try folder: or tag:.` and then "Matches in text" after 1 to 2 s. Show "Searching text..." while `search.body` is pending; show the no-match text only after it returns nothing.
8. "/" focused the search box on the second try (observed, unverified). Check the key handler when no element inside the app has focus after load.

## Not defects
- `folder:smoke tag:smoke` returned 0 rows: no folder is named "smoke" in this data.
- Tab reaches the grid's first cell and arrows move inside it (grid pattern).
- `template.create` ran 14.7 s once with a 4.2 s handler (cold start); warm saves take 4 to 5 s, of which Drive writes are 2 to 2.7 s. No change wanted in this slice. A proposal is welcome.

## Not yet run in Gmail (smoke "Slice 5" step 7 and 8)
Sidebar Favorites, Recent and Search, and the second account. They join the slice 5b smoke.
