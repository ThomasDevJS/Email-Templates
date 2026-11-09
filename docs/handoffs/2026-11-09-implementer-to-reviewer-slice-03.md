# Handoff: implementer to reviewer, slice 3 (template CRUD and editor)

Branch `slice/03-editor`, based on 66c44c2 (orchestrator branch head). 4 commits plus this handoff: b216e75 (shared parser, validator, renderer, sanitizer), 52a733c (server write path and ops), 121470c (web app, editor, harness), f02efe2 (boundary rule, docs). Not merged.

## Done, per acceptance criterion

1. `src/shared/placeholders/`: `grammar.ts` (ADR regex character for character, a test compares `TOKEN_PATTERN.source`), `validate.ts` (all 7 codes plus `PH_NO_FALLBACK` warning, did-you-mean at distance 2 in `distance.ts`), `render.ts` (escaping, newline to `<br>`, prompts filled once by identity, `\{{`, implicit prompts), `registry.ts` (5 names). Tests: 49 grammar cases (6 ADR samples plus 43), every code, escaping, and a property test over 300 seeded random bodies: `renderBody(sanitize(x))` equals `sanitize(x)` when it holds no `{{` (>250 checked).
2. `src/shared/sanitize/`: htmlparser2 12.0.0 (exact pin, first runtime dependency). It bundles into the Apps Script IIFE: test/unit/scripts/sanitizerBundle.test.ts builds an IIFE and runs it in a bare `vm` context with no `require`, `process` or `Buffer`. Allowlists, URL schemes, style filter, forced link attributes, depth 32, canonical output, repeat-until-stable for idempotency, 100 KB output cap and a 1 MB input cap (both VALIDATION), `IMG_HOSTS`. Fixtures: test/fixtures/sanitizer/, 41 cases (26 malicious: the ADR list names 26, 15 benign), each `.input.html` and `.expected.html`; idempotency over all 41; tokens in text survive, tokens in attributes give PH_ATTR.
3. Write path: `src/shared/body/prepare.ts` (sanitize, then placeholder scan; problems become one VALIDATION with `details.problems`), `src/server/handlers/body.ts` (`IMG_HOSTS`, `prepareFor`, `readableBody`). `template.create` and `template.update` run it before the lock and store `placeholders`, `prompts`, `snippet`, `sizeBytes`; body files store `html` and `plainText`. The identity sanitize port is gone from `Services`. New `template.getBody` (level use, both surfaces). History handlers in `handlers/history.ts`.
4. Web app `src/web/`: plain TypeScript, no framework. Library (tree `role="tree"`, grid `role="grid"`, `/` search over title, folder path and tags, accent-insensitive), Editor, History. Header "Signed in as" from `profile.me`. Hash routes `#/library`, `#/edit/<id>`, `#/history/<id>`, `#/new?folder=<id>`; `?view=editor&id=` and `?view=history&id=` redirect (router.ts). Star disabled with title "Slice 5" (no favorite op is implemented).
5. Editor: ProseMirror model 1.25.13, state 1.4.4, view 1.42.9, schema-basic 1.2.5, schema-list 1.6.0, history 1.5.1, keymap 1.2.3, commands 1.7.2, inputrules 1.5.1, all exact. Tables use 3 own schema nodes (no prosemirror-tables). Schema in editor/schema.ts; placeholder atom chip with `data-ph`, `contenteditable=false`, aria-label "Placeholder: sender name". Serializer (editor/serialize.ts) writes canonical HTML by hand so colors keep their spelling; literal `{{` becomes `\{{`. Picker from the toolbar and on typing `{{` (5 names, "Ask the user...", "Add fallback..." on a selected chip). Toolbar: one tab stop, arrow keys, `aria-pressed`. Ctrl+S and Save button, disabled while saving, status "Saved as version N, HH:MM". Conflict dialog with the 3 choices. VALIDATION problems listed under the editor with character positions.
6. test/unit/web/roundtrip.test.ts: 20 bodies in test/fixtures/editor/bodies.ts, `serializeDoc(parseHtml(html)) === sanitize(html)` and equal token counts. test/unit/web/editor.test.ts: bold on a chip gives `<strong>{{sender.name}}</strong>`, Backspace on a chip and a selection across it remove the whole token, typing `{{` calls the picker, copy and paste keep the token. jsdom per file (`// @vitest-environment jsdom`).
7. States: 8 skeleton rows with `aria-busy`, empty folder with New template (edit level only), no results, DENIED and NOT_FOUND banners with "Back to the library", BUSY, QUOTA, NETWORK and INTERNAL toasts with Retry and request ID, AUTH page. Focus ring 2 px, dialog focus trap and return, color tokens in CSS variables, dark theme via `prefers-color-scheme`. test/unit/web/app.test.ts drives all of it through the dev harness in jsdom (15 tests).
8. `rpc(op, args, requestId)`: the server logs a well-formed client request ID (`[A-Za-z0-9-]{8,64}`), else a UUID. rpc/client.ts: at most 4 calls in flight, FIFO queue, `RpcError` with spec codes. Dev harness src/web/dev-harness.ts, used by `npm run dev:web` and `npm run lighthouse`; the production page never contains it (webBundle.test.ts, boundary test, ESLint rule).
9. scripts/lighthouse.mjs (Lighthouse 13.6.0, Chromium at /opt/pw-browsers/chromium, `--headless=new --no-sandbox`). Scores below.
10. `index.html` 270.5 KB of 400 KB. Budget unchanged. `Code.js` grew from 103.4 KB to 224.8 KB (htmlparser2 and its entity tables).
11. Gates unchanged; results below. Web line coverage 90.19% (1131/1254), reported, not gated.
12. docs/ops/smoke.md "Slice 3" (10 steps). README: `npm run dev:web`, `npm run lighthouse`.

