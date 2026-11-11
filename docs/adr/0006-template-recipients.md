# ADR-0006: Template recipients (To, Cc, Bcc)

Status: Accepted 2026-11-11 (spike S6 passed on Gmail web from the compose toolbar, dev-ec0ccb2; built in slice 9, review PASS on 08955ca; editor fields in slice 8b). Was Proposed 2026-11-10. Owner decision D26 and its update of 2026-11-10 set the feature; this ADR sets the mechanism. Amendment 2026-11-10 (D29): the switch moves to an in-app admin setting, built in slice 11. Amendment 2026-11-11 (D31, Accepted 2026-11-11, built in slice 15; the notice point of Q77 stays Proposed): one-click insert also for templates with recipients; the disclosure moves from a card before the insert to the row hint before it and the draft's own fields after it.
Date: 2026-11-10, accepted 2026-11-11
Deciders: owner (thomas@migway.com), architect

## Context

D26 (owner, 2026-11-10): a template holds fixed addresses for To, Cc and Bcc. Insert adds them to the draft and never removes an address already there. Use case: company templates that users insert and cannot edit, for example a recruiter's "driver leaving" template that adds `safety@migway.com` to Cc. Update of D26 (owner, 2026-11-10): addresses outside the Workspace domain are allowed by default; admins need a way to turn them off.

Facts from the owner's Gmail runs:
- One `UpdateDraftActionResponse` carried body and subject actions with no new scope (spike S5, dev-32a446c).
- The compose event carries `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients` and `subject`, never `threadId` or `messageId` (smoke "Slice 5b", dev-4a233d4). The add-on reads them at Insert time (src/addon/event.ts `draftInfo`, `draftHasSubject`, and since slice 9 `draftRecipients`).
- The compose card is modal on Gmail web (spec 13.4). The user cannot edit the draft while the card is open, so the recipient lists of the Insert callback event are the lists the insert lands on.

Scope: no new OAuth scope. Reading Cc and Bcc uses `draftAccess: METADATA` and `gmail.addons.current.message.metadata`, already in the manifest (D10). Writing uses `gmail.addons.current.action.compose`, already in the manifest. Spike S6 confirms; a permission prompt in S6 stops the feature until the owner approves (no manifest change without approval).

### Platform facts (Google documentation, read 2026-11-10)

| Fact | Source | Settled |
|---|---|---|
| `UpdateDraftActionResponseBuilder` has `setUpdateDraftToRecipientsAction`, `setUpdateDraftCcRecipientsAction`, `setUpdateDraftBccRecipientsAction`, next to the body and subject setters. Each setter returns the builder "for chaining". `build()` throws "if the constructed UpdateDraftActionResponse isn't valid" and does not define invalid | [A15] | yes |
| `CardService.newUpdateDraftToRecipientsAction().addUpdateToRecipients(String[])`; Cc: `addUpdateCcRecipients(String[])`; Bcc: `addUpdateBccRecipients(String[])`. Class text: "Updates the To recipients of an email draft". Parameter text: "The To recipients to insert to the email draft" | [A25], [A26], [A27] | yes |
| Whether the actions add to the field or replace it | none of [A14], [A15], [A25] to [A28] says | yes, S6 step 2: an action replaces the field |
| Whether 5 actions (body, subject, To, Cc, Bcc) combine in one response | [A15] says chaining only; S5 verified body plus subject | yes, S6 step 1: all 5 applied, the Bcc line opened. Step 4: a response with only a recipient action works too |
| Scope for the recipient actions | the compose guide asks for scopes "required for compose actions" and names none per action [A14] | no prompt in the owner's runs; the fresh-consent step 7 is still open (spec Q55) |
| Limits: count per action, address format accepted, display names | none stated on any page | unverified |
| Behavior in a reply or forward draft, and with an address already present | not stated | yes, S6 steps 3, 5, 6: draft list plus new keeps every address once; reply keeps its To; forward To filled |
| Format of the event lists | not stated | yes, S6 step 8: JSON arrays of bare addresses in `draftMetadata`, empty when the field is empty; `gmail` repeats only non-empty lists |
| Mobile behavior | not stated | best effort, untested (D22) |
| The compose guide's Cc and Bcc examples call `addUpdateToRecipients` on Cc and Bcc action objects, and its callback names differ from the button handlers | [A14] | documentation error; the class pages [A26], [A27] name `addUpdateCcRecipients`, `addUpdateBccRecipients` |
| The newer add-ons response service builder also has `setSendStatus`, "whether or not the email sends after the update action" | [A28] | yes. The build never calls it; Insert never sends mail |
| Google's compose guide: "an add-on can't silently add email recipients" to a file's viewers; add-ons inform users of such changes | [A14] | yes, guidance for the disclosure rule below |

