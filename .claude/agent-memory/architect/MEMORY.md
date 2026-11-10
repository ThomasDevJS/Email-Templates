# Architect memory (Migway Gmail templates)

Last run: 2026-11-10, D26 run (template recipients, ADR-0006, commit 2579b6b). Before: errata run 3 (6a/6b as built, owner handover). Repo is the source of truth; this file is a cache.

## Files I own
- docs/adr/0001 to 0005 (Accepted 2026-11-09; run 3 amendments Proposed). 0006 template recipients (Proposed 2026-11-10). Edits to accepted ADRs go in a dated "Amendment YYYY-MM-DD" section plus a bracket marker on the stale line; never rewrite history.
- docs/spec.md (sections 1-16; 4.5 export/import as built; 5.1 depth 5; 5.2 key max 254; 5.6 subject D24; 11 `draft`; 11.1 admin audit/log rules; 12.1 measured; 13.3 6a/6b done; 13.4 known limits; 13.5 slice 7 and v1.1 items; 5.7 recipients; 7.1 recipient texts; 13.6 slice 9; 14.1 spike S6; Q1-Q39; 16.1 restore, 16.2 damaged-file recovery, 16.3 owner handover)
- docs/wireframes/01-07 (02 preview and prompt cards; 06 as built: tabs, inline error format, restore dialog, Trash view)

## Owner decisions in force
- D15 one Apps Script project. Add-on runs as user, web app deployment runs as owner (USER_DEPLOYING, DOMAIN).
- D18 admins see private folders in the library; `sidebar.home` hides other users' private folders (spec 2).
- D21 template subject applied in v1, slice 5.
- D22 (2026-11-10) Gmail web is the only acceptance client; Android and iOS best effort, untested. Spike S4 closed on web.
- D23 open: assumption 3 s accepted for apply in v1 (Q22).
- D24 (orchestrator, confirmed smoke 5c dev-848206f): template subject set only when the draft subject is empty or whitespace; "Insert with subject" and switch override; "Insert body only" never.
- D26 (owner 2026-11-10, updated same day): templates hold To, Cc, Bcc; insert adds, never removes. Outside addresses ALLOWED by default; admins need a way to turn them off (Script Property RECIPIENTS_EXTERNAL allow|deny in v1, in-app switch v1.1, Q32).
- Near-zero maintenance: only recurring human task = deploy.

## Decisions
- 0001: topology 1a. Amendment 2026-11-10: D22.
- 0002 run 3: amendment export/import/backups as built (schemaVersion 1, 20 per page offset, library export skips private, import: shared folders only, no grants, title skip, 5 MB/200/100, Validate writes nothing; restore: shape check before lock, sides first index last, undo, purge refusal). Amendment owner handover: options A copy, B1 browser bundle, B2 server pull, C Drive transfer same project, D dedicated account, E shared drive. Rec: D first; else B2; run V1-V4 first, C replaces B2 if V1 and V3 pass. Interim runbook via admin-only "Handover" folder.
- 0002: Drive JSON only. index.json, favorites.json, usage.json, members.json, bodies/<id>.v<n>.json (with `subject`, missing = ""), audit/YYYY-MM.jsonl, backups 14. Amendment 2026-11-10: readers no lock, never set INDEX_REV; writes re-check in lock; `bd:<bodyFileId>` (<=90 KB); `ft:<bodyFileId>`, search.body max 25 Drive reads; FAVORITES_REV, USAGE_REV side caches.
- 0003 run 3: amendment denied rows (also after policy check, max 1 per call), BUFFER_MAX 200 + `audit.dropped`, usage `days` 30, trigger create-then-delete, admin op log lines. Export writes no audit event (gap, 13.5).
- 0003: Pattern A (add-on UrlFetch to own /exec). Triggers tick 5 min, refreshMembers 15 min, daily. Trigger version check runs in doGet and tick, reads TRIGGERS_VERSION live in the lock (spec 16).
- 0004: grammar, sanitizer allowlist, ProseMirror atoms. Amendments 2026-11-10: (errata) no sanitize-on-paste; (S4) allowlist unchanged, cap 100 KB; (subject D21) same grammar, prompts shared, SUBJ_TOO_LONG 200, SUBJ_LINEBREAK; (D24 + S5, Accepted) set only on empty draft subject, `draftHasSubject`, `replacesSubject`; S5 one response, no new scope.
- 0006 (D26): fields `to`,`cc`,`bcc` arrays on item, version file, export meta; absent = []. 10/field, 20 total, 254 chars; trim+lowercase, dup in field dropped, dup across fields RCPT_DUPLICATE. Codes RCPT_FORMAT/TOO_LONG/TOO_MANY/DUPLICATE/EXTERNAL. No placeholders. deny: stored outside addresses kept, apply returns them in `blocked`, never inserted. Insert: skip present, To only when draft To empty, Cc/Bcc always. "Insert body only" = no subject, no recipients. Prompt switch `rcpt`. Any recipient -> no one-click, row "Review", card shows each address with markers. `rh` hash check at Insert. Apply returns lists every call, never cached. Logs: nothing new. Search: web app only. Private folders allowed. Import drops bad addresses, TOO_MANY refuses file.
- 0004 amendment D26: pointer to 0006.
- 0005 run 3: amendment owner change and dev to prod follow ADR-0002 owner handover.
- 0005: esbuild, vitest, one bundle. Amendment 2026-11-10: bundle ships as JSON string literal, `/` before `/` or `*` written as `\/`, `(0, eval)(literal)`; HtmlService cut `//` after template literals on 43f10de; sandbox frame sets no CSP.

