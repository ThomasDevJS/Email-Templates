# ADR-0005: Repository, build, tests, CI, deployment and rollback

Status: Accepted 2026-11-09 (orchestrator, by owner delegation; was Proposed) (revised 2026-11-09 after D15: one project, near-zero maintenance)
Date: 2026-11-09
Deciders: owner (thomas@migway.com), architect

## Context

BRIEF 10 requires TypeScript strict, ESLint, Prettier, unit tests for pure logic, CI with lint, typecheck, test and build, no deploy from CI. BRIEF A5: the owner runs clasp from their own machine; the cloud session cannot log in. ADR-0001 (topology 1a, D15): one Apps Script project per environment, dev and prod, 2 script IDs. BRIEF 1 Operations: the only recurring human task is deploying a new version.

| Fact | Source |
|---|---|
| 200 versions per script | [R4 S2] |
| Bulk delete of old versions only in the editor's Project History; versions used by an active deployment cannot be deleted | [A7] |
| clasp-undeployed versions may not appear in bulk delete (third-party issue) | [A8] |
| Editing a deployment to a new version keeps its ID and URL | [R4 S52] |
| `/dev` URL serves latest saved code to editors only | [R4 S12] |
| Default GCP project cannot publish to Marketplace; a script cannot return to a default project | [R4 S14, S61] |
| Web app stops working when ownership moves to a shared drive or another owner; the new owner must redeploy | [R4 S12] |
| `urlFetchWhitelist` optional for test deployments, required for versioned deployments | [R4 S6] |
| Test deployments need editor access, same-domain testers | [R4 S13] |
| Names ending in `_` are not callable from `google.script.run` | [R4 S49] |
| Apps Script API `projects.versions` has `create`, `get`, `list`; no `delete` | [A11] |
| One versioned deployment serves every entry point in the manifest (add-on and web app). Not in R4; slice 1 confirms | none |

## Options

Bundler:

1. esbuild. One pass, TypeScript built in, faster than tsc-based bundlers per vendor benchmarks (not verified here). Output is an IIFE; Apps Script needs top-level `function` declarations for triggers and entry points, so the build appends generated stubs.
2. Rollup with `@rollup/plugin-typescript`. Mature tree shaking, ES module output whose top-level functions Apps Script can see. Slower, more config, plugin for TypeScript.

Test runner:

1. vitest. Runs TypeScript through esbuild with no extra transform config, same toolchain as the bundler, Jest-compatible API, built-in coverage via v8.
2. jest. Needs `ts-jest` or Babel for TypeScript, separate transform from the bundler, slower start.

Project layout:

1. One repository, one bundle entry, one manifest, one Apps Script project per environment. Follows D15.
2. One repository, two bundle entries and two projects (topology 1b). Rejected by the owner (D15): 2 manifests, 2 deploys, 2 trigger sets.
3. Two repositories. Duplicates shared logic (permissions, placeholders, sanitizer). Rejected.

## Decision

esbuild, vitest, one repository with one bundle entry, one manifest, one clasp config per environment, one deploy command, one rollback command.

### Layout

```
src/
  shared/        pure TypeScript, no Apps Script globals
    model/       types for folders, grants, items, versions, audit
    permissions/ level calculation, policy table
    placeholders/ parser, validator, renderer
    sanitize/    htmlparser2 allowlist walker
    log/         JSON line logger
    errors/      error codes
  entry.ts       the one bundle entry: re-exports addon and server entry points
  server/        web app and trigger code, runs as the owner
    entry.ts     doGet, doPost, rpc, setup, tick, refreshMembers, daily
    dispatch/    op table, authorize then handle
    storage/     Drive JSON adapter (Advanced Drive v3) behind ports
    jobs/        trigger work: flush, cache refresh, purge, backup, audit roll, trigger install
    cache/       chunked Script Cache
    membership/  resolver interface, groupsapp_direct, directory, cloud_identity
    directory/   profile lookup
    audit/
  addon/         Card Service code, runs as the user, no storage access (ADR-0003 boundary test)
    entry.ts     compose trigger, card actions
    cards/       card builders
    client/      UrlFetch client for the server
  web/           browser code for the web app
    index.html   shell template
    app.ts       UI, bundled and inlined into index.html
    editor/      ProseMirror schema, placeholder node
    styles.css   inlined
appsscript.json  the one manifest
deploy/
  dev.json  prod.json   scriptId, deploymentId, execUrl, mode (dev: head, prod: version). No secrets
test/
  unit/          mirrors src/shared and src/server
  fakes/         in-memory CacheService, PropertiesService, LockService, Drive (Advanced), GroupsApp, UrlFetchApp, Session, ScriptApp triggers
  fixtures/      sanitizer (40), placeholders, editor round trip
scripts/         build and deploy scripts (implementer, slice 1)
docs/            brief, plan, adr, spec, wireframes, ops, reviews, handoffs
dist/            build output, git-ignored: Code.js, index.html, appsscript.json, .clasp.json
```

### Build

- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, target ES2020, types `google-apps-script`.
- esbuild bundles `src/entry.ts` to `dist/Code.js`, format IIFE, global name `App`, target ES2020. A build step reads the exported names and appends one stub per name, `function doPost(e) { return App.doPost(e); }`, so Apps Script sees top-level functions. Exports are the only public functions; everything else is hidden in the IIFE.
- The build takes `--env dev|prod` and injects `deploy/<env>.json` values (`execUrl`, environment name, git short SHA) as constants. The add-on reads `execUrl` from the bundle, so no Script Property names the URL.
- `src/web/app.ts` bundles to one script, inlined with `styles.css` into `dist/index.html`. No runtime CDN.
- `appsscript.json` copies to `dist/`. `oauthScopes` are explicit, so auto-detection cannot add `https://mail.google.com/` [R4 S7, S41].
- A build check fails if a manifest scope is not in the approved list in docs/spec.md section 9.
- Bundle size is printed per file. Budget: `Code.js` under 800 KB, `index.html` under 400 KB.

### Lint and format

- ESLint flat config with `typescript-eslint` `strict-type-checked`, plus `no-restricted-globals` in `src/shared/` for every Apps Script global (`SpreadsheetApp`, `CacheService`, and so on). Pure code cannot touch the platform.
- Prettier with defaults, checked in CI.

### Tests

- Unit tests (vitest) for all of `src/shared/` and for `src/server/` handlers through ports. Coverage gate: 90% lines for `src/shared/`, 75% for `src/server/`.
- Apps Script globals are mocked by in-memory fakes in `test/fakes/`, installed on `globalThis` per test. Fakes model the limits that matter: Cache 100 KB per value and 1,000 items with FIFO eviction [R4 S30, S66], Properties 9 KB per value [R4 S2], lock timeouts.
- Required suites: add-on and server boundary (ADR-0003 Part A), trigger set matches the spec table, role matrix (every cell of ADR-0003 Part C), policy table completeness, sanitizer fixtures (40), placeholder grammar and errors, editor round trip (slice 3, runs in jsdom), optimistic conflict with `rev` and item `version`, cache chunk versioning.
- Smoke tests: manual, 5 minutes, from docs/ops/smoke.md (written in slice 1, extended per slice). Minimum steps: open compose, sidebar loads under 3 s; search; apply a template with a prompt; open the editor via "Edit", save, sidebar reloads; restore a version; non-member account sees no restricted folder; audit row present.

### CI (GitHub Actions)

- Triggers: every pull request and push to `main`.
- Job on `ubuntu-latest`, Node LTS pinned in `.nvmrc`: `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test -- --coverage`, `npm run build`, scope check, secret scan with the gitleaks binary (MIT) over the diff.
- No clasp, no credentials, no deploy step. The workflow has `permissions: contents: read`.

### Environments and deployment

| Environment | Script project | Add-on | Web app URL the add-on calls | Versions created per deploy |
|---|---|---|---|---|
| dev | owner's Drive, default GCP project | Test deployment (HEAD), owner and pilot editors (D13) | `/dev` (HEAD, editors only [R4 S12]) if spike S2 (d) passes; else `/exec` of one versioned deployment | 0 with `/dev`; 1 otherwise |
| prod | prod owner identity (Q3), standard GCP project (2.5b) | One versioned deployment, its ID referenced by the Marketplace SDK | `/exec` of the same deployment, `USER_DEPLOYING`, `DOMAIN` | 1 |
| prod, if the Q6 API deployment is ever activated | same project | unchanged | Two web app deployment IDs: UI (`DOMAIN`) and API (`ANYONE_ANONYMOUS`, ID token, ADR-0003 Q6). Default: one. Settings are per deployment [A12 in ADR-0003] | 1 version, both deployments updated to it |

- One versioned deployment per environment carries both entry points, add-on and web app (slice 1 confirms). Updating it to a new version keeps its ID, its `/exec` URL and the Marketplace reference.
- `deploy/<env>.json` holds `scriptId`, `deploymentId`, `execUrl`, `mode`. Script and deployment IDs are not secrets and may be committed (BRIEF 11). The deploy script writes `dist/.clasp.json` from it. `.clasprc.json` (OAuth tokens) stays in the owner's home directory, git-ignored.
- Deploy, one command on the owner's machine: `npm run deploy -- <env>`. Steps: (1) refuse if the git tree is dirty or not on `main` (prod). (2) Build with `--env`. (3) Drift check: `clasp pull` into a temp directory and compare with the build recorded at the last push (hash stored in `deploy/.last-push-<env>` on the owner's machine, git-ignored); abort on difference, because someone edited code in the browser. (4) `clasp push`. (5) Mode `version`: `clasp version "<sha>"`, then `clasp deploy -i <deploymentId> -V <n> -d "<sha>"`. (6) Print "versions used N of 200; prune at 150".
- After deploy the first web app request reinstalls triggers if `TRIGGERS_VERSION` changed and runs data migrations under the lock (ADR-0002, ADR-0003). The owner runs nothing else.
- Rollback, one command: `npm run rollback -- <env> [version]` runs `clasp deploy -i <deploymentId> -V <previous>` (default: the version before the current one). Data changes are additive only (new fields, `schemaVersion` bumps that version N-1 still reads), so code N-1 reads data written by N. Rollback is exercised once before v1 is done (BRIEF 13). Dev in `/dev` mode rolls back by deploying the previous git commit.

