# BRIEF: Migway Gmail Templates and Signatures (internal tool)

Status: APPROVED 2026-11-09 by thomas@migway.com (v2: templates-only v1, non-admin owner). Repository: github.com/ThomasDevJS/Email-Templates. Once approved, this file is the authoritative brief. It supersedes the original chat prompt where they differ.
Owner: thomas@migway.com. Orchestrator: Claude (Fable 5.1). Subagents: claude-opus-5-5.
Date: 2026-11-09.

## 1. Product goal

Internal tool for the Migway Google Workspace domain. Users create, organize and store email templates and company signatures, and apply either to a Gmail message in one click. Access is controlled per template, folder and signature by role (admin, manager-editor, user) assigned to Google Groups or org units.

Scope v1:
- Templates: create, edit, duplicate, move, delete (soft), folders and categories, search, favorites, version history with restore.
- Placeholders: basic variables filled at apply time (sender name, title, phone, department; recipient first name when known; prompted free-text fields). Exact syntax decided in Phase 2.
- Signatures: OUT of v1. v2 adds company-wide, per-department and per-user signatures inserted into compose or copied to clipboard. Central admin push of signatures is a Phase 1 research question only. The data model in Phase 2 reserves room for signatures so v2 needs no migration.
- Apply: Gmail compose sidebar (Google Workspace add-on, Card Service) inserts the chosen template into the draft body in one click.
- Permissions: roles admin, manager-editor, user. Assignable per Google Group or org unit. Default deny. Enforced server-side.
- Admin UI: manage folders, signatures, role assignments, audit log, export.
- Editing UI: Apps Script web app (HtmlService) with a rich-text editor.

Non-goals v1 (unchanged from the original): public Marketplace listing, mail merge or campaigns, third-party servers or paid services, any flow that sends company data outside Google Workspace, signatures (moved to v2).

Cost and hosting: $0. Apps Script runs on Google's servers inside the Workspace tenant. No GCP billing, no external hosting. Firestore and any billed service stay out. Apps Script quotas (Phase 1, R4) are the only ceiling. Note: a private, domain-restricted Marketplace SDK configuration is required for admin force-install. That is allowed. A public listing is not.

Quality bar: polished and fast UI, maintainable production-grade engineering. Section 9 gives measurable targets.

## 2. Assumptions (owner corrects any that are wrong)

- A1. Domain size: under 500 users, under 1,000 templates, under 100 folders, under 50 signatures. Design for 10x.
- A2. Delivery: Workspace add-on (compose sidebar) plus Apps Script web app, one Apps Script project, TypeScript bundled to one .gs file via clasp. A Chrome extension is documented as an alternative only.
- A3. Execution identity: the web app and add-on will need an admin-owned identity to read group and OU membership through the Admin SDK Directory API. Phase 2 decides "execute as owner" versus "execute as user" per surface, with an ADR.
- A4. Storage: Google Drive files or Sheets owned by a service mailbox or shared drive, with CacheService in front. Firestore or any billed GCP service needs explicit owner approval.
- A5. Deployment: the owner runs `clasp push` and `clasp deploy` from their own machine. The cloud session cannot complete the clasp OAuth login. CI runs lint, test and build only.
- A6. Owner is not a Workspace admin. Development, testing and self-install use Apps Script test deployments on the owner's account and need no admin. A Workspace admin performs the one-time domain install later (Phase 2.5b). Pilot: a few colleagues install the test deployment manually, then the admin installs domain-wide.
- A7. Gmail mobile: compose add-on support is best effort. Web Gmail is the acceptance target.
- A8. Language: English only in v1.
- A9. Nothing persists in the cloud container between sessions unless pushed to a GitHub repository. A repository is a Phase 0 prerequisite.

## 3. Roles and models

Every subagent file in `.claude/agents/` carries `model: claude-opus-5-5` and `memory: project`. No subagent inherits the session model.

| Role | Purpose | Writes |
|---|---|---|
| researcher | Web research, competitor and feature analysis, Google platform constraints | docs/research/ only |
| architect | Data model, permission model, add-on and web app structure | docs/spec.md, docs/adr/, docs/wireframes/ |
| implementer | Code and tests for one slice at a time, in its own worktree | src/, test/, scripts/, slice docs |
| reviewer | Acceptance gate. Reviews diff against spec, runs real lint, test and build. Returns PASS, FAIL or BLOCKED with reasons | docs/reviews/ |

