# Migway Templates: admin guide

For Migway Templates admins and the Workspace admin who installs the app for the domain. Part 1 covers the daily admin work in the web app. Part 2 covers the one-time domain install.

Related: [user quick start](user-quick-start.md), [editor guide](editor-guide.md), [operations runbook](../ops/runbook.md), [specification](../spec.md), [ADR-0003 permissions](../adr/0003-identity-and-permissions.md).

Marks used below:

- "Not yet verified on dev": built and unit-tested, not yet run on the dev deployment by a person.
- "Not yet exercised": a procedure nobody has run yet.

# Part 1: daily admin work

## Roles and levels

Access lives on folders. A grant gives one principal one level on one folder. Subfolders inherit it. A caller's level is the highest over the folder and its parents. No grant means no access. New folders start with no grants, so only admins and `manage` holders of the parent see them.

| Level or role | Who | Can |
|---|---|---|
| `use` | user | List, search, preview, insert and star templates |
| `edit` | manager-editor | `use`, plus create, edit, duplicate, move, delete, restore templates, and version history |
| `manage` | folder manager | `edit`, plus subfolders, rename, move or delete the folder, grants on its subtree, export of the folder |
| admin | member of Script Property `ADMIN_GROUP`, or listed in `ADMIN_EMAILS` | `manage` on every folder, personal ones included (only `use` on personal folders while personal templates are off), plus the admin-only rows below |

Role matrix (ADR-0003 Part C). "yes on source and target" means the level is needed on both folders.

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
| Personal folder of self | edit | edit | edit | yes |

- Admins come from 3 places: the Admins list in Admin, "Settings and backups" tab, Settings; the admin group (`ADMIN_GROUP`); and the owner's list (`ADMIN_EMAILS`). Any admin adds or removes people in the Admins list. Only the owner changes `ADMIN_GROUP` and `ADMIN_EMAILS`, in the Apps Script editor, Project Settings, Script Properties. `setup()` puts the owner in `ADMIN_EMAILS`.
- Every person has one personal folder, "My templates", with `edit` for its owner. It cannot be shared, moved or deleted.
- Admins see and can change every personal folder (D18). The user quick start discloses this. In the library an admin sees other people's folders as "My templates (name@migway.com)". The Gmail panel hides them.
- The Admin entry in the left rail shows for admins and `manage` holders. Admins see 6 tabs. `manage` holders see "Folders and access" and "Export and import" (folder export only).

## Grant a folder

1. Admin, "Folders and access". Select the folder in the tree.
2. "Who has access" lists Who, Access and Set on ("this folder", or the parent path with "(parent folder)"). An empty folder reads "Only admins can see this folder. Give access to share it."
3. Under "Give access", pick "Type", fill "Give access to", pick "Access" ("Can use", "Can edit" or "Can manage"), click "Give access".

| Type | Give access to | Who gets access |
|---|---|---|
| "Group" | Group email, for example sales-team@migway.com | Direct members of the group (next section) |
| "User" | One person's email | That person |
| "Domain" | Domain, for example migway.com | Everyone in the domain |
| "Org unit (not active yet)" | Org unit path, for example /Field | Nobody yet (see below) |

- A grant to a principal that already has one on the folder changes its level.
- "Remove" on a row deletes the grant at once, with no confirmation.
- A group must exist and the owner account must be able to see its member list. Otherwise the grant is refused: "Group ... was not found or its members are not visible. Check the address."
- Access cannot be given on a "My templates" folder: 'The folder "My templates" cannot be shared.'
- Grant changes apply to the next request. Group membership changes in Google Groups apply within 15 minutes, or at once after "Refresh groups".
- Known limit: after a grant change the library tree does not reload. Reload the page to see the new tree.

## Groups: direct members only (D7)

The app reads group members through Apps Script GroupsApp (`groupsapp_direct`). It sees direct members only.