## Options and decisions

### 1. Data model

Options:
1. Three arrays on the item: `to`, `cc`, `bcc`. Same names in each version file and in export `meta`. No clash with reserved names: spec 5.4 reserves `scope, targets, priority, variants, sendAs, lockedFields, userEditableFields, approvalRequired, schedule`; spec 5.3 has none of the three.
2. One object `recipients: { to, cc, bcc }`. One key, but a nested shape for the shape check, the diff in audit and the browser filter.

Decision: option 1. Mechanism: `to`, `cc`, `bcc` are string arrays, default `[]`. A record without them (every item and version file before slice 9, every backup) reads as `[]`, so no migration; the shared shape check (spec 16.1) accepts a missing field and refuses a present non-array.

Limits (recommended, Q33): 10 addresses per field, 20 over the three, 254 characters per address (`PRINCIPAL_KEY_MAX`, the email address limit), local part 1 to 64. Index growth: about 50 KB at 1,000 items with 2 addresses each.

Normalization at every write: trim, lower case the whole address, drop exact duplicates inside one field (silent, no error). An address in two fields is an error (`RCPT_DUPLICATE`): the author decides which field it belongs in. Order is kept as typed.

### 2. Validation at save

Every write validates: create, update, duplicate, restore, import (as for the subject, spec 5.6). `template.move` writes no content and does not re-validate.

Syntax options:
1. Full RFC 5322 (quoted local parts, comments, IP literals, display names). Large parser, cases no template needs.
2. Plain `local@domain`: after lower casing, `^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$`, no label starting or ending with `-`, no `..`. No display names, no Unicode domains in v1.

Decision: option 2. One function `validateRecipients(fields, policy)` in src/shared, run by the server on every write and by the editor for inline hints. The server result is authoritative.

Outside addresses (D26 update): any valid address is accepted by default. "Outside" means the domain part differs from Script Property `DOMAIN` (exact match, case-insensitive; subdomains count as outside). Secondary domains and aliases: Q36.

Switch that restricts recipients to the domain. Options:
1. (a) Script Property `RECIPIENTS_EXTERNAL`, `allow` (default, also when unset) or `deny`. The owner sets it in the script editor; the Config tab shows it read only. Cost: one key in the existing Properties read (0 extra calls), one Config row, about 1 h of build. Risk: the change is not in the audit log; only the owner and script editors can make it (script editors can already read and write every property, ADR-0003 pitfall).
2. (b) Admin-only setting in the Config tab: new op `config.setRecipientsExternal` (admin), a policy row, an audit event with before and after, a form control, role matrix and policy tests. Cost: about half a day of build and review; every admin can change it without the owner; the change is audited.

Decision: (a) for v1, (b) as a v1.1 item (Q32). [Superseded 2026-11-10 by D29: the switch is the admin setting `recipientsExternal` in `index.json`, changed with `config.set`; see Amendment 2026-11-10 (D29) and ADR-0008.] No reason against (a) found: admins in v1 cannot change other Script Properties either (`ADMIN_GROUP`, `IMG_HOSTS` are owner-set), and an unset key keeps the owner's default `allow`.

With `deny`:
- A write that stores an outside address answers VALIDATION `RCPT_EXTERNAL`.
- Templates that already hold outside addresses stay stored unchanged. `template.apply` and `template.getBody` return only the inside addresses in `to`, `cc`, `bcc` and list the outside ones in `blocked`; the add-on adds only the returned lists, and the cards say "Not added: <address>. Outside migway.com, turned off by your admin.". The editor shows the problem at load and refuses the next save until the author removes them. Restore of a version holding outside addresses and duplicate of such a template answer `RCPT_EXTERNAL`.
- The server decides. The add-on never sees a blocked address in the lists it inserts.

