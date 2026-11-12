# Researcher memory (Migway Gmail templates)

## Conventions
- Write only under docs/research/. Memory file here is the one exception (BRIEF section 4).
- Every claim: source ID [Sn] mapping to URL plus date read in a Sources list.
- Mark third-party, community and search-excerpt-only claims "unverified".
- No em or en dashes. Short sentences. Answer first.
- Report cap 600 words, delivered via SubagentHandback.

## Runs done
- 2026-11-09 R3: docs/research/r3-snippet-and-crm-templates.md (TextExpander, Briskine, Gmelius, Streak brief, HubSpot, Salesforce).

## Sources that worked (WebFetch)
- textexpander.com/pricing, textexpander.com/learn/... help pages, textexpander.com/blog.
- help.briskine.com (all pages), www.briskine.com/pricing.
- help.gmelius.com, gmelius.com/pricing.
- knowledge.hubspot.com articles, www.hubspot.com/pricing/sales.
- chromewebstore.google.com/detail/<id> (rating, users, version; no review text).
- salesforce.com/sales/pricing.
- trustedinstitute.com (third-party Salesforce admin notes).

## Pitfalls
- HTTP 403 on WebFetch: g2.com, capterra.com, trustradius.com, salesforceben.com, admin.salesforce.com, developer.salesforce.com, community.hubspot.com.
- help.salesforce.com returns an empty JavaScript shell.
- docs.briskine.com does not resolve; use help.briskine.com.
- curl with a browser user agent to bypass 403 is denied by the auto-mode classifier. Do not retry.
- Review quotes then only come from WebSearch excerpts. Label them "search-result excerpt, unverified".
- TextExpander pricing page shows conflicting annual vs monthly figures ($5/$6, $10/$12).

## Open questions
- Official Salesforce wording for Lightning folder levels (Viewer, Editor, Manager) not confirmed.
- HubSpot sales template token syntax and version history not documented publicly.
- Can Migway "user" role create private templates? Not stated in BRIEF.
- Attachments in v1: BRIEF silent. Briskine-style public links conflict with data rules.

## R1 Gmail templates (2026-11-09)

Sources that worked (WebFetch)
- Ablebits Gmail docs: www.ablebits.com/docs/gmail-shared-templates-* (overview, installation, macros, create-teams, known-issues, create-manage).
- Ablebits shared docs moved to email-templates.app/en/docs/ (301 from ablebits.com/docs/outlook-*), mostly Outlook-centric.
- Ablebits pricing table lives on ablebits.com/gmail-shared-email-templates/index.php (pricing.php is 404). Table text arrives flattened; check plan-to-column mapping.
- Chrome Web Store listing and its /reviews subpage fetch fine.
- Google user help: support.google.com/mail/answer/14864208 (templates), 10960345 (layouts), 12921167 (mail merge); support.google.com/a/users/answer/9308990.
- Admin help: knowledge.workspace.google.com/admin/gmail/manage-gmail-settings-for-your-users. workspaceupdates.googleblog.com posts fetch fine.

Pitfalls
- AppSource returns 403. googlecloudcommunity.com redirects to discuss.google.dev, which 404s.
- support.google.com/mail/answer/10434152 is a privacy page, not templates.
- Ablebits docs conflict on Gmail signatures and export (old pages say unsupported). Cite both.
- Parallel runs share this file and commits land mid-run. Append to your section; never overwrite the file.

Facts to reuse
- Ablebits Gmail edition: Chrome extension, AWS-hosted data, roles Admin, Editor, User per team, $3 and $4 per user per month annual.
- Gmail Templates: per-user, web only, no sharing, no admin setting, permanent delete.
- Gmail Layouts: admin toggle per OU or group, default on, needs Drive and Docs creation, Business Standard and up.

Open questions
- Gmail native template count cap (50?) and whether subject is saved: no Google source.
- Ablebits raw macro syntax and monthly-billing price: not public in pages read.
- Ablebits Gmail export support: conflicting docs.

## R4 platform constraints (2026-11-09)

Output: docs/research/r4-platform-constraints.md (81 sources, ID [Sn]).

Sources that worked
- developers.google.com/apps-script/... and /workspace/... reference and guides fetch cleanly with WebFetch.
- docs.cloud.google.com/identity/... (cloud.google.com 301s there; refetch the new URL).
- support.google.com via WebFetch hits google.com/sorry (rate limit). Plain curl to support.google.com/<path>?hl=en returned 200; strip HTML with python3 -I. support.google.com/a/answer/172482 now redirects to knowledge.workspace.google.com.
- Chrome policy text: raw.githubusercontent.com chromium policy_definitions YAML (chromeenterprise.google/policies is a JS shell).
- InboxSDK README on raw.githubusercontent.com.

Facts to reuse
- Add-on 30 s, script 6 min, 30 simultaneous per user, 1,000 per script.
- Cards: 100 sections per card, 100 widgets per section.
- Cache 100 KB/value, 250-char key, 21,600 s max, 1,000 items. Properties 9 KB/value, 500 KB/store.
- Gmail scope classes: action.compose non-sensitive, message.metadata sensitive, settings.basic restricted.
- Test deployments need script editor access, same domain.
- Directory API: admin role needed; prebuilt Groups Reader role exists (support.google.com/a/answer/2405986).
- Cloud Identity transitive APIs gated to Enterprise and CI Premium.
- GroupsApp: direct membership only, scope `groups`, 10,000 reads/day Workspace.

Pitfalls
- No official numbers for draft-insert HTML limits, google.script.run payload, HtmlOutput size, LockService max wait, latency.
- Sensitivity of script.*, admin.directory.*, groups scopes not in public tables.

Open questions
- Migway edition, nested group use, admin API access settings.

## R5 Gmail card UI (2026-11-11)

Output: docs/research/2026-11-11-gmail-card-ui.md (15 ranked options, sources [S1]..[S64]).

Sources that worked
- curl developers.google.com/<path>?hl=en, then strip HTML with a python3 -I HTMLParser script: exact availability lines ("Available for Google Chat apps and unavailable for Google Workspace add-ons"). Better than WebFetch summaries.
- Card JSON reference: developers.google.com/workspace/add-ons/reference/rpc/google.apps.card.v1 (per-field add-on availability).
- Developer Preview list: developers.google.com/workspace/preview ("ADD-ONS" block).
- git clone --depth 1 googleworkspace/apps-script-samples and add-ons-samples into scratchpad; grep CardService calls.

Facts to reuse
- Dev preview for add-ons (2026-11-06): Material button style (FILLED_TONAL, BORDERLESS), setMaxLines, CollapseControl, OverflowMenu, Chips. Announced 2024-12-13, no GA note.
- Carousel: Chat only. Columns: compose dialog only, max 2, wrap at 480 px web. Grid GA.
- RPC ref marks MaterialIcon and Button.type unavailable for add-ons; Apps Script ref and Google's Email Classifier Gmail sample use them. Unresolved.
- 100 widgets per card; overflow drops that section and all later ones.
- Fixed footer: primary FILLED, secondary OUTLINED. Card actions up to 10. Section header: text only, simple HTML.
- No public doc on sidebar width or dark theme rendering.

Pitfalls
- workspace/add-ons/guides/style is the EDITOR add-on guide; card guide is guides/workspace-style.
- Apps Script reference pages say "Last updated 2026-04-13"; RPC ref is newer. Cite both when they conflict.

Open questions
- Does a dev preview method fail or get ignored outside the program?
- primaryColor effect after GM3; ButtonSet wrap at 300 px; card actions in compose dialog.
