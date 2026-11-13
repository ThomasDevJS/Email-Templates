# Review: slice 31, shared visible set (no behavior change)

Verdict: PASS

Branch `slice/31-visible-library`, reviewed at b971017, base ada97bc. 4 files, +372 -98: `src/server/handlers/visible.ts` (new, +101), `src/server/handlers/sidebar.ts` (+45 -98), `test/unit/server/visible.test.ts` (new, +169), the handoff (+57). Spec 5.11 "Visible set", 13.12 slice 31, ADR-0010 Decision 3 first bullet.

## Commands (worktree)

| Command | Result |
| --- | --- |
| `npm run lint` | 0 |
| `npm run format:check` | 0; all files use Prettier style |
| `npm run typecheck` | 0 |
| `npm test` | 0; 77 files, 2171 tests passed (baseline 76 files, 2161; +1 file, +10 tests; matches the handoff) |
| `npm run build -- --env dev` | 0; Code.js 386.3 KB of 800 (395,612 bytes, matches the handoff), index.html 390.3 KB of 400 |
| `npm run scopes:check` | 0; 10 scopes, all approved |

## Acceptance criteria

1. One filter. `visibleLibrary(context)` in `visible.ts` holds the live check, the `none` check, the private-owner check (admins too), nearest visible parent, `folderOrder` and the title sort. `sidebarHome` and `search` both call it. `sidebar.ts` no longer holds `privateOwner`, `visibleFolders`, `folderOrder` or `visibleTemplates`; its imports of `ancestry`, `folderMap`, `atLeast` are gone. Met.
2. No behavior change. Harness: `ada97bc` and `b971017` exported with `git archive` to scratch, one vitest file run in each tree. 300 seeded indexes: 1 to 4 shared roots, private trees of ana, bob, cat (85% each), depth up to 4, 12% deleted folders, sortOrder 0 to 2 with duplicate and case-variant names, 0 to 29 items (15% trashed, 5% in a missing folder), 0 to 7 grants to users, 2 groups and 2 domains at use, edit or manage, random group members, `personalTemplates` on 75%, `recipientsExternal` random, ana admin in 40%, random favorites and recent lists with hidden IDs. Per index, 7 callers (owner, ana, bob, cat, dan, eve@other.org, `Ana@Example.com`): `sidebar.home` cold, `sidebar.home` warm, `search` with 3 queries, `search` empty.
   - Replies: 12,600 compared, 0 differences (`durationMs` zeroed). 10,800 ok, 1,800 AUTH_DOMAIN (eve). Content: 10,448 home templates, 14,198 folders and subfolders, 6,315 search results, 3,180 favorites, 3,006 recent; 2,300 non-empty and 1,300 empty homes.
   - Log lines: 0 differences after the scratch path in stack traces is removed.
   - Call order, first 20 indexes: 16,628 entries over cache, Script Properties, `Drive.Files` and UrlFetch, every method with its first argument; 0 differences. Mix: 5,808 `props.getProperty`, 3,800 `cache.get`, 1,400 `cache.getAll`, 880 `drive.get`, 320 `cache.put`, 40 `cache.putAll`.
   - Control: the same harness against mutated heads finds 1,848 to 5,536 differing replies (table below), so it sees a filter change.
   Met.
3. Permission order. `dispatch.ts` is unchanged: domain check, policy row, `authorize`, then the handler. `visibleLibrary` reads the index only through `context.access()`, which `createContext` builds per request with `levelResolver(subject, index)`; its memo lives in that closure. No module-level level cache. Met.
4. Security tests (13.12 slice 31) present in `visible.test.ts`: admin gets no other user's private folder; deleted folders and trashed templates out; folder without `use` out, child at the top. Mutations in a scratch copy, full suite each:

| Mutation in `visible.ts` | Tests failed | Slice 31 security test failing | Harness reply diffs |
| --- | --- | --- | --- |
| M1 delete line 58, private-owner `continue` | 6 | admin gets no other user's private folder | 1,848 in 299 indexes |
| M2 delete line 56, deleted or `none` `continue` | 14 | deleted folders and trashed templates; folder without `use` | 5,536 in 298 |
| M3 drop `item.deletedAt === "" &&` (line 90) | 4 | deleted folders and trashed templates | 1,954 in 213 |
| M4 drop `level === "none"` only | 11 | folder without `use`; no grants gives nothing | 4,341 in 290 |
| M5 drop `folder.deletedAt !== ""` only | 3 | deleted folders and trashed templates | not run |

   Every guarded line fails at least 1 slice 31 security test. Met.

Spec 13.12 acceptance "every existing sidebar and search test passes unchanged": `git diff ada97bc HEAD -- test/unit/server/sidebar.test.ts test/unit/server/search.test.ts` is 0 lines. Met.

## Checklist

- Permission checks: no entry point added or changed. `sidebar.home` and `search` stay list ops (`both("template.read")`), filtered in the handler; default deny holds (no grants gives 0 folders, 0 templates; tested).
- Secret scan of the diff (keys, tokens, client IDs, private keys, emails): 0 hits. Test addresses are `ana@`, `bob@`, `eve@example.com`.
- OAuth scopes: `appsscript.json`, `package.json`: 0 changed lines. `scopes:check` passes.
- Network: no `UrlFetchApp`, `fetch` or URL in the diff. The call-order trace shows the same Drive and cache calls.
- Quality: strict TS passes; pure logic tested (10 new tests); no dead code (all removed helpers have no callers left); server-only slice, so no UI states or keyboard paths.

## Notes (no gap)

- The filter reads `level === "none"` in place of `!atLeast(level, "use")`. Equal for the 4 values of `AccessLevel`.
- `levelOf` now runs on deleted folders too. It is pure and memoized per request; no extra I/O (trace equal).
- `visibleLibrary` calls `context.access()` twice; the second call returns the memo.
- `folders` is one flat sort, so a child can precede its parent (handoff Risks). Slice 33a must not assume parent-first order.

## Result

PASS. 6 commands exit 0, 2171 tests pass, 0 of 12,600 replies and 0 of 16,628 traced calls differ, every guarded filter line fails a slice 31 security test.
