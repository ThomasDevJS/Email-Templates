# Architect memory (Migway Gmail templates)

Last run: 2026-11-12, D39 choice field proposal on branch architect/choice-field (from 3ce78a0; ADR-0004 Amendment "choice fields", spec 5.10, Q91-Q97). Before: D38 date field spec, merged 51b2a94, slice 25 builds it (branch architect/date-field from 80e4b77; ADR-0004 Amendment "date fields", spec 5.9, Q85-Q90). Before: errata run 6 on branch architect/errata-6 (slices 20a, 20b, 21, 22, 22b as built at 8e82a07, slice 23 in review; commits 1458d3d spec, 2d93595 ADRs, 2ca59cc wireframes, plus handoff and memory; not pushed). Before: errata run 5 (16df87a), S7 run, D31, D32, errata run 4. Repo is the source of truth; this file is a cache.

## Files I own
- docs/adr/0001 to 0005 (Accepted 2026-11-09; run 3 amendments Proposed; 0001 D27 and 0004 D26/D31 amendments Accepted 2026-11-11). 0009 Accepted 2026-11-11 (As built section). 0003/0008 D32 Accepted (0003 "As built (slice 16)"). 0006 D31 Accepted except Q77 point. 0007 Amendment 2026-11-11 (D33, failure sentences) Accepted. 0002 Amendment 2026-11-11, slice 19 Proposed. 0006 template recipients (Accepted 2026-11-11, As built section). 0007 side-panel insert (Accepted 2026-11-11, section "Acceptance 2026-11-11" A1-A10; [S7] markers on old lines). 0008 admin settings (Accepted 2026-11-11, As built section). 0002 and 0003 Amendment 2026-11-11 (errata run 4) Proposed. Edits to accepted ADRs go in a dated "Amendment YYYY-MM-DD" section plus a bracket marker on the stale line; never rewrite history.
- docs/spec.md (sections 1-16; 4.5 export/import as built; 5.1 depth 5; 5.2 key max 254; 5.6 subject D24; 11 `draft`; 11.1 admin audit/log rules; 12.1 measured; 13.3 6a/6b done; 13.4 known limits; 13.5 slice 7 and v1.1 items; 5.7 recipients; 7.1 recipient texts; 13.6 slice 9; 14.1 spike S6; 4.1a panel flow; 7.2 panel texts; 13.7 Gmail panel pass; 14.2 spike S7; 5.8 settings + enforcement table; 7.3 settings texts; 13.8 slice 11; Q1-Q52; 16.1 restore, 16.2 damaged-file recovery, 16.3 owner handover)
- docs/wireframes/01-07 (01 slice 12 cards + panel interim; 02 recipient lines; 04 editor 8b direction A; 06 as built; 07 states slice 12). 03 and 05 keep old layout; 03 points to docs/design/screens/8a.

## Owner decisions in force
- D31 one-click (removal), D32 in-app admins, D33 Reply + Reply all on panel rows (ButtonSet under title): built, Accepted 2026-11-11.
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
- 0007 (D27), Accepted after S7 (dev-56bf795, docs/spikes/slice-10-s7.md): createDraft, getMessageById, createDraftReply(All) ran on the 10 scopes with setCurrentMessageAccessToken; reply-all `options.cc` ADDS; signature in replies only; compose-action callback may return a notification; open window untouched. Slice 18: rows inbox "New email" (STANDALONE_DRAFT) / message "Reply" (REPLY_AS_DRAFT), callback `onCompose` {id, as, rc}; details card via apply followUp for all entries (getBody gone), compose inputs + "Add recipients", NO subject switch (new = template subject, reply never), no finish-typing line, signature line; footer message: Reply + Reply all, ButtonSet New email + Edit in library; inbox: New email + Edit; `onPromptCompose` {id, as, version, values, rh}, no counted. First name: Reply only (reply-to else From, internal only, as recipientEmailIfInternal); New email and Reply all "". Computed draft for present check (reply address, + getTo/getCc for reply all). Errors = notifications only (no navigation from compose action). rc mismatch -> notification. No `via` (no server change). Hint: "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar." No first line. Harness removed in 18.
- 0008 (D29): settings in index.json `settings` { name: {value, updatedAt, updatedBy} }, absent = default (personalTemplates off, recipientsExternal allow). Rejected: Script Properties (snapshot stale in lock recheck, change+audit two writes, editor bypass), side file. Op `config.set {name, value, baseAt, baseBy}` (slice 13; was `from`) admin web; base != stored last change -> CONFLICT; same value -> changed:false no audit. Audit targetType config, targetId name, before/after {name,value}; log targetId "", no value. setup writes none; backup.restore keeps live settings; RECIPIENTS_EXTERNAL property retired (slice 11). Off = one rule in levelResolver before admin rule: private tree -> `use` for owner and admins, none others; folder.list skips ensurePrivateFolder. DENIED text "Personal templates are turned off by your admin." Config tab Settings: radio + Save + confirm on take-away + last change. Amendments 2026-11-10 (D29) in 0002, 0003, 0006.
- 0005 run 3: amendment owner change and dev to prod follow ADR-0002 owner handover.
- 0005: esbuild, vitest, one bundle. Amendment 2026-11-10: bundle ships as JSON string literal, `/` before `/` or `*` written as `\/`, `(0, eval)(literal)`; HtmlService cut `//` after template literals on 43f10de; sandbox frame sets no CSP.

