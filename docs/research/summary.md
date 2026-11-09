# Phase 1 summary: recommended v1 feature set and owner decisions

Orchestrator, 2026-11-09. Inputs: r1-gmail-templates.md, r2-signature-managers.md, r3-snippet-and-crm-templates.md, r4-platform-constraints.md, feature-matrix.md, ux-notes.md. 209 sources, all read 2026-11-09. Citations: [R4 S13] means docs/research/r4-platform-constraints.md, source S13.

## 1. What the market lacks

No tool found combines folder grants to Google Groups, version history with restore, favorites, data inside Workspace and $0 per user (feature-matrix.md section 4). Gmail native Templates have no sharing, folders, variables or recovery [R1 S11, S16]. Ablebits comes closest on features but is a Chrome extension storing data on AWS at $3 to $4 per user [R1 S3, S9, S1]. TextExpander alone has version restore [R3 S6]. Favorites appear only in Ablebits [R1 S1].

## 2. Recommended v1 feature set

| Area | v1 | Deferred | Why |
|---|---|---|---|
| Permissions | Folder-level grants, 3 levels (use, edit, manage), to Google Groups or OUs, subfolders inherit, default deny, admins see all | Per-template overrides | TextExpander and Salesforce model, fewest lookups [R3 S2, S41]. HubSpot and Gmelius defaults cause edit complaints [R3 S9, S14, S27] |
| Templates | Create, edit, duplicate, move, soft delete, nested folders, tags | Attachments | Attachments need public links or Drive sharing [R3 S30]. Out of v1 |
| Placeholders | `{{sender.name}}`, `{{sender.title}}`, `{{sender.phone}}`, `{{sender.department}}`, `{{recipient.first_name}}`, `{{ask:Label}}` prompts, `{{var|fallback}}`, `\{{` escape. Apply blocked until prompts filled. Unknown names fail at save | Dropdown and date prompts, greeting switch, conditionals | Double-brace family of Briskine, Gmelius, Salesforce [R3 section 8]. HubSpot ships unfilled prompts [R3 S12]. Syntax is final in ADR-0004 |
| Apply | Compose sidebar: search, Favorites, Recent, folders, one-tap apply at cursor as editable HTML | Keyboard abbreviations | `IN_PLACE_INSERT` and `MUTABLE_HTML` [R4 S4, S5b]. Abbreviations need a content script, Chrome extension rejected |
| Versioning | New version per save, restore creates a new version, 30-day trash | Diff view | TextExpander restore [R3 S6], Briskine trash [R3 S25] |
| Search and favorites | Fuzzy over title, folder, tags, body, `folder:` and `tag:` operators, last-used sort, per-user favorites in both surfaces | Saved searches | Briskine [R3 S23, S28] |
| Admin UI | Folders and grants, audit log (who, what, when, before, after), apply count per template, JSON export and import at folder and library level | Scheduled exports | Ablebits exports whole teams only [R1 S25]. TextExpander usage reports [R3 S8] |
| Analytics | Apply counts from the audit log | Open and click tracking | Tracking needs external servers, out of scope |
| Signatures | Data model reserves `kind`, `scope`, `targets`, `priority`, `variants`, `sendAs`, `lockedFields`, `schedule`, push log | All signature features | R2 field list, lessons section |
| Mobile | Add-on sidebar works in Gmail mobile per Google, best effort | Mobile-specific UI | [R4 S38], brief A7 |

## 3. Platform facts that fix the architecture (for Phase 2)

1. Add-ons always run as the user. Only the web app can run as its owner [R4 S11, S12]. Storage shared to users is readable in Drive without the permission layer. ADR-0002 and ADR-0003 must keep storage private to the owning account and route reads through a server that enforces permissions.
2. Directory API group lookup needs an admin role. The prebuilt Groups Reader role works through the Admin API [R4 S21]. GroupsApp needs no admin but resolves direct membership only [R4 S22, S23]. Cloud Identity transitive APIs need Enterprise Standard or higher [R4 S24].
3. Properties hold 500 KB total, so templates cannot live there [R4 S2]. Cache holds 100 KB per value and evicts FIFO [R4 S30, S66]. SpreadsheetApp costs about 800 ms per read and write pair versus 63 ms for Cache (third party) [R4 S72]. The sidebar 3 s target needs a cache hit on the hot path.
4. Draft insert HTML size, tags and style survival are undocumented [R4 S3, S35]. Slice 4 opens with a spike on web, Android and iOS.
5. Test deployments make pilot users script editors [R4 S13]. Marketplace publishing needs a standard GCP project and the switch is one way [R4 S14, S61].
6. Chrome extension: Chrome Web Store fee, Gmail DOM coupling, Chrome browser management per OU, InboxSDK error logs to Streak, no Gmail mobile [R4 S31 to S34]. Reject in ADR-0001.
7. None of the needed scopes requires Google verification for an internal app in one domain [R4 S17, S18]. Recipient first name costs the sensitive `gmail.addons.current.message.metadata` scope [R4 S8].

## 4. Decisions for the owner (gate G1)

| ID | Question | Recommendation | Why |
|---|---|---|---|
| D4 | Chrome extension as fallback channel | No. Close the question | Section 3 item 6 |
| D7 | Which Workspace edition does Migway have, do role groups contain other groups, does the admin restrict API access to apps | Owner answers three facts before Phase 2 | They choose between GroupsApp (direct members, no admin), Groups Reader on a service mailbox, and Cloud Identity APIs [R4 section 8 options A to E] |
| D8 | Role resolution path for v1 | Web app "execute as me" is the single server. Storage private to that account. Add-on fetches through it. Membership via GroupsApp where the service mailbox owns the role groups, upgraded to Groups Reader when an admin grants it. Flat role groups in v1 | Works with no admin role on day one. Architect confirms the add-on to web app call in ADR-0003 |
| D9 | Placeholder syntax | Dotted double braces, `{{ask:Label}}`, `{{var|fallback}}`, `\{{` | Section 2, Placeholders |
| D10 | Recipient first name placeholder | Include. Costs one sensitive scope, no verification for an internal app | [R4 S8, S18] |
| D11 | Personal templates for the user role | Yes. One private folder per user, same grant model | Every tool researched allows personal templates. Costs one folder row per user |
| D12 | Attachments | Out of v1 | [R3 S30], brief data rules |
| D13 | Pilot path before the admin install | 2 to 3 trusted colleagues as script editors on the test deployment. Wider pilot waits for the private Marketplace app in 2.5b | [R4 S13] |
| D14 | Storage backend | Architect decides in ADR-0002 between Sheets, Drive JSON and a Sheets index plus Drive bodies, all behind Cache | Latency and size facts in section 3 item 3. Firestore stays out (brief) |

## 5. Open questions carried to Phase 2

1. Draft insert HTML limits and style survival (spike in slice 4) [R4 open question 4].
2. `google.script.run` payload size, HtmlOutput size, LockService max wait [R4 open questions 5, 6].
3. Whether a non-admin can read `orgUnitPath` via `domain_public` [R4 open question 7]. OU-based grants may need the admin path.
4. Add-on to web app call pattern: UrlFetch with the user's OAuth token to the `/exec` URL, or a precomputed index the add-on can read. Architect, ADR-0003.
5. Sensitivity labels for `script.*`, `admin.directory.*`, `groups`, `cloud-identity.groups.readonly`. Check in Cloud console during 2.5b [R4 open question 9].

## 6. Gate G1 status

All six research files are present and cited. Owner approval of section 2 and answers to D4 and D7 to D14 end Phase 1.
