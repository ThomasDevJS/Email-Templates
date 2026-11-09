# R3: Snippet and CRM template tools (permission models and UX ideas)

Run: Phase 1, R3. Researcher (claude-opus-5-5). All sources read 2026-11-09. Public pages only. No logins, no trials.
Source IDs in square brackets point to the Sources list at the end. "Unverified" means only a third-party page, a search-result excerpt or a community post supports the claim, or the page could not be opened.

## Summary

1. Folder or group is the sharing unit in 3 of 5 tools: TextExpander (snippet group), Salesforce (folder), HubSpot snippets (folder, no sharing). Briskine and Gmelius share per template.
2. Three access levels recur: use, edit, manage. TextExpander calls them Can expand, Can edit, Can manage [S2]. Salesforce calls them Viewer, Editor, Manager (unverified, third-party) [S20].
3. Defaults differ. TextExpander and Salesforce start private. HubSpot templates start "Shared with everyone" [S9]. Gmelius shares with edit rights by default [S27]. HubSpot users ask for owner-only editing [S14].
4. TextExpander has a "Limited" role plus "Snippet Requests": users submit, an admin approves into the shared library [S5]. This maps well to Migway's user versus manager-editor split.
5. Placeholder syntax splits in two families: percent macros (TextExpander `%filltext:name=x%`) and double braces (Briskine `{{to.first_name}}`, Gmelius `{{your.variable}}`, Salesforce `{{{Recipient.FirstName}}}`).
6. Missing values are handled 3 ways: empty string (Briskine), prompt modal (Gmelius), literal text sent (HubSpot placeholder tokens). HubSpot users complain that unfilled placeholders go out [S12].
7. Version history with restore exists only in TextExpander (24 h, 7 days or unlimited by plan) [S1][S6]. Briskine keeps deleted templates 30 days [S25]. HubSpot and Salesforce document none for sales templates (unverified).
8. Favorites are not documented in any of the 5 tools. Briskine sorts by last use [S23].
9. Recommendation: folder-level grants with 3 levels, default deny, double-brace dotted placeholders, prompt fields that block apply until filled, version on every save.

## 1. TextExpander

| Facet | Finding | Source |
|---|---|---|
| Sharing targets | Just Me (default), Shared (members, teams, guests by email), Everyone (current and future org members) | [S3] |
| Permission levels | Per snippet group: Can expand (default for recipients), Can edit (create and edit snippets), Can manage (also manage access and settings). Creator gets Can manage | [S2] |
| Granularity | Whole snippet group. No per-snippet permission documented | [S2] |
| Team overrides | Group shared with a Team: set the level for the Team or per member | [S2] |
| Admin override | Org admins are by default admins of every org snippet group | [S2] |
| Roles | Enterprise "Limited" role: can use shared snippets and create personal ones, cannot share. Most restrictive team role wins. Only admins change roles. Team Managers see roles, cannot change them | [S5] |
| Review flow | Limited members submit via "Snippet Requests" for admin approval (Business and Enterprise) | [S1][S5] |
| New-share review | Newly shared groups show a dot for admin review until marked reviewed | [S3] |
| Organization | Snippet groups. Abbreviation per snippet | [S2] |
| Placeholders | `%filltext%`, `%fillarea%`, `%fillpopup%`, `%fillpart%...%fillpartend%`, date picker. Same-name fields stay in sync. `%filltop%` moves fields to the top | [S4] |
| Prompted fields | Yes. A fill-in window opens at expansion | [S4] |
| Versioning | "Snippet Activity": log of creates, edits, moves, deletes. Restore any prior version or deleted snippet. Needs Can edit or Can manage. Retention: Free none, Pro 24 h, Business 7 days, Enterprise unlimited | [S1][S6] |
| Search | Inline search in Chrome extension, default Ctrl+Period (older launch post, unverified current) | [S7] |
| Analytics | Org reports: Overview (hours saved, 30 days), Usage per member, Snippets (expansions per snippet), Inactive Users, CSV export. Time saved = characters expanded minus abbreviation, at 50 WPM | [S8] |
| Insertion | Type abbreviation anywhere (desktop app or Chrome extension), or search picker | [S7] |
| Rich text, attachments | Plain text, rich text and script snippets [S4]. Attachments not documented (unverified) | [S4] |
| Pricing (per user per month) | Free $0 (5 members), Pro $5 annual or $6 monthly, Business $10 annual or $12 monthly, Enterprise custom. Pricing cards and FAQ disagree on which figure is annual | [S1] |
| Chrome Web Store | 4.6 of 5, 127 ratings, 100,000 users, updated 2026-08-27 | [S10] |

