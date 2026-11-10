# ADR-0006: Template recipients (To, Cc, Bcc)

Status: Proposed (2026-11-10). Owner decision D26 and its update of 2026-11-10 set the feature; this ADR sets the mechanism.
Date: 2026-11-10
Deciders: owner (thomas@migway.com), architect

## Context

D26 (owner, 2026-11-10): a template holds fixed addresses for To, Cc and Bcc. Insert adds them to the draft and never removes an address already there. Use case: company templates that users insert and cannot edit, for example a recruiter's "driver leaving" template that adds `safety@migway.com` to Cc. Update of D26 (owner, 2026-11-10): addresses outside the Workspace domain are allowed by default; admins need a way to turn them off.

Facts from the owner's Gmail runs:
- One `UpdateDraftActionResponse` carried body and subject actions with no new scope (spike S5, dev-32a446c).
- The compose event carries `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients` and `subject`, never `threadId` or `messageId` (smoke "Slice 5b", dev-4a233d4). The add-on reads them at Insert time (src/addon/event.ts `draftInfo`, `draftHasSubject`).
- The compose card is modal on Gmail web (spec 13.4). The user cannot edit the draft while the card is open, so the recipient lists of the Insert callback event are the lists the insert lands on.

Scope: no new OAuth scope. Reading Cc and Bcc uses `draftAccess: METADATA` and `gmail.addons.current.message.metadata`, already in the manifest (D10). Writing uses `gmail.addons.current.action.compose`, already in the manifest. Spike S6 confirms; a permission prompt in S6 stops the feature until the owner approves (no manifest change without approval).

### Platform facts (Google documentation, read 2026-11-10)

| Fact | Source | Settled |
|---|---|---|
| `UpdateDraftActionResponseBuilder` has `setUpdateDraftToRecipientsAction`, `setUpdateDraftCcRecipientsAction`, `setUpdateDraftBccRecipientsAction`, next to the body and subject setters. Each setter returns the builder "for chaining". `build()` throws "if the constructed UpdateDraftActionResponse isn't valid" and does not define invalid | [A15] | yes |
| `CardService.newUpdateDraftToRecipientsAction().addUpdateToRecipients(String[])`; Cc: `addUpdateCcRecipients(String[])`; Bcc: `addUpdateBccRecipients(String[])`. Class text: "Updates the To recipients of an email draft". Parameter text: "The To recipients to insert to the email draft" | [A25], [A26], [A27] | yes |
| Whether the actions add to the field or replace it | none of [A14], [A15], [A25] to [A28] says | unverified, S6 |
| Whether 5 actions (body, subject, To, Cc, Bcc) combine in one response | [A15] says chaining only; S5 verified body plus subject | unverified for recipients, S6 |
| Scope for the recipient actions | the compose guide asks for scopes "required for compose actions" and names none per action [A14] | unverified, S6 (expected: none new) |
| Limits: count per action, address format accepted, display names | none stated on any page | unverified |
| Behavior in a reply or forward draft, and with an address already present | not stated | unverified, S6 |
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

Decision: (a) for v1, (b) as a v1.1 item (Q32). No reason against (a) found: admins in v1 cannot change other Script Properties either (`ADMIN_GROUP`, `IMG_HOSTS` are owner-set), and an unset key keeps the owner's default `allow`.

With `deny`:
- A write that stores an outside address answers VALIDATION `RCPT_EXTERNAL`.
- Templates that already hold outside addresses stay stored unchanged. `template.apply` and `template.getBody` return only the inside addresses in `to`, `cc`, `bcc` and list the outside ones in `blocked`; the add-on adds only the returned lists, and the cards say "Not added: <address> (outside migway.com, turned off by the admin)". The editor shows the problem at load and refuses the next save until the author removes them. Restore of a version holding outside addresses and duplicate of such a template answer `RCPT_EXTERNAL`.
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

Decision: option 2, the same rule shape as D24 (a filled field is kept). The add-on reads `toRecipients` from the Insert event; a missing or empty list counts as empty. No override button in v1 (Q35): the preview card would carry up to 4 Insert buttons.

