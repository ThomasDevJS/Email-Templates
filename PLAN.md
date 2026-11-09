# PLAN

Owner: thomas@migway.com. Orchestrator keeps this file current. Brief: docs/BRIEF.md (approved 2026-11-09).

## Status

| Phase | Gate | Status | Notes |
|---|---|---|---|
| 0 Setup | G0 | DONE 2026-11-09 | Repo, agents, PLAN.md pushed. 4 agents verified loaded in session 2 |
| 1 Research | G1 | DONE 2026-11-09 | Owner approved summary.md section 2 and accepted recommendations D4, D8 to D14. D7 open, assumptions below |
| 2 Spec and ADRs | G2 | DONE 2026-11-09 | Revised for one project and Drive-only storage. Self-audit passed (one fix: per-deployment web app access). ADR-0001 to 0005 Accepted |
| 2.5a Owner dev env | G2.5a | IN PROGRESS 2026-11-09 | clasp login and deploys run from the cloud session with the owner's one-time consent. Card loads in Gmail, web app UI works with identity. Add-on to server call fails (404), spike S2 (a) in progress |
| 2.5b Admin domain install | G2.5b | pending | Can wait until slices 1 to 7 PASS |
| 3 Build | G3 per slice | IN PROGRESS 2026-11-09 | Slice 1 PASS, merged 151b4c2. Slice 2 PASS (retry 1), merged 5ed2c19. Slice 3 launched. Spike S2 (a) open: add-on token gets 404 at the web app front door |

## Next action

Owner: run docs/ops/deploy.md steps 1 to 10 on their machine and report the step 10 Ping text (or the failure text). Orchestrator: slice 2 (data and permission layer) runs in parallel; spike S2 instructions wait for the dev deployment. D7 facts still wanted.

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
