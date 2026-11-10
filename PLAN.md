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
| 3 Build | G3 per slice | IN PROGRESS 2026-11-10 | Slices 1 to 4 PASS and merged (151b4c2, 5ed2c19, add8e5a, 6293264). Spikes S2 and S2b resolved. Spike S4 harness deployed, results wanted from the owner. Next: slice 5 search, favorites, recent |

## Next action

Owner: run docs/ops/smoke.md "Slice 3" (if not done) and "Slice 4" on the dev deployment, and fill in docs/spikes/slice-04-insert.md (F1 to F9 on Gmail web, then Android and iOS). Orchestrator: after the spike results, architect errata run (list in docs/handoffs/2026-11-10-orchestrator-to-orchestrator-session4.md), implementer trims the allowlist, sets the size cap and removes the S4 harness, then slice 5. Slice 5 may start before the spike results; it does not depend on them. D7 facts still wanted.

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
