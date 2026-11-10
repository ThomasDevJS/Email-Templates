# Handoff: implementer to reviewer, slice 4 (apply to compose)

Branch `slice/04-apply`, based on 05ed21f (`claude/gracious-franklin-3n8zbq`). 6 commits plus this handoff: 2e6a940 (carry-overs), 75391ad (chunked cache to shared), 9c76053 (server ops), 5abc790 (add-on sidebar), 2f91a48 (NETWORK detail line, docs), 91b0a48 (unset DOMAIN answers NOT_CONFIGURED). Not merged, not pushed.

## Done, per acceptance criterion

1. `sidebar.home` (src/server/handlers/sidebar.ts): list op, filtered by `use`. Returns `folders` (top visible, with subtree counts), `subfolders`, `templates` (id, folderId, title, 80-char snippet, version, prompts, placeholders, level), `isAdmin`, `favorites: []`, `recent: []`. A folder granted below a hidden parent shows at the top. Other users' private folders stay out, also for admins (all are named "My templates"). Payload types: src/shared/model/sidebar.ts.
2. `template.apply` `{ id, knownVersion, recipientEmailIfInternal }`: dispatch re-checks `use` on every call (policy row `template.apply`, target `itemFolder`). Body (through `readableBody`) only when `knownVersion` differs; `sender` from `lookupProfile`; `recipientFirstName` only for an address in Script Property `DOMAIN`; one `apply` event through `bufferEvent` (500 ms lock). External addresses are dropped in the add-on (`internalRecipient`) and again on the server.
3. Cards are plain data (src/addon/cards/spec.ts); src/addon/cards/render.ts is the only Card Service code. Home: Folders section, Open library (slice 5 adds sections above Folders in `homeSections`). Folder card: path title, subfolders, 20 templates per page, Prev/Next (disabled at the ends, `updateCard`). Preview: `previewText` (src/shared/placeholders/preview.ts) 600 chars, tokens as `[Label]`, "Fields to fill", Insert, "Edit in library" only for edit or manage. Prompt card: one input per prompt identity plus implicit prompts (`promptsFor`), inputs `p-1`..`p-20`, more than 20 gives a refusal card, blank or over-500 values block and re-render with "(!) Fill 1 field: X" and those fields first. Values go through `renderBody` (escaping, newline to `<br>`).
4. Insert reply renders `UpdateDraftActionResponse` with `UpdateDraftBodyType.IN_PLACE_INSERT` and `ContentType.MUTABLE_HTML`. No prompts and all values resolved: one tap on Insert from folder or preview card (the home card lists folders only until slice 5 adds Favorites and Recent).
5. States (src/addon/cards/states.ts): account (AUTH_NO_USER, AUTH_DOMAIN), not set up (NOT_CONFIGURED, also when the build has no `execUrl` and, new, when `DOMAIN` is unset), DENIED (Back), NOT_FOUND (Refresh), BUSY, QUOTA, NETWORK, INTERNAL with "Request ID" and Retry. QUOTA Retry carries `notBefore`; a tap within 60 s shows "Service is busy. Try again in N s." and calls nothing. NETWORK adds the local message line (`Network: Server returned HTTP 401`), used by deploy.md step 10.
6. Builders are pure and tested (test/unit/addon/cards.test.ts, logic.test.ts). Policy rows: `sidebar.home` and `template.apply` existed; new `spike.s4: both("admin.ops")`. Role tests in test/unit/server/sidebar.test.ts: none, use, edit, manage, admin for apply; filtered lists for home; non-admin with manage denied `spike.s4` on both surfaces. Completeness tests updated (4 extras). Default deny unchanged.
7. Spike S4 harness, TEMPORARY: home section "Spike S4 (temporary, admins)" (shown when `isAdmin`), callbacks `onSpikeCard`, `onSpikeInsert`, op `spike.s4` (admin), fixtures in src/shared/spike/s4Fixtures.ts, card src/addon/cards/spike.ts, handler src/server/handlers/spikeS4.ts. Each insert appends `[S4 F6: <bytes> bytes, add-on callback <ms> ms, server <ms> ms]`. Fixtures bypass the sanitizer and the cap on purpose (F7 is 200 KB). Sheet: docs/spikes/slice-04-insert.md, result tables empty. Allowlist and 100 KB cap unchanged.
8. Removed: `onDiag`, src/addon/client/diag.ts (it held a hardcoded dev deployment URL, not a secret), `onPing` and `pingMessage` (the home card no longer has Ping; op `ping` stays), the `oauth2.googleapis.com` whitelist entry, ops `spike.s2` and `spike.s2b`, their handler file, tests and allowlist rows.
9. Carry-overs: `template.get` uses `readableBody` (gap 1, test in history.test.ts); web QUOTA toast Retry disabled 60 s (gap 2, test/unit/web/status.test.ts); `PH_BACKSLASH` compares marks with `Mark.sameSet` (gap 3); `bodySize` removed (gap 4); `chrome-launcher` 1.2.3 pinned (gap 5). Slice 2: `writeMerged` reads `members.json` strictly under the lock and writes nothing on failure; `grant.add` logs `grant.add.snapshotMerge` and still succeeds (test in membership.test.ts).
10. docs/ops/smoke.md "Slice 4", 10 steps, step 9 runs F1 to F9. deploy.md step 10 and step 8 text changed (Ping is gone; not set up text).
11. No scope change. `scopes:check`: 10 scopes.
12. Results below.

