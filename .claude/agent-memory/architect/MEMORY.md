# Architect memory (Migway Gmail templates)

Last run: 2026-11-10, errata run plus D21 (subject) and D22 (web only). Repo is the source of truth; this file is a cache.

## Files I own
- docs/adr/0001 to 0005 (Accepted 2026-11-09). Edits to accepted ADRs go in a dated "Amendment YYYY-MM-DD" section plus a bracket marker on the stale line; never rewrite history.
- docs/spec.md (sections 1-16; 5.6 subject; 12.1 measured times; 13.1 slice 5 contents; Q1-Q24 in section 15)
- docs/wireframes/01-07 (02 now holds preview card and prompt card)

## Owner decisions in force
- D15 one Apps Script project. Add-on runs as user, web app deployment runs as owner (USER_DEPLOYING, DOMAIN).
- D18 admins see private folders in the library; `sidebar.home` hides other users' private folders (spec 2).
- D21 template subject applied in v1, slice 5.
- D22 (2026-11-10) Gmail web is the only acceptance client; Android and iOS best effort, untested. Spike S4 closed on web.
- Near-zero maintenance: only recurring human task = deploy.

## Decisions
- 0001: topology 1a. Amendment 2026-11-10: D22.
- 0002: Drive JSON only. index.json, favorites.json, usage.json, members.json, bodies/<id>.v<n>.json (now with `subject`, missing = ""), audit/YYYY-MM.jsonl, backups 14. NOT yet amended: lock-free reader rule from 4b (readers take no lock, never set INDEX_REV; setup publishes it). Candidate for next errata run.
- 0003: Pattern A (add-on UrlFetch to own /exec). Triggers tick 5 min, refreshMembers 15 min, daily. Trigger version check runs in doGet and tick, reads TRIGGERS_VERSION live in the lock (spec 16).
- 0004: grammar, sanitizer allowlist, ProseMirror atoms. Amendments 2026-11-10: (errata) no sanitize-on-paste, schema normalizes; setRequiredWidgets untried. (S4) web F1-F9 inserted, F7 204,837 bytes; allowlist unchanged; cap 100 KB final; harness removal slice 5; F9 mid-line hand check open. (subject, Proposed) option 3: replace on Insert, opt-out "Insert body only" on preview card and "Replace the subject" switch on prompt card; same grammar, prompts shared; not HTML-escaped, control chars -> space; SUBJ_TOO_LONG (200), SUBJ_LINEBREAK; search weight 2.
- 0005: esbuild, vitest, one bundle. Amendment 2026-11-10: bundle ships as JSON string literal, `/` before `/` or `*` written as `\/`, `(0, eval)(literal)`; HtmlService cut `//` after template literals on 43f10de; sandbox frame sets no CSP.

## Scopes (10, unchanged)
gmail.addons.execute, gmail.addons.current.action.compose, gmail.addons.current.message.metadata, script.external_request, drive.file, script.projects.readonly, userinfo.email, groups, admin.directory.user.readonly, script.scriptapp. Subject expected to need none extra (unverified, Q20). Any new scope needs owner approval.

## Facts I verified
- A1 tanaike token note; A9 DriveApp needs drive; A10 consent texts; A11 versions API has no delete; A12 per-deployment web app settings.
- A13 (2026-11-10) event-objects: Gmail event has accessToken, messageId, threadId, to/cc/bccRecipients; NO subject. commonEventObject.platform WEB/IOS/ANDROID.
- A14 extending-compose-ui: subject example `setUpdateDraftSubjectAction(newUpdateDraftSubjectAction().addUpdateSubject(s))`; one action per example; scopes not listed; no mobile note.
- A15 UpdateDraftActionResponseBuilder: setters body, subject, To, Cc, Bcc, chainable; combining not documented.
- A16 gmail scopes page: action.compose non-sensitive, "Manage drafts and send emails when you interact with the Google Workspace add-on".

## Measured (spec 12.1, dev 9bbd262, before 4b cuts)
First sidebar open 4.064 s add-on (6 s on screen); apply first use 4.07 s add-on, handler 1314 ms; prompt Insert 2.1-2.3 s; doPost 0.6-1.1 s outside handler; save about 10 s observed. All targets missed. 4b numbers pending (smoke 4b step 8).

## Slice plan
- Slice 5 (spec 13.1): spike S5 first (body+subject one response, reply fields), subject, sidebar search, favorites, recent, web search incl. search.body, S4 harness removal, Q24 one-liner.
- Slice 6: Trash view and template.restoreFromTrash (with admin, folder delete, trash.purge), Q23 trigger create-then-delete.

## Open questions added this run
- Q20 subject+body in one response, per-action scope. Rec: spike S5; fallback second button "Set subject".
- Q21 reply drafts (subject change may split thread; threadId presence undocumented). Rec: S5 logs presence boolean.
- Q22 targets missed. Rec: wait for 4b numbers, owner decides on ADR-0003.
- Q23 installTriggers delete-before-create. Rec: create first, slice 6.
- Q24 recipientEmailIfInternal on followUp. Rec: ignore it, slice 5.

## Conventions
- External sources [A1]..[A16]. Question IDs global Q1-Q24. Spikes S2, S2b, S4 (closed), S5 (slice 5).
- Request ID format `XXXXXXXX-XXXXXX`, server enforced. Log fields `calls`, `timing` (spec 11).

## Pitfalls
- One manifest = every scope on every user's consent screen at self-install.
- Script editors can read Script Cache and Properties.
- In execute-as-me web app, getUserCache is the owner's: never server-side.
- drive.file files created by hand are invisible to the app.
- Owner's 30 simultaneous executions cap all server work.
- Do not invent mechanism details: read the source (e.g. scripts/lib/html.mjs) before writing an amendment.