- A person who is in a group inside the group, and not directly in the group that has access, gets no access.
- The Groups tab warns: "Warning: members of <inner groups> get no access through <group>. Add them to <group> directly."
- Use flat role groups: add people to the granted group directly.
- D7 is open: the Workspace edition, nested groups and admin API limits are not confirmed. Nested groups need the Directory resolver, which needs an admin role for the owner and is not active in v1.

## Org unit access is not active yet (D17)

- Access for an org unit is saved and shown with "Not active yet. Org units do not give access in this version.". It gives nobody access.
- To share with an OU now, create a Google Group with the same people and grant the group.

## Groups tab

- The summary reads "Members are read from Google (direct members only). Last refresh: <time>."
- The table lists every group named in a grant or in `ADMIN_GROUP`: Group, Members, Groups inside, Status.
- The `refreshMembers` job refreshes the list every 15 minutes.
- "Refresh groups" shows "Refreshing groups..." and then "Refreshed n groups."
- The child-group warning row is not yet verified on dev.

## Audit log

Not yet verified on dev (built in slice 6b, not deployed when this guide was written).

- Filters: "Month", "Date from", "Date to", "User", "Action", "Result", "Template or folder". Click "Filter". 50 rows per page.
- Columns: Time, User, Action, Template or folder, Result, Details. "Details" opens "Entry details": Before and After, Duration, Request ID, App version, and "Technical details" with the internal name and ID.
- Recorded: template create, change, move, delete, restore; folder changes; grant changes with before and after; imports; backup restores; trash purges; refused requests (`denied`).
- Inserts and refused actions can take up to 5 minutes to show. More than 200 of them within 5 minutes are lost and counted in one "Audit entries lost" row (`audit.dropped`).
- Kept 24 months.
- Exports write no audit event in v1.

## Usage

Not yet verified on dev.

- Columns: Template, Folder, "Inserts, 30 days", "Last inserted". Most inserted first. No user names.
- Counts cover the 30 UTC days ending today. Inserts arrive up to 5 minutes late.
- Every personal folder shows as "My templates", without its owner.

## Export and import

Not yet verified on dev.

Export:

1. "Export and import". Admins pick "Whole library (shared folders)" or "One folder and its subfolders". `manage` holders see "Export folder" only.
2. "Export" (admins) or "Export folder". The status counts "Exporting n of m templates..." and ends with "Exported n templates to <file name>.", the file being `migway-templates-<library or folder name>-<date>.json`.

What an export leaves out:

- Personal folders and their templates (whole-library export).
- Version history: only the current version of each template.
- Favorites, insert counts, audit entries, authors and dates.
- Grants from folders above the exported folder.
- Templates in the trash.

Export pages through the library 20 templates at a time. A save during an export can repeat or skip one template. Export when nobody saves, and compare the count in the status line.

Import (admins only):

1. "Export file": choose a file. "Import into": pick a shared folder.
2. "Check file" shows what the import would do and changes nothing.
3. "Import" writes it and shows a report: templates created, skipped, failed; folders new and existing; subjects with line breaks replaced.

| Rule | Value |
|---|---|
| File size | at most 5 MB |
| Templates per file | at most 200 |
| Folders per file | at most 100 |
| Format | `schemaVersion` 1, no two folders with one ID |
| "Import into" | a shared folder; a personal one is refused |
| Folders | created as shared folders; a folder whose name a sibling already has is reused |
| Grants | none created; the file's grants are for reference, re-add them by hand |
| Templates | new IDs; a title that already exists in the destination folder is skipped, so a second import adds nothing |
| Checks | the same cleanup and field checks as a save |
| Failure | "Nothing was imported because <what>. Run the import again." |

- More than 200 templates: export one file per folder.
- A file close to 5 MB is not yet verified on Apps Script. The browser may refuse the upload; then nothing is written.
- Export and import do not move an app to a new owner. See the runbook.

## Settings ("Settings and backups" tab)

