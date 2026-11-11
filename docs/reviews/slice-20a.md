# Review: slice 20a, fix round web app and server

Verdict: FAIL. 2 must-fix, 11 minors. Server, security, merge and checks are clean; the first-load error and one deploy step are not.

Branch `slice/20a-fix-web-server`, head c7e6beb (c1cc732 plus a merge of the main line ef3805c), base 16df87a. Slice diff `16df87a..c1cc732`, 15 commits. Reviewed 2026-11-11.

## Commands (worktree c7e6beb, after `rm -rf node_modules`)

| Command | Result |
|---|---|
| `npm ci` | exit 0; 16 audit findings (14 moderate, 2 high), same as earlier slices; no dependency change |
| `npm run lint` | exit 0, no findings |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | 69 files, 1965 tests passed; statements 97.19, branches 91.02, lines 98.03 |
| `npm run build -- --env dev` | "Built dev c7e6beb", Code.js 371.0 KB of 800 KB, index.html 380.3 KB of 400 KB (handoff 380.2 on c1cc732) |
| `npm run scopes:check` | "Scope check passed: 10 scopes, all approved." |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run lighthouse` | 16 of 16 runs at 100 |
| `git diff 16df87a c1cc732 --stat -- src/addon src/shared/placeholders appsscript.json scripts package.json package-lock.json` | empty |
| `git diff claude/gracious-franklin-3n8zbq c7e6beb --stat -- src/addon src/shared/placeholders` | empty |

## Must-fix

1. `docs/guide/admin-guide.md:273` (step 9) says `npx clasp open-script`. Step 5 deletes the root `.clasp.json`, so the command has no project. Run from a directory without `.clasp.json`, clasp 3.4.1 prints "Script ID not set, unable to open IDE." Fix: `npx clasp open-script <scriptId>` with the `scriptId` from `deploy/prod.json`, or "open the project at script.google.com". `docs/ops/deploy.md:14` (dev step 6) has the same text since slice 2; fix it in the same line edit.
2. `src/web/app.ts:143-155, 309-335`, failed first load. Probe (dev harness, `?fail=INTERNAL&failOp=template.list`):
   - One failure shows two errors: the banner "Templates could not be loaded. Press Reload to try again." (`role="alert"`) and the toast "Something went wrong. Try again." with "Retry" from `load()` (`app.fail`). A screen reader announces both. The page offers two retry buttons with two names. Each failed Reload adds one more toast (2 toasts after one Reload). The handoff says "one error with Reload".
   - "Reload" removes the focused button. Focus falls to `BODY`, on success and on a second failure.
   - Fix: give `load` a quiet mode for the first load, so only the banner shows; in the Reload handler call `main.focus()` after `replace`. Add a test for each.

## Probes

Probe copies: `git archive` of head and base in the scratchpad, symlinked `node_modules`, vitest probe files with `setupWorld`, Playwright Chromium on two dev harness servers (head 5191, base 5193).

### Item 1, shared Admin folder list

- Create, rename, move (into HR) and delete in "Folders and access": both "Export and import" lists ("Folder" and "Import into") show each change on the next tab open, no reload. The library tree shows ProbeA after create and drops it after delete (`folder.list`, `template.list` on the next library view, slice 6b behavior kept).
- Calls per write: `folder.create|rename|move|delete`, `admin.folders`, `grant.list`. Opening "Export and import": 0 calls. 7 tab switches: `membership.status`, `audit.query`, `usage.report`, `backup.list`, `config.get` (each tab's own data, as before); 0 `admin.folders`.
- Import: `import`, `folder.list`, `template.list`, `admin.folders`. The harness import creates no folders, so the new folder in the lists is shown by the unit test only.
- No other Admin tab lists folders.

### Item 2, first paint

- `dist/index.html` with JavaScript off: main holds "Loading..." with `role="status"`.
- Fast load (latency 0): the script replaces "Loading..." before DOMContentLoaded with the library skeleton, then the list. No error flash.
- 20 s first call: skeleton until 15 s, banner and Reload at 15.1 s, the library at 20.1 s. Focus stays on `main`.
- Failure: see must-fix 2.
- `scripts/lib/html.mjs` unchanged since 16df87a (byte-identical).

### Item 3, editor and history

- Engine files: `git diff 16df87a c7e6beb -- src/web/editor src/shared/body src/shared/sanitize src/shared/html` shows only the 3 added lines in `setup.ts`. Fixtures unchanged.
- Stored HTML, 5 editing scripts of the 8b review (T-QUOTE, T-DISCOUNT, T-WELCOME, T-OLD, new): 5 of 5 byte-identical to base, same node counts after undo and redo.
- Caret, 72 insert runs (7 tools, Enter and click, 6 caret positions): 63 identical to base; 9 differ, all at paragraph start, where the typed mark now lands after the image, link or ask field (base: before). Stored HTML `<p><img ...>ZHello world</p>`. A menu field (Sender name) at paragraph start still puts the mark before the node on both builds (minor 4).
- Back and Forward (harness): clean trip editor, history, Back, Back, Forward, Forward lands on each page, 4 entries. Unsaved, Back, "Discard changes": library, history length 3, Forward reaches the editor; base pushes a 4th entry and Forward is dead. Unsaved, Back twice: 1 dialog. Unsaved Forward plus Discard: history page, Back to the editor.
- Audit drawer: click then Enter on Details, 20 tries, 1 drawer each time. Two rows clicked fast: 1 drawer.

### Item 4, server

(a) Export run reuse (`transfer.ts:136-198`):

| Probe | Same run | Start events added |
|---|---|---|
| Same caller, scope, `run`, within 60 s | yes | 0 |
| Caller B sends caller A's `run` | no | 1 |
| A retries after B's start with the same key | no | 1 (B overwrote `exps:<run>`) |
| Admin: folder run, then library start with the same key | no | 1 |
| Admin: other folder, same key | no | 1 |
| `"x"`, `""`, lowercase, trailing newline, `__proto__`, 5,000 characters, `null` | no | 1 each call |
| Number, object, array, `true` | VALIDATION "run: expected a string" | 0 |
| Same key after 61 s | no | 1 |
| Run token evicted, `exps:` still there | no | 1 |
| Grant removed between start and retry | DENIED, no token in the reply | 0 |
| Folder deleted between start and retry | NOT_FOUND (dispatch target check) | 0 |
| Page call with `run` and no token | refused | 0 |

Dispatch authorizes every retry before the handler. The token and the `run` key appear in 0 log lines. The slice 13 probes (offset 1, empty token, other caller's token, busy lock, 1,000 templates cold, expiry and eviction) are tests in `adminReports.test.ts` and pass.

(b) IDs: `newId` changed in `runtime.ts:128`; `newRequestId` is unchanged. `makeId`, `isId`, alphabet (Crockford 32), 26 characters, 10 time characters first: unchanged, so sort order and old data are unaffected. `isId` is byte-identical, so every earlier stored ID still passes; an old `Math.random` ID passes. 100,000 new IDs: 0 rejected by `isId`, 32 characters used, per-character counts 49,393 to 50,333 (expected 50,000). Entropy: 80 bits in both builds (16 characters of 5 bits). Before: V8 `Math.random`, not a secure generator. After: 16 bytes of SHA-256 of a v4 UUID (122 random bits), byte mod 32 is uniform. `Utilities.getUuid()` exists in Apps Script (`@types/google-apps-script` utilities d.ts line 77); the fake `test/fakes/output.ts:105` has it since slice 12.

(c) Progress uses each page's `total`; total null until the start answers. Tests pass.

### Items 5, 6, 7

- Directory warn line: `requestId` of the request, `actor` "", `errorCode` "ADMIN_CHECK:503"; no address, no message text (admins.test).
- Trigger reinstall: a failure with an address in the message stores "2026-11-09T12:00:00.000Z INTERNAL Error"; the next success deletes `job:triggers:lastError`.
- Planted-address probe: index, favorites, usage and members files each damaged 3 ways with an address, daily and tick, then 6 ops: 12 runs, 0 hits in properties, log lines, thrown messages and replies.
- NOT_CONFIGURED: library and editor save show "Migway Templates is not set up yet. Ask your admin to finish setup." Admins text says "its access". Tests updated.

### Item 11, deploy docs

- Every command exists in clasp 3.4.1 or `package.json`: `clasp login`, `clasp create --type --title --rootDir`, `npm run deploy -- prod`, `npm run setup:check`. `open-script` fails as written (must-fix 1).
- Order works with `scripts/deploy.mjs`: mode head needs only `scriptId` (`missingForDeploy`), prod needs branch `main` and a clean tree, the build warns on an empty `execUrl`, the first drift check is skipped, version mode needs `deploymentId` and `execUrl`, `create-deployment -i` exists. `setup()` sets `OWNER_EMAIL`, `DOMAIN`, `ADMIN_EMAILS` (`jobs/setup.ts:26-29`). Labels "Add admin", "Personal templates", "Outside recipients", "Settings and backups" exist in src.
- The 10 scopes in the guide table equal `appsscript.json`.
- No step asks to share a password or put a token in the repository; the clasp token stays in `~/.clasprc.json`. Untried steps are marked "Not yet tried" (3, 4, 8, 17) and the part heading says not yet exercised.

### Items 8 to 11

- Removed lines in `src` hold no permission check; the two removed `throw new AppError` blocks now use `NOT_SET_UP_TEXT`. Dispatch, permissions, entry points and error codes unchanged; op names unchanged. Role-matrix tests pass. No new scope, no new dependency.
- Merge: `git show --remerge-diff c7e6beb` touches only `docs/design/wording.md`. Every other file's change equals its parent's change against the merge base. "Web app fix round (slice 20a)" and "Gmail cards fix round (slice 20b)" each appear once; no conflict markers.
- Secret scan of the 1,923 added lines (16df87a..c7e6beb): 0 hits for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, github_pat, AKIA, xox, eyJ. The slice's own diff adds only `audit@example.com`. Merged main-line lines (design mockups) add role and sample addresses at migway.com, reviewed in their own runs. URLs: script.google.com user settings, the `/exec` pattern, Google developer docs.

## Minors

1. `app.ts:309`: a failed or 15-second first load replaces any view in `main`, Admin included. Probe: `#/admin` with `template.list` delayed 20 s shows the banner at 15 s and redraws Admin on its first tab at 20 s; any typed Admin input is lost. The editor is not affected. Named as a risk in the handoff.
2. `NOT_CONFIGURED` on first load: 2 identical toasts plus the banner "Press Reload", which cannot fix a missing setup.
3. Folder write then a tab switch before the refresh answers (2 calls): "Export and import" shows the old lists until the next switch. An import's `folders.refresh()` does not redraw the open tab's lists.
4. A menu field (Sender name) inserted at paragraph start still leaves the caret before the node, on base and head; the fix covers dialog inserts.
5. `adminAudit.ts:152`: `opening` is per tab; a Details click on another row while one loads is ignored with no text.
6. Two concurrent starts with the same `run` (a network retry while the first runs) both miss `exps:` and write 2 events; the check is outside the lock.
7. Guide step 12 (`admin-guide.md:276`) says the run creates version 1 and "Versions used 1 of 200". The editor's "New deployment" in step 11 probably creates version 1, so this run creates version 2. Not yet tried.
8. Guide step 4 says nothing shows which account clasp uses; `npx clasp show-authorized-user` exists in 3.4.1 (untried).
9. Errata 5 guide corrections not applied: scope reasons for Reply-To, From, To, Cc and the drafts of "New email", "Reply", "Reply all"; who owns the prod `logoUrl` image.
10. Spec section 6 lacks the `run` argument; spec 7.3 line 533 and wireframe 06 line 119 still say "grants" (architect, as the handoff says).
11. `newId` costs one `getUuid` and one `computeDigest` per ID; a 1,000-template import makes 1,000 or more. Time on Apps Script not measured.

## Only dev can show

- First-entry stamp and `go(moved)` in Google's frame (`google.script.history`); harness only simulates.
- First-load timing and the 15 s banner on `/exec`.
- Caret fix in desktop Chrome.
- NOT_CONFIGURED page before `setup()` on a fresh project.
- `Utilities.getUuid` and digest cost per import.
- Every part 2 step of the admin guide.
