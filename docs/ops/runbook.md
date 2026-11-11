# Operations runbook (owner)

For the account owner of each environment. Daily admin work in the web app: [admin guide](../guide/admin-guide.md). Deploy commands: [deploy.md](deploy.md). Smoke test: [smoke.md](smoke.md). Background: [spec section 16](../spec.md), [ADR-0002](../adr/0002-storage.md), [ADR-0005](../adr/0005-repo-and-delivery.md).

"Not yet exercised" marks a procedure nobody has run.

## Ownership

| Environment | Owner account                                                               | Owns                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev         | the current owner's account                                                 | dev Apps Script project, `/dev` web app, dev Drive data folder, dev triggers. Dev data is test data                                                         |
| prod        | the dedicated owner account (D25, for example `templates-owner@migway.com`) | prod Apps Script project, the web app deployment ("Execute as: Me"), the Drive folder "Migway Templates Data", the 3 triggers. Its address is `OWNER_EMAIL` |

- The prod data belongs to the dedicated owner account through `drive.file`. Files it did not create through the app are invisible to the app.
- Triggers belong to the account that created them. `setup()` refuses every account other than `OWNER_EMAIL`.
- Prod starts empty. Dev data does not move to prod (D25).
- Admins use their own accounts, listed in `ADMIN_EMAILS` or `ADMIN_GROUP`. Nobody signs in as the dedicated owner account for daily work. It signs in for prod deploys, `setup()` and the recovery steps below.

### Staff change (the normal case)

1. The Workspace admin resets the password and the 2-step verification of the dedicated owner account.
2. The new holder signs in, sets a new password and enrolls their own second factor, on a company device or security key.
3. Nobody passes a password or a code to another person, by chat, mail or paper.
4. Check that the recovery phone and email belong to the company.
5. Remove the leaving person from `ADMIN_EMAILS` or `ADMIN_GROUP` if listed.

No data moves. Nothing in the app changes.

### Fallback: the dedicated owner account itself must change

Only when the account must be replaced, for example after it is deleted by mistake or must be renamed. Options from spec 16.3 and the ADR-0002 amendment "owner handover":

| Option                     | What it is                                                                                                                | State                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| B2 server-to-server copy   | The new owner deploys a new project, the old one is set `READ_ONLY`, the new one pulls every file through the old `/exec` | not built (Q27), not yet exercised                                     |
| C Drive ownership transfer | An admin transfers the project and data folder to the new account in the same project                                     | not yet exercised; works only if tests V1 and V3 pass (Q28)            |
| Interim export and import  | Steps below                                                                                                               | not yet exercised; loses history, favorites, usage, audit and item IDs |

Recommendation: keep the dedicated account alive, so none of these runs. If one must run, first run tests V1 to V4 of spec 16.3 on dev (about 30 min). If V1 and V3 pass, use option C. Otherwise build B2 before the change, or use the interim steps.

B2 steps, once built (not built, not yet exercised):

1. New owner account added to `ADMIN_EMAILS` of the old deployment.
2. Old project shared with the new owner as editor.
3. New owner deploys a new project and runs `setup()`.
4. Old owner sets Script Property `READ_ONLY`.
5. New owner runs the pull from the "Settings and backups" tab until it is done.
6. Compare template, folder, grant and version counts in both "Settings and backups" tabs.
7. The Workspace admin moves the domain install to the new deployment.
8. Old owner deletes the old triggers and deployment. The old data folder is kept 30 days, then trashed.

Interim steps (not yet exercised):

1. Keep the old owner account active. Do not suspend or delete it.
2. An admin creates a shared folder "Handover" with no grants, and moves each person's private templates into one subfolder per person.
3. Export each top folder of at most 200 templates and import it into the new deployment.
4. Re-add grants by hand from the `grants` list of each export file.
5. Each person opens the new library once. The admin moves their templates into their new "My templates".
6. Lost: favorites, usage, audit history, version history, item IDs.

## Deploy and rollback

All commands and the first-deploy steps are in [deploy.md](deploy.md).

- Deploy: `npm run deploy -- <env>`. Prod deploys from a clean `main` and creates 1 version.
- Rollback: `npm run rollback -- <env> [version]`. The add-on and web app switch together. Dev in `/dev` mode rolls back by deploying the previous commit.
- Data written by version N stays readable by N-1 (additive changes only).
- After a deploy, the triggers update on the first web app page load or within 5 minutes through `tick`.