Error codes (spec 7.1 holds the texts). Each carries `field` (`to`, `cc`, `bcc`) and the address position (1-based):
`RCPT_FORMAT`, `RCPT_TOO_LONG`, `RCPT_TOO_MANY` (per field or total), `RCPT_DUPLICATE`, `RCPT_EXTERNAL`.

Import options for an address that fails:
1. Refuse the whole file ("Nothing was imported"). Safe, but one bad address blocks 200 templates.
2. Skip the template. Loses its body for one address.
3. Drop the address, import the template, report it per template.

Decision: option 3 for `RCPT_FORMAT`, `RCPT_TOO_LONG` and (with `deny`) `RCPT_EXTERNAL`; an address in two fields keeps the first of To, Cc, Bcc; `RCPT_TOO_MANY` refuses the whole file, like `SUBJ_TOO_LONG`. The report names the template and the count, never the address in a log line. With `allow`, outside addresses import unchanged.

### 3. Placeholders in recipient fields

Options:
1. None in v1. Fields hold literal addresses.
2. A small set: `{{sender.email}}`, `{{ask:Address}}`.

Decision: option 1 (Q34). Reasons: a placeholder resolves in the add-on at Insert, after the server's save validation, so the server could no longer guarantee the syntax and the `deny` rule; `{{ask:Address}}` equals typing the address in Gmail; no v1 use case needs a variable address. A `{` in an address fails `RCPT_FORMAT`.

### 4. Insert rule

Rules, one pure function `recipientActions(template, draft, choice)` in src/addon/cards (the one place, like `replacesSubject`):
- Add, never remove. An address already in any of the draft's To, Cc or Bcc (compared lower case, the part inside `<...>` when present) is skipped.
- A field with nothing new to add sends no action.
- `blocked` addresses are never added.

To in a reply. Options:
1. Always add template To addresses. A reply to an external driver gains `payroll@migway.com` in To; the quoted conversation goes to a new main recipient.
2. Add Cc and Bcc always; add To only when the draft's To is empty. A new message or a forward (To empty) gets the template To. A reply or a draft with a typed To keeps its To; the card shows the template To as "Not added: the draft already has a To recipient." The user can type it.

Decision: option 2, the same rule shape as D24 (a filled field is kept). The add-on reads `toRecipients` from the Insert event; an empty list counts as empty. [Slice 9 retry: a missing or malformed list is unknown, not empty. An unknown field gets no action and an unknown To counts as filled; see "As built".] No override button in v1 (Q35): the preview card would carry up to 4 Insert buttons.

Opt-out, consistent with D24:
- Preview card: "Insert body only" now means body only: no subject and no recipients. It shows when plain Insert would set the subject or add at least one address. Plain Insert and "Insert with subject" apply the recipient rule above.
- Prompt card: a switch "Add recipients" (id `rcpt`), default on, next to "Replace the subject". Off: no recipient action. Its bottom label is "Adds n recipients."; the preview card's recipient lines follow it [slice 9 retry].

Mechanism of the response: one `UpdateDraftActionResponse` with the body action, the subject action when D24 says so, and one action per field with new addresses. What each recipient action carries depends on spike S6:
- S6 shows "add": the action carries the new addresses only.
- S6 shows "replace", with the event lists exact: the action carries the draft's list as received plus the new addresses.
- Fallbacks in spec 14.1.

[S6 result: replace, event lists exact. Built: the second rule.]

### 5. Disclosure

A hidden Bcc or an outside address added without the user seeing it is a data-leak risk. Gmail web shows its own outside-recipient warning; this design does not rely on it.

Options for one-click Insert from a list row:
1. One click adds recipients; the row hint and the draft show them afterwards.
2. One click stays for templates with no recipients. A template with any recipient opens the preview card (or the prompt card, when it has prompts); its Insert is the confirmation.
3. One click unless Bcc or an outside address is set.

