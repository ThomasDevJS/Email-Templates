# R2: Central email signature managers for Google Workspace

Run: Phase 1, R2. Researcher (claude-opus-5-5). All sources read 2026-11-09 unless stated. Public pages only. No logins, no trials.
Status of evidence: vendor docs and Marketplace listings are primary. Review sites (G2, Capterra) blocked direct fetch (HTTP 403), so review figures come from search-result excerpts and are marked "via search".

## Summary

1. Three push mechanisms exist. (a) Gmail API writes `users.settings.sendAs.signature` (WiseStamp, BulkSignature, Exclaimer client-side, Signitic, Patronum, Rocketseed SoC). (b) Server-side rewrite through Gmail routing to the vendor's SMTP service (Exclaimer server-side, WiseStamp Platform, Rocketseed). (c) Browser extension at compose time (BulkSignature, Signitic, WiseStamp).
2. CodeTwo has no Google Workspace product. It announced one on 2024-06-27. Its product and pricing pages list Microsoft 365 only.
3. API push needs a super admin. Most vendors use an admin Marketplace install that grants Gmail settings and Directory read scopes for all users. Rocketseed asks for a manual domain-wide delegation (DWD) grant with `gmail.settings.basic` and `gmail.settings.sharing`.
4. Google: a standard client can update only the primary address signature. Alias (send-as) signatures need a service account with DWD.
5. The Gmail API sets one signature per send-as address. It cannot set the "reply/forward" default (Patronum, 2026-02-23; Google confirmation unverified). Vendors fix replies with a Chrome extension or with server-side routing.
6. Gmail caps signatures at 10,000 characters (Google [S44]). Oversized pushes fail silently (WiseStamp [S16]).
7. Duplicates come from manual or mobile signatures plus a server-side stamp. No vendor removes a manually pasted signature automatically.
8. Prices for Workspace-capable tools: Exclaimer $0.90 to $1.75, BulkSignature from $1.10, Rocketseed about $1 to $1.25, Signitic EUR 1 (free to 19 users), WiseStamp $1 per employee plus a $19 to $189 monthly base.
9. For Migway ($0, Apps Script only): routing to an external server is out. API push with a user token ("set my Gmail signature") needs no admin. Central push to everyone needs DWD, which is an admin decision.

## 1. Exclaimer (Exclaimer for Google Workspace)

| Item | Finding | Source |
|---|---|---|
| Push mechanism | Two modes, usable together. Client-side: signature synced into the user's Gmail signature settings; mail is not routed through Exclaimer. Server-side: Gmail routes outbound mail to Exclaimer over SMTP relay; signature imprinted after send. | [S1], [S2], [S3] |
| Admin grant | Licensed Super Admin must connect. Unlicensed super admin fails verification. Marketplace app permissions: Gmail settings, "Add emails into your Gmail mailbox", labels, Drive (all files), Directory users, groups, group subscriptions, OUs, domains. Exact OAuth scope strings not published (unverified). | [S3], [S4] |
| Server-side admin steps | Admin console Gmail Hosts plus SMTP relay plus routing rule (vendor KB page returned 503; steps inferred from search excerpts, unverified in detail). | [S5] |
| Targeting | Rules by user, role, department, sender or recipient. First matching rule wins for client-side. Group send-as addresses need a subject-line trigger rule, because Gmail sets Return-Path to the individual sender. | [S1], [S3], [S6] |
| Directory variables | Synced from Google Directory and HRIS (Pro). Named fields not listed on public pages. | [S1], [S7] |
| Duplicates | Client-side and server-side together duplicate signatures in replies and forwards. Client-side signature sits below the reply separator, so server-side misses it. Fix: change a Gmail setting so server-side sees the existing signature. | [S8] |
| Reply vs new | Client-side overrides the Gmail signature for new messages only. One client-side signature per account. Server-side reply signatures exist (KB title "How to apply a reply signature for server-side"; content unread). | [S3], [S6] |
| Sent Items | Server-side signatures are invisible in Sent. Since 2026-04-27 Exclaimer inserts a labelled copy "Exclaimer Sent Items" via Gmail insert and modify APIs. | [S9] |
| Mobile | Gmail mobile app signatures are plain text (Exclaimer handbook). Server-side covers mobile sends. | [S10] |
| Embedded images | Client-side images need Drive and Docs permissions. | [S3] |
| Pricing (annual, USD, per user per month) | Starter $0.90, Standard $1.45 (department signatures), Pro $1.75 (HRIS, analytics), Enterprise custom. Minimum 10 users. All plans: server-side, client-side or both. | [S7] |
| Marketplace | 4.5 stars, 21 reviews, 818K+ installs, updated 2026-10-28. | [S4] |