## 2. Briskine (formerly Gorgias Templates)

| Facet | Finding | Source |
|---|---|---|
| Sharing ("Who can access") | Private, Everyone on the team, Specific team members | [S21] |
| Edit ("Who can edit") | Only me, Everyone who can access, Specific team members. Shown only when access is not Private. Creator always keeps access and edit | [S21] |
| Delete and re-share | Editors can delete and change sharing (search-result excerpt, unverified) | [S21] |
| Granularity | Per template. Bulk share from list | [S21] |
| Notify | Optional email notice only for "Specific team members" | [S21] |
| Organization | Colored tags, no folders documented. Filter with `tag:` operator | [S22] |
| Placeholders | Handlebars. `{{to.first_name}}`, `{{from.*}}`, `{{cc.*}}`, `{{bcc.*}}`, `{{account.*}}`, `{{subject}}`. Fallback via `{{or}}` helper. Escape with `\{{` | [S24][S26] |
| Missing values | Inserted as empty. Unknown single word renders empty. Unknown multi-word expression throws "Missing helper" | [S24][S26] |
| Prompted fields | Not documented | [S24] |
| Versioning | None documented. Trash keeps deleted templates 30 days. Restore is Premium | [S25] |
| Search | Fuzzy across title, shortcut, tags, body. Operators `tag:`, `title:`, `shortcut:`, `to:`, `subject:`. Prefixes `=` exact, `!` exclude | [S28] |
| Ordering | Dialog sorts by last use by default | [S23] |
| Insertion | Dialog (Ctrl+Space), keyword shortcut plus Tab, right-click context menu, sidebar. Shortcuts unique and case-sensitive | [S23][S29] |
| Attachments | Uploaded to Briskine servers as public links. "Anyone with the link to the file can view it." Premium | [S30] |
| Pricing | Free $0 (1 person), Premium $7 per person per month. Yearly gets 2 months free | [S31] |
| Chrome Web Store | 4.9 of 5, 616 ratings, 100,000 users, v8.3.1, updated 2026-10-25 | [S32] |

## 3. Gmelius

| Facet | Finding | Source |
|---|---|---|
| Sharing | Select teammates in Sharing Settings or drag into the "Shared" folder | [S27] |
| Default permission | Shared templates get edit rights. Owner unticks "Others can edit" to lock | [S27] |
| Ownership | "Transfer Ownership" action | [S27] |
| Roles | Super Admin (subscription owner), Company Analytics Manager, custom roles (Pro and Enterprise). Team-level roles on Pro only | [S33] |
| Organization | Categories shown as folders in a left panel | [S27] |
| Placeholders | `{{your.variable}}` in subject and body. About 12 presets. Custom `{{company.name}}` | [S34] |
| Missing values | Modal prompts the sender for a value | [S34] |
| Insertion | Hashtag shortcut in subject line, plus template icon in compose | [S35][S27] |
| Attachments | Up to 25 MB per template | [S35] |
| Versioning, favorites, template analytics | Not documented | [S27][S35] |
| Pricing (annual, monthly) | Meli $19, $21. Growth $25, $33. Pro $40, $50. Enterprise custom, minimum 50 users. Shared templates from Growth up | [S36] |
| Chrome Web Store | 4.2 of 5, 690 ratings, 50,000 users, v9.1.47, updated 2026-10-01 | [S37] |

## 4. Streak snippets (brief)

Snippets share with all Streak collaborators or by team or function. Triggers use hashtags, dollar signs or natural language. Snippets are free [S38]. No permission levels or variable syntax documented. Insufficient public detail for the comparison tables.

## 5. HubSpot sales email templates and snippets

