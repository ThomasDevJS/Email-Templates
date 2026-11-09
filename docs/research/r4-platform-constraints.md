# R4: Google platform constraints

Run: R4, Phase 1. Researcher (claude-opus-5-5). Date read for every source: 2026-11-09 unless stated. Public sources only. Source IDs [Sn] map to the list at the end. "Unverified" marks community sources, search excerpts and inferences.

## Summary

1. Add-on callbacks stop at 30 seconds. Web app and script executions stop at 6 minutes. [S1][S2]
2. Compose insert works: `UpdateDraftBodyAction` with `MUTABLE_HTML`, `IMMUTABLE_HTML` or `TEXT`, at cursor, start or end. Google documents no HTML size cap and no tag allowlist for draft inserts. [S3][S4][S5]
3. Compose needs `gmail.addons.current.action.compose` (non-sensitive). Reading recipients needs `draftAccess: METADATA` plus `gmail.addons.current.message.metadata` (sensitive). [S6][S7][S8]
4. Card limits: 100 sections per card, 100 widgets per section. No rich text editor widget. Text widgets accept 8 tags only. [S9][S10]
5. Add-ons run as the user accessing them. Only the web app can "execute as me" (`USER_DEPLOYING`). [S11][S12]
6. Test deployments need editor access to the script and same-domain testers. Pilot users would become script editors. [S13]
7. Marketplace publishing needs a standard GCP project. Private apps skip Google review. Visibility is permanent once saved. [S14][S15][S16]
8. Internal apps need no OAuth verification. Apps Script owner and users in the same Workspace domain need none either. [S17][S18]
9. Directory API group lookup needs an admin role. Google ships a prebuilt "Groups Reader" admin role usable through the Admin API. [S19][S20][S21]
10. `GroupsApp` runs as the user, needs no admin, resolves direct membership only, 10,000 group reads per day on Workspace. [S2][S22][S23]
11. Cloud Identity `checkTransitiveMembership` and `searchTransitiveGroups` resolve nesting but need Enterprise Standard, Enterprise Plus, Enterprise for Education or Cloud Identity Premium. [S24][S25]
12. Signature push: `sendAs.patch` needs `gmail.settings.basic` (restricted). Other users need a service account with domain-wide delegation set by a super admin. Signature cap 10,000 characters. [S26][S27][S28][S29]
13. Quotas: Properties 9 KB per value, 500 KB per store. Cache 100 KB per value, 6 h max, 1,000 items per cache. 30 simultaneous executions per user, 1,000 per script. [S2][S30]
14. Chrome extension path costs a one-time Chrome Web Store fee, depends on Gmail DOM, and needs Chrome browser management. InboxSDK sends remote error logs to Streak. Recommendation for ADR-0001: reject. [S31][S32][S33][S34]

## 1. Workspace add-on, Card Service, Gmail compose

