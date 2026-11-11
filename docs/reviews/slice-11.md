# Review: slice 11, admin settings (D29)

Date: 2026-11-11. Branch `slice/11-admin-settings`, base 3e78c62, head f84a021 (7 commits). Reviewer agent.

## Verdict: PASS

All 9 acceptance criteria hold. Every check passed from a clean install. Privilege probes, off-rule probes, race probes and data-safety probes found no write that should be refused. 8 minors below, none blocks the merge.

## Commands (worktree, clean install)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | exit 0 |
| `npm run lint` | exit 0, clean |
| `npm run typecheck` | exit 0, clean |
| `npm run test:coverage` | 64 files, 1664 tests passed. All files 95.79 statements, 89.79 branches, 96.68 lines (addon 100, server 99.31, shared 100, web 91.92 lines) |
| `npm run build -- --env dev` | Code.js 351.4 KB of 800 KB, index.html 359.5 KB of 400 KB |
| `npm run scopes:check` | 10 scopes, all approved |
| `npm run format:check` | clean |
| `npm run lighthouse` | 14 of 14 views at 100, incl. "admin config", "admin config dark", "library personal off" |

No change to appsscript.json, package.json, package-lock.json, scripts/approved-scopes.json, scripts/lib (`inlineHtml`), src/entry.ts or the entry point list. test/unit/server/entry.test.ts (warm call counts) unchanged and green.

Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, eyJ): 0 hits. Emails added: example.com test addresses and `name@company.com` only. URLs added: none. No new network call.

Probes: a vitest file over `setupWorld()` in a git-archive copy (scratchpad, not committed), and Playwright against `scripts/dev-web.mjs`.

## Acceptance criteria

1. Settings storage: accept. `settings` optional (src/shared/model/data.ts:100), defaults filled per reader by `settingsOf` (src/shared/model/settings.ts:55), shape check in `indexProblem` (src/shared/model/shape.ts:74). Reads leave `rev` and the file unchanged (probe: 6 read ops x 3 callers, rev 1 before and after). `setup()` writes none (test). `backup.restore` keeps live settings (src/server/handlers/config.ts:238).
2. `config.set`: accept. Policy row `web("admin.ops")` (policy.ts:95). Fixed names and values, extra args refused (config.ts:262-281). Same value: `changed: false`, no write. One audit event with before and after. Log line `targetId: ""`, no value (test and probe).
3. Off rule: accept. One rule before the admin rule (src/shared/permissions/effective.ts:116). `folder.list` creates none while off (src/server/handlers/folders.ts:68), also re-checked in the commit callback (probe: a `folder.list` that started while on and locked after off created no folder). 198 table cases in test/unit/server/settings.test.ts.
4. Recipients: accept. No reader of `RECIPIENTS_EXTERNAL` in src. `config.get` keys: domain, adminGroup, resolver, callerIdentity, settings, indexRev, appVersion, indexBytes, indexWarnBytes, jobs, triggersError.
5. Fields: accept. `me` adds `personalTemplates`, `recipientsExternal` (values only). `sidebar.home` adds `personalTemplates`. No who or when outside `config.get`.
6. Config tab: accept with minors 3 and 4.
7. Off texts: accept. Library note, empty state, add-on card A2 match spec 7 and the handoff.
8. Guides and smoke: accept. Smoke "Slice 11" has 10 steps. Quick start carries the Q52 sentence. Minor 6.
9. Scopes and budgets: accept (see commands).

## Judgements a to k

a. Privilege: accept. `config.set` as no grant, use, edit, manage holder and a non-admin owner of a private folder: DENIED. Owner on the add-on surface: DENIED. Names `__proto__`, `constructor`, `toString`, `hasOwnProperty`, a JSON `__proto__` key, a 5,000-char value, `from` 1, null, array or missing, `OFF`, `" off"`, args null, string or array: all VALIDATION, nothing written. `isSettingName` uses `hasOwnProperty` on the fixed list (settings.ts:30). The 11 exports are unchanged; a non-admin script editor reaches `config.set` only through `rpc`/`doPost` and `dispatch`. In-lock re-check: `configSet` calls `context.recheck(current)` on `loadIndexForWrite` (config.ts:297); a caller removed from `ADMIN_EMAILS` between authorize and lock gets DENIED. Two admins changing two settings at once: both kept (`{ ...latest.settings, [name]: after }`, config.ts:322). Same setting at once: the second gets `changed: false`. See minor 1 for the A-B-A case.

b. Off rule: accept. 20 write probes on a private folder while off (create, update, duplicate inside, in and out, move in and out, delete, restore from trash with private source or target, version restore, folder create, move into, rename, delete, grant.add, grant.list, export.folder) answer DENIED "Personal templates are turned off by your admin." for owner and admin. Import into a private folder: VALIDATION for the admin (unchanged). Folders, grants and items byte-identical after the 40 calls. Races (switch turned off between authorize and lock): template.update, template.create, version.restore by the owner and template.move into a private folder by an admin all DENIED with the off text in the lock. No path other than `ensurePrivateFolder` creates a private folder (grep `kind: "private"`). A new user and an admin without a folder get none from folder.list, sidebar.home, template.list, search, me, admin.folders on web and add-on.

c. Reads while off: accept. Owner on web and add-on: folder.list, sidebar.home, template.list, search, search.body, template.get, template.getBody, template.apply, me all ok. Drive calls during the 18 reads: 0 (0 writes). Favorites and Recent still list the private template. favorite.set and favorite.unset still work (spec 5.8 allows).

