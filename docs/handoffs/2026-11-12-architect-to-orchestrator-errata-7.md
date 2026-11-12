# Handoff: architect to orchestrator, errata run 7

Date: 2026-11-12. Branch `architect/errata-7` from `claude/gracious-franklin-3n8zbq` at 78e3317. One docs commit plus this commit (handoff, memory). Not pushed, not merged.

## Done

- a. ADR-0004: the 3 amendments of 2026-11-12 are Accepted. Braces (D40, Q78, option 1, slice 26), date fields (D38, slice 25), choice fields (D39, Q91, slice 26). Each keeps its old status in brackets and gains an "As built 2026-11-12" block. Open sub-questions stay marked open: Q85, Q87 (zones UTC+12 and later), Q89, Q90, Q93, Q96.
- b. Spec 5.9 and 5.10 now describe the code as built:
  - The date fallback text box, its sentence "Enter a date as MM/DD/YYYY: <labels>", and its side-panel use count.
  - `entered` keeps MM/DD/YYYY.
  - `fieldValue` and `dateValue` read 4 value shapes.
  - The choice fallback box `p-<n>-text`.
  - `PH_FIELD_TYPE` names the kinds in template order.
  - `{{choice:X}}` with no `|` gives the generic `PH_CHOICE` sentence.
  - "Edit choices..." edits the label and the options.
  - The "Files to touch" and "Tests to add" lists became "As built" blocks.
- c. Slice 26 review minor 3: confirmed, no correction. `<p>{</p><p>{</p>` is refused because runs join with nothing between them; the ADR accepted this case ("a paragraph that ends in `{` followed by one that starts with `{`"). `{ {{ask:N}} {` is refused because a token is removed with its adjacent spaces; this is the cost the ADR named for `{ {{ask:N}} {ask:M}}`. Both refusals are stricter than the render needs, by design. No new question.
- d. Spec 8 has the folder tree as built (slice 23, the `reveal` rule; Back into a closed parent shows no selected row). Spec 7 Loading states has the loader (slice 24, D37: guard events, text fields keep typing, 300 ms bar, 20 s per call) and the calls per step. Slice map rows 23 to 27 added. Wireframes changed: 02 (fallbacks), 03 (tree, loader), 04 (date and choice built, save and loader), 06 (tree, held access rows), 07 (E3 loader).
- e. Spec 15 changes:
  - Closed: Q78, Q86, Q88, Q91, Q92, Q94, Q95, Q97.
  - Open with "no problem seen": Q85, Q93.
  - Partly answered: Q87.
  - Accepted defaults: Q89, Q90, Q96.
  - A new table at the top of section 15 lists everything still open, with the default in force and who answers.

## Files

| File | Lines added, removed |
|---|---|
| docs/spec.md | 76 added, 93 removed |
| docs/adr/0004-placeholders-and-html-safety.md | 31 added, 7 removed |
| docs/wireframes/02, 03, 04, 06, 07 | 4, 10, 7, 3, 8 added; 2, 4, 2, 1, 0 removed |

## Still open for the owner

| ID | Default in force | Who answers |
|---|---|---|
| D1 | The owner's Workspace admin does the admin steps | owner |
| D2 | Under 500 users, one pilot group | owner |
| D7, Q1 | Business Standard or lower, flat groups | owner or Workspace admin |
| Q22 (D23) | 3 s apply accepted for v1, measured again on prod | owner |
| Q18 | Prod data in the dedicated account's My Drive | owner |
| Q83, Q85, Q93 | Error icon kept; picker starts empty; "Choose..." selected | owner, by looking in Gmail |
| Q87 | Date for UTC+12 and later accepted for v1 | owner |
| Q25, Q76, Q77, Q79, Q84 | Accepted for v1 | owner |
| Q27 to Q31 | Owner-change tooling and `restoreBackup` in v1.1; manual runbook until then | owner, orchestrator |
| Logo | Who owns the Drive-hosted `logoUrl` image for prod | owner |

## Org deploy checklist (phase 2.5b), 22 steps

Checked against `docs/guide/admin-guide.md` part 2 (21 steps) and `docs/ops/deploy.md` as of 78e3317. Slice 20a fixed both errata 5 errors: `npx clasp open-script <scriptId>`, and the first push in mode `head`.

WA = Workspace admin. DO = the dedicated owner account (D25). The owner works as DO on the owner's machine.