Verified on Claude Code 2.1.319 (docs: code.claude.com/docs/en/sub-agents): frontmatter `model` accepts a full model ID; `memory: project` stores memory at `.claude/agent-memory/<name>/MEMORY.md` and auto-loads the first 200 lines; `isolation: worktree` is supported on the Agent tool. `CLAUDE_CODE_SUBAGENT_MODEL` is a default since 2.1.251 and overrides frontmatter only with `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`. Phase 0 checks both variables. Unknown frontmatter fields fail silently, so Phase 0 verifies agent loading with `claude --debug`.

Every subagent prompt carries: "No mannered prose. Answer first, short sentences, numbers and names, end on the result." Reports are capped: researcher 600 words plus files, architect 400 words plus files, implementer 300 words, reviewer 300 words.

## 4. Memory and handoff protocol

Repository is the source of truth. Agent memory is a cache of conventions, never the only copy of a decision.

- Role memory: `.claude/agent-memory/<role>/MEMORY.md`, maintained by the built-in memory feature. The role updates it at the end of every run with decisions, conventions, pitfalls and open questions. Under 150 lines, summarized. No secrets, no customer data.
- Documents: `docs/BRIEF.md` (this file), `PLAN.md` (phases, status, next action, open decisions, owned by the orchestrator), `docs/adr/NNNN-title.md` (one per significant decision, status Proposed, Accepted or Superseded), `docs/handoffs/YYYY-MM-DD-<from>-to-<to>.md`.
- Handoff note contents: what was done, what is verified and how, what is left, known risks, files touched, commands to reproduce.
- A role relies only on its task prompt, its MEMORY.md, docs/BRIEF.md, PLAN.md, the ADRs and the latest handoff addressed to it. Missing information is reported, never guessed.
- Session boundary: at the end of each phase and each slice, the orchestrator updates PLAN.md, writes the handoff, commits, pushes, and tells the owner it is a good point to start a fresh session. A new session starts by reading docs/BRIEF.md, PLAN.md, docs/adr/ and the two latest handoffs.
- Research and spec documents cite sources with URLs and the date read.

## 5. Phase 0: setup (gate G0)

0.1 Check `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`. If either is set, report and stop. (Checked 2026-11-09: both unset.)
0.2 Repository: github.com/ThomasDevJS/Email-Templates, branch `main`, `.gitignore` (node_modules, dist, .clasprc.json, .env, coverage). Cloned 2026-11-09.
0.3 Create the four subagents in `.claude/agents/` with specific descriptions, `model: claude-opus-5-5`, `memory: project`, and tool restrictions (researcher: no Edit or Write outside docs/research, enforced by instruction; reviewer: no Edit or Write of src/).
0.4 Create PLAN.md, docs/adr/0000-template.md, docs/handoffs/README.md.
0.5 Commit and push. Because `.claude/agents/` did not exist before this session, tell the owner to start a fresh session with the repository attached so the agents load. Verify loading in the new session with `claude --debug`.

Exit criteria G0: repository pushed, four agent files present and loaded, PLAN.md current.

## 6. Phase 1: investigate existing solutions (gate G1)

Four researcher runs in parallel, public sources only (docs, pricing pages, help centers, reviews). No proprietary code, UI assets or branding copied. No logins, no trials.

| Run | Scope | Output |
|---|---|---|
| R1 | Ablebits Shared Email Templates, Gmail native Templates and Layouts, Workspace admin controls for them | docs/research/r1-gmail-templates.md |
| R2 | Central signature managers: Exclaimer, CodeTwo, plus at least 2 more found | docs/research/r2-signature-managers.md |
| R3 | Snippet and template tools: TextExpander, 2 or more Gmail template extensions, HubSpot and Salesforce template libraries (permission model ideas) | docs/research/r3-snippet-and-crm-templates.md |
| R4 | Platform constraints: Workspace add-on Card Service (compose triggers, UpdateDraftBodyAction HTML limits, mobile support), Apps Script web app (HtmlService, execute-as options, domain-only access), Chrome extension (force-install via policy, Gmail DOM fragility); OAuth scopes per approach and sensitivity class; admin force-install steps for each; signature push via Gmail API settings.sendAs with user token versus domain-wide delegation, with security trade-offs; Apps Script quotas (execution time, simultaneous executions, Properties and Cache limits, UrlFetch, Drive and Sheets call latency); Directory API access for groups and OUs | docs/research/r4-platform-constraints.md |

Orchestrator synthesizes:
- docs/research/feature-matrix.md (features by tool: permission models, placeholders, signatures, versioning, import and export, admin controls, pricing).
- docs/research/ux-notes.md (what the best tools do well, where users complain, with sources).
- docs/research/summary.md: one page, recommended v1 feature set, open decisions for the owner.

