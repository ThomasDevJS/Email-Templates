# Handoff: architect to orchestrator, errata run 5

Date: 2026-11-11. Branch `claude/gracious-franklin-3n8zbq`, base 16df87a. Commits 279ed79 (spec), e8f09f8 (ADRs), b03201f (wireframes), plus this commit. Not pushed.

## Done

- Spec: sections 2, 4, 4.1, 4.1a, 4.2, 4.5, 5.6, 5.7, 5.8, 6, 7 (table rewritten), 7.1, 7.2, 7.3, 7.4, 8, 13 (rows 14 to 20), 13.9, 13.10, 13.11, 14 (S2 (e) platform fact, S7), 15, 16 follow src at 16df87a. New Q75, Q76, Q77; Q68 and Q74 closed.
- ADR-0009 Accepted 2026-11-11 with "As built 2026-11-11". D31 amendments in ADR-0004 and ADR-0006 Accepted; the Q77 point of ADR-0006 stays Proposed. D32 amendments in ADR-0003 (with "As built (slice 16)") and ADR-0008 Accepted. ADR-0001 D27 amendment and ADR-0004 D26 amendment Accepted with ADR-0007 and ADR-0006.
- ADR-0007: Amendment 2026-11-11 (D33 rows, failure sentences), Accepted. ADR-0002: Amendment 2026-11-11, slice 19 (JSON Lines read, privacy rule for job errors), Proposed.
- Wireframes 01, 02, 04, 06, 07: quoted texts as built; 06 rewritten for the slice 14 tab names, Admins, jobs, trash.

## Verified in src (grep), not only in handoffs

- `ADMIN_DENIED_TEXT` (web/ui/status.ts); `ADMIN_CHECK` INTERNAL (server/handlers/admins.ts); `lockedSubject` in `recheck` (dispatch.ts); results carry `email`; `editedList` CONFLICT text.
- `replacesSubject(draftHasSubject)`; details Insert params without `title`; `cardFields` first-name rule; problem line prefix "(!) ".
- `panelAnswer` throws; panel texts have no request ID; `rowButtons` gives Reply plus Reply all in a `ButtonSet` (folder.ts).
- `readRawText` callers (audit.ts, driveStore.ts); `fileUrl` ID check; HTTP 429 QUOTA (restDrive.ts); `errorSummary`, `JobError`, 500 characters (health.ts); Drive prefix in `urlFetchWhitelist`.
- Code uses `OpenAs.OVERLAY`; Gmail opens a new window (owner fact).

## Found while checking (for the fix round, not changed in code)

- Web NOT_CONFIGURED shows the toast "Something went wrong. Try again."; the server text never reaches the screen (status.ts maps the code to "toast"). Spec 7 now says so.
- Admins explanation on screen says "grants" (adminAdmins.ts:185), outside the glossary.
- Add-on DENIED card always shows the folder text; no add-on op can get the personal-off text, so this is correct.
- Accepted ADR bodies of 0001, 0003, 0004 keep slice 3 to 6 screen texts as history; spec and wireframes hold the current texts.
- docs/spikes/slice-02-s2.md not edited (outside this run's paths); the S2 (e) fact is in spec 14 and ADR-0002.

## Open for the owner (ID, question, default)

- Q75: how Gmail shows a failed side-panel action. Default: rerun part J step 11 and record.
- Q76: gap rule 2 knows ASCII punctuation only. Default: accept for v1.
- Q77: row Insert gives no notice for a left-out outside address or skipped To. Default: accept for v1.
- Q55: fresh consent run by hand before prod. Default: owner runs it (5 min).
- Q22 (D23) speed, Q25, Q18, Q27 to Q29, Q31, D1, D2, D7: unchanged defaults.

## Phase 2.5b: steps that need the owner or the Workspace admin

Checked against docs/guide/admin-guide.md part 2 and docs/ops/deploy.md (read only). WA = Workspace admin, DO = dedicated owner account (D25).

1. WA: create DO (licensed user, no admin role, 2-step verification, company recovery). Prepare: address, licence.
2. WA: groups: admins group, pilot group, editor groups (flat, direct members; DO must see member lists). Prepare: names, members.
3. DO: Apps Script API on in script.google.com user settings, then `clasp login` as DO. Prepare: the owner's machine.
4. DO: `clasp create` for prod; `scriptId` into deploy/prod.json.
5. DO or WA: standard Cloud project; OAuth consent screen user type Internal; enable Marketplace SDK (Drive API and Admin SDK API probably).
6. DO: editor, Project Settings, switch to the Cloud project number, before any `setup()`.
7. DO: first push, web app deployment (Execute as Me, Anyone within Migway), `deploymentId` and `/exec` URL into deploy/prod.json, `npm run deploy -- prod`.
8. DO: run `setup()` once, accept 10 scopes; check `job:*:lastError` empty.
9. DO: Script Property `ADMIN_GROUP`; first admins in Admin, "Settings and backups", Admins; decide the two settings (personal templates default off, outside recipients default allowed).
10. WA: Marketplace SDK App Configuration: Private, Admin Only install, add-on deployment ID, the 10 scopes, store listing (icons, links).
11. WA: Admin console, Admin install for the pilot group (up to 24 h); owner by hand: Q55, smoke on prod.
12. WA: widen to everyone; dev owner removes pilot editors from dev.

Corrections for the guides (text only, not applied):
- admin-guide part 2 step 7 fails as written: `npm run deploy -- prod` refuses mode `version` with an empty `deploymentId` and `execUrl` (scripts/lib/deployConfig.mjs:72). Say: for the first push set `"mode": "head"` for one run (or `npx clasp push` with the prod `scriptId`), create the deployment, then set `"mode": "version"`.
- deploy.md and the guide never say that clasp needs the Apps Script API turned on for the signing account (DO is a new account). Untested.
- Two clasp logins (dev owner and DO) on one machine: how to switch is not described. Unknown.
- Step 5 "Probably also the Drive API and the Admin SDK API": unknown; the manifest enables advanced services Drive v3 and Admin Directory v1.
- Step 12: whether a private listing needs support, privacy and terms links and which icon sizes: unknown. The manifest `logoUrl` points to a Drive-hosted image; who owns that file for prod is not stated.
- Step 11 names only `ADMIN_GROUP` and `ADMIN_EMAILS`; add the in-app Admins list (D32) and the two settings decision.
- Scope table: `gmail.addons.current.message.metadata` also reads the open email's Reply-To, From, To and Cc for "Reply" and "Reply all"; `gmail.addons.current.action.compose` also creates the drafts of "New email", "Reply", "Reply all" (slice 18).
- "Every step ... not yet exercised" stays true: no step of part 2 has run.

## Files touched

docs/spec.md; docs/adr/0001, 0002, 0003, 0004, 0006, 0007, 0008, 0009; docs/wireframes/01, 02, 04, 06, 07; .claude/agent-memory/architect/MEMORY.md; this file.
