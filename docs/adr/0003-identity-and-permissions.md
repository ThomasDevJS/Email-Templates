# ADR-0003: Execution identity and permission model

Status: Proposed
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

Binding: D8 accepted (web app "execute as me" is the single server, storage private to it, add-on fetches through it, GroupsApp on flat role groups, Groups Reader later). D7 open: assume Business Standard or lower, flat role groups, no admin API restrictions. D11 accepted: one private folder per user. BRIEF 1: default deny, server-side enforcement, admins see everything.

## Part A. Add-on to server call pattern

### Options

1. Pattern A, access token plus active user. Server project deployed as web app, `executeAs: USER_DEPLOYING`, `access: DOMAIN`. Add-on calls `UrlFetchApp.fetch(SERVER_URL, { method: 'post', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON })`. Google authenticates the token at the `/exec` front door and rejects non-domain callers. `doPost` reads the caller from `Session.getActiveUser().getEmail()` [R4 S45]. Identity cannot be forged, because Google sets it from the token. Cost: the add-on token must carry a Drive scope [A1]; `drive.file` is non-sensitive [R4 S57] if Google accepts it (unverified). Possibly the server project must be shared as Viewer with callers [A1]. Same code path as the web app UI, which also uses `getActiveUser`.
2. Pattern B, ID token. Server deployed with `access: ANYONE_ANONYMOUS`. Add-on sends `ScriptApp.getIdentityToken()` [A4]. Server verifies it with Google's tokeninfo endpoint (`aud` equals the add-on OAuth client ID, `iss`, `exp`, `email_verified`, `hd` equals the Migway domain), caching the result for the token's remaining life. Cost: endpoint is publicly reachable; one extra UrlFetch per new token; needs `openid` scope; the HTML editor on the same deployment cannot identify users (anonymous access gives no active user), so the UI would need a second deployment or project. Admins can disable public web app access for the domain (unverified), which would break it.
3. Pattern C, precomputed per-user index. Server writes each user's visible templates to a file shared to that user only, or to a cache the add-on can read. The add-on reads it without a server call. Cost: fan-out of up to 500 writes per grant or template change; per-user files expose content in Drive (only content the user may see, but outside the app's audit); a Script Cache is per project, so the separate add-on project (ADR-0001) cannot read the server's cache; in a single project, every script editor (D13 pilot users) could read every cached body. Apply-time revocation is lost.

### Decision, Part A

Pattern A, with Pattern B's ID-token check as a config fallback.

- Default `CALLER_IDENTITY=active_user`. The server rejects any request where `getActiveUser().getEmail()` is blank, or not in the configured domain, with `AUTH_NO_USER` (HTTP-style code in the JSON body) and logs it. Default deny: no anonymous path exists.
- Fallback `CALLER_IDENTITY=id_token`. Used only if slice 2 shows `getActiveUser` is blank for token calls. The add-on adds `openid` and `userinfo.email`, sends the ID token in the JSON body, and the server verifies it via tokeninfo as in Pattern B, while keeping `access: DOMAIN` so the front door still requires a domain token. Config change plus one scope, no redesign.
- Add-on manifest: `urlFetchWhitelist` lists `https://script.google.com/macros/s/` and `https://script.googleusercontent.com/` (the `/exec` response redirects there) [R4 S6].
- Request shape: `{ op, args, requestId, clientVersion }`. Response: `{ ok, data | error: { code, message, retryable }, serverVersion, durationMs }`.
- Add-on keeps the filtered result in its own User Cache for 10 min (ADR-0002). The data there is only what the server already allowed this user to see.

Spike S2 (slice 2, first task) settles three unknowns before slice 2 code: (a) does a `drive.file` token pass the `/exec` front door with `access: DOMAIN`, (b) is `getActiveUser` set on token calls, (c) must the server project be shared with callers. Outcomes map to Q6, Q7, Q8.

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
- Snapshot refresh: time trigger every 15 min runs `listMembers` for each g in G, writes `group_members` rows (durable) and Script Cache `gm:<g>` (60 min TTL). GroupsApp reads per day: 30 groups x 96 runs = 2,880, under 10,000 [R4 S2].
- Request path reads only the snapshot (cache, then `group_members` tab). It never calls GroupsApp, so user traffic cannot exhaust the quota.
- Principals for a caller: `user:<email>`, `domain:<domain>`, `group:<g>` for each g whose snapshot contains the email, `ou:<path>` only when `capabilities.orgUnits` is true.
- Nested groups with `groupsapp_direct`: refresh records child groups from `nestedGroups`; the admin UI flags "Group X contains group Y. Members of Y get no access until the resolver supports nesting."
- Max staleness: 15 min after a Google Groups change. Admin UI has "Refresh memberships now" (admin only, under lock).
- Switch to `directory` after an admin grants Groups Reader to the server owner (2.5b): adds scope `admin.directory.group.member.readonly` (owner consent only), `nested: true`. `cloud_identity` needs Enterprise or Cloud Identity Premium plus a standard GCP project.
- OU grants: `groupsapp_direct` cannot resolve OUs. Grants to OUs are stored but inactive and shown as "Inactive: OU resolution needs the Directory resolver" (Q4).

