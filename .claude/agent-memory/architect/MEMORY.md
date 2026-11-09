# Architect memory (Migway Gmail templates)

Last run: 2026-11-09, Phase 2 revision after owner decision D15. Repo is the source of truth; this file is a cache.

## Files I own
- docs/adr/0001 to 0005 (all Proposed, 0001/0002/0003/0005 revised 2026-11-09; 0004 had 4 consent lines fixed)
- docs/spec.md (sections 1-16; 16 = Operations and maintenance; open questions Q1-Q19 in section 15)
- docs/wireframes/01-07 (06 admin updated: audit month selector, Config jobs and backups)

## Owner decisions in force
- D15: ONE Apps Script project (topology 1a). 1b (two projects) rejected. Add-on code runs as user; web app deployment of same project runs as owner (USER_DEPLOYING, DOMAIN). Add-on calls its own /exec.
- Near-zero maintenance (BRIEF 1 Operations): only recurring human task = deploy. Housekeeping on triggers. Fewest moving parts.

## Decisions (Proposed)
- 0001: option 1 topology 1a. One manifest, 8 scopes everyone sees at self-install; admin domain install skips consent [R4 S60]. Pilot editors on DEV project only; code only via clasp push from owner; deploy script drift check (clasp pull vs last push hash); pilot editors removed after 2.5b.
- 0002: Drive JSON only (option 2). index.json {schemaVersion, rev, folders, grants, items, pendingAudit}; favorites.json; usage.json; members.json; bodies/<id>.v<n>.json immutable with appProperties (history via files.list); audit/YYYY-MM.jsonl; backups/YYYY-MM-DD 14 kept. Advanced Drive v3 (DriveApp needs `drive`, A9). Script Property STORE (IDs) and INDEX_REV. Cache keys idx:<rev>:<n>. Save: body file outside lock, lock, check rev+version, write index with audit event in same write (commit point), set INDEX_REV. Sizes: 750 B/item, index 0.85 MB at 1k, 8.4 MB at 10k. Budgets: coldest sidebar 2.7 s (Sheets was 4.3 s), save 2.1 s, lock hold 1.3 s. Shard into 16 items files above 3 MB. drive.file binds data to owner + OAuth client: prod switch to standard GCP before setup(); owner change = export/setup/import.
- 0003: Pattern A unchanged except target is same project's /exec. Shared stores table: add-on never touches Script Cache/Properties/Drive; server never uses getUserCache (would be owner's). Boundary test + ESLint. Trust boundary is the code. Triggers: tick 5 min, refreshMembers 15 min, daily 02:00. setup() idempotent, auto-rerun on first request after deploy when TRIGGERS_VERSION changes. ~27 min/day. Job health in Script Properties job:<name>:lastOk, shown in admin Config. Audit in JSONL monthly, 24 months.
- 0004: unchanged except admin.directory.user.readonly now on everyone's consent list.
- 0005: one bundle src/entry.ts, one appsscript.json, deploy/dev.json + deploy/prod.json (scriptId, deploymentId, execUrl, mode). execUrl baked into bundle. `npm run deploy -- <env>`, `npm run rollback -- <env> [version]`. Dev uses /dev (0 versions) if spike S2(d) passes. Maintenance table. Version pruning manual: Apps Script API versions has no delete (A11). Prod 1 version per deploy, prune at 150.

## Final default scope list (8)
gmail.addons.current.action.compose, gmail.addons.current.message.metadata, script.external_request, drive.file, userinfo.email, groups, admin.directory.user.readonly, script.scriptapp. Conditional: openid (Q7, or Q6 API deployment), drive.readonly (Q6 last resort), admin.directory.group.member.readonly (directory resolver), directory.readonly (Q9). spreadsheets removed.

## Facts I verified (not in R4)
- A1 tanaike: token calls to web apps need a Drive scope; sharing note (2018). Spike S2.
- A9 DriveApp createFile/createFolder need `drive`; getFileById needs drive or drive.readonly. No drive.file.
- A10 consent texts (oauth2/scopes page): spreadsheets "See, edit, create, and delete all your Google Sheets spreadsheets"; drive.file "...only the specific Google Drive files you use with this app"; groups "View and manage your Google Groups"; admin.directory.user.readonly "See info about users on your domain"; userinfo.email "See your primary Google Account email address".
- A11 Apps Script API projects.versions: create, get, list only.
- A12 web app guide: Execute as and access chosen per deployment (Deploy > New deployment); manifest webapp = defaults. One project can have UI (DOMAIN) + API (ANYONE_ANONYMOUS, ID token) deployments.
- getIdentityToken needs openid. Compose recipients are email strings. 200 versions per script.

## Conventions
- External sources [A1]..[A11]; A9, A10 in ADR-0002, A11 in ADR-0005, A7/A8 in ADR-0005.
- Question IDs Q1-Q19 global. Q2 decided (one project). New: Q16 Advanced Drive on drive.file, Q17 S2b thresholds (0.85 MB read and write under 2 s), Q18 My Drive vs shared drive, Q19 dev /dev vs /exec.
- Spikes: S2 (a)-(e), S2b (latencies incl. Drive 0.85/8.4 MB), S4 (insert).

## Open for next run
- Owner answers Q1, Q3-Q19; then status Accepted.
- Orchestrator must rewrite BRIEF 2.5a (still says server project, topology 1b, storage folder by hand) -> Q13.
- After spike S2/S2b: update ADR-0002 numbers, maybe reopen Sheets if thresholds fail; update ADR-0003 identity mode.
- After spike S4: ADR-0004 allowlist and size cap.

## Pitfalls
- One manifest = every scope on every user's consent screen at self-install.
- Script editors can read Script Cache and Properties; keep prod editors to owner + backup admin.
- In execute-as-me web app, getUserCache is the owner's: never use server-side.
- drive.file files created by hand are invisible to the app; setup() must create the folder.
- All server work counts against the owner's 30 simultaneous executions.
