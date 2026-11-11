# Review: slice 17 (smoke steps and test round 1)

Date: 2026-11-11. Branch `slice/17-test-round`, head b942e94, diff `a803637..b942e94`.

## Verdict: FAIL (first review); Retry 1: FAIL, 1 must-fix (D14, see "Retry 1" at the end)

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

## Retry 1

Head ce534ba, diff `2321180..ce534ba`. Verdict: FAIL, 1 must-fix.

Commands: `npm run test` passed 1883 tests in 68 files. `npm run format:check` is clean. Changed files: `docs/ops/test-round-1.md`, `docs/ops/smoke.md`, the handoff. Steps per part are unchanged (A 13, B 12, C 13, D 15, E 11, F 10, G 7, H 11, I 11).

### Must fix

1. test-round-1.md D14: the step makes "Import test" in "Folders and access", then picks it in "Export and import", "Import into". That list never shows the new folder. Cause: `adminView` loads `AdminData` once (admin.ts `load`), and `foldersTab` replaces only its own copy (adminFolders.ts `refresh`, `data = await app.api.adminFolders()`). The transfer tab builds its selects from the first copy (adminTransfer.ts:265). Dev harness probe: after "Created folder "Import test".", the "Import into" options were HR, Sales, Sales / Onboarding, Sales / Quotes, Support. The browser agent reports a failure or blocks. This was in the first version too and the first review missed it. Fix: after creating the folder, reload the page and open Admin, "Export and import" again. Next: one line in D14. A code fix is a separate slice.

### First review items

- Must 1 (D11, I11 counts): taken. Both parts note a start time; only rows after it count. The "User" column shows the address (adminAudit.ts:197 `person(entry.actor, true)`), so "your address in User" is right. The I9 denied row note is right (dispatch.ts:274, buffered until the tick).
- Must 2 (D14 cleanup): taken, apart from must-fix 1 above. The T8 copy goes to the trash first, then "R&D <b>", then "Import test". `checkEmpty` (folders.ts:266) ignores trashed templates, so both folders can be deleted. The texts "Delete...", "Delete" and "Deleted folder "Import test"." are exact (adminFolders.ts:204-214). `uniqueSiblingName` skips deleted folders (validate.ts:57), so a second run can create "Import test" again.
- Must 3 (G keeps drafts): taken in rule 2, the part G intro, G1, G2 and G4.
- Must 4 (C4 phone): taken.
- Minors 1 to 9: taken. The T2 text now has a space before the phone. F3 allows personal templates. E1 starts with "Open library". D6 says "Last change". H4 and smoke Slice 9 step 9 name `fields`. Expect lines were added to A10, B12, E3, E7, G1 to G7, H2, H3 and H7. Smoke Slice 15 step 3 has both labels. Part I says the owner gives the address. "Your name" is defined. Minor 10 needed no change.

### New D13 and D14

- D13: the "Folder" option reads "Smoke 6a / R&D <b>" (adminTransfer.ts `folderOptions`, " / " join). Expected text: "Exported 1 templates to migway-templates-r-d-b-<date>.json." `slug("R&D <b>")` gives `r-d-b` (admin/model.ts:108).
- D14: "Checked. Import would create 1 templates, 0 skipped, 0 failed." and "Imported 1 templates, 0 skipped, 0 failed." are exact prefixes of `importSummary`; " Folders: 1 new, 0 existing." follows. The library reloads after Import (adminTransfer.ts `app.reload()`).
- File picker blocked: the agent has already made "Import test" and stops. A second run then cannot make the folder (sibling names must be unique). Minor: tell the agent to delete "Import test" when it cannot pick the file.

### Other steps changed by the retry

C8, F8 (first name when the directory has one), E3 (`copies` search finds T3 and T4), E7, F intro, G1 to G7, H1 to H7, H11, I intro, I6 and I8 to I11 were read against the code and hold. Smoke Slice 9 step 9 matches `draftInfo` (event.ts). Smoke Slice 15 step 3 matches folder.ts `templateSections`.
