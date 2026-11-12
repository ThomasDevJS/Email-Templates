# ADR-0004: Placeholders and HTML safety

Status: Accepted 2026-11-09 (orchestrator, by owner delegation; was Proposed). Amendments 2026-11-10 at the end: errata and spike S4 (facts), subject (Accepted 2026-11-10 with the D24 rule, see "Amendment 2026-11-10: subject rule D24 and spike S5"); recipients D26 (Accepted 2026-11-11 with ADR-0006); one-click insert D31 (Accepted 2026-11-11, owner decision D31, built in slice 15; see "Amendment 2026-11-11: fields the sender fills, on one-click insert (D31)"); braces that join around a field (Proposed 2026-11-12, Q78, not built; see "Amendment 2026-11-12"); date fields D38 (Proposed 2026-11-12, Q85 to Q90, not built; see "Amendment 2026-11-12: date fields")
Date: 2026-11-09
Deciders: owner (thomas@migway.com), architect

## Context

D9 accepted the syntax: `{{sender.name}}`, `{{sender.title}}`, `{{sender.phone}}`, `{{sender.department}}`, `{{recipient.first_name}}`, `{{ask:Label}}`, `{{var|fallback}}`, escape `\{{`. D10 accepted recipient first name with `draftAccess: METADATA` and the sensitive `gmail.addons.current.message.metadata` scope [R4 S3, S8]. Same-name prompts fill once [R3 S4]. Apply is blocked until every prompt has a value, because HubSpot ships unfilled prompts [R3 S12]. Unknown names fail at save, because Briskine renders typos as empty [R3 S26]. Editors that inject `<span>` break placeholders [R1 S24].

Platform facts: draft insert HTML size, tag and style rules are undocumented [R4 S3, S5]. One community thread says `<style>` blocks are partly dropped and inline styles survive better (unverified) [R4 S35]. Compose events give recipients as email strings, no display names [A5]. `domain_public` profile reads work for any domain user with scope `admin.directory.user.readonly`; contact sharing must be on; the exact field set is not listed [R4 S78].

## Options

Sender values source:

1. Admin SDK Directory `users.get(email, { viewType: 'domain_public' })`, called by the server (owner identity). Scope `admin.directory.user.readonly`, one scope on the single consent list (ADR-0001 topology 1a); the call runs only in the web app path as the owner. Fields `name`, `organizations`, `phones` assumed in the public view (unverified).
2. People API `people/me` from the add-on as the user. Scopes `userinfo.profile`, `user.organization.read`, `user.phonenumbers.read`: 3 consent lines instead of 1. Returns the user's profile, which may differ from the Directory record.
3. People API `searchDirectoryPeople` by the server with `directory.readonly`, source `DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE`. One scope on the single consent list. Returns domain profiles including organizations and phones.

HTML sanitizer engine:

1. Server-side allowlist walker on `htmlparser2` (MIT, pure JavaScript, no DOM). Runs in Apps Script V8.
2. DOMPurify. Needs a DOM. Apps Script has none, so it can run only in the browser, which a caller can bypass.
3. Apps Script `XmlService`. Parses XML, rejects ordinary HTML.

Token atomicity in the editor:

1. ProseMirror (MIT) with an inline atom node for tokens.
2. Quill with a custom embed blot.
3. Plain `contenteditable` with text tokens and a post-edit regex repair.

## Decision

### Grammar