Decision: option 2. [D31, 2026-11-11, Accepted: replaced by option 1 with a count check; see Amendment 2026-11-11.] One extra click on recipient templates only. A Bcc or outside address never reaches a draft without a card that showed it. Mechanism:
- List rows (Home, Folder, Search, Favorites, Recent) of a template with recipients show the bottom label "Adds To 1, Cc 1, Bcc 1" (only fields with addresses) and the row button reads "Review". The sidebar list carries counts only: item field `rc: [to, cc, bcc]`, no addresses.
- Preview and prompt cards list every address on its own line with its field. An outside address carries "outside migway.com" (the caller's domain, from the caller's address). A Bcc line carries "hidden from other recipients". Not-added addresses (already in the draft, To rule, `blocked`) are listed with the reason.
- `template.apply` returns `to`, `cc`, `bcc`, `blocked` on every call, filtered by the current switch, outside the `knownVersion` rule (the lists are small and the switch can change without a new version). The add-on never caches them.
- The card passes `rh`, the first 16 hex characters of a SHA-256 over the lists it showed; addresses never travel in card parameters. At Insert, if the lists returned by `template.apply` hash differently, the draft is not changed and the card is re-rendered with "The recipients of this template changed. Check them and press Insert again."
- Result: an `UpdateDraftActionResponse` carries no notification (unverified that it can), so the draft's To, Cc and Bcc lines are the result. S6 step 1: Gmail web opens the Bcc line when the action adds to it.

### 6. Who may set recipients

- `edit` on the folder, like body and subject (ADR-0003 Part C). `use` holders insert and cannot change them; that is the use case.
- Private folders (D11): allowed. The owner of a private folder could type the same addresses in Gmail; the same validation and the `deny` switch apply. Moving a template from a private to a shared folder keeps them.
- Export (`export.folder` by manage holders, `export.library` by admins) includes `to`, `cc`, `bcc`: they are template content, readable by every `use` holder on the preview card already.
- Audit: `template.*` events already carry the item in `before` and `after` (src/server/handlers/templates.ts), so a recipient change shows as a before and after diff, like the title and subject. The audit is admin-only.

### 7. Logs (spec 11)

- No log line carries an address, a domain of a template address, or the `blocked` list.
- The `draft` object keeps its 5 keys (`fields`, `to`, `cc`, `bcc`, `hasSubject`): draft counts before the insert.
- The apply line gains nothing. The server writes it before the add-on computes the actions, so it cannot hold added counts. The server knows the template's counts from `targetId` when needed.

### 8. History, restore, duplicate, export, import, search

- Each version file stores `to`, `cc`, `bcc`. History shows one recipients line per version. Restore of version K copies K's lists into N+1 and validates them.
- Duplicate copies them and validates.
- Export `meta` gains `to`, `cc`, `bcc`; import follows section 2 above.
- Search options: (1) no address search; (2) web app library only, in the browser filter; (3) sidebar and web app. Decision: (2), weight 1, matching a term against the local part prefix or the full address prefix; a domain alone (`migway`) matches nothing. Reason: the person who needs "which templates Cc safety" is the editor or admin in the library; the sidebar search and its server op stay unchanged. Who sees results: the caller's visible templates only, as for every search.

## Amendment 2026-11-10 (D29): in-app switch

Status: Accepted 2026-11-11 with ADR-0008. D29 asks for two admin switches, so Q32 closes with option (b) in v1, built as the generic settings of ADR-0008.

- The value lives in `index.json` `settings.recipientsExternal` (`allow` default, `deny`), changed by an admin with `config.set`, audited with before and after.
- Script Property `RECIPIENTS_EXTERNAL` is retired. Slice 9 built its reader on the property; slice 11 pointed every reader at the setting (built, no code reads the property): `validateRecipients` on create, update, duplicate, version restore and import; `blocked` in `template.apply` and `template.getBody`; `me`; `config.get`.
- Behavior under `deny` is unchanged (section 2 above). Turning `allow` to `deny` asks for a confirmation in the Config tab (spec 7.3).

## As built (slices 9, 8b, 11, 13; verified at 6374b7b)

Spike S6 record: docs/spikes/slice-09-s6.md. Owner run on dev-ec0ccb2 from the compose toolbar, 2026-11-10. Actions replace a field; 5 actions combine in one response with no prompt; a reply keeps its To; the event lists are arrays of bare addresses. Step 7 (fresh consent) not run (spec Q55).

