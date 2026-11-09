# Implementer memory

## Environment facts (2026-11-09)
- Worktrees may start at an old commit. Reset to the orchestrator branch `claude/gracious-franklin-3n8zbq` first (task prompt gives the command).
- Bash hook rejects commands whose text contains "git" outside plain git commands (for example `.gitkeep`, `.github`, `gitleaks`). `git rm path/.gitkeep` as a plain git command works.
- Worktree guard rejects heredocs and multi-command scripts it cannot verify. Use the Write tool for new files and `python3 -c` one-liners for edits.
- Downloading and running external binaries is denied by the permission classifier. Release checksums can be read with curl.
- Node 22.23.4, npm 10.9.9 in the sandbox. clasp login impossible here.

## Lessons
- Always prove the lock file with `rm -rf node_modules && npm ci` before reporting. Slice 1 failed review on that.
- Boundary checks must match path segments (`../server`, `server/x`), not only `/server/`.
- Test ID generators: an LCG's low bits cycle fast; use high bits (`Math.floor(seq / 65536) % n`), or IDs collide.
- Real runtime uses `Date.now()`; entry tests need `vi.useFakeTimers({ now, toFake: ["Date"] })`.
- `tick` order matters: cache upkeep before anything that calls `loadIndex`, or upkeep never sees a miss.
- Lint traps: `no-unnecessary-type-parameters` (generic used once), `no-confusing-void-expression` (arrow shorthand returning void), `no-dynamic-delete`, `no-misused-spread` on class instances.

## Toolchain decisions (slice 1)
- typescript 6.0.3 (typescript-eslint 8.72.2 peer `<6.1.0`). eslint 10.14.0 `defineConfig`. vitest 5.1.0. @types/node 22.20.5 pinned for vitest's peer range.
- Pure build helpers in `scripts/lib/*.mjs`; impure in `scripts/tools.mjs`.
- Prettier defaults; `.prettierignore` skips docs except docs/ops.
- Build constants `__APP_ENV__`, `__EXEC_URL__`, `__GIT_SHA__`. Stubs `function name(...args) { return App.name(...args); }`.

## clasp 3.4.1 facts
- Global `--json`, `-P <dir>`. create-version, list-versions, list-deployments, create-deployment `-i -V -d`, update-deployment, show-authorized-user.
- `.clasp.json` `rootDir` relative to its own directory. `push --force` overwrites the manifest.

## Code map (after slice 2)
- `src/shared/permissions/`: principals.ts, effective.ts (`levelResolver`, `PRIVATE_OWNER_LEVEL`), levels.ts, matrix.ts (`ROLE_MATRIX` 17 rows, `checkNeed`, `ROOT`, `ANY_CALLER`).
- `src/shared/`: entryPoints.ts (allowlist, `TRIGGER_JOBS`), ids.ts, text.ts, model/data.ts, model/validate.ts, errors/codes.ts (details on AppError).
- `src/server/services.ts`: `Services` port bag (props, cache, lock, session, logger, nowMs, newId, sha256, sanitize, drive, store, groups, directoryUsers, triggers, appVersion, stats). runtime.ts builds it from globals.
- `src/server/dispatch/`: policy.ts (40 rows, action + targets + surface), targets.ts, context.ts (lazy `access()`), dispatch.ts, handle.ts, handlers.ts (`LATER_SLICE_OPS` stubs), args.ts.
- `src/server/handlers/`: folders, templates, grants, identity, spikes, indexOps, versions.
- `src/server/storage/`: port.ts, driveClient.ts, advancedDrive.ts, restDrive.ts, driveStore.ts, setupStore.ts (`STORE`), writer.ts (`mutateIndex`, `commitLocked`).
- `src/server/cache/`: chunked.ts, indexCache.ts (`INDEX_REV`, `loadIndex`, `loadIndexForWrite`).
- `src/server/audit/`: events, buffer (`evt:*`), lines, roll, usage. `src/server/jobs/`: tick, daily, health, triggers, setup.
- `src/server/membership/`: resolver.ts, snapshot.ts. `src/server/directory/profile.ts`. `src/server/guards.ts`. `src/addon/guard.ts`.
- `test/fakes/`: drive.ts (Drive.Files + REST responder, `failNext`), groups.ts (GroupsApp, Directory), world.ts (`setupWorld`, `call`, `ok<T>`), globals.ts (stub all globals from a world), lock.ts counts `nestedAcquisitions`.

## Conventions
- Op names follow spec section 6 (`template.*`), not `item.*`.
- Arg names: templates `id`, `baseVersion`, `folderId`, `title`, `tags`, `html`; folders `folderId`, `parentId`, `name`; grants `folderId`, `principalType`, `principalKey`, `level`, `grantId`.
- Server code never nests the script lock; tests assert `lock.nestedAcquisitions === 0`.

## Open items handed forward
- Not verified against Google: Advanced Drive on drive.file, `alt: 'media'` return type, `getActiveUser` in triggers, triggerUid values, 5 MB multipart limit.
- `membership.refresh` should clear `prof:*` (slice 6). Audit reader dedupe (slice 6). Caches `body`, `fav`, `use`, `ft` (slices 4, 5).
- Drift check behaviour against real Apps Script reformatting: unverified.
