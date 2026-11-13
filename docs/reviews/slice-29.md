# Review: slice 29, front door of `doPost` (SR2)

Verdict: FAIL

Branch `slice/29-front-door`, reviewed at 68a5323, base ada97bc. 6 files, +470 -12: `src/server/frontDoor.ts` (new, 40), `src/server/entry.ts` (42 lines changed), `test/unit/server/frontDoor.test.ts` (new, 96), `test/unit/server/entry.test.ts` (+239), `docs/ops/smoke.md` (+14), the handoff (+51). Finding: extension handoff `2026-11-13-extension-to-server-sign-in.md`, SR2.

Reason for FAIL: 3 of 91 attack shapes throw out of `doPost`. A throwing getter on `event.postData`, `postData.type` or `postData.length` escapes, because `frontDoorRefusal(event?.postData)` runs outside any `try`. Apps Script would answer an HTML error page and write no log line. Before this slice, a throwing `postData` getter was caught inside `parseJsonBody`'s `try`, so that shape is a regression. HTTP callers cannot build such an event (Apps Script fills `postData`), so the CSRF guard itself holds. The gate rule for this slice counts any escaping exception as a FAIL.

Fix: in `doPost`, catch a throw from `frontDoorRefusal` and treat it as "Unsupported content type" (default deny), with one warn line. Add the 3 shapes to `entry.test.ts`. Expected size: about 6 lines plus 3 tests.

## Commands (worktree `/home/user/wt-slice-29`)

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0, 0 problems |
| `npm run format:check` | exit 0, all files use Prettier style |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0; Test Files 77 passed (77), Tests 2207 passed (2207). Matches the handoff (baseline 2161 in 76, +46) |
| `npm run build -- --env dev` | exit 0; Code.js 387.3 KB of 800 KB, index.html 390.3 KB of 400 KB |
| `npm run scopes:check` | exit 0; 10 scopes, all approved |

## Acceptance criteria

1. Refusal before `JSON.parse` and dispatch. Met for every plain-data shape. Missing `postData`, other media types and length over 262,144 answer `BAD_REQUEST` with "Unsupported content type" or "Request too large", `retryable: false`, `serverVersion`, `durationMs`. One warn line, 0 Drive calls, 0 cache calls, cache keys unchanged, `favorites.json` unchanged, no `evt:` key. Not met for throwing getters (see Reason).
2. Add-on calls pass. `src/addon/client/serverClient.ts` sends `contentType: "application/json"`. The test `callServer("ping")` through fake UrlFetch into `doPost` answers `ok: true`. Met.
3. `rpc`, `src/shared/entryPoints.ts`, `appsscript.json`, `src/server/dispatch/` and `src/shared/errors/codes.ts`: 0 changed lines. Met.
4. Refusal log line. Fixed fields only: `ts`, `level`, server `requestId`, `surface`, `action: ""`, `actor` (session), `targetId: ""`, `result`, `errorCode`, `durationMs`, `cache`, `appVersion`. Length 247 characters on every refused shape. No body text, no `type` value, no boundary. Met.

## Attack: 91 `postData` shapes through the real `doPost`

Harness: scratch vitest file outside the repo, `handleRpc` wrapped to record calls, the fake world of `test/fakes`. Per refused shape: handler not reached, 1 warn line, line length at most 400, no body text in the line, Drive calls, cache keys and `favorites.json` unchanged.

| Group | Shapes | Result |
| --- | --- | --- |
| `text/plain`, `text/plain;charset=UTF-8`, `application/x-www-form-urlencoded`, `multipart/form-data; boundary=...`, each with `favorite.set`, `favorite.unset`, `template.apply`, `folder.list` bodies | 16 | 16 refused, 0 reached |
| Odd strings: case, spaces, `;` and `,` orders, `\u0000` before and after, `​`, `application/ json`, `jsonx`, `x-json`, `ld+json`, `text/json`, `*/*`, `""` | 21 | 21 refused |
| Non-string `type`: 0, 1, `{}`, array, `null`, `undefined`, `true`, `new String(...)`, object with `toString`, Symbol | 10 | 10 refused |
| Passing forms: case, tab, CR LF, trailing `;`, `; charset=utf-8`, `;;text/plain`, NBSP, BOM | 13 | 13 reached, each normalizes to `application/json` per spec 5.11 |
| Throwing getters on `postData`, `type`, `length` | 3 | 3 exceptions escape `doPost` (FAIL) |
| Throwing getter on `contents` with JSON type | 1 | caught in `parseJsonBody`, "Malformed request" |
| `length`: `"300000"`, -1, NaN, 1.5, 262,144, `-Infinity`, bigint, `null`, `{}` | 9 | reach dispatch (fallback or under cap) |
| `length`: 262,144.5, 262,145, `Infinity`, 1e300, 2^53 | 5 | "Request too large" |
| `length` absent: 262,145 chars refused; 100,000 three-byte chars (about 300 KB UTF-8) passes | 2 | as the handoff says |
| `contents` missing, number, object with JSON type | 3 | "Malformed request" |
| Event `undefined`, `null`, `{}`; `postData` `null`, string, number, array; form `parameter` only | 8 | 8 refused |

No shape reached `handleRpc` without a media type that normalizes to `application/json`.

## Length fallback (minor)

With `postData.length` absent, non-number or NaN, the cap counts UTF-16 units of `contents`. A body can then reach about 786,432 UTF-8 bytes. A negative or `-Infinity` `length` passes the cap whatever `contents` holds. Severity minor: the CSRF guard is the content type check and is unaffected. Apps Script fills `length` as a number and has already read the body before `doPost` runs, so the cap only bounds `JSON.parse` and dispatch work, and 786 KB of parse is small. No change required.

## Refusal path and log size

The refusal line carries no request data. Its size is fixed except `actor`, which comes from `Session.getActiveUser`. An attacker cannot write attacker text or grow the line through this path.

## Checklist

- Permissions: the front door runs before `handleRpc`; dispatch keeps its own checks. Default deny on missing or non-string `type`. Throwing getters do not default to deny (FAIL above).
- Secret scan of `git diff ada97bc HEAD`: 0 keys, tokens, client secrets or URLs. Emails: `x@other.com`, plus `example.com` fixtures. Clean.
- Scopes: `appsscript.json` unchanged; `scopes:check` passes.
- Network: no new UrlFetch or external call. Refusals make 0 UrlFetch calls.
- Quality: strict TS passes; pure check has its own test file; no dead code found.
- Spec gap: none besides the escaping exceptions. `result: "error"` is not named in 5.11; it matches `handleRpc` for BAD_REQUEST.

## Not checkable here

The `postData.type` value Apps Script reports for the add-on's real UrlFetch calls. Dev smoke `docs/ops/smoke.md` "Slice 29" steps 1 to 3 must pass on dev before any prod deploy. If it shows a refusal line with `action: ""`, every add-on call fails.
