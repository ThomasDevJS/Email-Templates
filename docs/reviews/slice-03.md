# Review: slice 3 (template CRUD and editor)

Verdict: PASS

Reviewed 2026-11-09 by the reviewer agent. Branch `slice/03-editor`, head 41575e3, base `origin/claude/gracious-franklin-3n8zbq`. 6 commits, 165 files, +13,429 / -303.

## Reasons

- All 12 acceptance criteria of the handoff "Done" section are met. Every command below passes from a clean `npm ci`.
- Sanitizer allowlists, URL rules, style filter, depth 32, forced link attributes and the 100 KB cap match ADR-0004. 10 adversarial inputs of the reviewer's own produce no executable markup, and every output is idempotent.
- Placeholder regex equals the ADR regex character for character (string compare of the ADR code block and `grammar.ts`). All 7 error codes fire with the ADR messages.
- Write path: `template.create` and `template.update` call `prepareFor` (sanitize, then `scanBody`) before `writeBody` and before `commit` takes the lock. Only sanitized `html` is stored. `version.restore` runs `prepareFor` on the old body again.
- Permission checks: the 3 `version.*` rows are level edit, web only. `template.getBody` is level use, both surfaces, target `itemFolder`. All 4 handlers go through `dispatch`; restore commits through `handlers/commit.ts` (in-lock recheck). Default deny holds.
- No secret in the diff. Scopes unchanged at the approved 10. No external network call in the web bundle.

## Commands (worktree, Node 22, 2026-11-09 23:06 UTC)

| Command | Result |
|---|---|
| `rm -rf node_modules dist coverage && npm ci` | exit 0, "added 559 packages, and audited 560 packages in 10s", 16 advisories (14 moderate, 2 high), all dev tree |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| `npm run typecheck` | exit 0 |
| `npm run test:coverage` | exit 0, "Test Files 32 passed (32)", "Tests 745 passed (745)". All files: statements 93.59%, branches 86.19%, functions 91.79%, lines 94.61%. Gated: shared 100% lines (gate 90), server 99.06% lines (gate 75). Web, reported only: 93.75% lines at the folder root, editor 90.48%, ui 83.43%, views 88.11% |
| `npm run build -- --env dev` | exit 0, "Code.js: 226.0 KB of 800 KB", "index.html: 271.0 KB of 400 KB" |
| `npm run scopes:check` | exit 0, "Scope check passed: 10 scopes, all approved." |
| `npm run lighthouse` | exit 0, library 100, editor 100, history 100 |
| `npm audit --omit=dev` | exit 0, "found 0 vulnerabilities" |
| `npx vitest run test/unit/scripts/sanitizerBundle.test.ts` | 1 passed: IIFE built with `platform: neutral` runs in a bare `vm` context |

## Extra checks

