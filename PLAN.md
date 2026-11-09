# PLAN

Owner: thomas@migway.com. Orchestrator keeps this file current. Brief: docs/BRIEF.md (approved 2026-11-09).

## Status

| Phase | Gate | Status | Notes |
|---|---|---|---|
| 0 Setup | G0 | DONE 2026-11-09 | Repo, agents, PLAN.md pushed. 4 agents verified loaded in session 2 |
| 1 Research | G1 | DONE 2026-11-09 | Owner approved summary.md section 2 and accepted recommendations D4, D8 to D14. D7 open, assumptions below |
| 2 Spec and ADRs | G2 | REVISING 2026-11-09 | Owner chose one project (D15) and near-zero maintenance. Architect revising ADR-0001, 0002, 0003, 0005 and spec. Then back to owner |
| 2.5a Owner dev env | G2.5a | pending | Owner machine: clasp login, dev script project, test deployment |
| 2.5b Admin domain install | G2.5b | pending | Can wait until slices 1 to 7 PASS |
| 3 Build | G3 per slice | pending | 7 slices, signatures deferred to v2 |

## Next action

Owner reads docs/spec.md and docs/adr/0001 to 0005, approves or edits, and answers D15 to D20 (spec.md section 15 has the same list as Q1 to Q15 with a recommendation each). D7 facts still wanted. On approval: ADR status to Accepted, Phase 2.5a checklist to the owner, slice 1 (skeleton) launched.

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
| D16 | Prod server owner identity, spec Q3 | Existing licensed shared mailbox if one exists, else owner account plus handover runbook | open, owner input required |
| D17 | OU grants stored but inactive in v1, spec Q4 | Accept. Mirror OUs as groups where needed until the Directory resolver is active | open, recommended accept |
| D18 | Admins can see private folders, spec Q5 | Yes, disclosed in the quick start | open, recommended accept |
| D19 | Spike S2 fallbacks, spec Q6 to Q8 | Pre-approve Q7 (id_token switch) and Q8 (share server project as Viewer). Q6 (drive.readonly versus third project) only if the spike fails, owner decides then | open, recommended |
| D20 | Operational defaults, spec Q9 to Q15 | Accept all: searchDirectoryPeople fallback, 24-month audit, no external first names, any https image host, apply events may lose 5 min, keep all versions | open, recommended accept |

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