Admin, "Settings and backups" tab, section "Settings", first on the tab. Only admins see this tab; anyone else gets "You don't have access" from the server. Each setting has its own radio group and Save button. Save stays disabled until you pick another value.

| Setting | Default | On (or Allowed) | Off (or migway.com only) |
|---|---|---|---|
| Personal templates | Off | Every user gets a personal folder "My templates" on their first library visit and can create, change and delete templates there. | No new "My templates" folder is created. Users who already have one keep it and can still open, preview, star and insert its templates. Nobody can create, change, duplicate, move, delete, restore or see the history of a template in a personal folder, admins included. Their edit buttons are gone; the library shows "Personal templates are turned off by your admin. You can still insert these templates." |
| Outside recipients | Allowed | Templates may add addresses outside migway.com to To, Cc and Bcc. | Saving a template with an outside address fails. Templates keep stored outside addresses, but Insert skips them and the card lists them as "Not added". |

- A fresh install and an install from before this setting read as the defaults. `setup()` never changes a setting.
- Turning a setting off asks first ("Turn off personal templates?" or "Allow only migway.com recipients?"); Cancel has the focus. Turning it on saves at once.
- Nothing is deleted when personal templates go off. Turning them on again brings back every action, with every template, version, favorite and Recent entry where it was. Templates deleted from a personal folder stay in the trash and are purged after 30 days as usual.
- To clean up or move personal templates while the setting is off, turn it on, do the work, and turn it off again. Both changes appear in the audit log.
- The server applies a change from the next request on. The Gmail panel can show its old list for up to 10 minutes; inserting stays allowed.
- Each change writes one audit event "Setting changed" with the old and new value. Under the setting: "Last change: <name> on <time>." or "Default, never changed."
- If another admin changed the setting while your page was open, you see "<name> changed this setting on <time>. The page now shows the current value."
- Script Property `RECIPIENTS_EXTERNAL` is no longer read. If it was set to `deny`, set "migway.com only" here and delete the property.

## Admins ("Settings and backups" tab)

Admin, "Settings and backups" tab, section "Admins", after the two settings. It lists the people added here, each with "Added by <name> on <time>.", then the owner's list ("Set by the owner: ...") and the admin group ("Members of ..."). The owner's list and the group cannot be changed here.

Add an admin:

1. Open Admin, "Settings and backups" tab.
2. Under Admins, type the person's migway.com address in "Email address".
3. Press "Add admin". The line reads "<address> is now an admin."
4. The person reloads the web app. The Admin entry and all 6 tabs appear.

Remove an admin:

1. Press "Remove" on the person's row.
2. Press "Remove admin" in the dialog (Cancel has the focus). They lose admin access at their next action. Their templates and folders stay.

- Only people of migway.com with an account can be added. An address of a group is refused: groups go in `ADMIN_GROUP`, which the owner sets.
- An alias is stored as the person's main address.
- You cannot remove yourself. Your own row has no Remove button; ask another admin.
- The list holds 20 people. Remove one first to add another.
- Every add and remove is one entry in the Audit log ("Admin added", "Admin removed") with who did it and the address.
- A restore from backup keeps the Admins list as it is now.
- The Gmail panel can show a new or removed admin's old folder list for up to 10 minutes. The server checks every insert.
- Nobody gets an email when they are added. Tell the person yourself.

## Technical details and background jobs

Not yet verified on dev. Below Settings the tab is read only.

- "Technical details": Domain, `ADMIN_GROUP`, `MEMBERSHIP_RESOLVER`, `CALLER_IDENTITY`, `INDEX_REV`, App version, Library data size. The size warns above 3 MB.
- "Background jobs": Job, Schedule, Last good run, Status. Each job shows its name in words and its internal name: "Save insert counts and refused actions" (`tick`), "Refresh groups" (`refreshMembers`), "Nightly backup and cleanup" (`daily`).