Tokens are recognized only inside one HTML text node, after the sanitizer has decoded entities. A token split across elements (`{{<b>sender</b>.name}}`) is a save error. A `\` typed directly before a placeholder chip would serialize as the escape `\{{`, so the editor refuses to save it with `PH_BACKSLASH` ("Remove the backslash before the placeholder at character N", revision 2026-11-09, slice 3).

EBNF:

```
text      = { literal | escape | token } ;
escape    = "\{{" ;                                  (* renders as "{{" *)
token     = "{{" , sp , body , sp , "}}" ;
body      = prompt | variable ;
prompt    = "ask:" , sp , label ;                    (* label trimmed, 1 to 40 chars *)
label     = lchar , { lchar } ;
lchar     = ? any character except { } | \ < > CR LF ? ;
variable  = name , [ sp , "|" , fallback ] ;         (* fallback trimmed, 0 to 80 chars *)
name      = ident , "." , ident ;
ident     = lower , { lower | "_" } ;
lower     = "a" .. "z" ;
fallback  = { fchar } ;
fchar     = ? any character except { } \ < > CR LF ? ;
sp        = { " " } ;
```

Equivalent JavaScript regex, global, applied per text node, alternatives in this order:

```
/\\\{\{|\{\{ *(?:ask: *([^{}|\\<>\r\n]{1,40}?)|([a-z][a-z_]*\.[a-z][a-z_]*)(?: *\|([^{}\\<>\r\n]{0,80}?))?) *\}\}/g
```

Group 1 is a prompt label, group 2 a variable name, group 3 a fallback. A match of `\{{` alone is an escape. Any `{{` left in a text node after this pass goes through a lenient second pass (`/\{\{([^}]*)\}\}?/`) that classifies it as `PH_CASE`, `PH_FALLBACK_ASK`, `PH_LABEL` or `PH_MALFORMED`. Names that match group 2 but are not in the registry raise `PH_UNKNOWN`. The regex was checked against 6 sample strings on 2026-11-09; the slice 3 unit tests own the full fixture set.

Registry of names (closed list in v1): `sender.name`, `sender.title`, `sender.phone`, `sender.department`, `recipient.first_name`. Candidates for v1.1: `sender.email`, `ask` with defaults, dropdown and date prompts.

Save-time validation (server, after sanitizing). Each error carries the text offset and a message:

| Code | Trigger | Example message |
|---|---|---|
| `PH_UNKNOWN` | name not in registry | "Unknown placeholder sender.nmae. Did you mean sender.name?" (edit distance 2 or less) |
| `PH_CASE` | upper-case name | "Use lower case: sender.name" |
| `PH_MALFORMED` | a `{{` left in a text node after matching, or a split token | "Placeholder at character 120 is not closed" |
| `PH_LABEL` | empty or over 40 chars label | "Prompt label must be 1 to 40 characters" |
| `PH_FALLBACK_ASK` | `{{ask:X|y}}` | "Prompts take no fallback in v1" |
| `PH_ATTR` | `{{` inside an attribute value | "Placeholders work in text only" |
| `PH_TOO_MANY` | more than 20 distinct prompts | "At most 20 prompts per template" |

Warning (not an error): `recipient.first_name` without a fallback.

Saved items store the parsed `placeholders` (names) and `prompts` (normalized labels) for the sidebar.

### Apply semantics

1. Prompt identity: label trimmed, inner whitespace collapsed, compared case-insensitively. The first spelling is shown. One input per identity fills every occurrence.
2. Variable values. Sender values come from the caller's profile (below). `recipient.first_name` resolves only when the draft has exactly one To recipient and that address is in the Migway domain; it is then the Directory `name.givenName`. Zero or several To recipients, or an external address, leave it unresolved. External addresses never leave the add-on and are never logged.
3. Unresolved variable with a fallback: the fallback is used. Unresolved variable without a fallback becomes an implicit prompt ("Your phone", "Recipient first name"). No placeholder ever renders as empty text by accident. [D31, 2026-11-11, Accepted: on the compose card and in the side panel an implicit prompt left blank renders as empty text on purpose, with the cleanup rules of Amendment 2026-11-11.]
4. Prompt card: one `TextInput` per explicit and implicit prompt, with ID `p-<n>` (`[a-zA-Z0-9-]+`, max 64 chars [R4 S36]). The Apply callback rejects the request and re-renders the card with "Fill 2 fields: Meeting date, Your phone" if any value is blank. The callback is the enforcement point. Slice 4 also tries `Action.setRequiredWidgets` for earlier feedback (availability in Gmail unverified). [Not tried in slice 4; optional, no slice owns it.] [D31, 2026-11-11, Accepted: on the compose card a blank field no longer blocks; it is removed with the cleanup rules. See Amendment 2026-11-11.]
5. Values: plain text, max 500 characters, HTML-escaped (`& < > " '`), newline becomes `<br>`. Fallbacks and Directory values get the same escaping. Rendering never creates markup from values.
6. Escape: `\{{` renders as the literal `{{`.
7. Insert: `UpdateDraftBodyAction` with `MUTABLE_HTML` and `UpdateDraftBodyType.IN_PLACE_INSERT` [R4 S4, S5b]. The rendered HTML is the sanitized stored body with tokens replaced. Subject is not touched in v1. [Changed by D21: see Amendment 2026-11-10, subject.]

### Sender values: option 1, server-side Directory `domain_public`

- Server calls `AdminDirectory.Users.get(callerEmail, { viewType: 'domain_public', projection: 'basic' })`. Scope `admin.directory.user.readonly` in the one manifest (revised 2026-11-09, D15): self-installing users see "See info about users on your domain" [A10 in ADR-0002]; the admin domain install skips that screen [R4 S60]. Only web app code calls it.
- Mapping: `sender.name` = `name.fullName`. `sender.title` = `organizations[primary].title`, else `organizations[0].title`. `sender.department` = same organization's `department`. `sender.phone` = first `phones[]` with `type = work`, else `phones[0].value`.
- Cache: profile map in Script Cache, 6 h TTL. Directory changes show within 6 h; admin "Refresh memberships now" also clears profiles.
- The same lookup gives `name.givenName` for internal recipients.
- Fallback if slice 2 shows `organizations` or `phones` missing in `domain_public`: option 3 (`searchDirectoryPeople`, scope `directory.readonly`, replaces `admin.directory.user.readonly` on the consent list). Option 2 is rejected because it adds 3 consent lines where option 1 adds 1.

### HTML sanitizer: option 1, server-side allowlist on htmlparser2

Runs on every write: save, restore, import. Output is canonical (attributes sorted, quotes normalized) and idempotent: `sanitize(sanitize(x)) == sanitize(x)`. The web app runs the same module on paste for preview only; the server result is authoritative. [Not built: see Amendment 2026-11-10, errata.]

Allowed tags: `p br div span b strong i em u s strike sub sup font a ul ol li blockquote h1 h2 h3 h4 hr pre code table thead tbody tfoot tr td th caption colgroup col img`.

Removed with their content: `script style iframe frame frameset object embed applet template noscript svg math head title textarea select option button input form meta link base`. Every other tag is unwrapped (children kept). Comments, CDATA, processing instructions and doctype are removed. Max nesting depth 32; deeper content is flattened.

Allowed attributes:

| Tag | Attributes |
|---|---|
| all allowed tags | `style` (filtered), `dir` (`ltr`, `rtl`) |
| `a` | `href`, `title`. `target="_blank"` and `rel="noopener noreferrer"` are forced |
| `img` | `src`, `alt`, `width`, `height` (integers 1 to 2000) |
| `font` | `color`, `face`, `size` (1 to 7) |
| `p div h1 h2 h3 h4 td th` | `align` (`left`, `center`, `right`, `justify`) |
| `table` | `border`, `cellpadding`, `cellspacing`, `width`, `align` |
| `td th` | `colspan`, `rowspan`, `width`, `valign`, `bgcolor` |
| `col colgroup` | `span`, `width` |
| `ol` | `start`, `type` |

Every `on*` attribute, `id`, `class`, `name`, `srcset`, `formaction`, `xmlns` and every unlisted attribute is dropped.

URL rules: after entity decoding and removal of whitespace and control characters, `href` must start with `https:`, `http:`, `mailto:` or `tel:` (case-insensitive). `src` must start with `https:`. Everything else (`javascript:`, `vbscript:`, `data:`, relative URLs) drops the attribute. Image hosts are any `https` host unless Script Property `IMG_HOSTS` lists allowed hosts (Q12). No image upload in v1.

Inline style allowlist: `color`, `background-color`, `font-family`, `font-size`, `font-weight`, `font-style`, `text-decoration`, `text-align`, `line-height`, `vertical-align`, `margin` and `padding` (and their `-top/-right/-bottom/-left`), `border` family (`border`, `border-*`, `border-collapse`), `width`, `height`, `max-width`, `display` (`block`, `inline`, `inline-block`, `table`, `table-cell`). A declaration is dropped if its value contains `url(`, `expression(`, `@import`, `javascript:`, a backslash, `<`, `>` or a comment. `position`, `float` with `fixed`, `behavior`, `-moz-binding` are not in the list and drop.

Size: sanitized body max 100 KB until the slice 4 spike sets the final cap (largest size that inserts on all 3 clients, divided by 2). [Final 100 KB, Gmail web only: see Amendment 2026-11-10, spike S4.]

Fixture set (BRIEF 9 asks for 30 or more; plan is 40): 25 malicious, 15 benign, each with expected output. Malicious: `<script>`; `img onerror`; `svg onload`; `javascript:` in mixed case, with entities (`&#106;avascript:`), with tab and newline inside the scheme; `data:text/html` href; `vbscript:`; CSS `expression()`; CSS `url(javascript:...)`; CSS escape `\6a avascript`; `<style>` block; `iframe srcdoc`; `object` and `embed`; `form action` with `button formaction`; `meta refresh`; `base href`; `link rel=stylesheet`; noscript mXSS (`<noscript><p title="</noscript><img src=x onerror=alert(1)>">`); comment break-out (`<!--><img src=x onerror=...>-->`); CDATA; unquoted attributes with event handlers; `srcset` with a script URL; `math` with `xlink:href`; 33 levels of nesting; `a target=_self` coerced. Benign: Gmail-pasted HTML with `font` tags; Word-pasted HTML with `mso-` styles (stripped); layout table with borders; nested lists; `mailto:` and `tel:` links; `https` image with width; headings; blockquote; every placeholder inside bold; a split token (expected `PH_MALFORMED`); `\{{` escape; prompt reused 3 times; 100 KB body; non-Latin text; emoji.

### Token atomicity in the editor: option 1, ProseMirror atom node

- Storage format: HTML with tokens as plain text, `{{sender.name}}` or `{{recipient.first_name|there}}`. No editor-specific markup is ever stored.
- Load: HTML is parsed into the ProseMirror schema, then every regex match in a text node becomes an inline node `placeholder` with `atom: true` and attributes `{ name | label, fallback }`. It renders as `<span class="ph" data-ph="sender.name" contenteditable="false">Sender name</span>` with a visible chip style.
- Serialize: the node writes back its token text. Literal `{{` typed in text is written as `\{{`, so it never becomes a token by accident.
- Insert: a "Placeholder" toolbar menu and typing `{{` open a picker listing the 5 names and "Ask the user...". Marks (bold, color, link) wrap the whole atom; the cursor cannot enter it.
- The editor schema matches the sanitizer allowlist: paragraphs, headings 1 to 3, bold, italic, underline, strike, link, text color, background color, font size (4 steps), font family (6 web-safe families), alignment, bullet and ordered lists, blockquote, horizontal rule, image (https URL, width), simple table, hard break, placeholder. Content outside the schema is normalized on load.
- Fixture test (slice 3): for 20 fixture bodies, `serialize(parse(html))` equals `sanitize(html)` and the token count is unchanged; bold across a token yields `<strong>{{sender.name}}</strong>`; deleting a chip removes the whole token; copy and paste keeps the token.
- Quill (option 2) also has atomic embeds but its delta model drops tables without a module. Option 3 repeats the Ablebits failure [R1 S24].
- The library is bundled into the web app HTML at build time (ADR-0005), no CDN at runtime.

### Slice 4 spike plan (insert behavior)

Run before the sanitizer allowlist and size cap are final. Owner runs it on the dev deployment.

| ID | Fixture | Check |
|---|---|---|
| F1 | 3 paragraphs, bold, italic, underline, link | inserts at cursor, editable, link works |
| F2 | colors, font sizes, font families inline | each style property survives (yes or no per property) |
| F3 | bullet and ordered lists, blockquote | structure survives |
| F4 | 3x3 table, borders, cell padding, inline widths | table survives |
| F5 | `https` image 600 px wide with `width` | image shows, width kept |
| F6 | 50 KB body | inserts, time click to body |
| F7 | 200 KB body | inserts or fails, time |
| F8 | all 5 placeholders and 2 prompts filled | values correct, escaped |
| F9 | insert with cursor in mid-line and with text selected | `IN_PLACE_INSERT` position, selection replaced |

Clients: Gmail web on Chrome (acceptance target), Gmail Android app, Gmail iOS app. [Android and iOS dropped, D22.] Record per fixture and client: inserted (y/n), styles kept, time in ms, and how the sent message renders in a Gmail web recipient. Output: docs/spikes/slice-04-insert.md (written by the implementer) and an update to this ADR with the trimmed allowlist and the final size cap.

### Signature duplication (v2 notes, no v1 work)

- Gmail adds the user's own signature to new messages. A signature inserted into the draft duplicates it [R2 S8, S16].
- `INSERT_AT_END` lands after the signature on Gmail web and before it on mobile [R4 S4].
- The add-on cannot read the draft body with the compose scope, so it cannot detect an existing signature.
- Options for v2: (a) "Set my Gmail signature" with the user's own token and `gmail.settings.basic` (restricted, no verification for an internal app) [R4 S26, S18], and never insert; (b) insert only and ask users to clear their Gmail signature; (c) central push with domain-wide delegation, super admin approval, service account key risk [R4 S29, S65]. Recommendation for v2: (a). Validate signature HTML under 10,000 characters [R4 S28], store a plain-text variant for mobile [R2 lessons].
- v1 templates that end with a sign-off and `{{sender.name}}` may duplicate a Gmail signature. The quick start (slice 7) tells authors to leave sign-offs to the Gmail signature.

## Amendment 2026-11-10: errata (facts of the build)

- Paste. The editor has no sanitize-on-paste preview. Pasted HTML goes through the ProseMirror schema parser, which keeps only nodes and marks of the schema (links `https`, `http`, `mailto`, `tel`; images `https`). Save runs the server sanitizer, which stays the only authority. Source: slice 3 review gap 6.
- `Action.setRequiredWidgets`: not tried. The Apply callback stays the enforcement point. Optional; no slice owns it.
- Prompt card Insert calls `template.apply` with `followUp: true`, so `use` is re-checked on every insert (spec 4.1 step 5).

## Amendment 2026-11-10: spike S4 closed on Gmail web (D22)

Owner decision D22 (2026-11-10): Gmail web is the only acceptance client for v1. Android and iOS runs are dropped; mobile stays best effort and untested (BRIEF A7).

Results, Gmail web on Chrome, builds 43f10de and 9bbd262, run by the Claude Chrome extension (docs/spikes/slice-04-insert.md):

| Fixture | Inserted | Kept | Callback ms (server) |
|---|---|---|---|
| F1 text, bold, italic, underline, link | y | all | 1739 (227) |
| F2 colors, sizes, families, `font`, line-height, margin, padding, border | y | every visible property; line-height not visible on one line | 2285 (239) |
| F3 lists, nested item, `start=5 type=a`, blockquote | y | all | 1952 (344) |
| F4 3x3 table, borders, padding, widths | y | all | 1826 (178) |
| F5 `https` image, `width=600` | y | image, about 600 px | 2125 (276) |
| F6 51,208 bytes | y | | 1940 (138) |
| F7 204,837 bytes | y | | 1285 (56) |
| F8 5 placeholders, 2 prompts | y | escaped prompt text literal, 2 lines kept | 2910 (1015) |
| F9 selection | y | selected word replaced | |
| F9 mid-line | y | landed at the top of the body in 3 runs; cursor placement by the extension unverified | 1996, 1692, 2093 |

Sent copies of F2 to F5 and F8 rendered the same as the draft.

Decision:
- Allowlist: unchanged. No tag, attribute or style property was lost on Gmail web, so the rule "lost on web leaves the list" removes nothing.
- Size cap: 100 KB, final. Rule of this ADR applied to web only: largest body that inserted (F7, 204,837 bytes, about 200 KB) divided by 2.
- F9 mid-line stays an owner hand check in docs/ops/smoke.md. It tests `IN_PLACE_INSERT` position and changes neither allowlist nor cap.
- Harness removal in slice 5: `spike.s4` and its policy row, `onSpikeCard`, `onSpikeInsert`, `src/shared/spike/`, the "Spike S4" home section.

## Amendment 2026-11-10: template subject (D21) [was Proposed; Accepted 2026-11-10 with the draft rule replaced by D24, next amendment]

Owner decision D21 (2026-11-10): the template subject is applied to the draft in v1, built in slice 5. Spec section 5.6 holds the field rules; this section records options and mechanism.

Platform facts, read 2026-11-10:
- `UpdateDraftActionResponseBuilder.setUpdateDraftSubjectAction(UpdateDraftSubjectAction)` "Sets an action that updates the subject line of a draft". `CardService.newUpdateDraftSubjectAction().addUpdateSubject(subject)` "Updates the subject line of an email draft" [A15].
- The same builder has `setUpdateDraftBodyAction`; every setter returns the builder for chaining. No page says whether body and subject combine in one response; Google's examples set one action each [A14, A15]. Unverified, spike S5 (spec Q20). [Verified: they combine, spike S5 on dev-32a446c.]
- Scope: Google's compose guide asks for the scopes "required for compose actions" and names none per action; `gmail.addons.current.action.compose` reads "Manage drafts and send emails when you interact with the Google Workspace add-on" [A14, A16]. Expected: no new scope. Unverified until spike S5. A new scope needs owner approval before any manifest change. [Verified: no new scope, spike S5.]
- The Gmail event object has no draft subject field; with `draftAccess: METADATA` it carries recipients only [A5, A13]. The add-on cannot read what the user typed in Subject. [Wrong for the live event: the compose event carries `subject`; next amendment.]
- Mobile: no page mentions Android or iOS support for the subject action. Best effort, untested (D22, BRIEF A7).

Options, existing subject:
1. Replace on every Insert when the template subject is not empty. One click. Overwrites a typed subject and a reply's "Re: ..." line.
2. Never set it automatically; a separate "Set subject" button. Typed subjects are safe. Two clicks for the common case, against D21's intent.
3. Replace by default, with an opt-out at the points where the user already decides: "Insert body only" on the preview card, a "Replace the subject" switch (default on) on the prompt card. One-click list Insert replaces.

Decision: option 3 [replaced by D24, next amendment]. Mechanism: the add-on adds `UpdateDraftSubjectAction` to the same `UpdateDraftActionResponse` as the body action only when the rendered subject is not empty and the user did not opt out. An empty template subject sends no subject action, so the draft subject is never cleared. Reply drafts follow spec Q21.

Options, placeholders in the subject:
1. Plain text, no placeholders. Simple. Authors cannot put `{{ask:Product name}}` or `{{recipient.first_name}}` in the subject.
2. Same grammar as the body, prompts shared by label identity. One parser, one prompt per label.

Decision: option 2. Mechanism: the parser runs on the subject as one text run with the same regex and registry. `prompts` and `placeholders` on the item are the union over subject and body, so the prompt card asks each label identity once and the value fills both. Rendering uses the same value map; the subject renderer skips HTML escaping, replaces every control character (CR, LF, tab, U+0000 to U+001F, U+007F, U+2028, U+2029) with one space, collapses spaces and trims. Values keep their 500-character cap. The subject string goes to Card Service as a plain string; no markup is ever built from it.

Save validation adds `SUBJ_TOO_LONG` (over 200 characters after trim) and `SUBJ_LINEBREAK` (any control character). `PH_*` codes apply to the subject with `field: "subject"`, except `PH_ATTR` (no attributes) and `PH_BACKSLASH` (no chips in a plain input). `PH_TOO_MANY` counts distinct prompts over subject and body. Import replaces line breaks with one space and reports the count.

Editor: a single-line `<input>` "Subject" under Title, plain text with tokens typed as text (no chips). The Placeholder menu inserts token text at the cursor when the subject has focus. Preview as me shows the rendered subject. Problems list names the field.

Storage and history: the index item `subject` holds the current version's subject (field present since slice 2). Each `bodies/<id>.v<n>.json` gains `subject`; files without it read as `""`, so no migration. Restore of version K copies K's subject. Duplicate, export and import carry it. Search weight 2.

Consequences: one more field on save and apply; no new op, no new scope expected. A user who typed a subject and taps one-click Insert loses it; the preview and prompt cards offer the opt-out, and the quick start (slice 7) states it. Revisit after spike S5.

## Amendment 2026-11-10: subject rule D24 and spike S5

Status of the subject amendment: Accepted 2026-11-10 (orchestrator assumption D24, confirmed in Gmail; the owner may flip it). Spec 5.6 holds the rule.

Spike S5 result (smoke "Slice 5" step 1, dev-32a446c, Gmail web): one `UpdateDraftActionResponse` with `UpdateDraftBodyAction` and `UpdateDraftSubjectAction` updates both. No new scope; the manifest keeps 10 scopes (Q20 closed). Replacing a reply's subject started a new thread.

Platform facts from the owner's runs:
- The Gmail compose event carries `draftMetadata`, `toRecipients`, `ccRecipients`, `bccRecipients` and `subject`. It never carried `threadId` or `messageId`, on new drafts or replies (smoke "Slice 5b", dev-4a233d4). Google's event object page lists neither `subject` nor `draftMetadata` (re-read 2026-11-10) [A13].
- `subject` holds the draft subject: `hasSubject` was true with a filled subject (smoke "Slice 5c", dev-848206f).

Options, existing draft subject:
1. Replace by default with opt-outs (option 3 above). A reply leaves its conversation unless the user picks "Insert body only".
2. Detect replies by `threadId` or `messageId` and keep their subject (slice 5b). Failed in Gmail: the compose event carries neither field, so every reply counted as a new draft.
3. Set the template subject only when the draft subject is empty (D24). Typed, reply and forward subjects are kept. "Insert with subject" and the prompt card switch override.

Decision: option 3. Mechanism:
- `draftHasSubject(event)` reads `subject` from the event of the Insert callback (`event.gmail` and `event.draftMetadata`). Only a string with a non-space character counts. A missing field, null, a number or a blank string count as empty.
- `replacesSubject(choice, draftHasSubject)` decides: plain Insert sets the subject on an empty draft subject and keeps a filled one; "Insert with subject" always sets it; "Insert body only" never sends it. The prompt card switch "Replace the subject" starts at the plain Insert value (on for an empty draft subject, off for a filled one). The switch state read from the form at Insert decides.
- The preview card shows "Sets the draft subject." with Insert and "Insert body only" on an empty draft subject, or "The draft already has a subject. It is kept." with Insert and "Insert with subject" on a filled one (wireframe 02).
- The subject text never leaves the add-on except as the subject action: it is in no request argument, User Cache entry, card parameter or log line. The server log gets `hasSubject` only (spec 11).
- Degraded case: if Gmail stops sending `subject`, `draftHasSubject` is false and Insert replaces the subject as in option 1. "Insert body only" stays the escape.

Verified: smoke "Slice 5c" on dev-848206f, 4 of 4. Empty subject set; typed subject kept; "Insert with subject" replaced it; reply subject kept and the reply stayed in its conversation; `hasSubject` true in the log with a filled subject.

Consequences: no new op, no new scope. Users who want the template subject on a reply or a typed draft press "Insert with subject"; the quick start (slice 7) states it. Open: Q25 (spec 15), prompts used only in the subject are asked while the switch is off.

## Amendment 2026-11-10: template recipients (D26)

Status: Accepted 2026-11-11 with ADR-0006 (was Proposed). Mechanism, options and platform facts: ADR-0006.

- Placeholders: the grammar of this ADR does not apply to To, Cc and Bcc. Recipient fields hold literal addresses; a `{` fails `RCPT_FORMAT` (ADR-0006 section 3).
- Apply semantics 7: the one `UpdateDraftActionResponse` also carries one recipient action per field with new addresses (ADR-0006 section 4), after spike S6.
- "Insert body only" (D24) now means body only: no subject action and no recipient action.
- `recipient.first_name` (Apply semantics 2) still reads the draft's To before the insert; template To addresses do not feed it.

## Amendment 2026-11-11: fields the sender fills, on one-click insert (D31)

Status: Accepted 2026-11-11 (built in slice 15, review PASS; follow-up 1 gives one result on every insert path; was Proposed). Open by default: Q76 (rule 2 knows ASCII punctuation only). The rule itself is the owner's decision of 2026-11-11 (D31 point 2, relayed by the orchestrator): an unfilled field is removed, no marker. Owner request: "insert template in 1 click (or help pre-fill if they want to (or they do it themselves in the gmail, we just insert template and remove placeholders))". Card layout and the details card: ADR-0009. Recipients: ADR-0006 Amendment 2026-11-11.

Context. Today a template with a field the sender fills (`{{ask:Label}}`, or a variable with no value and no fallback) opens the prompt card, and Insert stays blocked until every field holds a value (Apply semantics 4). D31 asks for Insert in one click for every template. The grammar gives `{{ask:Label}}` no fallback; only variables carry `|fallback`. So on one click every explicit field, and every implicit field, has no value.

Options for a field without a value at insert:
1. Removal with a small cleanup. The token renders as "" and the spaces around it are tidied by 4 local rules. The owner's choice.
2. Marker `[Label]` to type over. Visible in the draft, but the owner does not want placeholders left in the draft. Rejected by the owner.
3. Highlighted marker (a styled span). Rejected: rendering would create markup (Apply semantics 5), and the style is sent if forgotten.
4. Keep the blocking prompt card. Rejected by D31.

Decision: option 1. Mechanism:
- Value order unchanged: a typed answer, else the variable's value, else its fallback, else "". `renderBody` already returns "" for a missing answer and lists the field in `missing`; the change is that no caller blocks on `missing` any more, and the cleanup below runs.
- Cleanup, one function in src/shared/placeholders/render.ts, applied per text run (`mapTextRuns`) and to the subject. A gap is the place of a token that rendered as empty text (an unfilled field, or a fallback written as `|`). Gaps are handled left to right on the text built so far. "Space" means U+0020 only. Rules:
  1. Space on both sides of the gap: drop the space after it.
  2. Space before the gap and one of `, . ; : ! ?` right after it: drop the space before it.
  3. Gap at the start of the run with a space after it: drop that space.
  4. Gap at the end of the run with a space before it: drop that space.
- Subject: the same 4 rules, then `oneLine` as today (control characters to a space, runs of spaces collapse, trim). An empty result sends no subject action (spec 5.6), so the draft subject stays as it was.
- Test pairs (input, then output; no field has a value; the phone is unknown):

  | Input | Output |
  |---|---|
  | `Hi {{ask:Name}}, thanks` | `Hi, thanks` |
  | `Load {{ask:Load number}} is ready` | `Load is ready` |
  | `Your load {{ask:Load}}.` | `Your load.` |
  | `{{ask:Greeting}} team,` | `team,` |
  | `Thanks {{ask:Name}}` | `Thanks` |
  | `Hi {{ask:A}} {{ask:B}}, ok` | `Hi, ok` |
  | `Call {{sender.phone\|the office}} today` | `Call the office today` (fallback, no gap) |
  | Subject `Quote {{ask:Product}} for {{ask:Client}}` | `Quote for`; subject `{{ask:Topic}}` gives "" and no subject action |

- Left alone on purpose: spaces across inline tags (`Hi <b>{{ask:Name}}</b>, thanks` keeps `Hi <b></b>, thanks`); non-breaking spaces, tabs and line breaks; double spaces the template already holds away from a gap; other punctuation (`)`, quotes, dashes); a paragraph, list item or table cell left empty (no block is removed: removing blocks means rewriting the sanitized structure, and an empty `<p>` may show as a blank line, slice 15 smoke step 13 records it); words that read wrong without the value ("Call me at."). The rules touch only the characters next to a gap.
- Escaping and the sanitizer are unchanged: removal adds no text and no markup.
- Values typed on the details card (ADR-0009): a non-blank value wins; a blank one is removed by the same rules; a value over 500 characters still blocks Insert with "Shorten to 500 characters: <labels>". Blank no longer blocks.
- Side panel (ADR-0007, after spike S7): the same rule, so the blank-field notification and the "Check" fallback of ADR-0007 section 3 are no longer needed.

Risk accepted by the owner: a sentence with a hole ("Your load is ready" without the number, "Call me at.") reads as finished text and can be sent. Apply semantics 3 ("no placeholder renders as empty text by accident") becomes "renders as empty text on purpose" on the compose card. Mitigations that stay: the row hint "2 fields to fill" before the click; the details card (tap on the row) to fill in first; the quick start line "Fields you did not fill are left out. Read the draft before you send, or tap the template's name to fill them in first."

Consequences: nothing changes on the server: `PH_TOO_MANY` (20 per template) stays; one-click needs no field cap. No log line carries a removed field or a count of them (the server writes the apply line before the add-on renders).

## Amendment 2026-11-12: braces that join around a field (slice 20b minor 7, Q78)

Status: Proposed (architect, errata run 6). No owner decision exists yet; the owner approves or rejects the rule. Not built.

Problem. `{{{ask:N}}{ask:M}}` saves today and puts template syntax into a draft. Cause: the regex finds the token `{{ask:N}}` at character 2, so the text node splits into the literal `{`, the token, and the literal `{ask:M}}`. Neither literal holds `{{`, so the leftover pass finds nothing and the template saves. At insert, N blank gives `{` + "" + `{ask:M}}` = `{{ask:M}}` in the draft; N "7" gives `{7{ask:M}}`. M is never asked. The same happens across inline tags (`<b>{</b>{{ask:N}}{ask:M}}`, because each tag starts a new text run) and when a gap rule removes the space between two braces. The reviewer confirmed the base build behaves the same (docs/reviews/slice-20b.md item 3.8).

Options:
1. Save rule: refuse a body or subject whose text, with every field removed, holds `{{` that no single literal holds. One check at the place every write already passes (`scanBody`); stored templates and the renderer stay as they are.
2. Render rule: after rendering, turn any `{{` that the render created into `{ {` or drop one brace. Changes text the author wrote, at every insert, in the add-on and the side panel, and hides the mistake from the author.
3. Grammar change: let `{{{` start a token, or refuse a literal `{` right before any token. The first changes which token the regex finds for every template; the second also refuses harmless text such as `{{{ask:N}}` with nothing after it.

Recommendation: option 1. It tells the author at save time, in the editor's Problems list before the save, and it changes no stored text and no draft.

Rule (exact):
- Skeleton of the body: take the text runs of the sanitized HTML in order (`textRuns`, the runs `scanBody` already walks). Split each run with `parseText`. Keep each literal segment as written. Replace each escape `\{{` with one marker character that is not `{` (the implementation picks U+E000). Remove each token (variable or field) together with the U+0020 spaces directly before and after it in the same run. Join all runs with nothing between them.
- Refuse each `{{` in the skeleton whose two braces come from different literal segments (across a removed token, or across two runs). A `{{` inside one literal segment is already refused by the leftover pass and is not reported twice.
- Code `PH_MALFORMED`. Offset: body-text offset of the first brace of the pair. Message: "The braces at character {n} would show as {{ in the email. Delete one of them."
- Subject: the same rule on the subject as one run, with `field: "subject"`.
- Removing every space next to a token covers more than the 4 gap rules remove, so every `{{` the gap rules could form is caught. Cost: `{ {{ask:N}} {ask:M}}` is refused, although it renders `{ {ask:M}}`. Accepted: the author can delete one brace.
- Joining runs with nothing between them also refuses a paragraph that ends in `{` followed by one that starts with `{`. Accepted as rare; the message names the character.
- Values are not part of the check. A value the sender types that starts or ends with `{` can form `{{` in that one draft: the sender wrote it. Default texts cannot hold braces (grammar `fchar`). Directory values are not checked.

Examples (input, result; character numbers count the body text from 1):

| Input | Result today | Result with the rule |
|---|---|---|
| Body `{{{ask:N}}{ask:M}}` | saves; N blank gives `{{ask:M}}`, N "7" gives `{7{ask:M}}` | refused, `PH_MALFORMED` at character 1 |
| Subject `Load {{{ask:N}}{ask:M}}` | saves; N blank gives subject `Load {{ask:M}}` | refused, `PH_MALFORMED` at character 6, `field: "subject"` |
| Body `<p><b>{</b>{{ask:N}}{ask:M}}</p>` | saves; N blank shows `{{ask:M}}` | refused at character 1 (the pair spans two runs) |
| Body `{{{ask:N}}` | saves; renders `{7` or `{` | saves, unchanged (skeleton `{`) |
| Body `\{{ask:N}}` | saves; renders the text `{{ask:N}}`, no field (apply semantics 6) | saves, unchanged (skeleton U+E000 `ask:N}}`) |
| Body `{{{sender.name}}{{ask:M}}}` | saves; renders `{Ana Lopez7}` | saves, unchanged (skeleton `{}`) |
| Body `{{ask:N}}{ask:M}}` | saves; N blank gives `{ask:M}}` | saves, unchanged (one `{` in the skeleton) |

Effect on writes. The rule runs inside `scanBody`, so it applies wherever a body is checked: editor Problems list (`src/web/views/editor.ts`), `template.create`, `template.update`, `template.duplicate` (`src/server/handlers/templates.ts` through `prepareFor`), `version.restore` (`history.ts`), import (`transfer.ts`, the file's template is reported as failed). A stored template that breaks the rule keeps rendering as today; its next save, duplicate or restore is refused until a brace is deleted. How many stored templates hold the pattern is unknown (a library search cannot match braces).

Files an implementer touches:
- `src/shared/placeholders/validate.ts`: the skeleton pass in `scanBody` (body) and `scanSubject` (subject).
- `test/unit/shared/placeholders.test.ts`: the 7 examples above, plus one case where the gap rule would join braces (`<b>{ {{ask:N}}</b>{ask:M}}`, refused at character 1).
- `docs/design/wording.md`: one row for the new message.
- `docs/guide/editor-guide.md`: one line next to the `\{{` line (108): "A { right before a field and another after it is refused: delete one of them."
- No change: `grammar.ts`, `render.ts`, the add-on, server handlers, stored data.

## Amendment 2026-11-12: date fields `{{date:Label}}` (D38)

Status: Proposed. The feature is the owner's request of 2026-11-12, made after every test on dev-744bd1d passed: "is it possible to add a type of field that allows to open calendar picker instead of simple text entry field? e.g. in editor have some checkmark or special type of placeholder that would inserts date picker in format MM/DD/YYYY ?" (D38). The mechanism below and the open points Q85 to Q90 stay Proposed until the owner approves. Not built. Spec 5.9 holds the texts, the examples, the files and the tests.

Note on Q78: this amendment and the brace amendment above both change `src/shared/placeholders/validate.ts`. The brace skeleton removes a date token like any token, so the two rules do not conflict. Build them in one slice, or merge the second one with care.

### Platform facts (read 2026-11-12)

| Fact | Source |
|---|---|
| Apps Script has 3 picker classes: `DatePicker` (date only), `DateTimePicker` (date and time), `TimePicker`. `DatePicker`: "An input field that allows inputing a date." "Available for Google Workspace add-ons and Google Chat apps." Methods: `setFieldName`, `setTitle`, `setValueInMsSinceEpoch`, `setOnChangeAction`. `setValueInMsSinceEpoch`: "Only the date of the epoch time is used, and the time of the epoch time is discarded." The page says nothing about an empty value or a time zone | [A45] |
| Event object: "A date-only picker: a DateInput object", at `e.commonEventObject.formInputs.<name>.dateInput`; `msSinceEpoch` is "The time selected by the user, in milliseconds since epoch (00:00:00 UTC on 1 January 1970)." Legacy `formInput` and `formInputs`: "Date and time picker widget values can't be read from this field." The page does not say which time of day a date-only value carries | [A13], re-read 2026-11-12 |
| Card JSON `DateTimePicker`: `valueMsEpoch` for `DATE_ONLY` is "a calendar date at 00:00:00 UTC"; `timezoneOffsetDate` "If unset, the value defaults to the user's time zone setting"; `onChangeAction` is "Triggered when the user clicks Save or Clear". Availability: "Google Chat apps and Google Workspace add-ons"; Gmail is not named for the picker | [A46] |
| The user's time zone reaches the event only with `useLocaleFromApp: true` and the scope `script.locale` (an 11th scope; not wanted) | [A13] |
| Not stated in any page read: whether the picker can show no date; whether it works in Gmail's draft popup and in the side panel; whether its value reaches a compose-action callback (Q68 verified text boxes only); how it counts toward the 100-widget limit (assumed one widget, like a `TextInput`) | Q85, Q86 |

### 1. Syntax

Options:
1. `{{date:Label}}`, a sibling of `{{ask:Label}}`: the same label rule (1 to 40 characters, none of `{ } | \ < >`, `LABEL_MAX`), the same escape, no default text. One more regex alternative.
2. A flag after the label, `{{ask:Label|date}}`. Collides with `PH_FALLBACK_ASK` (a field takes no `|`) and reads as default text "date".
3. A setting per field stored outside the token, in item metadata. Export, import, history and version restore would each have to carry it.

Decision: option 1. Regex, alternatives in this order (group 1 the kind, 2 the label, 3 a variable name, 4 a fallback):

```
/\\\{\{|\{\{ *(?:(ask|date): *([^{}|\\<>\r\n]{1,40}?)|([a-z][a-z_]*\.[a-z][a-z_]*)(?: *\|([^{}\\<>\r\n]{0,80}?))?) *\}\}/g
```

The `prompt` segment gains `type: "text" | "date"`. Identity is unchanged: `promptKey(label)`, shared by subject and body. Implicit prompts (a variable with no value) stay text.

### 2. Save validation

- One label used as a text field and as a date in one template (subject and body together): refused, new code `PH_FIELD_TYPE`, at the offset of the later token. Rejected alternative: the first type wins, which would silently change what the later token asks.
- `{{date:X}}` twice, in any letter case or spacing: one field, one picker.
- `{{Date:X}}`: `PH_CASE`. `{{date:X|y}}`: `PH_FALLBACK_ASK`. An empty or long label: `PH_LABEL`. The lenient pass recognizes `date` wherever it recognizes `ask`.
- `PH_TOO_MANY` counts text and date fields together (20 at most).

### 3. Gmail details card

Options for the widget:
1. `CardService.newDatePicker()`, field name `p-<n>`, the label as title, in the place a text box would sit, in template field order.
2. `newDateTimePicker()`. It asks for a time the template does not use. The orchestrator's default named `DateTimePicker` for "date only"; in Apps Script that class is `DatePicker` [A45], so option 1 follows the default's intent.
3. A text box with the hint "MM/DD/YYYY". No calendar, which the owner asked for. Kept as the fallback if Q86 fails.

Decision: option 1. Reading: `dateInput.msSinceEpoch` from `commonEventObject.formInputs["p-<n>"]`, a number or a numeric string; both are accepted. No entry, or no finite number: no date. The card keeps the picked value as its ms string in `entered`; a re-rendered card sets it back with `setValueInMsSinceEpoch`.

Conversion to MM/DD/YYYY, one shared function `dateText(raw)`:
1. `n = Number(raw)`. Not finite: "".
2. `day = Math.round(n / 86_400_000)`; `d = new Date(day * 86_400_000)`.
3. `MM = d.getUTCMonth() + 1`, `DD = d.getUTCDate()`, `YYYY = d.getUTCFullYear()`, with leading zeros to 2, 2 and 4 digits, joined by "/". A year outside 1000 to 9999: "".

Why the picked day is the day written in every time zone: the card reference says a date-only value is that date at 00:00:00 UTC [A46], and UTC getters read that date back unchanged, whatever the script time zone (`appsscript.json`: America/New_York) or the user's zone. The rounding also covers a Gmail that sends local midnight instead: it gives the picked day for zones from UTC-11:59 to UTC+11:59 (the Americas, Europe, Africa, most of Asia). For UTC+12 and later (New Zealand, Fiji, Tonga) it would give the day before (Q87). The code never uses `getDate()`, `getMonth()`, `Utilities.formatDate` with `Session.getScriptTimeZone()`, or the event's `timeZone`.

### 4. Unpicked date and one-click insert

A date field with no picked date is a field without a value: it is removed with the 4 gap rules of Amendment 2026-11-11, on the row Insert and on the details card (D31). If Gmail cannot draw a picker with no date (Q85), an untouched picker inserts the date it shows. Recommendation in Q85.

### 5. Counting and limits

- The row hint "n fields to fill" counts date fields: `item.prompts` holds every field label.
- The 500-character check (`tooLong`) skips date fields. `rc` and `rh` concern recipients, not fields.
- Widgets: one picker per date field, in place of one text box. Card totals stay as measured (details card worst 52).

### 6. Subject

Allowed, as `{{ask:}}` is. The subject gets the date as plain text.

### 7. Rollout and old builds

No stored template can hold `{{date:` before this build: today's `scanBody` refuses it as `PH_MALFORMED`, on save and on import. So nothing is migrated. The add-on, the server and the web app ship in one Apps Script version (D15), so the add-on never meets an older server. Two old clients remain:
- A web page loaded before the deploy keeps its old bundle. Its editor shows `{{date:X}}` as plain text with the Problems line "The field at character n is not valid. Delete it and use Insert field."; its save still reaches the new server, which accepts the unchanged token. No data is lost. No version check exists: `clientVersion` is sent and never compared (Q90).
- A rollback below this build (ADR-0005) brings back a renderer that treats `{{date:X}}` as plain text, so drafts get the token as text (Q89).

### Consequences of the amendment

- Easier: a calendar on the card, one format, no mistyped dates.
- Harder: a second field kind in the parser, the editor, the card and the render; one more Gmail check before prod (Q85, Q86).
- Revisit if the owner wants another date format: one function and one wording row change.

## Consequences

- Easier: one grammar, one regex, one registry; unresolved values become prompts, so nothing ships empty. Server-side sanitizing keeps the stored body safe for every client.
- Harder: the editor schema limits formatting to what the sanitizer allows. Pasted rich layouts are normalized.
- `htmlparser2` and the editor add bundle size. Slice 1 records the bundle size; target under 400 KB for the web app HTML.
- Revisit after the slice 4 spike (allowlist, size cap), and when v1.1 adds prompt types.

## Open questions

- Q78 (spec section 15, Amendment 2026-11-12): save rule for braces that join around a field. Recommendation: option 1.
- Q85 to Q90 (spec section 15, Amendment 2026-11-12: date fields): picker with no date, picker in the Gmail surfaces, time of day of the value, editor entry, rollback, old web pages.
- Q20, Q21 (spec section 15): closed 2026-11-10. Q20 by spike S5 (one response, no new scope); Q21 by D24.
- Q25 (spec section 15): prompts used only in the subject are asked while "Replace the subject" is off. Recommendation: accept in v1.

- Q9. Does `domain_public` return `organizations` and `phones`? Recommendation: test in slice 2; fallback `searchDirectoryPeople` with `directory.readonly` (one consent line, replaces `admin.directory.user.readonly`).
- Q11. External recipient first names need `contacts.readonly` or `contacts.other.readonly` (user consent, sensitive). Recommendation: not in v1; external recipients use the fallback or the implicit prompt.
- Q12. Image hosts: any `https` host, or a list? Recommendation: any `https` host in v1, `IMG_HOSTS` config available to restrict.

## Sources

- [A45] https://developers.google.com/apps-script/reference/card-service/date-picker, read 2026-11-12.
- [A46] https://developers.google.com/workspace/add-ons/reference/rpc/google.apps.card.v1 (`DateTimePicker`, `DateTimePickerType`, Columns), read 2026-11-12.
- [A13] re-read 2026-11-12 for `DateInput`, the legacy `formInput` note and `timeZone`.
- [R1 S24], [R2 S8, S16, lessons], [R3 S4, S12, S26], [R4 S3 to S5b, S8, S18, S26, S28, S29, S35, S36, S65, S78], read 2026-11-09.
- [A5] https://developers.google.com/workspace/add-ons/concepts/event-objects, read 2026-11-09.
- [A6] https://developers.google.com/workspace/admin/directory/v1/guides/manage-users (domain_public, contact sharing, fields not listed), read 2026-11-09.
- [A13] https://developers.google.com/workspace/add-ons/concepts/event-objects (6 documented Gmail fields, no `subject`, no `draftMetadata`), read and re-read 2026-11-10. Corrected 2026-11-10: the live compose event carries `subject` (owner smoke runs "Slice 5b" dev-4a233d4 and "Slice 5c" dev-848206f).
- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui (`UpdateDraftActionResponse`, subject example, one action per example, no per-action scope, no mobile note), read 2026-11-10.
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder and https://developers.google.com/apps-script/reference/card-service/update-draft-subject-action, read 2026-11-10.
- [A16] https://developers.google.com/workspace/gmail/api/auth/scopes (`gmail.addons.current.action.compose`, non-sensitive), read 2026-11-10.
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder, re-read 2026-11-11: 6 methods (body, subject, To, Cc, Bcc, build); no notification and no navigation.