| Facet | Finding | Source |
|---|---|---|
| Sharing | Only me (creator plus eligible Super Admins), Everyone (view and use), Specific users and teams | [S11] |
| Default | New templates default to "Shared with everyone" | [S9] |
| Who sets specific sharing | Super Admins or users with a Sales or Service seat | [S11] |
| Edit versus use | Not distinguished in docs. Community says any team user can edit shared sales content; requests for owner-only edit (unverified) | [S11][S14] |
| Delete | Private template: creator or Super Admin with a paid seat | [S9] |
| Folders | One level. Move via Actions > Move. No subfolders (community) | [S9][S15] |
| Snippets | Folders, `#` shortcut in editor, 2,500-character limit, 5,000 per account on paid plans. "Users with Sales access can edit or delete snippets." No per-snippet sharing; users ask for private or team snippets | [S13][S16] |
| Placeholders | Personalization tokens from a "Personalize" menu. Underlying syntax not documented in KB (unverified). Curly brackets break HubSpot rendering | [S9][S13] |
| Fallbacks | Default values for tokens in sales templates since a product update announced 2025-10-16 (community post, unverified) | [S17] |
| Prompted fields | "Placeholder token": sender types a one-time value. Not saved to CRM. Email still sends with placeholder text if unfilled | [S12] |
| Versioning | Not documented for sales templates. Marketing emails have revision restore via API (unverified for templates) | [S18] |
| Analytics | "Template ID" property set on send, used for reports. Template reports of sends, opens, clicks on Starter and Professional (community, unverified) | [S9][S19] |
| Insertion | Gmail via HubSpot Sales Chrome extension. Outlook via add-in | [S9] |
| Attachments | Insert menu adds snippets, documents, meeting links, video. Image-only templates fail to attach | [S9] |
| Pricing (Sales Hub, per seat per month) | Free $0 (3 templates). Starter $7 annual or $20 monthly. Professional $90 or $100 plus $1,500 onboarding. Enterprise $150 annual plus $3,500 onboarding. Paid plans: 10,000 templates, 5,000 snippets | [S39] |

## 6. Salesforce Lightning email templates

Official Salesforce Help and developer docs returned HTTP 403 or empty JavaScript shells. Most facts below come from third-party pages and are marked.

| Facet | Finding | Source |
|---|---|---|
| Default location | Private folder ("My Templates") by default (third-party, unverified) | [S40] |
| Folder sharing | Setup toggle "Folders and Enhanced Sharing". Metadata pref `enableTemplateEnhancedFolderPref`, default false (search excerpt of developer doc, unverified) | [S41] |
| Access levels | Viewer (see and use), Editor (create, edit, delete templates in folder), Manager (share, rename, delete folder, change access) (third-party, unverified) | [S20] |
| Sharing targets | Users, public groups, roles, roles and subordinates, territories (third-party, unverified) | [S20] |
| Inheritance | Subfolders inherit parent sharing (third-party, unverified) | [S41] |
| Profile permissions | "Manage Public Lightning Email Templates" lets a user create public folders, share them, and manage templates they do not own. Without it, users create in their private folder and use shared ones (unverified) | [S40] |
| Classic versus Lightning | Separate folder trees. Classic: all users, hidden, or listed groups and roles, Read Only or Read/Write (third-party) | [S20] |
| Placeholders | Lightning: Handlebars Merge Language, triple braces, `{{{Recipient.FirstName}}}`, `{{{Sender.Title}}}`. Classic: `{!Contact.FirstName}`. Not interchangeable. Recipient prefix without a matching record throws an error (third-party and community, unverified) | [S42][S43] |
| Prompted fields | None documented (unverified) | n/a |
| Visibility filter | "Related Entity Type" limits a template to records of one object | [S44] |
| Versioning | None found | [S45] |
| Insertion | "Insert, create, or update template" button in the record email composer | [S44] |
| Attachments | Supported. Files links convert to content asset links on save | [S44] |
| Pricing (per user per month, annual) | Starter Suite $25, Pro Suite $100, Sales Cloud Core $195, Advanced $395, Max $550. Template availability per edition not shown | [S46] |

## 7. Permission model comparison

| Tool | Who creates | Who edits | Who shares | Who deletes | Granularity | Default |
|---|---|---|---|---|---|---|
| TextExpander | Any member in own groups. Limited role: personal only, submits requests | Can edit or Can manage on the group | Can manage, org admins | Can edit (snippets). Group delete not documented | Snippet group, per Team or member | Just Me. Recipients get Can expand |
| Briskine | Any user | Creator plus "Who can edit" list | Editors (unverified) | Editors (unverified) | Per template | Private |
| Gmelius | Any user | All share recipients unless owner unticks "Others can edit" | Owner | Owner (unverified) | Per template, team roles on Pro | Edit on share |
| HubSpot templates | Seat holders | Not separated from use in docs | Owner, Super Admin, seat holders | Creator or Super Admin (private) | Per template, users or teams | Shared with everyone |
| HubSpot snippets | Seat holders | Any user with Sales access | No sharing control | Any user with Sales access | Account-wide, folders for order | Everyone |
| Salesforce Lightning | Users with template permission, in private folder | Folder Editor or Manager | Folder Manager plus "Manage Public" permission | Folder Editor or Manager | Folder, inherited by subfolders. Users, groups, roles, territories | Private (unverified) |

