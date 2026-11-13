# Slice 29 handoff: front door of `doPost` (SR2)

From implementer to reviewer, 2026-11-13. Branch `slice/29-front-door`, base ada97bc, code commit 6cdf1c9. Spec 5.11 and 13.12, ADR-0010 Decision 1.

## Done

- New `src/server/frontDoor.ts`: `frontDoorRefusal(postData)` returns "Unsupported content type", "Request too large" or null. Order: missing `postData`, media type (lower case, cut at first `;`, trimmed, must equal `application/json`), length over `MAX_POST_BYTES` 262,144.
- `src/server/entry.ts` `doPost` runs the check before `JSON.parse` and `handleRpc`. A refusal answers `{ ok: false, error: { code: BAD_REQUEST, message, retryable: false }, serverVersion, durationMs }` and writes one warn line: `surface: addon`, `action: ""`, `targetId: ""`, `result: error`, `errorCode: BAD_REQUEST`, `actor` from `Session.getActiveUser`, a new server `requestId`.
- `rpc` unchanged. `src/shared/entryPoints.ts` and `ErrorCode` unchanged.
- `doPost` parameter type widened to `DoPost | undefined`; the old test already passed `undefined`.
- Length fallback: when `postData.length` is absent, not a number, or NaN, the check uses `contents.length` (UTF-16 characters).
- `docs/ops/smoke.md` section "Slice 29": toolbar Insert, side-panel open, log check for front-door refusal lines.

## Verified (how)

- `test/unit/server/frontDoor.test.ts` (new, pure): each type and its result in the test name, including `application/json;charset=UTF-8` and ` application/json ` pass; `application/jsonx`, `text/plain;application/json` and `application/json, text/plain` refuse. Missing and null `postData` refuse. 262,144 passes, 262,145 refuses. Type is checked before size. Fallback to `contents.length` for absent, string and NaN length.
- `test/unit/server/entry.test.ts`, describe "doPost front door": every acceptance type through the real `doPost`; each refusal gives exactly 1 warn line, 0 Drive calls, 0 UrlFetch calls, 0 cache get/getAll/put/putAll calls.
- Security: `favorite.set` as `text/plain` leaves `favorites.json` unchanged and the cache keys unchanged; the same body as `application/json` then writes the favorite (control). `{` as `text/plain` gets "Unsupported content type"; as `application/json` gets "Malformed request". A foreign caller's `text/plain` call buffers no `evt:` key; the same call as `application/json` buffers one (control).
- Add-on client: `callServer("ping")` through the fake UrlFetch into `doPost`, with the client's own `contentType` and payload byte length: request options carry `contentType: "application/json"`, reply `ok: true`.
- Owner dev smoke (13.12 acceptance, toolbar Insert and side-panel open) not run: needs a dev deploy.

## Left

- Owner dev smoke, `docs/ops/smoke.md` "Slice 29", before any prod deploy.
- No spec disagreement found.

## Risks

- Apps Script's `postData.type` for the add-on's UrlFetch is unverified (ADR-0010 rollout guard). If it differs, every add-on call answers BAD_REQUEST; the smoke step 3 catches it.
- The fallback counts characters, not bytes: a multibyte body without a number `length` can reach about 3x 262,144 UTF-8 bytes. Apps Script is expected to fill `length`.
- A refusal still builds services, which reads Script Properties once (`LOG_LEVEL` for the logger). No Drive, index or cache read.
- `result: "error"` is not named by the spec; it matches `handleRpc` for BAD_REQUEST.
- 13.12 names only `entry.test.ts`; the pure check has its own `frontDoor.test.ts` per the unit-test rule.

## Files touched

- `src/server/frontDoor.ts` (new), `src/server/entry.ts`
- `test/unit/server/frontDoor.test.ts` (new), `test/unit/server/entry.test.ts`
- `docs/ops/smoke.md`, this handoff

## Commands to reproduce

```
cd /home/user/wt-slice-29
npm run lint            # eslint ., 0 problems
npm run format:check    # All matched files use Prettier code style!
npm run typecheck       # tsc --noEmit, no errors
npm test                # Test Files 77 passed (77), Tests 2207 passed (2207); baseline 2,161 in 76
npm run build -- --env dev   # Built dev; Code.js 387.3 KB of 800 KB, index.html 390.3 KB of 400 KB
npm run scopes:check    # Scope check passed: 10 scopes, all approved.
```
