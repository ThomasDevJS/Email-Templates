# Handoff: orchestrator (session 2, Fable 5.1) to orchestrator (session 3)

## Done
- Phases 0 to 2 complete. ADR-0001 to 0005 Accepted. Decisions D1 to D20 in PLAN.md.
- Slices 1, 2, 3 built, reviewed (PASS) and merged on `claude/gracious-franklin-3n8zbq`: skeleton and pipeline, data and permission layer, placeholders, sanitizer, web app library, editor, history. 745 tests, 10 scopes, Code.js 226 KB, index.html 271 KB.
- Dev deployment live and verified by the owner: sidebar card, Ping through the server (35 ms), web app with identity, `setup` created the Drive folder and 3 triggers, spike S2b ran.
- Spikes closed (docs/spikes/slice-02-s2.md, s2b.md): Pattern A confirmed with `script.projects.readonly`; Drive-only storage within budget; Advanced Drive `alt=media` returns parsed JSON.

## Live dev state (configuration, no secrets)
- Script ID, head deployment ID and `/dev` URL: `deploy/dev.json`. Mode `head`. URL form must be `https://script.google.com/a/macros/migway.com/s/<id>/dev`.
- A versioned deployment `@1` named "slice1-spike exec" exists on the dev script; unused, safe to delete.
- Manifest: 10 scopes (spec section 9), `gmail.addons.execute` required at runtime, `script.projects.readonly` required for add-on to web app token calls.
- Temporary code to remove in slice 4: `onDiag` and `src/addon/client/diag.ts`, the `oauth2.googleapis.com` fetch whitelist entry, `spike.s2` and `spike.s2b` ops.

## How this session deployed (repeat in session 3)
1. `npm ci`.
2. clasp login without a browser: create a FIFO, start `npx clasp login --no-localhost < fifo` in the background, print the auth URL, owner opens it and pastes back the full `http://localhost:8888/?...code=...` redirect URL, write that line into the FIFO. Token lands in `~/.clasprc.json` (container only, never committed).
3. `npm run deploy -- dev` builds, drift-checks and pushes HEAD. No version created.
4. Owner rules after a deploy: code only, "Reopen sidebar"; scope change, "Run setup, then reopen"; reinstall of the test deployment only when told.
5. Google API hosts reachable from the container. `clasp run` and `clasp logs` are unavailable (no standard GCP project).

## Left
- Owner runs docs/ops/smoke.md "Slice 3" (10 steps) against the deployed build add8e5a and reports failures.
- Slice 4: apply to compose (sidebar lists, search, favorites tab, prompt card, `UpdateDraftBodyAction`), spike on draft insert HTML limits (ADR-0004 F1 to F9), remove temporary diag and spike code.
- Carry-overs from docs/reviews/slice-03.md: `template.get` does not re-sanitize stored bodies on read; QUOTA retry should wait 60 s; `PH_BACKSLASH` false positive for `<strong>a\</strong>{{token}}`; dead `bodySize`; `chrome-launcher` missing from devDependencies; spec section 6 lacks `template.getBody`; sanitize-on-paste preview not built; handoff counts stale.
- Carry-over from slice 2 review: a Drive read failure of `members.json` during `grant.add` can shrink the snapshot until the next refresh.
- D7 facts from the owner (edition, nested groups, admin API restrictions). D16 default: owner account owns prod.
- Pilot (D13): the first non-editor domain user test answers spike question (c), whether the project must be shared with callers.

## Risks
- htmlparser2 and ProseMirror verified in jsdom and a bare V8 context, not yet in a real Apps Script save. Smoke step 3 to 5 is the first real run.
- `drive.file` ties data to the owner account and OAuth client. Prod needs the standard GCP project before `setup` creates prod data (ADR-0002).
- Any domain user can call exported functions through the web app; the allowlist and guards cover them, tested in slice 2.

## Files touched this session
PLAN.md, docs/BRIEF.md, docs/research/*, docs/adr/*, docs/spec.md, docs/wireframes/*, docs/spikes/*, docs/ops/*, docs/reviews/slice-01 to 03, docs/handoffs/*, appsscript.json, deploy/dev.json, src/**, test/**, scripts/**, .github/workflows/ci.yml, .claude/agent-memory/*.

## Commands to reproduce
- `git log --oneline main..claude/gracious-franklin-3n8zbq`
- `npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build -- --env dev && npm run scopes:check`
- `npm run lighthouse`