Exit criteria G1: all six files present, every claim cited, summary lists decisions with a recommendation each. Owner approves the v1 feature set. STOP.

## 7. Phase 2: spec and architecture (gate G2)

Architect produces docs/spec.md and ADRs. Required ADRs:
- ADR-0001 delivery approach: add-on sidebar plus web app, compared with Chrome extension and web-app-only. States Card Service limits and how the web app delivers the editing UX.
- ADR-0002 storage: Sheets versus Drive JSON versus Properties and Cache versus Firestore. Covers concurrency (optimistic version numbers, last-write-wins avoided), versioning, backup and export, read latency with caching.
- ADR-0003 execution identity and permission model: role to Google Group and OU mapping, how membership is resolved and cached, default deny, server-side enforcement, audit trail schema (who, what, when, before and after).
- ADR-0004 placeholders and HTML safety: syntax, allowed tags and attributes, sanitizer, no script injection, rendering consistency in Gmail web and mobile, signature duplication handling when Gmail's own signature is also set.
- ADR-0005 repo structure, TypeScript and clasp, bundling, test strategy (unit tests for pure logic with mocked Apps Script globals, smoke tests against a dev deployment), CI, dev and prod script projects, deployment and rollback (Apps Script deployment versions).

Spec also contains: information architecture, key screens and flows with low-fi wireframes (text or plain HTML in docs/wireframes/), error, empty and loading states, accessibility notes, quota budget per user action, logging format.

Exit criteria G2: spec and five ADRs present, each open question has a recommendation, owner approves. STOP.

## 8. Phase 2.5: environment prerequisites (gate G2.5)