| Fact | Value | Source | Date read |
|---|---|---|---|
| Compose UI manifest field | `addOns.gmail.composeTrigger` with `selectActions[]` (`text`, `runFunction`) and `draftAccess`. HTTP manifests call it `actions`. | [S6] | 2026-11-09 |
| `draftAccess` values | `NONE` (default when omitted, event has minimal info) or `METADATA` (event gets recipient lists, needs `gmail.addons.current.message.metadata`) | [S3] | 2026-11-09 |
| Compose trigger function | Must return one `Card` or an array of `Card` | [S3] | 2026-11-09 |
| Compose action return type | `UpdateDraftActionResponse` built with `UpdateDraftBodyAction`, `UpdateDraftSubjectAction`, `UpdateDraftToRecipientsAction`, Cc, Bcc variants | [S3] | 2026-11-09 |
| `UpdateDraftBodyAction` methods | `addUpdateContent(content, contentType)`, `setUpdateType(updateType)`. No size limit stated. | [S5] | 2026-11-09 |
| `UpdateDraftBodyType` | `IN_PLACE_INSERT` (default, at cursor, replaces selection), `INSERT_AT_START`, `INSERT_AT_END` | [S4] | 2026-11-09 |
| `INSERT_AT_END` and signature | Gmail web inserts after the signature. Gmail mobile inserts before it. | [S4] | 2026-11-09 |
| `ContentType` | `TEXT` (default), `MUTABLE_HTML` (editable after insert), `IMMUTABLE_HTML` (not editable) | [S5b] | 2026-11-09 |
| HTML size limit in draft insert | Not documented. Unverified. Needs a spike. | [S3][S5] | 2026-11-09 |
| Allowed tags in draft insert | Not documented. Google sample inserts `<img>` via `MUTABLE_HTML`. | [S3] | 2026-11-09 |
| Inline styles in draft insert | Not documented. One community thread reports Gmail partly drops `<style>` blocks, inline `style` attributes work better. Unverified. | [S35] | 2026-11-09 |
| Card section and widget cap | "you can't add more than 100 widgets or 100 card sections to a card". Large sections auto-collapse. | [S9] | 2026-11-09 |
| Widget catalogue | Button set, card header, section, fixed footer, peek card, image, DecoratedText, TextParagraph, card action, date and time pickers, image button, SelectionInput, switch, text button, TextInput, Grid. No rich text editor. | [S10] | 2026-11-09 |
| Text formatting in widgets | `<b> <i> <u> <s> <font color> <a href> <time> <br>` only | [S10] | 2026-11-09 |
| TextInput | Title required, `setMultiline`, `setSuggestions`, `setSuggestionsAction`, validation `setCharacterLimit`. No documented max length. `RICH_TEXT` input mode is Workspace Studio only. | [S36] | 2026-11-09 |
| Widget ID | `setId` max 64 chars, `[a-zA-Z0-9-]+` | [S36] | 2026-11-09 |
| SelectionInput | `CHECK_BOX`, `RADIO_BUTTON`, `DROP_DOWN`, `MULTI_SELECT`, `setExternalDataSource`. Platform data source is Chat only. No documented item cap. | [S37] | 2026-11-09 |
| Add-on runtime | 30 s per execution (consumer and Workspace) | [S2] | 2026-11-09 |
| Callback over 30 s | "your add-on UI might not update its card display properly" | [S1] | 2026-11-09 |
| Script runtime (non add-on) | 6 min per execution | [S2] | 2026-11-09 |
| Mobile support | "If a Google Workspace add-on extends Gmail, use it in both the desktop and mobile versions." Same interface everywhere. | [S38] | 2026-11-09 |
| Compose actions on mobile | Google blog, 2020-10-22: once authorized, compose features "work in Gmail across mobile and web". Current docs do not list per-platform gaps. | [S39] | 2026-11-09 |
| Universal actions | `addOns.common.universalActions[]`, each `label` plus `runFunction` or `openLink`. Callback must return `UniversalActionResponse`. No documented count cap. | [S6][S1] | 2026-11-09 |
| openLink | `setOpenAs(FULL_SIZE or OVERLAY)`, `setOnClose(NOTHING or RELOAD_ADD_ON)`. URL must match `openLinkUrlPrefixes`. COOP header on the target breaks reload detection. | [S40] | 2026-11-09 |
| `setOnClickOpenLinkAction` | Opens in a new window only | [S1] | 2026-11-09 |
| `urlFetchWhitelist` | https only, full domain, non-empty path, one leading wildcard max. Optional for test deployments, required for versioned deployments. | [S6] | 2026-11-09 |
| `oauthScopes` | Setting it disables automatic scope detection | [S41] | 2026-11-09 |
| `gmail.addons.execute` | No longer required since 2019-11-12. Apps Script and Gmail ignore it. | [S42] | 2026-11-09 |
| Default scope risk | Apps Script may add `https://mail.google.com/` (restricted). Replace with narrow scopes. | [S7] | 2026-11-09 |
| Navigation stack | Root homepage card can't be popped. No documented depth cap. | [S43] | 2026-11-09 |

## 2. Apps Script web app (HtmlService)

| Fact | Value | Source | Date read |
|---|---|---|---|
| `executeAs` | `USER_ACCESSING` or `USER_DEPLOYING` ("execute as me") | [S11] | 2026-11-09 |
| `access` | `MYSELF`, `DOMAIN` (same domain as deployer), `ANYONE` (any logged-in user), `ANYONE_ANONYMOUS` | [S11] | 2026-11-09 |
| URLs | `/exec` for deployments, `/dev` for latest saved code, editors only | [S12] | 2026-11-09 |
| URL shape for Workspace scripts | `script.google.com/a/macros/<domain>/s/<id>/exec` seen in community posts. Not in official docs. Unverified. | [S44] | 2026-11-09 |
| Custom domain | No official option. Community answer: code always runs on Google servers, use a redirect. Unverified. | [S44] | 2026-11-09 |
| Ownership move | Web app stops working if ownership moves to a shared drive or another domain. New owner must redeploy. | [S12] | 2026-11-09 |
| Active user email with "execute as me" | Available when the user is in the same Workspace domain as the developer. Blank if security policies block it. | [S45] | 2026-11-09 |
| `getEffectiveUser` with "execute as me" | Returns the developer account | [S45] | 2026-11-09 |
| Sandbox | `IFRAME` only. `setSandboxMode` has no effect. | [S46][S47] | 2026-11-09 |
| Sandbox attributes | `allow-same-origin`, `allow-forms`, `allow-scripts`, `allow-popups`, `allow-downloads`, `allow-modals`, `allow-popups-to-escape-sandbox`. `allow-top-navigation` restricted. | [S46] | 2026-11-09 |
| Links | Must use `target="_top"` or `_blank`, or a `<base>` tag | [S46] | 2026-11-09 |
| External resources | Scripts, stylesheets, XHR must be HTTPS. Google's own best-practice sample loads jQuery from `ajax.googleapis.com`. | [S46][S48] | 2026-11-09 |
| CSP | No documented CSP header limits. Unverified. | [S46] | 2026-11-09 |
| X-Frame-Options | `setXFrameOptionsMode(DEFAULT or ALLOWALL)` | [S47] | 2026-11-09 |
| Meta tags | Only `viewport`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `google-site-verification` via `addMetaTag`. Meta and favicon tags in the HTML file are ignored. | [S47] | 2026-11-09 |
| HtmlOutput size limit | Not documented. Unverified. | [S47] | 2026-11-09 |
| `google.script.run` types | Primitives, arrays and objects of them, one `form`. Dates, functions, DOM elements fail. | [S49] | 2026-11-09 |
| `google.script.run` concurrency | 10 concurrent calls, 11th queues. Browsers may cap lower (Firefox 6). | [S49] | 2026-11-09 |
| `google.script.run` payload size | Not documented. Unverified. | [S49] | 2026-11-09 |
| Private server functions | Names ending in `_` are not callable from the client | [S49] | 2026-11-09 |
| Server call runtime | 6 min (script runtime) | [S2] | 2026-11-09 |
| Templated HTML | Nothing reaches the browser until scriptlets finish. Load data async with `google.script.run`. | [S48] | 2026-11-09 |
| Multiple signed-in accounts | "isn't supported for Apps Script, add-ons, or web apps." Fix: sign out of others or use incognito. | [S50] | 2026-11-09 |
| Cookies and localStorage in iframe | Not documented. Community reports `localStorage` SecurityError when Chrome blocks third-party cookies. Unverified. | [S51] | 2026-11-09 |
| Authorization rate | Apps Script limits how fast new users can authorize "execute as user" apps. No number published. | [S12] | 2026-11-09 |
| Deployments | One head deployment. Many versioned deployments. Editing a deployment to a new version keeps its URL. | [S52] | 2026-11-09 |
| Versions cap | 200 per script | [S2] | 2026-11-09 |

