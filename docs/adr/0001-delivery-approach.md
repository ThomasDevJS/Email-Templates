# ADR-0001: Delivery approach

Status: Accepted 2026-11-09 (orchestrator, by owner delegation; was Proposed) (revised 2026-11-09 after D15: one project)
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

- 1a. One Apps Script project hosts the add-on and the web app. One manifest, one scope list, one deploy [R4 S41]. Two identities inside it: add-on callbacks run as the user [R4 S11]; a web app deployment of the same project runs as its owner (`USER_DEPLOYING`, access `DOMAIN`) [R4 S11, S12]. Every self-installing user consents to every scope, including server-only scopes (`groups`, `admin.directory.user.readonly`). Pilot users are editors of the whole project [R4 S13].
- 1b. Two projects built from one repository: `addon` (Card Service, 4 user scopes) and `server` (web app, storage, admin UI). Users never consent to server scopes [A1]. Cost: 2 manifests, 2 script IDs per environment, 2 deploys, 2 sets of triggers and properties. Rejected by the owner on 2026-11-09 (PLAN D15): BRIEF A2 asks for one project, and the near-zero maintenance goal (BRIEF 1 Operations) favours one manifest and one deploy over the smaller consent list.

## Decision

Option 1 with topology 1a: add-on sidebar plus web app in one Apps Script project. The add-on calls its own project's `/exec`.

Mechanism:

- One project, two entry points. The manifest declares `addOns.gmail.composeTrigger` and `webapp { executeAs: USER_DEPLOYING, access: DOMAIN }`. One versioned deployment per environment serves both entry points (ADR-0005).
- Sidebar (add-on code, runs as the user). [Side panel (homepage trigger) inserts through compose actions: see Amendment 2026-11-10 (D27).] Compose trigger returns a home card: search `TextInput`, Favorites, Recent, folder list. Pages hold 20 templates (about 40 widgets with buttons), under the 100-widget cap [R4 S9]. Each item has an Insert button. A template without prompts applies in one click. A template with prompts pushes a prompt card (ADR-0004). Apply returns `UpdateDraftActionResponse` with `UpdateDraftBodyAction`, `IN_PLACE_INSERT`, `MUTABLE_HTML` [R4 S4, S5b]. Previews use `TextParagraph` with the 8 allowed tags, plain text excerpt of at most 600 characters.
- Every sidebar callback stays under 5 s by design (budget 3 s load, 2 s apply, ADR-0002), far below the 30 s cap. Long work (cache rebuild, export, housekeeping) runs only in web app calls or triggers (6 min cap).
- Data path. Add-on code never reads storage, Script Cache or Script Properties (ADR-0003 Part A). It calls the same project's `/exec` URL with `UrlFetchApp` and the user's OAuth token. The `/exec` URL is a build-time constant per environment (ADR-0005). The web app code identifies the caller and checks permissions (ADR-0003).
- Editing (web app, runs as the owner). `doGet` serves one HTML shell (HtmlService, `IFRAME` sandbox). The shell loads data async through `google.script.run` [R4 S48]. The editor library is bundled into the HTML file at build time, so the page loads no third-party CDN (BRIEF 11). Links use `target="_blank"` [R4 S46]. No more than 4 parallel `google.script.run` calls, below the 10-call cap and Firefox's 6 [R4 S49].
- "Edit in web app". Sidebar buttons "Edit" and "Open library" return `OpenLink` with `setOpenAs(OVERLAY)` and `setOnClose(RELOAD_ADD_ON)` [R4 S40]. The URL is `/exec?view=editor&id=<templateId>`. The callback first clears the add-on's User Cache (ADR-0002), so the reload after close shows the saved change. `openLinkUrlPrefixes` lists `https://script.google.com/macros/s/`. Slice 4 checks whether script.google.com sends a COOP header. If it does, reload detection fails [R4 S40] and the sidebar shows a "Refresh" button as fallback.
- Multi-login. Apps Script does not support several signed-in Google accounts [R4 S50]. Add-on to `/exec` calls carry the add-on user's token and are unaffected. The OVERLAY web app opens under the browser's default account. A non-Migway default account gets Google's access-denied page; a blank active user gets the app's "Cannot identify your account" page with the fix (separate Chrome profile or incognito). The web app header always shows "Signed in as <email>". The quick start (slice 7) documents the workaround.
- Mobile. Same add-on on Gmail Android and iOS, best effort (BRIEF A7). Slice 4 spike tests insert on both. [Spike runs on Android and iOS dropped, D22: see Amendment 2026-11-10.] The web app editor targets desktop.

