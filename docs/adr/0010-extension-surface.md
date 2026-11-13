# ADR-0010: Extension surface (requests SR1 to SR4, SF2)

Status: Proposed
Date: 2026-11-13
Deciders: owner (thomas@migway.com), architect

## Context

D41 (owner 2026-11-13): a Chromium extension becomes a second Gmail surface, built in a separate private repo. This repo's server stays the single source. The extension session sent 3 handoffs (read from `/home/user/email-templates-extension/docs/handoffs/2026-11-13-*`): SR1 (dev `/exec` for a non-editor), SR2 (content type check on `doPost`), SR3 (surface label), SR4a (`extension.sync`), SR4b (`template.apply` additions), SF2 (report on stored bodies). SF1 (image host check) is built in slice 28 and is outside this ADR.

Each request was reviewed against the server rules (BRIEF 1, 10, 11; ADR-0003): caller only from `Session.getActiveUser()`, permission check in dispatch before data access, default deny, least privilege, audit integrity, no personal data beyond need, sanitize on save and read. Code read at c0564bc.

| Fact | Where |
|---|---|
| `doPost` parses any body that `JSON.parse` accepts; no content type, size or origin check | `src/server/entry.ts:99-120` |
| `doPost` hard-codes surface `addon`; the same value drives policy and logs | `entry.ts:113-114`, `dispatch/dispatch.ts:157` |
| `web` ops are refused only when `request.surface === "addon"` (allow-unless); a new surface value would pass every `web` row | `dispatch/dispatch.ts:157` |
| The add-on sends `contentType: "application/json"` | `src/addon/client/serverClient.ts:77` |
| Apply events go to `usage.json` only; denied events go to the audit log | `jobs/tick.ts:80-95` |
| Apply event `ts` is server time; usage takes the latest `ts` as `lastUsedAt`, buckets by UTC day, sorts a flush batch by `ts` for Recent | `handlers/sidebar.ts:275-280`, `audit/usage.ts:38, 45-57, 66` |
| Audit rows pick their month file from `ts` | `audit/lines.ts:7-8, 47-52` |
| `bufferEvent` returns false on a busy 500 ms lock or a full buffer; `templateApply` ignores the result | `audit/buffer.ts:76-107`, `handlers/sidebar.ts:275` |
| A refused apply: DENIED writes one row `targetType: folder`, `targetId: <folder ID>`; an unknown ID throws NOT_FOUND in the target resolver and writes no row | `dispatch/dispatch.ts:90-105, 152-176`, `dispatch/targets.ts:15-17` |
| Item IDs carry 16 random characters of a 32-letter alphabet (80 bits) | `src/shared/ids.ts:5-7` |
| Script Cache: 100 KB per value, 1,000 items, FIFO eviction, 21,600 s max | ADR-0002 Context [R4 S30, S66] |
| UrlFetch response max 50 MB; HtmlService and ContentService output size not documented | r4-platform-constraints.md lines 196, 219 |
| Every client read of a body runs `sanitize` again (`readableBody`); export returns the stored HTML raw | `handlers/body.ts:164-172`, `handlers/transfer.ts:254` |
| `sidebar.home` filter: live folders with `use`, other users' private folders out for admins too | `handlers/sidebar.ts:55-71, 125-140` |
| dev deploys in mode `head` to the `/dev` URL, which serves project editors only | `deploy/dev.json`, ADR-0005 |

## Decision 1. Front door of `doPost` (SR2)

Options:
1. Content type check. Refuse unless the media type of `event.postData.type` is `application/json`. A cross-site HTML form can send only `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`; any other type from a web page needs a CORS preflight, which `/exec` does not answer [advisor X1, third party]. Cost: about 10 lines. Risk: if Apps Script reports another value for the add-on's calls, every add-on call fails.
2. Nonce. `ping` returns a nonce bound to the caller in Script Cache; writes require it. Cost: one cache key per user, one extra call, state to expire. Needed only if the extension cannot send `application/json`.
3. No check. Leaves the finding open: a page can make a signed-in user set a favorite or count one apply (advisor X1, unconfirmed until owner test 4).