## Decisions the reviewer should check

- User Cache: `view:*` chunks (shared `putChunked`, TTL 600 s) and `body:<id>` (6 h, skipped above 90 KB). Cleared by Open library, Edit in library, Refresh, DENIED and NOT_FOUND. A grant change shows in the sidebar within 10 min.
- An apply event is buffered when the prompt card opens, even if the user then cancels (spec 4.1 step 3 buffers at apply time).
- The prompt card's Insert carries the sender values and recipient first name as action parameters. Superseded in Retry 1: it now calls `template.apply` with `followUp: true` before inserting (see below). A newer version re-renders the card with "The template changed."
- `requireDomain` with `DOMAIN` unset now throws NOT_CONFIGURED (was AUTH_DOMAIN). Still a denial; the denied event keeps `AUTH_DOMAIN`.
- `Action.setRequiredWidgets` not used (Gmail support unverified, ADR-0004 point 4 says "tries"); the callback is the enforcement point.
- Chunked cache helpers and `CacheStore` moved to src/shared/cache so the add-on can chunk `view:*`; `services.ts` re-exports `CacheStore`.

## Verified (2026-11-10, Node 22.23.4, after `rm -rf node_modules dist coverage && npm ci`)

- `npm ci`: "added 559 packages, and audited 560 packages". 16 advisories (14 moderate, 2 high), dev tree.
- `npm run lint`: exit 0. `npm run typecheck`: exit 0. `npm run format:check`: "All matched files use Prettier code style!"
- `npm run test:coverage`: "Test Files 40 passed (40)", "Tests 842 passed (842)". Statements 94.92%, branches 88.27%, functions 93.25%, lines 95.95%. Lines by area: addon 100% (326/326), shared 100% (579/579), server 99.38% (1125/1132), web 90.07% (1152/1279).
- `npm run build -- --env dev`: "Code.js: 258.9 KB of 800 KB", "index.html: 271.1 KB of 400 KB". `dist/Code.js` has stubs for all 12 add-on functions and no `oauth2`.
- `npm run scopes:check`: "Scope check passed: 10 scopes, all approved."
- Secret scan of the diff (lock excluded): 0 key or token patterns. Emails only `example.com`, `other.example`, `outside.example`. URL hosts: script.google.com, www.google.com (F1 link), www.gstatic.com (F5 image, loaded by Gmail, not by app code), test hosts.
- Not verified against Google: every Card Service call (`setAltText`, `setDisabled`, `FixedFooter`, `popToRoot`), `draftMetadata.toRecipients` on action events, `commonEventObject.formInputs` shape, insert behavior. Smoke "Slice 4" and the spike sheet cover them.

## Retry 1 (review docs/reviews/slice-04.md, FAIL, gaps 1 to 4)

Commits: 76dee46 (gaps 1 and 3), 662f264 (gap 2), 2b6a9c8 (gap 4).

