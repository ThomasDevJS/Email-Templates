# Reviewer memory

## Project facts
- Owner email is in docs/BRIEF.md and ADR-0005 only. Do not copy it into reviews.
- Spec section 9: 8 default scopes, conditional list, `https://mail.google.com/` forbidden. Mirror in scripts/approved-scopes.json.
- One Apps Script project per env; webapp USER_DEPLOYING + DOMAIN; add-on calls own /exec via UrlFetch.
- Build: esbuild IIFE `App` + top-level stubs per export of src/entry.ts. Every export is callable via google.script.run.
- Boundary: src/addon must not import src/server or use Drive, GroupsApp, AdminDirectory, getScriptCache, getScriptProperties. src/server must not use getUserCache. ESLint + test/unit/boundary.test.ts.

## How to run checks
- Worktrees under /home/user/Email-Templates/.claude/worktrees/<id>. Use absolute paths.
- Commands: npm ci, lint, format:check, typecheck, test:coverage, build -- --env dev|prod, scopes:check, setup:check.
- Run them in background with logs in the scratchpad; npm ci first.
- Always reproduce `npm ci` in a clean dir (git show HEAD:package.json and lock, `npm ci --ignore-scripts --dry-run`). The implementer's node_modules hides lock drift.
- Secret scan: grep added lines for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA; list all emails; check lock `resolved` hosts.
- gitleaks is not installed locally; verify CI checksum against the upstream checksums.txt via curl.

## Slice log
- Slice 1 (2026-11-09): FAIL, retry 1. Only blocker: npm ci EUSAGE, vitest 5.1.0 peer @types/node ^22||>=24 vs lock 20.19.43. Fix verified: pin @types/node 22.20.5. Everything else passed (137 tests, 99.34% lines, 8 scopes).
- Review commit e3f6bf0 on slice/01-skeleton, docs/reviews/slice-01.md.

## Tracked risks to check in slice 2
- Trigger fns setup/tick/refreshMembers/daily and add-on callbacks are callable via google.script.run as owner. Slice 2 must guard before they do work. ADR-0003 Part C `_` suffix rule replaced by IIFE design; ADR needs update.
- Caller domain check (ADR-0003 Part A) missing; slice 2.
- deploy.mjs accepts empty execUrl for mode version.
- Boundary regex misses `from "../server"` without trailing slash.
- timeZone Etc/UTC open with owner.

## Recurring lessons
- Coverage text reporter hides 100% files; read the summary lines.
