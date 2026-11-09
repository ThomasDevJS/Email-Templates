# PLAN

Owner: thomas@migway.com. Orchestrator keeps this file current. Brief: docs/BRIEF.md (approved 2026-11-09).

## Status

| Phase | Gate | Status | Notes |
|---|---|---|---|
| 0 Setup | G0 | DONE 2026-11-09 | Repo, agents, PLAN.md pushed. Fresh session required so agents load. |
| 1 Research | G1 | IN PROGRESS 2026-11-09 | R1 to R4 launched in parallel, session 2 |
| 2 Spec and ADRs | G2 | pending | |
| 2.5a Owner dev env | G2.5a | pending | Owner machine: clasp login, dev script project, test deployment |
| 2.5b Admin domain install | G2.5b | pending | Can wait until slices 1 to 7 PASS |
| 3 Build | G3 per slice | pending | 7 slices, signatures deferred to v2 |

## Next action

Owner starts a fresh session with this repository attached. The new session reads docs/BRIEF.md, PLAN.md, docs/adr/, the latest handoffs, then verifies the 4 agents load (`claude --debug`, search "does not recognize") and launches Phase 1.

## Open decisions

| ID | Question | Assumption in force | Decided |
|---|---|---|---|
| D1 | Who performs admin steps (2.5b) | Owner's Workspace admin, later | open |
| D2 | User count and pilot group | Under 500 users, one pilot Google Group | open |
| D3 | Central push of signatures | v2 only | owner 2026-11-09: signatures out of v1 |
| D4 | Chrome extension as fallback channel | No. Add-on plus web app | open |
| D5 | Execution identity per surface | ADR-0003 in Phase 2 | open |
| D6 | Storage backend | ADR-0002 in Phase 2 | open |

## Slices (Phase 3)

1. Skeleton and deploy pipeline
2. Data and permission layer with tests
3. Template CRUD and editor (web app)
4. Apply to compose (add-on sidebar), placeholders
5. Search, favorites, version history
6. Admin UI
7. Docs
8. (v2) Signatures

## Log

- 2026-11-09 Pre-phase: brief reviewed and revised, approved by owner. Scope cut to templates-only v1.
- 2026-11-09 Phase 0: repo attached, 4 agents created, PLAN.md created.