## 2. CodeTwo (Email Signatures 365)

| Item | Finding | Source |
|---|---|---|
| Google Workspace support | None. Blog post of 2024-06-27 says "we are now working on it", no release found. Product page lists Microsoft 365 and Outlook only. A legacy Google Apps product is discontinued. | [S11], [S12], [S13] |
| Pricing (Microsoft 365) | One plan. USD per user per month: 10 licenses $1.22 yearly or $1.36 monthly; 100 at $1.11; 500 at $0.73. Minimum 10 licenses. | [S14] |
| Relevance | Not a candidate. Its price curve is a reference point only. | |

## 3. WiseStamp

| Item | Finding | Source |
|---|---|---|
| Push mechanism | Basic and Grow: Gmail API writes the user's Gmail signature setting ("auto-inject"), client-side only. Platform: server-side routing via Gmail Hosts, SMTP relay (7 allow-listed IPs, TLS) and a content compliance rule. Hybrid mode stamps server-side only when no client-side signature is found. Chrome extension as an alternative. | [S15], [S16], [S17] |
| Admin grant | Super Admin must install the Marketplace app for "Everyone at your organization". OU-only install leaves users without signatures. API Data Access must be "Granted". Permissions: Gmail settings, sensitive mail settings (aliases), "Manage email settings for users on your domain", Directory user read. | [S16], [S18] |
| Aliases | Alias signatures need the "sensitive mail settings" permission (`gmail.settings.sharing` per Google wording). | [S16] |
| Targeting | Departments, Google groups, OUs, custom rules, brands, regions. Enterprise can limit directory sync to a security group. | [S15], [S17] |
| Directory variables | Name, title, department, phone. Admin maps Directory attributes to fields. Custom fields on Platform. Daily sync claimed on marketing page; help page says manual sync. | [S15], [S16], [S17] |
| Duplicates | WiseStamp cannot detect manual signatures, so the user removes them. Manual signatures from before January 2023 are not detected. | [S16], [S19] |
| Limits | Gmail rejects signatures over 10,000 HTML characters without error. | [S16] |
| Sent Items | Server-side signatures do not appear in compose or Sent. | [S19] |
| Pricing (annual, USD) | Pro+ $9 per month plus $2 per member (to 10). Basic $19 per month plus $1 per employee. Grow $49 plus $1. Platform $189 plus $1 (server-side, roles). Enterprise custom (audit log). | [S17] |
| Admin UI worth copying | Template locking with field-level edit permissions; Admin, Designer, IT roles; audit log; auto-deactivate signatures for removed accounts. | [S15] |
| Marketplace | 3.8 stars, 51 reviews, 1M+ installs, updated 2026-02-01. | [S18] |

## 4. BulkSignature

| Item | Finding | Source |
|---|---|---|
| Push mechanism | Gmail API into each user's sendAs settings. Chrome extension (since 2026-05-21) adds reply and forward signatures. | [S20], [S21] |
| Admin grant | "Single admin authorization" via Marketplace install. Permissions: Gmail settings, sensitive mail settings, groups, OUs, users, user schemas (custom attributes). DWD use not stated (unverified). | [S20], [S22] |
| Extension deployment | Admin force-installs the extension (Devices, Chrome, Apps and extensions). Each user verifies once with an emailed code. | [S21] |
| Targeting | User, Google Group, OU, department, location, role, region, brand. | [S20] |
| Directory variables | Name, title, department, phone, office. Re-sync every 24 hours. | [S20] |
| Reply vs new | Separate shorter reply/forward template. Falls back to the primary signature if none is set. Extension only. | [S21] |
| Mobile | Not documented. | [S21] |
| Pricing | From $1.10 per user per month at 10 users, volume tiers, 14-day trial. | [S20] |
| Marketplace | 4.8 stars, 44 reviews, 588K+ installs, updated 2026-10-22. | [S22] |

## 5. Signitic