| # | Who | Step | Proof it is done |
|---|---|---|---|
| 1 | owner | Decide D1 (who is the WA), D2 (pilot group), D7 (edition), Q18 (My Drive) | Recorded in PLAN.md |
| 2 | orchestrator | After slice 27 merges, bring `main` to the main line head. `origin/main` is at 5ee45c2, 584 commits behind, and `scripts/deploy.mjs` refuses prod from any other branch ("Prod deploys run from main only."). Needs the owner's go to push | `git log origin/main` shows the main line head; CI green on it |
| 3 | WA | Create DO: licensed user, no admin role, 2-step verification, company recovery phone and email | DO signs in to Gmail |
| 4 | WA | Groups: admins, pilot, editor groups; flat, direct members; DO can see each member list | DO opens each group's member list |
| 5 | owner as DO | https://script.google.com/home/usersettings: "Google Apps Script API" On | The page shows On |
| 6 | owner as DO | `npx clasp logout`, `npx clasp login` as DO | `npx clasp show-authorized-user` prints "You are logged in as <DO address>." |
| 7 | owner as DO | `npx clasp create --type standalone --title "Migway Templates" --rootDir dist`; copy `scriptId` into `deploy/prod.json`; delete the root `.clasp.json`; commit on `main` | `deploy/prod.json` holds the ID; no root `.clasp.json` |
| 8 | DO or WA | Create a standard Google Cloud project | Project number noted |
| 9 | DO or WA | OAuth consent screen: user type Internal. Enable the Marketplace SDK, the Drive API and the Admin SDK API (whether the last 2 are needed is unknown; enabling them costs nothing) | The console lists the 3 APIs as enabled |
| 10 | owner as DO | Editor (`npx clasp open-script <scriptId>`), Project Settings: switch to the project number of step 8, before any `setup()` | Project Settings shows that number |
| 11 | owner as DO | `deploy/prod.json` `"mode": "head"`, commit on `main`, `npm run deploy -- prod` | Push succeeds; the `execUrl` warning is expected |
| 12 | owner as DO | Editor: New deployment, Web app, Execute as Me, Anyone within Migway. Put `deploymentId` and `https://script.google.com/a/macros/migway.com/s/<deploymentId>/exec` into `deploy/prod.json`, `"mode": "version"`, commit, `npm run deploy -- prod` | Output "Deployment now serves version 2 (<sha>)." and "Versions used 2 of 200; prune at 150." |
| 13 | owner as DO | Run `setup()` once in the editor. The consent page has one checkbox per scope: keep all 10 ticked (Q82) | Log line `"action":"setup","result":"ok"`; Script Properties `OWNER_EMAIL`, `DOMAIN`, `ADMIN_EMAILS`; no `job:...:lastError` |
| 14 | owner as DO | Script Property `ADMIN_GROUP` = the admins group | Admin, "Settings and backups" shows "Members of <group>." |
| 15 | owner as DO | Open `/exec`, Admin, "Settings and backups": add the first admins, decide "Personal templates" (default Off) and "Outside recipients" (default Allowed) | The Admins list shows them; the Audit log shows each change |
| 16 | owner | Decide who owns the prod logo image (`logoUrl`); move it to DO if needed | The image URL opens for a pilot user |
| 17 | WA | Marketplace SDK, App Configuration: visibility Private (permanent), Admin Only install, add-on deployment ID, the 10 scopes identical to `appsscript.json`, store listing (logo, website) | The SDK saves with no error |
| 18 | WA | Admin console, Marketplace apps: Admin install for the pilot group. Consent fact (owner test 2026-11-11): an admin install grants every permission with no consent page, so no user can untick a scope | Within 24 h a pilot user sees Migway Templates in Gmail with no consent page |
| 19 | owner and pilot | Smoke on prod: `docs/ops/smoke.md`, plus test-round parts N and O (date and choice fields, record Q85 and Q93) and one apply timing (Q22) | Results in a handoff; Admin job rows show all 3 jobs ok |
| 20 | optional, owner | Owner-change tests V1 to V4 on dev with a pilot account (Q28, about 30 min) | Results recorded in PLAN.md |
| 21 | WA | Widen the install to "Everyone at your organization" | A non-pilot user sees the add-on |
| 22 | owner (dev owner) and orchestrator | Dev owner removes pilot editors from the dev project; owner logs clasp back in as the dev owner; orchestrator records G2.5b in PLAN.md | Dev sharing list; `npx clasp show-authorized-user` names the dev owner; PLAN.md status row |

Guide corrections, text only (not applied, outside this run's paths):
- Admin guide step 13 says to accept the consent screen. Add: "The page has one checkbox per permission. Keep every box ticked. An unticked box breaks the add-on."
- Admin guide step 18 says users skip the consent screen. Add that an admin install grants all permissions (owner fact, 2026-11-11).
- Neither document says that `main` must carry the release before the first prod deploy (step 2 above).

## Not verified

- No code was run.
- The owner's test reported no separate result for Q85 or Q93, and none for Q83.
