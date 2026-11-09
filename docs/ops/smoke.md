# Smoke test (5 minutes, after each dev deploy)

## Slice 1

1. Gmail, compose: the Migway Templates card shows "Migway Templates, slice 1" within 3 s.
2. Click Ping: notification "Ping ok: server dev-<sha> sees <your email>"; the sha matches `git rev-parse --short HEAD`.
3. Open the `execUrl` from `deploy/dev.json`: page shows "Migway Templates" and "Signed in as <your email>"; Ping server shows "Ping ok".
4. Open the same URL in a window signed in to a non-Migway account: Google's access page or "Cannot identify your Migway account" appears, never the app shell.
5. Editor, Executions: each step above logged one JSON line with `level`, `action`, `result`, `durationMs`, `appVersion`, and no template body or token.
