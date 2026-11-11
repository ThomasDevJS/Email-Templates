# Architect memory (Migway Gmail templates)

Last run: 2026-11-11, D31 run (one-click insert, slice 15; ADR-0009, amendments 0004, 0006, note 0007) and D32 run (in-app admins, slice 16; amendments 0003, 0008). Orchestrator saved WIP commits mid-run (be9344d, 66553a9, 7695b89, 8152348); mine 8c3cd99, f6b0d5e + slice 16 handoff. Before: errata run 4, D29, D27, D26. Repo is the source of truth; this file is a cache.

## Files I own
- docs/adr/0001 to 0005 (Accepted 2026-11-09; run 3 amendments Proposed). 0006 template recipients (Accepted 2026-11-11, As built section). 0007 side-panel insert (Proposed; S7 not run; Built so far section). 0008 admin settings (Accepted 2026-11-11, As built section). 0002 and 0003 Amendment 2026-11-11 (errata run 4) Proposed. Edits to accepted ADRs go in a dated "Amendment YYYY-MM-DD" section plus a bracket marker on the stale line; never rewrite history.
- docs/spec.md (sections 1-16; 4.5 export/import as built; 5.1 depth 5; 5.2 key max 254; 5.6 subject D24; 11 `draft`; 11.1 admin audit/log rules; 12.1 measured; 13.3 6a/6b done; 13.4 known limits; 13.5 slice 7 and v1.1 items; 5.7 recipients; 7.1 recipient texts; 13.6 slice 9; 14.1 spike S6; 4.1a panel flow; 7.2 panel texts; 13.7 Gmail panel pass; 14.2 spike S7; 5.8 settings + enforcement table; 7.3 settings texts; 13.8 slice 11; Q1-Q52; 16.1 restore, 16.2 damaged-file recovery, 16.3 owner handover)
- docs/wireframes/01-07 (01 slice 12 cards + panel interim; 02 recipient lines; 04 editor 8b direction A; 06 as built; 07 states slice 12). 03 and 05 keep old layout; 03 points to docs/design/screens/8a.

## Owner decisions in force
- D15 one Apps Script project. Add-on runs as user, web app deployment runs as owner (USER_DEPLOYING, DOMAIN).
- D18 admins see private folders in the library; `sidebar.home` hides other users' private folders (spec 2).
- D21 template subject applied in v1, slice 5.
- D22 (2026-11-10) Gmail web is the only acceptance client; Android and iOS best effort, untested. Spike S4 closed on web.
- D23 open: assumption 3 s accepted for apply in v1 (Q22).
- D24 (orchestrator, confirmed smoke 5c dev-848206f): template subject set only when the draft subject is empty or whitespace; "Insert with subject" and switch override; "Insert body only" never.
- D26 (owner 2026-11-10, updated same day): templates hold To, Cc, Bcc; insert adds, never removes. Outside addresses ALLOWED by default; switch now in-app (D29), Q32 closed.
- D29 (owner 2026-11-10): admin setting for personal templates, default OFF; in-app settings in v1 for both switches.
- D27 (owner 2026-11-10): side panel must insert like the compose dialog; both entry points must work.
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
- 0001 amendment 2026-11-10 (D27, Proposed): pointer to 0007; entry fns onComposeOpen, onHomepage, onMessageOpen.
- 0007 (D27): side panel cannot change an open draft (UpdateDraftActionResponse ignored there). Uses compose actions: `setComposeAction` STANDALONE_DRAFT -> `GmailApp.createDraft(to, subject, "", {htmlBody, cc, bcc})`; REPLY_AS_DRAFT -> `getMessageById(gmail.messageId).createDraftReply/ReplyAll("", {htmlBody, cc, bcc})`; `setCurrentMessageAccessToken(gmail.accessToken)`; `ComposeActionResponseBuilder.setGmailDraft`. New manifest entry contextualTriggers unconditional `onMessageOpen` (homepage events carry no messageId). Row button: inbox "New email", message "Reply"; preview adds "Reply all", "New email"; "Review"/prompt rules as compose. Footer hint to compose toolbar. One pipeline, `entryOf(event)` compose|message|inbox in event.ts; `rowButton`, `insertButtons` only readers. D24: new draft gets template subject; reply never gets subject option; no "with subject"/"body only" in panel. D26: recipientActions on computed draft (new empty; reply To=sender; reply all To+Cc of message). Log `draft.via` compose|new|reply|replyAll. Signature not added, card says so (reading needs restricted gmail.settings.basic). Clipboard rejected (no Card Service class). Prompt blank field: notification; fallback Check + confirm card.
- 0008 (D29): settings in index.json `settings` { name: {value, updatedAt, updatedBy} }, absent = default (personalTemplates off, recipientsExternal allow). Rejected: Script Properties (snapshot stale in lock recheck, change+audit two writes, editor bypass), side file. Op `config.set {name, value, baseAt, baseBy}` (slice 13; was `from`) admin web; base != stored last change -> CONFLICT; same value -> changed:false no audit. Audit targetType config, targetId name, before/after {name,value}; log targetId "", no value. setup writes none; backup.restore keeps live settings; RECIPIENTS_EXTERNAL property retired (slice 11). Off = one rule in levelResolver before admin rule: private tree -> `use` for owner and admins, none others; folder.list skips ensurePrivateFolder. DENIED text "Personal templates are turned off by your admin." Config tab Settings: radio + Save + confirm on take-away + last change. Amendments 2026-11-10 (D29) in 0002, 0003, 0006.
- 0005 run 3: amendment owner change and dev to prod follow ADR-0002 owner handover.
- 0005: esbuild, vitest, one bundle. Amendment 2026-11-10: bundle ships as JSON string literal, `/` before `/` or `*` written as `\/`, `(0, eval)(literal)`; HtmlService cut `//` after template literals on 43f10de; sandbox frame sets no CSP.