## Errata run 4 facts (as built 6374b7b)
- Recipients: actions REPLACE a field (S6); build sends draft list + new. `draftRecipients` null = unknown field: no action, unknown To = filled, card "Add by hand". `rh` = template lists + blocked only (Q54). Finish-typing line on both cards. Prompt switch label "Adds n recipients." `recheckRecipients` in lock (create, dup, update, version restore, import; import refuses whole file, Q53). `template.update` keeps omitted lists. `recipientsUnreadable` on version.restore.
- Settings: `config.set {name, value, baseAt, baseBy}`; `from` -> "This page is out of date..."; name echo 40; `settingsOf` fills defaults (not readIndexDoc); restore event `liveSettingsKept: true`. While off: grant.* DENIED for admins, admin.folders drops private folders.
- Export: start call commits one event via `commit`, token `exp:<token>` 600 s sliding, pages need it, misses not cached. Audit words "Library export started, n templates".
- Buffer: evicted slot first, apply takes denied slot, `evt:lost`. Log targetId falls back to dispatch-resolved folder (grant.remove). `prof:<sha256>`.
- Add-on slice 12: no headers on home/state cards, one-line labels " · ", hint "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar.", Favorites hidden when empty.

## Errata run 5 facts (as built 16df87a)
- Glossary of record: docs/design/wording.md. Tabs: Folders and access, Groups, Audit log, Usage, Export and import, Settings and backups. "Refresh groups". Jobs shown as "Save insert counts and refused actions", "Refresh groups", "Nightly backup and cleanup".
- Web NOT_CONFIGURED = toast "Something went wrong. Try again." (server text never shown; fix round). Admins explanation still says "grants".
- Slice 15: details Insert params id, version, values, rh, counted (no title); row-pushed card counted=1; `replacesSubject(draftHasSubject)`; first-name box on every details card when template has it without default text (`cardFields`); "(!) " prefix; one `rendered()` for all paths.
- Slice 16: `ADMIN_DENIED_TEXT` "You are no longer an admin, so nothing was changed. Ask an admin if you need access." on 8 admin-only actions; Directory error INTERNAL reason `ADMIN_CHECK`; `lockedSubject` in `recheck` for every write; results carry `email`; `indexProblem` accepts any `admins` value.
- Slice 18 fu1: `panelAnswer` throws one sentence (notification from compose action not shown, part J step 11); no request ID. fu2 (D33): message rows = DecoratedText + ButtonSet [Reply][Reply all]; 100-widget limit at 69 folders (slice 20b). Q68, Q74 yes.
- Slice 19: Advanced `alt=media` throws on non-JSON text; `readRawText` (REST media) for month files, rolls, backup copies; doc reads retry raw once; `fileUrl` ID [A-Za-z0-9_-]; 429 QUOTA; `job:*:lastError` = "<time> <code> <error name>" (`errorSummary`, `JobError`).
- Gmail facts: card closes after Insert; Open/Edit in library open a new Chrome window (code OVERLAY); narrow draft puts add-on in "⋮"; panel reply has signature below text, new email none.
- 2.5b: admin-guide part 2 step 7 fails (deploy refuses version mode with empty deploymentId); Apps Script API user setting for DO unstated; logoUrl Drive-hosted.

