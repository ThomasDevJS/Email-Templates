# Migway Templates

Internal Gmail email templates for Migway, built on Google Workspace only.

- A Gmail add-on sidebar lists, searches and inserts templates into a draft.
- A web app holds the template editor and the admin screens.
- Both live in one Apps Script project per environment (dev, prod) and one deployment serves both.
- The web app runs as the owner. Storage is a private Drive folder of JSON files.
- Every server request passes one permission check in `dispatch` before any data access.
- No secrets in the repository. Script and deployment IDs live in `deploy/<env>.json`.
- TypeScript strict, esbuild bundle, vitest tests, ESLint and Prettier, CI on every pull request.

Layout: `src/shared` (pure logic), `src/server` (web app and triggers), `src/addon` (Card Service),
`src/web` (browser UI), `test/`, `scripts/` (build and deploy), `deploy/`, `docs/`.
Decisions: `docs/adr/`. Specification: `docs/spec.md`. Plan: `PLAN.md`.

Developer commands:

```sh
npm ci                                   # install pinned tools
npm run lint && npm run typecheck && npm test
npm run build -- --env dev               # writes dist/
```

Deploying needs the owner's clasp login: see `docs/ops/deploy.md`.