## 8. Placeholder syntax comparison

| Tool | Variable form | Prompted field | Fallback | Missing value | Escape |
|---|---|---|---|---|---|
| TextExpander | Macros, e.g. `%clipboard` (not read this run) | `%filltext:name=x:default=y%`, `%fillarea%`, `%fillpopup:name=x:a:default=b%`, `%fillpart:name=x:default=no%...%fillpartend%` | `default=` attribute | Field shows default | `%` and `:` banned in names only in script snippets |
| Briskine | `{{to.first_name}}`, `{{from.name}}`, `{{account.email}}`, `{{subject}}` | None documented | `{{or}}` helper | Empty string | `\{{` |
| Gmelius | `{{your.variable}}`, about 12 presets | Custom `{{company.name}}` opens a modal | None documented | Modal asks sender | Not documented |
| HubSpot | Chip from Personalize menu, syntax hidden | Placeholder token | Per-token default (since 2025-10, unverified) | Blank, or placeholder text sent | Curly brackets break rendering |
| Salesforce Lightning | `{{{Recipient.FirstName}}}`, `{{{Sender.Phone}}}` (unverified) | None documented | Not found | Error if record prefix missing (unverified) | Not found |

## 9. Reviews

G2, Capterra and TrustRadius returned HTTP 403. Quotes from those sites come from search-result excerpts, so they are unverified. Chrome Web Store pages loaded but showed no review text.

TextExpander praise
- G2 reviewer: shared snippets make it "a scalable team collaboration and productivity tool" [S47] (unverified excerpt, undated).

TextExpander complaints
- G2: a subscribed shared group cannot drop one snippet that conflicts with a personal one [S47] (unverified).
- G2: access settings change only in the web browser, not in the app [S47] (unverified).
- G2 and Capterra: price too high for light users. Large libraries hard to organize [S47][S48] (unverified).

Briskine
- Chrome Web Store 4.9 of 5 from 616 ratings [S32]. Firefox 4.85 from 13 ratings [S49]. No complaint text retrieved.

Gmelius
- Praise: templates integrate with Gmail compose and get daily use (Capterra excerpt) [S50] (unverified).
- Complaints: "10+ seconds to load an email" (G2 excerpt), separate mobile app needed, price (Capterra) [S50][S51] (unverified).
- Ratings: Capterra 4.7 from 43, G2 4.4 from 776, Chrome Web Store 4.2 from 690 [S37][S50].

HubSpot (community ideas, no star ratings read)
- Any team user can edit other users' sequences and templates. Users request owner-only edit [S14].
- No subfolders. Folders vanish when filtering by owner [S15].
- Snippets visible to everyone. Users request private or team snippets [S16].
- Unfilled placeholder tokens are sent as written. Users request a send-time check [S12].

Salesforce (Trailblazer community)
- Share option missing on Lightning template folders. Reported workaround: disable then re-enable "Folders and Enhanced Sharing" [S41] (anecdotal).
- Admins cannot restrict template creation without removing Send Email permission [S52] (unverified).

## 10. Lessons for Migway v1

