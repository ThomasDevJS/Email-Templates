# ADR-0007: Insert from the Gmail side panel (D27)

Status: Proposed (2026-11-10). Owner decision D27 sets the requirement; this ADR sets the mechanism.
Date: 2026-11-10
Deciders: owner (thomas@migway.com), architect

## Context

D27 (owner, 2026-11-10): "the sidebar must be identical in terms of functionality to how you insert a template from the email compose dialog, so both the sidebar and the compose dialog can be used."

The add-on has two entry points in one manifest (ADR-0001):

| Entry point | Manifest | Event (owner's Gmail runs, 2026-11-10) | Draft responses |
|---|---|---|---|
| Compose toolbar | `addOns.gmail.composeTrigger`, `draftAccess: METADATA`, function `onComposeOpen` | `draftMetadata` with To, Cc, Bcc, `subject`; never `threadId` or `messageId` (smoke "Slice 5b") | `UpdateDraftActionResponse` works: body and subject in one response (spike S5, dev-32a446c) |
| Gmail right side panel | `addOns.common.homepageTrigger`, function `onHomepage` | `gmail` (only `accessToken`), `commonEventObject`, `clientPlatform`, `parameters`, `messageMetadata`, `formInputs`, `hostApp`, `formInput`; no `draftMetadata` (spike S6 runs, dev-c1c7f16, dev-ec0ccb2) | every `UpdateDraftActionResponse` does nothing and shows no error |

Today both entry points render the same home card (`homeFlow`). In the side panel its Insert buttons fail silently. That is a live defect (PLAN log 2026-11-10).

The manifest has no `addOns.gmail.contextualTriggers` entry. The 10 scopes (spec 9) include `gmail.addons.current.action.compose` and `gmail.addons.current.message.metadata`. `https://mail.google.com/` is banned by the build (ADR-0005).

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
| (d) Hint to the compose toolbar | One line on the side-panel card: "Writing an email? Open Migway Templates from the toolbar at the bottom of the draft to insert at the cursor." | No by itself: the side panel inserts nothing | 1 h | None |

Recommendation: (a), (b) and (d) together. (c) is not built in v1; it becomes the fallback only if S7 fails both (a) and (b).

Row button in the side panel (one slot per row, as in compose):

| Panel state | Row button | Preview card buttons |
|---|---|---|
| No message open | "New email" | "New email" |
| Message open | "Reply" | "Reply", "Reply all", "New email" |

The rules of the compose path decide one-click or a card: a template with prompts opens the prompt card; a template with recipients shows "Review" and opens the preview card (D26); otherwise the row button creates the draft in one click.

Where the two entry points differ, in user words (card text in spec 7.2, quick start in the Gmail panel pass):

1. The side panel starts a new email or a reply. It cannot change an email you are already writing. For that, open Migway Templates from the toolbar at the bottom of the draft.
2. The side panel fills the whole body of the new email. The toolbar inserts at your cursor.
3. A reply from the side panel keeps "Re:" and the subject of the conversation. The template subject is not used, so the reply stays in its conversation.
4. Your Gmail signature is not added by the side panel (until S7 shows otherwise). Use the signature button in the draft.

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

Fallback for the prompt card, if a compose callback cannot return a notification (S7 step 6): the footer button becomes "Check" (plain action). It validates and replaces the card with a short confirm card "Create email" whose compose action carries the values in its parameters (max 20 values of 500 characters; values never logged).

## 4. Side-panel home card and one code path

Options for knowing the open message:

1. Homepage only. `onHomepage` has no `messageId` [A36], so the panel offers only "New email". Fails D27 for replies.
2. Add `addOns.gmail.contextualTriggers: [{ "unconditional": {}, "onTriggerFunction": "onMessageOpen" }]`. Gmail calls `onMessageOpen` when the user opens a message with the panel open; the event carries `gmail.messageId` [A35], [A13]. The panel offers "Reply". Cost: one manifest entry and one entry function that calls the same `homeFlow`. Each message switch with the panel open is one execution; the home view comes from the User Cache `view:*`, so it adds no server call on a hit.

Decision: option 2, if S7 shows no consent prompt. A prompt that names a new scope stops option 2 until the owner approves; the panel then ships option 1 ("New email" only).

Card content:

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

## 5. Gmail signature

| Option | Mechanism | Scope | Cost |
|---|---|---|---|
| 1. Leave it out, say so | Panel preview card and quick start: "Your Gmail signature is not added. Use the signature button in the draft." | none | Text only |
| 2. Read the signature and append it | Gmail API `users.settings.sendAs.get` returns the signature; it needs `gmail.settings.basic`, `gmail.readonly`, `gmail.modify` or `mail.google.com` [A38]. `gmail.settings.basic` and `gmail.readonly` are Restricted [A16] | new restricted scope, owner approval needed | About half a day, plus a restricted scope on every user's consent screen |
| 3. Signature from the template library | v2 signature items (spec 5.4 reserved fields) | none | Out of v1 scope (BRIEF 1) |

Decision: option 1. Restricted scopes break least privilege for a line the user adds with one click. S7 records whether Gmail adds the default signature on its own when the compose window opens; if it does, the card line is dropped.

## 6. Mobile

Out of scope (D22): the side panel and compose actions on Gmail Android and iOS are untested and unsupported; the panel cards render whatever Gmail mobile shows.

## Decision summary

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

- Q40 to Q45 in spec section 15.

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