### GCP project and ownership (2.5b, prod only)

- Dev stays on the default GCP project.
- Prod needs a standard GCP project for Marketplace publishing [R4 S14]. The switch is one way [R4 S61]. Order in 2.5b: (1) prod project created under the prod owner identity (Q3), (2) switched to the standard GCP project, (3) first deploy, (4) owner runs `setup()`, which creates the data folder, (5) pilot data imported from a dev export. Data created before step 2 would be bound to the old OAuth client under `drive.file` (ADR-0002).
- A later owner change breaks the web app until the new owner redeploys [R4 S12] and loses `drive.file` access to the old owner's files. Runbook (slice 7): export, new owner deploys and runs `setup()`, import. A one-time event, not a recurring task.

### Secrets policy

- No secrets exist in this design: authentication uses Google OAuth tokens minted at runtime. Script IDs, deployment IDs, URLs, group emails are configuration.
- Any future secret goes to Script Properties of the owning project, set by hand in the Apps Script editor, never in the repository, memory files, handoffs or docs (BRIEF 11).
- `.gitignore` covers `.clasprc.json`, `.env`, `*.key.json`, `dist`, `coverage`. CI runs gitleaks on every pull request.

## Maintenance

Target: the only recurring human task is deploying a new version. Everything else runs on the 3 triggers in ADR-0003 Part B or happens inside a user action.

| Task | Performed by | Frequency |
|---|---|---|
| Deploy a new version (`npm run deploy -- prod`) | owner | per release |
| Add, edit, move templates and folders, set grants | managers and admins in the web app | normal use, not maintenance |
| Role group membership | Workspace admins in Google Groups; the app picks it up within 15 min | normal use |
| Apply-event flush to `usage.json`, cache refresh before the 6 h TTL | `tick` trigger | every 5 min |
| Membership snapshot | `refreshMembers` trigger | every 15 min |
| Audit roll to monthly file, trash purge (30 days), orphan body cleanup, backup (14 kept), audit retention (24 months), job health | `daily` trigger | daily |
| Trigger install and reinstall after code changes | `setup()` on the first web app request after a deploy | per deploy, automatic |
| Data schema migration | first web app request after a deploy, under the lock | per deploy with a schema change, automatic |
| Version pruning in Project History | owner, by hand | prod: when the deploy output shows 150 of 200; dev: never in `/dev` mode |
| Trigger failure email | owner reads it; admin Config tab shows the late job | only on failure |
| Remove pilot editors from the dev project | owner | once, after 2.5b |
| Owner identity change, GCP project switch | owner and admin, runbook | once or on staff change |

Version pruning. No automatic way exists: the Apps Script API has no version delete method [A11], with or without a standard GCP project, and bulk delete is only in the editor's Project History [A7]. The driver is 1 version per prod deploy (one project, one version). Interval to the 150 mark: 150 deploys, about 6 years at 2 releases per month, about 3 years at 4. In dev, `/dev` mode creates 0 versions; if spike S2 (d) fails, dev creates 1 per deploy and reaches 150 after about 6 weeks at 5 deploys per working day, so the owner prunes dev every 6 weeks during Phase 3, or deletes and recreates the dev project and reimports dev data.

## Consequences

- Easier: one bundle, one manifest, one deploy and one rollback command per environment; shared code is tested once; scope drift fails the build; browser edits are detected before push; triggers and migrations install themselves.
- Harder: the stub generator and the drift check are custom build code (small, tested). Prod data is bound to the prod owner and the standard GCP project, so 2.5b must follow the stated order.
- Version pruning stays manual because no API deletes versions [A11]; at 1 version per prod deploy it falls due after about 150 releases.
- Revisit if the Apps Script API adds version deletion, or if bundle sizes exceed budget.

## Open questions

- Q13. BRIEF 2.5a said the dev web app runs "execute as user accessing". Resolved by the orchestrator: execute as me, access anyone in Migway. BRIEF 2.5a also still names a "server project" and topology 1b; recommendation: orchestrator rewrites that bullet for one project.
- Q19. Dev web app on `/dev` (0 versions, editors only) or on a versioned `/exec` (1 version per dev deploy)? Recommendation: `/dev` if spike S2 (d) passes.

## Sources

- [R4 S2, S6, S7, S12 to S14, S30, S41, S49, S52, S61, S66] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A7] https://developers.google.com/apps-script/guides/versions (200 versions, Project History bulk delete), read 2026-11-09 via search excerpt.
- [A8] https://github.com/google/clasp/issues/1015 (clasp versions and bulk delete), third party, search excerpt, read 2026-11-09.
- [A11] https://developers.google.com/apps-script/api/reference/rest/v1/projects.versions (methods: create, get, list), read 2026-11-09.
