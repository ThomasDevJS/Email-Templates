# UX notes (Phase 1 synthesis)

Orchestrator synthesis of R1 to R4, 2026-11-09. Citations as in feature-matrix.md: [R3 S21] means docs/research/r3-snippet-and-crm-templates.md, source S21. Review quotes from G2, Capterra and TrustRadius reached the researchers only as search excerpts (HTTP 403 on direct fetch) and are unverified.

## 1. What the best tools do well

| Pattern | Who does it | Evidence | Migway v1 |
|---|---|---|---|
| Three access levels on a folder: use, edit, manage | TextExpander snippet groups, Salesforce folders | Can expand, Can edit, Can manage [R3 S2]. Viewer, Editor, Manager (unverified) [R3 S20] | Adopt. user = use, manager-editor = edit, admin = manage |
| Private by default, share deliberately | TextExpander, Salesforce, Briskine | Just Me default [R3 S3]. Private default [R3 S21] | Adopt. Default deny |
| Org admins see and manage everything | TextExpander, HubSpot | Org admins are admins of every group [R3 S2]. Super Admins see private templates [R3 S11] | Adopt |
| Prompted fields with default and required flag | Ablebits, TextExpander | Text, dropdown, date, time, required, default [R1 S6]. `%filltext:name=x:default=y%` [R3 S4] | Adopt text prompts in v1, dropdown and date in v1.1 |
| Same-name prompt filled once, reused | TextExpander | Same-name fields stay in sync [R3 S4] | Adopt |
| Greeting that changes for one or many recipients | Ablebits | Insert greeting macro [R1 S6] | v1.1 candidate |
| Fallback value for a missing variable | Briskine, HubSpot | `{{or}}` helper [R3 S26]. Per-token defaults (unverified) [R3 S17] | Adopt, `{{recipient.first_name|there}}` proposal |
| Restore any prior version or deleted item | TextExpander | Snippet Activity log with restore [R3 S6] | Adopt, linear history |
| Trash with a retention window | Briskine | 30 days [R3 S25] | Adopt, 30 days |
| Fuzzy search with field operators, sort by last use | Briskine | `tag:`, `title:`, `to:` operators, last-used sort [R3 S23, S28] | Adopt `folder:` and `tag:`, last-used sort in sidebar |
| Suggest a template for approval | TextExpander Limited role and Snippet Requests | [R3 S5] | v2 candidate |
| Usage per template | TextExpander reports | Expansions per snippet, CSV [R3 S8] | Adopt apply counts from the audit log |
| Lock fields that users must not edit | WiseStamp, Signitic signatures | Template locking, field-level permissions [R2 S15]. Locked brand elements [R2 S26] | Reserve `lockedFields` in the data model for v2 |
| Keep assignments stable across renames | Rocketseed complaint shows the failure | Renaming drops group assignments [R2 S43] | Reference groups and folders by ID, never by name |
| One-click insert from a sidebar | Ablebits side panel | [R1 S3] versus Gmail's 3-click menu [R1 S11] | Adopt. Compose sidebar with search, recent, favorites |

## 2. Where users complain

