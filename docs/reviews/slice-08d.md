# Review: slice 8d (web minors from 8a and 8c)

Verdict: PASS

Branch `slice/08d-web-minors`, base 5f83683, head 0cc49c8 (7 commits). Reviewer: reviewer agent, 2026-11-11.

All 12 items work in Chromium at 1440 and 390, light and dark. Three minors remain: 2 predate 8d, 1 is a plural in a changed text. None blocks.

## Commands (clean install, worktree)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages added, 16 audit findings (14 moderate, 2 high, unchanged) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 60 files, 1350 passed, 0 failed; all files lines 96.55, branches 89.15 |
| `npm run build -- --env dev` | Code.js 335.7 KB of 800, index.html 355.1 KB of 400 |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 100 on all 12 runs (library dark, admin audit dark included) |

## Scope, secrets, network

- `git diff --stat 5f83683..HEAD` on src/server, src/addon, src/shared, appsscript.json, scripts, the editor view and its tests: empty.
- No package change. No test deleted; 1 renamed (audit actor), 8 added.
- Secret scan of the diff: no key, token, client secret or real address. Only example.com addresses.
- Playwright request log: no request outside 127.0.0.1 from the page.

## Items

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | 13 dialogs probed (library Delete, Move; Empty trash; history Restore; New top-level folder; folder New subfolder, Rename, Move, Delete; config Restore backup; audit drawer by Esc and by backdrop). Each: focus starts inside, 24 Tab and Shift+Tab presses never leave, svg, skip link, `.shell` and script get `inert` and `aria-hidden`, `#toasts` stays live (an injected `role=alert` toast appears in the ARIA snapshot, the shell does not). Esc returns focus to the opener and leaves no `inert` behind. Failed create (BUSY) and an empty-name validation also leave nothing inert. |
| 2 | Pass | Next and Previous by keyboard focus the first `TR`, ring visible; status (`role=status`, polite) reads "Page 2: events 51 to 60 of 60." Import focus on the report table: unit test, code read (adminTransfer.ts:237-239). |
| 3 | Pass | Audit actor shows "dev.user@example.com" under the name. Library and trash By, history rows: sr-only " (address)" in the accessible name. |
| 4 | Pass | Hint ends "A whole-library export leaves out the private folders (each user's My templates)." |
| 5 | Pass | Button "Empty trash now...", title and confirm "Empty trash", busy "Emptying the trash...", result "Emptied the trash: ...". Reload failure path: "Emptied the trash. The list could not be refreshed." (admin.test). |
| 6 | Pass | Settings, Jobs, Backups all 276..1036 px at 1440; values start at 486 px in both Settings and Jobs. |
| 7 | Pass | Sales / Quotes at 390: tops 470, 470, 510, 510, each 175 px wide. Private folder: Rename alone (only action it has). |
| 8 | Pass | Drawer: Target "Sales / Quotes"; "Technical details" with Operation `template.update` and Target `/Sales/Quotes`. |
| 9 | Pass | Chromium AX tree at 390: 1 table, 6 column headers, cells "Nov 9, 2:03 PM" (base: "Time Nov 9, 2:03 PM"). Header association kept, label heard once. |
| 10 | Pass | src/server never throws NOT_IMPLEMENTED: dispatch.ts:222-225 answers UNKNOWN_OP for no policy row and INTERNAL for no handler; transfer.ts:381 rethrows existing codes only. Only dev-harness.ts:1019 sends it. |
| 11 | Pass | Ring 2 px slate (dark: light slate), offset -2 px, on the active item: history selected option (list outline none), sidebar and admin tree item, grid cell, audit row; 1440 and 390, light and dark. Tree is flat, so a ring on an expanded item covers one row. Empty library folder (HR) renders no grid, so no invisible stop. |
| 12 | Pass | Busy "Verbing...", results "Verbed ...", period. Handoff text list matches every changed string literal in the diff. |

Regressions of earlier fixes: 390 panel keeps Tab inside (15 presses), Esc returns focus to Menu, outside press closes, widening to 1000 px clears `inert`. Star and field border tokens unchanged; contrast.test passes.

## Minors (next round)

1. Backdrop press closes a dialog and focus lands on BODY (dialog.ts:128-130). Cause: the mousedown default runs after `close()` focused the opener. Fix: `event.preventDefault()` in that listener. Base 5f83683 behaves the same.
2. Browser Back or Forward leaves an open dialog over the new route; the Empty trash confirm stays active over the library. After Esc focus lands on BODY because the opener is gone. Cause: `render` in app.ts never closes dialogs. Base behaves the same; `inert` clears correctly on close.
3. trash.ts:128 says "All 1 templates in it are removed" for one template. The `plural` helper in admin/actions.ts covers this.

Left as the handoff states: Empty trash split still comes from the list (server reply lacks the template count); export progress text untested.