1. Grant access on folders, with 3 levels: use, edit, manage. Salesforce and TextExpander do this. Per-template grants (Briskine, Gmelius) multiply rows and slow the permission check. Map: user = use, manager-editor = edit in assigned folders, admin = manage everywhere.
2. Default deny. New folders are visible only to admins until shared. Templates inherit the folder grant. HubSpot's "Shared with everyone" default produces edit-conflict complaints [S9][S14].
3. Keep "use" and "edit" as separate grants. Gmelius gives edit on every share [S27]. HubSpot does not separate them [S11]. Both produce accidental edits.
4. Subfolders inherit the parent grant, with no per-template override in v1. Salesforce does this [S41]. One rule keeps the server check to one lookup per folder path.
5. Admins override all folder grants. TextExpander org admins and HubSpot Super Admins do this [S2][S11].
6. Add a "suggest a template" path for users later. TextExpander Limited role plus Requests shows the pattern [S5]. Candidate for v2.
7. Placeholder syntax: double braces with dotted names, e.g. `{{sender.name}}`, `{{sender.title}}`, `{{sender.phone}}`, `{{sender.department}}`, `{{recipient.first_name}}`. Briskine, Gmelius and Salesforce use this family. Avoid triple braces: a Salesforce user shipped a double-brace field by mistake [S43].
8. Prompted fields: one named form, e.g. `{{ask:Meeting date}}` (syntax is a proposal). Same name, same value, as TextExpander does [S4]. Block apply until every prompt has a value. HubSpot sends unfilled placeholders and users complain [S12].
9. Missing known values: per-variable fallback, e.g. `{{recipient.first_name|there}}` (proposal). Unknown names fail at save time in the editor. Briskine's silent empty output hides typos [S26].
10. Escape with `\{{` for literal braces. Briskine documents this [S26].
11. Versioning: a new version on every save. Restore creates a new version, so history stays linear. Soft delete with 30-day trash, as Briskine does [S25]. TextExpander shows restore needs edit rights [S6].
12. Search: fuzzy over title, folder, tags, body, plus `folder:` and `tag:` filters. Sort sidebar results by last use. Briskine does both [S23][S28].
13. Favorites: none of the 5 tools document favorites. Migway's per-user favorites are a small differentiator.
14. Usage analytics: count apply events per template from the audit log. TextExpander reports expansions per snippet [S8]. Open and click tracking needs external servers and stays out of scope.
15. Attachments: leave out of v1, or store Drive links restricted to the domain. Briskine stores attachments as public links on its servers [S30], which the BRIEF forbids.
16. Insertion: compose sidebar with search, recent and favorites. Keyboard abbreviations need a content script (Chrome extension), which BRIEF A2 excludes (opinion, R4 to confirm).

## Sources (all read 2026-11-09)