| Job | Schedule | Work |
|---|---|---|
| `tick` | Every 5 minutes | insert counts, refused-request events, cache refresh |
| `refreshMembers` | Every 15 minutes | group member lists |
| `daily` | Every night, 02:00 to 03:00 (script time zone) | audit roll, trash purge after 30 days, file cleanup, backup, audit retention |

- Status "OK", "Late" (no success for more than 2 intervals) or "Never ran". A late job shows its last error.
- "The background jobs could not be set up again: ..." appears when a trigger update after a deploy failed. Tell the owner.

## Backups and restore

Not yet verified on dev.

- The `daily` job copies `index.json`, `favorites.json` and `usage.json` each night and keeps 14 days. Template versions and audit files are never changed after writing, so they need no copy.
- To restore: "Settings and backups", "Backups", press "Restore" next to the date. The dialog "Restore the backup of <date>?" has the focus on "Cancel". "Restore <date>" confirms.

The two risks the dialog names:

1. Everything goes back to that date: templates, versions, folders, access, favorites and insert counts. Changes made after that day are lost. The audit log is kept and records the restore.
2. Templates emptied from the trash after that date cannot come back. The server refuses such a restore: "Not restored. <n> templates in the backup of <date> were deleted for good after that day and would not open. Pick a newer backup."

Further limits:

- A backup that cannot be read is refused ("This backup cannot be read: ..."). The live data stays untouched.
- A failure inside the restore's own undo can leave the backup favorites and usage with the live index.
- A damaged live `index.json` blocks every action, restore included. The owner then follows the runbook.

## Trash and "Empty trash now"

- Deleted templates stay 30 days in the Trash view (below the library folder tree), then the `daily` job removes them for good.
- Admins see every deleted template, also those whose folder is gone.
- "Empty trash now..." asks "Empty the trash? All n templates in it are deleted for good, and so are deleted folders. This cannot be undone." "Cancel" has the focus. "Empty trash" confirms; the status reads "Emptied the trash: n templates deleted for good."
- It also removes deleted folders. Each click trashes up to 50 stored files; the nightly job removes the rest.
- An emptied template cannot be restored from any older backup. Empty the trash only when needed.
- The Trash view and "Empty trash now" are not yet verified on dev.

# Part 2: one-time domain install (phase 2.5b)

Every step in this part is not yet exercised. The dev deployment runs on the default Google Cloud project with test installs only. The steps follow docs/BRIEF.md 2.5b, [ADR-0005](../adr/0005-repo-and-delivery.md) and [deploy.md](../ops/deploy.md).

## Before you start

- Prod belongs to a dedicated owner account (D25, owner decision 2026-11-10, answers Q26). This guide uses the example `templates-owner@migway.com`.
- Dev stays on the current owner's account. Dev data is test data and does not move to prod. Prod starts empty.
- Decide who does the admin steps (D1) and the pilot group (D2).
- The admin steps need a super administrator or the Marketplace administrator privilege.

## Steps (not yet exercised)

Do them in this order. "Not yet tried" marks a step whose result nobody has seen on a real Workspace. Commands run on the owner's machine from the repository root, as in [deploy.md](../ops/deploy.md).

1. Workspace admin: create the dedicated owner account, for example `templates-owner@migway.com`.
   - A full Workspace user account with a license. A Google Group, an alias or a collaborative inbox cannot own a script or run it.
   - No Workspace admin role. It needs none and should have none.
   - 2-step verification on. Recovery phone and email belong to the company, not to one person.
   - On a staff change the Workspace admin resets its password and 2-step verification, and the new holder sets a new password and enrolls their own second factor. Nobody passes a password or a code to another person, by chat, mail or paper ([runbook](../ops/runbook.md)).
   - It signs in to clasp for prod deploys, runs `setup()` once, and becomes `OWNER_EMAIL`.
   - It owns the prod Apps Script project, the web app deployment ("Execute as: Me"), the Drive data folder and the 3 triggers.
   - People who administer the app use their own accounts for daily work and do not sign in as the dedicated account.