Decision: option 1, plus a body size cap. Mechanism:
- `doPost` reads `event.postData.type`, lower-cases it, cuts at the first `;`, trims. Not `application/json`: answer the standard envelope `{ ok: false, error: BAD_REQUEST "Unsupported content type" }` before `JSON.parse` and before dispatch. A charset suffix (`application/json; charset=utf-8`) passes.
- `event.postData.length` over 262,144 bytes: same answer, "Request too large". Add-on bodies are under 2 KB; a full `extension.sync` `have` of 1,000 keys is about 45 KB.
- One warn log line (`action: ""`, `errorCode: BAD_REQUEST`, `actor` from the session), no audit row: in a CSRF case the actor is the victim, so a row would blame them.
- The nonce (option 2) is not built unless owner test 1 shows the extension cannot send `application/json`.
- Rollout guard: the slice deploys to dev and the owner runs one add-on Insert before any prod deploy. What Apps Script puts in `postData.type` for the add-on's UrlFetch is unverified; the slice logs nothing new, the dev smoke is the proof.

## Decision 2. Surface label (SR3)

`doPost` cannot read request headers [advisor X1 sources]. The label must come from the request.

Options for the carrier:
1. Body field `client` in the envelope, closed list `"addon" | "extension"`, absent = `"addon"`. Validated in `protocol.ts` like `draft` and `timing`.
2. Query parameter `?client=extension` read from `event.parameter`. Splits request data across URL and body; a second parser.

Options for the type split:
A. Widen `Surface` with `"extension"` and pass it to dispatch. `dispatch.ts:157` then lets every `web` op run for `extension`. Refused.
B. Two fields. `entry: "doPost" | "rpc"` is set by `entry.ts` only and is the only value policy reads. `surface: "addon" | "extension" | "webapp" | "trigger"` is the log and audit label.

Decision: option 1 with B. Mechanism:
- `DispatchRequest` gets `entry`; `authorize` refuses a `web` row unless `entry === "rpc"` (default deny: any future entry is refused too).
- `surface` reaches only `logger` and `EventSource`. A type test (`@ts-expect-error`) proves `authorize` and `PolicyRow` cannot take a `Surface`; a table test runs every `web` row through `handleRpc` with `client: "extension"` and expects DENIED.
- The label is a client claim. A domain user can label their own add-on calls `extension`. It is used for reporting only; spec 11 says so.
- `AuditSurface` and log `Surface` add `"extension"`. The audit tab shows the value as text; no filter changes.

## Decision 3. Sync op (SR4a)

Options:
1. One op `extension.sync { etag, have, page }` that answers the list part (when the etag differs), bodies by budget, favorites, recent, sender. Policy `both("template.read")`, a list op like `sidebar.home`.
2. Reuse `sidebar.home` plus one `template.getBody` per template. 200 templates cost 201 calls of 1.4 to 2.3 s each; `sidebar.home` carries counts in place of addresses and no tags.

