# ADR-0005: Repository, build, tests, CI, deployment and rollback

Status: Proposed
Date: 2026-11-09
Deciders: owner (thomas@migway.com), architect

## Context

BRIEF 10 requires TypeScript strict, ESLint, Prettier, unit tests for pure logic, CI with lint, typecheck, test and build, no deploy from CI. BRIEF A5: the owner runs clasp from their own machine; the cloud session cannot log in. ADR-0001 splits the code into two Apps Script projects, `addon` and `server`, each with dev and prod: 4 script IDs.

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

## Options

Bundler:

1. esbuild. One pass, TypeScript built in, faster than tsc-based bundlers per vendor benchmarks (not verified here). Output is an IIFE; Apps Script needs top-level `function` declarations for triggers and entry points, so the build appends generated stubs.
2. Rollup with `@rollup/plugin-typescript`. Mature tree shaking, ES module output whose top-level functions Apps Script can see. Slower, more config, plugin for TypeScript.

Test runner:

1. vitest. Runs TypeScript through esbuild with no extra transform config, same toolchain as the bundler, Jest-compatible API, built-in coverage via v8.
2. jest. Needs `ts-jest` or Babel for TypeScript, separate transform from the bundler, slower start.

Project layout:

1. Monorepo with one `src/` and shared modules, two bundle entries.
2. Two repositories. Duplicates shared logic (permissions, placeholders, sanitizer).

## Decision

esbuild, vitest, one repository with two bundle entries.

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
  server/        server project
    entry.ts     doGet, doPost, rpc, trigger handlers (exported names)
    dispatch/    op table, authorize then handle
    storage/     Sheets and Drive adapters behind ports
    cache/       chunked Script Cache
    membership/  resolver interface, groupsapp_direct, directory, cloud_identity
    directory/   profile lookup
    audit/
  addon/         add-on project
    entry.ts     compose trigger, card actions (exported names)
    cards/       card builders
    client/      UrlFetch client for the server
  web/           browser code for the server web app
    index.html   shell template
    app.ts       UI, bundled and inlined into index.html
    editor/      ProseMirror schema, placeholder node
    styles.css   inlined
manifests/
  addon.appsscript.json
  server.appsscript.json
clasp/
  addon.dev.json  addon.prod.json  server.dev.json  server.prod.json
test/
  unit/          mirrors src/shared and src/server
  fakes/         in-memory CacheService, PropertiesService, LockService, SpreadsheetApp, GroupsApp, UrlFetchApp, Session
  fixtures/      sanitizer (40), placeholders, editor round trip
scripts/         build and deploy scripts (implementer, slice 1)
docs/            brief, plan, adr, spec, wireframes, ops, reviews, handoffs
dist/            build output, git-ignored: dist/addon, dist/server
```

### Build

- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, target ES2020, types `google-apps-script`.
- esbuild bundles `src/server/entry.ts` to `dist/server/Code.js` and `src/addon/entry.ts` to `dist/addon/Code.js`, format IIFE, global name `App`, target ES2020. A build step reads the exported names of each entry and appends one stub per name, `function doPost(e) { return App.doPost(e); }`, so Apps Script sees top-level functions. Exports are the only public functions; everything else is hidden in the IIFE.
- `src/web/app.ts` bundles to one script, inlined with `styles.css` into `dist/server/index.html`. No runtime CDN.
- Manifests copy to `dist/<project>/appsscript.json`. `oauthScopes` are explicit, so auto-detection cannot add `https://mail.google.com/` [R4 S7, S41].
- A build check fails if a manifest scope is not in the approved list in docs/spec.md section 9.
- Bundle size is printed per file. Budget: server `Code.js` under 600 KB, add-on `Code.js` under 250 KB, `index.html` under 400 KB.

### Lint and format

- ESLint flat config with `typescript-eslint` `strict-type-checked`, plus `no-restricted-globals` in `src/shared/` for every Apps Script global (`SpreadsheetApp`, `CacheService`, and so on). Pure code cannot touch the platform.
- Prettier with defaults, checked in CI.

### Tests

- Unit tests (vitest) for all of `src/shared/` and for `src/server/` handlers through ports. Coverage gate: 90% lines for `src/shared/`, 75% for `src/server/`.
- Apps Script globals are mocked by in-memory fakes in `test/fakes/`, installed on `globalThis` per test. Fakes model the limits that matter: Cache 100 KB per value and 1,000 items with FIFO eviction [R4 S30, S66], Properties 9 KB per value [R4 S2], lock timeouts.
- Required suites: role matrix (every cell of ADR-0003 Part C), policy table completeness, sanitizer fixtures (40), placeholder grammar and errors, editor round trip (slice 3, runs in jsdom), optimistic conflict, cache chunk versioning.
- Smoke tests: manual, 5 minutes, from docs/ops/smoke.md (written in slice 1, extended per slice). Minimum steps: open compose, sidebar loads under 3 s; search; apply a template with a prompt; open the editor via "Edit", save, sidebar reloads; restore a version; non-member account sees no restricted folder; audit row present.