2. Workspace admin: Google Groups: an admins group, editor groups as needed, a pilot group. Flat groups, members added directly. The dedicated owner account must see each group's member list.
3. Dedicated owner account: open https://script.google.com/home/usersettings and turn on "Google Apps Script API". clasp cannot create or push a project without it. The account is new, so the setting is off. Not yet tried for this account.
4. Dedicated owner account, on the owner's machine: `npx clasp logout`, then `npx clasp login`, and sign in as the dedicated account in the browser that opens. clasp keeps one default login per computer user, and `npm run deploy` uses that login. So before every prod deploy, log out and in as the dedicated account; before the next dev deploy, log out and in again as the dev owner. `npx clasp show-authorized-user` prints "You are logged in as <address>." Check it before each deploy. Not yet tried with two accounts.
5. Dedicated owner account: create the prod project once:
   `npx clasp create --type standalone --title "Migway Templates" --rootDir dist`
   Copy the `scriptId` from the generated `.clasp.json` into `deploy/prod.json`, then delete that `.clasp.json`.
6. Create a standard Google Cloud project. The dedicated owner account creates it if Migway allows project creation; else the Workspace admin.
7. Cloud console, OAuth consent screen: user type Internal. Internal apps owned by the organization need no Google verification.
8. Cloud console, APIs: enable the Google Workspace Marketplace SDK. Probably also the Drive API, the Admin SDK API and the Gmail API, because the manifest uses all three as advanced services. Not yet tried: whether a standard project needs these two enabled by hand.
9. Open the editor: `npx clasp open-script <scriptId>`, with the `scriptId` from `deploy/prod.json` (or the address `https://script.google.com/d/<scriptId>/edit`). Project Settings, Google Cloud Platform project: change to the standard project's number. Do this before `setup()` in step 13: it is one way, and files created under another project stay invisible to the app.
10. First push. `npm run deploy -- prod` refuses mode `version` while `deploymentId` and `execUrl` are empty. In `deploy/prod.json` set `"mode": "head"` for this one run, commit on `main`, then `npm run deploy -- prod`. The build warns that `execUrl` is missing; that is expected here.
11. Create the web app deployment as in deploy.md step 6: Deploy, New deployment, type Web app, Execute as: Me, Who has access: Anyone within Migway. Put `deploymentId` and the `/exec` URL in the Workspace form (`https://script.google.com/a/macros/migway.com/s/<deploymentId>/exec`) into `deploy/prod.json`, and set `"mode": "version"` again.
12. Commit `deploy/prod.json` on `main`, then `npm run deploy -- prod`. This run creates the next version (`clasp create-version`) and points the deployment at it, so the add-on carries the URL. The New deployment of step 11 made version 1, so this is version 2: the output prints "Deployment now serves version 2 (<sha>)." and ends with "Versions used 2 of 200; prune at 150." Not yet tried: whether the editor's New deployment always makes a version.
13. The dedicated owner account runs `setup()` once in the editor and accepts the consent screen (11 scopes, below). The execution log shows one line with `"action":"setup","result":"ok"`.
14. Check the setup: editor, Project Settings, Script Properties. `OWNER_EMAIL`, `DOMAIN` and `ADMIN_EMAILS` hold the dedicated account and `migway.com`. No property named `job:...:lastError` exists. If one exists, the text after the time names the code; fix the cause, delete the property, and run `setup()` again.
15. Script Properties: `ADMIN_GROUP` = the admins group. `ADMIN_EMAILS` keeps the dedicated account as the break-glass address.
16. The dedicated owner account opens the web app `/exec` URL, Admin, "Settings and backups". Under "Admins" add the first admins by their migway.com address ("Add admin"). Under "Settings" decide the two settings: "Personal templates" (default Off) and "Outside recipients" (default Allowed).
17. Marketplace SDK, App Configuration: visibility Private (permanent once saved); installation Admin Only install; integration Google Workspace add-on with the deployment ID; the 11 OAuth scopes below, identical to the manifest and the consent screen. Fill the store listing (logo, website); private apps need one too. Google does not review private apps. Not yet tried: which links and icon sizes a private listing requires.
18. Admin console: Apps, Google Workspace Marketplace apps, Apps list, Install app, Admin install. Audience: "Certain groups or organizational units", the pilot group. Propagation takes up to 24 hours. Users then skip the consent screen: Admin install grants all 10 permissions for them, with no page and no box to tick.
19. Pilot smoke test with [smoke.md](../ops/smoke.md) on prod. Exit G2.5b: the pilot group sees the add-on without a manual install.
20. Widen the audience to "Everyone at your organization".
21. The dev owner removes the pilot editors from the dev project. Dev data stays on dev.