- [S1] TextExpander pricing. https://textexpander.com/pricing
- [S2] TextExpander, Snippet Group Permissions. https://textexpander.com/learn/using/snippet-groups/snippet-group-permissions
- [S3] TextExpander blog, Improved Snippet Sharing and Visibility for Organizations (published 2024-11-14, updated 2026-10-16). https://textexpander.com/blog/improved-snippet-sharing-organizations
- [S4] TextExpander, Advanced Fill-in Syntax. https://textexpander.com/learn/using/snippets/snippet-fill-ins/advanced-fill-in-syntax
- [S5] TextExpander, Setting up the Limited role (search-result excerpt). https://textexpander.com/learn/getting-started/getting-started-for-admin/setting-up-user-roles-permissions/setting-up-the-limited-role-for-organization-members-and-teams
- [S6] TextExpander, Tracking changes with Snippet Activity (search-result excerpt). https://textexpander.com/learn/organization/tracking-changes-to-organization-snippets-with-snippet-activity
- [S7] TextExpander blog, How to Use Gmail Snippets (search-result excerpt). https://textexpander.com/blog/gmail-snippets
- [S8] TextExpander, Organization Statistics Reports for Admins (search-result excerpt). https://textexpander.com/learn/accounts/statistics/textexpander-organization-usage-statistics
- [S9] HubSpot KB, Create and send templates. https://knowledge.hubspot.com/templates/create-and-send-templates
- [S10] Chrome Web Store, TextExpander. https://chromewebstore.google.com/detail/textexpander/mmfhhfjhpadoefoaahomoakamjcfcoil
- [S11] HubSpot KB, Share sales content with users and teams. https://knowledge.hubspot.com/sequences/share-sales-content-with-users-and-teams
- [S12] HubSpot Community idea, "Fill in the blank" placeholder areas for templates (403, search-result excerpt). https://community.hubspot.com/t5/HubSpot-Ideas/quot-Fill-in-the-blank-quot-areas-for-templates/idi-p/18272
- [S13] HubSpot KB, Use snippets. https://knowledge.hubspot.com/conversations/use-snippets
- [S14] HubSpot Community idea, Sequence permissions (search-result excerpt). https://community.hubspot.com/t5/HubSpot-Ideas/Sequence-permissions/m-p/203907
- [S15] HubSpot Community idea, Template folders view (search-result excerpt). https://community.hubspot.com/t5/HubSpot-Ideas/Template-folders-view/idi-p/376407
- [S16] HubSpot Community idea, Enable snippets to be private or shared with team (search-result excerpt). https://community.hubspot.com/t5/HubSpot-Ideas/Enable-snippets-to-be-made-private-or-shared-with-team/idc-p/855578/highlight/true
- [S17] HubSpot Community idea, Default values for personalization tokens in HubSpot Sales (search-result excerpt). https://community.hubspot.com/t5/HubSpot-Ideas/Default-Values-for-Personalization-Tokens-in-HubSpot-Sales/m-p/20005
- [S18] HubSpot developer docs, Restore a revision of a marketing email (search-result excerpt). https://developers.hubspot.com/docs/api-reference/latest/marketing/marketing-emails/revisions/restore-from-revision
- [S19] HubSpot Community, Templates - Analyze (search-result excerpt). https://community.hubspot.com/t/templates-analyze/7724
- [S20] Trusted Institute, Email Template Folder Access (third-party). https://trustedinstitute.com/concept/salesforce-advanced-administrator/advanced-security-and-access/email-template-folder-access/
- [S21] Briskine help, Template Sharing. https://help.briskine.com/templates/template-sharing/
- [S22] Briskine help, Template Tags. https://help.briskine.com/templates/template-tags/
- [S23] Briskine help, Briskine Dialog. https://help.briskine.com/getting-started/briskine-dialog/
- [S24] Briskine help, Template Variables. https://help.briskine.com/templates/template-variables/
- [S25] Briskine help, Trash. https://help.briskine.com/templates/trash/
- [S26] Briskine help, Template Language. https://help.briskine.com/templates/template-language/
- [S27] Gmelius help, Manage templates. https://help.gmelius.com/email-templates/manage-templates
- [S28] Briskine help, Search. https://help.briskine.com/templates/search/
- [S29] Briskine help, Template Shortcuts. https://help.briskine.com/getting-started/template-shortcuts/
- [S30] Briskine help, Template Attachments. https://help.briskine.com/templates/template-attachments/
- [S31] Briskine pricing. https://www.briskine.com/pricing/
- [S32] Chrome Web Store, Briskine. https://chromewebstore.google.com/detail/lmcngpkjkplipamgflhioabnhnopeabf
- [S33] Gmelius help, Roles and permissions (search-result excerpt). https://help.gmelius.com/admin/roles-and-permissions
- [S34] Gmelius help, How to add smart variables to a template. https://help.gmelius.com/email-templates/how-to-add-smart-variables-to-a-template
- [S35] Gmelius help, Create and use templates. https://help.gmelius.com/email-templates/create-use-templates
- [S36] Gmelius pricing. https://gmelius.com/pricing
- [S37] Chrome Web Store, Gmelius. https://chromewebstore.google.com/detail/dheionainndbbpoacpnopgmnihkcmnkl
- [S38] Streak, Canned Gmail snippets. https://streak.com/canned-gmail-snippets
- [S39] HubSpot Sales Hub pricing. https://www.hubspot.com/pricing/sales
- [S40] Pacific College help center, Manage public and private email templates in Salesforce (third-party, search-result excerpt). https://pcom-staff.helpjuice.com/388876-manage-public-and-private-email-templates-in-sales
- [S41] Trailblazer Community thread on sharing Lightning template folders (search-result excerpt). https://trailhead.salesforce.com/trailblazer-community/feed/0D54S00000BtvM1SAJ
- [S42] UNH IT KB, Salesforce user record merge fields (third-party, search-result excerpt). https://td.usnh.edu/TDClient/60/Portal/KB/ArticleDet?ID=4284
- [S43] MassMailer, Salesforce email merge fields guide (vendor, search-result excerpt). https://massmailer.io/glossary/salesforce-email-merge-fields
- [S44] Practifi help, Creating and using email templates (third-party, search-result excerpt). https://practifisuccess.zendesk.com/hc/en-us/articles/13251383956495-Creating-and-Using-Email-Templates
- [S45] Salesforce Ben, Complete guide to Lightning email templates (403, not read). https://www.salesforceben.com/your-complete-guide-to-salesforce-lightning-email-templates/
- [S46] Salesforce Sales Cloud pricing. https://www.salesforce.com/sales/pricing/
- [S47] G2, TextExpander reviews (403, search-result excerpt). https://www.g2.com/products/textexpander/reviews
- [S48] Capterra, TextExpander reviews (search-result excerpt). https://www.capterra.com/p/180916/TextExpander/reviews/?page=2
- [S49] Firefox Add-ons, Briskine reviews (search-result excerpt). https://addons.mozilla.org/en-CA/android/addon/gorgias-templates/reviews
- [S50] Capterra, Gmelius reviews (search-result excerpt). https://www.capterra.com/p/172417/Gmelius/reviews
- [S51] G2, Gmelius (search-result excerpt). https://g2.com/products/gmelius
- [S52] Trailblazer Community, restricting template creation (search-result excerpt). https://trailhead.salesforce.com/trailblazer-community/feed/0D53A00003dBAVnSAO