| Item | Finding | Source |
|---|---|---|
| Push mechanism | Admin connector writes signatures to Gmail after "signature updating" is enabled. Users refresh Gmail to see them. Writes to Gmail settings inferred from Marketplace scopes (unverified). Chrome or Edge extension adds internal/external variants and campaign choice. | [S23], [S24], [S25] |
| Admin grant | Super Admin connects. Reconnect needed if that admin's role changes. Permissions: Gmail settings, sensitive mail settings, OUs, user aliases, users, user schemas. | [S23], [S24] |
| Targeting | Map Google OUs. Groups are not supported for connection. Rules by team, department, entity, language, internal or external recipient. | [S23], [S26] |
| Directory variables | Import rules map Directory fields to variables. Users may edit their own data, optional approval before publish. | [S26] |
| Reply vs new | Not documented. | |
| Mobile | Claimed on Android and iOS for Workspace devices (vendor claim, unverified). | [S26] |
| Pricing (EUR, excl. VAT) | Free to 19 users (Signitic badge). Standard EUR 1 per user per month, minimum 20 licenses. Custom: contact sales. | [S27] |
| Admin UI worth copying | Locked brand elements; split roles (marketing, IT); user edit with approval; test Directory sync without pushing signatures. | [S26], [S28] |
| Marketplace | 4.5 stars, 12 reviews, 275K+, updated 2025-12-05. | [S24] |

## 6. Rocketseed

| Item | Finding | Source |
|---|---|---|
| Push mechanism | Server-side: mail routed through Rocketseed cloud, signed, delivered. Signature on Compose (SoC): Gmail API via a customer-created service account with DWD. | [S29], [S30] |
| Admin grant (SoC) | Admin creates a GCP project, enables Gmail API, creates a service account, grants DWD with `gmail.settings.basic` and `gmail.settings.sharing`, and gives the JSON key file to Rocketseed support. Propagation up to 24 hours. | [S30] |
| Reply vs new | Each user sets the SoC signature as the reply default in Gmail settings and ticks "Insert signature before quoted text". Server-side can use a shorter reply version. | [S29], [S30] |
| Targeting | Department, job title, seniority, location, combinations. | [S29] |
| Directory variables | Name, title, phone, department. | [S29] |
| Pricing | About $1 to $1.25 per user per month annual, all features on every plan, setup fee, custom pricing above 200 users. Page gives both figures. | [S29] |

## 7. Other data points

- Patronum: Gmail API cannot set the reply/forward signature. Only signatures tied to a send-as address can be set programmatically (updated 2026-02-23). [S31]
- Gmail API behaviour: the API updates the current default signature. If deleted, it creates a new one named "My signature" (Google engineer in GAM group, via search excerpt; unverified). [S32]
- Google native Append footer: one footer per OU, child OUs inherit, applies to outgoing mail and aliases, needs Gmail Settings admin privilege. No Directory variables. Footer lands at the bottom of the thread. [S33], [S34]
- Gimmio: no public mechanism documentation found. Dropped.

## Comparison: push mechanisms and admin grants

| Tool | Gmail API settings write | Server-side routing | Extension | Admin grant needed | Scopes or permissions (published) |
|---|---|---|---|---|---|
| Exclaimer | Yes (client-side) | Yes | No | Licensed Super Admin, Marketplace install, Gmail Hosts and SMTP relay for server-side | Gmail settings, insert, labels, Drive, Directory users, groups, OUs |
| CodeTwo | n/a | n/a | n/a | No Google product | n/a |
| WiseStamp | Yes (Basic, Grow) | Yes (Platform) | Yes | Super Admin, install for whole org, API Data Access Granted | Gmail settings, sensitive settings, domain email settings, Directory users |
| BulkSignature | Yes | No | Yes (replies) | Admin Marketplace install, Chrome force-install | Gmail settings, sensitive settings, users, groups, OUs, user schemas |
| Signitic | Yes (inferred) | No | Yes | Super Admin connector | Gmail settings, sensitive settings, users, aliases, OUs, user schemas |
| Rocketseed | Yes (SoC) | Yes | No | Manual DWD, customer service account, key handed to vendor | `gmail.settings.basic`, `gmail.settings.sharing` |
| Google Append footer | No | Gmail-internal | No | Gmail Settings admin | none |

