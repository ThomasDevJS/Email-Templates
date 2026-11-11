# Handoff: implementer to reviewer, slice 21 (card feedback, D35)

Branch `slice/21-card-feedback`, cut from `claude/gracious-franklin-3n8zbq` at a807c54. No push, merge or deploy.

## Done

| Item | Result | Test | Commit |
|---|---|---|---|
| 4, freeze first | snapshot of widget kinds and texts of home, folder, search, no-match (3 entries), 3 details cards, 8 state cards, written on a807c54 | cardLook.test.ts (5) | 5de6f7f |
| 1, spinner | `toAction` in src/addon/cards/render.ts, the one action builder, sets `CardService.LoadIndicator.SPINNER` on click, change (search) and compose actions; `NONE` on `onBack` (pops a card, no call) and `onOpenLink` (opens the library window, no server or Gmail call) | cardFeedback "every action of every card kind ..." | c5bcc2e |
| 2, slate | `primaryColor` "#2a3c49" in appsscript.json; filled buttons were already slate through `toButton` (grep: no other FILLED or `setBackgroundColor` in src/addon) | scopes.test "slate toolbar and button colors"; cardFeedback "every filled button ..." | ed2080d |
| 3, red | Widget text `tone: "error"`; render.ts wraps the escaped text in `<font color="#b32025">` | cardFeedback "red for errors only" (2) | 923a2cb |
| 5, docs | test-round-1.md part K, 5 steps | none | db7db33 |

Details:

- Compose actions: `setComposeAction(action, type)` takes the same `Action` object, and `Action.setLoadIndicator` has no documented restriction. So the spinner is set the same way. Whether Gmail shows it for a compose action is unconfirmed (part K step 3).
- Red lines: the details card "(!) ..." line (recipients changed, template changed, "Shorten to 500 characters: ..."), and the first sentence of every state card: "Cannot identify your Migway account.", "Migway Templates is not set up yet.", the DENIED and NOT_FOUND sentences, the two busy sentences, "Something went wrong. Press Retry.". Not red: the follow-up lines (what to do, "Request ID ...", "Details for your admin: ..."). Left uncolored because Gmail shows them as plain text: labels, notifications, raised side-panel errors. Also uncolored: the "could not be read ... Add by hand" recipient line and the "Not added" lines, which inform and do not block.
- State card Retry, Refresh and Back have no style (Gmail default, not filled), as before (D34). They do not need slate.
- No text changed, so wording.md is unchanged. The cardLook snapshot passes unchanged after all commits.

## Left

- Dark theme: `<font color="#b32025">` on Gmail's dark background has unknown contrast (design system dark red is #f0958f). Part K step 5 decides. If it is unreadable, options: drop the color, or use a mid red that reads on both.
- `primaryColor` may not show in Gmail's current toolbar (research Q-R5-3). Part K steps 2 and 3 record it.

## Risks

- A spinner on `onSearch` (a TextInput change action) shows on each search, which is intended. A Gmail that ignores the indicator shows nothing new; no behavior depends on it.

## Files

src/addon/cards/{render,spec,details,states}.ts, appsscript.json (1 key), test/fakes/output.ts (LoadIndicator enum), test/unit/addon/{cardLook,cardFeedback}.test.ts, test/unit/addon/__snapshots__/cardLook.test.ts.snap, test/unit/scripts/scopes.test.ts, docs/ops/test-round-1.md (part K). `git diff --stat a807c54 -- src/server src/web src/shared` is empty.

## Commands (clean install, head db7db33)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | 559 packages, exit 0 |
| `npm run lint`, `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 71 files, 1958 tests passed; all files 97.14 statements, 90.93 branches |
| `npm run build -- --env dev` | "Built dev db7db33", Code.js 370.4 KB of 800 KB, index.html 379.4 KB; dist/appsscript.json has `primaryColor` |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
