# ADR-0008: In-app admin settings (personal templates, outside recipients)

Status: Proposed
Date: 2026-11-10
Deciders: owner (thomas@migway.com), architect

## Context

| Fact | Source |
|---|---|
| Owner (D29, 2026-11-10): admins enable or disable creation of personal templates; for now the tool is for company templates | PLAN D29 |
| Orchestrator from D29: default off; two admin switches now exist, so in-app settings are built in v1 (Q32 moves from v1.1 to v1) | PLAN D29 |
| D26: outside recipients allowed by default, with a switch; today Script Property `RECIPIENTS_EXTERNAL` (`allow`, `deny`), owner-set, read only in the Config tab | ADR-0006 section 2, spec 5.7 |
| D11: every caller gets one private folder "My templates" on first use. Today `folder.list` creates it (`ensurePrivateFolder`, src/server/handlers/folders.ts); no other op creates it | source read 2026-11-10 |
| D18: admins hold `manage` on every folder, private ones included. `sidebar.home` hides other users' private folders | ADR-0003 Part C, spec 2 |
| Every level in the server comes from one function, `levelResolver(subject, index)` (src/shared/permissions/effective.ts). It is called in 3 places: the request context, the in-lock re-check of every commit (`commit` calls `recheck` on the fresh index), and `folder.list` after it created a folder | source read 2026-11-10 |
| Every op loads `index.json` before its handler (dispatch). Script Properties are read once per execution with one `getProperties` (slice 4b, `snapshotProps`) | source, spec 12.1 |
| A change event goes into `pendingAudit` inside the same `index.json` write as the change (ADR-0002) | ADR-0002, ADR-0003 Amendment 2026-11-10 |
| Prod starts empty (Q30). Dev has private folders with templates (owner and pilot) | PLAN D25, Q30 |
| The add-on caches the sidebar view `view:*` for 10 min in its User Cache | ADR-0003 Part A |

## 1. Where settings live and who may change them

Options:
1. Script Properties, one key per setting (`PERSONAL_TEMPLATES`, `RECIPIENTS_EXTERNAL`), written by an admin-only op with `setProperty`. Read: 0 extra calls (the per-execution snapshot). Visible to every request that starts after the write. Costs: the in-lock re-check of a write uses the snapshot taken at request start, so a write that started before the change commits under the old value unless the lock path re-reads the property live (1 more call per write). The audit event needs its own `index.json` commit, so the change and its event are two writes; a failure between them leaves an unaudited change. Script editors can change the key in the editor with no audit. Not in the daily backup.
2. A `settings` object in `index.json`, changed by an admin-only op through the normal `commit`. Read: 0 extra calls, every op already loads the index. The change and its audit event are one Drive write (2.0 to 2.7 s measured for saves, spec 12.1). Cache invalidation comes free: the commit raises `INDEX_REV`, so the next request reads the new index. The in-lock re-check of every write runs `levelResolver` on the fresh index, so a write racing a change is refused under the new value. The file is not editable by hand (`drive.file`). Costs: a shape check entry and defaults for an absent object; about 200 bytes of index.
3. A side file `settings.json` with a `SETTINGS_REV` property, like favorites. One more cache read per request, one more file, one more revision key, and the in-lock re-check would read a second file. No gain over option 2.

Decision: option 2.

