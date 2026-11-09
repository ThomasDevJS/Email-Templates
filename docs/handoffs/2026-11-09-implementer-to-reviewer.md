# Handoff: implementer to reviewer, slice 1 (skeleton and deploy pipeline)

Branch `slice/01-skeleton`, based on e977695 (orchestrator branch head; the worktree started at 5ee45c2 without spec or ADRs). Not merged.

## Done
- Layout per ADR-0005; 12 placeholder files in directories later slices fill (shared/permissions, placeholders, sanitize; server/storage, jobs, cache, membership, directory, audit; web/editor; test/fixtures; docs/reviews).
- package.json with the 10 required scripts plus `scopes:check`. Node 22. 10 dev dependencies pinned exactly (retry 1 added `@types/node` 22.20.5), 0 runtime dependencies. TypeScript 6.0.3: typescript-eslint 8.72.2 supports `<6.1.0`, so TS 7.0.2 (latest) is excluded.
- tsconfig per ADR-0005, plus `allowJs`/`checkJs` for `scripts/lib` (pure build helpers, JSDoc typed).
- `scripts/build.mjs`: IIFE `App` plus sorted stubs from the esbuild metafile export list, inlined `index.html`, env constants, size budget, scope check against `scripts/approved-scopes.json` (8 default, 4 conditional, `https://mail.google.com/` forbidden).
- Entry points per criterion 6. `ping` returns `{ pong, caller, env }`, so the smoke test shows what `getActiveUser` returned (spike S2 evidence).
- deploy, rollback, setup-check per ADR-0005, including the drift check (`clasp pull` into a temp dir, hashes in git-ignored `deploy/.last-push-<env>.json`).
- CI, docs/ops/deploy.md, docs/ops/smoke.md, README, .gitignore.
- Extra: boundary test (spec section 13 assigns it to slice 1), DENIED and NETWORK error codes.

## Verified (2026-11-09, Node 22.23.4)
- `npm run lint`: 0 problems. Probe files confirmed the shared-globals, add-on import, getScriptCache and getUserCache rules fire.
- `npm run format:check`: "All matched files use Prettier code style!"
- `npm run typecheck`: no output, exit 0.
- `npm test`: "Test Files 12 passed (12), Tests 137 passed (137)".
- `npm run test:coverage`: lines 99.34% (152/153), statements 99.39%, branches 98.05%; gate passes.
- `npm run build -- --env dev` and `-- --env prod`: "Code.js: 15.5 KB of 800 KB", "index.html: 1.5 KB of 400 KB", plus the expected execUrl warning.
- `npm run scopes:check`: "Scope check passed: 8 scopes, all approved."
- Built Code.js run in a node vm with fake globals: 11 top-level functions, doPost ping returns the envelope, unknown op returns UNKNOWN_OP.
- deploy and rollback refuse on empty IDs; setup-check prints "clasp logged in: no", next step `npx clasp login`.
- Not verified: anything against Google (no clasp login here), the CI run itself, the gitleaks step.

## Left for later
- `setup()` installing the 3 triggers and the `TRIGGERS_VERSION` reinstall: slice 2.
- Domain check on the caller email (ADR-0003 says blank or not in domain): slice 2, needs a domain Script Property.
- `doGet` view routing (`?view=editor`), web shell UI: slice 3.

## Risks
- `setup`, `tick`, `refreshMembers`, `daily` and add-on callbacks are top-level, so any domain user can call them via `google.script.run` in the web app, running as the owner. They only log now. Slice 2 must guard them (trigger context or admin check) before they do work.
- `onOpenLibrary` throws if `execUrl` is empty; fixed by checklist step 7.
- Drift check compares pulled files to the push record; Apps Script reformatting of Code.js is unverified. A false alarm blocks a deploy until the record file is deleted.
- `logoUrl` is a gstatic Material icon placeholder.
- `npm audit`: 3 advisories (glob, minimatch moderate; zod high) in clasp's dev-only tree. Not shipped to Apps Script.
- The test for `import.meta.glob` relies on vite types from vitest's transitive dependency.

## Retry 1 (review FAIL, docs/reviews/slice-01.md)
- Blocker fixed: `@types/node` pinned to 22.20.5; lock regenerated from scratch. Cause: clasp's tree resolved @types/node 20.19.43, outside vitest 5.1.0's peer range `^22.0.0 || >=24.0.0`; local node_modules hid it.
- `missingForDeploy` now requires `execUrl` in mode version. `npm run deploy -- prod` prints: "deploy/prod.json is missing scriptId, deploymentId, execUrl. Mode version needs scriptId, deploymentId and execUrl, or the add-on cannot reach the server."
- Boundary test matches any import path segment named `server` (or `addon`): `../server`, `../../server/x`, `server/x`. 7 new cases, 3 of them negative (`serverless`, `observer`, `server-utils`). ESLint now bans add-on imports from shared and server too; probes for all 4 forms fail lint.
- `timeZone` is `America/New_York`; docs/ops/deploy.md section "Time zone" marks it owner-adjustable.
- Results after `rm -rf node_modules dist coverage`:
  - `npm ci`: exit 0, "added 427 packages, and audited 428 packages".
  - `npm run lint`: exit 0. `npm run format:check`: "All matched files use Prettier code style!". `npm run typecheck`: exit 0.
  - `npm run test:coverage`: "Test Files 12 passed (12)", "Tests 144 passed (144)", Lines 99.34% (152/153).
  - `npm run build -- --env dev` and `--env prod`: Code.js 15.5 KB of 800 KB, index.html 1.5 KB of 400 KB.
  - `npm run scopes:check`: "Scope check passed: 8 scopes, all approved."

## Files touched
.gitignore, .nvmrc, .prettierignore, .github/workflows/ci.yml, README.md, appsscript.json, deploy/{dev,prod}.json, docs/ops/{deploy,smoke}.md, eslint.config.mjs, package.json, package-lock.json, scripts/*.mjs, scripts/lib/*.mjs, scripts/approved-scopes.json, src/** (16 .ts, index.html, styles.css), test/fakes/*.ts (7), test/unit/** (12 test files), tsconfig.json, vitest.config.ts, placeholder files.

## Commands to reproduce
```sh
rm -rf node_modules && npm ci
npm run lint && npm run format:check && npm run typecheck
npm run test:coverage
npm run build -- --env dev && npm run build -- --env prod && npm run scopes:check
npm run setup:check
```