- `recipientActions(template, draft, add)` and `recipientPlan` (src/addon/cards/recipients.ts). Each action carries the draft's list from the tap's event, then the template addresses not in any known draft field (trimmed, lower case, part inside `<...>`). A field with nothing to add gets no action. `add` false ("Insert body only", switch off) sends none.
- `draftRecipients(event)` (src/addon/event.ts) returns per field a list or null (unknown). The first source holding the key decides (`draftMetadata`, then `gmail`). A missing key, null, a string, an object or an array with a non-string entry is unknown. An unknown field never gets an action, so a replace cannot wipe it; an unknown To counts as filled. The cards say "The draft's <Field> recipients could not be read and were not changed. Add by hand: <addresses>."
- Preview and prompt cards show the same lines (`recipientWidgets`), and "Finish typing addresses in the draft first: an address still being typed is lost." whenever Insert adds an address. Reason: a replace drops text not yet a chip.
- `rh` covers the template lists and `blocked`, not the draft's known or unknown state (Q54). An Insert without `rh` whose lists are not empty shows the preview card.
- Server: `validateRecipients` (src/shared/model/recipients.ts) on every write and again in the lock (`recheckRecipients`, slice 13). `template.update` keeps an omitted list. Version files with a malformed list read as `[]`; `version.restore` returns `recipientsUnreadable`. Import under an in-lock `deny` refuses the file (Q53).
- `template.list` always carries the lists (slice 13); the web library matches a query word against the local part or the full address (`SearchFields.addresses`), weight 1; the sidebar `search` op passes no addresses.
- Editor (slice 8b): chips in the Details panel; Backspace in the empty input removes the last chip; announcements "Added <addresses> to Cc", "Removed <address> from Cc".

## Amendment 2026-11-11: one-click insert with recipients (D31)

Status: Accepted 2026-11-11 (owner decision D31; built in slice 15, review PASS; test round 1 part B on dev-56bf795: one-click T6 added all 4 addresses). Was Proposed. One point stays Proposed, because it is the owner's to judge: a row Insert gives no notice for an outside address left out under `deny` or a template To skipped because the draft has one (Q77; the details card names both). Owner decision D31 (2026-11-11): Insert on every row inserts in one click, templates with recipients included. This replaces the decision of section 5 (option 2) with option 1 plus a count check. Fields the sender fills: ADR-0004 Amendment 2026-11-11. Cards: ADR-0009.

Platform facts (read 2026-11-11):
- `UpdateDraftActionResponseBuilder` has 6 methods: body, subject, To, Cc, Bcc actions and `build` [A15]. `ActionResponseBuilder` has navigation, notification, open link, state changed and `build`, and no draft action [A44]. A callback returns one of the two. So an insert response cannot carry a notification: the "result line after insert" of the D31 reading is not possible.
- Spike S6 step 0 (dev-ec0ccb2): the compose card closed after the insert tap. Step 1: Gmail web opened the Bcc line by itself when the action added a Bcc. Google's compose guide does not say whether the card closes [A14]; slice 15 smoke re-checks it.

Options for the disclosure on one click:
1. Row hint before, Gmail's draft fields after. The row label names the fields and counts ("Adds Cc 1, Bcc 1"); after the insert the draft shows every added address as a chip in To, Cc or Bcc (S6 steps 1 to 3). Cost: none on the server.
2. Row hint with the addresses. The sidebar view (`sidebar.home`, cached 10 min in the User Cache) would carry each address. Cost: a server change and addresses in the add-on cache (section 5 kept them out); 2 addresses of 20 to 30 characters each do not fit on one label line of a 300 px card next to the folder path; whether Gmail wraps or cuts a long label is unverified (slice 15 smoke).
3. One click, then a notification naming every added address. Not possible (facts above).
4. Keep a card for templates with a Bcc or an outside address. Safer for the two risky cases; breaks D31 for exactly the company templates that carry routing (the "driver leaving" use case of D26).