d. Deviations.
   1. `grant.list` (and `grant.add`) on a private folder answer DENIED with the off text for admins while off; spec 5.8:322 says "unchanged" (VALIDATION). ADR-0008 section 3 and the ADR-0003 D29 amendment (line 117) make the private tree `use` for admins while off, so DENIED is the consistent result. Grants on private folders are refused and ignored (D11), so the list hides nothing an admin needs. Accept; spec 5.8 row needs an erratum.
   2. `admin.folders` drops private folders while off (the handler keeps `manage` folders, src/server/handlers/admin.ts:35, unchanged code). Spec 5.8:326 says "unchanged; private folders show no forms". Admins still see private folders and their templates in the library at `use` (folder.list probe; settings.test.ts "lets an admin read other users' private folders"), so D18 disclosure holds. Accept; spec erratum.
   3. CONFLICT with two values: reasoning confirmed. `from != current` and `value != current` force `value == from`, which the UI never sends (Save disabled until a change). A stale page whose new value equals the current one gets `changed: false` and the conflict text (adminSettings.ts:65). Not covered: minor 1.

e. On again: accept. Off, then 18 reads, then on: folders, grants, items, favorites and usage side files identical; versions listed; the owner edits again. Private trash while off: hidden from the owner's Trash view, restore refused, and `daily` purges it after 30 days (probe: purged at day 31). ADR-0008 line 92 and spec 5.8 ("private trash included") decide this, and Q48 accepts that an admin turns the switch on to clean up. Acceptable; the owner is not told. The quick start says nothing is deleted while off; true except the normal 30-day purge of templates already in the trash.

f. Outside recipients: accept. Property `RECIPIENTS_EXTERNAL=deny` set, setting `allow`: an outside address saves (Q50). Setting `deny`: save refused (VALIDATION, 1 problem); the stored address comes back in `blocked` from template.apply. `config.get` no longer returns the property. Minor 2.

g. Backups: accept. A backup holding `personalTemplates: on` restored over a live `off`: live `off` kept, audit row `backup.restore`. A backup whose index has a bad `settings` entry: VALIDATION "This backup cannot be read: index.json is damaged: settings personalTemplates has a bad entry" while the lock was held elsewhere (checked before the lock). Old index without `settings` loads on every path (all 1664 tests run on such data). Minor 7.

h. Exposure: accept. Who and when only in `config.get` (admin, web) and the CONFLICT details (admin only). Audit event holds before and after. Log line holds no value. Longest log line in the weird-args probe: 920 chars.

i. UI (Chromium, dev harness): accept with minors 3 and 4. Radios move by arrow keys; Save disabled until the choice differs; confirm dialogs for on to off and allow to deny with Cancel focused, Tab reaches the action; Escape cancels; last change line updates; non-admin (`?admin=0`) gets no Config tab. Library off: note above the list on My templates, no "New template" there, button kept on Sales; no-folder empty state. 390 px: scrollWidth 390 on config, library off and empty state.

j. Scope: accept. src/addon change is home.ts `emptySection(view)` only. Editor view and its tests untouched.

k. Clean run: see commands. All exit 0.

## Minors (not blocking)

1. A-B-A overwrite: admin A loads `off`; B sets `on`, C sets `off`; A saves `on` with `from: off` and commits silently over C (probe). `from` is a value, so the server cannot see the newer change (config.ts:302). Spec 5.8 defines `from` this way. Fix if wanted: send `updatedAt` as the base. Audit shows all three changes.
2. Recipient policy is read from the request's pre-lock index (body.ts:128 via `recipientPolicy`), not re-checked in the lock. Probe: a save with an outside address authorized under `allow` and locked after `deny` stores it. ADR-0008 line 35 says writes follow the new value. Impact low: Insert marks it `blocked`.
3. Focus drops to BODY after Save: Save is disabled while focused (adminSettings.ts:57, then `sync()` keeps it disabled), and the dialog's `returnFocus: save` (line 101) targets a disabled button. Keyboard users restart from the top of the page.
4. Client CONFLICT branch (adminSettings.ts:72) shows the server text "The page now shows the current value." but does not apply `details`; the radio keeps the stale choice. Unreachable with two values (deviation 3); needed before a third value.
5. VALIDATION echoes the client's setting name unbounded (config.ts:270): a 5,000-char name comes back in the message. Admin callers only; not logged.
6. Smoke "Slice 9" steps 5 and 6 (docs/ops/smoke.md:145-146) still tell the tester to set `RECIPIENTS_EXTERNAL`, which no code reads now. Rewrite to the Config tab setting.
7. The `backup.restore` audit event does not record that live settings were kept (config.ts:233); the fact is visible only by the unchanged `updatedAt`.
8. Spec errata: 5.8 rows `grant.*` (now DENIED with the off text for admins, also `grant.add`) and `admin.folders` (private folders dropped while off); ADR-0008 line 32 says `readIndexDoc` fills defaults, built in `settingsOf` (deviation 5, accepted: no read path can persist a default).

## Data safety on dev

Dev index has no `settings`: reads as `off` and `allow`. The two private folders resolve to `use` for their owners: list, search, preview, insert, favorites and Recent work, 0 Drive writes on those reads. Nothing is deleted or rewritten by a read. Templates already in a private trash are purged by `daily` after 30 days as before.