1. Blocking, fixed. `homeSections` shows the empty state when `view.templates` is empty (spec section 7 "no visible templates"), even when the caller's empty private folder is visible. Test: "shows the empty state when the only folder is the caller's empty private folder" in test/unit/addon/cards.test.ts. Smoke "Slice 4" step 8 matches as written.
2. Fixed. Mechanism: the prompt card Insert calls `template.apply` with `{ id, knownVersion, recipientEmailIfInternal: "", followUp: true }`. Dispatch re-checks `use` as for every apply; a removed grant gives DENIED and the draft does not change. `followUp: true` skips `bufferEvent`, so Insert tap plus prompt Insert buffer 1 event. `knownVersion` is the cached version, so the body travels only when the cache lost it or the template changed. `template.getBody` is no longer called from the prompt card. Cost: 1 UrlFetch per prompt Insert (spec 10 apply budget, no Drive read when cached). Tests: flows.test.ts "re-checks use without the body or a second event" (1 apply event, args sent), "blocks the insert with DENIED when the grant was removed while the card was open", "reports a removed template when the server omits a body the cache lost"; sidebar.test.ts "followUp ... buffers no second event" (also DENIED for a caller without use). Spec 4.1 step 5 should name this (architect).
3. Fixed. Removed `SidebarHome.rev`, `SidebarFolder.own`, `SidebarTemplate.placeholders` from the payload. The server still sorts the caller's private folder last.
4. Fixed. Smoke Slice 1 step 3 now expects "Migway Templates", "Signed in as <your email>" and the library.
5. Left: `Action.setRequiredWidgets` (below).

Verified 2026-11-10 after `rm -rf node_modules dist coverage && npm ci` (559 packages): lint 0, typecheck 0, format clean, "Test Files 40 passed (40)", "Tests 846 passed (846)", lines 95.96% (addon 100%, shared 100%, server 99.38%, web 90.07%), Code.js 259.2 KB of 800 KB, index.html 271.1 KB of 400 KB, "Scope check passed: 10 scopes, all approved."

## Left for later

- Spike S4 results (owner), then ADR-0004 allowlist and size cap (architect), then removal of the harness (implementer): `spike.s4` row and handler, `onSpikeCard`, `onSpikeInsert`, src/shared/spike/, `spikeSection` in home.ts, `spikeCard` and `timingLine`, their tests.
- Slice 5: search input, Favorites (max 10), Recent (max 5) in `homeSections`; `sidebar.home` already returns the empty lists.
- Spec edits for the architect: gap 6 (sanitize-on-paste wording in ADR-0004), gap 7 (`template.getBody` in spec section 6); new: `spike.s4` (temporary), unset `DOMAIN` gives NOT_CONFIGURED, sidebar hides other users' private folders from admins.
- `Action.setRequiredWidgets` trial on the prompt card.
- `membership.refresh` clearing `prof:*` (slice 6, from slice 2).

## Risks

- Card Service APIs are typed but not run in Gmail here. A rejected call (for example `setAltText` on a button inside `DecoratedText`) would break a card; smoke steps 1 to 4 show it at once.
- Action parameters carry the prompt card's values JSON; a template title or values near Card Service's parameter size limit (undocumented) could fail.
- Code.js grew 226.0 KB to 258.9 KB (card builders, fixtures: F7 is generated at run time, not stored).

## Files touched

- New: src/addon/{event,flows,prompts,view}.ts, src/addon/cards/{folder,preview,prompt,render,spec,spike,states}.ts, src/server/handlers/{sidebar,spikeS4}.ts, src/shared/cache/store.ts, src/shared/model/sidebar.ts, src/shared/placeholders/preview.ts, src/shared/spike/s4Fixtures.ts, docs/spikes/slice-04-insert.md, test/unit/addon/{cards,fixtures,flows,logic,noExecUrl,render}.test.ts (fixtures.ts is a helper), test/unit/server/sidebar.test.ts, test/unit/shared/preview.test.ts, test/unit/web/status.test.ts, this handoff.
- Moved: src/server/cache/chunked.ts to src/shared/cache/chunked.ts.
- Deleted: src/addon/client/diag.ts, src/server/handlers/spikes.ts.
- Changed: appsscript.json, package.json and lock, docs/ops/{deploy,smoke}.md, src/entry.ts, src/addon/{entry.ts,cards/home.ts,client/serverClient.ts}, src/server/{guards,services}.ts, src/server/{audit/buffer,cache/indexCache,jobs/tick,membership/snapshot}.ts, src/server/dispatch/{handlers,policy}.ts, src/server/handlers/{grants,templates}.ts, src/shared/{entryPoints,model/validate}.ts, src/web/editor/serialize.ts, src/web/ui/status.ts, test/fakes/output.ts, 10 existing test files.

## Commands

```sh
rm -rf node_modules dist coverage && npm ci
npm run lint && npm run typecheck && npm run format:check
npm run test:coverage
npm run build -- --env dev && npm run scopes:check
```