Admin role: member of `ADMIN_GROUP` (Script Property, group email) via the snapshot, or listed in `ADMIN_EMAILS` (Script Property, break-glass, initial value the owner). Admin membership is never granted in-app.

## Part C. Permission model

Default deny. No grant means no access. No deny entries.

Grant: `(folderId, principal, level)`, level `use` < `edit` < `manage`. Effective level of a caller on folder F = maximum level over grants on F and every ancestor of F whose principal is in the caller's principal set. Admin = `manage` on every folder, including private folders (BRIEF 1, Q5). Templates inherit their folder's level; no per-template grants in v1. A move recomputes levels from the new ancestors.

Roles map to levels: user = holds `use` only; manager-editor = holds `edit` or `manage` on some folder; admin = global. New folders get no grants, so only admins and `manage` holders of the parent see them (ux-notes.md section 2).

Private folder (D11): created on first use for every caller, `kind=private`, `ownerEmail=<caller>`. Owner has `edit` on it. Grants on private folders are rejected in v1. Admins see it.

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
| Private folder of self | edit | edit | edit | yes |

Enforcement mechanism:

- One entry point. `doPost` (add-on) and one `google.script.run` function `rpc(op, args)` (web app) both call `dispatch(caller, op, args)`. All other server functions end with `_`, so the client cannot call them [R4 S49].
- `dispatch` looks up `op` in a policy table: `{ op, requiredLevel, targetResolver }`. It resolves the target folder(s), computes the effective level, and denies before the handler runs. Denied requests return `DENIED` and write an audit row.
- A unit test enumerates the policy table and fails if any handler has no policy row. A second test checks every role matrix cell above (BRIEF 9).
- List and search results are filtered by the same level function, so hidden templates never leave the server.

## Part D. Audit trail and logging

Audit row (tab `audit`, append-only, server writes only):

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

Retention: 24 months (Q10). At 300,000 rows the tab moves to an archive spreadsheet.

Structured log (BRIEF 10): one JSON line per request via `console.log(JSON.stringify(...))`. Fields: `ts, level, requestId, surface, action, actor, targetId, result, errorCode, durationMs, cache (hit|miss|rebuild), appVersion`. Logs never contain template bodies, prompt values or recipient addresses.

## Consequences

- Easier: one enforcement point, testable as a table. Storage never leaves the server account. D7 answers change one Script Property.
- Harder: server runs every request, so its availability and owner quotas bound the product (ADR-0002). The server owner's account is the blast radius: whoever controls it reads all templates. Mitigation: dedicated owner identity with 2-step verification, no other data, script editors limited to the owner and one backup admin (Q3).
- Revocation latency: up to 15 min for group changes, immediate for grant changes (apply re-checks on the server).
- Revisit when D7 is answered, when Groups Reader is granted, or if spike S2 fails all three fallbacks.

## Open questions

- Q1 (D7). Edition, nested role groups, admin API restrictions. Recommendation: keep `groupsapp_direct` until answered; flat role groups.
- Q3. Prod server owner: a licensed service account mailbox, or the owner's account with a documented handover? Recommendation: an existing licensed shared account if Migway has one (a new licence costs money); otherwise the owner's account and a handover runbook.
- Q4. OU grants inactive in v1 (GroupsApp cannot read OUs). Recommendation: accept; admins create one group per OU if needed; activate with the Directory resolver plus an admin role with user read.
- Q5. Admins see private folders. Recommendation: yes, disclosed in the quick start (BRIEF "admins see everything").
- Q6. If `drive.file` fails the token gate, the add-on needs `drive.readonly` (restricted). Recommendation: then ask the owner to choose between `drive.readonly` (restricted, no verification for an internal app [R4 S18]) and Pattern B with a small third Apps Script project as the anonymous API, because web app access is set per project manifest.
- Q7. If `getActiveUser` is blank on token calls: switch to `id_token`. Recommendation: accept the config fallback now.
- Q8. If the server project must be shared with callers: share it as Viewer with an all-staff group. Viewers see code only; the code holds no secrets and no data. Recommendation: accept.
- Q10. Audit retention 24 months. Recommendation: accept.

## Sources

- [R4 S2, S6, S11, S12, S19 to S25, S45, S49, S57, S74, S77, S78, S81] in docs/research/r4-platform-constraints.md, read 2026-11-09.
- [A1] https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script, third party, read 2026-11-09.
- [A4] https://developers.google.com/apps-script/reference/script/script-app (`getIdentityToken`, `getOAuthToken`), read 2026-11-09.
- [A5] https://developers.google.com/workspace/add-ons/concepts/event-objects (recipients are email strings), read 2026-11-09.