## 3. Chrome extension alternative

| Fact | Value | Source | Date read |
|---|---|---|---|
| Policy | `ExtensionInstallForcelist`, list of `extensionId;updateUrl`. Silent install, users can't remove. Not applied in Incognito. | [S31] | 2026-11-09 |
| Off-store extensions | Windows: AD, Entra ID or Chrome Enterprise Core enrollment needed. macOS: MDM, MCX or Chrome Enterprise Core. | [S31] | 2026-11-09 |
| Admin console path | Devices > Chrome > Apps & extensions > Users & browsers. Installation policy: Force install, or Force install + pin. | [S32] | 2026-11-09 |
| Who it reaches | Users signed in to Chrome with a managed account, or enrolled browsers. Needs Chrome browser management turned on per OU. | [S32] | 2026-11-09 |
| Cap | 500 for total apps times groups | [S32] | 2026-11-09 |
| Chrome Web Store visibility | Public, Unlisted, Private (trusted testers, Google Groups, or Workspace domain if the admin enabled it). All go through review. | [S53] | 2026-11-09 |
| Developer registration | One-time fee required. Amount not on the page. $5 widely reported, unverified. Conflicts with $0 budget only if paid. | [S54] | 2026-11-09 |
| Manifest V3 | All logic in the package. No remote code, no `eval`, no `new Function`. | [S55] | 2026-11-09 |
| MV2 end | Disabled for all users in Chrome 138 (2025-07-24). Enterprise exemption policy removed in Chrome 139. | [S56] | 2026-11-09 |
| InboxSDK license | Apache-2.0 or MIT. Requires an app ID from register.inboxsdk.com. | [S33] | 2026-11-09 |
| InboxSDK DOM risk | README: Gmail versions differ in "HTML structure, ajax request/response formats", SDK ships updates as Gmail changes | [S33] | 2026-11-09 |
| InboxSDK data flow | README describes remote error logging to Streak, with HTML censoring. Sends data outside Workspace. Exact payload unverified. | [S33] | 2026-11-09 |
| Mobile | Chrome extensions do not run in Gmail mobile apps. Inference, unverified. | none | 2026-11-09 |

## 4. OAuth scopes and sensitivity

Prefix `https://www.googleapis.com/auth/` omitted.

| Scope | Class | Needed by | Source | Date read |
|---|---|---|---|---|
| `gmail.addons.current.action.compose` | Non-sensitive | Compose trigger and draft updates | [S8] | 2026-11-09 |
| `gmail.addons.current.message.metadata` | Sensitive | `draftAccess: METADATA` (recipient first name) | [S8] | 2026-11-09 |
| `gmail.addons.execute` | Ignored since 2019 | None | [S42] | 2026-11-09 |
| `script.external_request` | Not classified in docs. Unverified. | UrlFetchApp | [S7] | 2026-11-09 |
| `script.storage` | Not classified. Unverified. | Properties, Cache, Lock (inference) | [S7] | 2026-11-09 |
| `script.locale` | Not classified. Unverified. | User locale and timezone | [S7] | 2026-11-09 |
| `userinfo.email` | Non-sensitive (standard sign-in scope, unverified label) | Current user email | [S7] | 2026-11-09 |
| `drive.file` | Non-sensitive | Files the app created or opened | [S57] | 2026-11-09 |
| `drive` | Restricted | Full Drive | [S57] | 2026-11-09 |
| `spreadsheets` | Sensitive | All user spreadsheets | [S58] | 2026-11-09 |
| `admin.directory.group.readonly` | Not in public tables. Unverified. | groups.list, members.hasMember | [S19][S59] | 2026-11-09 |
| `admin.directory.user.readonly` | Unverified | users.get (OU path) | [S59] | 2026-11-09 |
| `admin.directory.orgunit.readonly` | Unverified | OU tree | [S59] | 2026-11-09 |
| `groups` | Unverified | GroupsApp | [S22] | 2026-11-09 |
| `cloud-identity.groups.readonly` | Unverified | Cloud Identity Groups API | [S24] | 2026-11-09 |
| `gmail.settings.basic` | Restricted | sendAs signature update | [S8] | 2026-11-09 |
| `gmail.settings.sharing` | Restricted, "administrative use only", service account with DWD only | Not needed for signatures | [S8] | 2026-11-09 |

