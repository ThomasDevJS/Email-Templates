# PLAN

Owner: thomas@migway.com. Orchestrator keeps this file current. Brief: docs/BRIEF.md (approved 2026-11-09).

## Status

| Phase | Gate | Status | Notes |
|---|---|---|---|
| 0 Setup | G0 | DONE 2026-11-09 | Repo, agents, PLAN.md pushed. 4 agents verified loaded in session 2 |
| 1 Research | G1 | AWAITING OWNER 2026-11-09 | R1 to R4 done, synthesis done, 6 files in docs/research/. Owner approves docs/research/summary.md section 2 and answers D4, D7 to D14 |
| 2 Spec and ADRs | G2 | pending | Starts after G1 approval. Architect needs D7 answers |
| 2.5a Owner dev env | G2.5a | pending | Owner machine: clasp login, dev script project, test deployment |
| 2.5b Admin domain install | G2.5b | pending | Can wait until slices 1 to 7 PASS |
| 3 Build | G3 per slice | pending | 7 slices, signatures deferred to v2 |

## Next action

Owner reads docs/research/summary.md (one page). Owner approves the v1 feature set in section 2, or edits it, and answers the decisions in section 4. Orchestrator records answers below, updates docs/BRIEF.md where they change it, and launches Phase 2 (architect) in a fresh session.

## Open decisions

| ID | Question | Assumption in force | Decided |
|---|---|---|---|
| D1 | Who performs admin steps (2.5b) | Owner's Workspace admin, later | open |
| D2 | User count and pilot group | Under 500 users, one pilot Google Group | open |
| D3 | Central push of signatures | v2 only | owner 2026-11-09: signatures out of v1 |
| D4 | Chrome extension as fallback channel | No. Add-on plus web app. Research recommends closing as No (summary.md section 3 item 6) | open, recommendation No |
| D5 | Execution identity per surface | ADR-0003 in Phase 2. Research: add-on always runs as user, only web app can run as owner | open |
| D6 | Storage backend | ADR-0002 in Phase 2. Research: Properties too small, Cache in front of Sheets or Drive | open |
| D7 | Migway Workspace edition, nested role groups, admin API access restrictions | Unknown. Needed before ADR-0003 | open, owner input required |
| D8 | Role resolution path v1 | Web app "execute as me" as single server, storage private to it, GroupsApp on flat role groups, Groups Reader later | open, recommended |
| D9 | Placeholder syntax | `{{sender.name}}`, `{{ask:Label}}`, `{{var|fallback}}`, `\{{` | open, recommended |
| D10 | Recipient first name placeholder | Include, one sensitive scope | open, recommended |
| D11 | Personal templates for user role | Yes, one private folder per user | open, recommended |
| D12 | Attachments | Out of v1 | open, recommended |
| D13 | Pilot path before admin install | 2 to 3 colleagues as script editors on the test deployment | open, recommended |
| D14 | Storage backend choice | Architect in ADR-0002, Cache in front | open, recommended |

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
