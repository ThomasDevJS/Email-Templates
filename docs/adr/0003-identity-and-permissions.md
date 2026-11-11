# ADR-0003: Execution identity and permission model

Status: Accepted 2026-11-09 (orchestrator, by owner delegation; was Proposed) (revised 2026-11-09 after D15: one project, near-zero maintenance) (revised 2026-11-09 in slice 2: Part C enforcement mechanism, entry point allowlist) (Amendment 2026-11-10, errata run 3: denied rows, event buffer cap, trigger install order, admin op log lines; Proposed) (Amendment 2026-11-10, D29: personal templates switch, `config.set`; Accepted 2026-11-11 with ADR-0008) (Amendment 2026-11-11, errata run 4: buffer slots, log `targetId`, export event; Proposed) (Amendment 2026-11-11, D32: in-app admin list; Proposed)
Date: 2026-11-09
Deciders: owner (thomas@migway.com), architect

## Context

| Fact | Source |
|---|---|
| The add-on always runs as the user accessing it | [R4 S11] |
| Only a web app can run as its owner (`USER_DEPLOYING`, "execute as me") | [R4 S11, S12] |
| Storage shared to users can be opened in Drive and bypasses any permission layer | [R4 implications table], summary.md section 3 item 1 |
| With "execute as me", `Session.getActiveUser()` returns the user when the user is in the same Workspace domain; blank if security policies block it. `getEffectiveUser()` returns the owner | [R4 S45] |
| Directory API group lookup needs an admin role. Prebuilt Groups Reader role works through the Admin API | [R4 S19, S21, S74] |
| GroupsApp needs no admin, sees direct members only, `hasUser` throws if the caller cannot view the member list, 10,000 group reads per user per day | [R4 S2, S22, S23] |
| Cloud Identity transitive APIs need Enterprise Standard, Enterprise Plus, Enterprise for Education or Cloud Identity Premium | [R4 S24, S25] |
| Nested group changes take up to 10 min to propagate; TTL 10 to 60 min fits | [R4 S20] |
| `orgUnitPath` in `domain_public` view for non-admins is unconfirmed | [R4 S78], R4 open question 7 |
| A token-authenticated call to a web app with access "Only myself" or "Anyone with Google account" needs a Drive scope in the token; for "execute as me" with that access, the project was reported to need sharing with callers (third party, 2018 observation) | [A1] |
| `ScriptApp.getIdentityToken()` returns an OpenID Connect JWT when `openid` is in the manifest | [A4] |
| Gmail compose event gives recipients as email strings only | [A5] |

Binding: D15 decided (one Apps Script project: add-on code runs as the user, a web app deployment of the same project runs as the owner). D8 accepted (web app "execute as me" is the single server, storage private to it, add-on fetches through it, GroupsApp on flat role groups, Groups Reader later). D7 open: assume Business Standard or lower, flat role groups, no admin API restrictions. D11 accepted: one private folder per user. BRIEF 1: default deny, server-side enforcement, admins see everything.

## Part A. Add-on to server call pattern

### Options

1. Pattern A, access token plus active user. The project's web app deployment uses `executeAs: USER_DEPLOYING`, `access: DOMAIN`. Add-on code calls `UrlFetchApp.fetch(SERVER_URL, { method: 'post', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON })`. Google authenticates the token at the `/exec` front door and rejects non-domain callers. `doPost` reads the caller from `Session.getActiveUser().getEmail()` [R4 S45]. Identity cannot be forged, because Google sets it from the token. Cost: the token must carry a Drive scope [A1]; `drive.file` is already in the one manifest for storage (ADR-0002), non-sensitive [R4 S57], and Google's acceptance of it at `/exec` is unverified. Possibly the project must be shared as Viewer with callers [A1]. Same code path as the web app UI, which also uses `getActiveUser`.
2. Pattern B, ID token. Server deployed with `access: ANYONE_ANONYMOUS`. Add-on sends `ScriptApp.getIdentityToken()` [A4]. Server verifies it with Google's tokeninfo endpoint (`aud` equals the add-on OAuth client ID, `iss`, `exp`, `email_verified`, `hd` equals the Migway domain), caching the result for the token's remaining life. Cost: endpoint is publicly reachable; one extra UrlFetch per new token; needs `openid` scope. "Execute as" and "Who has access" are chosen per deployment under Deploy > New deployment > Web app > Deployment configuration; the manifest `webapp` field supplies defaults [A12]. One project can therefore carry two web app deployments: the UI deployment (`USER_DEPLOYING`, `DOMAIN`) keeps `getActiveUser`, and an API deployment (`USER_DEPLOYING`, `ANYONE_ANONYMOUS`) accepts only a verified ID token. No second project is needed. Slice 2 confirms two deployments with different access settings. Admins can disable public web app access for the domain (unverified), which would break it.
3. Pattern C, precomputed per-user index. Server writes each user's visible templates to a file shared to that user only, or to a cache the add-on can read. The add-on reads it without a server call. Cost: fan-out of up to 500 writes per grant or template change; per-user files expose content in Drive (only content the user may see, but outside the app's audit); in the one project, an add-on path that reads the Script Cache directly would make the code the only barrier between a user and every cached body. Apply-time revocation is lost.