- (a) Sanitizer vs ADR-0004. Tags: 37 allowed, 23 dropped with content, both lists equal the ADR. Attributes per tag equal the ADR table (`th` uses the `td` rules). `href`: `https: http: mailto: tel:` prefix allowlist after entity decoding and C0/C1 control removal. `src`: `https:` only, `IMG_HOSTS` honoured. Style: allowlist plus `margin`, `padding`, `border` sides; `display` limited to 5 values; forbidden pattern `url( expression( @import javascript: \ < > /* */` on the compacted value; any comment or backslash drops the whole style. `on*`, `id`, `class`, `name`, `srcset`, `formaction`, `xmlns` drop (not in any rule). `target="_blank"` and `rel="noopener noreferrer"` forced. Depth 32 (40 nested divs keep 32). Body over 102,400 bytes gives VALIDATION. `border-radius` is allowed; the ADR's "`border-*`" covers it.
- (b) Regex identical to ADR. The ADR does not list its 6 sample strings; the test's 6 samples (`{{sender.name}}`, fallback, prompt, `\{{`, inner spaces, `{{ask:X|y}}`) behave as the ADR grammar says. 49 grammar cases pass.
- (c) Sanitize then validate before the lock in create, update and restore; confirmed by reading `templates.ts`, `history.ts`, `body.ts`, `prepare.ts`.
- (d) URLs in `dist/index.html`: 7 hits, none loaded. 1 CSS comment from prosemirror-view (`code.haverbeke.berlin/...issues/1421`), 1 error string (`prosemirror.net/docs/guide/#generatable`), 5 UI hint strings and 1 regex in the link and image dialogs (`https://`, `http://`). Only one inline `<script>`, no `src`. 0 hits for `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `import(`. 0 hits for the dev harness. `src/web` has the same 5 hint strings only.
- (e) `dist/Code.js`: 0 matches for `require(`, `process.`, `Buffer.`. Bundle test passes in a bare V8 context. Real Apps Script V8 not verified (smoke step).
- (f) Serializer writes tokens as text, literal `{{` as `\{{`. `backslashProblems` returns `PH_BACKSLASH`; 2 tests pass.
- (g) `createClient` caps at `MAX_CONCURRENT = 4`, FIFO queue, slot freed in `finally`; test "runs at most 4 calls at once". `presentationOf` and `messageOf` cover all 13 `ErrorCode` values (spec TIMEOUT and SERVER map to NETWORK and INTERNAL).
- (h) Labels on title, folder, tags, search and dialog inputs. `role="tree"` and `role="grid"` with arrow keys, Home, End, Enter (app tests). Conflict dialog traps Tab and Shift+Tab, Esc closes, focus returns to Save (app test lines 315 to 322). Save status `role="status"` with `aria-live="polite"`; problems `role="alert"`.
- (i) Runtime dependencies: `htmlparser2` 12.0.0 and 9 ProseMirror packages, all exact. `npm audit --omit=dev`: 0.
- (j) Secret scan of 11,418 added lines (lock excluded; lock scanned separately, 624 `resolved` URLs all on registry.npmjs.org): 0 hits for AIza, ya29., GOCSPX, client_secret, refresh_token, private keys, ghp_, AKIA, xox, eyJ. Emails: a@, ana@, ben@, bob@, dev.user@ (5), sales@ (3), all `example.com`. URL hosts: example hosts, x.com and a.com in fixtures, 127.0.0.1.
- (k) `appsscript.json` not in the diff. Built manifest has the 10 spec section 9 scopes.
- (l) Code.js 226.0 KB of 800 KB. index.html 271.0 KB of 400 KB.

## Adversarial sanitizer inputs (reviewer's own)

| # | Input | Output | Idempotent |
|---|---|---|---|
| A1 | `<noscript><style></noscript><img src=x onerror=alert(1)></style></noscript>` | `` (empty) | yes |
| A2 | `<noscript><a title="</noscript><img src=x onerror=alert(1)>">x</a></noscript>after` | `after` | yes |
| A3 | `<svg/onload=alert(1)><svg><animate onbegin=alert(1) ...></svg><p>ok</p>` | `` (unclosed svg drops the rest) | yes |
| A4 | `<!-- <!-- --><a href="javascript:alert(1)">x</a> --><!--><img src=x onerror=alert(2)>--><!-- --!><img src=x onerror=alert(3)>-->` | `<a rel="noopener noreferrer" target="_blank">x</a> --&gt;<img>--&gt;<img>--&gt;` | yes |
| A5 | `href="JAVA\tSCRIPT:..."`, `"JAVA&#x09;SCRIPT&colon;..."`, `" &#x0A;JaVaScRiPt:..."` | 3 links, `href` dropped on all | yes |
| A6 | `background:u\rl(javascript:...)`, `\75 rl(x)`, `&#117;rl(javascript:x)`, `expression&#40;...&#41;` | `<p>a</p><p>b</p><p style="color: red">c</p><p>d</p>` | yes |
| A7 | `<xmp><a title="</xmp><img src=x onerror=alert(1)>">t</a></xmp>` | `&lt;a title="<img>"&gt;t` | yes |
| A8 | `&#100;ata:` href, `vbscript&#58;` href, `//evil` src, `HTTPS:` src width 2001 | hrefs dropped, `<img>`, `<img height="10" src="HTTPS://ok.example/a.png">` | yes |
| A9 | `position:fixed; display:none; behavior:url(); -moz-binding:url(); ... /* c */` | style dropped whole (comment) | yes |
| A10 | `<a target=_self rel=opener onclick id class name>` | `<a href="https://ok.example" rel="noopener noreferrer" target="_blank">` | yes |

Validator probe: `{{sender.nmae}}` PH_UNKNOWN with "Did you mean sender.name?", `{{Sender.Name}}` PH_CASE, `{{sender.name` PH_MALFORMED, `{{ask:}}` PH_LABEL, `{{ask:X|y}}` PH_FALLBACK_ASK, 21 prompts PH_TOO_MANY, `{{` in `href` PH_ATTR, `{{<b>sender</b>.name}}` PH_MALFORMED.

## Gaps (none blocks the slice)

1. `template.get` returns the stored body without sanitizing it again, and the editor loads through it (`api.ts` `template`). The handoff says bodies stored before slice 3 never reach the browser unsanitized; that holds for `template.getBody` and `version.get` only. Risk is low: the editor parses in an inert `DOMParser` document and its schema keeps only `https/http/mailto/tel` links and `https` images. Fix: route `templateGet` through `readableBody`. Next: implementer, slice 4 or 5.
2. QUOTA retry is immediate. Spec section 7 says retry after 60 s. Fix: delay or disable Retry for 60 s on QUOTA.
3. `PH_BACKSLASH` false positive: `<p><strong>a\</strong>{{sender.name}}</p>` is flagged, though it serializes to a working token (`backslashProblems` checks the previous inline node without comparing marks). Probe confirmed. Rare; the user can delete the backslash.
4. `bodySize` in `src/shared/model/validate.ts` has no caller in `src/` after this slice (tests only). Dead code; remove or use.
5. `scripts/lighthouse.mjs` imports `chrome-launcher`, which is not in `devDependencies` (it arrives through `lighthouse`). Pin it.
6. ADR-0004 says the web app runs the sanitizer on paste for preview. The editor relies on schema normalization instead. Update the ADR or add it.
7. Spec section 6 lacks `template.getBody` (use, both). Architect to add.
8. Sanitizer keeps `<img>` with no attributes after dropping `src` (A4, A8). Harmless markup.
9. Handoff "Verified" section is stale: it says 31 files, 737 tests and "11 scopes"; the summary and this run give 32 files, 745 tests, 10 scopes.
10. Web coverage is low in `ui/dialog.ts` (62.5% lines), `editor/picker.ts` (64%) and `editor/toolbar.ts` (72.46%). Not gated in slice 3.

## Not verified

- htmlparser2 in real Apps Script V8, `google.script.history` and `google.script.url` in the HtmlService iframe, clipboard in the sandboxed iframe. Owner smoke steps 1 to 10 in docs/ops/smoke.md "Slice 3" cover them.
- Lighthouse ran on the dev harness page, not on the page Google serves.
