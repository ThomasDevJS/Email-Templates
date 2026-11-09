# Review: slice 1, skeleton and deploy pipeline

Verdict: FAIL

Reviewer run 2026-11-09. Branch `slice/01-skeleton`, head cd9bf86, base e977695. Node 22.23.4, npm 10.9.9.

## Reason for FAIL

`npm ci` fails on the committed lock file. CI runs `npm ci` as its first step, so every CI run fails before lint.

- Problem: `npm ci` exits 1 with EUSAGE: "lock file's @types/node@20.19.43 does not satisfy @types/node@26.6.6" and "undici-types@6.21.0 does not satisfy undici-types@8.9.0".
- Cause: vitest 5.1.0 declares peer `@types/node` `^22.0.0 || >=24.0.0`. The lock resolves `@types/node` to 20.19.43 (pulled in by clasp's inquirer tree). `npm ls @types/node` marks it "invalid". The implementer's local `node_modules` hid the mismatch; `npm ci` rejects it.
- Reproduced in a clean directory with only `package.json` and `package-lock.json` from HEAD: `npm ci --ignore-scripts --dry-run` exit 1.
- Fix (verified in scratch): add `"@types/node": "22.20.5"` to devDependencies (exact pin, matches Node 22), regenerate the lock with `npm install`. After that `npm ci --ignore-scripts --dry-run` exits 0. Update the handoff to say 10 dev dependencies.
- Next: implementer fixes, reruns `npm ci` from a clean `node_modules`, then the full command list below. Retry 1 of 2.

All other checks pass. The commands below ran against the implementer's existing `node_modules`, since `npm ci` aborts before touching it.

## Command results

| Command | Result |
|---|---|
| `npm ci` | FAIL, exit 1, EUSAGE lock file out of sync (above) |
| `npm run lint` | PASS, exit 0, 0 problems |
| `npm run format:check` | PASS, "All matched files use Prettier code style!" |
| `npm run typecheck` | PASS, exit 0, no output |
| `npm run test:coverage` | PASS, Test Files 12 passed (12), Tests 137 passed (137) |
| coverage | statements 99.39% (163/164), branches 98.05% (101/103), functions 100% (56/56), lines 99.34% (152/153). src/shared and src/server 100% lines; gates 90% and 75% met |
| `npm run build -- --env dev` | PASS, Code.js 15.5 KB of 800 KB, index.html 1.5 KB of 400 KB, expected execUrl warning |
| `npm run build -- --env prod` | PASS, same sizes, same warning |
| `npm run scopes:check` | PASS, "Scope check passed: 8 scopes, all approved." |
| `npm run setup:check` | PASS, prints Node ok, clasp installed yes, logged in no, IDs "missing", next step `npx clasp login`. No account data printed |

`npm ci` output, first lines:

```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error Invalid: lock file's @types/node@20.19.43 does not satisfy @types/node@26.6.6
npm error Invalid: lock file's undici-types@6.21.0 does not satisfy undici-types@8.9.0
npm error Missing: @types/node@20.19.43 from lock file
npm error Missing: undici-types@6.21.0 from lock file
```

Diff: `git diff e977695...HEAD --stat`: 80 files changed, 11107 insertions, 1 deletion.

## Checklist

- Permission checks: PASS for slice 1. `doPost` and `rpc` both go through `handleRpc` then `dispatch`. Blank caller returns AUTH_NO_USER before the policy lookup. Unknown op returns UNKNOWN_OP. Any level above `none` returns DENIED. Policy lookup uses own properties only. A policy row without a handler fails closed with INTERNAL. Policy completeness test present. `doGet` serves the "Cannot identify" page on a blank caller.
- Secret scan: PASS. Pattern scan of 4,213 added lines (Google API keys, OAuth tokens, client secrets, private keys, GitHub, AWS, Slack tokens). 0 hits. Emails in the diff: `user@example.com`, `owner@example.com`, `key-user@example.com` only. All lock file `resolved` URLs point at registry.npmjs.org. gitleaks binary not installed locally; CI runs it.
- Scopes: PASS. `oauthScopes` has 8 entries and equals the spec section 9 default list as a set. `scripts/approved-scopes.json` default list equals the spec. `https://mail.google.com/` is listed as forbidden.
- Manifest: PASS. `webapp` `USER_DEPLOYING` and `DOMAIN`, `addOns.gmail.composeTrigger`, `urlFetchWhitelist` limited to `script.google.com/macros/s/` and `script.googleusercontent.com`, runtime V8.
- Quality bars: PASS. tsconfig has strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride, target ES2020. ESLint `strictTypeChecked` on all .ts. One inline disable (`no-implied-eval` in test/unit/scripts/stubs.test.ts, needed to evaluate generated stubs). No TODO. No dead exports found. Web shell: native button, `role="status"` with `aria-live`, "Pinging..." loading text, error text, `:focus-visible` style.
- Network: PASS. One runtime call, `UrlFetchApp.fetch(BUILD_INFO.execUrl)` from the add-on. `logoUrl` on gstatic.com (Google). CI downloads gitleaks from github.com (dev tooling, allowed by BRIEF 11).

## Extra checks

- (a) PASS. 8 scopes, no more, no fewer.
- (b) PASS. `src/addon` imports from `src/shared` only. No Drive, DriveApp, GroupsApp, AdminDirectory, getScriptCache, getScriptProperties. Enforced by ESLint rules and test/unit/boundary.test.ts.
- (c) PASS. deploy.mjs and rollback.mjs read `deploy/<env>.json` through `loadDeployConfig`. No reference to `.clasprc.json`, the home directory or tokens in scripts/. clasp reads its own login.
- (d) PASS. `permissions: contents: read`. No clasp, deploy or secrets step. Checkout uses `persist-credentials: false`. Actions pinned by commit SHA.
- (e) PASS. gitleaks 8.30.1 pinned. SHA-256 `551f6fc8...70eb` matches the upstream `gitleaks_8.30.1_checksums.txt` entry for linux_x64. `sha256sum --check --strict` runs before extraction.
- (f) PASS as tracked risk. `setup`, `tick`, `refreshMembers`, `daily` only call `logTriggerRun` (one JSON line). Test "trigger stubs" covers it.
- (g) PASS. README, docs/ops/deploy.md, docs/ops/smoke.md and the implementer MEMORY.md contain no personal data. The owner email does not appear in them.

## Tracked risks for slice 2 (not FAIL)

1. All 11 exports are top-level and callable through `google.script.run` from the web app, running as the owner. Includes `setup`, `tick`, `refreshMembers`, `daily` and the add-on callbacks `onPing`, `onComposeOpen`, `onHomepage`, `onOpenLibrary`. Slice 2 must guard trigger functions (trigger context or admin check) before they do work. ADR-0003 Part C says non-entry functions end with `_`; the IIFE plus stubs design replaces that, so slice 2 should update ADR-0003 or keep the export list to entry points.
2. Domain check on the caller email (ADR-0003 Part A: blank or not in the domain) is missing. `access: DOMAIN` covers it at Google's front door for now. Slice 2 adds it.

## Minor gaps (fix in slice 2 or with this retry, not blocking)

1. `scripts/deploy.mjs` accepts an empty `execUrl`. A prod deploy would ship an add-on that cannot reach the server. `missingForDeploy` should require `execUrl` for mode `version`.
2. Boundary test regex `/from\s+["'][^"']*\/server\//` misses `from "../server"` (no trailing slash). The ESLint pattern `**/server` catches it.
3. `onOpenLibrary` throws when `execUrl` is empty (handoff risk). Fixed by checklist step 7.
4. `timeZone` is `Etc/UTC`; `daily` at 02:00 runs in UTC. Owner question.
5. `npm audit`: 3 advisories in clasp's dev-only tree. Not shipped.
