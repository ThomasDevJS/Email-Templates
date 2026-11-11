# Review: slice 20b, add-on fix round

Verdict: PASS. 0 must-fix, 8 minors.

Branch `slice/20b-fix-addon`, head 496e4bf, base 16df87a (merge base with `claude/gracious-franklin-3n8zbq`). Reviewed 2026-11-11.

## Commands (worktree, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0, no findings |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 69 files, 1949 tests passed; all files 97.14 statements, 90.91 branches, 96.67 functions, 97.97 lines; addon 98.56 statements, 100 lines |
| `npm run build -- --env dev` | "Built dev 496e4bf", Code.js 369.8 KB of 800 KB, index.html 379.4 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `git diff --stat 16df87a..496e4bf -- src/server src/web src/shared/permissions src/shared/model appsscript.json package.json package-lock.json` | empty |

The 14 new tests (cardLimit 9, cards 1, panel 2, subject 2) fail on a base copy. They pass on head.

## Probes

One vitest probe on a `git archive` copy of head, real builders, `renderCard` on the recording Card Service, `setupWorld` server, recording Gmail fake. The base copy supplied `renderBody` for the body comparison.

### 1. Card size limit

- Matrix: top folders 0, 1, 40, 41, 200; favorites 0, 10, 20; recent 20; 100 subfolders; 45 templates in one folder (3 pages); entries compose, inbox, message; cards home, folder page 1, folder page 3, search. 180 cards, every one under 100 widgets. `renderCard` added exactly the counted widgets on every card.
- Worst list card: folder card, message entry, 84 widgets (Folders 41, page 40, pager 2, hint 1). Matches the claimed 84. Home worst 75, search 43, as claimed.
- Details cards, 25 fields, 20 added recipients, 1 blocked, 3 unreadable fields, a problem line: compose 51, panel inbox 50, panel message 52.
- Cut line texts: "Showing 40 of 200 folders. Use Search or Open library for the rest.", "Showing 40 of 100 folders. ...", "Showing 20 of 45 results. ...". Numbers true. The line is always the last widget of its section and follows whole rows (cardLimit test checks each Reply set sits under its item).
- Where the line sits: Folders collapse after 5 rows (`collapseAfter` 5 of 41 widgets). Favorites collapse after 10 widgets. The line shows only after the user opens the section (Gmail only).
- Reachability: only Folders can be cut in practice. The server already caps favorites 10, recent 5 and search 20 (sidebar.ts:36-38), so those 3 caps never fire. Templates in folder 41 and later are reachable by search (`folder:` word) and in the library. No template lost a path that existed before; before this slice a home card with 60 or more folders failed to render.

### 2. Reply-To with 2 addresses

- `mailboxesOf` on 12 headers: empty, blanks, `<>`, `,,,`, unclosed quote, escaped quote, group syntax, display name holding an address, garbage. No throw; quoted commas kept; the address inside `<>` wins.
- Reply with Reply-To `bob, z`: first name "Bob", template Cc bob and z dropped, Cc safety kept. Reply-To `z, bob`: first name falls back ("there"), both dropped.
- From counts as present only when Reply-To is blank. A reply goes to Reply-To, so a template Cc equal to From is added. That is correct for Reply; Reply all is Gmail only.
- Server log lines: 0 hits for 3 addresses across 7 runs.

### 3. "A reply adds n recipients."

| Case | Card label | Reply | Reply all | New email |
|---|---|---|---|---|
| Template To only | A reply adds 0 | 0 | 0 | 1 |
| Template Cc = sender | A reply adds 2 | 1 | 1 | 3 |
| Outside Cc, setting deny | A reply adds 1 | 1 | 1 | 2 |
| Switch off | A reply adds 1 | 0 | 0 | 0 |
| No recipients | no switch | 0 | 0 | 0 |
| New email, inbox | Adds 3 | | | 3 |

The label is true for the reply press in 4 of 5 reply cases. "Template Cc = sender" overcounts by 1 (minor 1). New email from a message adds the To. `REPLY_TO_LINE` says so.

### 4. Refusals