## Decisions the reviewer should check

- Op names: the task says `template.listVersions`, `template.getVersion`, `template.restoreVersion`. Spec section 6 and the slice 2 policy table already have `version.list`, `version.get`, `version.restore` (level edit), and a test pins policy keys to spec section 6. I implemented those 3 rows instead of adding 3 duplicate rows. `template.getBody` is new (level use) and is listed in the test's extra ops; spec section 6 lacks it (architect to add).
- Import: no import handler exists (slice 6). `prepareBody` is the shared write path it must call.
- `template.getBody` and `version.get` sanitize again on read, so bodies stored before slice 3 never reach the browser unsanitized.
- Restore re-runs sanitize and validation on the old body; a version that fails today's rules cannot be restored (VALIDATION).
- List items: the first paragraph is written without `<p>` (no extra margins in mail clients). `<li><p>x</p></li>` input becomes `<li>x</li>`.
- Mark order is the schema order (link, strong, em, u, s, color, background, size, family), so the editor normalizes nesting. The 20 round-trip bodies use that order.
- `<base target="_top">` would send fragment links to the top window, so the Library nav and the skip link are handled in script.
- Library view and editor wait for one shared folders and templates load; a failed load shows one toast whose Retry reloads and re-renders.

## Verified (2026-11-09, Node 22.23.4, after `rm -rf node_modules dist coverage build && npm ci`)

