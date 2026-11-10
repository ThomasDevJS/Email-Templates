# PLAN

Owner: thomas@migway.com. Orchestrator keeps this file current. Brief: docs/BRIEF.md (approved 2026-11-09).

## Status

| Phase | Gate | Status | Notes |
|---|---|---|---|
| 0 Setup | G0 | DONE 2026-11-09 | Repo, agents, PLAN.md pushed. 4 agents verified loaded in session 2 |
| 1 Research | G1 | DONE 2026-11-09 | Owner approved summary.md section 2 and accepted recommendations D4, D8 to D14. D7 open, assumptions below |
| 2 Spec and ADRs | G2 | DONE 2026-11-09 | Revised for one project and Drive-only storage. Self-audit passed (one fix: per-deployment web app access). ADR-0001 to 0005 Accepted |
| 2.5a Owner dev env | G2.5a | DONE 2026-11-09 | Dev script deployed from the cloud session. Sidebar card, Ping through the server, web app identity, setup folder and triggers all verified by the owner |
| 2.5b Admin domain install | G2.5b | pending | Can wait until slices 1 to 7 PASS |
| 3 Build | G3 per slice | IN PROGRESS 2026-11-10 | Slices 1 to 4 and 4b PASS and merged (151b4c2, 5ed2c19, add8e5a, 6293264, 4b see log). Spikes S2 and S2b resolved. Spike S4 harness deployed, results wanted from the owner. Next: slice 5 search, favorites, recent |

## Next action

Owner: run the Chrome extension prompt for build 637ce77 (smoke "Slice 4b", timing fields, F9, "Edit in library") and one hand check (paste a `javascript:` link, save, link gone). Orchestrator: slice 5 is with the implementer (spec 13.1: subject, sidebar search, Favorites, Recent, web app search, S4 harness removal). Spike S5 (body and subject in one response, Q20) cannot run without Gmail, so it is step 1 of smoke "Slice 5"; a new scope stops for owner approval. After slice 5: reviewer, merge, deploy, owner smoke. Open questions from the architect: Q21 subject on reply drafts, Q22 speed targets (wait for the 4b timing fields, then an ADR-0003 decision if still missed), Q23 trigger reinstall order (slice 6), Q24 first-name lookup on follow-up calls (slice 5). ADR-0002 still lacks the "readers take no lock" rule. D7 facts still wanted.

## Open decisions

| ID | Question | Assumption in force | Decided |
|---|---|---|---|
| D1 | Who performs admin steps (2.5b) | Owner's Workspace admin, later | open |
| D2 | User count and pilot group | Under 500 users, one pilot Google Group | open |
| D3 | Central push of signatures | v2 only | owner 2026-11-09: signatures out of v1 |
| D4 | Chrome extension as fallback channel | No. Add-on plus web app | owner 2026-11-09: No |
| D5 | Execution identity per surface | ADR-0003 in Phase 2. Research: add-on always runs as user, only web app can run as owner | open |
| D6 | Storage backend | ADR-0002 in Phase 2. Research: Properties too small, Cache in front of Sheets or Drive | open |
| D7 | Migway Workspace edition, nested role groups, admin API access restrictions | Assume Business Standard or lower, flat role groups, no admin API restrictions. Resolver pluggable so the answer changes config, not design | open, owner to confirm by G2 |
| D8 | Role resolution path v1 | Web app "execute as me" as single server, storage private to it, GroupsApp on flat role groups, Groups Reader later | owner 2026-11-09: accepted, ADR-0003 details |
| D9 | Placeholder syntax | `{{sender.name}}`, `{{ask:Label}}`, `{{var|fallback}}`, `\{{` | owner 2026-11-09: accepted, ADR-0004 finalizes |
| D10 | Recipient first name placeholder | Include, one sensitive scope | owner 2026-11-09: accepted |
| D11 | Personal templates for user role | Yes, one private folder per user | owner 2026-11-09: accepted |
| D12 | Attachments | Out of v1 | owner 2026-11-09: accepted |
| D13 | Pilot path before admin install | 2 to 3 colleagues as script editors on the test deployment | owner 2026-11-09: accepted |
| D14 | Storage backend choice | Architect in ADR-0002, Cache in front | owner 2026-11-09: accepted |
| D15 | Two Apps Script projects (addon, server) instead of one (BRIEF A2), spec Q2 | One project (BRIEF A2 stands). Two identities inside it: add-on as user, web app deployment as owner. Consent list minimized, Drive-only storage preferred | owner 2026-11-09: one project |
| D16 | Prod server owner identity, spec Q3 | Owner account plus handover runbook. Switch to a shared mailbox if one exists before 2.5b | owner 2026-11-09: delegated default |
| D17 | OU grants stored but inactive in v1, spec Q4 | Accept. Mirror OUs as groups where needed until the Directory resolver is active | owner 2026-11-09: delegated, accepted |
| D18 | Admins can see private folders, spec Q5 | Yes, disclosed in the quick start | owner 2026-11-09: delegated, accepted |
| D19 | Spike S2 fallbacks, spec Q6 to Q8 | Q7 and Q8 pre-approved. Q6 only if the spike fails, owner decides then | owner 2026-11-09: delegated, accepted |
| D20 | Operational defaults, spec Q9 to Q15 | Accept all: searchDirectoryPeople fallback, 24-month audit, no external first names, any https image host, apply events may lose 5 min, keep all versions | owner 2026-11-09: delegated, accepted |
| D21 | Template subject applied to the draft in v1 | Yes, in slice 5, with `UpdateDraftSubjectAction`. Architect confirms scope and mobile support, and updates spec 5.3 and ADR-0004 | owner 2026-11-10: yes |
| D22 | Android and iOS checks | Dropped. Gmail web is the only acceptance target for v1. Spike S4 closed on web results: allowlist unchanged, size cap 100 KB final | owner 2026-11-10: skip mobile |
| D23 | Apply and sidebar speed targets (BRIEF 9: 2 s and 3 s) | Measured on dev-637ce77: add-on executions with no server call take 1.1 to 2.7 s; apply with one server call 2.2 to 5.2 s while handler code runs 0.2 to 0.6 s. Recommendation: accept 3 s p95 for apply in v1, measure again on `/exec` at prod setup; option: insert from the add-on cache with a 10 min permission lag | open, owner |