Verification for Internal apps:

| Fact | Value | Source | Date read |
|---|---|---|---|
| Internal apps | No verification needed when used only inside the org, the project is owned by the org and the consent screen is Internal | [S17] | 2026-11-09 |
| Apps Script same domain | "Verification isn't required for Google Apps Script projects whose owner and users belong to the same Google Workspace domain or customer." | [S18] | 2026-11-09 |
| Internally published apps | Do not trigger the unverified-app flow for accounts in that domain | [S18] | 2026-11-09 |
| Gmail-account publisher | Triggers the unverified flow even for same-domain users | [S18] | 2026-11-09 |
| Restricted scopes and admin API controls | Admin console "Trust internal apps" lets internal apps reach restricted Workspace APIs when the admin limits API access | [S60] | 2026-11-09 |
| Answer | None of the listed scopes needs Google verification for an Internal app owned by Migway. A restricted scope can still be blocked by admin API controls. | [S17][S18][S60] | 2026-11-09 |

## 5. Admin install steps

| Fact | Value | Source | Date read |
|---|---|---|---|
| Test deployment | Deploy > Test deployments > Install. Needs editor access to the script. Testers must be in the owner's domain. | [S13] | 2026-11-09 |
| Default GCP project | Created automatically. Fine for scripts. "You can't use the default Google Cloud project to publish." | [S14][S61] | 2026-11-09 |
| Standard project also needed for | OAuth client verification, Cloud logs in console, consent screen edits, manual API enablement | [S61] | 2026-11-09 |
| Switch back | A script can't return to a default project | [S61] | 2026-11-09 |
| Publisher | A script collaborator in the owner's domain, with edit access | [S14] | 2026-11-09 |
| Marketplace SDK App Configuration | Visibility Public, Private or Unlisted. Installation: Individual + Admin, or Admin Only. Integration: Workspace add-on with the deployment ID. OAuth scopes must match consent screen and manifest. | [S16] | 2026-11-09 |
| Private visibility | Workspace account only. Permanent. Domain users only. | [S16][S15] | 2026-11-09 |
| Review | Private apps are not reviewed by Google | [S14] | 2026-11-09 |
| Store listing | Required even for private apps (logo, website) | [S15] | 2026-11-09 |
| IAM role to publish | `roles/appmetadata.workspaceMarketplaceAppConfigurationAdmin`, or Editor, or Owner | [S16] | 2026-11-09 |
| Admin console path | Apps > Google Workspace Marketplace apps > Apps list > Install app > Admin install | [S62] | 2026-11-09 |
| Audience | "Everyone at your organization" or "Certain groups or organizational units" | [S62] | 2026-11-09 |
| Privilege | Super administrator per the install article. Marketplace administrator privilege for the Apps list. | [S62] | 2026-11-09 |
| Propagation | Up to 24 hours | [S62] | 2026-11-09 |
| Consent | Domain install bypasses the user consent screen for approved apps | [S60] | 2026-11-09 |
| Internal apps setting | Admins can allow users to install and run internal apps while restricting third-party apps. Off by default. Search excerpt. Unverified. | [S63] | 2026-11-09 |
| Web app install | No install step. Users open the `/exec` URL and consent (execute as user) or not (execute as me). | [S12] | 2026-11-09 |
| Chrome extension install | Section 3 | [S32] | 2026-11-09 |

## 6. Signature push (v2 input)

| Fact | Value | Source | Date read |
|---|---|---|---|
| Method | `users.settings.sendAs.patch` or `update` | [S26] | 2026-11-09 |
| Scopes | `gmail.settings.basic` or `gmail.settings.sharing` | [S26] | 2026-11-09 |
| Class | Both restricted | [S8] | 2026-11-09 |
| Signature field | "optional HTML signature that is included in messages composed with this alias in the Gmail web UI". New emails only. | [S27] | 2026-11-09 |
| Size limit | "You can put up to 10,000 characters in your signature." Images count toward it. API limit not stated, assumed same. Unverified for API. | [S28] | 2026-11-09 |
| Sanitization by API | Not documented. Unverified. | [S27] | 2026-11-09 |
| Own token path | User authorizes `gmail.settings.basic`, script patches the user's own sendAs. No admin. Internal app needs no verification. | [S26][S18] | 2026-11-09 |
| Other users | Service account with domain-wide delegation. Super admin: Security > Access and data control > API controls > Manage Domain Wide Delegation. Changes up to 24 h. Multi-party approval may apply. | [S29][S64] | 2026-11-09 |
| DWD risk | Service account can impersonate any user, including super admins. Target for privilege escalation. Restrict scopes. Avoid if the OAuth consent flow works. | [S65] | 2026-11-09 |
| Key risk | Keys need no prior auth, no non-repudiation. Google recommends blocking key creation by org policy. | [S65] | 2026-11-09 |
| Apps Script fit | Apps Script has no native service account. DWD needs a service account key or IAM signJwt via UrlFetch, plus a standard GCP project (no billing needed, unverified). Inference. Unverified. | none | 2026-11-09 |
| Mobile | Signature applies to Gmail web UI only per API doc | [S27] | 2026-11-09 |