| Complaint | Tool | Evidence | Design response |
|---|---|---|---|
| Anyone on the team can edit shared content | HubSpot, Gmelius | Owner-only edit requested [R3 S14]. Edit on share by default [R3 S27] | Separate use from edit. Edit only for manager-editor in that folder |
| New templates shared with everyone by default | HubSpot | [R3 S9] | New folders visible to admins only until shared |
| Unfilled placeholder text goes out in the email | HubSpot | Fill-in-the-blank idea thread [R3 S12] | Apply blocked until every prompt has a value |
| Silent empty output hides typos in variable names | Briskine | Unknown single word renders empty [R3 S26] | Unknown variable names fail at save time in the editor |
| Wrong brace count ships a broken field | Salesforce | Triple braces, user error (unverified) [R3 S43] | Double braces only, editor inserts tokens as chips |
| Editor inserts tags that break placeholders | Ablebits | `<span>` breaks macros, fix by hand-editing HTML [R1 S24] | Tokens stored as atomic nodes. Sanitizer fixture test keeps tokens intact |
| Hard to learn template features | Ablebits | "takes a while to figure out" (Chrome Web Store, 2026-03-24) [R1 S30] | Empty states that explain folders, roles and placeholders. Quick start doc |
| Large libraries are hard to organize | TextExpander | G2 excerpt (unverified) [R3 S47] | Folders plus tags plus search plus favorites. Publish the 1,000-template design target |
| No subfolders, folders vanish on filter | HubSpot | [R3 S15] | Nested folders with inherited grants |
| Slow load | Gmelius | "10+ seconds to load an email" (unverified) [R3 S50] | Cache the index. Targets: sidebar 3 s, apply 2 s, list 1 s |
| Deleted template is gone for good | Gmail Templates | "you can't recover it" [R1 S11] | Soft delete, trash, version history |
| Inserted content cannot be edited inline | Gmail Layouts | [R1 S13] | Insert as `MUTABLE_HTML` [R4 S5b] |
| Layout feature present but broken for some users | Gmail Layouts | Community thread (unverified) [R1 S32] | Clear error states with a retry and a support contact |
| Per-team item cap | Ablebits | 512 items per team [R1 S1] | No hard cap below the 10x design target. Paginate sidebar lists under 100 widgets [R4 S9] |
| Needs Chrome or Edge, fails with third-party cookies blocked | Ablebits | [R1 S5, S24] | Workspace add-on runs in any browser and in Gmail mobile [R4 S38] |
| Separate mobile app required | Gmelius | [R3 S50] | Add-on sidebar works in Gmail mobile, best effort per brief A7 |
| Signature duplicated when two mechanisms run | Exclaimer, WiseStamp | [R2 S8, S16] | v2: push the Gmail signature or insert into the draft, never both |
| Oversized signature rejected silently | WiseStamp | Over 10,000 characters fails without error [R2 S16] | v2: count characters in the editor, reject over 10,000 |
| Multiple signed-in Google accounts break the app | Apps Script platform | Not supported [R4 S50] | Quick start documents the workaround. Web app shows a clear message when the active user is blank |

## 3. Platform facts that shape the UI

| Fact | Effect on design | Source |
|---|---|---|
| Card Service has no rich text editor and 8 text tags | Sidebar lists, searches, previews plain text, applies. Editing lives in the web app | [R4 S10] |
| 100 widgets per section | Folder and template lists paginate or collapse | [R4 S9] |
| 30 s add-on callback | Every sidebar action reads from cache first | [R4 S2] |
| `openLink` OVERLAY with RELOAD_ADD_ON | "Edit in web app" opens the editor and refreshes the sidebar on close | [R4 S40] |
| `IN_PLACE_INSERT` at cursor, `MUTABLE_HTML` | Apply inserts at the cursor and stays editable | [R4 S4, S5b] |
| Recipient names need `draftAccess: METADATA` and a sensitive scope | Recipient first name placeholder costs one sensitive scope, no verification for an internal app | [R4 S3, S8, S18] |
| Draft insert HTML rules undocumented | Slice 4 spike tests tables, inline styles, images, 50 KB and 200 KB bodies on web, Android, iOS | [R4 S3, S35] |
| Web app runs in an IFRAME sandbox, links need `target="_top"` | Editor layout and links follow HtmlService rules | [R4 S46] |
| `google.script.run` allows 10 concurrent calls | Web app batches reads, loads list then details | [R4 S49] |
| Test deployment testers must be script editors | Pilot group stays small until the private Marketplace app exists | [R4 S13] |

## 4. Recommended screens (input to Phase 2 wireframes)

1. Sidebar home: search box, Favorites, Recent, folder tree. One tap per template to apply. Pagination under 100 items.
2. Sidebar prompt card: one TextInput per `{{ask:...}}` field, Apply button disabled until all filled.
3. Web app library: folder tree, template list with last edited and apply count, search with operators, favorites star.
4. Web app editor: rich text, placeholder chips from a menu, live preview with the current user's Directory values, save creates a version.
5. Web app history: version list, diff or preview, Restore button creates a new version.
6. Admin: folders and grants (group or OU to role), audit log table with filters, export JSON.
7. States: empty folder, no permission (default deny message), loading skeleton, error with retry, trash with restore.
