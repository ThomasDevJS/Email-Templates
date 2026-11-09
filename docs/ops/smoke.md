# Smoke test (5 minutes, after each dev deploy)

## Slice 1

1. Gmail, compose: the Migway Templates card shows "Migway Templates, slice 1" within 3 s.
2. Click Ping: notification "Ping ok: server dev-<sha> sees <your email>"; the sha matches `git rev-parse --short HEAD`.
3. Open the `execUrl` from `deploy/dev.json`: page shows "Migway Templates" and "Signed in as <your email>"; Ping server shows "Ping ok".
4. Open the same URL in a window signed in to a non-Migway account: Google's access page or "Cannot identify your Migway account" appears, never the app shell.
5. Editor, Executions: each step above logged one JSON line with `level`, `action`, `result`, `durationMs`, `appVersion`, and no template body or token.

## Slice 2

Needs: the dev deployment after `npm run deploy -- dev`, and a second Migway account that is not in `ADMIN_EMAILS` (a pilot editor, D13).

1. Editor, function `setup`, Run. Execution log: one JSON line with `"action":"setup","result":"ok"`. Return value: `created` 8 on the first run, `triggers` 3. Editor, Triggers: `tick` every 5 min, `refreshMembers` every 15 min, `daily` daily 2 to 3 am.
2. Run `setup` again: `created` 0, still 3 triggers.
3. Drive, My Drive: folder "Migway Templates Data" holds `bodies`, `audit`, `backups`, `index.json`, `favorites.json`, `usage.json`, `members.json`. Open `index.json` with a text viewer: `"schemaVersion":1,"rev":1`.
4. Open the dev web app URL. Open Chrome DevTools, Console. In the context menu at the top of the Console (default "top"), pick the frame named `userCodeAppPanel`. Paste this helper once (temporary; slice 3 brings the UI):
   `const call = (op, args) => google.script.run.withSuccessHandler((r) => console.log(op, JSON.stringify(r))).rpc(op, args);`
5. `call("folder.create", { name: "Smoke" })`: `{"ok":true,"data":{"id":"...","name":"Smoke",...}}`. Copy the `id`.
6. `call("template.create", { folderId: "<id>", title: "Smoke test", html: "<p>Hello</p>" })`: `ok` true, `version` 1.
7. Drive: `bodies` holds `<templateId>.v1.json`; `index.json` contains `Smoke test` and 2 entries in `pendingAudit` (`folder.create`, `template.create`).
8. `call("template.list", {})`: one item. `call("folder.list", {})`: `Smoke` plus your private folder "My templates".
9. Second account, same web app, same helper: `call("template.list", {})` returns 0 items; `call("folder.create", { name: "X" })` returns `DENIED`. After 5 min (next `tick`), `index.json` `pendingAudit` holds a `"result":"denied"` event with that account as `actor`.
10. Editor, Executions: each call above wrote one JSON line with `cache` (`hit`, `miss` or `rebuild`) and no `Hello` text.
11. Editor, Script Properties: `job:tick:lastOk` is under 10 min old.
