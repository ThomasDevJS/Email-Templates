# R1: Gmail templates (Ablebits Shared Email Templates, Gmail Templates, Gmail Layouts, Workspace admin controls)

Researcher run R1, Phase 1. All sources read 2026-11-09 unless marked. Public pages only. Tag [S#] points to the sources list. "Unverified" means no primary source confirms the claim.

## Summary

1. Gmail native Templates are per-user, web-only, flat (no folders), with no variables, no sharing and no admin setting [S11][S12][S16][S17].
2. Deleting a native template is permanent. Google: "After you delete a template, you can't recover it." [S11]
3. Gmail Layouts are branded designs stored in Drive. Admins toggle them per OU or group, default on, eligible editions only (Business Standard and up) [S13][S14][S15].
4. Layouts limits: 10,000 characters, 40 images, 50 tiles, 25 MB of images. Inserted layout content cannot be edited in the draft [S13].
5. Ablebits Shared Email Templates for Gmail is a Chrome extension (Chrome Web Store), not a Workspace add-on. 1,000 users, 4.8 stars from 4 ratings [S3][S4].
6. Ablebits stores templates in its own AWS-hosted database [S9]. Migway's brief forbids that data flow, so Ablebits is a feature reference only.
7. Ablebits roles per team: Admin (company account), Editor (create and edit), User (read-only use) [S7][S8].
8. Ablebits placeholders: recipient first, last, full name; greeting switch for one or many recipients; prompted fields "What to enter" as text, dropdown, date picker, time picker, with required flag and default [S6].
9. Ablebits pricing: Business $3.00 and Enterprise $4.00 per user per month billed annually; 60-day free trial; per-team cap 512 items (1,024 Enterprise) [S1].
10. No tool here offers per-template version history with restore. Ablebits has a "Deleted items" folder only [S10]. This is an open gap Migway v1 fills.

## 1. Ablebits Shared Email Templates & Signatures for Gmail

| Topic | Fact | Source |
|---|---|---|
| Product name | "Shared Email Templates & Signatures for Gmail", by Ablebits (Warsaw, Poland) | S1, S4 |
| Insertion mechanism | Chrome extension. Runs as a Gmail side panel opened from the toolbar icon. Install via Chrome Web Store, "Add to Chrome" | S3, S4 |
| Browsers | "Designed specifically to work in the Google Chrome browser". Comparison page also lists Microsoft Edge. Windows 10 and 11, recent macOS | S5, S19 |
| Workspace Marketplace listing | None found | S20 (search, no listing) |
| Mobile | Not mentioned in docs. A Chrome extension cannot run in Gmail mobile apps (inference, unverified by vendor) | S2, S3, S5 |
| Who creates and shares | Anyone creates personal templates. Team templates: Editors create and edit. Admin of the company account creates teams. Personal templates are shared to a team by right-click, Share; "Share as copy" keeps a personal copy | S7, S8 |
| Roles | Admin (company account; creates and manages teams; must be added to a team as User or Editor to use or edit it). Editor (create and edit team templates). User (read-only use) | S7, S8 |
| Permission model | Team = shared folder. Permissions set per member per team. "Moving a template to a particular group allows you to restrict editing rights for some users within that group" | S8, S10 |
| Identity source | Members added from the company account or imported from Google Workspace Directory (admin rights required). "Azure AD groups are not supported in the Gmail extension" | S8, S18 |
| Encrypted teams | Optional team password enables AES encryption before save. Password "cannot be changed or recovered" | S8, S9 |
| Admin controls | Company account dashboard (Teams, users). Comparison page lists "disabling personal templates or signatures for users" for both editions | S8, S19 |
| Placeholders syntax | Inserted from an "Insert macro" toolbar button and shown as placeholder chips ("Default" or "Dashed" style). Raw syntax not published in the pages read (unverified) | S6, S21 |
| Recipient fields | Recipient first name, last name, full name. "Insert greeting" with separate text for one or many recipients. Add to / Fill To, Cc, Bcc | S6 |
| Prompted fields | "What to enter": text field (name, default, required), dropdown (single or multi), date picker, time picker. Macros can be nested | S6 |
| Other macros | Insert date with offset, Attach (Drive or URL), insert picture, datasets from Google Sheets, regex match and extract, conditional "Insert if" sections, DisableIf | S2, S6, S22 |
| Rich text and images | Editor supports pictures, buttons, tables, hyperlinks, HTML view, attachments. Files over 25 MB go as Drive links | S2, S23, S24 |
| Known editor bug | Built-in editor "may insert a <span> tag that breaks macros"; fix is editing HTML by hand | S24 |
| Versioning | No version history documented. Deleted templates go to a "Deleted items" folder and can be moved back. Database backed up daily (vendor claim) | S10, S20 |
| Search and favorites | Quick search in sidebar. Tabs: All, Favorite, Personal, Team, Shortcuts | S1, S2 |
| Import and export | Comparison page ticks export, import, backup for Gmail. Export format .xml (re-importable) or HTML .zip (view only). Export is whole team or whole "My templates" only. One older note says this "is not supported" in Gmail. Status for Gmail: conflicting, unverified | S19, S25, S20 |
| Storage | "Encrypted cloud-based database hosted by Amazon Web Services". Local cache stored unencrypted | S9 |
| Signatures | Personal, team and company-wide signatures in the library. One older page lists Signatures as missing from Gmail. Current product page and store listing include them | S1, S2, S4, S20 |
| Limits | Items (folders plus templates) per user: Trial 2,500, Business 1,500, Enterprise 7,000. Items per team: 512, Enterprise 1,024. Teams per user: Trial 4, Business 3, Enterprise 6. Team size unlimited. Stated reason: Chrome performance. Max template size not published | S1 |
| Pricing | Free Trial $0 for 60 days, no card. Business $3.00 per user per month billed annually. Enterprise $4.00 per user per month billed annually. Monthly-billing price not shown on page. GetApp lists "from $6 per user per month" (unverified) | S1, S20 |
| Store stats | Version 1.1.18, updated 2026-09-24, 1,000 users, 4.8 stars from 4 ratings | S4 |

## 2. Gmail native Templates (formerly Canned Responses)

| Topic | Fact | Source |
|---|---|---|
| Enable | User turns on: Settings, See all settings, Advanced, Templates, Enable, Save Changes. Off until enabled (third-party claim, unverified) | S11, S12 |
| Who creates and shares | Each user, own account only. No sharing. "Gmail Templates ... are stored per individual Google account" | S16, S17 |
| Permission model | None. Personal only | S16 |
| Create and edit | Compose, More options, Templates, Save draft as template, Save as new template. Edit by "Overwrite Template" | S11 |
| Insert | Compose, More options, Templates, Insert template. Three clicks via the overflow menu | S11 |
| Auto-reply | A filter action can "Send template" | S11 |
| Placeholders | None documented for templates. Gmail mail merge tags (@firstname, @lastname, @fullname, @email) exist for mail merge, not templates | S26 |
| Rich text and images | Not documented by Google. Third-party guides say formatting and images persist (unverified) | S27 |
| Subject, Cc, Bcc, attachments | Not documented by Google. Secondary sources conflict: one says body only, no subject, no Cc/Bcc, no attachments. Ablebits says "Built-in templates don't support attachments" (unverified) | S10, S27, S28 |
| Versioning | None. Deletion is permanent: "After you delete a template, you can't recover it." | S11 |
| Search and favorites | None documented. Flat list in a menu | S11 |
| Import and export | None documented | S11 |
| Admin controls | No Admin console setting for templates found on the Gmail user settings page. TextExpander: "no Google Workspace admin setting, no sharing toggle, no way to push a template from one inbox to another" | S14, S17 |
| Limits | Not published by Google. "50 per account" circulates on third-party sites (unverified) | S27, S28 |
| Mobile | Web only. "Templates aren't available in Gmail mobile apps." | S11, S12 |
| Pricing | Included with every Gmail and Workspace account | S11 |

## 3. Gmail Layouts

| Topic | Fact | Source |
|---|---|---|
| What it is | Branded email designs: logo, colors, fonts, footer, links, buttons, images. Default layouts plus "My layouts" | S13 |
| Editions | Business Standard and Plus, Enterprise Standard and Plus, Education Standard and Plus, Workspace Individual. Not on Business Starter, Essentials, Education Fundamentals, Frontline | S13, S15 |
| Insertion | Compose window, Layouts icon. After insert, "you can't change the contents of the email draft directly"; edits go through the layout editor | S13 |
| Storage | "Email layouts in the 'My layouts' tab are saved in Google Drive" as a special file type (search "type:email-layouts") | S13, S14b |
| Sharing and permissions | Share from the editor or Drive. "Only users who have access to Layouts feature can edit layouts you share with them." Others preview in Drive only. Real-time co-editing | S13, S14b |
| Placeholders | Mail merge tags work in layouts when mail merge is on | S14b |
| Versioning | Not documented. Drive file version history may apply (unverified) | S13 |
| Limits | 10,000 characters, 40 images, 50 tiles, images total 25 MB | S13 |
| Mobile | Editor previews mobile, tablet and desktop. Mobile app creation not documented (unverified) | S13 |
| Admin controls | Admin console, Apps, Google Workspace, Gmail, User settings, "Layouts". Default on. Per OU or configuration group. Requires Drive on. Turning off Docs creation blocks layouts while keeping Drive. Up to 24 hours to propagate. Needs Gmail Settings admin privilege | S14, S14b, S15 |
| Pricing | Included in eligible Workspace editions | S15 |

## 4. Google Workspace admin controls (summary)

- Gmail Templates: no admin toggle, no central push, no audit found [S14][S17].
- Gmail Layouts: one on/off setting per OU or group, default on, depends on Drive and Docs creation [S14][S14b][S15].
- Third-party Chrome extensions (Ablebits): admins force-install or block via Devices, Chrome, Apps & extensions, per OU. Users cannot remove force-installed items. Limit 500 for apps times groups [S29].
- Mail merge (related): external recipients default by edition; 1,500 merge recipients per day [S15][S26].

## Reviews

Sources available: Chrome Web Store reviews (Ablebits), vendor and third-party blogs, Google community threads. G2 (403) and Microsoft AppSource (403) blocked fetching. Capterra shows 0 reviews for the Ablebits listing [S20].

Ablebits praise:
- "Work really well and has a lot of options" (Chrome Web Store, 2026-03-25) [S30].
- "Fantastic tool - customer service matches as they helped us move from outlook to gmail seamlessly" (2025-06-05) [S30].
- "No more messing around with drafts as templates, finally!" (2025-01-14) [S30].

Ablebits complaints:
- "it takes a while to figure out how to use the template features" (2026-03-24) [S30].
- Vendor-listed issues: editor inserts <span> tags that break macros; extension fails in private browsing or with third-party cookies blocked [S24].
- Per-team item cap of 512 (1,024 Enterprise), set for Chrome performance [S1].

Gmail native Templates complaints (blogs and vendors, which have a sales interest):
- No sharing, no folders, no variables, flat list [S17][S31].
- Insert takes three clicks through the overflow menu [S31].
- No mobile access [S12].
- No recovery after delete [S11].
- Built-in editor "functional rather than feature-rich" (Ablebits blog, 2025-08-08) [S10].

Gmail Layouts complaints:
- Users on eligible plans saw Layouts but it "doesn't load properly" and could not save to Drive (Google Cloud Community thread, 2024, unverified date) [S32].
- Inserted layout content cannot be edited inline [S13].
- Outlook renders layouts through Word, so output differs [S13].

## Lessons for Migway v1

1. Sharing per folder with roles is the main gap in Gmail. Ablebits' Admin, Editor, User per team maps directly to Migway admin, manager-editor, user per folder.
2. Bind roles to Google Groups and OUs. Ablebits imports from the Directory but manages its own member lists; Migway should resolve live group membership.
3. Version history with restore beats every tool here. Ablebits only has a Deleted items folder. Gmail deletes permanently.
4. Soft delete plus a recovery view is the minimum expected.
5. Placeholders: copy the model of recipient first name, greeting switch, prompted text field with default and required flag. Dropdown and date picker are v1.1 candidates.
6. Placeholders as atomic tokens survive editing better. Ablebits' editor breaks macros by inserting <span> tags; the sanitizer and editor must keep tokens intact (fixture test).
7. One-click insert from the compose sidebar beats Gmail's three-click menu. Search and favorites must be in the sidebar.
8. Keep data in Workspace (Drive or Sheets). Ablebits uses AWS, which Migway's brief forbids.
9. A Workspace add-on works in any browser; Ablebits needs Chrome or Edge. Mobile support stays best effort (brief A7).
10. Publish limits. Ablebits caps 512 items per team. Migway targets 1,000 templates and 100 folders (10x design).
11. Export to a re-importable format (JSON) at folder and full-library level. Ablebits exports whole teams only.
12. Do not depend on Gmail Layouts. They need Business Standard or higher, Drive and Docs creation, and block inline edits after insert.

## Sources (all read 2026-11-09)

- S1 Ablebits product and pricing page: https://ablebits.com/gmail-shared-email-templates/index.php
- S2 Ablebits Gmail overview: https://www.ablebits.com/docs/gmail-shared-templates-overview/
- S3 Ablebits Gmail installation: https://www.ablebits.com/docs/gmail-shared-templates-installation/
- S4 Chrome Web Store listing: https://chromewebstore.google.com/detail/shared-email-templates-fo/kkajpjibkjkiminiilbodneoamodbhin
- S5 Ablebits Gmail requirements: https://www.ablebits.com/docs/requirements-shared-email-templates-gmail/
- S6 Ablebits Gmail macros: https://www.ablebits.com/docs/gmail-shared-templates-macros/
- S7 Ablebits manage teams (roles): https://email-templates.app/en/docs/company-account/manage-teams/index.html
- S8 Ablebits Gmail create teams: https://www.ablebits.com/docs/gmail-shared-templates-create-teams/
- S9 Ablebits data safety: https://ablebits.com/docs/shared-templates-data-safety
- S10 Ablebits blog, edit or delete templates in Gmail (updated 2025-08-08): https://www.ablebits.com/office-addins-blog/edit-delete-templates-gmail/
- S11 Google, Create a template in Gmail: https://support.google.com/mail/answer/14864208?hl=en
- S12 Google Workspace Learning Center, templates: https://support.google.com/a/users/answer/9308990?hl=en
- S13 Google, Gmail layouts: https://support.google.com/mail/answer/10960345?hl=en
- S14 Google admin, Manage Gmail settings for users: https://knowledge.workspace.google.com/admin/gmail/manage-gmail-settings-for-your-users?hl=en
- S14b Workspace Updates, layout editor (2024-03-12): https://workspaceupdates.googleblog.com/2024/03/create-fully-customized-email-campaigns-new-layout-tool.html
- S15 Workspace Updates, layouts and mail merge (2022-07-28): https://workspaceupdates.googleblog.com/2022/07/new-integrated-marketing-tools-for-gmail.html
- S16 Ablebits blog, share Gmail templates (updated 2025-07-14): https://www.ablebits.com/office-addins-blog/share-gmail-templates/
- S17 TextExpander blog, share email templates (updated 2026-11-07): https://textexpander.com/blog/how-to-share-email-templates
- S18 Ablebits Gmail teams search snippet (Directory import needs admin rights): https://www.ablebits.com/docs/gmail-shared-templates-create-teams/
- S19 Ablebits Outlook vs Gmail editions: https://ablebits.com/docs/shared-email-templates-comparing-outlook-and-gmail-editions
- S20 Search results (GetApp $6, Capterra 0 reviews, conflicting export and signature notes, daily backup): https://www.getapp.com/all-software/a/ablebits-docs/ and https://www.capterra.com/p/10050674/Ablebits-Docs/ and https://www.ablebits.com/docs/outlook-shared-templates-manage
- S21 Ablebits macros guide: https://email-templates.app/en/docs/macros/index.html
- S22 Ablebits complete macro list: https://email-templates.app/en/docs/macros/complete-list/index.html
- S23 Ablebits Gmail create and manage: https://www.ablebits.com/docs/gmail-shared-templates-create-manage/
- S24 Ablebits Gmail known issues: https://www.ablebits.com/docs/gmail-shared-templates-known-issues
- S25 Ablebits export: https://email-templates.app/en/docs/backup/export/index.html
- S26 Google, mail merge: https://support.google.com/mail/answer/12921167?hl=en
- S27 EmailAnalytics, Gmail templates (Google claims re-read 2026-10-08): https://emailanalytics.com/gmail-email-templates/
- S28 ChainMail blog (2026-04-04): https://chainmail-website.pages.dev/blog/gmail-email-templates-guide.html
- S29 Google Chrome Enterprise, auto-install apps and extensions: https://support.google.com/chrome/a/answer/6306504?hl=en
- S30 Chrome Web Store reviews: https://chromewebstore.google.com/detail/shared-email-templates-fo/kkajpjibkjkiminiilbodneoamodbhin/reviews
- S31 Drag blog, Gmail templates guide (2026): https://www.dragapp.com/blog/email-templates-gmail/
- S32 Google Cloud Community, Gmail Layouts not loading (search snippet only): https://www.googlecloudcommunity.com/gc/Workspace-Q-A/Gmail-Layouts-not-loading-for-users/m-p/738520