### Decision, Part A

Pattern A against the same project's `/exec`, with Pattern B's ID-token check as a config fallback. Topology 1a changes the target URL only: the add-on calls its own deployment's `/exec` (a build-time constant, ADR-0005) instead of a second project's. Token, front door, `getActiveUser`, `dispatch`, request shape and fallbacks are unchanged.

- Default `CALLER_IDENTITY=active_user`. The server rejects any request where `getActiveUser().getEmail()` is blank, or not in the configured domain, with `AUTH_NO_USER` (HTTP-style code in the JSON body) and logs it. Default deny: no anonymous path exists.
- Fallback `CALLER_IDENTITY=id_token`. Used only if slice 2 shows `getActiveUser` is blank for token calls. The add-on adds `openid` and `userinfo.email`, sends the ID token in the JSON body, and the server verifies it via tokeninfo as in Pattern B, while keeping `access: DOMAIN` so the front door still requires a domain token. Config change plus one scope, no redesign.
- Manifest: `urlFetchWhitelist` lists `https://script.google.com/macros/s/` and `https://script.googleusercontent.com/` (the `/exec` response redirects there) [R4 S6].
- Request shape: `{ op, args, requestId, clientVersion }`. Response: `{ ok, data | error: { code, message, retryable }, serverVersion, durationMs }`.
- Add-on code keeps the filtered result in its User Cache for 10 min (ADR-0002). The data there is only what the server already allowed this user to see.

### Shared stores in one project

Script Cache and Script Properties belong to the project, so add-on callbacks (as the user) and web app calls (as the owner) see the same stores. User Cache is keyed by the effective user: per user in add-on callbacks, the owner's single cache in web app calls (likely; slice 2 test confirms).

