# Handoff: orchestrator to orchestrator, extension requests (paused)

Date: 2026-11-13. From: the orchestrator of the session that took the extension's three handoffs. To: the next orchestrator session of `ThomasDevJS/Email-Templates`. The owner paused the work after slice 29 merged.

## Done

- Requests read from `ThomasDevJS/Email-Templates-Extension`, branch `claude/dreamy-allen-rjeysh`, `docs/handoffs/2026-11-13-extension-to-server-{sanitizer-finding,sign-in,local-copy}.md` and `2026-11-13-prompt-for-server-session.md` (the owner's task text).
- Work branch `claude/extension-requests`, started at c0564bc (head of `claude/gracious-franklin-3n8zbq`), pushed.
- Architect run: `docs/adr/0010-extension-surface.md` (Proposed), spec 5.11 (contract) and 13.12 (slices 29 to 34), Q98 to Q104, `docs/handoffs/2026-11-13-architect-to-orchestrator-extension-requests.md` (verdict table). None of the 6 requests is accepted as asked.

| Slice | Request | State | Commits |
|---|---|---|---|
| 28 image host check | SF1 | review PASS, merged | fix a79cdda, merge ada97bc |
| 29 front door of `doPost` | SR2 | review FAIL, retry 1, PASS, merged | 6cdf1c9, 5320f91, merge on the work branch |
| 31 shared `visibleLibrary` | SR4a base | review PASS, merged | 1f67e9b, merge 9170d4c |
| 30 surface label `client`, `entry` | SR3 | built, stopped by the pause, NOT reviewed, NOT merged | 6b14c46, c2b08b3 on `slice/30-surface-label` |
| 32 apply additions | SR4b | not started | |
| 33a sync list, etag, `rules` | SR4a | not started | |
| 33b sync bodies, budgets | SR4a | not started | |
| 34 measurement run on dev | SR4 | not started | |

## Verified (how)

- Work branch at 7c5d282: `npm test` 2,232 tests in 78 files pass (slices 28, 29, 31 together).
- Slice 28: the reviewer compared the sanitizer with Chromium on 345 attack URLs, 0 kept with another host; empty `IMG_HOSTS`: 0 differences over 82 fixtures, 95 old bodies, 12,000 generated inputs.
- Slice 29: 118 `postData` shapes, 0 exceptions out of `doPost`, 16 of 16 cross-site shapes refused with 0 Drive, cache and handler calls.
- Slice 31: 12,600 replies of `sidebar.home` and `search` on 300 random indexes, 0 differences from base.
- Slice 30 at c2b08b3: `npm run typecheck` clean, `npm test` 2,304 tests in 78 files pass. Lint, format, build and scope check were not rerun after the stop.
- Nothing is deployed. Dev still serves dev-465a068.

## Left (in order)

1. Slice 30: the implementer was stopped while adding protocol tests and an audit-load test (a row with `surface: "extension"` read by the shared shape check, `parseLines`, `auditPage`). Check the handoff `docs/handoffs/2026-11-13-implementer-to-reviewer-slice-30.md` on the slice branch against spec 13.12 slice 30, let an implementer add what is missing, run all 6 commands, then the reviewer gate. The reviewer must run every `web` row of the live `POLICY` table through `doPost` with `client: "extension"` and expect DENIED.
2. Slices 32 and 33a from the merged slice 30 (may run in parallel; both edit `dispatch/dispatch.ts` and `dispatch/policy.ts`, the second to merge rebases). Then 33b. Briefs: spec 13.12. For slice 32 the reviewer must send hostile `at`, `knownVersion` and `applyId` values (strings, objects, 1 MB) on a refused apply and find none copied raw into the audit row. For 33a: `folders` can list a child before its parent (slice 31 finding).
3. Dev deploy: no clasp login exists in a cloud container. `npx clasp login --no-localhost` prints a Google link; the owner pastes the redirect URL back (as on 2026-11-10). Then `npm run deploy -- dev` from a clean tree.
4. Slice 29 smoke on dev (`docs/ops/smoke.md` "Slice 29"): one Insert from the compose toolbar and one side-panel open. It proves what Apps Script reports in `postData.type` for the add-on. It must pass before any prod deploy.
5. SR1: one hand-made versioned web app deployment on the dev project (ADR-0010 Decision 7: `clasp create-version`, `clasp create-deployment -V <n> -d "extension test"`, or the editor). Give the `/exec` URL to the owner in chat only. Never write it or its deployment ID into a file of either repo.
6. Slice 34: measurements of spec 5.11 "To measure"; the architect then sets the 3 sync budgets.
7. Architect errata run: ADR-0010 to Accepted after the owner's answers, spec as built.
8. Write `docs/handoffs/<date>-server-to-extension.md`: the SF1 commit (a79cdda), the final `extension.sync` and `template.apply` shapes as built, what was changed or refused and why (the verdict table), the dev build name. No URL in it.
9. Merge the agents' memory notes into `.claude/agent-memory/{implementer,reviewer}/MEMORY.md` (agents were told not to edit them in these runs). PLAN.md log line per slice.

## Waiting for the owner

- Q98, D42: confirm that template To, Cc and Bcc addresses go into the extension's local copy. Asked twice in chat, no answer yet. Slice 33a builds them in; a "no" turns the 4 fields back into counts.
- Q100: is Script Property `IMG_HOSTS` set on dev? Empty closes SF2 with no report.
- Q103: ship slices 29 and 30 before the org deploy (recommended yes). Q99, Q101, Q102, Q104: accept the recommendations in spec 15.
- The clasp sign-in for steps 3 and 5.

## Risks

- Slice 29 refuses every add-on call if Apps Script reports another `postData.type` than `application/json`. Step 4 is the guard; rollback is a deploy of the previous commit.
- Slice 30 is unreviewed code on a pushed branch. Do not merge it without the gate.
- The extension may pin a79cdda now. It must not build against spec 5.11 shapes before slices 32 and 33b merge; shapes differ from its request (`page` arg, `after.claimed`, no `insertedFromCopy`, `recorded` optional, `at` not used for usage).
- A cloud container is reclaimed when idle. Everything above is pushed; worktrees and scratch harnesses of the reviews are not kept.

## Files touched

- `src/shared/sanitize/attrs.ts`, `src/server/entry.ts`, `src/server/frontDoor.ts` (new), `src/server/handlers/visible.ts` (new), `src/server/handlers/sidebar.ts`, tests under `test/unit/`, `docs/ops/smoke.md`.
- `docs/adr/0010-extension-surface.md`, amendments in ADR-0003 and ADR-0006, `docs/spec.md`, `docs/reviews/slice-{28,29,31}.md`, 6 handoffs of 2026-11-13, `PLAN.md`, `.claude/agent-memory/architect/MEMORY.md`.

## Commands to reproduce

- `git fetch origin claude/extension-requests slice/30-surface-label && git checkout claude/extension-requests`
- `npm ci && npm run lint && npm run typecheck && npm test`
- `git diff claude/extension-requests origin/slice/30-surface-label --stat`
- The agent types `architect`, `implementer`, `reviewer` load only after `register_repo_root`; until then use Opus subagents with the role files in `.claude/agents/`.
