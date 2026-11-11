# ADR-0007: Insert from the Gmail side panel (D27)

Status: Accepted 2026-11-11 (spike S7 passed on Gmail web from the side panel, dev-56bf795, docs/spikes/slice-10-s7.md). Was Proposed 2026-11-10. Owner decision D27 sets the requirement; this ADR sets the mechanism. Section "Acceptance 2026-11-11" holds the S7 facts and the design of slice 18; it replaces the lines marked [S7] below. Its new owner questions (Q67 to Q74) carry defaults.
Date: 2026-11-10, accepted 2026-11-11
Deciders: owner (thomas@migway.com), architect

## Context

D27 (owner, 2026-11-10): "the sidebar must be identical in terms of functionality to how you insert a template from the email compose dialog, so both the sidebar and the compose dialog can be used."

The add-on has two entry points in one manifest (ADR-0001):

| Entry point | Manifest | Event (owner's Gmail runs, 2026-11-10) | Draft responses |
|---|---|---|---|
| Compose toolbar | `addOns.gmail.composeTrigger`, `draftAccess: METADATA`, function `onComposeOpen` | `draftMetadata` with To, Cc, Bcc, `subject`; never `threadId` or `messageId` (smoke "Slice 5b") | `UpdateDraftActionResponse` works: body and subject in one response (spike S5, dev-32a446c) |
| Gmail right side panel | `addOns.common.homepageTrigger`, function `onHomepage` | `gmail` (only `accessToken`), `commonEventObject`, `clientPlatform`, `parameters`, `messageMetadata`, `formInputs`, `hostApp`, `formInput`; no `draftMetadata` (spike S6 runs, dev-c1c7f16, dev-ec0ccb2) | every `UpdateDraftActionResponse` does nothing and shows no error |

Today both entry points render the same home card (`homeFlow`). In the side panel its Insert buttons fail silently. That is a live defect (PLAN log 2026-11-10). [Fixed in slice 10: in the side panel the cards carry no Insert and end with the hint of option (d).]

The manifest has no `addOns.gmail.contextualTriggers` entry. [Since slice 10 it has one: `unconditional`, `onMessageOpen`, scope list unchanged at 10.] The 10 scopes (spec 9) include `gmail.addons.current.action.compose` and `gmail.addons.current.message.metadata`. `https://mail.google.com/` is banned by the build (ADR-0005).

## 1. What Gmail allows a side-panel add-on to do with drafts

Google documentation, read 2026-11-10:

| Fact | Source | Settled |
|---|---|---|
| A card button can carry a compose action: `TextButton.setComposeAction(action, CardService.ComposedEmailType.X)`. Its callback builds a `GmailDraft` and returns `CardService.newComposeActionResponseBuilder().setGmailDraft(draft).build()`. Gmail "displays that draft in its UI in a standard email compose window" | [A29], [A30] | yes |
| `ComposedEmailType` has 2 values: `REPLY_AS_DRAFT` ("A draft that is a reply to another message. Default.") and `STANDALONE_DRAFT` ("A draft that is a standalone message.") | [A31] | yes |
| The compose guide requires `gmail.addons.current.action.compose` and says these techniques are "primarily for creating new draft messages in response to user interactions"; to change a draft the user is editing, it points to the compose UI extension | [A29] | yes |
| `gmail.addons.current.action.compose`: "Allows the add-on to temporarily create new drafts messages and replies"; needs an access token. Non-sensitive | [A34], [A16] | yes |
| The guide's sample calls `GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken)`, then `GmailApp.getMessageById(e.gmail.messageId)` and `message.createDraftReply('', { htmlBody, attachments, inlineImages })` | [A29] | yes |
| `GmailApp.createDraft(recipient, subject, body, options)`: options `attachments`, `bcc`, `cc` (comma-separated), `from`, `htmlBody`, `inlineImages` (`cid:` keys), `name`, `replyTo`. No `subject` option needed: subject is an argument | [A32] | yes |
| `GmailMessage.createDraftReply(body, options)` and `createDraftReplyAll(body, options)`: same options plus `subject` ("A new subject line for the email, up to 250 characters"). Reply goes "to the sender of this message using the reply-to address"; Reply all adds "all recipients" | [A33] | yes |
| The Apps Script reference pages of `createDraft`, `createDraftReply`, `createDraftReplyAll`, `getMessageById`, `setCurrentMessageAccessToken`, `getFrom` list only `https://mail.google.com/` under Authorization | [A32], [A33] | yes, as written. The add-on guides contradict it for add-ons with an access token (next rows) |
| `GmailApp.getMessageById` plus `getFrom()` after `setCurrentMessageAccessToken`: "The only scope necessary for this example is ... gmail.addons.current.message.metadata" | [A34] | yes |
| That `createDraft` and `createDraftReply` run on `action.compose` plus the event token, with no `mail.google.com` | [A29] by its sample only | unverified, S7 |
| A side-panel add-on can change a draft the user already has open | no page offers a way; the only draft-editing response (`UpdateDraftActionResponse`) belongs to the compose UI extension [A29], [A14]; owner's runs: it does nothing from the side panel | no. Treated as impossible |
| `gmail.messageId` is "The ID of the currently open Gmail message", `gmail.threadId` "The currently open Gmail thread ID". `messageMetadata.messageId` and `.accessToken` are deprecated in favor of `gmail.*` | [A13] | yes; per-trigger presence not stated |
| Homepage events "don't include widget or contextual information"; the homepage shows "when viewing their Gmail inbox without an open message or draft" | [A36] | yes. So `onHomepage` gets no `messageId`; the owner's run matches (`gmail` held only `accessToken`) |
| A contextual trigger `addOns.gmail.contextualTriggers: [{ unconditional: {}, onTriggerFunction }]` "activates for all opened Gmail messages"; its sample reads `e.gmail.messageId` | [A37], [A35] | yes |
| Scope for a contextual trigger: the manifest page names none; the message-UI guide's content-reading sample needs `gmail.addons.current.message.readonly` | [A37], [A35] | unverified for a metadata-only use, S7 |
| Whether `STANDALONE_DRAFT` works from a homepage card with no message open | [A29] samples use an open message | unverified, S7 |
| Gmail signature in drafts made by `createDraft` or `createDraftReply` | no page mentions signatures [A29], [A32], [A33] | unverified, S7 |
| HTML body: `htmlBody` is used "instead of the required body argument" on devices that render HTML; `https` images in it | [A32] | `htmlBody` yes; `https` images unverified, S7 |
| Inline images need `inlineImages` blobs and `cid:` references | [A32] | yes. Templates use `https` images (ADR-0004), so none needed |
| To at creation: `recipient` argument (string). Cc, Bcc: comma-separated options. Subject: argument (new) or option (reply) | [A32], [A33] | yes |
| Whether `options.cc` on `createDraftReplyAll` adds to or replaces the copied recipients | not stated | unverified, S7 |
| Whether a reply draft carries the quoted earlier message | not stated | unverified, S7 |
| Behavior when a compose window is already open | not stated | unverified, S7 |
| Mobile | not stated | out of scope (D22) |
| Card Service has no clipboard class or method (full class list) | [A39] | yes |

Answer: the side panel can create a new draft and a reply draft, each opened in Gmail's compose window. It cannot touch a draft the user already has open.

## 2. Side-panel actions per template

Options:

| Option | Mechanism | Same as compose? | Cost | Risk |
|---|---|---|---|---|
| (a) "New email" | Button with `setComposeAction(..., STANDALONE_DRAFT)`. Callback: `template.apply`, render, `setCurrentMessageAccessToken`, `GmailApp.createDraft(to, subject, "", { htmlBody, cc, bcc })`, `ComposeActionResponse` | Yes for a new email: body, subject and To, Cc, Bcc land in one click | About 1 day with (b) | `createDraft` may demand `mail.google.com` (S7). Works with no message open only if S7 passes |
| (b) "Reply" and "Reply all" | Needs `gmail.messageId`, so a contextual trigger (section 4). Button with `setComposeAction(..., REPLY_AS_DRAFT)`. Callback: `getMessageById(messageId).createDraftReply("", { htmlBody, cc, bcc })` or `createDraftReplyAll` | Yes for "answer this email with a template", the main compose use (a reply opened from the thread) | Inside the day of (a), plus one manifest entry | Scope prompt for the contextual trigger, cc semantics of Reply all (S7) |
| (c) Copy to clipboard | Card Service has no clipboard method [A39]. Needs an OVERLAY web app page that copies rich HTML from a sandboxed frame; unverified in ADR-0001 option 3 | No: 3 to 5 steps, user pastes by hand, no subject or recipients | About 1 day for a web page | Rich copy from the `IFRAME` sandbox unverified |
| (d) Hint to the compose toolbar | One line on the side-panel card: "Writing an email? Open Migway Templates from the toolbar at the bottom of the draft to insert at the cursor." [Built in slice 10; text since slice 12: "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar."] | No by itself: the side panel inserts nothing | 1 h | None |

Recommendation: (a), (b) and (d) together. (c) is not built in v1; it becomes the fallback only if S7 fails both (a) and (b).

Row button in the side panel (one slot per row, as in compose):

| Panel state | Row button | Preview card buttons |
|---|---|---|
| No message open | "New email" | "New email" |
| Message open | "Reply" | "Reply", "Reply all", "New email" |

[S7: kept; the details card places them as in Acceptance section A2. The "Review" and prompt-card rules below gave way to D31 one-click.] The rules of the compose path decide one-click or a card: a template with prompts opens the prompt card; a template with recipients shows "Review" and opens the preview card (D26); otherwise the row button creates the draft in one click.

Where the two entry points differ, in user words (card text in spec 7.2, quick start in the Gmail panel pass):

1. The side panel starts a new email or a reply. It cannot change an email you are already writing. For that, open Migway Templates from the toolbar at the bottom of the draft.
2. The side panel fills the whole body of the new email. The toolbar inserts at your cursor.
3. A reply from the side panel keeps "Re:" and the subject of the conversation. The template subject is not used, so the reply stays in its conversation.
4. Your Gmail signature is not added by the side panel (until S7 shows otherwise). Use the signature button in the draft. [S7 result 4: Gmail adds it to a reply, not to a new email. Acceptance section A5.]

Result: the side panel gives the owner the same template choice, search, favorites, preview, prompts, subject rule and recipients as the toolbar, for new emails and replies. Only editing an already open draft stays a toolbar job.

## 3. Rules that must match the compose path

Options:

1. Separate panel flows with their own rules. Cost: a second copy of prompts, subject and recipient logic. Risk: the two paths drift.
2. One apply pipeline, two outputs. `template.apply`, prompts, render, `replacesSubject` (D24) and `recipientActions` (D26) run once; only the last step differs: `UpdateDraftActionResponse` (compose) or `GmailDraft` plus `ComposeActionResponse` (panel).

Decision: option 2. Mechanism per rule:

| Rule | Compose path (today) | Side panel |
|---|---|---|
| Placeholders, prompts | Prompt card, `template.apply` with `followUp: true`, blank field keeps the card | Same prompt card. Its footer button carries the compose action ("Create email" or "Create reply"). Blank field: the callback returns a notification "Fill 1 field: <label>" and no draft. Whether a compose callback may return a notification in place of a draft is unverified (S7); fallback below |
| `recipient.first_name` | The draft's single internal To | New email: the template's single internal To. Reply, Reply all: `getFrom()` of the open message when internal (metadata scope [A34]). Same `internalRecipient` rule; external addresses never leave the add-on |
| Subject D24 | Set only when the draft subject is empty | New email: the draft subject is empty by definition, so a non-empty rendered template subject is set (`createDraft` argument). Reply, Reply all: the draft has "Re: ..." from Gmail, so it is kept; `options.subject` is never passed; "Insert with subject" and "Insert body only" are not offered (the user edits the open compose window) |
| Recipients D26 | `recipientActions(template, draft, choice)` against the event lists | Same function against a computed draft: New email `{to: [], cc: [], bcc: []}`; Reply `{to: [sender]}`; Reply all `{to: [sender], cc: [open message To and Cc without the user]}`. New email: template To, Cc, Bcc go into `recipient`, `options.cc`, `options.bcc`. Reply: template To listed "Not added" (To filled), Cc and Bcc passed as options. Blocked addresses never added |
| Disclosure | Every address on a card before it reaches the draft; "Review" rows; `rh` hash check at Insert | Same cards, same "Review" rows, same `rh` check. The compose window also shows every address before Send |
| Permission | Server re-checks `use` on every `template.apply` | Same call from the compose-action callback. DENIED: notification, no draft |
| Apply event, usage | First Insert tap buffers one event; `followUp` adds none | Same. The draft opens in a compose window; a closed or discarded draft still counts (as a cancelled prompt card does, Q14) |
| Logs | `draft` object: names, counts, `hasSubject`; no address | Same object plus one key `via`: `compose`, `new`, `reply`, `replyAll` (fixed list, server-checked like `fields`). Panel `draft` counts are of the computed draft. No address, subject, body or message ID is logged |

[S7: the table above is replaced by Acceptance sections A3 to A7. The `via` key is dropped (no server change, Q67); the prompt card is the D31 details card; the first name of New email is not resolved (Q70).]

Fallback for the prompt card, if a compose callback cannot return a notification (S7 step 6) [S7 result 5: a notification works; fallback not needed]: the footer button becomes "Check" (plain action). It validates and replaces the card with a short confirm card "Create email" whose compose action carries the values in its parameters (max 20 values of 500 characters; values never logged).

## 4. Side-panel home card and one code path

Options for knowing the open message:

1. Homepage only. `onHomepage` has no `messageId` [A36], so the panel offers only "New email". Fails D27 for replies.
2. Add `addOns.gmail.contextualTriggers: [{ "unconditional": {}, "onTriggerFunction": "onMessageOpen" }]`. Gmail calls `onMessageOpen` when the user opens a message with the panel open; the event carries `gmail.messageId` [A35], [A13]. The panel offers "Reply". Cost: one manifest entry and one entry function that calls the same `homeFlow`. Each message switch with the panel open is one execution; the home view comes from the User Cache `view:*`, so it adds no server call on a hit.

Decision: option 2, if S7 shows no consent prompt. A prompt that names a new scope stops option 2 until the owner approves; the panel then ships option 1 ("New email" only). [S7 result 2: `onMessageOpen` runs and carries the message ID; no prompt in the owner's session. The fresh-consent run stays open (Q55).]

Card content [S7: the first lines below are not built; the hint changes; Acceptance section A2]:

| Panel state | Detected by | Card |
|---|---|---|
| No message open | no `draftMetadata`, no `gmail.messageId` | Home card; line under the header: "Start a new email from a template."; rows with "New email"; footer hint (d) |
| Message open | no `draftMetadata`, `gmail.messageId` present | Home card; line: "Reply to this email with a template, or start a new one."; rows with "Reply"; preview adds "Reply all", "New email"; footer hint (d) |
| Compose toolbar | `draftMetadata` present | Home card as today; rows with "Insert" or "Review" |

One code path:

- `entryOf(event)` in src/addon/event.ts, the only place that decides: `compose` when `draftMetadata` is present, `message` when `gmail.messageId` is present, else `inbox`. Every callback re-derives it from its own event; it never travels in card parameters.
- `homeFlow`, `searchFlow`, `folderFlow`, `previewFlow`, favorites and Recent stay one set. They build rows through one function `rowButton(template, entry)` and the preview through `insertButtons(template, entry, draft)`. Those two functions, the header line and the footer hint are the only places that read `entry`.
- `insertFlow` and `promptInsertFlow` produce one `Rendered` value (html, subject decision, recipient lists). The renderer's last step is `insert` (compose) or `compose` (panel: `createDraft`, `createDraftReply`, `createDraftReplyAll`). The `compose` reply kind and the `setComposeAction` button flag live in src/addon/cards/render.ts, the only Card Service adapter.
- The cached view `view:*` stays entry-free data; it is shared by both entry points.

Built so far (slice 10, review PASS, dev-e2eb0ae; layout slice 12; verified in src at 6374b7b):
- `entryOf(event)` and `messageIdOf(event)` in src/addon/event.ts: `compose` when `draftMetadata` is present, else `message` when `gmail.messageId` (or the deprecated `messageMetadata.messageId`) is a non-blank string, else `inbox`. `Ports.entry` comes from each callback's own event.
- `onMessageOpen` entry function and the manifest contextual trigger. Not yet observed on Gmail (S7 step 3).
- In `inbox` and `message`, `templateItem`, `folderCard`, `homeCard`, `searchCard` and `previewCard` show no Insert buttons; `sidePanelHint(entry)` (src/addon/cards/sidePanel.ts) ends home, folder, search and preview cards. Today `rowButton(template)` takes no entry; the panel pass adds it as designed above.
- `ButtonSpec.compose` (`STANDALONE_DRAFT`, `REPLY_AS_DRAFT`) and its `setComposeAction` call in render.ts, unused outside the S7 harness.
- Since slice 12 the home, search and state cards have no header, so the "line under the header" above becomes the first line of the card when the panel pass builds it.
- The S7 harness (src/addon/spikeS7.ts, dev build, side panel only) calls `createDraft`, `createDraftReply`, `createDraftReplyAll` with fixed test addresses and returns `setGmailDraft`. It stays until S7 runs.

## 5. Gmail signature

| Option | Mechanism | Scope | Cost |
|---|---|---|---|
| 1. Leave it out, say so | Panel preview card and quick start: "Your Gmail signature is not added. Use the signature button in the draft." | none | Text only |
| 2. Read the signature and append it | Gmail API `users.settings.sendAs.get` returns the signature; it needs `gmail.settings.basic`, `gmail.readonly`, `gmail.modify` or `mail.google.com` [A38]. `gmail.settings.basic` and `gmail.readonly` are Restricted [A16] | new restricted scope, owner approval needed | About half a day, plus a restricted scope on every user's consent screen |
| 3. Signature from the template library | v2 signature items (spec 5.4 reserved fields) | none | Out of v1 scope (BRIEF 1) |

Decision: option 1. Restricted scopes break least privilege for a line the user adds with one click. S7 records whether Gmail adds the default signature on its own when the compose window opens; if it does, the card line is dropped. [S7 result 4: Gmail adds it to replies only. Option 1 stays for New email; Acceptance section A5.]

## 6. Mobile

Out of scope (D22): the side panel and compose actions on Gmail Android and iOS are untested and unsupported; the panel cards render whatever Gmail mobile shows.

## Note 2026-11-11: one-click insert (D31), decision unchanged

D31 makes the compose toolbar insert in one click (ADR-0009, ADR-0004 and ADR-0006 Amendments 2026-11-11). Panel rows keep their built behavior until spike S7. After S7 the panel follows the same rules through compose actions: the row button ("New email", "Reply") removes blank fields with the cleanup rules of ADR-0004 Amendment 2026-11-11 and checks `rc`; the row tap opens the details card, whose footer button carries the compose action and reads the inputs from the event (S7 records whether a compose-action callback gets form inputs). Section 3's blank-field notification and "Check" fallback are then not needed.

## Acceptance 2026-11-11 (spike S7) and the slice 18 design

Owner, 2026-11-11: "do we have a plan to have same functionality for the app's sidebar? its actually way easier to insert from there since the popup blocks the screen and cant really interact with gmail while sidebar allows to do that easily". Answer: yes, slice 18 (spec 13.11). Facts: docs/spikes/slice-10-s7.md. Built today (src at the PLAN commit "Spike S7 passed"): `entryOf`, `onMessageOpen`, panel cards without Insert, `sidePanelHint`, `ButtonSpec.compose`, the S7 harness.

### A1. Q40 to Q46 against the S7 results

| Q | Default before S7 | S7 result | Decision |
|---|---|---|---|
| Q40 contextual trigger | yes if no prompt | 2: card reloads, message ID present, no prompt | Kept (built). Fresh consent stays open by hand (Q55); a prompt naming a scope outside the 10 stops slice 18 |
| Q41 signature | not added, card says so | 4: in the reply, not in the new email | No scope. Reply: Gmail adds it. New email: one card line and one quick start line (A5) |
| Q42 row button with a message open | "Reply" | 2: Reply works | "Reply" on the row; "Reply all" and "New email" on the details card (A2) |
| Q43 a discarded draft counts | yes | 7: a closed draft stays in Drafts | Yes: one `template.apply` event per created draft, buffered before the draft exists (A6) |
| Q44 `mail.google.com` | never | 1 to 3: drafts made under the 10 scopes | Never. Not needed |
| Q45 Reply all Cc | merged list | 3: `options.cc` adds | Pass only the template's new Cc and Bcc; Gmail keeps the conversation's (A4) |
| Q46 forward | not in v1 | not tested | Not in v1: `ComposedEmailType` has no forward type [A31] |

### A2. Rows and cards

A `DecoratedText` row holds one button and one `onClick` [A43]. The row button is the one-click action; the row tap opens the details card, as in compose (ADR-0009 section 1).

| Entry | Row button (`FILLED` slate) | Screen reader | Compose type |
|---|---|---|---|
| `inbox` | "New email" | "New email from <title>" | `STANDALONE_DRAFT` |
| `message` | "Reply" | "Reply with <title>" | `REPLY_AS_DRAFT` |
| `compose` | "Insert" (unchanged) | "Insert <title>" | none |

Options for the 3 actions of the details card with a message open (a `FixedFooter` holds 2 buttons [A40]):
1. Footer primary "Reply", secondary "Reply all"; a last section with the buttons "New email" and "Edit in library" (`OUTLINED`). The two answers to the open email stay on screen without scrolling.
2. Footer primary "Reply", secondary "Edit in library" (as compose); "Reply all" and "New email" in a last section. Keeps "Edit in library" in one place on every card; "Reply all" then needs a scroll on a long card.

Decision: option 1. "Reply all" is an answer to the email the user reads; "Edit in library" is for editors only and rare. With no message open the footer is primary "New email", secondary "Edit in library" (edit level), as compose.

Details card in the panel = the compose details card (ADR-0009 section 2) with these differences:
- Opened by `template.apply` `followUp: true` for every entry (no apply event, no first-name lookup). `panelPreview` and its `template.getBody` call go away.
- Fields section: the same inputs `p-1` to `p-20`. Hint of the implicit recipient first name: `message` "Leave blank to use the first name of the person you reply to, when known."; `inbox` no hint.
- No "Replace the subject" switch (A3).
- Recipients section: lines for an empty draft (`recipientPlan(lists, NO_DRAFT)`, as built); "Add recipients" switch (`rcpt`, on) when the plan adds one; no finish-typing line (the email is new). With a message open and a template To: the line "A reply goes to the sender, so the template's To is not added. New email adds it."
- Signature line before the text preview (A5).
- No change line: the panel cannot re-render a card from a compose action (A8).
- The hint is the last section (A9).

### A3. Rendering: one pipeline, two outputs

Same as compose (spec 7.4): `template.apply`, then `renderBody` and `renderSubject` with the D31 rule (typed value, else variable value, else default text, else removed with the 4 gap rules), sender variables from the apply result, the server's sanitized body, the escaping of values. Only the last step differs: a `GmailDraft` and a `ComposeActionResponse` in place of an `UpdateDraftActionResponse`.

Subject. Options: (1) the compose switch "Replace the subject" on the panel card too; (2) no switch: New email always gets the rendered template subject, Reply and Reply all never get a `subject` option. Decision: option 2. The switch exists because a compose draft may already hold a subject (D24). A panel draft never does: a new email starts empty, and a reply's "Re: ..." keeps it in its conversation (S5, S7 result 2). The user edits the subject in the compose window that opens. An empty rendered subject passes "" to `createDraft`.

Recipient first name. The value goes to the server only as `recipientEmailIfInternal` of `template.apply`, and only when its domain equals the caller's (the `internalRecipient` rule; the server checks `DOMAIN` again). An outside address never leaves the add-on.
- Reply: the address the reply goes to: `getReplyTo()` of the open message when not blank, else `getFrom()` (Gmail replies "using the reply-to address" [A33]). The address is the part inside `<...>`, trimmed, lower case.
- Reply all: "" (several recipients, as a compose draft with several To).
- New email: "". Options: (1) "" ; (2) a second apply call once the template's To is known; (3) carry the template To in the card. Decision: option 1. Option 2 doubles the server calls of every click; option 3 puts an address in card parameters, which ADR-0006 rules out. A compose draft with only the template's To resolves no name either (the event's To is empty at insert time). Q70.

Order inside a callback: read the message (Reply), then `template.apply`, then render, then the Gmail call. A message that cannot be read fails before a use is counted.

### A4. Recipients

One function as compose: `recipientPlan(lists, draft)` against a computed draft; blocked addresses are never in `lists` (server filter, `recipientsExternal`).

| Action | Computed draft | To | Cc, Bcc |
|---|---|---|---|
| New email | `{to: [], cc: [], bcc: []}` | template To, comma-joined, as `createDraft`'s `recipient` | `options.cc`, `options.bcc`: template Cc, Bcc |
| Reply | `{to: [reply address], cc: [], bcc: []}` | Gmail sets it; template To "not added" (To filled) | template Cc, Bcc minus addresses already present |
| Reply all | `{to: [reply address, every address of getTo() and getCc()], cc: [], bcc: []}` | Gmail sets To and Cc; template To not added | template Cc, Bcc minus present; Gmail adds them to its list (S7 result 3) |

"Present" is the plan's existing check (trimmed, lower case, part inside `<...>`). Addresses come from the header strings by one regex per string (`[^\s<>,;"]+@[^\s<>,;"]+`); a display name with a comma does not split an address. The user's own address is not removed: a template Cc equal to it is not added on Reply all (Q73). `options.cc` and `options.bcc` are present only when non-empty. "Add recipients" off: no `recipient`, no `cc`, no `bcc`.

Row count check: the row carries `rc` as compose. Different counts: options (1) push the details card as compose does; (2) a notification and no draft. Whether a compose-action callback may return navigation is unverified (S7 tested a notification only). Decision: option 2, text "The recipients of this template changed. Tap its name to see them.", and the view cache is cleared so the next card shows the new counts (Q72).

### A5. Signature

S7 result 4: Gmail puts the default signature into a reply draft and not into a `createDraft` draft. Options: (1) say so on the card and in the quick start; (2) read the signature (`users.settings.sendAs`, restricted `gmail.settings.basic` [A38]) and append it to New email. Decision: option 1, no scope. Details card line, both panel entries (New email is on both cards): 'Gmail adds your signature to replies only. In a new email, use "Insert signature" in its toolbar.' Quick start: the same two sentences. Its position in the reply (above or below the template text) is recorded in smoke part J step 7.

### A6. Use counting, audit, logs

- One `template.apply` without `followUp` per press of a panel action button: one apply event, buffered before the Gmail call. Opening the details card sends `followUp: true` (no event, Q61). A draft the user closes or discards still counts (Q43). A press refused after the apply (version or list change, Gmail failure) also counts once; a press refused before it (unreadable message, a box over 500 characters, no message ID) counts nothing.
- No `counted` parameter in the panel: the panel never re-renders a details card after a press.
- DENIED: the server writes one denied audit row, as today. VALIDATION and NOT_FOUND write none.
- Logs. Options: (1) the `via` key of section 3 (`compose`, `new`, `reply`, `replyAll`): a change in src/shared/model/protocol.ts and the server's 5-key check; (2) no new key: `draft.fields` already names `draftMetadata` on compose calls and `messageId` on panel calls with a message open. Decision: option 2. Nothing reads the panel action from logs; usage counts per template. No server change (Q67). `draftInfo(event)` stays as is: panel calls send counts 0 and `hasSubject` false. No address, subject, body, field value, message ID or token in any log line; the server arguments of a panel call are `id`, `knownVersion` and `recipientEmailIfInternal` or `followUp`.

### A7. Scopes, per action (none new)

| Step | Call | Scope |
|---|---|---|
| Any callback | Gmail runs the add-on | `gmail.addons.execute` |
| Caller identity | `Session.getActiveUser().getEmail()` | `userinfo.email` |
| `template.apply` | `UrlFetchApp` to the project's `/exec` with `ScriptApp.getOAuthToken()` | `script.external_request`; the token carries `drive.file` and `script.projects.readonly` for the front door (spec 9) |
| Token | `GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken)` | the event token, minted for the 2 Gmail add-on scopes below |
| Reply, Reply all | `GmailApp.getMessageById(e.gmail.messageId)`, then `getReplyTo()`, `getFrom()`; Reply all also `getTo()`, `getCc()` | `gmail.addons.current.message.metadata` [A34] |
| New email | `GmailApp.createDraft(to, subject, "", options)` | `gmail.addons.current.action.compose` |
| Reply | `message.createDraftReply("", options)` | `gmail.addons.current.action.compose` |
| Reply all | `message.createDraftReplyAll("", options)` | `gmail.addons.current.action.compose` |
| Return | `CardService.newComposeActionResponseBuilder().setGmailDraft(draft).build()` | none |

Verified: the harness (src/addon/spikeS7.ts at dev-56bf795, 10 scopes) called `setCurrentMessageAccessToken`, `createDraft`, `getMessageById`, `createDraftReply`, `createDraftReplyAll` with no prompt. Not exercised by the harness: `getFrom`, `getReplyTo`, `getTo`, `getCc` (header reads of the same message; `getFrom` documented on the metadata scope [A34]); smoke part J steps 7 and 9. A prompt or a `mail.google.com` error there stops the reply first name and the Reply all present check: both then fall back to "" and "nothing present" (owner informed; no scope added).

### A8. Errors and states

A compose-action callback answers with a draft or a notification (S7 result 5). No state card, no navigation.

| Case | Detected | Answer | Draft | Counted |
|---|---|---|---|---|
| QUOTA | apply fails `QUOTA` | "Service is busy. Try again in a minute." | none | no |
| BUSY | `BUSY` | "The library is busy. Try again in a few seconds. Request ID <id>" | none | no |
| Access lost between list and press | `DENIED` | the server's DENIED text ("You don't have access to this template. Ask a folder manager." or the personal templates text); view cache cleared | none | no; one denied audit row |
| Template deleted or moved | `NOT_FOUND` | "This template was deleted or moved. Open the panel again to update the list."; view cache cleared | none | no |
| TIMEOUT, NETWORK, SERVER | other codes | "Something went wrong. Try again. Request ID <id>" (NETWORK adds "Details for your admin: <message>") | none | no |
| Not set up, account | `NOT_CONFIGURED`, `AUTH_*` | the state card lines of today, joined | none | no |
| Message can no longer be read (deleted, moved, other account) | `getMessageById` or a header read throws, or returns null | "This email can no longer be read. Open it again, or use New email." | none | no |
| Reply pressed without a message ID in the event | `messageIdOf(event)` = "" | "Open the email you want to answer, then press Reply again." | none | no |
| A box over 500 characters | details press, before any call | "Each box takes up to 500 characters. Shorten the long one and try again." | none | no |
| New template version since the card opened | apply version differs from the card `version` | "This template changed. Go back and open it again." | none | yes |
| Other recipient lists than the card showed | `rh` differs | "The recipients of this template changed. Go back and open it again." | none | yes |
| Row counts differ | `rc` differs from the lists | A4 text; view cache cleared | none | yes |
| Gmail refuses the draft | `createDraft*` throws | "Something went wrong. Try again." plus "Details for your admin: <error message>" | none | yes |
| Failure after the draft exists | throw after `createDraft*` returned | "The email is in your Drafts, but Gmail could not open it. Open Drafts to find it." | in Drafts | yes |

Every panel action callback runs inside one catch (the `s7Visible` pattern, kept under a plain name) so no failure is silent; the catch tracks whether a draft was created. The error message goes on the user's own screen and into no log.

Two quick presses. Options: (1) no guard: each press is a callback, Gmail may open two drafts and two uses count; (2) a User Cache key per template and action for 5 s that refuses the second press. Option 2 also refuses a wanted second email and adds a cache write to every press. Decision: option 1; smoke part J step 10 records what Gmail does (Q69).

### A9. What the side panel cannot do, and what it says

It cannot write into a draft or reply that is already open: Gmail gives a side-panel callback no handle on it, and an `UpdateDraftActionResponse` from the panel does nothing (S6 runs, ADR section 1). Every panel button creates a new draft; S7 result 6 shows an open window keeps its text. Forward is not offered (Q46).

The hint, the last section of the home, folder, search and details cards in `inbox` and `message`, becomes: "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar." The planned first lines ("Start a new email from a template.", "Reply to this email with a template, or start a new one.") are not built: the button labels say it.

### A10. Harness removal

Slice 18 deletes src/addon/spikeS7.ts and its tests, `onS7Card`, `onS7Compose`, `onS7Notify` (src/addon/entry.ts and `CALLBACKS`), the `s7Sections` call in home.ts, the Reply kinds `s7` and `s7Error` (replaced by one kind `compose` that carries the draft), and the smoke section "Spike S7" (replaced by a pointer to docs/spikes/slice-10-s7.md). The manifest does not change: same 10 scopes, same triggers.

### Consequences of the acceptance

- Easier: the panel inserts with one press, beside the open email, which the modal compose card cannot.
- Harder: two kinds of insert to explain (into an open draft, or a new draft). The hint and the quick start carry it.
- Unverified until the slice 18 smoke: compose actions on a row button and a footer button (Q74), form inputs in a compose callback (Q68), the header reads (A7). Each has a named fallback.

## Decision summary

[S7: superseded in part by "Acceptance 2026-11-11": no `via`, no first line, new hint text, signature added by Gmail to replies.]

- Side panel: "New email" (`STANDALONE_DRAFT`, `GmailApp.createDraft`) always; "Reply" and "Reply all" (`REPLY_AS_DRAFT`, `createDraftReply`, `createDraftReplyAll`) when a message is open, through a new `unconditional` contextual trigger; hint line to the compose toolbar.
- One apply pipeline with two outputs; `entryOf(event)` decides the entry in one place.
- Scopes: none new. `gmail.addons.current.action.compose` and `gmail.addons.current.message.metadata` cover the documented add-on paths [A29], [A34]. Spike S7 checks for a prompt; any new scope stops the feature until the owner approves.
- Signature: not added; the card says so.
- Spike S7 (spec 14.2) runs first in the Gmail panel pass.

## Consequences

- Easier: both entry points work, and the silent-failure defect disappears. Lists, search, favorites, preview, prompts, D24 and D26 stay one implementation.
- Harder: one more manifest entry (contextual trigger) and one more entry function. A panel draft is created before the user sees it in the compose window; a discarded draft is the user's to delete (Gmail Drafts).
- Harder: users learn two behaviors: the toolbar inserts at the cursor, the panel starts an email. The cards and the quick start state it.
- Revisit if Google ships a way to edit an open draft from the side panel, or if S7 shows a `mail.google.com` demand (then option (c) or the hint alone, owner decides).

## Open questions

- Q40 to Q46 in spec section 15, resolved in Acceptance section A1. New: Q67 to Q74.

## Sources

Read 2026-11-10:

- [A13] https://developers.google.com/workspace/add-ons/concepts/event-objects (`gmail.messageId`, `gmail.threadId`, `gmail.accessToken`; `messageMetadata.*` deprecated; per-trigger presence not stated).
- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui (compose UI extension, `UpdateDraftActionResponse`).
- [A16] https://developers.google.com/workspace/gmail/api/auth/scopes (`action.compose` non-sensitive; `message.metadata`, `message.readonly` sensitive; `gmail.settings.basic`, `gmail.readonly`, `gmail.compose` restricted).
- [A29] https://developers.google.com/workspace/add-ons/gmail/compose (compose actions, `setComposeAction`, `REPLY_AS_DRAFT` sample, `setCurrentMessageAccessToken`, `createDraftReply`, `ComposeActionResponseBuilder().setGmailDraft`, scope `action.compose`).
- [A30] https://developers.google.com/apps-script/reference/card-service/compose-action-response-builder (`setGmailDraft`, `build`; unrelated to the compose UI extension).
- [A31] https://developers.google.com/apps-script/reference/card-service/composed-email-type (`REPLY_AS_DRAFT` default, `STANDALONE_DRAFT`).
- [A32] https://developers.google.com/apps-script/reference/gmail/gmail-app (`createDraft` options, `setCurrentMessageAccessToken`, `getMessageById`; Authorization lists `mail.google.com`; no signature text).
- [A33] https://developers.google.com/apps-script/reference/gmail/gmail-message (`createDraftReply`, `createDraftReplyAll` options incl. `subject` up to 250 characters; Authorization lists `mail.google.com`).
- [A34] https://developers.google.com/workspace/add-ons/concepts/workspace-scopes (`action.compose` "temporarily create new drafts messages and replies"; `getMessageById` and `getFrom` sample needs only `message.metadata`).
- [A35] https://developers.google.com/workspace/add-ons/gmail/extending-message-ui (`unconditional` contextual trigger, `e.gmail.messageId`; content sample needs `message.readonly`).
- [A36] https://developers.google.com/workspace/add-ons/concepts/homepages (homepage shows without an open message or draft; homepage events carry no contextual information).
- [A37] https://developers.google.com/apps-script/manifest/gmail-addons (`contextualTriggers`, `unconditional`, `onTriggerFunction`; no scope named; `draftAccess` `METADATA` needs `message.metadata`).
- [A38] https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/get (scopes `gmail.settings.basic`, `mail.google.com`, `gmail.modify`, `gmail.readonly`).
- [A39] https://developers.google.com/apps-script/reference/card-service (class list; no clipboard class).
