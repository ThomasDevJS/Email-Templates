# Implementer memory

## Environment facts (2026-11-09)
- Worktrees may start at main (5ee45c2) without spec/ADRs. Base slice branches on the orchestrator branch `claude/gracious-franklin-3n8zbq` (fetch it into `refs/remotes/origin/...` first).
- Bash hook rejects commands whose text contains "git" outside plain git commands (for example `.gitkeep`, `.github`, `gitleaks`, heredocs with those words). Use the Write tool for such files.
- Downloading and running external binaries is denied by the permission classifier. Release checksums can be read with curl.
- Node 22.23.4, npm 10.9.9 in the sandbox. clasp login impossible here.

## Lessons
- Always prove the lock file with `rm -rf node_modules && npm ci` before reporting. Slice 1 failed review: clasp pulled @types/node 20 against vitest's peer `^22 || >=24`; fixed by pinning @types/node 22.20.5.
- Boundary checks must match path segments (`../server`, `server/x`), not only `/server/`.

## Toolchain decisions (slice 1)
- typescript 6.0.3 (typescript-eslint 8.72.2 peer: `>=4.8.4 <6.1.0`; TS 7 excluded).
- eslint 10.14.0 with `defineConfig` from `eslint/config`; no @eslint/js. @types/node 22.20.5 is pinned only to satisfy vitest's peer range.
- vitest 5.1.0; `import.meta.glob` needs `/// <reference types="vite/client" />`.
- Pure build helpers live in `scripts/lib/*.mjs`, JSDoc typed, checked via tsconfig `allowJs`/`checkJs`; impure process helpers in `scripts/tools.mjs` (not typechecked).
- Prettier defaults; `.prettierignore` skips docs except docs/ops.
- Build constants: `__APP_ENV__`, `__EXEC_URL__`, `__GIT_SHA__` via esbuild define and vitest define (test values: "test", TEST_DEPLOYMENT exec URL, "testsha"). `APP_VERSION` = `<env>-<sha>`.
- Stubs: `function name(...args) { return App.name(...args); }`, export names from an esm metafile probe build.

## clasp 3.4.1 facts
- Global `--json` and `-P <dir>` options. Commands: create-version, list-versions, list-deployments, create-deployment `-i -V -d`, update-deployment, show-authorized-user (`--json` gives `loggedIn`).
- `.clasp.json` `rootDir` resolves relative to the .clasp.json directory. Default ignore pushes only appsscript.json, .js, .gs, .ts, .html.
- `push --force` overwrites the remote manifest without a prompt.

## Code map (slice 1)
- `src/server/dispatch/`: policy.ts (POLICY), handlers.ts (HANDLERS, Caller), dispatch.ts (blank caller, own-property lookup, level != none denied), handle.ts (envelope + one log line, never throws).
- `src/server/runtime.ts`: logger with LOG_LEVEL Script Property, currentCaller from Session.
- `src/addon/client/serverClient.ts`: UrlFetch to BUILD_INFO.execUrl with bearer token.
- `test/fakes/`: cache, properties, lock, urlFetch, scriptApp, session, output (Html/Content/Utilities/recording CardService).

## Open items handed forward
- Trigger-callable top-level functions (setup, tick, refreshMembers, daily) need a guard in slice 2 before doing work.
- Caller domain check: slice 2.
- Drift check behaviour against real Apps Script reformatting: unverified.
- timeZone America/New_York (orchestrator choice, owner-adjustable).
- Spec scope list omits gmail.addons.execute; R4 says it is ignored since 2019.
