# Review: slice 17 (smoke steps and test round 1)

Date: 2026-11-11. Branch `slice/17-test-round`, head b942e94, diff `a803637..b942e94`.

## Verdict: FAIL

4 steps of `docs/ops/test-round-1.md` make a tester report a false failure or block. Everything else checked holds: scope, safety rules, secrets, commands.

## Commands (worktree, run by the reviewer)

| Command                     | Result                                                   |
| --------------------------- | -------------------------------------------------------- |
| `rm -rf node_modules; npm ci` | exit 0                                                 |
| `npm run test`              | 68 files, 1883 tests passed, 0 failed                    |
| `npm run format:check`      | "All matched files use Prettier code style!"             |
| `npm run build -- --env dev` | "Built dev b942e94", Code.js 364.7 KB, index.html 379.2 KB |

Probe: `renderBody` and `renderSubject` on the T2 and T7 setup texts in a scratch copy (deleted after). Output: `Hi, load is ready.`, `Hi, load is ready.555` (phone set), `Hi Sam, load is ready.`, subject `Load`, `Hello`, `Hello Ana`.

## Scope

Changed: `docs/ops/smoke.md`, `docs/ops/test-round-1.md` (new), `test/unit/docs/links.test.ts` (one line in `DOCS`), the handoff, the implementer memory. Nothing under `src/`, `scripts/`, `docs/spec.md`, `docs/adr/`, `docs/guide/`.

## Must fix

1. test-round-1.md:142 (D11) "Expect: 4 rows" and :253 (I11) "one row" for "Admin added" and "Admin removed". The filter is "this month". The dev log for November already holds "Setting changed" rows from the slice 11 smoke and admin rows from the slice 16 smoke. Part I step 9 adds a denied `config.set` row (dispatch.ts:274 `recordDenied`), and a rerun of D or I adds more. Fix: count only rows with today's date after the part started, or note the row count before step 1 and expect that count plus 4 (D) or plus 1 (I).
2. test-round-1.md:145 (D14) leaves the folder "Import test" with copies of T1 to T8. Part D says it restores only the two settings (line 130). A second run of part D cannot pass step 14: "New top-level folder" `Import test` is refused (folders.ts:179 `uniqueSiblingName`), and an import into the existing folder skips every title (transfer/plan.ts header), so "0 skipped" fails. Fix: delete "Import test" at the end of step 14 and say so in the part intro.
3. test-round-1.md:201 (G4) reads "the drafts of steps 1 and 2". Rule 2 (line 8) and the part intro (line 194) make the agent discard every draft when its step ends, so the drafts are gone by step 4. Fix: in G, keep the drafts of steps 1 and 2 until step 4, then discard; name this exception in rule 2.
4. test-round-1.md:113 (C4) expects "Hi Sam, load is ready." T2 ends with "Sender phone", so with a directory phone the draft reads "Hi Sam, load is ready." followed by the phone (probe above). Fix: add "followed by your phone when the directory has one", as B2 does.

## Minor

1. test-round-1.md:47, setup T2: no space before "Sender phone"; the draft reads `ready.555`. Add a space after `is ready.`.
2. :183 (F3): the empty text shows only when the second account sees zero templates (home.ts `emptySection`). Earlier smoke runs gave it personal templates. Say "unless your own My templates holds templates".
3. :157 (E1): the add-on keeps the home view 600 s (addon/view.ts:17). A card cached during part B shows an old Recent. Start E with "Open library" and close it.
4. :137 (D6): after "Cancel" the radio still shows Off selected; the saved value is On. Say "Last change" stays at step 4.
5. :223 (H4) and smoke.md:158 (Slice 9 step 9): `draft` also carries `fields` (event.ts `draftInfo`). "counts and hasSubject only" invites a false fail.
6. Steps with no "Expect:": A10, B12, E3, E7, G1 to G7 (Record only); H2, H3, H7 (neither).
7. smoke.md:215 (Slice 15 step 3): a folder card shows no folder path (folder.ts `templateSections` passes ""). The label with the path shows under Favorites, Recent or search only.
8. :241 (Part I): "the owner types it" while the owner runs as the browser agent. Say the owner gives the address to the agent.
9. "your name" in D4, D5, I5, I11 is the address part before @ (admin/model.ts `namePart`). Say so once in "Before you start".
10. Part G quotes `s7-to@migway.com`, `s7-cc@`, `s7-bcc@`: harness constants (spikeS7.ts:19-21), test addresses of the own domain. Acceptable; the rest of the plan uses `<your domain>`.

## Steps checked against the code

All 51 steps of parts B (12), C (13), D (15) and I (11), plus 28 others: A1, A5, A6, A8, A9, A13, E1, E3, E4, E8, E9, E11, F2, F3, F9, F10; smoke Slice 9 steps 1, 3, 5, 6; Slice 12 step 8; Slice 15 steps 2, 3, 8, 11; Slice 16 steps 5, 6, 7. 79 in total, 4 wrong (must fix 1 counts D11 and I11 as one cause), 9 minor.

Verified rules:

- Row Insert: `rc` against the apply lists, then unknown draft fields push the details card (flows.ts:411-421). C9 matches: "(!) The recipients of this template changed. Check them and press Insert again.", second Insert adds.
- To only into an empty To, `present` and `blocked` reasons (cards/recipients.ts:61-84, REASONS). B6, B7, C2, D9 texts exact.
- Outside limited: row hint and `rc` from `splitBlocked` (sidebar.ts `countsOf`), so the row Insert drops `test-out@` silently (D9 record row is right).
- Switches: subject on for an empty draft subject (spec.ts `replacesSubject`), "Add recipients" only when Insert adds (details.ts:119). C1, C3, C6, C7 match.
- Use counting: tap uses `followUp: true`, the first card Insert counts, re-renders carry `counted=1` (flows.ts:479-525). Smoke 15 step 8 "rose by 1, not 2" holds.
- Personal templates off: library note text exact (library.ts:301).
- Admin refusals: "Only <domain> addresses can be admins.", "No <domain> account has this address. A group goes in the admin group the owner sets." (handlers/admins.ts:66, :96); a group address 404 maps to ADMIN_NO_ACCOUNT. Refusals are VALIDATION and write no audit row.
- Removed admin: settings Save uses `adminLineText`, "You are no longer an admin, so nothing was changed. Ask an admin if you need access." (status.ts:40). Own row has no Remove (adminAdmins.ts:108).
- Gmail cards for admins: other users' private folders stay out (sidebar.ts `visibleFolders`); smoke 15 step 11 now runs as the second account, correct.

## Runnable and safe

- Steps per part: A 13, B 12, C 13, D 15, E 11, F 10, G 7, H 11, I 11. All at most 15.
- Rules 1 to 7 cover own tabs, no email sent, no password, stop at sign in or consent, version first, report per step. No step sends a message. Apps Script editor and console only in part H; the file picker in D14 is marked; second-account steps are in F or marked in I.
- Every Record line has a row in its part's table.

## Secrets and personal data

Added lines: no key, token or secret (AIza, ya29., GOCSPX, client_secret, refresh_token, private key, ghp_, AKIA, xox, eyJ: 0 hits). Addresses: placeholders of `<your domain>`, `example.com`, `name@company.com` and the harness constants above. No real person. The second tester is `<second account>`. No dashes, no hours of service examples.