2.5a Owner alone, no admin needed, before the first dev deploy:
- Apps Script project (dev) in the owner's Drive, created with clasp. The default Apps Script-managed GCP project is enough for test deployments.
- clasp installed and logged in on the owner's machine. `.clasprc.json` never enters the repository.
- Test deployment of the add-on installed on the owner's account (Apps Script editor, Deploy, Test deployments, Install).
- Web app deployed as "execute as user accessing", access "anyone in Migway".
- Storage folder in Drive (owner's Drive for dev).
- A deploy checklist in docs/ops/deploy.md, written by the implementer in the skeleton slice.

2.5b Workspace admin, one time, before domain install (can wait until slices 1 to 7 PASS):
- Standard GCP project, OAuth consent screen Internal, APIs per spec enabled. The owner creates it if the org allows project creation.
- Prod Apps Script project moved to a shared drive or service mailbox, so it survives staff changes.
- Marketplace SDK configured as a private domain app. Admin installs it for a pilot Google Group, then the domain.
- Google Groups used for roles: admins, editors, pilot users.
- If group membership lookup needs Admin SDK (ADR-0003), the admin grants the Directory API read role to the prod identity.

Exit criteria G2.5a: owner opens Gmail compose, sidebar loads from the dev deployment. G2.5b: pilot group sees the add-on without manual install.

## 9. Phase 3: build (vertical slices, gate G3 per slice)

Suggested order, adjusted per spec:
1. Skeleton: repo layout, TypeScript, bundling, lint, tests, CI, clasp config, deploy and rollback scripts, docs/ops/deploy.md.
2. Data and permission layer with unit tests, audit log, caching.
3. Template CRUD and editor (web app).
4. Apply to compose (add-on sidebar), placeholders.
5. Search, favorites, version history and restore.
6. Admin UI: roles, folders, audit view, export.
7. Docs: README, admin install guide, user quick start, operations runbook.
8. (v2) Signatures: CRUD, insert into compose, copy to clipboard, set my Gmail signature.

Slice protocol:
- One implementer run per slice, in its own worktree and branch `slice/NN-name`, via `isolation: worktree`.
- Implementer reports with a handoff note. Reviewer runs in the same worktree, runs the real lint, test and build, checks the diff against the spec and the quality bars, and returns PASS, FAIL or BLOCKED with reasons in docs/reviews/slice-NN.md.
- FAIL goes back to the implementer with the review attached. At most 2 retries, then escalate to the owner.
- Orchestrator merges to main only after PASS, pushes, updates PLAN.md, reports progress to the owner.
- Slices that touch deployment end with an owner-run deploy to dev and a 5-minute manual smoke test from docs/ops/smoke.md.

Measurable targets (web Gmail, dev deployment, pilot data of 200 templates):
- Apply template from sidebar: under 2 seconds from click to body update, 95th percentile.
- Sidebar initial load: under 3 seconds.
- Web app template list and search: under 1 second after first load, with cache.
- Permission check: zero UI-only checks. Every server function calls the permission layer first. Unit test proves each role matrix cell.
- Sanitizer: a fixture set of at least 30 malicious and benign HTML samples passes.
- Keyboard: every web app action reachable by keyboard. Focus visible. Labels on all inputs.
- Lighthouse accessibility score 90 or higher on the web app.

## 10. Quality bars (non-negotiable, unchanged)

- TypeScript strict, ESLint and Prettier, unit tests for all pure logic (permissions, placeholder rendering, sanitization), small functions, no dead code.
- Accessible, responsive, consistent UI. Clear empty, loading and error states. Fast perceived performance. Keyboard friendly.
- Least-privilege OAuth scopes, listed in the spec with a reason each. Permission checks enforced server-side.
- Graceful handling of quotas, failures and partial writes. Structured logging (JSON lines via console.log, with action, user, target, duration, result).
- Docs: README, admin install guide, user quick start, operations runbook (owner, update, rollback).
- CI on every pull request: lint, typecheck, unit tests, build. No deploy from CI in v1.

## 11. Security and secrets (unchanged, sharpened)

- Never hardcode or commit API keys, tokens, client secrets or sensitive data. Never write them into memory files, handoffs, ADRs, reviews or this brief. Use Script Properties or environment config. `.gitignore` covers `.clasprc.json`, `.env`, `*.key.json`.
- `.clasp.json` holds script IDs only and may be committed. The repository stays private.
- Anyone who sees a hardcoded secret or sensitive information anywhere warns the owner immediately and does not copy it elsewhere.
- Network: Google APIs named in the spec only. Dev tooling may reach npm and GitHub. No other external calls without owner approval in the spec. Researchers read public web pages only.
- Reviewer checklist includes a secret scan of the diff and a scope diff against the approved list.

## 12. Working rules

- At each gate: short summary, decisions needed, recommendation per decision.
- Once work begins, at most one clarifying question at a time, only when blocked. Otherwise state the assumption in PLAN.md and proceed.
- Independent research runs in parallel. The orchestrator keeps its own context for judgment and synthesis.
- Every phase end and slice end: PLAN.md updated, handoff written, commit pushed, owner told a fresh session is safe.

## 13. Definition of done, v1

- A pilot user in web Gmail opens the compose sidebar, picks a template from a folder they are allowed to see, and the body updates with placeholders filled, in one click.
- A manager-editor edits a template in the web app, sees version history and restores an older version.
- An admin assigns roles to a Google Group, and a user outside that group cannot see or use the restricted folder, verified by a server-side test and a manual check.
- Audit log shows who changed what and when.
- Search and favorites work in both the web app and the sidebar.
- All slices PASS review. CI green. Docs in section 10 present. Dev and prod deployments documented with a rollback that was exercised once.

## 14. Risks

- R1. Cloud container is ephemeral. Without a GitHub remote, all work is lost at session end. Mitigation: Phase 0.2 before anything else.
- R2. clasp cannot log in from the cloud session. Mitigation: owner deploys from their machine (A5). Adds a human step to each deploy gate.
- R3. Card Service has no rich text editor and limited widgets. Editing lives in the web app. The sidebar only lists, searches and applies.
- R4. (v2) Gmail appends the user's own Gmail signature. Inserting a second signature duplicates it. ADR-0004 notes the options for v2.
- R5. Group and OU resolution needs Admin SDK and an admin identity. Running the web app as the owner's account widens blast radius. ADR-0003 decides and documents mitigations.
- R6. Apps Script quotas and Drive latency can make the sidebar slow. Mitigation: CacheService, denormalized index, quota budget in the spec, measured in section 9.
- R7. HTML rendering differs across Gmail web and mobile. Mitigation: sanitizer allowlist, fixture tests, manual check on one phone.
- R8. Concurrency on Drive or Sheets storage. Mitigation: version numbers and LockService.
- R9. Domain install requires an admin, a standard GCP project, private Marketplace SDK setup and an Internal consent screen. Dev and pilot work without it. Script ownership must move off the owner's personal Drive before domain install.
- R10. Token cost: 4 researchers, 1 architect, 8 slices with up to 3 implementer and reviewer rounds each. Report caps in section 3 limit waste.

## 15. Open questions for the owner

See the orchestrator's report. Answers are recorded in PLAN.md under Open decisions, and this brief is updated.