## Scopes (10, unchanged)
gmail.addons.execute, gmail.addons.current.action.compose, gmail.addons.current.message.metadata, script.external_request, drive.file, script.projects.readonly, userinfo.email, groups, admin.directory.user.readonly, script.scriptapp. Subject needs none extra (S5 verified). Any new scope needs owner approval.

## Facts I verified
- A1 tanaike token note; A9 DriveApp needs drive; A10 consent texts; A11 versions API has no delete; A12 per-deployment web app settings.
- A13 event-objects page (re-read 2026-11-10): documents 6 fields, no subject, no draftMetadata. LIVE compose event (owner smoke 5b/5c) has draftMetadata, to/cc/bccRecipients, subject; never threadId/messageId. Page is incomplete; trust smoke runs.
- A14 extending-compose-ui: subject example `setUpdateDraftSubjectAction(newUpdateDraftSubjectAction().addUpdateSubject(s))`; one action per example; scopes not listed; no mobile note.
- A15 UpdateDraftActionResponseBuilder: setters body, subject, To, Cc, Bcc, chainable; combining not documented.
- A17 Drive scopes page: drive.file = files created/opened by app or picked in Picker; per-user binding NOT stated. A18 third party: other users of same app do not see app files; Picker folder gives no child access (unverified).
- A19 admin Drive transfer: org only, active recipient, transfer folder, trash not moved, IDs not stated. A20 user transfer: folder transfer leaves files with old owner.
- A21 web guide: Execute as me = owner of the script; cross-domain move breaks; shared drive runs as deployer. A22 collaborating: installable triggers not shared. A23 getProjectTriggers current user only. A24 Drive Manage versions: upload new version; ID kept not stated.
- A16 gmail scopes page: action.compose non-sensitive, "Manage drafts and send emails when you interact with the Google Workspace add-on".

- A25-A27 recipient action pages (2026-11-10): `addUpdate{To,Cc,Bcc}Recipients(String[])`, "insert to the email draft"; add vs replace, scope, limits, combining NOT stated. A14 compose guide Cc/Bcc examples wrongly call addUpdateToRecipients. A28 add-ons-response-service builder has setSendStatus (never use).

## Measured (spec 12.1)
- 9bbd262: first sidebar open 4.064 s add-on; apply first use 4.07 s; save about 10 s observed.
- 637ce77 (after 4b): add-on no server call 1.1-2.7 s; apply one server call 2.2-5.2 s, handler 0.2-0.6 s.
- 32a446c: warm save 4.2-5.2 s, Drive writes 2.0-2.7 s.

## Slice plan
- Slices 1-7 done. 8a (shell, library, trash, history) running; then 9 (recipients, S6 first), then 8b (editor redesign moves recipient fields into Details panel). v1.1: restoreBackup editor fn (Q31), B2 pull + READ_ONLY (Q27), minors of 13.5.

## Open questions
- Closed: Q20 (S5), Q21 (D24), Q24 (slice 5).
- Q32-Q39 (D26): admin switch v1.1, limits, no placeholders, To in reply not added, secondary domains (RECIPIENT_DOMAINS if needed), private allowed, no existence check, address search web only.
- Q22 = D23 open, assumption 3 s apply. Q23 built 6a. Q25 rec accept.
- Q26 dedicated owner account; Q27 B2 timing (v1.1); Q28 run V1-V4 on dev with pilot account; Q29 all versions under 20,000; Q30 dev to prod via interim runbook; Q31 restoreBackup editor fn.

## Conventions
- External sources [A1]..[A28]. Question IDs global Q1-Q39. Spikes S2, S2b, S4, S5 closed; S6 open (slice 9 first task).
- Request ID format `XXXXXXXX-XXXXXX`, server enforced. Log fields `calls`, `timing` (spec 11).

## Pitfalls
- One manifest = every scope on every user's consent screen at self-install.
- Script editors can read Script Cache and Properties.
- In execute-as-me web app, getUserCache is the owner's: never server-side.
- drive.file files created by hand are invisible to the app.
- Owner's 30 simultaneous executions cap all server work.
- Do not invent mechanism details: read the source (e.g. scripts/lib/html.mjs) before writing an amendment.
- Google reference pages can be incomplete (A13 missed `subject`): the owner's smoke log is the evidence for live event fields.
- setup() refuses any account but recorded OWNER_EMAIL; triggers belong to their creator. Any owner change touches both.
- Damaged live index.json blocks every op incl. backup.restore (dispatch loads index first).