## Slices (Phase 3)

1. Skeleton and deploy pipeline
2. Data and permission layer with tests
3. Template CRUD and editor (web app)
4. Apply to compose (add-on sidebar), placeholders. Opens with an HTML insert spike on web, Android, iOS
5. Search, favorites, version history
6. Admin UI
7. Docs
8. (v2) Signatures

## Log

- 2026-11-09 Pre-phase: brief reviewed and revised, approved by owner. Scope cut to templates-only v1.
- 2026-11-09 Phase 0: repo attached, 4 agents created, PLAN.md created.
- 2026-11-09 Session 2: 4 agents loaded. R1 to R4 ran in parallel (about 6 to 12 min each). Synthesis written: feature-matrix.md, ux-notes.md, summary.md. 209 sources. G1 awaits owner.
- 2026-11-09 G1: owner approved v1 feature set (summary.md section 2) and recommendations D4, D8 to D14. D7 facts pending. Phase 2 launched.
- 2026-11-09 Phase 2: architect wrote spec, 5 ADRs, 7 wireframes (about 16 min). Orchestrator review passed. BRIEF 2.5a corrected to execute as me. G2 awaits owner.
- 2026-11-09 Owner: one Apps Script project (D15), near-zero maintenance as a design goal. Architect revision launched.
- 2026-11-09 Owner delegated G2 approval to the orchestrator after a self-audit, and asked to be told when testing is possible. D16 to D20 take the recommended values.
- 2026-11-09 G2 done by self-audit. Findings: scope list 8, none restricted; role matrix complete; maintenance table has deploy as the only recurring human task; fix applied on per-deployment web app access (Q6 fallback now adds openid only). Slice 1 launched.
- 2026-11-09 Slice 1: implementer 6 commits, review FAIL (lock file broke clean install), retry fixed 4 findings, review PASS. 144 tests, 99.34% lines, 8 scopes. Merged. Owner asked to run 2.5a.
- 2026-11-09 2.5a: dev script 1eVG4M... pushed from the cloud session (clasp login via pasted redirect URL). Fixes found live: gmail.addons.execute is required (R4 S42 wrong); add-on token (drive.file, drive.metadata.readonly) gets HTTP 404 at /dev and /exec, plain and /a/macros forms, while the owner's clasp token (has script.projects) gets 302 and ok; no token gives 401. Web app UI works with Session identity. Testing script.projects.readonly next; fallback is ADR-0003 Pattern B.
- 2026-11-09 Slice 2: implementer 4 commits, review FAIL (write authorized before lock, no in-lock re-check), retry fixed with in-lock re-check and 9 race tests, review PASS. 439 tests, 99.39% lines. Merged.
- 2026-11-09 Spike S2 (a) resolved: the web app front door needs a token that can read the script project; `script.projects.readonly` works, `drive.file` and `drive.metadata.readonly` do not. Final scope list 10. Spike S2b: Drive read 0.5 to 0.8 s, write 1.1 s for 821 KB, Drive-only storage stands. Advanced Drive returns parsed JSON for alt=media.
- 2026-11-09 Slice 3: placeholders, sanitizer (41 fixtures plus 10 adversarial), web app library, editor, history. Review PASS first time, 7 minor gaps carried to slice 4. 745 tests, Lighthouse 100 x3. Merged add8e5a. Dev deployed. Session 2 ends; owner switches model.
- 2026-11-10 Session 3: clasp re-authorized through the pasted redirect URL, dev deployed at 05ed21f. Slice 4: implementer 7 commits, review FAIL (sidebar empty state never shown because of the private folder), retry fixed 4 gaps (empty state, server re-check on the prompt card Insert through `template.apply` `followUp`, unused payload fields, stale smoke step), review PASS. 846 tests, 95.96% lines, 10 scopes, Code.js 259.2 KB. Merged 6293264. Dev deployed. Unset `DOMAIN` now answers NOT_CONFIGURED. `sidebar.home` hides other users' private folders from admins; the library still shows them (D18 holds).
- 2026-11-10 First smoke run through the Claude Chrome extension on dev-43f10de: web app library blank. Cause: HtmlService rewrites inline scripts on the server and, after template literals, deleted `//` to the end of the line inside "https://" strings (1,767 bytes cut). A force-print include of a second file was cut the same way. Fix 9bbd262: the bundle ships as one JSON string literal without `//` or `/*`, run through an indirect eval; served script equals the local build byte for byte. Not reviewed by the reviewer agent. Spike S4 on Gmail web: F1 to F9 all inserted, 200 KB included; F9 mid-line landed at the line start (to repeat by hand).
- 2026-11-10 Second smoke run on dev-9bbd262 (Chrome extension): library and sidebar work. Defects: "Open their version" loaded stale content, no row menu (Delete, Move, Duplicate), tree keyboard, apply 2.1 to 4.1 s and first sidebar open about 6 s against targets of 2 s and 3 s. Slice 4b: implementer 9 commits, review FAIL (client request IDs logged unchecked), retry fixed 4 gaps, review PASS. 891 tests, 96.27% lines, 10 scopes, Code.js 266.5 KB. Properties reads per request 7 to 1, readers take no lock, body cache, `calls` and `timing` in log lines. Hotfix 9bbd262 reviewed and accepted. Merged, dev deployed.
- 2026-11-10 Second account run by a pilot user (script editor, not in `ADMIN_EMAILS`) on dev-637ce77: library shows only his private folder, the owner's template link is refused, add-on test install works, sidebar empty state shows, own template saves and inserts in one click. Spike S2 (d) confirmed: `/dev` works for a non-owner editor. His question: the subject did not insert. Spec 5.3 reserves `subject` and ADR-0004 says v1 does not touch it; he typed into Title. Owner to decide whether v1 sets the subject (D21).
- 2026-11-10 D21: owner approved the template subject for v1, in slice 5. Architect errata run launched (spec, ADR-0004, ADR-0005, wireframes), slice 5 follows it.
- 2026-11-10 D22: owner dropped Android and iOS checks. Architect run (dac25dd): spec errata items 1 to 9, section 5.6 subject, 13.1 slice 5 contents, spike S4 resolved, spike S5 added, Q20 to Q24; ADR-0004 3 amendments (allowlist unchanged, cap 100 KB), ADR-0005 string-literal bundle, ADR-0001 D22; wireframes 01, 02, 04, 05. Trash view moved to slice 6. Slice 5 launched.
- 2026-11-10 Third smoke run (Chrome extension, dev-637ce77): slice 4b steps 1 to 8 pass (conflict reload, restore, tree keyboard, row menu, request IDs, timing fields). F9 inserts at the cursor when the body had focus before the card opened; the compose card is modal on Gmail web. Unlinked link `javascript:` refused. New findings for the next fix round: an admin sees two folders named "My templates" in the tree and the Move list (own and another user's), times shown in UTC, Duplicate shows no progress for about 8 s, History list needs a click before arrow keys work, Delete dialog focuses Delete, `template.create` ran 14.7 s as an execution with handler 4.2 s (timing JSON of slow writes wanted), onComposeOpen ran twice. "Edit in library" still unverified (window outside the extension's tabs). Speed: D23.