## Triggers and job health

| Job              | Schedule                               | Late after               |
| ---------------- | -------------------------------------- | ------------------------ |
| `tick`           | every 5 min                            | 10 min without a success |
| `refreshMembers` | every 15 min                           | 30 min without a success |
| `daily`          | daily, 02:00 to 03:00 script time zone | 48 h without a success   |

- Late means: the last success is more than 2 schedule intervals old. The "Settings and backups" tab shows "Late" with the last error, or "never ran". The last error holds an error code and name (and, for the nightly job, the failed steps), never the error message. The log line in Executions adds the first 3 stack frames.
- Apps Script also sends a trigger failure email to the owner account.
- "The background jobs could not be set up again: ..." on the "Settings and backups" tab: the trigger update after a deploy failed. The old triggers stay. The next page load or `tick` retries. If it repeats, run `setup()` as the owner and read its error.
- Time zone: `appsscript.json` `timeZone` (deploy.md, Time zone).

## Quotas

The server runs as the owner, so all server work counts against the owner account's quotas.

| Limit                   | Budget at 500 users, 20 inserts per user per day |
| ----------------------- | ------------------------------------------------ |
| Simultaneous executions | 30 per owner; expected peak under 5              |
| Server executions       | about 20,000 per day                             |
| UrlFetch per user       | about 60 per day against 100,000                 |
| Trigger runtime         | about 27 min per day against 6 h                 |
| GroupsApp reads         | up to 2,880 per day against 10,000               |

A QUOTA error means Apps Script answered "too many simultaneous invocations" or "service invoked too many times". The user sees "Service is busy. Try again in a minute." In the web app, Retry stays disabled 60 s. In the Gmail panel, Retry can be clicked; within 60 s it answers "Service is busy. Try again in N seconds." with the seconds left. Single cases need no action. Repeated cases: check the Executions view for long or looping runs, and the daily quota of the owner account.

## Logs

Apps Script editor, Executions. One JSON line per server request and per trigger run. On the standard Google Cloud project (prod) the same lines are in Cloud Logging. Add-on runs log nothing of their own; their timing reaches the server line.

Example:

```json
{
  "ts": "2026-11-10T14:03:22.120Z",
  "level": "info",
  "requestId": "MWARO9CA-YG9VT8",
  "surface": "addon",
  "action": "template.apply",
  "actor": "name@migway.com",
  "targetId": "01JC7...",
  "result": "ok",
  "errorCode": "",
  "durationMs": 412,
  "cache": "hit",
  "appVersion": "42",
  "calls": { "props": 1, "cache": 9, "drive": 0, "lock": 1, "dir": 0 },
  "timing": {
    "startupMs": 40,
    "totalMs": 420,
    "addonPreMs": 310,
    "addonTokenMs": 20
  },
  "draft": {
    "fields": ["draftMetadata", "toRecipients", "subject"],
    "to": 1,
    "cc": 0,
    "bcc": 0,
    "hasSubject": true
  }
}
```