Consent consequence. One manifest gives one scope list (spec section 9, 10 scopes by default). Every user who self-installs the add-on (owner, pilot editors in 2.5a) sees all 10 on the consent screen, including the server-only scopes. After the admin domain install (2.5b), users skip the consent screen [R4 S60]. ADR-0002 removes `spreadsheets` from the list for this reason.

Pilot editors. Test deployments need editor access to the project [R4 S13], so the 2 to 3 pilot editors (D13) can read and change all code in the browser editor and run functions that read the Script Cache. Mitigations:

- Pilot editors are editors of the dev project only. The prod project has the owner (and one backup admin, Q3) as its only editors.
- Code enters only through `clasp push` from the owner's machine (BRIEF A5). The deploy script compares the remote HEAD with the last pushed build before pushing and aborts on drift, so a browser edit is detected and overwritten (ADR-0005).
- Deployments are created and updated by the owner only (runbook rule, slice 7).
- Dev holds pilot data only. Pilot editors are removed from the dev project after 2.5b, when the private Marketplace app replaces the test deployment.

## Amendment 2026-11-10: acceptance client (D22)

Owner decision D22 (2026-11-10): Gmail web on Chrome is the only acceptance client for v1. Spike S4 closed on the Gmail web results (ADR-0004 amendment). The add-on still runs on Gmail Android and iOS; that use is best effort and untested (BRIEF A7). No open item waits on a mobile run.

## Amendment 2026-11-10: side-panel insert (D27)

Status: Proposed. Owner decision D27 (2026-11-10): the Gmail side panel must insert templates like the compose toolbar. Gmail ignores `UpdateDraftActionResponse` from the side panel (owner's spike S6 runs). Mechanism in ADR-0007: the side panel creates a new draft (`STANDALONE_DRAFT`) or a reply (`REPLY_AS_DRAFT`) with compose actions and `ComposeActionResponse`; a new `unconditional` contextual trigger gives the panel the open message ID; no new scope, checked by spike S7 (spec 14.2). The add-on now has three entry functions: `onComposeOpen`, `onHomepage`, `onMessageOpen`.

## Consequences

- Easier: one manifest, one deploy, one deployment ID per environment, one set of triggers and properties (ADR-0005). No server URL property: the add-on calls its own deployment.
- Harder: every self-installing user consents to 10 scopes, 2 of them server-only (`groups`, `admin.directory.user.readonly`). Pilot editors can read code and Script Cache in the dev project. The trust boundary between the add-on path and the server path is the code, which only the owner pushes (ADR-0003 Part A).
- Every apply costs one UrlFetch round trip to `/exec`. Slice 2 measures it. If p95 apply exceeds 2 s, the ADR-0002 fallback applies cached bodies in the add-on and sends the apply event later.
- Revisit when Google ships a rich text card widget for Gmail.

## Open questions

- Q2. Decided 2026-11-09 by the owner: one project (D15).
- Does script.google.com send COOP on `/exec` pages? Recommendation: test in slice 4; ship the Refresh button either way.

## Sources

- [R4 S1, S2, S4, S5, S5b, S9, S10, S11, S12, S13, S31 to S34, S36, S38 to S41, S46, S48 to S50, S53, S54, S60] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A1] https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script (README, sections "Authorization for Scopes" and "Access Token for Accessing Web Apps"), third party, read 2026-11-09. "Execute as Me": owner authorizes, client users run as owner.
