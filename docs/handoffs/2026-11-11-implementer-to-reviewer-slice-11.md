# Handoff: implementer to reviewer, slice 11 (admin settings, D29)

Date: 2026-11-11. Branch `slice/11-admin-settings`, base 3e78c62, 5 commits (fff14ab to the handoff commit). Not merged, not pushed. A previous run was cut off by a restart; its uncommitted server work was kept after review (one fix: the CONFLICT text) and completed here.

## Done

Spec 13.8 items 1 to 8, ADR-0008 as decided (Q47 to Q52).

- Shared `src/shared/model/settings.ts`: fixed list `SETTINGS` (`personalTemplates` on/off default off, `recipientsExternal` allow/deny default allow), `settingsOf`, `settingValue`, `personalTemplatesOn`, `settingsProblem` (shape check, called from `indexProblem`), `allowedWords`, `PERSONAL_OFF_TEXT`. `IndexDoc.settings` optional. Defaults are filled at read time by `settingsOf`, never written: `readIndexDoc` is unchanged, so an index from before the slice stays byte-identical until an admin saves a setting.
- `config.set` (src/server/handlers/config.ts): policy row `web("admin.ops")`; args checked against the list (extra arg, missing arg, unknown name or value: VALIDATION); under the lock on `loadIndexForWrite`: dispatch admin re-check, same value answers `changed: false` with no write, a current value other than `from` answers CONFLICT with the entry in `details`; else one `commitLocked` with one `config.set` event (`targetType: config`, `targetId` = name, before/after `{ name, value }`). Log line: `action: config.set`, `targetId: ""` (no `id`/`folderId` arg), no value.
- Off rule in `levelResolver` (src/shared/permissions/effective.ts), before the admin rule: private tree = `use` for owner and admins, `none` for others. `folder.list` creates no private folder while off. Dispatch picks the off DENIED text when the setting is off and a target sits in a private tree, both in the pre-lock check and in the in-lock re-check.
- Recipients: `recipientPolicy(context)` reads `settings.recipientsExternal` from the request's index. `RECIPIENTS_EXTERNAL_KEY` and `externalRule` are deleted; no code reads the property. `config.get` returns `settings` in place of `recipientsExternal`.
- `me` adds `personalTemplates`; `sidebar.home` adds `personalTemplates`. Nothing else is added.
- `backup.restore` keeps the live `settings`. `setup()` writes none (test).
- Web: Config tab "Settings" section first (src/web/views/adminSettings.ts, texts in `settingTexts`, `lastChangeText`, `conflictText` in src/web/admin/model.ts); the read-only list is now headed "Environment"; the `RECIPIENTS_EXTERNAL` row is gone. Library: off line above the list for a private folder at `use`; empty state for a caller with no folder. DENIED with the off text shows that text (`messageOf`). Audit words: `config.set` = "Setting changed".
- Add-on: home empty card A2 when `personalTemplates` is `off` (src/addon/cards/home.ts, `emptySection(view)` only). No other add-on change.
- Dev harness: `config.get` settings, `config.set`, `?personal=off`, `?access=none`. Lighthouse adds "library personal off" and "admin config dark".
- Docs: admin guide "Settings (Config tab)", quick start paragraph and Q52 sentence, editor guide 2 lines (the property text was wrong after this slice), smoke "Slice 11" (10 steps). Runbook names no `RECIPIENTS_EXTERNAL`: unchanged.

## Enforcement table as built (personalTemplates; owner / admin / other user)

Tested in test/unit/server/settings.test.ts, 198 cases (33 ops x on/off x 3 callers), plus visibility tests and the race test in races.test.ts.

| Op | On | Off |
|---|---|---|
| folder.list | ok / ok / ok; creates the caller's private folder | ok / ok / ok; creates none; existing private folder at `use` |
| sidebar.home | ok / ok / ok | ok / ok / ok; own folder listed, favorites and Recent into it kept; `personalTemplates: "off"` |
| template.list, search, search.body | ok x3 | ok x3; own private templates included; the Trash view drops private trash (lists editable folders) |
| template.get, template.getBody, template.apply, favorite.set, favorite.unset | ok / ok / DENIED | ok / ok / DENIED |
| template.create, update, duplicate (inside, out, in), delete, restoreFromTrash, move (out, in) | ok / ok / DENIED | DENIED x3, off text for owner and admin |
| version.list, version.get, version.restore | ok / ok / DENIED | DENIED x3, off text for owner and admin |
| folder.create (sub), folder.rename, folder.delete (private subfolder) | DENIED / ok / DENIED | DENIED x3, off text for admin |
| folder.move (private subfolder to shared) | DENIED / VALIDATION / DENIED | DENIED x3 |
| grant.list (private folder) | DENIED / ok / DENIED | DENIED x3 |
| export.folder (private folder) | DENIED / ok / DENIED | DENIED x3 |
| export.library, admin.folders, trash.purge | DENIED / ok / DENIED | same |
| import into a private folder | DENIED / VALIDATION / DENIED | same |
| me | ok x3 | ok x3; `personalTemplates`, `recipientsExternal` |
| config.get, config.set | admin only, web only (role matrix in adminReports.test.ts) | same |

Race: an owner's `template.update` authorized while on, with the switch turned off before its lock, answers DENIED "Personal templates are turned off by your admin." and writes nothing.

## Deviations from the spec text (decide or accept)

