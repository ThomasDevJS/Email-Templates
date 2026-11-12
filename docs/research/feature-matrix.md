# Feature matrix (Phase 1 synthesis)

Orchestrator synthesis of R1 to R4, 2026-11-09. Each cell cites the research file and its source tag, e.g. [R1 S6] means docs/research/r1-gmail-templates.md, source S6. Primary URLs and read dates live in those files. "unverified" carries over from the research files.

## 1. Template tools

| Feature | Gmail Templates | Gmail Layouts | Ablebits Shared Templates | TextExpander | Briskine | Gmelius | HubSpot Sales templates | Salesforce Lightning |
|---|---|---|---|---|---|---|---|---|
| Delivery | Gmail web menu, 3 clicks [R1 S11] | Compose Layouts icon [R1 S13] | Chrome extension side panel, Chrome and Edge only [R1 S3, S5] | Desktop app and Chrome extension, abbreviation or picker [R3 S7] | Chrome extension dialog, shortcut, sidebar [R3 S23] | Chrome extension, compose icon, hashtag [R3 S27, S35] | Chrome extension (Gmail), add-in (Outlook) [R3 S9] | Record email composer button [R3 S44] |
| Mobile | None [R1 S11] | Not documented | None, inference [R1] | Desktop and Chrome only | Not documented | Separate mobile app, complaint [R3 S50] | Not documented | n/a |
| Sharing unit | None, personal only [R1 S16] | Drive file sharing [R1 S13] | Team (shared folder) [R1 S8] | Snippet group [R3 S2] | Per template [R3 S21] | Per template [R3 S27] | Per template, users or teams [R3 S11] | Folder, subfolders inherit (unverified) [R3 S20, S41] |
| Access levels | n/a | Edit or preview [R1 S13] | Admin, Editor, User read-only [R1 S7] | Can expand, Can edit, Can manage [R3 S2] | Access list plus edit list [R3 S21] | Edit on share unless owner locks [R3 S27] | Use and edit not separated [R3 S11] | Viewer, Editor, Manager (unverified) [R3 S20] |
| Default visibility | Private | Private | Personal | Just Me [R3 S3] | Private [R3 S21] | Edit on share [R3 S27] | Shared with everyone [R3 S9] | Private (unverified) [R3 S40] |
| Identity source | Google account | Workspace | Own member list, Directory import needs admin [R1 S8, S18] | Org members, teams, guests [R3 S3] | Team members | Team members | HubSpot users and teams | Users, public groups, roles, territories (unverified) [R3 S20] |
| Admin override | n/a | Admin console on/off per OU [R1 S14] | Company account dashboard [R1 S8] | Org admins manage every group [R3 S2] | Not documented | Super Admin role [R3 S33] | Super Admin [R3 S11] | "Manage Public" permission [R3 S40] |
| Folders | None, flat [R1 S11] | Drive | Folders inside teams [R1 S1] | Groups, no nesting documented | Tags only [R3 S22] | Categories as folders [R3 S27] | One level, no subfolders [R3 S15] | Nested folders (unverified) [R3 S41] |
| Placeholders | None [R1 S26] | Mail merge tags [R1 S14b] | Recipient name, greeting switch, prompted text, dropdown, date, time, conditionals, Sheets datasets [R1 S6] | `%filltext:name=x:default=y%`, popup, area, optional part [R3 S4] | `{{to.first_name}}`, `{{or}}` fallback, `\{{` escape [R3 S24, S26] | `{{your.variable}}`, modal on missing [R3 S34] | Token chips, placeholder token, defaults since 2025-10 (unverified) [R3 S12, S17] | `{{{Recipient.FirstName}}}` (unverified) [R3 S42] |
| Prompted fields | None | None | Yes, with default and required [R1 S6] | Yes, fill-in window [R3 S4] | None [R3 S24] | Modal for custom variables [R3 S34] | Yes, but unfilled text is sent [R3 S12] | None documented |
| Rich text and images | Not documented by Google | Logo, images, buttons [R1 S13] | Pictures, tables, buttons, HTML view, attachments [R1 S2, S23] | Plain, rich, script [R3 S4] | Rich text, attachments as public links [R3 S30] | Rich text, 25 MB attachments [R3 S35] | Rich text, documents, video [R3 S9] | Rich text, files [R3 S44] |
| Version history | None, delete is permanent [R1 S11] | Not documented | None, Deleted items folder [R1 S10] | Yes, restore, 24 h to unlimited by plan [R3 S1, S6] | None, 30-day trash [R3 S25] | Not documented | Not documented | Not found |
| Search | None | n/a | Quick search, tabs [R1 S1] | Inline search [R3 S7] | Fuzzy plus operators, sort by last use [R3 S23, S28] | Not documented | List filters | Related entity filter [R3 S44] |
| Favorites | None | None | Favorite tab [R1 S1] | None documented | None, last-used sort [R3 S23] | None documented | None documented | None documented |
| Import and export | None [R1 S11] | None | XML and HTML zip, whole team only, Gmail status conflicting [R1 S19, S25] | Not researched | Not documented | Not documented | Not documented | Metadata API (not researched) |
| Usage analytics | None | None | Not documented | Expansions per snippet, hours saved, CSV [R3 S8] | None documented | Company analytics role [R3 S33] | Template ID on send, reports (unverified) [R3 S19] | Not researched |
| Data location | Google | Drive [R1 S13] | Ablebits database on AWS [R1 S9] | TextExpander servers | Briskine servers [R3 S30] | Gmelius servers | HubSpot | Salesforce |
| Limits | "50 per account" unverified [R1 S27] | 10,000 chars, 40 images, 50 tiles, 25 MB [R1 S13] | 512 items per team, 1,024 Enterprise [R1 S1] | Not documented | Not documented | Not documented | 10,000 templates, 5,000 snippets, 2,500 chars per snippet [R3 S13, S39] | Not researched |
| Price per user per month | Included | Included, Business Standard and up [R1 S15] | $3.00 Business, $4.00 Enterprise, annual [R1 S1] | $5 or $6 Pro, $10 or $12 Business [R3 S1] | $7 Premium [R3 S31] | $19 to $40 annual [R3 S36] | $7 Starter annual to $150 Enterprise [R3 S39] | $25 to $550 [R3 S46] |

