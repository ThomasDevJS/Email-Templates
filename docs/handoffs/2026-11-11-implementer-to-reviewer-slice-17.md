# Handoff: implementer to reviewer, slice 17 (smoke steps and test round 1)

Date: 2026-11-11. Branch `slice/17-test-round`, base `claude/gracious-franklin-3n8zbq` at 9773b75. Docs only. Not pushed, not merged.

## Done

- docs/ops/smoke.md: every section read against the code at 9773b75; steps rewritten to the slice 15 cards (details card, switches "Replace the subject" and "Add recipients", Recent without favorites, no search hint, slate footer).
- docs/ops/test-round-1.md (new): rules for a browser agent, "Before you start" (build version, accounts, dev state, 8 setup templates T1 to T8 and the subfolder `R&D <b>`), parts A to H, heading I for slice 16.
- test/unit/docs/links.test.ts: the new file added to `DOCS` (the task asked for it).

## Smoke sections (kept, rewritten, dropped)

| Section   | Kept | Rewritten | Dropped | Why                                                      |
| --------- | ---- | --------- | ------- | -------------------------------------------------------- |
| Slice 1   | 4    | 1         | 0       | "Signed in as" is screen reader text; short name visible |
| Slice 2   | 4    | 1         | 6       | console helper fails since slice 3 (request ID); 1 line  |
| Slice 3   | 8    | 2         | 0       | short name; folder via Admin                             |
| Slice 4   | 4    | 6         | 0       | preview and prompt cards gone; empty states              |
| Slice 4b  | 8    | 0         | 0       |                                                          |
| Slice 5   | 4    | 5         | 0       | switch replaces buttons; fields optional; Recent         |
| Slice 5b  | 5    | 1         | 0       | Recent                                                   |
| Slice 5c  | 2    | 2         | 0       | details card switch                                      |
| Slice 6a  | 8    | 2         | 0       | toolbar insert, empty state                              |
| Slice 6b  | 9    | 1         | 0       | toolbar insert                                           |
| Slice 8b  | 10   | 0         | 0       |                                                          |
| Slice 9   | 1    | 8         | 0       | "Review" gone                                            |
| Slice 11  | 9    | 1         | 0       | "Review" gone                                            |
| Slice 12  | 5    | 3         | 0       | hint, label order, footer color, details card            |
| Slice 15  | 12   | 1         | 0       | step 11: an admin cannot lose folder access              |
| Spike S7  | 8    | 0         | 0       |                                                          |

## Test plan parts

A web editor 13, B one click insert 12, C details card 13, D admin settings 15, E card look 11, F second account 10, G spike S7 7 (old step 1 moved to H), H by hand 10, I placeholder.

## Verified and how

- Quote check: a script extracts every double-quoted text and searches `src/` (TS escapes undone, spaces collapsed). smoke.md: 460 quotes, 325 found, 135 not found literally. test-round-1.md: 468 quotes, 311 found, 157 not found literally. Every not-found quote was read by hand: user data (titles, folders, addresses, rendered text), texts built from parts (`rowHint`, `addsLine`, `REASONS`, `(!) ` + problem, `shortenText`, `settingTexts`, `importSummary`, `exportFileName`, `addressProblem`, `Version` + `APP_VERSION`), or Gmail and Google texts ("Discard draft", "Re:", "Fwd:", "Show more", "Executions").
- `npm ci`: clean. `npm run test`: 67 files, 1826 tests passed. `npm run format:check`: clean.

## Left for later

- Part I (in-app admins) when slice 16 is on dev.
- The image addresses for part A step 10 come from the owner.

## Risks

- Outside recipients set to "<domain> only" with a fresh list: row Insert skips the outside address with no line on screen (the row hint already omits it). Matches the setting text "Insert skips the address"; worth an owner look.
- Row Insert into a draft with a To skips the template To silently (D26 design, no notification possible).
- A browser agent may not pick a file (part D step 14) or follow "Edit in library" into a new window (part C step 13); both steps say what to do.

## Files touched

docs/ops/smoke.md, docs/ops/test-round-1.md (new), test/unit/docs/links.test.ts, this handoff, .claude/agent-memory/implementer/MEMORY.md.

## Commands

`npm ci`, `npm run test`, `npm run format:check`, `python3 <scratchpad>/s17/quotes.py <worktree> <doc>`.