Decision: option 1, with a count check in place of `rh` on rows. Mechanism:
- The row hint stays counts per field (`rc`, `deny` already applied by the server), placed first on the label line so a cut label keeps it (ADR-0009). Owner question Q56: addresses on the row, default counts.
- Bcc gets no extra step. Reasons: the template's Bcc is set by an `edit` holder of the folder, not by the sender; Gmail web opens the Bcc line on insert (S6 step 1), so the address is visible in the draft before Send; nothing is sent by the add-on (`setSendStatus` never). Outside addresses get no extra step either; admins who want none set `recipientsExternal` to `deny` (ADR-0008). Owner question Q57, default one click for all.
- Count check, replaces `rh` on rows (Q54 related). The row Insert carries `rc` as it showed it, as the parameter `rc` = "<to>,<cc>,<bcc>" (absent when the row showed no hint, read as "0,0,0"). The Insert callback compares it with the lengths of `to`, `cc`, `bcc` returned by `template.apply`. Different: no draft change; the details card is pushed with "The recipients of this template changed. Check them and press Insert again." Equal: insert. Reason: a hash over addresses the row never showed checks nothing the user saw; the counts are what the row showed. Limit: an address swapped for another inside the 10 min view cache passes with equal counts; the new address is then visible in the draft. A view cached before slice 9 has no `rc` and reads "0,0,0", so a template that gained recipients shows the details card first, as today.
- Unknown draft field: when a template address falls in a draft field the event does not give as a list (`draftRecipients` null), the one-click Insert pushes the details card in place of inserting; the card says "Add by hand". The case was never seen in the owner's Gmail runs; it costs one condition.
- Not added in silence on one click: the template To when the draft has a To (section 4 rule), addresses already in the draft, and `blocked` addresses (`rc` excludes them). The details card still lists each with its reason.
- Details card (ADR-0009) keeps `rh` and the switch "Add recipients": it shows every address, so the hash checks what it showed.
- Rules unchanged: add, never remove; To only into an empty To; each action carries the draft list plus the new addresses (S6); one response; never `setSendStatus`.

Risks accepted with this amendment:
- An address added without the sender reading it first. The row shows how many and in which field; the draft shows which. Mail leaves only on Send.
- Text being typed in a recipient field (not yet a chip) is lost when Insert replaces that field (S6 limit). Today the card says "Finish typing addresses in the draft first"; on one click no card shows it. Mitigation: the quick start line stays, and the details card keeps the line. A sender usually opens the add-on with the cursor in the body (spec 13.4), after the addresses.
- A Bcc to an outside address can reach a draft without an "outside" marker on screen. Gmail's own outside-recipient warning is not relied on (section 5). Mitigation: `deny`.

Consequences: no server change; `template.apply` still returns the lists on every call. Logs unchanged (section 7). The quick start sentence "Users see every address before it is added" (editor help in spec 7.1) changes to "The row shows how many addresses Insert adds. The draft shows them after the insert."

## Consequences

- Easier: company templates carry their routing; users cannot change it without `edit`.
- Harder: templates with recipients need one extra click (the card). The preview card grows by one section.
- `recipient.first_name` still reads the draft's To before the insert; a template To added to an empty draft does not feed it (implicit prompt or fallback as today).
- The D24 meaning of "Insert body only" widens to "body only". The quick start and editor guide need one line each (slice 9).
- Revisit when the owner answers Q33 to Q39 and Q53 to Q55, or if S6 step 7 shows a consent prompt.

## Open questions

Spec section 15, Q32 to Q39; D31: Q56, Q57.

## Sources

- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui, re-read 2026-11-10: the 3 recipient action classes, an example that "updates the subject, and the To, Cc, and Bcc recipients", no add or replace statement, no per-action scope, no limits, no mobile note; the "can't silently add email recipients" guidance.
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder, re-read 2026-11-10.
- [A25] https://developers.google.com/apps-script/reference/card-service/update-draft-to-recipients-action, read 2026-11-10.
- [A26] https://developers.google.com/apps-script/reference/card-service/update-draft-cc-recipients-action, read 2026-11-10.
- [A27] https://developers.google.com/apps-script/reference/card-service/update-draft-bcc-recipients-action, read 2026-11-10.
- [A28] https://developers.google.com/apps-script/reference/add-ons-response-service/update-draft-action-response-builder (same setters plus `setSendStatus`), read 2026-11-10.
- [A15] re-read 2026-11-11: 6 methods, no notification, no navigation.
- [A44] https://developers.google.com/apps-script/reference/card-service/action-response-builder (navigation, notification, open link, state changed; no draft action), read 2026-11-11.
