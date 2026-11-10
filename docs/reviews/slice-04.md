# Review: slice 4 (apply to compose, add-on sidebar)

Verdict: FAIL

Reviewed 2026-11-10 by the reviewer agent. Branch `slice/04-apply`, head 2ac580f, base `claude/gracious-franklin-3n8zbq` (05ed21f). 7 commits, 67 files, +3,974 / -537.

## Reasons

- One blocking gap: the sidebar empty state (AC 5, spec section 7, wireframe 07 A) does not show for a caller who has a private folder. Every caller gets one on the first library open (`folder.list` runs `ensurePrivateFolder`). Smoke "Slice 4" step 8 then fails: the second account opened the library in slice 3 step 9 and sees "My templates (0)".
- Everything else holds. All 12 commands pass from a clean `npm ci`. 842 tests pass. Scopes stay at the approved 10.
- Permission checks run server-side on all 3 new or wired ops. `sidebar.home` filters by `use` in the handler. `template.apply` re-checks `use` in dispatch (target `itemFolder`) on every call. `spike.s4` is `both("admin.ops")`. Default deny holds: a caller without grants gets empty lists, and the apply of an ungranted template returns DENIED.
- Escaping holds. Probe: prompt value `<img src=x onerror=1>{{sender.name}}` plus a newline, and the same string as the recipient's Directory given name, render as `&lt;img src=x onerror=1&gt;{{sender.name}}<br>x`. `{{sender.name}}` stays literal: `renderBody` maps each text run once (`mapTextRuns`). Sender name `Ana <i>Lima</i>` renders escaped too.
- No secret in the diff. No new network host.

## Commands (worktree, Node 22.23.4, 2026-11-10)

| Command | Result |
|---|---|
| `rm -rf node_modules dist coverage && npm ci` | exit 0, "added 559 packages, and audited 560 packages in 9s", 16 advisories (14 moderate, 2 high), dev tree |
| `npm audit --omit=dev` | "found 0 vulnerabilities" |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| `npm run test:coverage` | exit 0, "Test Files 40 passed (40)", "Tests 842 passed (842)". All files: statements 94.92%, branches 88.27%, functions 93.25%, lines 95.95%. Lines: addon 100%, shared 100%, server 99.08%, web 93.75% |
| `npm run build -- --env dev` | exit 0, "Code.js: 258.9 KB of 800 KB", "index.html: 271.1 KB of 400 KB". 19 top-level stubs, no `onPing`, `onDiag` or `oauth2` |
| `npm run scopes:check` | exit 0, "Scope check passed: 10 scopes, all approved." |

Probes ran in a scratch copy (`git archive HEAD`), one vitest file, deleted after: escaping, external and unknown recipients on the server, empty state, admin and private folders, unset `DOMAIN`, `spike.s4` as a manage holder.

## Acceptance criteria

| # | Result | Note |
|---|---|---|
| 1 | met | `sidebar.home` returns top folders with subtree counts, subfolders, templates, `favorites: []`, `recent: []` |
| 2 | met | body only when `knownVersion` differs, through `readableBody`; sender; internal first name; one apply event |
| 3 | met | home, folder (20 per page, Prev/Next disabled at ends), preview (600 chars, `[Label]`, Edit at edit+), prompt card (`p-1`..`p-20`, blank and over-500 blocked, problem fields first) |
| 4 | met | `UpdateDraftActionResponse`, `IN_PLACE_INSERT`, `MUTABLE_HTML`; one tap without prompts |
| 5 | not met | empty state condition is wrong (gap 1). Error with request ID, DENIED, QUOTA (60 s wait), not set up: present |
| 6 | met | builders are pure data; role tests none, use, edit, manage, admin for apply; `spike.s4` denied to manage holders on both surfaces |
| 7 | met | harness admin-only server-side; sheet docs/spikes/slice-04-insert.md with empty tables; allowlist and 100 KB cap unchanged |
| 8 | met | `onDiag`, diag.ts, `oauth2.googleapis.com`, `spike.s2`, `spike.s2b` and their rows and tests are gone |
| 9 | met | all 6 carry-overs done; `writeMerged` reads `members.json` strictly and writes nothing on failure |
| 10 | met | smoke "Slice 4" has 10 steps; step 8 fails because of gap 1 |
| 11 | met | 10 scopes |
| 12 | met | table above |

## Implementer decisions