## 7. Apps Script quotas

Per user per day unless stated. Consumer / Workspace.

| Fact | Consumer | Workspace | Source | Date read |
|---|---|---|---|---|
| Script runtime | 6 min | 6 min | [S2] | 2026-11-09 |
| Add-on runtime | 30 s | 30 s | [S2] | 2026-11-09 |
| Custom function runtime | 30 s | 30 s | [S2] | 2026-11-09 |
| Simultaneous executions per user | 30 | 30 | [S2] | 2026-11-09 |
| Simultaneous executions per script | 1,000 | 1,000 | [S2] | 2026-11-09 |
| Triggers total runtime | 90 min | 6 h | [S2] | 2026-11-09 |
| Triggers | 20 per user per script | 20 | [S2] | 2026-11-09 |
| URL Fetch calls | 20,000 | 100,000 | [S2] | 2026-11-09 |
| URL Fetch response / POST | 50 MB | 50 MB | [S2] | 2026-11-09 |
| URL Fetch URL length / headers | 2 KB / 100, 8 KB | same | [S2] | 2026-11-09 |
| Properties read/write | 50,000 | 500,000 | [S2] | 2026-11-09 |
| Properties value / store | 9 KB / 500 KB | same | [S2] | 2026-11-09 |
| Groups read | 2,000 | 10,000 | [S2] | 2026-11-09 |
| Spreadsheets created | 250 | 3,200 | [S2] | 2026-11-09 |
| Documents created | 250 | 1,500 | [S2] | 2026-11-09 |
| Email recipients | 100 | 1,500 (2,000 in domain) | [S2] | 2026-11-09 |
| Email read/write (not send) | 20,000 | 50,000 | [S2] | 2026-11-09 |
| Email body size | 200 KB | 400 KB | [S2] | 2026-11-09 |
| Versions | 200 per script | 200 | [S2] | 2026-11-09 |
| Apps Script projects | 50 per day | 50 | [S2] | 2026-11-09 |
| DriveApp and SpreadsheetApp call counts | No published daily cap. "Service invoked too many times" on excess. | [S2][S50] | 2026-11-09 |
| Cache value / key | 100 KB / 250 chars | [S30] | 2026-11-09 |
| Cache expiry | Default 600 s, max 21,600 s, min 1 s. Best effort. | [S30] | 2026-11-09 |
| Cache item cap | 1,000 per cache. Overflow keeps the 900 farthest from expiry. | [S30] | 2026-11-09 |
| Cache eviction observed | FIFO by creation time, about 100 items per eviction, reads do not protect. Third party, 2025-12-22. | [S66] | 2026-11-09 |
| Properties manual entries | 50 via UI, more via code | [S67] | 2026-11-09 |
| LockService | Script, user, document locks. `tryLock` / `waitLock(ms)`. Max wait not documented. Unverified. | [S68][S69] | 2026-11-09 |
| Advanced Drive API | 1,000,000 units/min/project, 325,000/min/user. Read 5, list 100, write 50, download 200 units. | [S70] | 2026-11-09 |
| Advanced Sheets API | 300 reads/min/project, 60 reads/min/user/project, same for writes. 180 s timeout. 2 MB payload advised. | [S71] | 2026-11-09 |
| Directory API | 2,400 queries/min/user/project | [S20] | 2026-11-09 |
| Web app concurrency | Bounded by 30 per user and 1,000 per script | [S2] | 2026-11-09 |
| HtmlService response size | Not documented. Unverified. | [S47] | 2026-11-09 |

Latency (no official numbers exist):

| Operation | Value | Source | Date read |
|---|---|---|---|
| CacheService read+write | about 63 ms per pair | [S72] third party, 2024-03-16 | 2026-11-09 |
| PropertiesService read+write | about 80 ms per pair | [S72] | 2026-11-09 |
| SpreadsheetApp read+write | about 800 ms or more per pair | [S72] | 2026-11-09 |
| Firestore REST via UrlFetch | about 350 ms | [S72] | 2026-11-09 |
| Sheets API vs SpreadsheetApp reads | Sheets API about 35% lower cost. Unverified (search excerpt). | [S73] | 2026-11-09 |
| DriveApp file read, UrlFetch to Google APIs | No published figure found. Unverified. Measure in slice 2. | none | 2026-11-09 |

## 8. Directory, groups and OUs (ADR-0003)