All 14 error codes through `panelAnswer(composeFlow)` with a raw server message holding an address and "Retry": 0 drafts. No thrown text holds the raw message or "Retry". NOT_CONFIGURED throws "Migway Templates is not set up yet. Ask your admin to finish setup." AUTH_NO_USER and AUTH_DOMAIN throw 3 sentences (minor 3).

### 5. Subject cut

- A stored 200-unit subject with `{{sender.name}}` renders to 200 units.
- `a`x199 + emoji: 199 units, no lone surrogate. Trailing space dropped (199).
- ZWJ family emoji across the cut keeps "man + ZWJ" (minor 2). The code claims surrogate pairs only.
- Every draft subject goes through `renderSubject` (flows.ts:426 `rendered`): row Insert, details Insert, New email. Reply passes no subject, so Gmail keeps "Re:". The web preview (preview.ts:62) uses the same function. The editor `maxlength` and the save check use `SUBJECT_MAX` (editor.ts:336, validate.ts:201).
- `renderBody` head vs base: 8 templates x 2 answer sets, 16 of 16 byte-identical. render.ts changed only `renderSubject`.

### 6. Skipped and left items

- 3.3: ADR-0004 lines 287 and 304 list rule 2 as ASCII and other punctuation as left alone. Claim holds.
- 3.6: smoke.md Slice 15 step 11 runs as the second account. Claim holds.
- 3.7: PLAN.md line 122 records the card closes (part B steps 1, 3). Claim holds.
- 4: `noMatchText` cuts by code point (home.ts:131-137). Claim holds.
- 3.8 `{{{ask:N}}{ask:M}}`: N blank puts `{{ask:M}}` in body and subject. N filled puts `{n{ask:M}}`. M is never asked. Template syntax reaches the draft, and a recipient sees it if the user sends without reading. Base output is identical, and the author must type the odd braces (minor 7).
- 3.9: spec.md:575 still names `replacesSubject(undefined, draftHasSubject)`. Architect.
- 5, shorter row hints: a proposal with no defect. Owner's choice.

### 7. Shared path, counting, scopes

Panel and compose both render through `rendered` and `applyNow` in flows.ts. flows.ts is unchanged. Use counting is unchanged. Protected paths are empty. 10 scopes.

### 8. Docs

- Quick start line 71 matches the folder cut text.
- test-round-1 part J step 9 expects "A reply adds 3 recipients." for T6. Step 10 of part D sets outside recipients back to allowed, so 3 is right.
- wording.md has 3 new rows matching src.

### 9. Secrets

Added lines hold 0 keys or tokens. Emails: `bob@example.com`, `someone@example.com` (tests). No URLs.

## Must-fix

None.

## Minors

1. recipients.ts:124 `addsLine` counts a template Cc that is already on the email. Probe: label 2, press adds 1. Fix: read the message headers in `detailsOf` for message entry, or word it "up to n".
2. subject.ts:31 `capSubject` can leave a trailing ZWJ or combining mark. Fix: drop a trailing U+200D or a mark (`\p{M}`) after the cut.
3. panel.ts:105 AUTH texts are 3 sentences, 199 characters, in Gmail's error bar. They were the same before this slice.
4. folder.ts `capped` on favorites, recent and results never fires: the server cuts first (sidebar.ts:36-38). Search over 20 results shows no line. Fix: let `search` return the total.
5. The cut line hides under a collapsed section (Folders after row 5). Needs a Gmail check.
6. spec.md:458 still says the panel shows "Adds n recipients."; the spec has no list caps. Architect.
7. Template syntax in the draft from `{{{ask:N}}{ask:M}}` (item 3.8). Recommend option (a): a save rule plus an ADR-0004 amendment.
8. event.ts `mailboxesOf("a@x b@y")` (no comma) returns only `b@y`. Malformed header, harmless.

## Gmail only

- Cut line under a collapsed section, and whether users find it.
- "A reply adds n recipients." width in the 300 px panel.
- NOT_CONFIGURED sentence in the error bar (part J step 11).
- Whether `createDraftReply` answers every Reply-To address or only the first. If only the first, a template Cc equal to the second Reply-To is dropped although the reply lacks it.