Decision: option 1, with these changes to the request:
- Filter: `sidebar.home` and `extension.sync` call one function, `visibleLibrary(context)`, moved out of `handlers/sidebar.ts:55-140` into `src/server/handlers/visible.ts` (live folders with `use`, other users' private folders out for admins too, nearest visible parent, folder order, title order). A test runs both ops on one fixture index and compares template ID sets.
- Every call re-runs dispatch and `visibleLibrary`. Bodies are chosen only from the visible set of that call, never from `have` keys. A grant removed between page 1 and page 2 gives page 2 a new etag, a smaller list part and no body for the removed template.
- `have` over 1,000 keys, a key that is no well-formed ID, `v` that is no whole number, or `skip` other than `true`: VALIDATION, checked by a new optional `PolicyRow.checkArgs`, which dispatch runs after the policy lookup and before `authorize`, so before the index load. Only `extension.sync` uses it now.
- `page: 1` reads Script Cache only (0 Drive reads). `page >= 2` adds Drive reads for `bd:*` misses, at most `SYNC_DRIVE_READS` = 25 and while handler time is under `SYNC_TIME_MS` = 8,000 ms (both to measure). Each reply holds at most `SYNC_REPLY_BYTES` = 4,000,000 bytes of JSON (to measure). From page 2, at least 1 body when any is due. The list part is never cut. `bd:*` reads go in batches of 25 keys.
- A body is due when `have[id]` is absent or its `v` differs from the current version. `skip: true` is accepted and has no server effect: the version test already leaves a skipped body out until its next version.
- `etag` = first 32 hex of SHA-256 over the caller (lower case), a NUL, and `JSON.stringify` of the list part built by one function (`syncList`), so key order is fixed by code.
- `rules` = SHA-256 made by `scripts/build.mjs` over the listed files, each path, NUL, file bytes with CRLF turned into LF, NUL, in ascending path order, injected as a build constant. The list lives in one script module; a test fails when a listed path is missing or when a file under `src/shared/placeholders/`, `src/shared/sanitize/` or `src/shared/html/` is not listed.
- Name: `extension.sync` follows `sidebar.home` (ops named for the view they serve). Surface `both`: the web app gains nothing it cannot already read with `template.list` plus `template.getBody`; a third `OpSurface` value adds a branch for no data gain (opinion).
- No audit row and no apply event. Log line `targetId: ""`.

## Decision 4. Addresses in the sync list (D42, owner to confirm)

Options:
1. Counts only (spec 5.7 today, `sidebar.ts:74-79`). The extension must call `template.apply` before every insert with recipients: 1.4 to 2.3 s.
2. Addresses `to`, `cc`, `bcc`, `blocked` per template, under the current `recipientsExternal` rule (`splitBlocked`).

Decision: option 2, pending owner confirmation as D42. The extension session reports the owner answered its Q3 on 2026-11-13. Mechanism: the addresses are the ones a `use` holder already sees on the cards and in the library (spec 5.7 "Who sets them"); the change is persistence on the user's device, bounded by the extension's 7-day wipe and its 20-minute staleness limit. The add-on keeps "never caches them". Logs still carry no address.

## Decision 5. Apply event time `at` (SR4b)

What reads an apply event's `ts` today: usage `lastUsedAt` (max), the UTC day bucket of `days`, and the Recent order inside one flush batch (`usage.ts:38-74`). Apply events never reach the audit log. Audit rows use `ts` for the month file (`lines.ts:52`).

Options:
- (a) As asked: event `ts` = clamp(`at`, now - 13 h, now). Count integrity holds (one event per `applyId`, as one per call today). A user can move their own apply up to 13 h earlier: into yesterday's day bucket, or before another event of the same flush. Used on a refused-apply row, `ts` would put the row into the previous month's file after the roll and break "`ts` is server time" for audit.
- (b) `ts` stays server time everywhere. `at` is validated (whole ms), clamped to [now - 13 h, now], and stored only as `after.claimed.at` on the refused-apply row.
- (c) Refuse `at`. The refused-apply row loses the insert time.

Decision: (b). Usage counts a late event on its arrival day; a Recent entry from an event that waited in the queue moves to the front on arrival. Both are cosmetic. `at` never changes a stored server time.

## Decision 6. `applyId`, `recorded`, refused-apply row (SR4b)

Options for the repeat check:
1. As asked: one Script Cache key `ap:<applyId>` for 21,600 s. At 800 applies per day (PLAN 2026-11-12 sizing), up to about 600 keys live in a 6 h window, in a cache of 1,000 items with FIFO eviction shared with `idx` chunks, `bd:*`, `evt:*`, `ft:*`, `prof:*`. Index chunk evictions cost Drive rebuilds. The key also does not name the caller: user B who learns user A's `applyId` suppresses A's event.
2. One key per caller: `ap:<first 32 hex of SHA-256 of the lower-case caller>`, value = the caller's last 100 `applyId`s, space-separated, TTL 21,600 s, read and written inside the buffer lock. About 40 keys at Migway's size. Binds the caller by construction; holds no address (spec 11.1 rule for cache keys).

Decision: option 2. Mechanism:
- `bufferEvent` gains an optional `once: { key, id }`. Under the buffer lock: `id` in the list, answer stored without a new event; else store the event, then prepend `id` to the list (cut at 100). Busy lock or full buffer: nothing is written, `recorded: false`, the client retries. Two concurrent retries cannot both store: the check and the write share the lock.
- `recorded` is in the reply only when `applyId` was sent.
- `applyId` has the request ID form `^[0-9A-Z]{8}-[0-9A-Z]{6}$`; another value is VALIDATION.
- Eviction of the key or a retry after 6 h can count an apply twice. Accepted: usage counts are informational.

Options for the refused-apply row:
1. Today: DENIED writes a folder row; NOT_FOUND writes none.
2. As asked: a template row for DENIED and NOT_FOUND, `after: { insertedFromCopy, at, knownVersion }`, for any well-formed `id` and `applyId`. A NOT_FOUND row for any ID opens a new row source: random IDs each write a row (one per fresh `applyId`), up to the buffer cap of 200 per 5 min.
3. Template row only for real items. DENIED: the template row replaces today's folder row (one row per call stays). NOT_FOUND: a row only when the ID is in the index (trashed); an unknown ID writes none, as today.

Decision: option 3. Mechanism:
- `PolicyRow` gains optional `deniedRow(args, index)`; only `template.apply` sets it, and only when `args.applyId` is well formed. `recordDenied` uses it for `targetType: template`, `targetId: <item ID>`, `after: { folderId, applyId, claimed: { at, knownVersion } }`. `claimed` names the client claims as such; `insertedFromCopy` is dropped (the `extension` surface label and `applyId` say it).
- NOT_FOUND from `liveItem` (trashed item) inside the handler: dispatch writes the same row with `errorCode: NOT_FOUND`, `result: denied`. An ID absent from the index fails in the target resolver and writes nothing.
- One row per `applyId`: the refusal goes through the same `once` list.
- Probing: the caller learns DENIED or NOT_FOUND from the error code today; IDs carry 80 random bits. No new signal.
- Flood: rows stay in the buffer cap (200 per 5 min, applies take denied slots); a flooder needs real item IDs.

## Decision 7. Dev `/exec` for a non-editor (SR1)

Options:
1. Switch `deploy/dev.json` to mode `version`. `deploymentId` names the HEAD deployment, which cannot serve a version; the add-on's `execUrl` would change; every dev deploy creates a version.
2. One hand-made versioned deployment on the dev project, outside the repo. `deploy/dev.json` unchanged; the add-on keeps `/dev`.

Decision: option 2. Steps (owner, Apps Script editor of the dev project): Deploy, New deployment, type Web app, description "extension test", Execute as Me, Who has access "Anyone within migway.com", Deploy, copy the `/exec` URL. clasp equivalent from a pushed tree: `clasp create-version "ext <sha>"`, then `clasp create-deployment -V <n> -d "extension test"`; the deployment takes `executeAs` and `access` from the manifest `webapp` block [A12]. To serve newer code: Manage deployments, edit, Version "New version" (or `clasp create-deployment -i <id> -V <n>`). The URL and deployment ID go to the tester in a private message, never into a file in either repo.

Risks: the deployment serves a frozen version against live dev data and Script Properties, so it lags each `npm run deploy -- dev` until redeployed; triggers run the project's saved code (likely; unverified), not this version; `doGet` on an old version reinstalls triggers only if `TRIGGERS_VERSION` differs (`"1"` in every build to date); each version counts toward the project's version total (`deploy.mjs` prints it).

## Decision 8. Report on stored bodies (SF2)

Every path that returns a body to a client sanitizes it again on read (`readableBody`: apply, getBody, get, version.get, sidebar preview). After the SF1 fix is deployed, a stored `src` with userinfo never reaches a draft or the editor. Export returns stored HTML raw (`transfer.ts:254`) to an admin's file, and import sanitizes it again.

Options:
1. A server op or editor function that scans every body. New code with owner rights over every body, for a one-time question.
2. Owner check first: the bypass needs `IMG_HOSTS` set. Empty on dev (and prod not yet deployed): nothing to report. Set: an admin runs Export library and searches the file locally for `src="https://` followed by `@` before the next `/`.
3. No report.

Decision: option 2. No repo code. The library export skips private folders; their bodies are sanitized on every read, so the report covers what can leave by export.

## Consequences

- Easier: the extension reads the whole visible library in about 9 calls (to measure); the server never trusts a client time or label for a decision.
- Harder: `visibleLibrary` is now shared by 3 ops; any change to the sidebar filter changes the extension's list (intended). `rules` couples the server build to the extension's copied file list.
- Revisit: the 4 budgets after the dev measurements (spec 5.11 "To measure"); option 2 of Decision 1 if owner test 1 fails; Decision 4 if the owner does not confirm D42.
- No new OAuth scope. `appsscript.json` unchanged.

## Sources

- Extension handoffs and spec, read 2026-11-13: `/home/user/email-templates-extension/docs/handoffs/2026-11-13-extension-to-server-{sanitizer-finding,sign-in,local-copy}.md`, `docs/spec.md` sections 5, 8, 9, `docs/reviews/advisor-x1-sign-in.md` parts 3 and 5.
- [A12] Apps Script web app deployment settings per deployment (ADR-0003 Sources).
- [R4 S30, S66] Cache limits (docs/research/r4-platform-constraints.md).
