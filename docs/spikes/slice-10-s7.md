# Spike S7: compose actions from the Gmail side panel (record)

Spec 14.2, ADR-0007. Owner's Gmail web, test round 1 part G, dev build `dev-56bf795`, side panel, 2026-11-11. Harness: src/addon/spikeS7.ts (callbacks `onS7Card`, `onS7Compose`, `onS7Notify`, the "Spike S7 (temporary)" home section, Reply kinds `s7` and `s7Error`, smoke section "Spike S7"). Slice 18 removes the harness; this file keeps the facts.

## What the harness called

- `GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken)` first, on every button.
- "New email": `GmailApp.createDraft("s7-to@...", "S7 test", "", { htmlBody, cc, bcc })`, button `setComposeAction(..., STANDALONE_DRAFT)`.
- "Reply": `GmailApp.getMessageById(e.gmail.messageId).createDraftReply("", { htmlBody, cc, bcc })`, button `REPLY_AS_DRAFT`. No `subject` option, no To.
- "Reply all": the same with `createDraftReplyAll`.
- Each returns `CardService.newComposeActionResponseBuilder().setGmailDraft(draft).build()`.
- "Notify": a compose-action button (`STANDALONE_DRAFT`) whose callback returns an `ActionResponse` with a notification.
- All buttons sat in one `ButtonSet`. The manifest of `dev-56bf795` held the same 10 scopes as today and the contextual trigger `unconditional` / `onMessageOpen`. `src/` at the PLAN commit "Spike S7 passed" equals `dev-56bf795` (`git diff --stat 56bf795 HEAD -- src appsscript.json` is empty).

## Result

| # | Setup | Button | Result |
|---|---|---|---|
| 1 | Inbox, no message open | New email | Compose window opened. Subject "S7 test"; To, Cc, Bcc set; bold, list, link and image kept. No prompt, no error |
| 2 | Message open | (card) | The card reloaded: "entry: message", "message ID present: yes". So `onMessageOpen` runs and its event carries the message ID |
| 2 | Message open | Reply | Reply opened in the conversation (inline, can be popped out). To = the sender; Subject "Re: ..."; Cc and Bcc added. A trimmed quoted-text marker was present; the quote itself was not opened (unconfirmed) |
| 3 | Message with 1 To, 1 Cc | Reply all | The original Cc kept and the new Cc added: `options.cc` ADDS to Gmail's reply-all list |
| 4 | Drafts of 1 and 2 | none | Gmail signature present in the reply draft; absent in the new email draft |
| 5 | Inbox | Notify | Notification "S7 Notify: the callback ran. No draft was made." shown; no draft opened. A compose-action callback may return a notification in place of a draft |
| 6 | A compose window with a typed line | New email, then Reply | New email opened a second window; the typed line unchanged. Reply then created an inline reply; no third window |
| 7 | Close a draft without discarding | none | The draft stays in Drafts |

Not measured: callback durations (part H step 3); the fresh-consent check (part H step 2, Q55). Not run: spec 14.2 step 9 (form inputs in a compose-action callback): the harness had no text input.

## What it settles (ADR-0007, Acceptance 2026-11-11)

- `createDraft`, `getMessageById`, `createDraftReply` and `createDraftReplyAll` run under the 10 scopes with the event token. `https://mail.google.com/` is not needed (Q44).
- `STANDALONE_DRAFT` works from the homepage card with no message open.
- Reply all: pass only the template's new Cc; Gmail keeps the conversation's Cc (Q45).
- Signature: Gmail adds it to replies only (Q41).
- Errors from a compose-action button can be a notification.
- The side panel never changes a compose window that is already open.

## Part J run, 2026-11-11

Owner's Gmail web, side panel, dev build `dev-5065ba1` (slice 18), test round 1 part J. 11 of 12 steps passed.

- Q74 settled: a compose action works on a `DecoratedText` row button and on a `FixedFooter` button.
- Q68 settled: typed values and the "Add recipients" switch reach the compose-action callback ("Load 77", "Hi Ann, load 77 is ready."; switch off added no Cc or Bcc).
- Reply: To the sender, Cc and Bcc added, signature below the text. Reply all kept To and added Cc and Bcc. So `getMessageById` and the header reads (`getReplyTo`, `getFrom`, `getTo`, `getCc`) ran under the 10 scopes: a failed read makes no draft.
- A double press opened 1 draft (Q69).
- Long row hints wrap.
- No quoted earlier message seen in the reply of step 7 (the "..." control was not seen). S7 result 2 saw a trimmed-quote marker. Unconfirmed; the owner checks by hand.
- Defect, step 11: "New email" on a row of a template deleted in the library showed nothing and opened no draft, on two tries. The callback returned an `ActionResponse` with a notification (NOT_FOUND text); Gmail did not show it. S7 result 5 had shown a notification from a compose-action button in a `ButtonSet`; this one sat on a `DecoratedText` row. Fix (slice 18 follow-up 1): every failure of a panel action now throws an `Error` whose message is one plain sentence. How Gmail shows a thrown error from a compose action is unverified; part J step 11 records it.

## Still open

- Quoted earlier message in a reply: part J step 7.
- Fresh consent with the panel actions: part H step 2 (Q55).
