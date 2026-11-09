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
npm run dev:web                          # web app with a fake google.script on http://127.0.0.1:5173/
npm run lighthouse                       # accessibility audit of library, editor and history (needs Chrome)
```

`npm run dev:web` serves the web app with the dev harness (`src/web/dev-harness.ts`): in-memory folders and
templates, no Google call. Routes: `#/library`, `#/edit/T-QUOTE`, `#/history/T-QUOTE`, `#/new?folder=F-QUOTES`.
Add `?fail=BUSY&failOp=template.update` (any error code and op) to see error states, `?latency=0` for speed.
The production build never includes the harness.

Deploying needs the owner's clasp login: see `docs/ops/deploy.md`.
