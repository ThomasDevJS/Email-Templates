# Handoff: architect to orchestrator, extension requests SR1 to SR4, SF2

Date: 2026-11-13. Branch `claude/extension-requests` from c0564bc. Status of every decision: Proposed.

## Done

All 6 requests reviewed against the server rules; none accepted unchanged. Mechanism in `docs/adr/0010-extension-surface.md`, contract in spec 5.11, slices in spec 13.12, questions Q98 to Q104.

| Request | Verdict | Changed how | Why |
|---|---|---|---|
| SR1 dev `/exec` | Accept with changes | One hand-made versioned deployment; `deploy/dev.json` unchanged; URL never in a file | Switching dev to mode `version` breaks the add-on's `/dev` URL; HEAD deployment cannot serve a version |
| SR2 content type | Accept with changes | Media type check before `JSON.parse`, charset ignored; body cap 262,144 bytes; no audit row; no nonce | A row would blame the CSRF victim; nonce only if owner test 1 fails |
| SR3 label | Accept with changes | Body field `client`; policy reads a new `entry` (`doPost`, `rpc`); `web` rows run on `rpc` only | `dispatch.ts:157` refuses `web` only for `addon`: a widened `Surface` would open every `web` op |
| SR4a `extension.sync` | Accept with changes | Shared `visibleLibrary`; `checkArgs` before the index load; bodies only from the call's visible set; `page` arg; 3 budgets to measure; `rules` hash with CRLF to LF; `skip` has no server effect | Default deny between pages; no Drive work on bad args |
| SR4a addresses | Accept, owner to confirm (D42, Q98) | `to`, `cc`, `bcc`, `blocked` in the list; add-on keeps counts | Same addresses a `use` holder sees on cards; persistence bounded by the 7-day wipe |
| SR4b `at` | Accept with changes | `ts` stays server time; `at` only in `after.claimed.at` of a refused row | `at` as `ts` moves usage days and puts audit rows in another month file |
| SR4b `applyId`, `recorded` | Accept with changes | One `ap:<sha256(caller)>` key holding the last 100 IDs, checked and written inside the buffer lock | 600 per-ID keys would crowd a 1,000-item FIFO cache; per-ID keys do not bind the caller |
| SR4b refused row | Accept with changes | Template row replaces the folder row for DENIED; NOT_FOUND row only for an item in the index; claims under `claimed` | Any-ID NOT_FOUND rows would be a new noise source |
| SF2 report | Accept with changes | No code. Owner reads `IMG_HOSTS` on dev; empty closes it; set: Export library and search the file | Every read path sanitizes again; the bypass needs `IMG_HOSTS` set |

## Verified (how)

- Read at c0564bc: `entry.ts:99-120`, `dispatch/dispatch.ts:90-176`, `dispatch/policy.ts`, `dispatch/targets.ts:15-17`, `handlers/sidebar.ts:55-140, 252-282`, `handlers/body.ts:62, 90-100, 164-172`, `handlers/transfer.ts:254`, `audit/buffer.ts:76-107`, `audit/usage.ts`, `audit/lines.ts:7-8, 47-52`, `jobs/tick.ts:72-103`, `jobs/triggers.ts`, `addon/client/serverClient.ts:75-81`, `appsscript.json`, `scripts/build.mjs`, `scripts/deploy.mjs`, `deploy/dev.json`.
- Apply events reach `usage.json` only; denied events reach the audit log (`tick.ts:80-95`).
- Not run: no dev call, no build. `postData.type` for the add-on's UrlFetch and ContentService's output limit are unverified; slice 29's dev smoke and slice 34 settle them.

## Left

- Owner: Q98 (D42), Q100 (`IMG_HOSTS` on dev), Q101, Q103; accept Q99, Q102, Q104. SR1 steps (ADR-0010 Decision 7).
- Orchestrator: record D42 in PLAN once confirmed; launch 29 and 31 in parallel; send the extension session spec 5.11 (shapes changed: `page` arg, `after.claimed`, no `insertedFromCopy`, `at` not used for usage).
- Slice order: 29 and 31; then 30; then 32 and 33a; then 33b; then 34 (measurements). No slice changes scopes.

## Risks

- Slice 29 refuses every add-on call if Apps Script reports another `postData.type`; the dev smoke before prod is the guard.
- The extension test deployment lags dev until the owner redeploys it (Q101).
- `bd:*` misses kept by a cold sync can push index chunks out of the 1,000-item cache; slice 34 counts rebuilds.
- `deploy/dev.json` holds the dev script ID and `/dev` URL in a repository PLAN lists as public. They are identifiers, not keys (domain sign-in and editor access gate them); the owner may still want the repo private.

## Files touched

- `docs/adr/0010-extension-surface.md` (new)
- `docs/adr/0003-identity-and-permissions.md`, `docs/adr/0006-template-recipients.md` (Amendment 2026-11-13)
- `docs/spec.md` (status line, 5.7, 5.11 new, 6, 11, 13, 13.12 new, 15)
- this file; `.claude/agent-memory/architect/MEMORY.md`

## Commands to reproduce

- `git diff c0564bc -- docs .claude/agent-memory/architect`
- `grep -n "5.11\|13.12\|Q98\|Q104" docs/spec.md`