- `npm ci`: "added 559 packages, and audited 560 packages in 10s". 16 advisories (14 moderate, 2 high), all dev tree (clasp, lighthouse).
- `npm run lint`: exit 0. `npm run format:check`: "All matched files use Prettier code style!" `npm run typecheck`: exit 0.
- `npm run test:coverage`: "Test Files 31 passed (31)", "Tests 737 passed (737)". All files: statements 93.68%, branches 86.18%, functions 91.83%, lines 94.72%. Lines: shared 100% (489/489), server 99.38% (1130/1137), web 90.19% (1131/1254).
- `npm run build -- --env dev`: "Code.js: 224.8 KB of 800 KB", "index.html: 270.5 KB of 400 KB".
- `npm run scopes:check`: "Scope check passed: 11 scopes, all approved." No scope change in this slice (appsscript.json untouched).
- `npm run lighthouse`: "Lighthouse accessibility library: 100", "editor: 100", "history: 100".
- Manual run in headless Chromium (puppeteer-core from Lighthouse's tree, scratch script not committed): typing `{{` opens the menu with focus on "Sender name", Escape re-inserts literal `{{`, Ctrl+S saves, toolbar is one tab stop, dark theme renders.
- Secret scan of the diff: 0 key or token patterns. Emails only `@example.com`. URLs only example hosts and 127.0.0.1.
- Not verified against Google: `google.script.url.getLocation` and `google.script.history.push/replace` inside the HtmlService iframe, the clipboard in the sandboxed iframe (falls back to a status message), htmlparser2 inside real Apps Script V8 (verified only in a bare Node `vm` context).

## Left for later

- Favorites star (slice 5), search operators `folder:` and `tag:`, body search, ranking, Uses column (slice 5). Trash view and template delete, move, duplicate in the UI (ops exist; UI slice 5). New folder button (slice 6 admin).
- Admin nav entry (slice 6). Unsaved-changes warning on leaving the editor.
- Import handler must call `prepareBody` (slice 6).
- Spec section 6: add `template.getBody` (use, both). ADR-0004: list item and mark-order normalization above.
- History "Load older" paging (wireframe 05); all versions load at once.
- `membership.refresh` still does not clear `prof:*` (slice 6, from slice 2).

## Risks

- A literal backslash typed right before a chip serializes as `\{{...}}`, which reads back as an escape, not a token. Rare; no fix in v1.
- Sanitizer output is the ADR allowlist; the slice 4 insert spike may trim it. The editor schema is a subset, so trimming the sanitizer can only drop editor features.
- `Code.js` doubled to 225 KB; parse cost per cold execution is unmeasured.
- Lighthouse runs on the dev harness page, not the HtmlService page Google serves (Google adds its own wrapper).

## Files touched

- New: src/shared/{html/escape.ts, body/prepare.ts, placeholders/{grammar,validate,render,registry,distance}.ts, sanitize/{sanitize,attrs,css,policy}.ts}; src/server/handlers/{body,history}.ts; src/web/{host,router,dev-harness}.ts, src/web/{editor,library,rpc,ui,views}/*.ts; scripts/{web,dev-web,lighthouse}.mjs; test/fixtures/sanitizer/ (82 files), test/fixtures/editor/bodies.ts; test/unit/shared/{placeholders,sanitize}.test.ts, test/unit/server/history.test.ts, test/unit/scripts/{sanitizerBundle,webBundle}.test.ts, test/unit/web/{app,editor,logic,roundtrip}.test.ts, test/unit/web/domStubs.ts; this handoff.
- Changed: package.json and lock (10 runtime deps, jsdom, @types/jsdom, lighthouse), .prettierignore, eslint.config.mjs, vitest.config.ts, scripts/build.mjs, scripts/lib/html.mjs, src/server/{entry,runtime,services}.ts, src/server/dispatch/{handlers,policy}.ts, src/server/handlers/templates.ts, src/web/{app.ts,index.html,styles.css}, test/fakes/world.ts, test/unit/{boundary,server/dispatch,server/entry,server/items}.test.ts, docs/ops/smoke.md, README.md.
- Deleted: 4 `.gitkeep` files.

## Commands

```sh
rm -rf node_modules dist coverage build && npm ci
npm run lint && npm run format:check && npm run typecheck
npm run test:coverage
npm run build -- --env dev && npm run scopes:check
npm run lighthouse            # CHROME_PATH overrides /opt/pw-browsers/chromium
npm run dev:web               # manual check on http://127.0.0.1:5173/
```
