# Reviewer memory

## Project facts
- Owner email is in docs/BRIEF.md and ADR-0002/0003/0005 only. Do not copy it into reviews.
- Spec section 9: 10 default scopes (drive.metadata.readonly added after S2 404), conditional list, `https://mail.google.com/` forbidden. Mirror in scripts/approved-scopes.json.
- urlFetchWhitelist (slice 2): script.google.com/macros/s/, script.googleusercontent.com/, googleapis.com/drive/v3/, googleapis.com/upload/drive/v3/.
- One Apps Script project per env; webapp USER_DEPLOYING + DOMAIN; add-on calls own /exec via UrlFetch.
- Build: esbuild IIFE `App` + top-level stubs per export of src/entry.ts. Every export is callable via google.script.run. Allowlist src/shared/entryPoints.ts (11 exports, surfaces webapp_rpc, doPost, trigger, addon).
- Boundary: src/addon must not import src/server or use Drive, GroupsApp, AdminDirectory, getScriptCache, getScriptProperties. src/server must not use getUserCache. ESLint + test/unit/boundary.test.ts.
- Permission layer: src/shared/permissions (matrix 17 rows, levelResolver), src/server/dispatch (policy 40 rows, targets, authorize before handler). Writes: storage/writer.ts mutateIndex/commitLocked.
- docs/* is in .prettierignore except docs/ops.

## How to run checks
- Worktrees under /home/user/Email-Templates/.claude/worktrees/<id>. Use absolute paths.
- Commands: npm ci, lint, format:check, typecheck, test:coverage, build -- --env dev|prod, scopes:check, setup:check.
- Run them in one background chain, logs in the scratchpad (scratchpad is shared across runs; check file mtimes).
- Always reproduce `npm ci` from clean (rm -rf node_modules). If the lock changed, also `npm ci --ignore-scripts --dry-run` in a clean dir.
- Secret scan: grep added lines for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, eyJ; list all emails and URLs.
- gitleaks is not installed locally; verify CI checksum against the upstream checksums.txt via curl.
- Probing behaviour without editing src/ or test/: `git archive HEAD | tar -x` into scratchpad, symlink node_modules, add a probe test, `npx vitest run <file> --reporter=verbose`. Delete the copy after.

## Slice log
- Slice 1 (2026-11-09): FAIL then PASS on retry 1 (501090f). Blocker was npm ci EUSAGE (@types/node peer). 144 tests, 99.34% lines.
- Slice 2 (2026-11-09): FAIL (195ab90, stale authorization under concurrent move), retry 1 fix 6052320: PASS (64078b8). 22 files, 439 tests, 99.39% lines, Code.js 103.4 KB, 10 scopes.
  - Fix: dispatch returns target placement; handlers/commit.ts rechecks inside the lock (CONFLICT reason moved, DENIED on lost level). races.test.ts 9 tests.
  - Open minor: readPreviousSnapshot swallows Drive errors, mergeGroup can then write members.json with one group. Add-on 404 at first hop (deploy issue, s2.md).

## Check in slice 3
- New write handlers must commit via handlers/commit.ts (recheck), not mutateIndex directly.
- readPreviousSnapshot error handling.
- Sanitizer replaces identity port; 30+ fixtures (BRIEF 9).

## Recurring lessons
- ESLint probes without editing src/: pipe code to `npx eslint --stdin --stdin-filename <existing src file>` (new paths hit the projectService parse error).
- Coverage text reporter hides 100% files; read the summary lines.
- Read handlers for TOCTOU: authorization data vs data inside the lock. Tests by implementers cover the sequence, not concurrent changes of the target.
- npm audit count from npm ci (16) differs from advisory count in handoffs (3); compare like with like.