| Fact | Value | Source | Date read |
|---|---|---|---|
| Admin SDK audience | Directory advanced service is for "administrators of Google Workspace domains". Must be enabled in the script and for the domain. | [S74] | 2026-11-09 |
| Delegated admins | "All of the operations for the Directory API support delegated administrators" | [S75] | 2026-11-09 |
| Groups Reader role | Prebuilt admin role. "Can read Groups information". Works in Admin console and Admin API. Can be limited to security or non-security groups. | [S21] | 2026-11-09 |
| Groups Admin role | Also views user profiles, org structure and OUs | [S21] | 2026-11-09 |
| `groups.list?userKey=` | Lists groups a user belongs to. Scope `admin.directory.group(.readonly)`. Max 200 per page. | [S19] | 2026-11-09 |
| Non-admin calling `groups.list` for self | 403 "Not Authorized to access this resource/api" in community reports. Not stated in docs. Unverified. | [S76] | 2026-11-09 |
| `members.hasMember` | Direct or nested. Nested requires same-domain member and group. Scopes include `admin.directory.group.member.readonly`. | [S77] | 2026-11-09 |
| Nested propagation | Child group members can take up to 10 min to appear in the parent | [S20] | 2026-11-09 |
| Users for non-admins | Any domain user can read profiles with `viewType=domain_public`, scope `admin.directory.user.readonly`. Contact sharing must be on. | [S78] | 2026-11-09 |
| OU path for non-admins | `orgUnitPath` in `domain_public` view not confirmed. Unverified. | [S78] | 2026-11-09 |
| Cloud Identity `searchTransitiveGroups` | Edition-gated (Enterprise Standard, Enterprise Plus, Enterprise for Education, Cloud Identity Premium), else 403. Actor needs view permission on all transitive groups. Page size 200 default, 1,000 max. | [S24] | 2026-11-09 |
| Cloud Identity `checkTransitiveMembership` | Same edition gate. Actor needs view on at least one transitive path. | [S25] | 2026-11-09 |
| Cloud Identity `searchDirectGroups` | No edition gate stated. Groups the caller can't view are silently dropped. | [S79] | 2026-11-09 |
| Cloud Identity non-admin mode | Non-members and members can read groups and memberships by default. Group owners can change role permissions. | [S80] | 2026-11-09 |
| Cloud Identity from Apps Script | No advanced service. Needs UrlFetch, `cloud-identity.groups.readonly`, and the API enabled in a standard GCP project. Inference. Unverified. | [S81] | 2026-11-09 |
| `GroupsApp.getGroups()` | Groups where the current user is a direct or pending member. Scope `groups`. No admin. | [S22] | 2026-11-09 |
| `Group.hasUser(email)` | Direct members only. Throws if the caller can't view the member list. | [S23] | 2026-11-09 |
| `Group.hasGroup` | Not true for nesting deeper than one level | [S23] | 2026-11-09 |
| GroupsApp quota | Groups read 10,000 per user per day (Workspace) | [S2] | 2026-11-09 |
| Groups Settings API | Admin-only settings API. Not needed for membership. Unverified. | none | 2026-11-09 |
| Advanced service enablement | Editor Services panel or `dependencies.enabledAdvancedServices`. Default project auto-enables the API. Standard project needs manual enablement. | [S81] | 2026-11-09 |
| Directory rate limit | 2,400 queries/min/user/project. Back off 1, 2, 4, 8, 16 s plus jitter. | [S20] | 2026-11-09 |
| Read latency | No official figure. Unverified. | none | 2026-11-09 |
| Caching rules | No Google rule. Nested changes take up to 10 min, so a TTL of 10 to 60 min matches the platform delay (opinion). | [S20] | 2026-11-09 |

Options for resolving role membership, derived from the table above:

| Option | Identity | Nested groups | OU | Admin needed | Edition | Notes |
|---|---|---|---|---|---|---|
| A. GroupsApp in add-on and web app | User | No | No | No | Any | Direct only. Simple. |
| B. Admin SDK from web app "execute as me" | Owner with Groups Reader | Yes (`hasMember`) | Yes | One-time role grant | Any | Add-on runs as user, so it must call the web app or read a precomputed index |
| C. Time-driven trigger as admin identity writes a membership index | Trigger creator | Yes | Yes | One-time role grant | Any | Index stored where add-on can read it. Trigger runtime 6 h/day budget. |
| D. Cloud Identity transitive APIs with user token | User | Yes | No | No | Enterprise or CI Premium | Needs standard GCP project |
| E. Cloud Identity `searchDirectGroups` with user token | User | No | No | No | Any (unverified) | Needs standard GCP project |

## Implications for ADR-0001 to ADR-0005