1. `grant.list` on a private folder while off answers DENIED for admins (spec 5.8 says "unchanged"). The level rule gives admins `use`; the policy row needs `manage`. No data is exposed either way.
2. `admin.folders` while off drops private folders from the admin Folders tab (it keeps folders at `manage`). Spec 5.8 says "unchanged; private folders show no forms". The library still lists them for admins (D18).
3. CONFLICT cannot happen with two-valued settings: `from` differs from the current value only when the current value equals the new one, which is the `changed: false` no-op. The client shows the spec 7.3 conflict text when `changed: false` returns an entry newer than the one on the page. The server CONFLICT branch stays for a future third value and is tested with a hand-made request.
4. The server CONFLICT message is "<name part> changed this setting. The page now shows the current value."; the time is added by the client (the server has no caller time zone).
5. ADR-0008 says `readIndexDoc` fills the defaults. Built: `settingsOf` fills them at each reader, so no read path can ever persist a default.

## New or changed user-facing texts

- Server DENIED (private tree, off): "Personal templates are turned off by your admin."
- Server VALIDATION: "Setting <name> does not exist.", "Setting personalTemplates takes on or off.", "Setting recipientsExternal takes allow or deny."
- Server CONFLICT: "<name part> changed this setting. The page now shows the current value."
- Config tab: heading "Settings"; legends "Personal templates", "Outside recipients"; explanations, radio labels "On", "Off", "Allowed", "<domain> only"; "Last change: <name part> on <local time>." / "Default, never changed."; Save, "Saving...", "Saved. Personal templates are on|off for every user from their next action.", "Saved. Outside recipients are allowed.", "Saved. Only <domain> recipients are allowed."; dialogs "Turn off personal templates?" (button "Turn off") and "Allow only <domain> recipients?" (button "Allow only <domain>"), bodies per spec 7.3, Cancel focused; conflict "<name part> changed this setting on <local time>. The page now shows the current value."; heading "Environment" replaces the second use of "Settings".
- Library: "Personal templates are turned off by your admin. You can still insert these templates." (line above the list, `role="note"`); "No templates shared with you yet. Ask your admin for access to a folder." (no folder visible).
- Add-on home, off and no templates: "No templates shared with you yet. Ask your admin for access to a folder." No button.
- Audit tab: "Setting changed".

## Verified, and how (clean install: `rm -rf node_modules && npm ci`)

- `npm run lint`: clean. `npm run typecheck`: clean.
- `npm run test:coverage`: 64 files, 1664 tests passed; all files 95.79 % statements, 89.79 % branches.
- `npm run build -- --env dev`: Code.js 351.4 KB of 800 KB, index.html 359.5 KB of 400 KB. `scripts/lib/html.mjs` (`inlineHtml`) unchanged.
- `npm run scopes:check`: 10 scopes, all approved. `npm run format:check`: clean.
- `npm run lighthouse`: 14 of 14 views at 100, Config tab light and dark included.
- Warm call counts: test/unit/server/entry.test.ts unchanged and green (`sidebar.home`, `search`, `template.apply`: props 1, drive 0).
- Screenshots of the Config tab (light, dark, confirm dialog) and the library off state compared with docs/design/screens/8c/config.png: same rules, widths, type and buttons.

## Data safety (dev)

Dev has no `settings`, so it reads `off` after the deploy (Q47). The two private folders with templates resolve to `use` for their owners: listed, searchable, insertable, favorites and Recent kept. No read writes the index (test: `rev` unchanged after `folder.list`, `me`, `sidebar.home`, `config.get`). Turning on again restores edit with every item unchanged (test).

## Left for later

- Admin Folders tab view of private folders while off (deviation 2), if the owner wants them listed.
- `RECIPIENTS_EXTERNAL` on dev: smoke step 1 and 10 check and remove it (Q50).
- Rollback to a pre-slice build ignores `settings` (ADR-0008); not exercised.

## Risks

- After the deploy, dev pilot users lose personal creation until the owner turns it on (Q47, accepted).
- The add-on view cache can show the "on" empty text for up to 10 min after a change; a cached view from before the deploy has no `personalTemplates` and shows the "on" text.

## Files touched

src/shared/model/settings.ts (new), data.ts, shape.ts, recipients.ts, sidebar.ts; src/shared/permissions/effective.ts; src/server/dispatch/dispatch.ts, handlers.ts, policy.ts; src/server/handlers/body.ts, config.ts, folders.ts, history.ts, identity.ts, sidebar.ts, templates.ts, transfer.ts; src/addon/cards/home.ts; src/web/views/adminSettings.ts (new), adminConfig.ts, library.ts; src/web/admin/model.ts, actions.ts; src/web/library/model.ts; src/web/rpc/api.ts; src/web/ui/status.ts; src/web/dev-harness.ts; src/web/styles.css; scripts/lighthouse.mjs; test/fakes/world.ts (`setSetting`); tests: shared/settings.test.ts (new), server/settings.test.ts (new), races, recipients, adminReports, admin, folders, search, sidebar, dispatch, permissions, addon cards/fixtures/addon/recipientFlows, web adminReports/adminModel/app/logic; docs/guide/admin-guide.md, user-quick-start.md, editor-guide.md; docs/ops/smoke.md.

## Commands

```
rm -rf node_modules && npm ci
npm run lint && npm run typecheck && npm run test:coverage
npm run build -- --env dev && npm run scopes:check && npm run format:check
npm run lighthouse
```
