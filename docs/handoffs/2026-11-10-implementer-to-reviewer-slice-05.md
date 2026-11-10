# Handoff: implementer to reviewer, slice 5 (subject, search, Favorites, Recent, S4 harness removal)

Branch `slice/05-search-subject`, based on 36cd3df (`claude/gracious-franklin-3n8zbq`). 7 commits plus this handoff, not merged, not pushed:

| Commit | Content |
|---|---|
| dcbb182 | Remove the spike S4 harness (AC 8) |
| 34808a0 | Subject on the server: validation, version files, history, duplicate, apply, getBody; Q24 (AC 1, 9) |
| 1ab1ee0 | Subject in the sidebar: preview card, Insert body only, prompt card switch, `insertReply` (AC 1, 2) |
| 23fcd46 | Server `search`, `search.body`, `favorite.set`, `favorite.unset`, Favorites and Recent lists, side caches (AC 3 to 5, 7, 10) |
| 44ea075 | Sidebar Search, Favorites, Recent sections, results card, `onSearch` (AC 3 to 5) |
| f301841 | Web app: subject field, history line, stars, Favorites filter, ranked search, body matches (AC 1, 4, 6) |
| 7c6a492 | docs/ops/smoke.md "Slice 5", docs/ops/deploy.md trigger and cache notes (AC 12) |

## Done, per acceptance criterion