| Finding | ADR | Effect |
|---|---|---|
| 30 s add-on cap, 100 widgets per section, no rich text widget | 0001 | Sidebar lists, searches, applies. Editing lives in the web app. Paginate lists under 100 widgets. |
| `UpdateDraftBodyAction` with `IN_PLACE_INSERT` and `MUTABLE_HTML` | 0001, 0004 | One-click apply is supported on web and mobile. |
| No documented HTML size, tag or style rules for draft inserts | 0004 | Spike in slice 4: test tables, inline styles, `<img>`, 50 KB and 200 KB bodies on web, Android, iOS. |
| `INSERT_AT_END` lands after signature on web, before it on mobile | 0004 (v2) | Signature insert position differs by client. |
| `draftAccess: METADATA` needs a sensitive scope | 0004 | Recipient first name costs one sensitive scope. Internal app avoids verification. |
| Openlink `OVERLAY` and `RELOAD_ADD_ON` | 0001 | Sidebar can open the web app editor and refresh on close. Avoid COOP on the web app. |
| Multi-login unsupported | 0001 | Web app breaks for users signed in to several Google accounts. Document in user quick start. |
| Test deployments need editor access | 0001, 0005 | Pilot users become script editors. Pilot via private Marketplace app is cleaner once 2.5b exists. |
| Chrome extension: fee, DOM coupling, browser management, InboxSDK logs to Streak, no mobile | 0001 | Reject as a delivery channel. |
| Add-on always runs as the user | 0002, 0003 | Add-on code can read only what the user can read. If storage files are shared to users, users can open them directly and bypass the permission layer. |
| Web app "execute as me" plus `access: DOMAIN` gives same-domain email via `getActiveUser` | 0003 | Server-side enforcement is possible in the web app with storage private to the owner. |
| Properties 9 KB per value, 500 KB per store | 0002 | Properties can't hold 1,000 templates. Use for config only. |
| Cache 100 KB per value, 1,000 items, FIFO eviction, 6 h max | 0002 | Cache a chunked index. Expect eviction. Rebuild on miss. |
| SpreadsheetApp about 800 ms per op vs Cache about 63 ms (third party) | 0002 | Sidebar 3 s budget needs a cache hit on the hot path. |
| Sheets API 60 reads/min/user/project | 0002 | Fine for 500 users if cached. |
| Directory API needs an admin role. Groups Reader exists. | 0003 | Owner is not admin. An admin grants Groups Reader to a service mailbox, which runs a trigger or the web app. |
| GroupsApp: direct membership only, no admin | 0003 | Viable v1 path if Migway avoids nested groups for roles. |
| Cloud Identity transitive APIs edition-gated | 0003 | Depends on Migway edition. Open question. |
| Nested membership lag 10 min | 0003 | Cache TTL of 10 to 60 min is consistent. |
| Standard GCP project needed for Marketplace and for Cloud Identity API | 0005 | Dev on default project. Prod on standard project in 2.5b. A script can't return to default. |
| Ownership move to shared drive breaks the web app until redeploy | 0005 | Move prod script before first prod deploy. |
| 200 versions per script | 0005 | Prune versions. Rollback = point deployment to an earlier version. |
| `gmail.settings.basic` restricted, DWD impersonates anyone | v2 signatures | Prefer "set my signature" with the user's own token. Central push needs DWD, a service account key or signJwt, super admin approval. |
| Signature 10,000 characters including images | v2, 0004 | Signature editor must count characters and reject over 10,000. |

## Open questions

1. Migway Workspace edition. Decides Cloud Identity transitive APIs (D option).
2. Does Migway use nested groups for roles? Decides GroupsApp viability.
3. Does the admin restrict API access ("Trust internal apps", unconfigured third-party apps)? Affects restricted scopes.
4. Draft insert HTML limits, style survival, image survival: undocumented. Needs a spike.
5. `google.script.run` payload size and HtmlOutput size: undocumented.
6. LockService max wait: undocumented.
7. Is `orgUnitPath` visible to non-admins with `domain_public`? Undocumented.
8. Chrome Web Store fee amount: page does not state it.
9. Sensitivity labels for `script.*`, `admin.directory.*`, `groups`, `cloud-identity.groups.readonly`: not in public tables. Check in Cloud console during 2.5b. Irrelevant for an Internal app.
10. Does compose trigger behave identically on Gmail iOS and Android today? Last Google statement is the 2020 blog.

## Sources

All read 2026-11-09.