| Store | Add-on code path (as user) | Web app and trigger path (as owner) |
|---|---|---|
| Script Cache (`idx`, `body`, `ft`, `gm`, `prof`, `evt`, `aud`) | never reads or writes | reads and writes |
| Script Properties (`STORE`, `INDEX_REV`, config) | never reads or writes | reads and writes |
| User Cache | `view:*`, `body:*` for this user | never used (would be the owner's cache, shared by every caller) |
| Drive data files | no access path in code | Advanced Drive service, `drive.file` |

Mechanism:

- The boundary test (slice 1, extended in slice 2) fails the build if any module under `src/addon/` imports from `src/server/`, or references `getScriptCache`, `getScriptProperties`, `Drive`, `GroupsApp` or `AdminDirectory`. A second check fails if any module under `src/server/` references `getUserCache`. ESLint `no-restricted-syntax` rules give the same errors in the editor.
- The trust boundary is the code. The add-on user's token carries every manifest scope, so add-on code could technically call any service as the user. It does not, because the code is reviewed and pushed by the owner only (ADR-0001 pilot mitigations, ADR-0005 drift check). Script Properties hold configuration only, no secrets, so a code path reading them would leak nothing secret.

Spike S2 outcome 2026-11-09: (a) the token needs a scope that can read the script project; `drive.file` fails with 404, `script.projects.readonly` works (docs/spikes/slice-02-s2.md). (b) `getActiveUser` is set. (d) `/dev` accepts owner token calls. Pattern A confirmed. Original plan: Spike S2 (slice 2, first task) settles three unknowns before slice 2 code: (a) does a `drive.file` token pass the `/exec` front door with `access: DOMAIN`, (b) is `getActiveUser` set on token calls, (c) must the project be shared with callers, (d) does a token call to the `/dev` URL work for project editors (dev environment, ADR-0005). Outcomes map to Q6, Q7, Q8 and the dev deploy mode.

## Part B. Membership resolution

### Options

1. GroupsApp direct members, run by the server owner. `GroupsApp.getGroupByEmail(g).getUsers()` per referenced group. No admin, any edition, direct members only [R4 S22, S23]. Owner must be able to view each role group's member list; D8 puts the role groups under the service account's ownership.
2. Admin SDK Directory with Groups Reader granted to the server owner. `members.list` with derived membership, `members.hasMember` resolves nesting [R4 S77]. Needs an admin one time [R4 S21].
3. Cloud Identity transitive APIs. Edition-gated [R4 S24]. Needs a standard GCP project and UrlFetch [R4 S81].
4. GroupsApp in the add-on as the user (`GroupsApp.getGroups()`). The user's own groups, no admin [R4 S22]. Rejected: the add-on does not enforce permissions (Part A), and the web app UI runs as the owner.

### Decision, Part B

Pluggable resolver, option 1 in v1. All resolvers produce the same snapshot, so the D7 answer changes Script Property `MEMBERSHIP_RESOLVER` only.

Interface (contract, not code):

| Member | Meaning |
|---|---|
| `id` | `groupsapp_direct`, `directory`, `cloud_identity` |
| `capabilities` | `{ nested: boolean, orgUnits: boolean }` |
| `listMembers(groupEmail)` | user emails that hold membership, direct or transitive per capability |
| `nestedGroups(groupEmail)` | child group emails, used for warnings when `nested` is false |
| `orgUnitOf(email)` | OU path, or `UNSUPPORTED` |

- Referenced groups set G = the admin group plus every group named in `grants`. Expected under 30.
- Snapshot refresh: time trigger every 15 min runs `listMembers` for each g in G, writes `members.json` (durable, ADR-0002) and Script Cache `gm:*` chunks. GroupsApp reads per day: 30 groups x 96 runs = 2,880, under 10,000 [R4 S2].
- Request path reads only the snapshot (cache, then `members.json`). It never calls GroupsApp, so user traffic cannot exhaust the quota.
- Principals for a caller: `user:<email>`, `domain:<domain>`, `group:<g>` for each g whose snapshot contains the email, `ou:<path>` only when `capabilities.orgUnits` is true.
- Nested groups with `groupsapp_direct`: refresh records child groups from `nestedGroups`; the admin UI flags "Group X contains group Y. Members of Y get no access until the resolver supports nesting."
- Max staleness: 15 min after a Google Groups change. Admin UI has "Refresh memberships now" (admin only, under lock).
- A grant to a new group adds it to G and refreshes its snapshot inside the grant request, so the admin waits for no trigger.
- Switch to `directory` after an admin grants Groups Reader to the server owner (2.5b): adds scope `admin.directory.group.member.readonly` (owner consent only), `nested: true`. `cloud_identity` needs Enterprise or Cloud Identity Premium plus a standard GCP project.
- OU grants: `groupsapp_direct` cannot resolve OUs. Grants to OUs are stored but inactive and shown as "Inactive: OU resolution needs the Directory resolver" (Q4).

Admin role: member of `ADMIN_GROUP` (Script Property, group email) via the snapshot, or listed in `ADMIN_EMAILS` (Script Property, break-glass, initial value the owner). Admin membership is never granted in-app. [D32, 2026-11-11, Proposed: a third source, the in-app list `admins` in `index.json`, edited by admins with `admin.add` and `admin.remove`. See Amendment 2026-11-11 (D32).]

### Triggers

All triggers are time-driven, owned by the owner identity, and run as the owner. The setup function `setup()` installs them: it deletes every project trigger and recreates the set below, so a second run changes nothing. [Since slice 6a it creates the new set first, then deletes the old one; Amendment 2026-11-10, errata run 3.] The owner runs it once per environment from the Apps Script editor after the first deploy. Afterwards the first web app request after each deploy compares Script Property `TRIGGERS_VERSION` with the code constant and reruns the install under the script lock when they differ, so new or changed triggers need no human step. Limit: 20 triggers per user per script [R4 S2]; this design uses 3.

| Trigger | Schedule | Work | Runtime per run (estimate) | Runtime per day |
|---|---|---|---|---|
| `tick` | every 5 min | flush `evt:*` apply events to `usage.json`, denied events to `pendingAudit`, and the `evt:dropped` plus `evt:lost` count as one `audit.dropped` event; re-put cache chunk sets older than 5 h; flush `pendingAudit` early above 200 KB | 2 s | about 10 min |
| `refreshMembers` | every 15 min | `listMembers` for each referenced group, write `members.json` and `gm:*` | 10 s | about 16 min |
| `daily` | once a day, 02:00 to 03:00 script time zone | append `pendingAudit` to `audit/YYYY-MM.jsonl`; purge trash older than 30 days; trash orphan body files; backup `index.json`, `favorites.json`, `usage.json` and keep 14; trash audit month files older than 24 months; record job health | 60 s | about 1 min |

Total about 27 min per day, under the 6 h trigger budget [R4 S2]. Each run writes `job:<name>:lastOk` and `job:<name>:lastError` to Script Properties; the admin Config tab shows them and flags a job late by more than 2 schedule intervals. Trigger failures also send Apps Script's failure email to the owner.

## Part C. Permission model

Default deny. No grant means no access. No deny entries.

Grant: `(folderId, principal, level)`, level `use` < `edit` < `manage`. Effective level of a caller on folder F = maximum level over grants on F and every ancestor of F whose principal is in the caller's principal set. Admin = `manage` on every folder, including private folders (BRIEF 1, Q5). Templates inherit their folder's level; no per-template grants in v1. A move recomputes levels from the new ancestors.

Roles map to levels: user = holds `use` only; manager-editor = holds `edit` or `manage` on some folder; admin = global. New folders get no grants, so only admins and `manage` holders of the parent see them (ux-notes.md section 2).

Private folder (D11): created on first use for every caller, `kind=private`, `ownerEmail=<caller>`. Owner has `edit` on it. Grants on private folders are rejected in v1. Admins see it. [D29: created only while the personal templates setting is on; while off the private tree resolves to `use` for owner and admins. Amendment 2026-11-10, D29.]

Role matrix (level needed on the target folder; "A" = admin only):

| Action | user (use) | manager-editor (edit) | manage | admin |
|---|---|---|---|---|
| List, search, preview template | yes | yes | yes | yes |
| Apply template | yes | yes | yes | yes |
| Favorite, unfavorite | yes | yes | yes | yes |
| Create, edit, duplicate template | no | yes | yes | yes |
| Move template | no | yes on source and target | yes | yes |
| Soft delete template, restore from trash | no | yes | yes | yes |
| View version history, restore version | no | yes | yes | yes |
| Purge from trash | no | no | no | yes |
| Create subfolder, rename folder | no | no | yes | yes |
| Move or soft delete folder (must be empty) | no | no | yes on folder and parent | yes |
| Create top-level folder | no | no | no | yes |
| Add or remove grants on folder subtree | no | no | yes | yes |
| Export folder JSON | no | no | yes | yes |
| Export library, import | no | no | no | yes |
| View audit log, usage report | no | no | no | yes |
| Refresh memberships, view config | no | no | no | yes |
| Change settings (`config.set`, D29) | no | no | no | yes |
| Private folder of self | edit | edit | edit | yes |

Enforcement mechanism:

- One entry point for ops. `doPost` (add-on) and one `google.script.run` function `rpc(op, args)` (web app) both call `dispatch(caller, op, args)`. The bundle is one IIFE (ADR-0005), so only its exports become top-level functions, and every top-level function is callable through `google.script.run` [R4 S49]. Each export is listed in an allowlist (`src/shared/entryPoints.ts`) with one surface, and a test fails on any export missing from it: `webapp_rpc` (`doGet`, `rpc`) and `doPost` run `dispatch`, which rejects a blank caller (`AUTH_NO_USER`) and a caller outside Script Property `DOMAIN` (`AUTH_DOMAIN`); `trigger` (`setup`, `tick`, `refreshMembers`, `daily`) runs only when the effective user is Script Property `OWNER_EMAIL` and either the active user is that owner or the call carries the `triggerUid` of this project's trigger for that function with no other active user, and `setup` runs only when active and effective user are the same account and match `OWNER_EMAIL` once it is set; `addon` (`onComposeOpen`, `onHomepage`, `onOpenLibrary`, `onPing`) runs only when the active and effective user are the same account, so a web app caller cannot make it fetch the server with the owner's token. Op names never equal export names, so no callback is reachable through `rpc`. Revised 2026-11-09 in slice 2: this allowlist replaces the rule that non-entry functions end with `_`.
- `dispatch` looks up `op` in a policy table: `{ op, requiredLevel, targetResolver }`. It resolves the target folder(s), computes the effective level, and denies before the handler runs. Denied requests return `DENIED` and write an audit row. [Also a DENIED thrown after the policy check, one row per call; Amendment 2026-11-10, errata run 3.]
- A unit test enumerates the policy table and fails if any handler has no policy row. A second test checks every role matrix cell above (BRIEF 9).
- List and search results are filtered by the same level function, so hidden templates never leave the server.

## Part D. Audit trail and logging

Audit event (one JSON line in `audit/YYYY-MM.jsonl` after the daily flush, `pendingAudit` before it; append-only, server writes only, ADR-0002):

| Field | Type | Example |
|---|---|---|
| `id` | string, time-sortable | `01JC...` |
| `ts` | ISO 8601 UTC | `2026-11-09T14:03:22.120Z` |
| `actor` | email | caller email |
| `actorRoles` | string | `admin` or `edit` |
| `surface` | `addon`, `webapp`, `trigger` | `webapp` |
| `action` | enum | `template.update` |
| `targetType` | `template`, `folder`, `grant`, `library`, `config` | `template` |
| `targetId` | string | item ID |
| `targetPath` | string | `/Sales/Quotes` |
| `before` | JSON, max 40 KB, bodies as `{ version, fileId, sha256 }` | |
| `after` | JSON, same rules | |
| `result` | `ok`, `denied`, `conflict`, `error` | `ok` |
| `errorCode` | string or empty | |
| `durationMs` | integer | 412 |
| `requestId` | string | from the client |
| `appVersion` | string | deployment version |

Retention: 24 months (Q10). The `daily` trigger trashes month files older than 24 months. Admins read events in the admin UI audit tab (wireframe 06), one month at a time.

Structured log (BRIEF 10): one JSON line per request via `console.log(JSON.stringify(...))`. Fields: `ts, level, requestId, surface, action, actor, targetId, result, errorCode, durationMs, cache (hit|miss|rebuild), appVersion`. Logs never contain template bodies, prompt values or recipient addresses.

## Amendment 2026-11-10 (errata run 3): denied rows, event buffer, triggers, admin log lines

Status: Proposed until the owner approves. Built in slices 6a and 6b, review PASS (docs/reviews/slice-06a.md on bb53d6c, slice-06b.md on f6b567f). Part C and Part D stand; this section records the mechanism as built.

Denied audit rows:
- `dispatch` buffers one denied event for a policy denial, and one for a DENIED thrown after the policy check: a handler refusal (`admin.folders` for a caller who manages no folder) or an in-lock re-check (`trash.purge`, admin rows). One call writes at most one row.
- VALIDATION and NOT_FOUND write no denied row. The log line carries `result: denied` in every DENIED case.

Event buffer (`evt:*`):
- At most 200 events (`BUFFER_MAX`). When full, new apply and denied events are dropped and counted in `evt:dropped`. [Since slice 13 an evicted slot is reused first and an apply takes a denied slot; busy-lock losses count in `evt:lost`. Amendment 2026-11-11.]
- `tick` writes one `audit.dropped` event per run with `after: { dropped }`, actor `system`, result `error`.
- Limit: 200 refused calls inside 5 min also drop apply events, so usage counts lose them; the count does not split applies from denials (spec 13.5, v1.1). [Since slice 13 applies take denied slots, so denials no longer push out applies. Amendment 2026-11-11.]

Usage: `usage.json` entries carry `days`, a map of UTC day (`YYYY-MM-DD`) to apply count, kept to the 30 days that end on the latest apply. Entries written before slice 6b have no `days` and count 0 until their next apply. `usage.report` (admin) sums the 30 UTC days ending today.

Triggers (Q23, built in 6a, hardened in 6b):
- `installTriggers` creates the 3 new triggers, then deletes every old one, duplicates included.
- A failed create deletes the new ones it made, keeps the old set, writes `job:triggers:lastError` and leaves `TRIGGERS_VERSION` stale.
- A failed delete still deletes the rest, then throws; the next run leaves 3. The Config tab shows `triggersError` while `TRIGGERS_VERSION` is stale.
- The version check runs in `doGet` and at the end of `tick`.

Log lines of admin ops (closed field list of spec 11, no new field):

| Op | `targetId` | Never logged |
|---|---|---|
| `grant.add` | folder ID | principal key (it sits only in the audit event `before` and `after`) |
| `grant.remove` | `""` (`grantId` is not `id` or `folderId`) [since slice 13: the folder ID that dispatch resolved; Amendment 2026-11-11] | principal key |
| `import` | target folder ID | titles, subjects, bodies of the file |
| `export.folder` | folder ID | template content |
| `export.library` | `""` | template content |
| `backup.restore` | `""` | the backup date |

Audit events of these ops: `grant.add` and `grant.remove` with before and after; one `import` event per created folder and template (after = record and body reference); `backup.restore` with before `{ rev, items }` and after `{ date, rev, items }`; `trash.purge` one event per purged template and folder. Exports write no audit event in v1 [6b built no export event; the security event list in ADR-0002 names export, so this is a gap: spec 13.5. Closed in slice 13: one start event per export run, ADR-0002 Amendment 2026-11-11].

## Amendment 2026-11-10 (D29): personal templates switch, `config.set`

Status: Accepted 2026-11-11 with ADR-0008 (built in slice 11). Mechanism and options in ADR-0008.

- `levelResolver(subject, index)` reads `index.settings.personalTemplates`. While `off`, a folder in a private tree resolves to `use` for its owner and for admins and `none` for everyone else; this check runs before the admin rule. While `on`, Part C stands (owner `edit`, admins `manage`).
- Every level check uses this function: dispatch before the handler, `commit` through `recheck` on the fresh index, and `folder.list`. A write racing a settings change is therefore judged on the new value inside the lock.
- `folder.list` creates the caller's private folder only while `on`.
- Role matrix row "Private folder of self" while off: `use` for every role; admin `use` on other users' private folders.
- New op `config.set` (admin, web), policy action `admin.ops`, in-lock admin re-check. Audit event `targetType: config`, `targetId` the setting name, before and after `{ name, value }`. Log line `targetId: ""`, no value. Args `{ name, value, baseAt, baseBy }` since slice 13 (ADR-0008).
- A DENIED with a private target while off carries "Personal templates are turned off by your admin." and writes one denied row as any DENIED.

## Amendment 2026-11-11 (errata run 4): buffer slots, log `targetId`, export event

Status: Proposed until the owner approves. Built in slice 13, review PASS on c96a38b (docs/reviews/slice-13.md). Verified in src at 6374b7b.

Log `targetId`. Options: (1) keep `""` for ops whose args carry no `id` or `folderId` (`grant.remove` logs nothing to trace); (2) log the first non-root target folder dispatch resolved. Decision: option 2. Mechanism: dispatch stores the resolved target in `RequestStats.target`; the log line uses `args.id`, else `args.folderId`, else that target, else `""`. The value is always an ID found in the index, never an address, title or setting value. `grant.remove` logs the folder, ok and denied; `folder.create` under a parent logs the parent; `config.set` and `export.library` stay `""`.

Event buffer. Options: (1) separate caps for apply and denied events (two counters, two limits); (2) one cap with slot reuse. Decision: option 2. Mechanism (src/server/audit/buffer.ts `slotFor`, `bufferEvent`): in a full buffer, one `getAll` of the 200 keys; an evicted slot is taken first with no drop counted; else an apply takes the slot of a denied event (counted); else the new event is dropped (counted in `evt:dropped`). An event lost to a busy 500 ms lock counts in `evt:lost` ("<lost> <seen>", one key). `tick` writes both as one `audit.dropped` event. Change events never use the buffer.

Export audit: one start event per export run through `commit`, then a run token; mechanism and options in ADR-0002 Amendment 2026-11-11. The audit tab reads "Library export started, 25 templates" and "Folder export started: Sales / Quotes, 12 templates".

## Amendment 2026-11-11 (D32): in-app admin list

Status: Proposed until the owner approves. Owner (2026-11-11), quoting the admin guide: "Admin status is never granted in the app - lets change that and add setting for admins to add more admins". Storage follows ADR-0008 (Amendment 2026-11-11, D32).

Today (src/shared/permissions/principals.ts `isAdminEmail`, src/server/membership/snapshot.ts `subjectFor`): admin = listed in `ADMIN_EMAILS` (Script Property, break-glass, `setup()` seeds the owner) or a member of `ADMIN_GROUP` in the membership snapshot. Only the owner edits both, in the Apps Script editor.

### Options for where the list lives

1. A field `admins` in `index.json`, changed through `commit` (lock, in-lock re-check, one write with its audit event, `INDEX_REV` rises). Cost: the admin check reads the index for callers outside the two properties. The index is already loaded by every op except `any` rows and admin rows.
2. A Script Property written by the app. Rejected for the reasons of ADR-0008 section 1: a property read in the lock is not the index the lock re-checks, the change and its audit are two writes, and script editors can change it with no audit. It would also put app-written data next to the break-glass the app must never edit.
3. The app adds people to `ADMIN_GROUP`. Needs a Groups write scope (new consent) and an `ADMIN_GROUP`. Rejected: new scope, and Google Groups changes reach the snapshot only every 15 min.

Decision: option 1.

### Options for the op

1. A setting inside `config.set` with the whole list as `value` and `baseAt`, `baseBy`. Two admins adding two different people conflict; the audit event holds two lists and no target person.
2. Own ops `admin.add { email }` and `admin.remove { email }`. Each is a delta applied to the fresh list in the lock, so no write can overwrite another admin's change and no base is needed; a repeat answers `changed: false`. The audit event names the person in `targetId`.

Decision: option 2. This replaces the orchestrator's "stale-write refusal as in `config.set`": a delta has no stale base to refuse.

### Mechanism

- Admin = `ADMIN_EMAILS` or `ADMIN_GROUP` member or in `admins` of the index. `isAdminEmail` gains a fourth input, the in-app addresses. `subjectFor` checks the two properties first and reads the index (`loadIndex`, Script Cache) only when both say no.
- In-lock re-check: dispatch `recheck` for admin rows passes the in-lock index's list, so an admin removed a moment ago is refused inside the lock of every admin write, `admin.add` and `admin.remove` included.
- Who may add or remove: any admin, from any of the 3 sources. Web app only (policy surface `web`); the add-on token route is refused like every web-only op. Manage holders and users: DENIED with one denied audit row (existing rule).
- Addresses: people of the own domain only. The server checks the form (the recipient rule of spec 5.7), the domain part equals `DOMAIN`, then reads the Directory with the existing scope (`directoryUsers().get(email, { viewType: "domain_public", projection: "basic" })`, as `lookupProfile` does). Not found: refused. A group address is not a user and is refused the same way; groups go in `ADMIN_GROUP`. The stored address is the reply's `primaryEmail`, lower case, so an alias resolves to the address the caller signs in with. Other Directory errors: SERVER, nothing written. Reason for a check here while recipients have none (Q38): a typo in a privilege grant hands admin to whoever gets that address later.
- Cap: 20 addresses in the list. The 21st add is refused.
- No lockout: `ADMIN_EMAILS` is out of the app's reach (no op writes a Script Property), and `setup()` seeds it with the owner. So the app can empty its own list and admins still exist. An admin cannot remove themself (refused by the server; the UI hides the button on the own row). Two admins removing each other at once: the lock serializes them; the second finds itself removed in the re-check and gets DENIED, so one stays.
- The list cannot hold or remove a break-glass or group admin: `admin.remove` edits only `admins`. Removing the owner's break-glass entry is impossible by design; the Settings section shows `ADMIN_EMAILS` and `ADMIN_GROUP` read only.
- Effect timing: the change commits with `INDEX_REV`, so the next request of any caller sees it (Script Cache index chunks are keyed by `INDEX_REV`). The caller's page updates from the op result. The membership snapshot (`members.json`) is not touched. The add-on User Cache `view:*` (10 min) can show a new admin's sidebar without the extra folders, or a removed admin's sidebar with them; the server re-checks on every `template.apply`, so nothing is inserted that the server refuses.
- A removed admin with a page open: data already on screen stays until reload; every next op is refused (DENIED). Accepted.
- Audit: one durable event per change in the same commit: `admin.add` or `admin.remove`, `targetType: admin`, `targetId` the address, `before` and `after` `{ email, admin: true|false }`. `changed: false` writes nothing. Log line: `targetId: ""`, as `config.set`.
- `backup.restore` keeps the live `admins` (a restore must not bring back a removed, possibly taken-over admin). Export and import carry none. `setup()` writes none.

### Threats

| Threat | Cover |
|---|---|
| A taken-over admin account adds other accounts | Every add is an audit event with actor and target. Recovery: a Workspace admin suspends the account; the owner (break-glass) removes the added addresses in Admin, Config, Settings and checks the Audit log for that actor; if the account is in `ADMIN_EMAILS`, the owner edits the property. Runbook step (slice 16) |
| A taken-over admin removes the other in-app admins | Same audit; break-glass and group admins cannot be removed in the app, so recovery always has an admin |
| A removed admin with a page still open | Server re-checks per request and in the lock; DENIED |
| An address that is not a real account | Directory check at add; refused |
| An outside address | Domain check before the Directory call; refused |
| Removing the owner's break-glass entry | No op writes Script Properties; impossible by design |
| An admin removes themself by mistake | Refused; another admin removes them |

Default deny holds: an address is admin only when one of the 3 sources lists it exactly (trim, lower case). A malformed `admins` entry grants nothing (ADR-0008 Amendment 2026-11-11, D32).

## Consequences

- Easier: one enforcement point, testable as a table. Storage never leaves the server account. D7 answers change one Script Property.
- Harder: the web app path runs every request, so its availability and owner quotas bound the product (ADR-0002). The owner's account is the blast radius: whoever controls it reads all templates. Mitigation: dedicated owner identity with 2-step verification, no other data, prod project editors limited to the owner and one backup admin (Q3). Dev pilot editors (D13) can read dev code and dev Script Cache until removed after 2.5b (ADR-0001).
- Revocation latency: up to 15 min for group changes, immediate for grant changes (apply re-checks on the server).
- Revisit when D7 is answered, when Groups Reader is granted, or if spike S2 fails all three fallbacks.

## Open questions

- Q1 (D7). Edition, nested role groups, admin API restrictions. Recommendation: keep `groupsapp_direct` until answered; flat role groups.
- Q3. Prod server owner: a licensed service account mailbox, or the owner's account with a documented handover? Recommendation: an existing licensed shared account if Migway has one (a new licence costs money); otherwise the owner's account and a handover runbook.
- Q4. OU grants inactive in v1 (GroupsApp cannot read OUs). Recommendation: accept; admins create one group per OU if needed; activate with the Directory resolver plus an admin role with user read.
- Q5. Admins see private folders. Recommendation: yes, disclosed in the quick start (BRIEF "admins see everything").
- Q6. If `drive.file` fails the token gate at `/exec`. Recommendation: a second API deployment of the same project (`USER_DEPLOYING`, `ANYONE_ANONYMOUS`) with ID-token verification as in Pattern B; adds `openid` only [A12]. Last resort: `drive.readonly` (restricted) on every user's consent list; internal apps need no verification [R4 S18], and the admin trusts the app in API controls if Migway restricts APIs [R4 S60].
- Q7. If `getActiveUser` is blank on token calls: switch to `id_token`. Recommendation: accept the config fallback now.
- Q8. If the project must be shared with callers: share the prod project as Viewer with an all-staff group. Viewers see code only; the code holds no secrets and no data, and Viewers cannot edit or deploy. Recommendation: accept.
- Q10. Audit retention 24 months. Recommendation: accept.
- Q62 to Q66 (spec 15, D32): cap 20, no self-removal, Directory check, any admin may remove any in-app admin, no email to the new admin.

## Sources

- [R4 S2, S6, S11, S12, S19 to S25, S45, S49, S57, S74, S77, S78, S81] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A1] https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script, third party, read 2026-11-09.
- [A4] https://developers.google.com/apps-script/reference/script/script-app (`getIdentityToken`, `getOAuthToken`), read 2026-11-09.
- [A5] https://developers.google.com/workspace/add-ons/concepts/event-objects (recipients are email strings), read 2026-11-09.
- [A12] https://developers.google.com/apps-script/guides/web ("Deploy a script as a web app" steps: Deploy > New deployment > Web app > Deployment configuration), read 2026-11-09.
