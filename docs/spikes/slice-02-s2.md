# Spike S2: caller identity on the dev deployment (owner instruction sheet)

Purpose: answer ADR-0003 Part A questions (a) to (d) and spec section 14 (e) with the slice 2 build. Time: about 15 minutes. Results decide Q6, Q7, Q8 and the dev deploy mode (Q19).

Before you start:

- Slice 2 is deployed to dev (`npm run deploy -- dev`) and `setup` ran once (docs/ops/deploy.md step 8).
- The add-on test deployment is installed (deploy.md step 9).
- Keep `deploy/dev.json` open: `mode` and `execUrl` tell which URL the add-on calls.

Console helper (used in steps 3 and 5). Open the web app URL, Chrome DevTools, Console. In the context dropdown at the top of the Console (default "top") pick the frame `userCodeAppPanel`. Paste once:

```js
const call = (op, args) =>
  google.script.run
    .withSuccessHandler((r) => console.log(op, JSON.stringify(r)))
    .rpc(op, args);
```

## Questions

| ID  | Question (ADR-0003 Part A, spec 14)                                                                  | Decides                            |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| (a) | Does a token carrying `drive.file` pass the `/exec` (or `/dev`) front door with access `DOMAIN`?     | Q6: second API deployment if no    |
| (b) | Is `Session.getActiveUser()` set on token calls from the add-on?                                     | Q7: `CALLER_IDENTITY=id_token` if no |
| (c) | Must the project be shared with callers?                                                              | Q8: share prod as Viewer if yes    |
| (d) | Does a token call to the `/dev` URL work for project editors?                                         | Q19: dev mode `head` or `version`  |
| (e) | Does the Advanced Drive service work on `drive.file` alone?                                           | Q16: `DRIVE_CLIENT=rest` if no     |

## Steps

1. (a), (b), (d). Gmail, compose a new message, open Migway Templates in the compose toolbar, click Ping.
   - Expected: notification `Ping ok: server dev-<sha> sees <your email> (N ms)`.
   - `Ping failed: NETWORK. Server returned HTTP 401` or `403`: the front door refused the token. With `mode: head` (URL ends in `/dev`), (d) is no: follow deploy.md "If step 10 shows ..." and repeat with `mode: version`. With `mode: version` (URL ends in `/exec`), (a) is no.
   - `Ping failed: AUTH_NO_USER`: the token passed (a yes) but the active user is blank: (b) is no.
   - `Ping failed: AUTH_DOMAIN`: `setup` has not run, or ran as another account. Rerun step 8 of deploy.md.
2. Record the `N ms` of 5 Pings (UrlFetch round trip, input for spike S2b).
3. (b) detail, web app path. Open the web app URL, run `call("spike.s2", {})`.
   - Expected: `{"ok":true,"data":{"surface":"webapp","tokenCall":false,"activeUser":"<you>","effectiveUser":"<you>","callerIdentified":true,"driveReachable":true}}`.
   - `activeUser` blank: the web app cannot identify callers either; stop and report.
4. (c) Ask a Migway colleague who is not a project editor to open the `/exec` URL of the web app deployment (not `/dev`; `/dev` is editors only).
   - Expected without sharing: the page "Migway Templates" with "Signed in as <their email>". A Google "You need access" page means (c) is yes for the web app.
   - The token path for non-editors (add-on) can be tested only after the admin domain install (2.5b), because test deployments need editor access. Write "web app: <result>; token path: after 2.5b".
5. (e) Same console as step 3. `driveReachable` in step 3 is `true`, and Drive shows the folder "Migway Templates Data" with 7 entries. If `setup` failed with a Drive error instead, set Script Property `DRIVE_CLIENT` to `rest`, run `setup` again and record that (e) is no.

## Results (fill in)

Date:              Deployment mode (`head` or `version`):              Tester:

| ID  | Result (yes, no, partial) | Evidence (exact text shown)                         |
| --- | ------------------------- | --------------------------------------------------- |
| (a) |                           |                                                     |
| (b) |                           |                                                     |
| (c) |                           | web app: ; token path: after 2.5b                   |
| (d) |                           |                                                     |
| (e) |                           |                                                     |
| Ping round trip, 5 runs (ms) |  |                                                     |

Pass condition (spec section 14): (a), (b), (e) yes; (c), (d) answered.