## Errata run 6 facts (as built 8e82a07, owner tests on dev 2026-11-11)
- D34 look kept; D35 spinner on every action but onBack/onOpenLink (`toAction`), primaryColor+secondaryColor #2a3c49 (bar measured #2A3B48); D36 hint lines = DecoratedText info icon grey #5f6368 (fields line, signature line, toolbar hint, cut line); error lines = error icon alt "Error", red #b32025, no "(!)" (22b); FINISH_TYPING plain. ADR-0009 Amendment 2026-11-12 Accepted.
- Search: outlined "Search" button + box, both onSearch; compose popup one row (Columns, try/catch fallback), panel stacked. Double run possible (Q79).
- Caps 20b: LIST_MAX favorites 10, recent 5, folders 40, results 20; cut hint "Showing n of m <noun>. Use Search or Open library for the rest."; worst card 84.
- Panel: "A reply adds n recipients." (message entry); NOT_CONFIGURED sentence without "then press Retry". Gmail shows thrown sentence in its own error card (Q75 closed).
- Q55 closed: 1 consent page, 9 checkbox lines, no second prompt; per-scope checkboxes, unticked scope breaks add-on (Q82). Dark theme keeps cards white.
- Web 20a: "Loading..." first paint, 15 s/fail banner + Reload, no toast (before setup 1 toast, Q81); NOT_SET_UP_TEXT toast; one Admin folder list; export `run` reuse + start in one lock; newId random from SHA-256 of getUuid; admins text "its access".
- ADR-0004 Amendment 2026-11-12 Proposed (Q78): skeleton rule, tokens removed with adjacent U+0020, escapes as marker, runs joined; `{{` across segments -> PH_MALFORMED "The braces at character {n} would show as {{ in the email. Delete one of them." Touch validate.ts, placeholders.test.ts, wording.md, editor-guide.md.
- Open: Q80 toIcon try/catch, Q83 error icon drawn?, Q84 reply count overstates.

## D39 choice field (proposal 2026-11-12, owner not decided, Q97)
- `{{choice:Label|A|B}}`: 2-20 options, 1-100 chars each, no | { } backslash < >, no case-insensitive duplicate, token at most 2,200. Regex group 3 label, group 4 options split in code. New codes PH_CHOICE, PH_CHOICE_MISMATCH; PH_FIELD_TYPE sentence general "used as <kind> and as <kind>".
- Card: SelectionInput DROPDOWN, "Choose..." value "0" selected, options "1".."20" (formValue reads it). Check in add-on Insert callbacks: answers never reach the web app server. Unchosen = removed (Q91). Build after slice 25.

## D38 date field (owner 2026-11-12, Proposed)
- `{{date:Label}}` sibling of ask; regex `(ask|date)` group; PH_FIELD_TYPE for ask+date same identity; PH_CASE/FALLBACK_ASK extended. Shares validate.ts with Q78.
- Card: `DatePicker` (Apps Script date-only class, not DateTimePicker), `p-<n>`, starts empty (Q85); read `commonEventObject.formInputs[n].dateInput.msSinceEpoch` (legacy formInput cannot hold it). dateText = round(ms/86400000) days, UTC getters, MM/DD/YYYY; card JSON says DATE_ONLY = 00:00 UTC [A46]; local-midnight fallback ok UTC-11:59..+11:59 (Q87).
- Editor: menu item "Ask the sender for a date..." (Q88), chip " (date)", "date, used once"; preview today's date. Unpicked = removed (gap rules). No server change; no migration (old scanBody refuses date tokens). Q89 rollback, Q90 old page.

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
- Slices 1-22 with 22b done, on dev (8e82a07); 23 (tree collapse) in review retry 1 at a26e7f3. v1.1: restoreBackup editor fn (Q31), B2 pull + READ_ONLY (Q27), minors of 13.5.

## Open questions
- Closed: Q20 (S5), Q21 (D24), Q24 (slice 5).
- Q40-Q46 (D27) resolved by S7 (ADR-0007 A1). Q67-Q74 (slice 18): no via, form inputs unverified (fallback: drop boxes+switch), double press accepted, no first name for New email, no subject switch, rc mismatch notification, reply-all present skip, compose action on DecoratedText/FixedFooter unverified (fallback ButtonSet).
- Q47-Q52 (D29): dev reads off after deploy (accept), off caps owner+admin to use (accept, turn on to clean up), no third setting, no RECIPIENTS_EXTERNAL fallback, read+insert not hide, quick start disclosure.
- Q53 import refused on in-lock deny race (accept); Q54 rh without draft field state (accept); Q55 closed 2026-11-11.
- Q68, Q74 closed yes (part J). Q75 closed (Gmail error card). Q76 (rule 2 ASCII only; accept), Q77 (row Insert no notice; accept). Q78-Q84 errata 6.
- Q32 closed by D29. Q33-Q39 (D26): limits, no placeholders, To in reply not added, secondary domains (RECIPIENT_DOMAINS if needed), private allowed, no existence check, address search web only.
- Q22 = D23 open, assumption 3 s apply. Q23 built 6a. Q25 rec accept.
- Q26 dedicated owner account; Q27 B2 timing (v1.1); Q28 run V1-V4 on dev with pilot account; Q29 all versions under 20,000; Q30 dev to prod via interim runbook; Q31 restoreBackup editor fn.

## Conventions
- External sources [A1]..[A47]. Question IDs global Q1-Q97; next free Q98. Next free slice 26. ADR next free 0010. Spikes S2, S2b, S4, S5, S6, S7 closed (fresh consent open by hand, Q55; S7 step 9 form inputs not run, Q68).
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
