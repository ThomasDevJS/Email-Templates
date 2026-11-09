# ADR-0004: Placeholders and HTML safety

Status: Accepted 2026-11-09 (orchestrator, by owner delegation; was Proposed)
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

Tokens are recognized only inside one HTML text node, after the sanitizer has decoded entities. A token split across elements (`{{<b>sender</b>.name}}`) is a save error.

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
3. Unresolved variable with a fallback: the fallback is used. Unresolved variable without a fallback becomes an implicit prompt ("Your phone", "Recipient first name"). No placeholder ever renders as empty text by accident.
4. Prompt card: one `TextInput` per explicit and implicit prompt, with ID `p-<n>` (`[a-zA-Z0-9-]+`, max 64 chars [R4 S36]). The Apply callback rejects the request and re-renders the card with "Fill 2 fields: Meeting date, Your phone" if any value is blank. The callback is the enforcement point. Slice 4 also tries `Action.setRequiredWidgets` for earlier feedback (availability in Gmail unverified).
5. Values: plain text, max 500 characters, HTML-escaped (`& < > " '`), newline becomes `<br>`. Fallbacks and Directory values get the same escaping. Rendering never creates markup from values.
6. Escape: `\{{` renders as the literal `{{`.
7. Insert: `UpdateDraftBodyAction` with `MUTABLE_HTML` and `UpdateDraftBodyType.IN_PLACE_INSERT` [R4 S4, S5b]. The rendered HTML is the sanitized stored body with tokens replaced. Subject is not touched in v1.

### Sender values: option 1, server-side Directory `domain_public`

- Server calls `AdminDirectory.Users.get(callerEmail, { viewType: 'domain_public', projection: 'basic' })`. Scope `admin.directory.user.readonly` in the one manifest (revised 2026-11-09, D15): self-installing users see "See info about users on your domain" [A10 in ADR-0002]; the admin domain install skips that screen [R4 S60]. Only web app code calls it.
- Mapping: `sender.name` = `name.fullName`. `sender.title` = `organizations[primary].title`, else `organizations[0].title`. `sender.department` = same organization's `department`. `sender.phone` = first `phones[]` with `type = work`, else `phones[0].value`.
- Cache: profile map in Script Cache, 6 h TTL. Directory changes show within 6 h; admin "Refresh memberships now" also clears profiles.
- The same lookup gives `name.givenName` for internal recipients.
- Fallback if slice 2 shows `organizations` or `phones` missing in `domain_public`: option 3 (`searchDirectoryPeople`, scope `directory.readonly`, replaces `admin.directory.user.readonly` on the consent list). Option 2 is rejected because it adds 3 consent lines where option 1 adds 1.

### HTML sanitizer: option 1, server-side allowlist on htmlparser2

Runs on every write: save, restore, import. Output is canonical (attributes sorted, quotes normalized) and idempotent: `sanitize(sanitize(x)) == sanitize(x)`. The web app runs the same module on paste for preview only; the server result is authoritative.

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

Size: sanitized body max 100 KB until the slice 4 spike sets the final cap (largest size that inserts on all 3 clients, divided by 2).

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

Clients: Gmail web on Chrome (acceptance target), Gmail Android app, Gmail iOS app. Record per fixture and client: inserted (y/n), styles kept, time in ms, and how the sent message renders in a Gmail web recipient. Output: docs/spikes/slice-04-insert.md (written by the implementer) and an update to this ADR with the trimmed allowlist and the final size cap.

### Signature duplication (v2 notes, no v1 work)

- Gmail adds the user's own signature to new messages. A signature inserted into the draft duplicates it [R2 S8, S16].
- `INSERT_AT_END` lands after the signature on Gmail web and before it on mobile [R4 S4].
- The add-on cannot read the draft body with the compose scope, so it cannot detect an existing signature.
- Options for v2: (a) "Set my Gmail signature" with the user's own token and `gmail.settings.basic` (restricted, no verification for an internal app) [R4 S26, S18], and never insert; (b) insert only and ask users to clear their Gmail signature; (c) central push with domain-wide delegation, super admin approval, service account key risk [R4 S29, S65]. Recommendation for v2: (a). Validate signature HTML under 10,000 characters [R4 S28], store a plain-text variant for mobile [R2 lessons].
- v1 templates that end with a sign-off and `{{sender.name}}` may duplicate a Gmail signature. The quick start (slice 7) tells authors to leave sign-offs to the Gmail signature.

## Consequences

- Easier: one grammar, one regex, one registry; unresolved values become prompts, so nothing ships empty. Server-side sanitizing keeps the stored body safe for every client.
- Harder: the editor schema limits formatting to what the sanitizer allows. Pasted rich layouts are normalized.
- `htmlparser2` and the editor add bundle size. Slice 1 records the bundle size; target under 400 KB for the web app HTML.
- Revisit after the slice 4 spike (allowlist, size cap), and when v1.1 adds prompt types.

## Open questions

- Q9. Does `domain_public` return `organizations` and `phones`? Recommendation: test in slice 2; fallback `searchDirectoryPeople` with `directory.readonly` (one consent line, replaces `admin.directory.user.readonly`).
- Q11. External recipient first names need `contacts.readonly` or `contacts.other.readonly` (user consent, sensitive). Recommendation: not in v1; external recipients use the fallback or the implicit prompt.
- Q12. Image hosts: any `https` host, or a list? Recommendation: any `https` host in v1, `IMG_HOSTS` config available to restrict.

## Sources

- [R1 S24], [R2 S8, S16, lessons], [R3 S4, S12, S26], [R4 S3 to S5b, S8, S18, S26, S28, S29, S35, S36, S65, S78], read 2026-11-09.
- [A5] https://developers.google.com/workspace/add-ons/concepts/event-objects, read 2026-11-09.
- [A6] https://developers.google.com/workspace/admin/directory/v1/guides/manage-users (domain_public, contact sharing, fields not listed), read 2026-11-09.