## Errata run 4 facts (as built 6374b7b)
- Recipients: actions REPLACE a field (S6); build sends draft list + new. `draftRecipients` null = unknown field: no action, unknown To = filled, card "Add by hand". `rh` = template lists + blocked only (Q54). Finish-typing line on both cards. Prompt switch label "Adds n recipients." `recheckRecipients` in lock (create, dup, update, version restore, import; import refuses whole file, Q53). `template.update` keeps omitted lists. `recipientsUnreadable` on version.restore.
- Settings: `config.set {name, value, baseAt, baseBy}`; `from` -> "This page is out of date..."; name echo 40; `settingsOf` fills defaults (not readIndexDoc); restore event `liveSettingsKept: true`. While off: grant.* DENIED for admins, admin.folders drops private folders.
- Export: start call commits one event via `commit`, token `exp:<token>` 600 s sliding, pages need it, misses not cached. Audit words "Library export started, n templates".
- Buffer: evicted slot first, apply takes denied slot, `evt:lost`. Log targetId falls back to dispatch-resolved folder (grant.remove). `prof:<sha256>`.
- Add-on slice 12: no headers on home/state cards, one-line labels " · ", hint "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar.", Favorites hidden when empty.

## D31 (owner 2026-11-11): one-click insert, slice 15 (spec 7.4, 13.9, ADR-0009)
- Every compose row "Insert" one click. Unfilled field REMOVED (owner decision, no marker): value order typed > value > fallback > "", then 4 gap rules (U+0020 only, per text run and subject): space both sides drop after; space before + `,.;:!?` drop before; run start drop space after; run end drop space before. Left alone: across inline tags, nbsp, empty blocks (smoke 13). 8 test pairs in ADR-0004 Amendment 2026-11-11.
- Platform: UpdateDraftActionResponse has no notification [A15]; ActionResponse has no draft action [A44]; card closes after insert (S6 step 0, undocumented). FixedFooter primary must be FILLED [A40]; manifest secondaryColor default blue #2196F3 [A42]; DecoratedText one button or switch or end icon + onClick [A43]. A40-A44 in ADR-0009.
- Row button carries `rc` "t,c,b"; mismatch with apply lists -> details card + change line. Unknown draft field with template address -> details card. Row hint counts first in label (hint, fields, path).
- Details card = preview + prompt merged; opens via template.apply followUp:true (no event); Insert apply without followUp; `counted=1` on re-rendered card. Switches subj/rcpt replace "Insert with subject"/"Insert body only". Footer Insert + Edit in library.
- Home: Favorites, Recent minus Favorites, Folders; no search hint; footer FILLED slate + manifest secondaryColor slate.
- Q56-Q61 (counts on row, Bcc/outside one click, footer, no hint, label order, details open no usage).

