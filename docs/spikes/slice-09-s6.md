# Spike S6: recipient actions on Gmail web (record)

Spec 14.1, ADR-0006. Owner run through the Chrome extension, dev build `dev-ec0ccb2`, compose toolbar, Gmail web, 2026-11-10. The harness (src/addon/spikeS6.ts, callbacks `onS6Card` and `onS6Apply`, the "Spike S6 (temporary)" home section and the smoke steps) was removed in slice 9.

## Result

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

## What the build does (slice 9)

- Recipient actions replace a field. For each field Insert changes, the action carries the draft's list from the tap's event, then the template addresses not already in any of the draft's 3 fields (trimmed, lower case).
- A field with nothing to add gets no action, so it is never rewritten.
- Body, subject and recipient actions go in one `UpdateDraftActionResponse`. No fallback button.
- In a reply the draft's To is filled, so the template To is listed as "Not added" and no To action is sent.
- Open: step 7 (fresh consent). A permission prompt there stops the feature (spec 14.1).
- Limit: text typed in a recipient field that has not become a chip is not in the event, and a replace drops it. The cards and the quick start say: finish typing addresses before inserting.
