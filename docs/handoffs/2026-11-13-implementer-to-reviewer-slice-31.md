# Implementer to reviewer: slice 31, shared visible set

Branch `slice/31-visible-library`, base ada97bc, code commit 1f67e9b. Spec 13.12 slice 31, 5.11, ADR-0010 Decision 3 first bullet.

## Done

- New `src/server/handlers/visible.ts` with `visibleLibrary(context: HandlerContext): VisibleLibrary`.
  - `folders: readonly VisibleFolder[]` (`id`, `name`, `parentId` = nearest visible parent or `""`), display order of `sidebar.home`.
  - `templates: readonly VisibleTemplate[]` (`item`, `folder: VisibleFolder`, `level: Level`), live items only, title order.
  - `folderById: ReadonlyMap<string, VisibleFolder>` for path walks and subtree counts.
- Moved from `sidebar.ts`: `privateOwner`, the folder filter (live, level not `none`, other users' private trees out for admins), `folderOrder`, nearest visible parent, template filter and title sort.
- `sidebarHome` and `search` call `visibleLibrary`. `toTemplate` takes the level from the visible set, so `levelOf` runs once per folder.
- Side-effect order kept: index load, then `recipientPolicy` (Script Property `DOMAIN`), then favorites or recent.
- No sync op, no new policy row, no new network call.

## Verified (how)

- `test/unit/server/sidebar.test.ts` and `search.test.ts` are unchanged (`git diff ada97bc -- test/` lists only `visible.test.ts`). Both files: 41 passed at ada97bc, 41 passed at 1f67e9b.
- New `test/unit/server/visible.test.ts`, 10 tests: folder order and nearest parent; title order with folder and level; private owner; admin gets no other user's private folder; deleted folder and trashed template out; folder without `use` out, child at the top; no grants gives nothing; `sidebar.home` and `visibleLibrary` give equal template and folder ID sets for admin, one grant, none.
- Mutation check by hand: removing the private-owner line fails 3 tests; removing the `deletedAt` folder check fails 2. Both restored.
- Dev bundle `Code.js`: 395,161 bytes at ada97bc, 395,612 bytes at 1f67e9b (+451 bytes).
- Full suite: 77 files, 2,171 tests passed (baseline 76 files, 2,161 tests; +1 file, +10 tests).

## Spec and code

- No disagreement on the filter. `search` already used the same filter (`visibleTemplates`) at ada97bc.
- Spec 13.12 lists `test/unit/server/{sidebar,search}.test.ts` under Files. Neither needed a change, so neither changed.
- Display order is one flat sort over all visible folders (own flag, `sortOrder`, name). A child can precede its parent: on the test fixture `Quotes` (child of `Sales`) comes first. Today's behavior, kept. Slice 33a should know `folders` is not parent-first.

## Left for later

- `extension.sync` (33a, 33b) as the third caller.
- `own` is not exposed in `VisibleFolder`; no current caller needs it.

## Risks

- `visiblePath` loop bound now uses `folderById.size`, equal to the old `visible.size`. A parent cycle in the index still stops at that bound.
- `search` ranks a copy of each visible template with `id` and `title` lifted to the top level for `rank`; field names of `Item` do not collide with `item`, `folder`, `level`.

## Files touched

- `src/server/handlers/visible.ts` (new)
- `src/server/handlers/sidebar.ts`
- `test/unit/server/visible.test.ts` (new)
- `docs/handoffs/2026-11-13-implementer-to-reviewer-slice-31.md` (this file)

## Commands to reproduce

```
cd /home/user/wt-slice-31
npm run lint; npm run format:check; npm run typecheck; npm test
npm run build -- --env dev && wc -c dist/Code.js
npx vitest run test/unit/server/sidebar.test.ts test/unit/server/search.test.ts
git checkout ada97bc && npm run build -- --env dev && wc -c dist/Code.js && npx vitest run test/unit/server/sidebar.test.ts test/unit/server/search.test.ts; git checkout slice/31-visible-library
```

Results at 1f67e9b: lint clean, Prettier clean, `tsc --noEmit` clean, 2,171 tests in 77 files passed, `Code.js` 386.3 KB of 800 KB.