## D32 (owner 2026-11-11): in-app admins, slice 16 (spec 5.8, 6, 7.3, 11.1, 13.10)
- index.json `admins: [{email, addedAt, addedBy}]` (own field, not settings map), cap 20. Admin = ADMIN_EMAILS or ADMIN_GROUP or list. Ops admin.add/admin.remove {email}, admin web, deltas via commit, no base. Directory users.get domain_public existence check, store primaryEmail. No self-removal. No op writes Script Properties. restore keeps live admins. Audit targetType admin. Q62-Q66.
- File split: 15 owns src/addon, shared/placeholders, appsscript.json, user-quick-start, editor-guide, editor.ts help string; 16 owns server, shared/permissions|model|errors, rest of web, admin guide, runbook.

## Scopes (10, unchanged)
gmail.addons.execute, gmail.addons.current.action.compose, gmail.addons.current.message.metadata, script.external_request, drive.file, script.projects.readonly, userinfo.email, groups, admin.directory.user.readonly, script.scriptapp. Subject needs none extra (S5 verified). Any new scope needs owner approval.

## Facts I verified
- A29-A39 (2026-11-10, ADR-0007): compose guide, ComposeActionResponseBuilder, ComposedEmailType (REPLY_AS_DRAFT default, STANDALONE_DRAFT), GmailApp/GmailMessage ref pages list only mail.google.com (contradicts add-on guides; S7), workspace-scopes (action.compose creates drafts and replies; getMessageById+getFrom need only message.metadata), message UI guide, homepages (no contextual info in homepage events), manifest (contextual trigger names no scope), sendAs.get scopes (restricted), Card Service class list (no clipboard). createDraftReply options include subject (250).
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
- Slices 1-13 done, on dev (f88ab0b). 14 wording pass in build: re-check spec 7-7.3 and wireframe 07 after it. 15 one-click (after 14), 16 admins (parallel). Next free slice 17. Gmail panel compose actions wait for S7 (spec 13.7). v1.1: restoreBackup editor fn (Q31), B2 pull + READ_ONLY (Q27), minors of 13.5.

## Open questions
- Closed: Q20 (S5), Q21 (D24), Q24 (slice 5).
- Q40-Q46 (D27): contextual trigger yes if no prompt, no signature, row Reply, discarded draft counts, mail.google.com never (hint only), reply-all merged cc, no forward.
- Q47-Q52 (D29): dev reads off after deploy (accept), off caps owner+admin to use (accept, turn on to clean up), no third setting, no RECIPIENTS_EXTERNAL fallback, read+insert not hide, quick start disclosure.
- Q53 import refused on in-lock deny race (accept); Q54 rh without draft field state (accept); Q55 S6 step 7 fresh consent (owner runs by hand before prod).
- Q32 closed by D29. Q33-Q39 (D26): limits, no placeholders, To in reply not added, secondary domains (RECIPIENT_DOMAINS if needed), private allowed, no existence check, address search web only.
- Q22 = D23 open, assumption 3 s apply. Q23 built 6a. Q25 rec accept.
- Q26 dedicated owner account; Q27 B2 timing (v1.1); Q28 run V1-V4 on dev with pilot account; Q29 all versions under 20,000; Q30 dev to prod via interim runbook; Q31 restoreBackup editor fn.

## Conventions
- External sources [A1]..[A44]. Question IDs global Q1-Q66. Slice numbers: next free 17. ADR next free 0010. Spikes S2, S2b, S4, S5, S6 closed (S6 step 7 open, Q55); S7 open (panel pass first task, harness in dev build).
- Request ID format `XXXXXXXX-XXXXXX`, server enforced. Log fields `calls`, `timing` (spec 11).

## Pitfalls
- One manifest = every scope on every user's consent screen at self-install.
- Script editors can read Script Cache and Properties.
- In execute-as-me web app, getUserCache is the owner's: never server-side.
- drive.file files created by hand are invisible to the app.
- Owner's 30 simultaneous executions cap all server work.
- Do not invent mechanism details: read the source (e.g. scripts/lib/html.mjs) before writing an amendment. Handoffs can be wrong (slice 12 said QUOTA "30 seconds"; code counts down 60 s).
- Google reference pages can be incomplete (A13 missed `subject`): the owner's smoke log is the evidence for live event fields.
- setup() refuses any account but recorded OWNER_EMAIL; triggers belong to their creator. Any owner change touches both.
- Side panel = homepage trigger: no draftMetadata, draft responses silently ignored. Ask owners which entry point they used.
- Damaged live index.json blocks every op incl. backup.restore (dispatch loads index first).
- Levels: only `levelResolver(subject, index)` (effective.ts), called in context.ts, dispatch recheck (every commit), folders.ts folder.list. Index-held state reaches every check for free.
