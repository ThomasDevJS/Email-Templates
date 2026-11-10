# Handoff: implementer to reviewer, slice 7 (docs for v1)

Branch `slice/07-docs`, base fb97d9a. 5 commits. No change in src/, scripts/ or config. PLAN.md untouched (D25 is the orchestrator's to record).

## Done

| File | Covers |
|---|---|
| docs/guide/user-quick-start.md | Gmail user, about 1,090 words: click into the body first, insert, fill fields, subject rule D24 in user words, search with `folder:` and `tag:`, Favorites and Recent, "My templates" and a new personal template, the 5 placeholders and "Ask the user...", what admins see (D18), known limits, messages and who to ask |
| docs/guide/editor-guide.md | Library parts, row menu (Edit, Duplicate, Move..., History, Delete...), editor fields, toolbar, placeholders and fallbacks with text forms, Subject field, save and "This template changed", history and restore, Trash, 100 KB cap and the sanitizer rules, sign-offs and the Gmail signature (ADR-0004) |
| docs/guide/admin-guide.md | Part 1: roles and levels with the ADR-0003 matrix, grants (group, user, domain, OU), direct members only (D7), OU inactive (D17), Memberships, Audit log, Usage, Export and import with what export leaves out and the import limits, Config and job health, backups with both dialog risks, Trash and "Empty trash now". Part 2: domain install in 15 steps starting with the dedicated owner account (D25), 10 scopes with reasons, unknown and undecided table |
| docs/ops/runbook.md | Ownership (D25: dedicated owner account for prod, dev stays, prod starts empty), staff change, fallback options B2, C and interim (not built, not yet exercised), deploy and rollback by reference to deploy.md, triggers and "late", quotas and QUOTA, logs and field table, restore, damaged index.json recovery, version pruning, speed and D23, "when something breaks" table (12 rows), empty "Rollback exercise" record |
| README.md | "Documentation" section with 8 links; Lighthouse line now 10 views; dev routes add `#/trash`, `#/admin`, `#/admin/<tab>`; `?admin=0` |
| test/unit/docs/links.test.ts | Every relative link in the 5 files resolves to a path in the repo; 1 extraction test plus 5 file tests |

Owner decision D25 (coordinator message, 2026-11-10) applied: dedicated owner account `templates-owner@migway.com` as the generic example, Q26 and Q30 marked decided in the admin guide table.

## Verified and how

- UI texts quoted from src/addon/cards and src/web at fb97d9a (grep of each string). Limits from src/shared/model/validate.ts, sanitize/policy.ts, addon/prompts.ts, addon/view.ts (600 s view cache), handlers/config.ts (late = 2 intervals).
- Commands, real output:
  - `npm run lint`: exit 0, no output after the header.
  - `npm run typecheck`: exit 0.
  - `npm run test`: Test Files 52 passed (52), Tests 1244 passed (1244).
  - `npm run format:check`: "All matched files use Prettier code style!"
- Secret scan by reading: no token, no script or deployment ID, no real person's name. Addresses are generic (`name@migway.com`, `sales-team@migway.com`, `templates-owner@migway.com`).

## Statements marked unverified

- Quick start: closing the window of "Open library" or "Edit in library" reloads the panel, "Not yet verified in Gmail". Gmail Android and iOS untested.
- Editor guide: the Trash view is not yet verified.
- Admin guide, "not yet verified on dev": child-group warning row; Audit log; Usage; Export and import; a file close to 5 MB; Config and job health; Backups and restore; Trash and "Empty trash now". Slice 6b was not deployed at fb97d9a; 6a smoke steps after prompt 1 are open.
- Admin guide Part 2: every step "not yet exercised". Step 5 (Drive API and Admin SDK API on a standard project) marked unknown.
- Runbook: B2 "not built, not yet exercised"; option C and interim steps "not yet exercised"; restore "not yet verified on dev"; damaged index.json recovery "not yet exercised", and Upload new version keeping the file ID unverified; rollback exercise record empty.

## Product defects and doc-versus-code mismatches

1. Spec 7 NOT_CONFIGURED sidebar text "Ask the owner to finish setup." differs from code: "Migway Templates is not set up yet." plus "The owner runs setup once and deploys; then reopen the sidebar." (src/addon/cards/states.ts).
2. Spec 7 AUTH_NO_USER text differs from code ("Apps Script does not support several signed-in Google accounts. Use a separate Chrome profile for Migway, or an incognito window with only your Migway account.").
3. Spec 7 TIMEOUT/SERVER sidebar text "Something went wrong. Retry." differs: code shows "Something went wrong." with a Retry button and a "Request ID" line.
4. Spec 8 and 12 name 4 Lighthouse views; scripts/lighthouse.mjs audits 10. README fixed; spec is the architect's.
5. `ErrorCode.NOT_IMPLEMENTED` and its web text "This action arrives in a later release." remain, used only by the dev harness. Spec 6 says the not-implemented answer is removed. Probably dead code.
6. ADR-0004 says "Refresh memberships now" also clears profiles. `membership.refresh` does not clear `prof:*`; directory changes still show within the 6 h cache.
7. Wireframe 06 uses first-name example addresses (2 of them); the docs here avoid them.

## Left for later

- Spec 13.5 slice 7 item: smoke step with a 4.9 MB import file in docs/ops/smoke.md. Not in this task's list; not written.
- Rollback exercise: owner runs it, orchestrator fills the record in runbook.md.
- PLAN.md: D25, Q26 and Q30 closed (orchestrator).
- Spec and ADR text still describe the prod owner as open (Q26) and dev-to-prod import (ADR-0005 2.5b step 5): architect errata.

## Risks

- The guides describe 6b screens from the source only. A deploy may show layout or wording differences the smoke run finds.
- Admin guide step order for 2.5b rests on ADR-0005 and R4 research, not on a run.

## Files touched

README.md, docs/guide/user-quick-start.md, docs/guide/editor-guide.md, docs/guide/admin-guide.md, docs/ops/runbook.md, test/unit/docs/links.test.ts, this handoff, .claude/agent-memory/implementer/MEMORY.md.

## Commands

```
git checkout slice/07-docs
npm ci
npm run lint && npm run typecheck && npm run test && npm run format:check
npx vitest run test/unit/docs
```

## Retry 1 (after docs/reviews/slice-07.md, d1e2ca7)

| Item | Change |
|---|---|
| Must fix 1 | runbook.md "Staff change": the Workspace admin resets password and 2-step verification; the new holder sets a new password and enrolls their own second factor; nobody passes a password or code by chat, mail or paper. Same advice added under admin-guide.md install step 1 |
| Must fix 2 | user-quick-start.md "What admins can see": each insert writes a server log entry with the user's address, template ID and time; the app keeps each person's last 20 inserted templates for Recent (`RECENT_MAX`, src/server/audit/usage.ts:4); message text, recipients and typed values are not stored |
| Claim 1 | Recent: "can take up to about 15 minutes" (tick 5 min plus panel cache 10 min) |
| Claim 2 | Forward case: "Not yet verified in Gmail"; removed from the "kept" bullet |
| Claim 3 | editor-guide.md columns add "By" (grid.ts:21) |
| Claim 4 | runbook.md QUOTA: web app Retry disabled 60 s; Gmail panel Retry clickable, answers "Service is busy. Try again in N s." (addon/entry.ts:58) |
| Claim 5 | editor-guide.md Image: every inserted image gets width 600, a smaller one is stretched |
| Claim 6 | admin-guide.md scope table: `drive.file` used by web app, triggers and the add-on token, with the front door reason; other 9 rows rechecked against spec 9, unchanged |
| Claim 7 | Quick start cut from 1,087 to 844 words: placeholder table moved to a link to the editor guide; D18, subject rule and known limits kept. Added "More options" for a narrow compose window |
| Claim 8 | admin-guide.md Part 2 new step 7: push the code first (deploy.md step 5); step 8 deploys again so the add-on carries `execUrl` (deploy.md step 7). Steps now 16, all not yet exercised |

Product defect for the UI pass: src/web/views/editor.ts:236 sets `width: "600"` on every inserted image while the dialog hint reads "Width is set to 600 pixels or less". Small images are stretched. Fix the code (cap, do not set) or the hint.

Left for later (architect): link test checks file paths only, no anchors (review claim 9); spec 7, 8, 12 and ADR-0004 mismatches listed above.

Commands after retry: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm run test` 52 files, 1244 tests passed; `npm run format:check` "All matched files use Prettier code style!".
