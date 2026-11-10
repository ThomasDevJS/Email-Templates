# Architect memory (Migway Gmail templates)

Last run: 2026-11-10, errata run 2 (D24 subject rule, slices 5b, 5c, 6a/6b split, ADR-0002 caches). Repo is the source of truth; this file is a cache.

## Files I own
- docs/adr/0001 to 0005 (Accepted 2026-11-09). Edits to accepted ADRs go in a dated "Amendment YYYY-MM-DD" section plus a bracket marker on the stale line; never rewrite history.
- docs/spec.md (sections 1-16; 5.6 subject D24 table; 11 `draft` object; 12.1 measured times; 13.1 slice 5, 13.2 5b/5c, 13.3 6a/6b, 13.4 known limits; Q1-Q25 in section 15)
- docs/wireframes/01-07 (02 now holds preview card and prompt card)

## Owner decisions in force
- D15 one Apps Script project. Add-on runs as user, web app deployment runs as owner (USER_DEPLOYING, DOMAIN).
- D18 admins see private folders in the library; `sidebar.home` hides other users' private folders (spec 2).
- D21 template subject applied in v1, slice 5.
- D22 (2026-11-10) Gmail web is the only acceptance client; Android and iOS best effort, untested. Spike S4 closed on web.
- D23 open: assumption 3 s accepted for apply in v1 (Q22).
- D24 (orchestrator, confirmed smoke 5c dev-848206f): template subject set only when the draft subject is empty or whitespace; "Insert with subject" and switch override; "Insert body only" never.
- Near-zero maintenance: only recurring human task = deploy.

## Decisions
- 0001: topology 1a. Amendment 2026-11-10: D22.
- 0002: Drive JSON only. index.json, favorites.json, usage.json, members.json, bodies/<id>.v<n>.json (with `subject`, missing = ""), audit/YYYY-MM.jsonl, backups 14. Amendment 2026-11-10: readers no lock, never set INDEX_REV; writes re-check in lock; `bd:<bodyFileId>` (<=90 KB); `ft:<bodyFileId>`, search.body max 25 Drive reads; FAVORITES_REV, USAGE_REV side caches.
- 0003: Pattern A (add-on UrlFetch to own /exec). Triggers tick 5 min, refreshMembers 15 min, daily. Trigger version check runs in doGet and tick, reads TRIGGERS_VERSION live in the lock (spec 16).
- 0004: grammar, sanitizer allowlist, ProseMirror atoms. Amendments 2026-11-10: (errata) no sanitize-on-paste; (S4) allowlist unchanged, cap 100 KB; (subject D21) same grammar, prompts shared, SUBJ_TOO_LONG 200, SUBJ_LINEBREAK; (D24 + S5, Accepted) set only on empty draft subject, `draftHasSubject`, `replacesSubject`; S5 one response, no new scope.
- 0005: esbuild, vitest, one bundle. Amendment 2026-11-10: bundle ships as JSON string literal, `/` before `/` or `*` written as `\/`, `(0, eval)(literal)`; HtmlService cut `//` after template literals on 43f10de; sandbox frame sets no CSP.

## Scopes (10, unchanged)
gmail.addons.execute, gmail.addons.current.action.compose, gmail.addons.current.message.metadata, script.external_request, drive.file, script.projects.readonly, userinfo.email, groups, admin.directory.user.readonly, script.scriptapp. Subject needs none extra (S5 verified). Any new scope needs owner approval.

## Facts I verified
- A1 tanaike token note; A9 DriveApp needs drive; A10 consent texts; A11 versions API has no delete; A12 per-deployment web app settings.
- A13 event-objects page (re-read 2026-11-10): documents 6 fields, no subject, no draftMetadata. LIVE compose event (owner smoke 5b/5c) has draftMetadata, to/cc/bccRecipients, subject; never threadId/messageId. Page is incomplete; trust smoke runs.
- A14 extending-compose-ui: subject example `setUpdateDraftSubjectAction(newUpdateDraftSubjectAction().addUpdateSubject(s))`; one action per example; scopes not listed; no mobile note.
- A15 UpdateDraftActionResponseBuilder: setters body, subject, To, Cc, Bcc, chainable; combining not documented.
- A16 gmail scopes page: action.compose non-sensitive, "Manage drafts and send emails when you interact with the Google Workspace add-on".

## Measured (spec 12.1)
- 9bbd262: first sidebar open 4.064 s add-on; apply first use 4.07 s; save about 10 s observed.
- 637ce77 (after 4b): add-on no server call 1.1-2.7 s; apply one server call 2.2-5.2 s, handler 0.2-0.6 s.
- 32a446c: warm save 4.2-5.2 s, Drive writes 2.0-2.7 s.

## Slice plan
- Slices 5, 5b, 5c done. 6a: admin shell, Folders and grants, Memberships, Trash view (restoreFromTrash has server handler), trash.purge, Q23. 6b: Audit, Usage, Export/import (subject), Config job health, backups.
- Stubs at a7e5abb (LATER_SLICE_OPS): trash.purge, export.*, import, audit.query, usage.report, config.get, backup.list, backup.restore.

## Open questions
- Closed: Q20 (S5), Q21 (D24), Q24 (slice 5).
- Q22 = D23 open, assumption 3 s apply. Q23 slice 6a. Q25 subject-only prompts asked with switch off: rec accept.

## Conventions
- External sources [A1]..[A16]. Question IDs global Q1-Q25. Spikes S2, S2b, S4, S5 all closed.
- Request ID format `XXXXXXXX-XXXXXX`, server enforced. Log fields `calls`, `timing` (spec 11).

## Pitfalls
- One manifest = every scope on every user's consent screen at self-install.
- Script editors can read Script Cache and Properties.
- In execute-as-me web app, getUserCache is the owner's: never server-side.
- drive.file files created by hand are invisible to the app.
- Owner's 30 simultaneous executions cap all server work.
- Do not invent mechanism details: read the source (e.g. scripts/lib/html.mjs) before writing an amendment.
- Google reference pages can be incomplete (A13 missed `subject`): the owner's smoke log is the evidence for live event fields.
