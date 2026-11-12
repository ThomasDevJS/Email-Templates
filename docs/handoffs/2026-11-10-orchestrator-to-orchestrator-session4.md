# Handoff: orchestrator (session 3) to orchestrator (session 4)

## Done
- clasp re-authorized in the container (FIFO method, session 3 handoff step 2). Dev deployed at 05ed21f, then at the commit that carries this file.
- Slice 4 built, reviewed and merged (6293264) on `claude/gracious-franklin-3n8zbq`: server ops `sidebar.home`, `template.apply`, `spike.s4`; add-on home, folder, preview and prompt cards; insert with `IN_PLACE_INSERT` and `MUTABLE_HTML`; sidebar states; add-on User Cache `view:*`.
- Removed: `onDiag`, `src/addon/client/diag.ts`, the `oauth2.googleapis.com` whitelist entry, `spike.s2`, `spike.s2b`, `onPing` (the `ping` op stays).
- Carry-overs closed: `template.get` through `readableBody`, QUOTA Retry disabled 60 s, `PH_BACKSLASH` compares marks, `bodySize` removed, `chrome-launcher` pinned, `members.json` read failure no longer shrinks the snapshot.

## Verified and how
- Reviewer and orchestrator, clean `npm ci`: lint, typecheck, format:check exit 0; 40 files, 846 tests; lines 95.96%; 10 scopes; Code.js 259.2 KB, index.html 271.1 KB.
- Review: docs/reviews/slice-04.md. First run FAIL (1 blocking gap), retry 1 PASS.
- Not verified: any Card Service call or draft insert in Gmail. Smoke "Slice 4" is the first real run.

## Left
- Owner: smoke "Slice 3" (10 steps) and "Slice 4" (10 steps), spike sheet docs/spikes/slice-04-insert.md on Gmail web, Android, iOS.
- After the spike results: implementer trims the sanitizer allowlist, sets the final size cap (largest size that inserts on all 3 clients, divided by 2), updates ADR-0004, removes the S4 harness (files listed in docs/handoffs/2026-11-09-implementer-to-reviewer-slice-04.md).
- Architect errata, one run: spec section 6 add `template.getBody` (use, both) and `spike.s4` removal note; spec 4.1 step 5 name the `followUp` re-check; spec 4.1 or section 2 state that `sidebar.home` hides other users' private folders from admins while the library shows them (D18); spec section 7 add NOT_CONFIGURED when `DOMAIN` is unset; ADR-0004 paste: schema normalization replaces sanitize-on-paste preview.
- Open minors from the slice 4 review: `Action.setRequiredWidgets` untried; the server accepts `recipientEmailIfInternal` on `followUp` calls (first-name lookup with no apply event); a cancelled prompt card still counts as an apply in usage and slice 5 Recent.
- Slice 5: sidebar search, Favorites, Recent, web app search and favorites, history screen items left from slice 3.
- D7 facts from the owner. Pilot (D13) answers spike S2 question (c).

## Risks
- Card Service behavior is covered by unit tests on plain-data builders only. Widget limits, navigation pops and `UpdateDraftActionResponse` are unproven until the smoke run.
- F7 (200 KB) may fail on some clients; the 100 KB cap stays until results arrive.

## Files touched this session
PLAN.md, docs/handoffs/*, docs/reviews/slice-04.md, docs/spikes/slice-04-insert.md, docs/ops/smoke.md, docs/ops/deploy.md, src/**, test/**, scripts/**, package.json, package-lock.json, .claude/agent-memory/*.

## Commands to reproduce
- `git log --oneline 05ed21f..claude/gracious-franklin-3n8zbq`
- `npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build -- --env dev && npm run scopes:check && npm run format:check`
- `npm run deploy -- dev`