Google API facts: `users.settings.sendAs.update` accepts `gmail.settings.basic` or `gmail.settings.sharing`. Gmail sanitizes signature HTML before saving. Non-primary addresses "can only be updated by service account clients that have been delegated domain-wide authority". [S35], [S36]

## Reviews

All figures via search excerpts, dated as read 2026-11-09. Direct page fetch returned HTTP 403.

| Tool | Rating | Praise | Complaints | Source |
|---|---|---|---|---|
| Exclaimer | G2 4.5 (about 1,400 reviews); Capterra 4.5 (585) | Simple Workspace integration; new hires sync from Directory | Built around Office 365 first; group addresses harder on Google; wants more custom HTML flexibility | [S37], [S38] |
| WiseStamp | G2 4.6 (573); Capterra 128 reviews | Auto-adds new employees | Sync fails for some users; manual activation of new signatures in Gmail; server-side setup takes manual Workspace work; price | [S39], [S40] |
| BulkSignature | G2 5.0 (10 to 11); Capterra 6 reviews | Easy Workspace setup; multiple orgs in one instance | Needs some HTML for templates; no control over campaign placement | [S41] |
| Signitic | Capterra 4.8 (67); G2 4.6 (171 to 202) | Ease of use, setup | Technical issues (6 reviews), learning curve (3) | [S42] |
| Rocketseed | Capterra 138 reviews; G2 4.6 (69) | Ease of use, templates, support | Renaming a signature drops its group assignments; mail-flow issues for IT; reply-thread image issues on Apple Mail | [S43] |

Marketplace review counts are small (12 to 51). Google does not verify Marketplace reviews. [S4], [S37]

## Lessons for Migway v2 signatures and v1 data model reservation

Mechanism choices for v2 (input to R4 and ADR-0004):
1. Server-side routing needs an external SMTP service. The brief forbids third-party servers. Out.
2. "Set my Gmail signature" with the user's own token and `gmail.settings.basic` updates the primary address only. No admin needed. Matches PLAN slice 8.
3. Central push for all users and aliases needs a DWD service account. A Workspace admin grants it. Rocketseed's flow shows the cost: a service account key exists and must be stored. Script Properties only, never the repo. Decision for the owner in v2.
4. The Gmail API cannot set the reply default. A user step ("use for replies", "insert before quoted text") stays manual. The add-on can insert a reply signature into the draft instead.
5. Compose insertion duplicates any Gmail default signature. All vendors resolve this by asking users to remove manual signatures. Migway v2 should either own the Gmail signature setting (push it) or insert only, never both.
6. Validate HTML length under 10,000 characters before push. Gmail fails silently above it.
7. Gmail mobile uses a separate plain-text signature. Store a plain-text variant.

Fields to reserve in the v1 data model (no v2 migration):
- `kind`: template or signature, on the shared content entity.
- `scope`: company, department, user.
- `targets`: lists of Google Group emails, OU paths, user emails.
- `priority`: integer; first matching rule wins (Exclaimer client-side model).
- `variants`: `newMail`, `reply` (short), `plainText` (mobile).
- `sendAs`: optional alias address the signature applies to.
- `placeholders`: Directory paths, e.g. `name.fullName`, `organizations[0].title`, `organizations[0].department`, `phones[type=work]`, plus custom schema fields (BulkSignature and Signitic read user schemas).
- `lockedFields` and `userEditableFields` with optional approval (WiseStamp, Signitic).
- `schedule`: start and end for banners (Exclaimer Standard, Rocketseed).
- Per-user push log: `lastPushedAt`, `pushedVersion`, `result`, `htmlLength`. Same audit log as templates.
- Version history and status `draft` or `published`, shared with templates.

Admin UI ideas: preview per user with real Directory data; "test sync without pushing" (Signitic); auto-disable on account removal (WiseStamp); keep group assignments stable across renames by using IDs (Rocketseed complaint).

## Sources (all read 2026-11-09)