## 2. Signature managers (v2 input)

| Feature | Exclaimer | WiseStamp | BulkSignature | Signitic | Rocketseed | CodeTwo |
|---|---|---|---|---|---|---|
| Google Workspace | Yes [R2 S1] | Yes [R2 S15] | Yes [R2 S20] | Yes [R2 S23] | Yes [R2 S29] | No, announced 2024-06-27, not shipped [R2 S11] |
| Gmail API settings write | Yes, client-side [R2 S3] | Yes, Basic and Grow [R2 S16] | Yes [R2 S20] | Inferred, unverified [R2 S24] | Yes, via customer service account with DWD [R2 S30] | n/a |
| Server-side rewrite | Yes, SMTP relay [R2 S2] | Platform plan [R2 S19] | No | No | Yes [R2 S29] | n/a |
| Browser extension | No | Yes [R2 S15] | Yes, replies since 2026-05-21 [R2 S21] | Yes [R2 S25] | No | n/a |
| Admin grant | Licensed Super Admin, Marketplace install [R2 S3] | Super Admin, whole org, API Data Access granted [R2 S16] | Admin Marketplace install, Chrome force-install [R2 S20, S21] | Super Admin connector [R2 S23] | Manual DWD, key file sent to vendor [R2 S30] | n/a |
| Targeting | User, role, department, sender, recipient, first rule wins [R2 S1, S6] | Departments, groups, OUs, rules [R2 S15] | User, group, OU, department, location [R2 S20] | OUs only, not groups [R2 S23] | Department, title, seniority, location [R2 S29] | n/a |
| Directory variables | Directory and HRIS [R2 S1] | Name, title, department, phone, custom [R2 S15] | Name, title, department, phone, office, 24 h sync [R2 S20] | Mapped import rules, user edits with approval [R2 S26] | Name, title, phone, department [R2 S29] | n/a |
| Reply signature | Server-side only [R2 S6] | Not documented | Extension only [R2 S21] | Not documented | User sets reply default manually [R2 S30] | n/a |
| Duplicate handling | User removes manual signature [R2 S8] | Cannot detect manual signatures [R2 S16] | Not documented | Not documented | Not documented | n/a |
| Admin UI worth copying | Rules with priority, Sent Items copy [R2 S9] | Locked fields, Admin, Designer, IT roles, audit log, auto-deactivate [R2 S15] | Multiple orgs | Test sync without pushing, split roles [R2 S26, S28] | Keep group assignments by ID [R2 S43] | n/a |
| Price per user per month | $0.90 to $1.75 annual, 10 minimum [R2 S7] | $1 plus $19 to $189 monthly base [R2 S17] | From $1.10 [R2 S20] | EUR 1, free to 19 users [R2 S27] | About $1 to $1.25 [R2 S29] | $0.73 to $1.36 (Microsoft 365) [R2 S14] |
| Marketplace rating | 4.5, 21 reviews [R2 S4] | 3.8, 51 reviews [R2 S18] | 4.8, 44 reviews [R2 S22] | 4.5, 12 reviews [R2 S24] | Not listed | n/a |

## 3. Platform limits that bound Migway v1 (from R4)

| Limit | Value | Source |
|---|---|---|
| Add-on callback runtime | 30 s | [R4 S2] |
| Web app server call runtime | 6 min | [R4 S2] |
| Card sections and widgets | 100 per card, 100 per section | [R4 S9] |
| Widget text tags | b, i, u, s, font color, a, time, br | [R4 S10] |
| Draft insert HTML limits | Not documented, spike needed | [R4 S3, S5] |
| Properties | 9 KB per value, 500 KB per store | [R4 S2] |
| Cache | 100 KB per value, 1,000 items, 6 h max, FIFO eviction (third party) | [R4 S30, S66] |
| Simultaneous executions | 30 per user, 1,000 per script | [R4 S2] |
| GroupsApp reads | 10,000 per user per day | [R4 S2] |
| Sheets API reads | 60 per min per user per project | [R4 S71] |
| Directory API | 2,400 queries per min per user per project, admin role required | [R4 S20, S74] |
| Script versions | 200 per script | [R4 S2] |
| Signature size | 10,000 characters including images | [R4 S28] |
| Latency (third party) | Cache 63 ms, Properties 80 ms, SpreadsheetApp 800 ms per read and write pair | [R4 S72] |

## 4. Where Migway v1 differs from every tool above

| Gap | Tools with it | Migway v1 |
|---|---|---|
| Folder-level grants to Google Groups and OUs, resolved live | None. Ablebits imports Directory into its own lists [R1 S8] | Yes, server-side, default deny |
| Version history with restore | TextExpander only [R3 S6] | Yes, every save |
| Favorites | Ablebits only [R1 S1] | Yes, per user, sidebar and web app |
| Data stays inside Workspace | Gmail native and Layouts only | Yes, Drive or Sheets in tenant |
| Works in any browser and Gmail mobile | Gmail Layouts | Yes, Workspace add-on [R4 S38] |
| $0 per user | Gmail native and Layouts | Yes |