Mechanism:
- Index field `settings`, optional. Shape: `{ personalTemplates: { value, updatedAt, updatedBy }, recipientsExternal: { value, updatedAt, updatedBy } }`. An absent object or absent entry reads as the default with `updatedAt: ""`, `updatedBy: ""`. `readIndexDoc` fills the defaults; the shape check refuses a present entry whose `value` is not in its allowed list (damaged file, INTERNAL, spec 16.2).
- Fixed list in src/shared (one table): `personalTemplates`: `on`, `off`, default `off`. `recipientsExternal`: `allow`, `deny`, default `allow`.
- Who may change: admins only (`ADMIN_GROUP` member or `ADMIN_EMAILS`), web app only. Manage holders and users never see or change settings. The policy row is admin, so dispatch re-reads the membership snapshot inside the lock before the write (spec 6, admin rows).
- Delay: server checks use the new value from the next request on. A request already running when the change commits keeps the old value for reads; its writes re-check in the lock on the fresh index and follow the new value. Web app controls follow on the next library load; until then the server refuses. The sidebar can show its cached view for up to 10 min; under the "off" rules below nothing in that view becomes reachable that the server would refuse.
- Two admins at once: the op carries `from`, the value the admin saw. In the lock, a current value different from `from` answers CONFLICT with who and when; nothing is written. A current value equal to the new value answers ok with `changed: false`, no write, no audit event.
- Fresh install: `setup()` writes no settings. An absent object means the defaults (`off`, `allow`). `setup()` is idempotent and never resets an admin's choice. An index from before this change (dev) also reads as the defaults: personal templates turn off on dev at the deploy (Q47).
- Backup restore keeps the live `settings`, as it keeps the live `pendingAudit`: a restore of template data must not revert a security choice. The restore event lists no settings.
- Export and import carry no settings.
- Script Property `RECIPIENTS_EXTERNAL` is retired. Readers use `settings.recipientsExternal` (Q50).
- Rollback to a build before this change ignores `settings`: personal templates behave as D11 (on) and recipients read the old property (unset = `allow`). Recorded for the rollback exercise.

## 2. The op

Options:
1. One op per setting (`config.setPersonalTemplates`, `config.setRecipientsExternal`). Two policy rows, two handlers, the same code twice; a third setting adds a third op.
2. One op `config.set` with `{ name, value, from }` against the fixed list. One policy row, one handler, one test table; a new setting is one row in the list plus its texts.

Decision: option 2.