- a. Accept. Unset `DOMAIN` returns NOT_CONFIGURED. Guard order is unchanged: blank caller gives AUTH_NO_USER first (probe), then `requireDomain`, then the policy row. Every caller, inside or outside the domain, is denied while `DOMAIN` is unset. The only new fact disclosed is "setup not run", and the `DOMAIN`-restricted deployment keeps outside accounts off `/exec`. With `DOMAIN` set, outsiders still get AUTH_DOMAIN. The denied event keeps `AUTH_DOMAIN` (dispatch.ts `checkDomain`), a label mismatch only.
- b. Accept, with a spec edit. The filter is server-side in `visibleFolders` (src/server/handlers/sidebar.ts:53); the card does nothing. ADR-0003 lines 113 and 117 and spec Q5 say admins see private folders. That still holds in the library: an admin's `folder.list` returns both "My templates" folders, and `template.apply` on another user's private template succeeds for an admin (probes). The sidebar shows less, which grants nothing. Architect adds one line to spec section 4.1 or ADR-0003.
- c. Accept. Spec 4.1 step 3 buffers the event inside `template.apply`, which runs on the Insert tap, before step 5 pushes the prompt card. A blocked insert or a body cache miss calls `template.getBody`, which buffers nothing, so one tap gives one event. Consequence for slice 5: a cancelled prompt card counts in `applyCount` and puts the template in Recent. Slice 5 should state this in the Recent copy or accept it (Q14 already treats usage as analytics).
- d. Accept. `ENTRY_POINTS`, src/entry.ts and the build stubs match (12 add-on functions, entry.test.ts compares the sets). Op `ping` keeps its policy row `both(ANY_CALLER)` and is callable from the console helper. Smoke Slice 1 step 2 is marked removed. Step 3 still says "Ping server shows Ping ok" in the web app, which has had no Ping button since slice 3 (gap 4).
- e. Accept. `spike.s4` has policy row `both("admin.ops")` (src/server/dispatch/policy.ts:94). A manage holder gets DENIED on both surfaces (probe and sidebar.test.ts). The home card hides the section for non-admins as a convenience only.

## Further checks

- `recipientEmailIfInternal`: the add-on sends only the single To address in the caller's domain (src/addon/event.ts:35). The server checks it against `DOMAIN` again (sidebar.ts:149) before the Directory call. Probe: `max@outside.example` gives "" even with a Directory record. A domain user can still pass any internal address and read its `givenName`. Spec Q11 limits only external names, and `domain_public` exposes the same field to every domain user. Each call also buffers an apply event, so bulk lookups leave a trace.
- Logs: one new log call (`grant.add.snapshotMerge`, actor and error only). Probe log lines hold no prompt value, body text or recipient address.
- User Cache: `CacheService.getUserCache()` is per user and per script, so keys `view:*` and `body:<id>` need no email. The view holds only the caller's `use`-filtered `sidebar.home` result and lives 600 s. See gap 2 for `body:<id>`.
- Network: UrlFetch goes only to `execUrl` and its 302 target. F1 links to www.google.com and F5 loads an image from www.gstatic.com; Gmail fetches that image, app code does not.
- Secret scan of the diff (lock excluded): 0 hits for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, eyJ. Emails: only example.com, other.example and outside.example. Removed diag.ts held a dev deployment URL (an ID, no credential); it stays in git history.

## Gaps

1. Blocking. src/addon/cards/home.ts:54 shows the empty state only when `view.folders.length === 0 && view.templates.length === 0`. Spec section 7 says "no visible templates". A caller with an empty private folder gets "Folders: My templates (0)" and no empty text (probe). Fix: test `view.templates.length === 0`, keep Open library, add a test with an own private folder at count 0. Smoke "Slice 4" step 8 then passes as written.
2. Minor. src/addon/flows.ts:230 renders the prompt card Insert from `body:<id>` (TTL 6 h) with no server call. A grant removed while the prompt card is open does not stop that insert. The caller already received the body through `template.apply`, so nothing new leaks. Accept or call `template.apply` again; note it in the spec.
3. Minor. `SidebarTemplate.placeholders`, `SidebarFolder.own` and `SidebarHome.rev` have no reader in src/addon. src/shared/model/sidebar.ts:27 says the add-on uses `placeholders`; it does not. Use or drop, to keep the cached view small.
4. Minor. docs/ops/smoke.md Slice 1 step 3 asks for a web app "Ping server" button that no longer exists.
5. Minor. ADR-0004 Apply semantics 4 says slice 4 tries `Action.setRequiredWidgets`. Not tried; the handoff defers it.
6. Open for the architect: spec section 6 lacks `template.getBody` (slice 3 gap 7) and `spike.s4`; ADR-0004 paste-sanitize wording (slice 3 gap 6); unset `DOMAIN` gives NOT_CONFIGURED; sidebar hides other users' private folders from admins.

## Not verified

- Card Service calls in Gmail (`setAltText` on a button inside `DecoratedText`, `setDisabled`, `FixedFooter`, `popToRoot`), `draftMetadata.toRecipients`, `commonEventObject.formInputs` shape, insert behavior. Smoke "Slice 4" and the spike sheet cover them.
- Apply p95 under 2 s and sidebar load under 3 s (spec section 12): owner stopwatch runs.

## Next

Implementer fixes gap 1 (one condition, one test). Reviewer reruns the test suite and the home card probe. Gaps 2 to 5 may go with that fix or into slice 5.
