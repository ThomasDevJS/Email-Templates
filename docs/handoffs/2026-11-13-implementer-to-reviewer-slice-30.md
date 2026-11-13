# Implementer to reviewer: slice 30, surface label (SR3)

Branch `slice/30-surface-label`, base 7c5d282, code commit 6b14c46. Spec 5.11 "Surface label", 13.12 slice 30, ADR-0010 Decision 2.

## Done
- `protocol.ts`: optional `client?: "addon" | "extension"`, `CLIENTS`, `requestClient(raw)` (absent = `addon`, anything else `null`).
- `dispatch.ts`: `type Entry = "doPost" | "rpc"`, `DispatchRequest.entry`. `authorize` refuses a `web` row when `entry !== "rpc"`.
- `handle.ts`: `handleRpc(caller, raw, entry, deps)`. `surfaceOf(entry, raw)`: `rpc` gives `webapp`, `doPost` gives `client` or `addon`. On `doPost`, a bad `client` answers VALIDATION "Client must come from the fixed list" (after the request ID and draft checks, before parse). The log line has no `client` field; a bad value logs `surface: "addon"`.
- `entry.ts`: `doPost` runs the front door first, then parses, then `createServices(surfaceOf("doPost", raw))`. `rpc` passes `"rpc"`. Front-door refusals keep `createServices("addon")` (body unread).
- `logger.ts` `Surface` and `data.ts` `AuditSurface` add `extension`.

## Reads of `surface` in src/ that branch
- `dispatch/dispatch.ts:157` `request.surface === "addon"`: moved to `request.entry !== "rpc"`.
- `runtime.ts:115` `surface === "trigger"` (live props for jobs, snapshot for requests): kept. It picks a property read mode, no permission. `extension` takes the request path, same as `addon`.
- No other branch. Label pass-throughs only: `handle.ts` log base, `context.ts` and `dispatch.ts` event sources, `grants.ts:202`, `admins.ts:84`, `sideCache.ts:40`, `indexCache.ts:46`, `entry.ts:44`, `jobs/health.ts`, `jobs/daily.ts`, `audit/events.ts`, `audit/query.ts:101`, `metrics.ts`. `policy.ts` `row.surface` is `OpSurface` (`both`/`web`), a separate type.

## `services.stats.surface` and `createServices`
Chosen: `doPost` builds services with the request's label. Reason: side log lines (`cache.put`, `directory.users.get`, `grant.add.snapshotMerge`) then name the same surface as the request line. `stats.surface` feeds log lines only. The door check now runs before `createServices`; it reads only `event.postData`.

## Verified (how)
- `handle.test.ts`: `it.each` over `Object.entries(POLICY)` filtered on `surface === "web"` (31 ops today) on `doPost` as the owner (admin), `client` `extension` then `addon`: DENIED, one denied row each with that label.
- `dispatch.test.ts`: a `web` row is refused for entry `doPost`, `"future"`, `""`, `"RPC"` under all 4 labels, and served on `rpc` under all 4. `@ts-expect-error` tests: a `Surface` as `DispatchRequest.entry`, and as `PolicyRow.surface`.
- Bad `client`: `"Extension"`, `""`, `null`, `1`, `["extension"]`, `"webapp"`, `"trigger"`, `{}`, long text. VALIDATION with the fixed message, one log line, no text logged, no denied row.
- `rpc` labels `webapp` with `client` absent, `addon`, `extension`, `"Extension"`.
- `entry.test.ts`: `doPost` with `client: "extension"` gets AUTH_DOMAIN for a foreign caller and DENIED on `folder.create` for the owner.
- Audit read: an extension denied row shows `surface: "extension"` in `audit.query` after `tick`. `parseLines` and `indexProblem` load `extension` rows.

## Left for later
- The admin audit view (`src/web/views/adminAudit.ts`) does not render `surface`. Rows carry it; no UI change in this slice.
- `World.call` in `test/fakes/world.ts` takes `CallSurface` (`addon`, `extension`, `webapp`) and maps it to an entry.

## Risks
- Rollback: an old build reads `extension` rows. `parseLines` and the `pendingAudit` shape check test only `id` and `ts`. `AuditSurface` is a compile-time type. An old build ignores `client` and serves the call as `addon`.
- `client` is a claim. A domain user can label add-on calls `extension`. Reporting only, as spec 11 says.

## Files touched
`src/shared/model/protocol.ts`, `src/shared/log/logger.ts`, `src/shared/model/data.ts`, `src/server/entry.ts`, `src/server/dispatch/{handle,dispatch,context,policy}.ts`, `test/fakes/world.ts`, `test/unit/server/{handle,dispatch,entry,adminReports,admin,admins,items,membership,races}.test.ts`, `test/unit/shared/{protocol,settings}.test.ts`.

## Commands to reproduce
```
npm run lint           # eslint ., no findings
npm run format:check   # All matched files use Prettier code style!
npm run typecheck      # tsc --noEmit, no errors
npm test               # 78 files, 2,304 tests passed (baseline 2,232)
npm run build -- --env dev   # Code.js 388.7 KB of 800 KB, index.html 390.3 KB of 400 KB
npm run scopes:check   # 10 scopes, all approved
```