| Item | Value |
|---|---|
| Op | `config.set` |
| Args | `name` (`personalTemplates` or `recipientsExternal`), `value` (from that setting's list), `from` (the value the admin saw, same list) |
| Level | admin (policy action `admin.ops`, like `config.get`); in-lock admin re-check |
| Surface | web only; the add-on surface answers DENIED like every `web` row |
| Validation | unknown `name`, a `value` or `from` outside the setting's list, a missing arg, any extra arg: VALIDATION "Setting <name> does not exist." or "Setting <name> takes on or off." (the allowed values in words). No denied row (spec 11.1) |
| Default deny | a caller who is not an admin gets DENIED and one denied audit row |
| Result | `{ name, value, updatedAt, updatedBy, changed }` |
| Conflict | CONFLICT "<name of the other admin> changed this setting at <local time>. The page now shows the current value." with the current entry in the error details |
| Audit event | `action: config.set`, `targetType: config`, `targetId: <setting name>`, `targetPath: ""`, `before: { name, value }`, `after: { name, value }`, through `pendingAudit` in the same commit |
| Log line | closed field list of spec 11, no new field: `action: config.set`, `targetId: ""` (the name is not an ID), `result` ok, conflict, denied or error. The value is not logged; the audit event holds it |

`config.get` returns `settings`: each entry with `value`, `updatedAt`, `updatedBy`. `me` returns `personalTemplates` and `recipientsExternal` (values only) for the editor and the library. `sidebar.home` returns `personalTemplates` for the empty card.

## 3. Personal templates switch: what "off" means

Options for a user who already has a private folder with templates:
1. Hidden and unusable until re-enabled. The private tree resolves to `none` for its owner. Fits "company templates only" most strictly. Cost: on dev, and whenever the switch goes off later, users lose sight of their own texts, favorites and Recent entries break silently, and the user has no copy outside the tool.
2. Visible and insertable, no create, edit or duplicate into it. The private tree resolves to `use`. The owner keeps reading and inserting; nobody writes there. Matches the owner's words, which name creation.
3. Unchanged for existing folders, no new folders. Users who already have a folder keep creating personal templates. Defeats the switch for every dev user and for every user if the switch goes off after use.

Decision: option 2.

Mechanism, one rule in `levelResolver`: while `settings.personalTemplates` is `off`, a folder in a private tree resolves to `use` for its owner and for admins, `none` for everyone else. The check runs before the admin rule (admins otherwise get `manage`). Every op of spec 6 gets its level from this function, both before the handler and in the in-lock re-check, so no op needs its own branch. One more rule outside levels: `folder.list` creates no private folder while off. The DENIED text for a target in a private tree while off is "Personal templates are turned off by your admin." (dispatch picks it when the setting is off and a target sits in a private tree).

Options for admins (D18):
1. Admins keep `manage` on private folders while off, so they can move personal templates out, delete them or export them. Needs the rule "a private folder is never a write target" per op (create, update, duplicate, move, restore, version restore, import) in place of one level rule: 7 checks to keep in step.
2. Admins drop to `use` like the owner. One rule. An admin who wants to clean up or promote a personal template turns the switch on, does the work, turns it off; the audit log holds both changes.

Decision: option 2 (Q48).

| Case | Off | On |
|---|---|---|
| User with no private folder | none created; no "My templates" anywhere | created by `folder.list` on first library load (D11) |
| Owner, existing private folder | sees it in library and sidebar, inserts, previews, favorites, Recent, search: yes. Create, edit, duplicate (in or out), move (in or out), delete, restore from trash, version history and restore: no | all, level `edit` |
| Admin, other users' private folders | sees them in the library (D18), level `use`: list, open, preview. No write, no export folder. The sidebar keeps hiding them (D18) | `manage` (today) |
| Other users | nothing (today) | nothing |
| Sidebar and compose card | own "My templates" with its count, favorites and Recent into it, search hits in it: unchanged | unchanged |
| Move, duplicate, restore from trash with a private source or target | DENIED with the off text | edit on source and target |
| Import into a private folder | VALIDATION (today, D11) | VALIDATION |
| Trash: templates deleted from a private folder | stay in the trash; hidden from the owner's Trash view (it lists editable folders); restore refused; the daily purge still removes them after 30 days | restore as today |
| Turning on again | every private folder, template, version, favorite and Recent entry is where it was; new users get their folder on next library load. Only the 30-day trash purge removes anything, as it does when on | |

## 4. Outside recipients switch (D26)

Options:
1. Keep the owner-set Script Property and add only personal templates in-app. Two mechanisms for two switches; the recipients change stays unaudited.
2. Move it into the same `settings` object, values `allow` and `deny`, default `allow`, changed with `config.set`. ADR-0006 behavior unchanged: `deny` refuses outside addresses at save (`RCPT_EXTERNAL`) and `template.apply` returns them in `blocked`.

Decision: option 2. Every reader of `RECIPIENTS_EXTERNAL` built in slice 9 reads `settings.recipientsExternal` from the request's index instead (spec 6 list).

## 5. Settings section in the Config tab

Options:
1. A switch that saves on click. Fast, but one click takes something away from every user with no confirmation, and the design system has no switch component.
2. A radio group per setting with its own Save button; Save asks for a confirmation when the change takes something away (personal templates `on` to `off`, recipients `allow` to `deny`).

Decision: option 2. Layout in wireframe 06 (Config tab) and texts in spec 7.3. Enforcement points per op: spec 5.8. The section sits first in the Config tab, above the read-only environment rows. Each setting: name as a fieldset legend, one sentence of what changes for users, the radio group with the current value checked, Save (disabled while the choice equals the current value), and "Last change: <name> on <local time>" or "Default, never changed." Non-admins never see it: the Config tab is admin only and `config.get` and `config.set` answer DENIED to anyone else.

## Consequences

- Easier: one storage path, one cache path, one audit path for settings. A third setting is one row in the fixed list, its texts and its enforcement. The off rule lives in one function that the role matrix test already exercises.
- Harder: while off, a user cannot delete or move their own personal templates, and an admin must turn the switch on to clean up (Q48). Dev loses personal creation at the deploy unless the owner turns it on (Q47).
- `RECIPIENTS_EXTERNAL` leaves the Script Properties list; a value set on dev is ignored (Q50).
- Revisit when the owner asks for a third setting (Q49), or if users need to keep their personal texts outside the tool while off (an export of one's own private folder; not in v1).

## Open questions

Q47 to Q52 in spec 15, each with a recommendation.

## Sources

- Source files read 2026-11-10 (read only): src/shared/permissions/effective.ts, src/server/handlers/folders.ts, src/server/handlers/sidebar.ts, src/server/handlers/config.ts, src/server/dispatch/policy.ts, src/server/dispatch/dispatch.ts, src/server/metrics.ts, src/server/jobs/setup.ts, src/server/cache/indexCache.ts, src/shared/model/data.ts, src/shared/model/shape.ts, src/web/views/library.ts, src/addon/cards/home.ts.
- PLAN.md D11, D18, D26, D29, read 2026-11-10. ADR-0002, ADR-0003, ADR-0006. docs/design/design-system.md (components, wording).