### CI (GitHub Actions)

- Triggers: every pull request and push to `main`.
- Job on `ubuntu-latest`, Node LTS pinned in `.nvmrc`: `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test -- --coverage`, `npm run build`, scope check, secret scan with the gitleaks binary (MIT) over the diff.
- No clasp, no credentials, no deploy step. The workflow has `permissions: contents: read`.

### Environments and deployment

| Project | Dev | Prod |
|---|---|---|
| addon | Test deployment (HEAD) on the owner's account, pilot editors (D13) | Versioned deployment, ID referenced by the Marketplace SDK (2.5b) |
| server | Versioned web app deployment, `USER_DEPLOYING`, `DOMAIN` | Same, owned by the prod owner identity (Q3) |

- clasp configs: `clasp/<project>.<env>.json` hold `scriptId` and `rootDir: dist/<project>`. Script IDs are not secrets and may be committed (BRIEF 11). The deploy script copies the chosen file to `dist/<project>/.clasp.json` and runs clasp there. `.clasprc.json` (OAuth tokens) stays in the owner's home directory, git-ignored.
- Deploy (owner machine): `npm run deploy -- <project> <env>` runs build, `clasp push`, `clasp version "<git short sha>"`, `clasp deploy -i <deploymentId> -V <n> -d "<sha>"`. Redeploying the same deployment ID keeps the server `/exec` URL and the Marketplace deployment ID [R4 S52]. Deploy order: server first, then addon, so the add-on never calls an older API. The server accepts the previous `clientVersion` for one release.
- Deployment IDs and the server URL live in Script Properties of the add-on (`SERVER_URL`) and in `docs/ops/deploy.md`. They are not secrets.
- Rollback: `npm run rollback -- <project> <env> <version>` runs `clasp deploy -i <deploymentId> -V <previous>`. Data schema changes are additive only (new columns, new tabs), so code version N-1 still reads data written by N. Rollback is exercised once before v1 is done (BRIEF 13).
- Version cap: 200 per script [R4 S2]. Runbook step: when `clasp versions` shows over 150, the owner bulk-deletes versions older than the last 20 in Project History [A7]. Versions used by deployments are kept automatically.

### GCP project and ownership (2.5b, prod only)

- Dev stays on the default GCP project.
- Prod addon needs a standard GCP project for Marketplace publishing [R4 S14]. The switch is one way [R4 S61]. Do it once, on prod only, in 2.5b. Prod server may share the same standard project, which puts both projects' logs in one Cloud Logging view.
- Ownership: move the prod server project, the data spreadsheet and the bodies folder to the prod owner identity before the first prod deploy. Any later move breaks the web app until the new owner redeploys [R4 S12]; the runbook lists redeploy and `SERVER_URL` update as mandatory steps.

### Secrets policy

- No secrets exist in this design: authentication uses Google OAuth tokens minted at runtime. Script IDs, deployment IDs, URLs, group emails are configuration.
- Any future secret goes to Script Properties of the owning project, set by hand in the Apps Script editor, never in the repository, memory files, handoffs or docs (BRIEF 11).
- `.gitignore` covers `.clasprc.json`, `.env`, `*.key.json`, `dist`, `coverage`. CI runs gitleaks on every pull request.

## Consequences

- Easier: one repository and one toolchain for both projects; shared code is tested once; scope drift fails the build.
- Harder: 4 script IDs and 2 deploy commands per environment; the stub generator is custom build code (small, tested).
- Version pruning stays manual because no API deletes versions [A7].
- Revisit if clasp gains version deletion, or if bundle sizes exceed budget.

## Open questions

- Q13. BRIEF 2.5a says the dev web app runs "execute as user accessing". D8 and ADR-0003 need "execute as me", access "anyone in Migway". Recommendation: orchestrator updates BRIEF 2.5a.
- Q2 (ADR-0001) changes 2.5a from 1 dev project to 2. Recommendation: accept with Q2.

## Sources

- [R4 S2, S6, S7, S12 to S14, S30, S41, S49, S52, S61, S66], read 2026-11-09.
- [A7] https://developers.google.com/apps-script/guides/versions (200 versions, Project History bulk delete), read 2026-11-09 via search excerpt.
- [A8] https://github.com/google/clasp/issues/1015 (clasp versions and bulk delete), third party, search excerpt, read 2026-11-09.
