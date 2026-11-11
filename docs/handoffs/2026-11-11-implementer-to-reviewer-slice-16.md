# Handoff: implementer to reviewer, slice 16 (in-app admins, D32)

Date: 2026-11-11. Branch `slice/16-app-admins`, base `claude/gracious-franklin-3n8zbq` e710a56 plus merge of `slice/14-wording` e750645 (clean, commit f85db33). Not pushed, not deployed.

## Done

- `src/shared/model/admins.ts`: `ADMINS_MAX` 20, `adminEntriesOf(stored, domain)` (trim, lower case, form, domain, string `addedAt`, `addedBy`; anything else dropped), `appAdminsOf(index, domain)`. `IndexDoc.admins?: unknown`; `indexProblem` unchanged, so a bad list never fails the index.
- `isAdminEmail` 5th input `appAdmins: () => string[]`, called only when both properties say no. Blank caller is never admin (old code matched "" against a blank `ADMIN_EMAILS`). `subjectFor(email, snapshot, props, index)`; context shares one memoized `loadIndex`; dispatch `recheck` passes the in-lock index.
- `src/server/handlers/admins.ts`: `admin.add`, `admin.remove` (policy `web("admin.ops")`). Refusals are VALIDATION with `details.reason` = `ADMIN_FORMAT|OUTSIDE|NO_ACCOUNT|TOO_MANY|SELF` and the spec 7.3 text. Directory "not found" maps to `ADMIN_NO_ACCOUNT`, other errors to INTERNAL "The address could not be checked. Try again." An alias whose primary address is outside `DOMAIN` answers `ADMIN_OUTSIDE`. Repeat answers `changed: false`, no write.
- Audit target type `admin`; `config.get` adds `admins`, `breakGlass`; `backup.restore` keeps live `admins`, `after.liveAdminsKept`.
- Web: `views/adminAdmins.ts` section in "Settings and backups"; `addedByText`, `fixedAdminTexts` (admin/model.ts); api `addAdmin`, `removeAdmin`; audit words "Admin added", "Admin removed"; harness ops, `?admins=none`; CSS `.admins`, `.admin-add`. Form has `novalidate` so the server texts show (the browser bubble hid them).
- Docs: admin guide line replaced plus "Admins" steps; runbook "An admin account is taken over" and the restore line; smoke "Slice 16" steps 1 to 8.

## Criteria map (spec 13.10)

1 permissions.test.ts "finds in-app admins", "adminEntriesOf"; admins.test.ts "a malformed list or entry". 2 membership.test.ts `indexReads`. 3 admins.test.ts role matrix (12 cases) and add-on case. 4 "admin.add refusals" (7 tests). 5 "adds trimmed ... primary address". 6 "changed: false". 7 "in-lock re-check" (3 tests). 8 "ADMIN_SELF" plus a `setProperty` spy in `afterEach` over all 34 tests. 9 "one audit event per change". 10 "timing and caches" (2). 11 "every index writer keeps the list". 12 "backup.restore keeps". 13 "config.get returns admins". 14 adminReports.test.ts "config tab, Admins section" (7) and Lighthouse. 15 guide and runbook; scopes:check 10. 16 smoke: not run (no dev access here).

## Verified

Clean `npm ci`, then: lint 0 problems; typecheck clean; test:coverage 66 files, 1826 tests passed, 97.04 % statements, 90.87 % branches; build dev: Code.js 366.2 KB of 800, index.html 378.5 KB of 400; scopes:check "10 scopes, all approved"; format:check clean; lighthouse 16 runs, all 100 (new run "admin config no admins"). Mutation check: with the in-lock `context.recheck` removed, both criterion-7 tests fail.

## Left for later

- Smoke "Slice 16" on dev (criterion 16): the Directory error text for a made-up and a group address, and whether `domain_public` returns suspended users.
- The web client retries INTERNAL 3 times, so a Directory outage costs 4 Directory reads per click.
- Spec text said "Admin, Config, Settings" and "Refresh memberships now"; the docs quote the built names "Settings and backups" tab and "Refresh groups".
- A DENIED in the Admins section shows the existing text "You don't have access to this template. Ask a folder manager." (spec 7.3 says existing text); the word "template" reads oddly there.
- Malformed stored entries are dropped from the list at the next add or remove (the writer stores the clean list).

## Risks

- Every non-admin call to an admin row now reads the index (Script Cache hit normally). On a cold cache that is one Drive read before the denial.
- Directory "not found" match is `/not found/i` on the error message; unverified on Google.

## Files touched

src/shared/model/{admins,data}.ts, src/shared/permissions/principals.ts, src/server/membership/snapshot.ts, src/server/dispatch/{context,dispatch,policy,handlers}.ts, src/server/handlers/{admins,config}.ts, src/web/views/{adminAdmins,adminSettings}.ts, src/web/admin/{model,actions}.ts, src/web/rpc/api.ts, src/web/dev-harness.ts, src/web/styles.css, scripts/lighthouse.mjs, test/unit/server/{admins,membership,dispatch,adminReports}.test.ts, test/unit/shared/permissions.test.ts, test/unit/web/{adminReports,adminModel}.test.ts, docs/guide/admin-guide.md, docs/ops/{runbook,smoke}.md.

## Commands

`npm ci; npm run lint; npm run typecheck; npm run test:coverage; npm run build -- --env dev; npm run scopes:check; npm run format:check; npm run lighthouse`
