# Architect memory (Migway Gmail templates)

Last run: 2026-11-09, Phase 2 (G2). Repo is the source of truth; this file is a cache.

## Files I own
- docs/adr/0001-delivery-approach.md, 0002-storage.md, 0003-identity-and-permissions.md, 0004-placeholders-and-html-safety.md, 0005-repo-and-delivery.md (all Proposed)
- docs/spec.md (sections 1-15, open questions Q1-Q15 in section 15)
- docs/wireframes/01-07 (plain text)

## Decisions (Proposed, await owner at G2)
- 0001: add-on sidebar + web app, TWO Apps Script projects: `addon` (user, 4 scopes) and `server` (web app execute as me, DOMAIN). Deviates from BRIEF A2 -> Q2. Edit via openLink OVERLAY + RELOAD_ADD_ON, add-on clears its User Cache before opening. Refresh button fallback if COOP.
- 0002: Sheets index (folders, grants, items, versions, favorites, usage, group_members, audit, meta, push_log) + one immutable Drive JSON file per version. SpreadsheetApp (not Sheets API: 60 reads/min/user and all server calls run as owner). Script Cache chunked 90 KB, keys versioned by INDEX_VERSION, rebuild under script lock. Add-on User Cache 10 min holds filtered view. Optimistic `version` + tryLock(10000); body file written before lock, row update is commit point. Apply events buffered in cache, flushed every 5 min (Q14). Nightly spreadsheet copy, 14 kept. JSON export/import.
- 0003: Pattern A: add-on UrlFetch to /exec with Bearer ScriptApp.getOAuthToken(); server reads Session.getActiveUser(); blank -> AUTH_NO_USER deny. Fallback CALLER_IDENTITY=id_token (getIdentityToken + tokeninfo). Pattern C (precomputed index) rejected. Resolver interface (listMembers, nestedGroups, orgUnitOf, capabilities), v1 `groupsapp_direct`, snapshot by 15-min trigger, request path never calls GroupsApp. OU grants stored but inactive (Q4). Levels use<edit<manage, max over ancestors, admin = manage everywhere incl. private folders (Q5). Single `dispatch` + policy table; functions ending `_` private. Audit schema + JSON-line logs in ADR Part D.
- 0004: EBNF + regex for tokens (text nodes only), closed registry of 5 names, save errors PH_*, unresolved var without fallback becomes implicit prompt, prompt values escaped, max 20 prompts, 500 chars. Sender values: server AdminDirectory domain_public (admin.directory.user.readonly, owner only); fallback searchDirectoryPeople (Q9). recipient.first_name only for exactly one internal To recipient. Sanitizer: htmlparser2 allowlist walker server-side; allowlists in ADR. Editor: ProseMirror atom node, storage = plain text tokens. Spike S4 F1-F9 on web/Android/iOS. v2 signature: recommend "set my Gmail signature", never insert + push both.
- 0005: esbuild IIFE + generated top-level stubs, vitest, one repo, src/shared|server|addon|web, clasp/<project>.<env>.json copied into dist/<project>, gitleaks in CI, no deploy in CI. Rollback = clasp deploy -i id -V prev. Prune versions by hand in Project History above 150. Standard GCP project prod only in 2.5b. Server first, then addon on deploy.

## Facts I verified this run (not in R4)
- tanaike README (third party): token calls to web apps need a Drive scope in the token; "execute as me" + "Anyone with Google account" needed project sharing (2018 note). Unverified for DOMAIN -> spike S2.
- getIdentityToken needs explicit `openid` scope (Google docs).
- Compose event recipients are email strings only (event-objects doc).
- domain_public field list is not documented; contact sharing must be on.
- Sheets 50,000 chars per cell (third party), 10M cells (Google blog 2022).
- 200 versions per script; bulk delete only in Project History UI.

## Conventions
- External sources I add are tagged [A1]..[A8] inside each ADR sources list. A1 tanaike, A2 ablebits sheets limits, A3 workspace blog 10M cells, A4 ScriptApp ref, A5 event objects, A6 manage-users, A7 versions guide, A8 clasp issue 1015.
- Question IDs Q1-Q15 are global across ADRs and spec section 15.
- Spikes: S2 (slice 2 identity/token), S2b (latencies), S4 (insert).

## Open for next run
- Owner answers to Q1-Q15, then flip ADR status to Accepted and update BRIEF A2/2.5a (orchestrator).
- After spike S2: update ADR-0003 (identity mode) and ADR-0002 budget numbers.
- After spike S4: update ADR-0004 allowlist and size cap.

## Pitfalls
- One project manifest = one scope list for every user. Keep server scopes out of addon.
- Script editors can read Script Cache and Properties. Pilot editors only on addon project.
- All server work counts against the owner's 30 simultaneous executions.
