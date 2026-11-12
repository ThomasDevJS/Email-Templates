# Handoff: architect to orchestrator, errata run 6

Date: 2026-11-12. Branch `architect/errata-6` from `claude/gracious-franklin-3n8zbq` at 8e82a07. Commits 1458d3d (spec), 2d93595 (ADRs), 2ca59cc (wireframes), plus this commit (handoff, memory). Not pushed, not merged.

## Files changed (lines added, removed)

| File | + | - | What |
|---|---|---|---|
| docs/spec.md | 62 | 32 | status line; 4.1a step 7 (Q75); 4.3 screen words; 4.4 Search button and double run; 4.5 `run` and the one lock; 5 ID random part; 6 export `run` args, Admin folder list; 7 NOT_CONFIGURED web text, state card look; 7.1 change line without "(!)", finish-typing plain; 7.2 "A reply adds n recipients.", NOT_CONFIGURED and AUTH sentences, Gmail error card; Loading states (spinner, first paint, banner); 7.3 "its access"; 7.4 search row, `primaryColor`, new block "Look and list caps"; 8 icons, slice 23 tree; 9 fresh consent and per-scope checkboxes; 13 rows 20a to 23; 14 S6, S7, 14.1 step 7; 15 Q55, Q75 closed, Q78 to Q84 |
| docs/adr/0004-placeholders-and-html-safety.md | 45 | 1 | Amendment 2026-11-12, braces that join around a field: 3 options, exact rule, 7 examples, files to touch. Proposed |
| docs/adr/0009-compose-card-one-click.md | 51 | 5 | Amendment 2026-11-12 (D34, D35, D36): caps, spinner, colors, hint and error lines, Search button; markers on line 22 and the "(!)" line 92. Accepted on D34 to D36 |
| docs/adr/0007-side-panel-insert.md | 15 | 5 | Amendment 2026-11-12: Q75 error card, Q55 consent, slice 20b panel texts. Accepted (owner left the card as is) |
| docs/adr/0006-template-recipients.md | 2 | 2 | Q55 markers |
| docs/adr/0002-storage.md | 2 | 1 | `exps:<run>` cache row, marker on the retry limit |
| docs/wireframes/01-sidebar-home.txt | 26 | 13 | Search button, cut line, hint look, spinner, Gmail error card |
| docs/wireframes/02-sidebar-prompt.txt | 28 | 20 | (i) hints, (x) error lines without "(!)", finish-typing plain, "A reply adds 1 recipient." |
| docs/wireframes/03-web-library.txt | 6 | 0 | first load, slice 23 tree |
| docs/wireframes/06-web-admin.txt | 7 | 3 | "its access", one folder list |
| docs/wireframes/07-states.txt | 25 | 8 | error line look, NOT_CONFIGURED web and panel, E2 first load banner |

## Leftovers closed

- a. "(!)" quotes: spec 7.1 and 7.4 Flow B, ADR-0009 line 92 (marker), wireframe 02 lines 49, 51, 53. Remaining "(!)" mentions describe its removal.
- b. "grants": spec 7.3 and wireframe 06 quote "Admins manage every shared folder, its access, settings, imports and backups." (`adminAdmins.ts:185`). Spec 4.3 uses "Give access", "Who has access".
- c. Spec 4.5 and 6 carry `run` (`transfer.ts` `startExport`, `exps:<run>`, 60 s, one lock).
- d. ADR-0004 Amendment 2026-11-12, Proposed, not Accepted.
- e. Q79 (double search), Q80 (`toIcon`), Q81 (toast before `setup()`).

## Questions

- Closed: Q55 (fresh consent, owner 2026-11-11), Q75 (Gmail error card, accepted as is).
- Opened: Q78 brace save rule (option 1); Q79 double search (accept); Q80 `toIcon` try/catch (fix in next add-on slice); Q81 toast before setup (accept); Q82 per-scope consent checkboxes (admin install for everyone, one quick-start line); Q83 error icon is the only cue without "(!)" (part L step 3 decides); Q84 "A reply adds n" can count a Cc already on the email (accept).

## Not verified

- The 7 examples of the ADR-0004 rule were derived by reading `TOKEN_PATTERN`, `parseText`, `textRuns` and `leftoverProblems`; no code was run.
- Whether Gmail draws the `error` icon (Q83). The owner's facts name the readable red and grey lines, not the icon.
- Which scope each of the 9 consent lines named.
- Slice 23 text comes from `slice/23-tree-collapse` at a26e7f3, review retry 1 pending; spec 8 and wireframe 03 mark it in review.
- Owner's measured top bar #2A3B48 versus manifest #2a3c49: recorded as measured, cause not checked.
- Guides (docs/guide) still lack the Q82 quick-start line and the ADR-0004 editor-guide line: outside this run's paths.