## OAuth scopes (spec section 9)

Prefix `https://www.googleapis.com/auth/` omitted. The build fails on any scope outside the approved list.

| Scope | Used by | Reason |
|---|---|---|
| `gmail.addons.execute` | add-on | Gmail requires it to run the compose add-on |
| `gmail.addons.current.action.compose` | add-on | Insert the template into the draft and set the draft subject; create the drafts of "New email", "Reply" and "Reply all" in the side panel |
| `gmail.addons.current.message.metadata` | add-on | Read the To recipients for "Recipient first name"; read the open email's Reply-To, From, To and Cc for "Reply" and "Reply all" |
| `gmail.settings.basic` | add-on | Read your default Gmail signature and put it under a template in "New email". The app changes no Gmail setting |
| `script.external_request` | add-on | Call the app's own web app address |
| `drive.file` | web app, triggers, add-on token | Read and write only the storage files the app created. The web app front door also needs a Drive scope in the add-on's token |
| `script.projects.readonly` | add-on | The web app front door accepts the add-on's token only with this scope (spike S2) |
| `userinfo.email` | web app | Identify the caller's Migway address |
| `groups` | triggers, web app | Read group members for grants |
| `admin.directory.user.readonly` | web app | Read public directory profiles for sender values and internal recipient first names |
| `script.scriptapp` | web app, `setup()` | Install the 3 time-driven triggers |

`https://mail.google.com/` is never requested. One scope is restricted: `gmail.settings.basic`. An Internal app needs no Google verification for it (step 7).

## Unknown or undecided

| ID | Question | State |
|---|---|---|
| D1 | Who performs the admin steps | open |
| D2 | User count and pilot group | open; assumption under 500 users, one pilot group |
| D7 | Workspace edition, nested role groups, admin API restrictions | open; assumption flat groups, no API restrictions |
| Q26 | Prod owner identity | decided 2026-11-10 (D25): a dedicated owner account |
| Q27 | When to build the server-to-server move, needed only if the dedicated account itself must change | open; not built |
| Q28 | Run owner-change tests V1 to V4 on dev | open; recommendation during the 2.5b dry run, about 30 min |
| Q29 | Move all template versions or current ones only at an owner change | open; recommendation all versions under 20,000 files |
| Q30 | How pilot data moves from dev to prod | decided 2026-11-10 (D25): it does not move; prod starts empty |
| Q31 | Owner-run `restoreBackup(date)` for a damaged index | open; not built; manual runbook until then |
| Q18 | Prod data in the owner's My Drive or a shared drive | open; recommendation My Drive |
| D23 | Insert speed target | open; 3 s accepted for v1, to measure again on prod `/exec` |
| none | Whether step 8 needs the Drive API and Admin SDK API enabled by hand | unknown |
| none | Who owns the add-on logo image for prod (`logoUrl` in `appsscript.json` points to a Drive-hosted file) | open |
| none | Whether directory profiles carry title and phone for every user (contact sharing on) | unknown until prod data |