| Field                 | Read it as                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action`              | The server operation, for example `template.apply`. Empty when the name was unknown                                                                                                                |
| `actor`               | The caller's address. Trigger lines carry the owner account or `system`                                                                                                                            |
| `targetId`            | Template or folder ID, empty when the request had none                                                                                                                                             |
| `result`, `errorCode` | `ok`, `denied`, `conflict` or `error`, and the error code                                                                                                                                          |
| `durationMs`          | Handler time in ms                                                                                                                                                                                 |
| `cache`               | `hit`, `miss` or `rebuild` for the index                                                                                                                                                           |
| `calls`               | Service calls in this run: `props`, `cache`, `drive`, `lock`, `dir`. A warm insert shows `"props":1` and `"drive":0`                                                                               |
| `timing`              | Server keys: `startupMs` (script load), `totalMs`, `propsMs`, `cacheMs`, `driveReadMs`, `driveWriteMs`, `lockMs`, `dirMs`. Add-on keys: `addonPreMs`, `addonTokenMs`, `prevFetchMs`, `prevTotalMs` |
| `draft`               | Add-on calls only: compose event field names, recipient counts, `hasSubject`                                                                                                                       |
| `requestId`           | The ID a user sees with "Something went wrong." Search for it                                                                                                                                      |
| `errorName`, `stack`  | On errors: the error name and 3 stack frames                                                                                                                                                       |

No line holds template text, subjects, prompt values, recipient addresses or tokens.

## Restore from backup

Use the "Settings and backups" tab: [admin guide, Backups and restore](../guide/admin-guide.md#backups-and-restore). It restores `index.json`, `favorites.json` and `usage.json` of one of the last 14 nights. Every change after that date is lost. The Admins list and the settings stay as they are now; a restore does not bring back a removed admin. Not yet verified on dev.

## An admin account is taken over

Not yet exercised.

1. A Workspace admin suspends the account and resets its sign-in.
2. The owner opens Admin, "Audit log" tab, filters on that actor, and lists `admin.add`, `admin.remove`, `config.set`, `grant.*` and `backup.restore` events since the takeover.
3. The owner removes every address that actor added under Admins ("Settings and backups" tab) and adds back any admin it removed.
4. If the account is in `ADMIN_EMAILS`, the owner deletes it from the property. If it is in `ADMIN_GROUP`, a Workspace admin removes it from the group and an admin presses "Refresh groups" on the Groups tab.
5. The owner undoes the settings and grant changes found in step 2.

## Recovery of a damaged index.json

Symptom: every action answers an error with "index.json is damaged: ...", "Settings and backups" tab and restore included. Only the backup list still loads. Not yet exercised.

1. Drive, as the owner: open "Migway Templates Data/backups/", pick the newest date, download its `index.json`.
2. Open the live "Migway Templates Data/index.json", File information, Manage versions, Upload new version, pick the downloaded file. Do not upload it as a new file and do not make a copy: the app cannot see files it did not create.
3. Apps Script editor, as the owner: run `setup()`. It reads `index.json`, republishes `INDEX_REV` and the cache, and reinstalls triggers.
4. Web app: open the library and the "Settings and backups" tab. Check `INDEX_REV` and the template count.
5. A damaged `favorites.json` or `usage.json`: the same steps with that file.

Unverified: that Upload new version keeps the file ID and its app properties. Changes after the backup date are lost. An owner-run `restoreBackup(date)` would replace these steps (Q31, not built).

## Audit log does not load (fixed in slice 19)

- Symptom: Audit log tab shows "The audit log could not be loaded. Press Retry in the message." for a month whose file exists. Executions show `audit.query` with `INTERNAL`. The nightly job fails at `auditRolled`, so "Nightly backup and cleanup" turns "Late" after 48 h, and `pendingAudit` in `index.json` keeps growing. Above 200 KB the 5-minute job fails too.
- Cause: builds before slice 19 read `audit/YYYY-MM.jsonl` with the Advanced Drive service, which parses the file as JSON and throws ("Response Code: 200") once the file has 2 lines.
- Fix: deploy slice 19 or later. Month files are now read through Drive REST. No manual step: the next nightly job (or the 5-minute job above 200 KB) moves every pending event into the month file. No event is lost; a repeated event is skipped by its ID.
- Check: the Audit log tab loads the current month and shows today's rows. After the next nightly job, "Nightly backup and cleanup" shows "OK".
- Required after deploying this build: Apps Script editor, Project Settings, Script properties. Read `job:tick:lastError`, `job:refreshMembers:lastError`, `job:daily:lastError` and `job:triggers:lastError`. Delete any that holds text from before this build (it can quote audit lines with addresses). From this build on, a last error reads "<time> <code> <error name>" or "<time> daily steps failed: <step> (<code>)", and a successful run deletes it. Executions and Cloud Logging keep the old messages until they expire.

## Version pruning

- Apps Script keeps at most 200 versions per script. No API deletes versions.
- Each prod deploy creates 1 version. The deploy output ends with "Versions used N of 200; prune at 150".
- At 150: editor, Project History, select old versions no deployment uses, Bulk delete.
- At 2 releases per month that is about every 6 years. Dev in `/dev` mode creates no versions.

## Speed (measured, D23)

| Point                          | Build       | Measured                                      | Target                             |
| ------------------------------ | ----------- | --------------------------------------------- | ---------------------------------- |
| Gmail panel, first open        | dev 9bbd262 | 4.1 s run, about 6 s on screen                | 3 s                                |
| Add-on run with no server call | dev 637ce77 | 1.1 to 2.7 s                                  | none                               |
| Insert with one server call    | dev 637ce77 | 2.2 to 5.2 s, handler 0.2 to 0.6 s of it      | 2 s p95 (D23: 3 s accepted for v1) |
| Web app save, warm             | dev 32a446c | 4.2 to 5.2 s, Drive writes 2.0 to 2.7 s of it | 3 s                                |

- Most of the time is outside the handler: script start, token, two web hops and card rendering.
- D23 is open. Assumption in force: 3 s accepted for insert in v1. Measure again on prod `/exec`. Option: insert from the add-on cache with a 10 min permission lag.

## When something breaks

| Symptom                                                                                            | Likely cause                                                  | First check                              | Fix                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| "Migway Templates is not set up yet."                                                              | `setup()` has not run (`DOMAIN` unset)                        | Script Properties                        | Owner runs `setup()`                                                      |
| Every action fails with "index.json is damaged"                                                    | A damaged live file                                           | Executions, error text                   | Recovery of a damaged index.json                                          |
| Panel shows "Something went wrong." with "Details for your admin: Server returned HTTP 401" or 403 | Wrong `execUrl` or web app access                             | `deploy/<env>.json`, deployment settings | deploy.md step 6 and the note after step 10                               |
| "Cannot identify your Migway account."                                                             | Several Google accounts signed in                             | Ask the user                             | Separate Chrome profile                                                   |
| "Settings and backups" tab: a job "Late"                                                           | Trigger failing or missing                                    | Editor, Triggers; the last error         | Fix the error, redeploy or roll back; run `setup()` to reinstall triggers |
| "Trigger reinstall failed: ..."                                                                    | Trigger create failed after a deploy                          | Error text                               | Run `setup()` as the owner                                                |
| "Service is busy. Try again in a minute." often                                                    | Quota or simultaneous runs                                    | Executions, run count and length         | Wait; look for a looping run                                              |
| "The library is busy. Try again in a few seconds." often                                           | Script lock held over 10 s by long writes                     | Executions, `lockMs`                     | Wait; check large imports or restores                                     |
| A group grant gives no access                                                                      | Person is in a child group, or the owner cannot see the group | Groups tab warning                       | Add the person directly; make the group's members visible                 |
| New template missing in the Gmail panel                                                            | Panel copy up to 10 min old                                   | Library shows it                         | "Open library" in the panel, or wait 10 min                               |
| Web app page blank after a deploy                                                                  | Bundle cut or blocked by a new page policy                    | Browser console in the app frame         | Roll back; see ADR-0005 amendment "web bundle inlining"                   |
| Deploy aborts on drift                                                                             | Code edited in the browser editor                             | The pulled copy deploy names             | deploy.md, drift check                                                    |

## Rollback exercise

BRIEF 13 asks for one exercised rollback before v1 is done. The orchestrator fills this record after the exercise.

| Field       | Value                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date        | 2026-11-11, 00:04 to 00:07 UTC                                                                                                                                                                                                                                                                                                                                                               |
| Environment | dev, mode `head`                                                                                                                                                                                                                                                                                                                                                                             |
| From build  | dev-7de9962                                                                                                                                                                                                                                                                                                                                                                                  |
| To build    | dev-5f83683 (the build deployed before it), then forward again to dev-7de9962                                                                                                                                                                                                                                                                                                                |
| Steps       | `git checkout 5f83683`, `npm ci`, `npm run deploy -- dev` (drift check passed), read-only `template.list` call and a fetch of the served page; then `git checkout` of the branch, `npm ci`, `npm run deploy -- dev`, the same two checks                                                                                                                                                     |
| Result      | Pass. The older build answered as dev-5f83683 within 15 s of the deploy command, loaded the live data (4 templates) written by the newer build, and its served script equaled the local build. The forward deploy answered as dev-7de9962 with the same data. Not exercised: `npm run rollback` on a versioned deployment (prod uses mode `version`); a rollback across a data shape change. |