- [S1] https://exclaimer.com/how-it-works/g-suite-email-signatures/
- [S2] https://exclaimer.com/blog/new-exclaimer-for-google-workspace/
- [S3] https://kbsupport.exclaimer.com/kb/guide/en/onboarding-exclaimer-for-client-side-google-workspace-CjNvSZm2vt/Steps/5194422
- [S4] https://workspace.google.com/marketplace/app/exclaimer_g_suite/441020792836
- [S5] https://kbsupport.exclaimer.com/kb/guide/en/how-to-configure-mail-flow-settings-in-the-google-workspace-admin-console-k6SbipcuT9/Steps/5194074 (HTTP 503; search excerpt only)
- [S6] https://support.exclaimer.com/hc/en-gb/articles/6814224050077 (search excerpt only, direct fetch 403)
- [S7] https://exclaimer.com/pricing/
- [S8] https://support.exclaimer.com/hc/en-gb/articles/35530137074845-Duplicate-signatures-in-Gmail-when-using-both-Client-Side-and-Server-Side-deployment (search excerpt only)
- [S9] https://exclaimer.com/blog/sent-items-update-for-google-workspace/ (search excerpt only)
- [S10] https://exclaimer.com/email-signature-handbook/how-to-create-a-signature-in-gmail-mobile-app/ (search excerpt only)
- [S11] https://www.codetwo.com/blog/?p=16251
- [S12] https://www.codetwo.com/email-signatures/
- [S13] https://www.codetwo.com/userguide/email-signatures/system-requirements.htm (search excerpt only)
- [S14] https://www.codetwo.com/email-signatures/pricing/
- [S15] https://www.wisestamp.com/google-workspace-signature-management/
- [S16] https://support.wisestamp.com/en/articles/12561485-google-workspace-integration
- [S17] https://www.wisestamp.com/pricing/
- [S18] https://workspace.google.com/marketplace/app/wisestamp_email_signature_management_for/842844122024
- [S19] https://support.wisestamp.com/en/articles/12561487-server-side-configuration-for-google-workspace
- [S20] https://bulksignature.com/google-workspace-integration
- [S21] https://bulksignature.com/blog/its-finally-here-email-signature-management-for-gmail-that-supports-replies-and-forwards
- [S22] https://workspace.google.com/marketplace/app/email_signature_management_for_gmail/64634722053
- [S23] https://support.signitic.com/en/articles/8224276-connect-google-workspace-to-signitic
- [S24] https://workspace.google.com/marketplace/app/signitic_email_signature_management_for/348680135472
- [S25] https://support.signitic.com/en/articles/9561104-how-does-the-gmail-extension-work
- [S26] https://www.signitic.com/en/central-signature-email-management-for-gmail-google-workspace
- [S27] https://www.signitic.com/en/pricing
- [S28] https://www.signitic.com/en/integration/gmail
- [S29] https://www.rocketseed.com/gsuite-email-signature-manager
- [S30] https://help.rocketseed.com/?p=606
- [S31] https://help.patronum.io/en/article/how-to-change-reply-to-email-signature-in-gmail-17iwdqe/
- [S32] https://groups.google.com/g/google-apps-manager/c/12EQbU6VcAE (search excerpt only)
- [S33] https://support.google.com/a/answer/2364576 (search excerpt only)
- [S34] https://exclaimer.com/email-signature-handbook/exclaimer-vs-google-workspace (search excerpt only)
- [S35] https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/update
- [S36] https://developers.google.com/workspace/gmail/api/guides/alias_and_signature_settings
- [S37] https://www.g2.com/products/exclaimer/reviews and https://capterra.com/p/188561/Exclaimer-Cloud/ and https://www.sourceforge.net/software/product/Exclaimer (search excerpts)
- [S38] https://www.trustradius.com/reviews/exclaimer-2023-05-26-08-36-23 (search excerpt)
- [S39] https://www.g2.com/products/wisestamp and https://capterra.com/p/153237/WiseStamp/reviews/ (search excerpts)
- [S40] https://www.trustradius.com/reviews/wisestamp-2023-06-27-10-29-38 (search excerpt)
- [S41] https://www.g2.com/compare/bulk-signature-vs-exclaimer and https://www.capterra.com/p/10003263/BulkSignature/ (search excerpts)
- [S42] https://capterra.com/p/209813/Signitic/reviews/ and https://www.g2.com/compare/codetwo-email-signatures-365-vs-signitic (search excerpts)
- [S43] https://capterra.com/p/171493/Rocketseed/reviews/ and https://www.g2.com/products/rocketseed (search excerpts)
- [S44] https://support.google.com/mail/answer/8395 (10,000 character limit, defaults for new mail and replies)