1. Subject. `Item.subject` (trimmed, 0 to 200), `BodyFile.subject`. Rules in src/shared/placeholders/subject.ts (`SUBJECT_MAX`, `controlIndex`, `oneLine`) and src/shared/placeholders/validate.ts: `scanBody(html, attrTokens, subject)` scans the subject first as one text run, adds `SUBJ_TOO_LONG` (offset 200), `SUBJ_LINEBREAK` (offset of the first control character: C0, DEL, U+2028, U+2029) and the PH_* codes; subject problems and warnings carry `field: "subject"`. Prompts and placeholders are the union, subject first; `PH_TOO_MANY` counts both. `prepareBody(raw, options, subject)` runs on create, update, duplicate (source subject) and restore (version K's subject). Message changed from "n placeholder problems" to "n problems to fix". `renderSubject` in render.ts: values plain, never escaped, control characters to one space, collapsed, trimmed. `template.apply` returns `subject` with `html` (null under the same `knownVersion` rule); `template.getBody` and `version.get` return it. The add-on caches it in `body:<id>`; cache entries without `subject` miss and refetch. Editor: input "Subject" under Title, `maxlength` 200, counter "n/200 (optional)" (`aria-describedby`), Placeholder menu inserts token text at the caret while the subject was the last focused field, "Preview as me" shows "Subject: ...", server problems read "Subject: ...". History shows "Subject:" with chips. Preview card: "Subject" item, "Replaces the draft subject.", Insert and "Insert body only" (`subject: "skip"`). Prompt card: "Replace the subject" switch (`subj`, on by default, `SwitchControl` on a DecoratedText) with the subject preview below; off sends no subject action. One-click Insert sets it. Logging: no log line carries the subject (test greps `world.lines`).
2. One response. `insertReply(html, subject)` in src/addon/cards/spec.ts is the pure builder: `subject: null` when the rendered subject is "" (no subject, opted out, or Insert body only). src/addon/cards/render.ts builds one `UpdateDraftActionResponseBuilder` with `setUpdateDraftBodyAction` and, when not null, `setUpdateDraftSubjectAction(newUpdateDraftSubjectAction().addUpdateSubject(subject))`. Tests: render.test.ts (call order), flows.test.ts (6 subject flows), addon.test.ts (entry point). No OAuth scope added. Spike S5: **unverified**, needs Gmail; it is step 1 of smoke "Slice 5".
3. Sidebar search. Op `search` (src/server/handlers/sidebar.ts): the same visible set as `sidebar.home` (other users' private folders hidden, admins included), ranked by src/shared/search/match.ts, top 20 as `SidebarTemplate`. Folder text is the visible path only (a hidden ancestor's name never matches). Body text in the sidebar is the 140-character snippet (shortcut comment in code). Empty query returns `[]`; the add-on shows Home without a call. Matching: token prefix, case and accents folded, weights title 3, subject 2, tags 2, folder 2, body 1, one typo at half weight for terms of 5 or more, `folder:` and `tag:` by token prefix, every term must match; ties by the caller's Recent position, then title. Query cut at 200 characters.
4. Favorites. `favorite.set` puts the ID first, `favorite.unset` removes it; both read and write `favorites.json` under the script lock (`setFavorite` in src/server/handlers/favorites.ts). `set` of a deleted template is NOT_FOUND; `unset` of one works. Every read filters to the caller's visible IDs (`callerLists`), so a template the caller lost is never returned. Sidebar section max 10 with the empty text of spec 7; library star (button `aria-pressed`, label "Add to favorites: <title>" or "Remove from favorites: <title>", Enter or Space on the star cell, click) and a "★ Favorites" filter button (`aria-pressed`). `template.list` returns `favorites` and `recent`.
5. Recent. `usage.json` `recent[email]`, filtered by visible IDs, sidebar max 5, hidden when empty.
6. Web app search: `searchItems` in src/web/library/model.ts (title, subject, folder path, tags, operators, ranked, ties by Recent). `search.body` after 300 ms without typing, only for queries with words; results not already listed show under "Matches in text" (second grid). Server: `ft:<bodyFileId>` Script Cache entries written at save, read with one `getAll`, at most 25 Drive reads per call on misses, the rest reported as `skipped` ("N templates were not searched yet."). "/" still focuses the box (existing test). `performance.measure` entries `library.list` and `library.body` for spec 12.
7. `search`, `search.body`, `favorite.set`, `favorite.unset` left `LATER_SLICE_OPS`; policy rows were already in place (list ops `template.read`; favorites `favorite` with `itemFolder`). Role tests in test/unit/server/search.test.ts: no grant DENIED on both surfaces, use, edit, manage, admin ok; outside domain AUTH_DOMAIN with 0 Drive calls; unknown ID NOT_FOUND with 0 Drive calls; list ops empty without a grant. Dispatch authorizes before the handler reads favorites, usage or `ft:*`.
8. Harness removed: `spike.s4` op and policy row, `onSpikeCard`, `onSpikeInsert` (src/entry.ts, ENTRY_POINTS, CALLBACKS), src/shared/spike/, src/addon/cards/spike.ts, src/server/handlers/spikeS4.ts, the home section, tests, smoke Slice 4 steps 1, 8, 9, 10 text. `SidebarHome.isAdmin` went too: the spike section was its only reader.
9. Q24: `followUp: true` returns `recipientFirstName: ""` and does no Directory lookup (test "followUp ignores recipientEmailIfInternal (Q24)"). The add-on no longer sends the field on follow-up calls.
10. Counters: warm `sidebar.home`, `search`, `template.apply` read Properties once and Drive 0 times (pinned in test/unit/server/entry.test.ts; table below). `favorites.json` and `usage.json` go through the Script Cache with Script Properties `FAVORITES_REV` and `USAGE_REV` (src/server/cache/sideCache.ts, the `INDEX_REV` pattern: readers put only the published rev; writers, `setup` and `tick` publish).
11. scripts/lib/html.mjs unchanged (`git diff 36cd3df -- scripts` is empty).
12. docs/ops/smoke.md "Slice 5", 9 steps, step 1 is spike S5 (new draft and reply draft, body and subject, replaced or appended, thread grouping, stop on a permission prompt). docs/ops/deploy.md "Every release" states the trigger check runs in `doGet` and at the end of every `tick`.
13. 10 scopes, appsscript.json and scripts/approved-scopes.json unchanged. Code.js 276.2 KB of 800, index.html 284.2 KB of 400.
14. Commands below, clean install.

Data safety: `readIndexDoc` and `withSubject` (src/shared/model/data.ts) give items and body files without `subject` an empty one on read (Drive and cache paths); no write. Tests: storage.test.ts (no `create` or `update` call), subject.test.ts (restore of a version file without subject).

## Call counts (warm Script Cache, measured with Proxy counters on the fake globals, base 36cd3df vs head)

| Op | Base props / cache / drive / lock / dir | Head |
|---|---|---|
| `sidebar.home` | 1 / 4 / 0 / 0 / 0 | 1 / 8 / 0 / 0 / 0 (favorites and usage: meta plus chunks each) |
| `search` | stub | 1 / 6 / 0 / 0 / 0 |
| `template.apply`, knownVersion 0 | 1 / 10 / 0 / 1 / 1 | 1 / 10 / 0 / 1 / 1 |
| `template.apply`, current | 1 / 8 / 0 / 1 / 0 | 1 / 8 / 0 / 1 / 0 |
| `template.apply`, followUp | 1 / 5 / 0 / 0 / 0 | 1 / 5 / 0 / 0 / 0 |
| `template.getBody` | 1 / 5 / 0 / 0 / 0 | 1 / 5 / 0 / 0 / 0 |
| `template.list` | 1 / 4 / 0 / 0 / 0 | 1 / 8 / 0 / 0 / 0 |
| `search.body`, texts cached | stub | 1 / 7 / 0 / 0 / 0 |
| `search.body`, 1 text miss | stub | 1 / 8 / 1 / 0 / 0 |
| `favorite.set` or `unset` | stub | 2 / 6 / 2 / 1 / 0 (1 read and 1 write of favorites.json, 1 setProperty) |

## Left for later

- Spike S5 on Gmail web (smoke Slice 5 step 1). If one response fails: Q20 fallback (a second "Set subject" button). If Gmail asks for a scope: stop, owner decision.
- Q21: the add-on does not read `threadId` or `messageId` on reply drafts and logs nothing about them (add-on executions log nothing, spec 11). One-click Insert in a reply replaces the subject; "Insert body only" and the switch are the escape. Decide after step 1.
- Q23 trigger reinstall order (slice 6). Trash view and `template.restoreFromTrash` UI (slice 6). Admin UI, export and import (slice 6): export must carry `subject`, import must replace line breaks and report the count (spec 5.6).
- `ft:*` warm-up in `tick`; today `search.body` reads at most 25 bodies per call. Sidebar search uses the snippet, not the full body.
- A crash between `writeSide` and `setProperty` leaves the published rev one behind the file; readers then serve the older cached set until the next favorites write or `tick` usage write. No `tick` repair (it would cost 2 Drive reads per run).
- With the switch off, prompts used only in the subject are still asked on the prompt card.
- Spec and ADR text: spec 6 status line still lists the 4 ops as stubs; Script Properties list lacks `FAVORITES_REV`, `USAGE_REV` (architect).
- Not verified against Google: `UpdateDraftSubjectAction` with the body action in one response, `DecoratedText.setSwitchControl` form values (`"on"` when selected), `TextInput.setOnChangeAction` firing on Gmail web, `performance.measure` with `{ start }` in the HtmlService iframe.

## Risks

- Spike S5 failure changes the apply path (Q20).
- One-click Insert overwrites a typed subject (ADR-0004 option 3, accepted).
- Sidebar search calls the server on every change event; Card Service fires `onChangeAction` when the field loses focus, so the cost is one call per edit, not per keystroke (unverified).

## Files touched

src: entry.ts; addon/{entry,flows,view}.ts; addon/cards/{folder,home,preview,prompt,render,spec}.ts; server/cache/{indexCache,sideCache}.ts; server/dispatch/{handlers,policy}.ts; server/handlers/{body,favorites,history,sidebar,templates}.ts; server/jobs/{setup,tick}.ts; server/storage/driveStore.ts; shared/{entryPoints.ts,body/prepare.ts,model/data.ts,model/sidebar.ts}; shared/placeholders/{preview,render,subject,validate}.ts; shared/search/match.ts; web/{app,dev-harness}.ts; web/editor/picker.ts; web/library/model.ts; web/rpc/api.ts; web/styles.css; web/views/{context,editor,grid,history,library,preview}.ts. Deleted: addon/cards/spike.ts, server/handlers/spikeS4.ts, shared/spike/s4Fixtures.ts.
test: fakes/output.ts; unit/addon/{addon,cards,fixtures,flows,logic,render}.test.ts; unit/server/{dispatch,entry,history,search,sidebar,storage,subject}.test.ts; unit/shared/{sanitize,search,subject}.test.ts; unit/web/{app,logic}.test.ts.
docs: ops/smoke.md, ops/deploy.md, this handoff.

## Commands (clean install, 2026-11-10)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0, added 559 packages, audited 560; 16 advisories (14 moderate, 2 high), dev tree, unchanged |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run test:coverage` | Test Files 46 passed (46), Tests 952 passed (952). All files: statements 95.33, branches 88.73, functions 93.97, lines 96.33. Lines: addon 100, server 99.31, shared 100, web 95.5 |
| `npm run build -- --env dev` | Code.js 276.2 KB of 800 KB, index.html 284.2 KB of 400 KB |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | accessibility library 100, editor 100, history 100 |

Secret scan of `36cd3df..HEAD`: no token patterns; added addresses are test fixtures on example.com and other.example. No new `UrlFetchApp` or `fetch`.