Opt-out, consistent with D24:
- Preview card: "Insert body only" now means body only: no subject and no recipients. It shows when plain Insert would set the subject or add at least one address. Plain Insert and "Insert with subject" apply the recipient rule above.
- Prompt card: a switch "Add recipients" (id `rcpt`), default on, next to "Replace the subject". Off: no recipient action. The addresses are its bottom label.

Mechanism of the response: one `UpdateDraftActionResponse` with the body action, the subject action when D24 says so, and one action per field with new addresses. What each recipient action carries depends on spike S6:
- S6 shows "add": the action carries the new addresses only.
- S6 shows "replace", with the event lists exact: the action carries the draft's list as received plus the new addresses.
- Fallbacks in spec 14.1.

### 5. Disclosure

A hidden Bcc or an outside address added without the user seeing it is a data-leak risk. Gmail web shows its own outside-recipient warning; this design does not rely on it.

Options for one-click Insert from a list row:
1. One click adds recipients; the row hint and the draft show them afterwards.
2. One click stays for templates with no recipients. A template with any recipient opens the preview card (or the prompt card, when it has prompts); its Insert is the confirmation.
3. One click unless Bcc or an outside address is set.

Decision: option 2. One extra click on recipient templates only. A Bcc or outside address never reaches a draft without a card that showed it. Mechanism:
- List rows (Home, Folder, Search, Favorites, Recent) of a template with recipients show the bottom label "Adds To 1, Cc 1, Bcc 1" (only fields with addresses) and the row button reads "Review". The sidebar list carries counts only: item field `rc: [to, cc, bcc]`, no addresses.
- Preview and prompt cards list every address on its own line with its field. An outside address carries "outside migway.com" (the caller's domain, from the caller's address). A Bcc line carries "hidden from other recipients". Not-added addresses (already in the draft, To rule, `blocked`) are listed with the reason.
- `template.apply` returns `to`, `cc`, `bcc`, `blocked` on every call, filtered by the current switch, outside the `knownVersion` rule (the lists are small and the switch can change without a new version). The add-on never caches them.
- The card passes `rh`, the first 16 hex characters of a SHA-256 over the lists it showed; addresses never travel in card parameters. At Insert, if the lists returned by `template.apply` hash differently, the draft is not changed and the card is re-rendered with "The recipients of this template changed. Check them and press Insert again."
- Result: an `UpdateDraftActionResponse` carries no notification (unverified that it can), so the draft's To, Cc and Bcc lines are the result. S6 records whether Gmail web opens the Bcc line when the action adds to it.

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

## Consequences

- Easier: company templates carry their routing; users cannot change it without `edit`.
- Harder: templates with recipients need one extra click (the card). The preview card grows by one section.
- `recipient.first_name` still reads the draft's To before the insert; a template To added to an empty draft does not feed it (implicit prompt or fallback as today).
- The D24 meaning of "Insert body only" widens to "body only". The quick start and editor guide need one line each (slice 9).
- Revisit after spike S6 (add or replace, combination, reply) and when the owner answers Q32 to Q39.

## Open questions

Spec section 15, Q32 to Q39.

## Sources

- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui, re-read 2026-11-10: the 3 recipient action classes, an example that "updates the subject, and the To, Cc, and Bcc recipients", no add or replace statement, no per-action scope, no limits, no mobile note; the "can't silently add email recipients" guidance.
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder, re-read 2026-11-10.
- [A25] https://developers.google.com/apps-script/reference/card-service/update-draft-to-recipients-action, read 2026-11-10.
- [A26] https://developers.google.com/apps-script/reference/card-service/update-draft-cc-recipients-action, read 2026-11-10.
- [A27] https://developers.google.com/apps-script/reference/card-service/update-draft-bcc-recipients-action, read 2026-11-10.
- [A28] https://developers.google.com/apps-script/reference/add-ons-response-service/update-draft-action-response-builder (same setters plus `setSendStatus`), read 2026-11-10.