- [S1] https://developers.google.com/workspace/add-ons/concepts/actions
- [S2] https://developers.google.com/apps-script/guides/services/quotas
- [S3] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui
- [S4] https://developers.google.com/apps-script/reference/card-service/update-draft-body-type
- [S5] https://developers.google.com/apps-script/reference/card-service/update-draft-body-action
- [S5b] https://developers.google.com/apps-script/reference/card-service/content-type
- [S6] https://developers.google.com/workspace/add-ons/concepts/manifests
- [S7] https://developers.google.com/workspace/add-ons/concepts/workspace-scopes
- [S8] https://developers.google.com/workspace/gmail/api/auth/scopes
- [S9] https://developers.google.com/workspace/add-ons/concepts/cards
- [S10] https://developers.google.com/workspace/add-ons/concepts/widgets
- [S11] https://developers.google.com/apps-script/manifest/web-app-api-executable
- [S12] https://developers.google.com/apps-script/guides/web
- [S13] https://developers.google.com/workspace/add-ons/how-tos/testing-workspace-addons
- [S14] https://developers.google.com/workspace/add-ons/how-tos/publish-add-on-overview
- [S15] https://developers.google.com/workspace/marketplace/how-to-publish
- [S16] https://developers.google.com/workspace/marketplace/enable-configure-sdk
- [S17] https://support.google.com/cloud/answer/13464323
- [S18] https://developers.google.com/apps-script/guides/client-verification
- [S19] https://developers.google.com/workspace/admin/directory/reference/rest/v1/groups/list
- [S20] https://developers.google.com/workspace/admin/directory/v1/limits
- [S21] https://support.google.com/a/answer/2405986
- [S22] https://developers.google.com/apps-script/reference/groups/groups-app
- [S23] https://developers.google.com/apps-script/reference/groups/group
- [S24] https://docs.cloud.google.com/identity/docs/reference/rest/v1/groups.memberships/searchTransitiveGroups
- [S25] https://docs.cloud.google.com/identity/docs/reference/rest/v1/groups.memberships/checkTransitiveMembership
- [S26] https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/patch
- [S27] https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs
- [S28] https://support.google.com/mail/answer/8395
- [S29] https://developers.google.com/workspace/guides/create-credentials
- [S30] https://developers.google.com/apps-script/reference/cache/cache
- [S31] https://raw.githubusercontent.com/chromium/chromium/main/components/policy/resources/templates/policy_definitions/Extensions/ExtensionInstallForcelist.yaml
- [S32] https://support.google.com/chrome/a/answer/6306504
- [S33] https://github.com/InboxSDK/InboxSDK (README.md, main branch)
- [S34] https://www.inboxsdk.com/
- [S35] https://groups.google.com/g/google-apps-script-community/c/shlAvFQzQ74 (search excerpt, unverified)
- [S36] https://developers.google.com/apps-script/reference/card-service/text-input
- [S37] https://developers.google.com/apps-script/reference/card-service/selection-input
- [S38] https://developers.google.com/workspace/add-ons/concepts/types
- [S39] https://developers.googleblog.com/en/enhancing-add-ons-in-gmail-with-compose-time-functions/
- [S40] https://developers.google.com/apps-script/reference/card-service/open-link
- [S41] https://developers.google.com/apps-script/concepts/scopes
- [S42] https://developers.google.com/workspace/add-ons/release-notes
- [S43] https://developers.google.com/workspace/add-ons/how-tos/navigation
- [S44] https://groups.google.com/g/google-apps-script-community/c/c2BDl3nMsFI (search excerpt, unverified)
- [S45] https://developers.google.com/apps-script/reference/base/session
- [S46] https://developers.google.com/apps-script/guides/html/restrictions
- [S47] https://developers.google.com/apps-script/reference/html/html-output
- [S48] https://developers.google.com/apps-script/guides/html/best-practices
- [S49] https://developers.google.com/apps-script/guides/html/communication
- [S50] https://developers.google.com/apps-script/guides/support/troubleshooting
- [S51] https://groups.google.com/g/google-apps-script-community/c/Yaeavk6PuXk (search excerpt, unverified)
- [S52] https://developers.google.com/apps-script/concepts/deployments
- [S53] https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- [S54] https://developer.chrome.com/docs/webstore/register
- [S55] https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- [S56] https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- [S57] https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- [S58] https://developers.google.com/workspace/sheets/api/scopes
- [S59] https://developers.google.com/workspace/admin/directory/v1/guides/authorizing
- [S60] https://support.google.com/a/answer/7281227
- [S61] https://developers.google.com/apps-script/guides/cloud-platform-projects
- [S62] https://knowledge.workspace.google.com/admin/apps/install-marketplace-apps-for-your-organization
- [S63] https://workspaceupdates.googleblog.com/2023/10/allow-users-to-install-and-run-internal-apps.html (search excerpt, unverified)
- [S64] https://support.google.com/a/answer/162106
- [S65] https://docs.cloud.google.com/iam/docs/best-practices-service-accounts
- [S66] https://justin.poehnelt.com/posts/exploring-apps-script-cacheservice-limits/ (third party)
- [S67] https://developers.google.com/apps-script/guides/properties
- [S68] https://developers.google.com/apps-script/reference/lock/lock
- [S69] https://developers.google.com/apps-script/reference/lock/lock-service
- [S70] https://developers.google.com/workspace/drive/api/guides/limits
- [S71] https://developers.google.com/workspace/sheets/api/limits
- [S72] https://justin.poehnelt.com/posts/apps-script-key-value-stores/ (third party)
- [S73] https://gist.github.com/tanaikech/d102c9600ba12a162c667287d2f20fe4 (search excerpt, unverified)
- [S74] https://developers.google.com/apps-script/advanced/admin-sdk-directory
- [S75] https://developers.google.com/workspace/admin/directory/v1/guides/prerequisites
- [S76] https://github.com/googleapis/google-api-nodejs-client/issues/1884 and https://groups.google.com/g/google-apis-explorer-users/c/xDTOqLbP-Lg (search excerpts, unverified)
- [S77] https://developers.google.com/workspace/admin/directory/reference/rest/v1/members/hasMember
- [S78] https://developers.google.com/workspace/admin/directory/v1/guides/manage-users
- [S79] https://docs.cloud.google.com/identity/docs/reference/rest/v1/groups.memberships/searchDirectGroups
- [S80] https://docs.cloud.google.com/identity/docs/concepts/auth
- [S81] https://developers.google.com/apps-script/guides/services/advanced
