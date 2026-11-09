# ADR-0001: Delivery approach

Status: Proposed
Date: 2026-11-09
Deciders: owner (thomas@migway.com), architect

## Context

Users apply a template to a Gmail draft in one click, and editors need a rich-text editor. The brief allows Google Workspace only, $0, least privilege (BRIEF sections 1, 10, 11). D4 is closed: no Chrome extension (PLAN D4).

Platform limits that bound the choice:

| Limit | Value | Source |
|---|---|---|
| Add-on callback runtime | 30 s, card may fail to update after that | [R4 S1, S2] |
| Widgets | 100 per card, 100 per section, large sections auto-collapse | [R4 S9] |
| Widget text formatting | 8 tags: `b i u s font-color a time br` | [R4 S10] |
| Rich text editor widget | None. `RICH_TEXT` TextInput is Workspace Studio only | [R4 S10, S36] |
| Draft insert | `UpdateDraftBodyAction`, `IN_PLACE_INSERT` at cursor, `MUTABLE_HTML` stays editable | [R4 S4, S5, S5b] |
| Add-on identity | Always the user | [R4 S11] |
| Web app identity | `USER_ACCESSING` or `USER_DEPLOYING` | [R4 S11] |
| Web app runtime | 6 min per call, `IFRAME` sandbox, links need `target="_top"` or `_blank` | [R4 S2, S46] |
| openLink | `OVERLAY` or `FULL_SIZE`, `onClose` `NOTHING` or `RELOAD_ADD_ON`, URL must match `openLinkUrlPrefixes`, COOP on the target breaks reload detection | [R4 S40] |
| Multiple signed-in accounts | Not supported for Apps Script, add-ons or web apps | [R4 S50] |
| Mobile | Add-ons that extend Gmail run on desktop and mobile | [R4 S38, S39] |
| Manifest scopes | One `oauthScopes` list per Apps Script project. Setting it disables auto-detection | [R4 S41] |

## Options

1. Workspace add-on (compose sidebar) plus Apps Script web app. Sidebar lists, searches, previews and applies. Web app carries editing and admin. Cost $0. Risk: two surfaces, add-on to web app call (ADR-0003).
2. Chrome extension (InboxSDK or own content script). Rejected by D4. Facts: Chrome Web Store fee, Gmail DOM coupling, Chrome browser management per OU, InboxSDK remote error logs to Streak, no Gmail mobile [R4 S31 to S34, S53, S54]. Breaks the "no data outside Workspace" rule through Streak logging.
3. Web app only. User opens the web app, fills prompts, copies rendered HTML, pastes into Gmail. No Gmail scopes, no install. Cost: 4 to 6 steps per apply against 1 click. Clipboard rich-HTML copy from a sandboxed `IFRAME` is unverified [R4 S46]. Mobile flow is poor. Fails the BRIEF section 13 definition of done ("in one click").

Sub-decision, project topology for option 1:

- 1a. One Apps Script project hosts the add-on and the web app. One deploy. Every user who installs the add-on consents to every scope in the manifest, including server-only scopes (`spreadsheets`, `groups`, `admin.directory.user.readonly`) [R4 S41]. Pilot users must be editors of this project for test deployments [R4 S13], so they can read and change server code.
- 1b. Two Apps Script projects built from one repository. `addon` project: Card Service UI, 4 user scopes. `server` project: web app "execute as me", storage, permission layer, admin UI. Users never consent to server scopes because an "execute as me" web app is authorized by its owner only [A1]. Pilot editors (D13) are editors of `addon` only and never see storage. Cost: 2 script IDs per environment, 2 manifests, 2 deploy steps.

## Decision

Option 1 with topology 1b: add-on sidebar plus web app, as two Apps Script projects (`addon`, `server`). This deviates from BRIEF A2 ("one Apps Script project"). Open question Q2 asks the owner to accept it.

Mechanism:

- Sidebar (addon project). Compose trigger returns a home card: search `TextInput`, Favorites, Recent, folder list. Pages hold 20 templates (about 40 widgets with buttons), under the 100-widget cap [R4 S9]. Each item has an Insert button. A template without prompts applies in one click. A template with prompts pushes a prompt card (ADR-0004). Apply returns `UpdateDraftActionResponse` with `UpdateDraftBodyAction`, `IN_PLACE_INSERT`, `MUTABLE_HTML` [R4 S4, S5b]. Previews use `TextParagraph` with the 8 allowed tags, plain text excerpt of at most 600 characters.
- Every sidebar callback stays under 5 s by design (budget 3 s load, 2 s apply, ADR-0002), far below the 30 s cap. Long work (index rebuild, export) runs only in the web app (6 min cap).
- Data path. The add-on never reads storage. It calls the server web app `/exec` with `UrlFetchApp` and the user's OAuth token. The server identifies the caller and checks permissions (ADR-0003).
- Editing (server project web app). `doGet` serves one HTML shell (HtmlService, `IFRAME` sandbox). The shell loads data async through `google.script.run` [R4 S48]. The editor library is bundled into the HTML file at build time, so the page loads no third-party CDN (BRIEF 11, network rule). Links use `target="_blank"` [R4 S46]. No more than 4 parallel `google.script.run` calls, below the 10-call cap and Firefox's 6 [R4 S49].
- "Edit in web app". Sidebar buttons "Edit" and "Open library" return `OpenLink` with `setOpenAs(OVERLAY)` and `setOnClose(RELOAD_ADD_ON)` [R4 S40]. The URL is the server `/exec` URL plus `?view=editor&id=<templateId>`. The callback first clears the add-on's per-user cache (ADR-0002), so the reload after close shows the saved change. `openLinkUrlPrefixes` lists `https://script.google.com/macros/s/`. Slice 4 checks whether script.google.com sends a COOP header. If it does, reload detection fails [R4 S40] and the sidebar shows a "Refresh" button as fallback.
- Multi-login. Apps Script does not support several signed-in Google accounts [R4 S50]. Add-on to server calls are unaffected, because they carry the add-on user's token. The OVERLAY web app opens under the browser's default account. Effects and mitigations: a non-Migway default account gets Google's access-denied page; a blank active user gets the app's "Cannot identify your account" page with the fix (separate Chrome profile or incognito). The web app header always shows "Signed in as <email>". The user quick start (slice 7) documents the workaround.
- Mobile. Same add-on on Gmail Android and iOS, best effort (BRIEF A7). Slice 4 spike tests insert on both. The web app editor targets desktop; on phones it is read-only usable, not a target.

## Consequences

- Easier: least-privilege consent for users (4 scopes, spec section 9). Pilot editors cannot touch storage or server code. Sidebar stays thin.
- Harder: two manifests, two deploys, two script IDs per environment (ADR-0005). The add-on needs the server URL in its Script Properties.
- Every apply costs one UrlFetch round trip to the server. Slice 2 measures it. If p95 apply exceeds 2 s, ADR-0002 fallback applies cached bodies in the add-on and sends the apply event later.
- Revisit when Google ships a rich text card widget for Gmail, or if the owner rejects Q2 (then 1a, with all server scopes shown to every user).

## Open questions

- Q2. Accept two Apps Script projects (deviation from BRIEF A2)? Recommendation: yes. Users consent to 4 scopes instead of 10, and pilot editors stay away from storage.
- Does script.google.com send COOP on `/exec` pages? Recommendation: test in slice 4; ship the Refresh button either way.

## Sources

- [R4 S1, S2, S4, S5, S5b, S9, S10, S11, S13, S31 to S34, S36, S38 to S41, S46, S48 to S50, S53, S54] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A1] https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script (README, sections "Authorization for Scopes" and "Access Token for Accessing Web Apps"), third party, read 2026-11-09. "Execute as Me": owner authorizes, client users run as owner.
