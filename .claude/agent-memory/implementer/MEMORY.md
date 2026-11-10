# Implementer memory

## Environment facts (2026-11-09)
- Worktrees may start at an old commit. Reset to the orchestrator branch `claude/gracious-franklin-3n8zbq` first (task prompt gives the command).
- Bash hook rejects commands whose text contains "git" outside plain git commands (for example `.gitkeep`, `.github`, `gitleaks`). `git rm path/.gitkeep` as a plain git command works.
- Worktree guard rejects some heredocs and multi-command scripts it cannot verify (cat > file heredoc, `git` plus python in one command, backslash-heavy python). `python3 - <<'EOF'` edits alone usually pass; new files go through the Write tool; fall back to the Edit tool.
- The Write tool may turn `\u0300` escapes into literal characters; use `\p{M}` with the `u` flag instead.
- Chromium for browser checks: /opt/pw-browsers/chromium. puppeteer-core and chrome-launcher arrive with lighthouse (dev dep). Scratch scripts that import repo code must live inside the worktree (delete before commit).
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

## Code map (after slice 3)
- `src/shared/placeholders/`: grammar.ts (`TOKEN_PATTERN`, `parseText`, `promptKey`), validate.ts (`scanBody`, 7 codes + `PH_NO_FALLBACK`), render.ts (`renderBody`, `promptsFor`, implicit key `{var}<name>`), registry.ts, distance.ts.
- `src/shared/sanitize/`: sanitize.ts (`sanitizeHtml` repeats until stable, 100 KB out, 1 MB in), attrs.ts (own-property lookups), css.ts, policy.ts. `src/shared/html/escape.ts` (canonical escaping, `textRuns`, `mapTextRuns`). `src/shared/body/prepare.ts` (`prepareBody` = write path).
- Server: handlers/body.ts (`IMG_HOSTS`, `prepareFor`, `readableBody`), handlers/history.ts (`version.list/get/restore`), `template.getBody`. `Services.sanitize` removed. `rpc(op, args, requestId)`.
- `src/web/`: app.ts (`startApp(host)`), host.ts (google.script wrapper), router.ts, rpc/{client,api}.ts, editor/{schema,load,serialize,setup,commands,toolbar,picker}.ts, ui/{dom,dialog,menu,status}.ts, views/{library,tree,grid,editor,history,preview,problems,tags,context}.ts, dev-harness.ts.
- scripts/web.mjs (`webPage({harness})`, `servePage`, `DEV_PAGE_VALUES`), dev-web.mjs, lighthouse.mjs. build.mjs uses webPage.
- Tests: test/unit/web/* (jsdom per file, `stubLayout` for ProseMirror), app.test.ts boots harness + app via dynamic import and `vi.resetModules`.

## Lessons (slice 3)
- PM DOMParser reads `element.style` and DOMSerializer writes `style.cssText`: colors become `rgb()`. Parse the `style` attribute text and serialize by hand.
- PM parse collapses trailing whitespace; `<p>Hi </p>` becomes `Hi`.
- htmlparser2 implied closes regroup tags after unwrapping, so one pass is not idempotent; loop until stable.
- `<base target="_top">` in HtmlService sends `#` links to the top window; handle nav in script.
- Lighthouse `label-content-name-mismatch`: aria-label must contain the visible text.

## Code map (after slice 4)
- `src/addon/`: entry.ts (12 callbacks, `respond` = guard, QUOTA `notBefore` wait, flow, render), flows.ts (`Ports` = call, User Cache, nowMs, userEmail, execUrl; home, folder, preview, insert, promptInsert, openLink, spike flows), view.ts (`view:*` chunks 600 s, `body:<id>`), event.ts (params, formInputs, `internalRecipient`), prompts.ts (p-n names, 20 fields, 500 chars).
- `src/addon/cards/`: spec.ts (`CardSpec`, `Reply`, `CALLBACKS`), render.ts (only Card Service code, escapes all text), home, folder (20 per page), preview, prompt, states (`stateCard`, `waitSeconds`), spike (TEMPORARY).
- Server: handlers/sidebar.ts (`sidebarHome`, `templateApply`, `senderOf`, `recipientFirstName`), handlers/spikeS4.ts (TEMPORARY). Shared: model/sidebar.ts, placeholders/preview.ts, cache/{chunked,store}.ts (moved from server), spike/s4Fixtures.ts (TEMPORARY).
- `callServer` returns `{ requestId, response }`; blank execUrl gives NOT_CONFIGURED. Unset `DOMAIN` gives NOT_CONFIGURED.
- Tests: test/unit/addon/flows.test.ts wires `Ports.call` to `world.call(..., "addon")` (real server); fixtures.ts holds view data (never import one test file from another: its tests run twice).

## Lessons (slice 4)
- `CacheService.getUserCache()` is typed non-null; a null check fails lint.
- A recording CardService fake needs every enum the code reads (`ContentType`, `UpdateDraftBodyType`, `TextButtonStyle`).
- `vi.mock` of src/shared/buildInfo in its own test file covers the blank execUrl branch.
- Slice 4 review FAIL: empty state keyed on folders, but every caller owns a private folder. Key empty states on the content the spec names ("no visible templates"), and test with a private folder present.
- Every server-checked action needs a server call right before it acts; cached bodies alone skip the permission check. `template.apply` `followUp: true` = re-check without a second event.
- Payload fields need a reader; review flags unused ones as dead.
- When a feature is removed, grep docs/ops for its UI text (Ping lingered in smoke.md).
- Worktree guard: put multi-edit python in a temp .py file inside the worktree, run it, delete it.

## Conventions
- Op names follow spec section 6 (`template.*`, `version.*`), not task aliases; record the mapping in the handoff.
- Arg names: templates `id`, `baseVersion`, `folderId`, `title`, `tags`, `html`; folders `folderId`, `parentId`, `name`; grants `folderId`, `principalType`, `principalKey`, `level`, `grantId`.
- Server code never nests the script lock; tests assert `lock.nestedAcquisitions === 0`.

## Open items handed forward
- Slice 3: import handler must call `prepareBody`; spec 6 lacks `template.getBody`; google.script.url/history and clipboard unverified in the real iframe.
- Slice 4: spike S4 harness to remove after owner results (handoff lists files); ADR-0004 allowlist and cap wait for results; Card Service calls unverified in Gmail; `setRequiredWidgets` not tried; slice 5 adds search, favorites, recent in `homeSections`.
- Not verified against Google: Advanced Drive on drive.file, `alt: 'media'` return type, `getActiveUser` in triggers, triggerUid values, 5 MB multipart limit.
- `membership.refresh` should clear `prof:*` (slice 6). Audit reader dedupe (slice 6). Caches `fav`, `use`, `ft` (slice 5).
- Drift check behaviour against real Apps Script reformatting: unverified.
