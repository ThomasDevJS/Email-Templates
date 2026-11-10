# Handoff: orchestrator to implementer, slice 9 (template recipients, D26)

## Spike S6 result (owner run through the Chrome extension, dev-ec0ccb2, compose toolbar, Gmail web, 2026-11-10)

| Step | Draft | Button | Result |
|---|---|---|---|
| 0 | New, To A | Body only; Body and subject | Body inserted; Subject set. Card closed after the tap |
| 1 | New, empty | New only (body, subject, To, Cc, Bcc in one response) | All 5 actions applied. The Bcc line opened by itself. No prompt, no error |
| 2 | New, To A, Cc B | New only | REPLACE: A and B were removed; only the 3 test addresses remained |
| 3 | New, To A, Cc B | Draft plus new | All 5 addresses present once, no duplicates |
| 4 | New, Cc `s6-cc` | Raw Cc again (a Cc action alone) | One `s6-cc` chip. A response with only a recipient action works |
| 5 | Reply | Draft plus new | To kept and the test To added, Cc and Bcc added. The harness also set the subject, and the saved draft probably left its conversation (the D24 rule keeps the subject in the real build) |
| 6 | Forward | Draft plus new | To was empty and was filled; Cc and Bcc added |
| 7 | Fresh consent | not run | by hand, still open |
| 8 | Event strings | | Each list is a JSON array of bare addresses with no display name, in `draftMetadata` (`toRecipients`, `ccRecipients`, `bccRecipients`; arrays, empty when the field is empty). The `gmail` object repeats only the non-empty lists |

Callback time 5 to 10 ms (harness code only, no server call).

## What it decides (spec 14.1 decision table)

- Recipient actions REPLACE a field. The build therefore sends, for each field it changes, the draft's list as received from the event at tap time, followed by the template addresses that are not already in any of the draft's 3 fields (compare trimmed and lowercased).
- A field the template does not add to gets no action at all, so it is never rewritten.
- Body, subject and recipient actions combine in one response. No fallback button is needed.
- A response with only recipient actions works (useful when the user picks "Add recipients" and no body is involved; not required by the spec).
- In a reply the draft's To is filled, so the template To is listed as "Not added" (spec 5.7) and no To action is sent.
- No permission prompt appeared in an already consented account. The fresh-consent step is still open; if the owner's by-hand check later shows a prompt, the feature stops (spec 14.1).
- The side panel (no `draftMetadata`) is out of this slice: `entryOf` already hides Insert there. Spike S7 and the Gmail panel pass handle it.

## Limits to respect

- The draft list comes from the event of the tap, never from a value cached when a card opened.
- Text the user typed into a recipient field that has not become a chip is not in the event and would be lost by a replace. The preview card and the quick start say: finish typing addresses before inserting.
- Never log or send to the server any address of the draft. The `draft` object in the log keeps counts and booleans only.
