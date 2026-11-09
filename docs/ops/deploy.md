# Deploy checklist (owner, phase 2.5a and every release)

All commands run on the owner's machine from the repository root. The cloud session cannot log in to clasp (BRIEF A5). `npm run setup:check` prints the current state and the next step at any time.

## First dev deploy (2.5a), in order

1. Install Node 22 (`.nvmrc`). Check with `node -v`.
2. `npm ci`
3. `npx clasp login`. A browser opens; sign in with the Migway account that will own the dev project. clasp stores its token in `~/.clasprc.json`, outside the repository.
4. Create the dev script once:
   `npx clasp create --type standalone --title "Migway Templates (dev)" --rootDir dist`
   Copy the `scriptId` from the generated `.clasp.json` into `deploy/dev.json`, then delete that root `.clasp.json` (git-ignored; `deploy/dev.json` is the source of truth).
5. Commit `deploy/dev.json`, then `npm run deploy -- dev`. Mode `head` builds, runs the drift check and pushes. No version is created.
6. Create the web app deployment in the editor (`npx clasp open-script`): Deploy, New deployment, type Web app, Execute as: Me, Who has access: Anyone within Migway. Copy into `deploy/dev.json`:
   - `deploymentId`: the deployment ID shown after Deploy.
   - `execUrl`: in mode `head`, the `/dev` URL from Deploy, Test deployments, Web app. In mode `version`, the `/exec` URL of the new deployment. Use the Workspace form `https://script.google.com/a/macros/migway.com/s/<deploymentId>/dev` (or `/exec`). A POST with a Workspace token to the plain `/macros/s/` form returns HTTP 404 (observed 2026-11-09).
7. Commit `deploy/dev.json`, then `npm run deploy -- dev` again, so the add-on bundle carries `execUrl`.
8. In the editor, signed in as the account that owns the web app deployment, select function `setup` and click Run once. Accept the consent screen (10 scopes, spec section 9; slice 2 adds none). The execution log shows one JSON line with `"action":"setup","result":"ok"`. `setup` records Script Properties `OWNER_EMAIL`, `DOMAIN` and `ADMIN_EMAILS` (your email), creates the Drive folder "Migway Templates Data" and installs 3 triggers. Until `setup` has run, every server call answers `NOT_CONFIGURED` (since slice 4) and the sidebar shows "Migway Templates is not set up yet." A script editor other than the owner gets "setup may run only as the owner".
9. Install the add-on test deployment: Deploy, Test deployments, Application: Google Workspace Add-on, Install.
10. Open Gmail, compose a new message, open the Migway Templates icon in the compose toolbar. Expect the home card "Migway Templates" with Folders, or "No templates shared with you yet." on a new install.

If step 10 shows "Something went wrong." with `Network: Server returned HTTP 401` or `403` in mode `head`, the `/dev` URL rejects token calls (spike S2 (d)). Set `"mode": "version"` in `deploy/dev.json`, use the `/exec` URL of the step 6 deployment as `execUrl`, commit, and deploy again. Each dev deploy then creates 1 version.

## Every release

- Dev: `npm run deploy -- dev`.
- Prod: from a clean `main`, `npm run deploy -- prod`. Steps: build, drift check, `clasp push`, `clasp create-version "<sha>"`, `clasp create-deployment -i <deploymentId> -V <n> -d "<sha>"`. The deployment keeps its ID and URL. The output ends with "Versions used N of 200; prune at 150".
- The drift check aborts when the remote code differs from the last push from this machine (someone edited in the browser). Inspect the pulled copy it names. Delete `deploy/.last-push-<env>.json` only when the overwrite is intended.

## Rollback

- Prod, or dev in mode `version`: `npm run rollback -- <env>` points the deployment at the version before the current one. `npm run rollback -- <env> <version>` picks a version. The add-on and web app switch together, because one deployment serves both.
- Dev in mode `head`: `git checkout <previous commit>`, `npm run deploy -- dev`, then return to the branch.
- Data written by version N stays readable by N-1 (additive changes only, ADR-0002).

## Version pruning

- Limit: 200 versions per script. No API deletes versions.
- When the deploy output shows 150 or more: open the editor, Project History, select old versions not used by any deployment, Bulk delete.
- Dev in mode `head` creates no versions and never needs pruning.

## Time zone

- `appsscript.json` sets `"timeZone": "America/New_York"`. The `daily` trigger runs between 02:00 and 03:00 in this zone.
- The owner may change it to the office zone (IANA name, for example `Europe/Berlin`), commit, and deploy. No other file depends on it.

## Never in the repository

- `~/.clasprc.json` or any OAuth token, client secret, API key, `.env` file or `*.key.json`.
- Personal data, template content from production, exported audit logs.
- Future secrets go to Script Properties in the editor (Project Settings, Script Properties), set by hand.
- Allowed: script IDs, deployment IDs and `execUrl` in `deploy/<env>.json` (configuration, BRIEF 11).
