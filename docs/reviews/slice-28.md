# Review: slice 28, SF1 image host allowlist reads the real host

Verdict: PASS

Branch `slice/28-img-host-userinfo`, reviewed at 3af68c2, base c0564bc. 3 files, +140 -3: `src/shared/sanitize/attrs.ts` (+12 -3), `test/unit/shared/sanitize.test.ts` (+74), the handoff (+54). Finding: extension handoff `2026-11-13-extension-to-server-sanitizer-finding.md` (SF1).

## Commands (worktree)

| Command | Result |
| --- | --- |
| `npm run lint` | 0 |
| `npm run format:check` | 0; all files use Prettier style |
| `npm run typecheck` | 0 |
| `npm test` | 0; 76 files, 2161 tests passed (baseline 2119, +42, matches the handoff) |
| `npm run build -- --env dev` | 0; Code.js 385.9 KB of 800, index.html 390.3 KB of 400 |
| `npm run scopes:check` | 0; 10 scopes, all approved |

## Acceptance criteria

1. Strict form. `STRICT_IMG_URL = /^https:\/\/([a-z0-9.-]+)(?::\d{1,5})?(?=$|[/?#])/i` runs on the `cleanUrl` output, the same string the sanitizer writes. The host is lower-cased and compared with `includes`. `imgHosts` is lower-cased in `body.ts:105`. Met.
2. Empty list, byte-identical. Old (c0564bc `attrs.ts`) and new sanitizer bundled side by side, each input run with no options and with `imgHosts: []`. Differences: fixtures 0 of 82 files, old-bodies corpus 0 of 95, generated 0 of 12,000 inputs (every input holds 1 or 2 `img` tags; seeded random `src` from 49 parts: schemes, `@`, `%40`, `\`, entities, controls, U+212A, U+017F, U+FF20, `{{`, quotes). Errors: 0. Control run with list `[allowed.example]`: 11 generated inputs differ, so the harness sees the change. Met.
3. Finding fixtures. With list `[allowed]`: `https://allowed@evil.example/a.png` and `https://allowed:x@evil.example/a.png` were kept at c0564bc and are dropped at head. `%40` and `evil.example\@allowed` were already dropped and stay dropped. The test file holds all four with the host `allowed.example`. Met.
4. Change stays in `src/shared/sanitize/attrs.ts`, the test file and the handoff. `package.json`, lock file and `appsscript.json`: 0 changed lines. Met.

Handoff claim "11 of the new tests fail before" checked: of the 31 drop cases, c0564bc keeps 11, head keeps 0.

## Attack: Chromium host against keep or drop

345 URLs, 13 categories: finding 4, userinfo 72, backslash 11, tabs/newlines/controls 102, percent 10, IDNA look-alikes 18 (list `[kiosk.example]`), full-width 10, IPv4/IPv6 10, slashes 15, ports 38, entities 18, scheme case 18, host tricks 19. Each value went into `<img src="...">` as HTML, through `sanitize` with a one-host list, then into a Chromium `div.innerHTML`; host from `new URL(getAttribute('src'), baseURI)`. All requests aborted.

- Kept: 98. Browser host of the kept output equals the allowed host: 94. Browser cannot parse: 4 (ports 65536 and 99999, `/a.png` and `?q`), so no request leaves.
- FAIL (kept, browser loads another host): 0.
- 17 kept inputs would resolve relative in a browser as raw input (leading or inner U+0000, U+000B, U+000C, U+001F, U+007F, U+0085, NBSP, `&nbsp;`). `cleanUrl` removes these, and the stored output loads from `allowed.example`. This behaviour predates the slice and also holds with an empty list.
- Safe direction (dropped, browser host allowed): 45. Userinfo before the allowed host 16 (`evil.example@allowed.example`, `@`, `:@`), backslash forms 8, percent 3 (`allowed%2Eexample`, `%61llowed`, `evil.example%2F@allowed`), IDNA 11 (U+212A, U+017F, U+3002, U+FF0E, U+FF61, U+FF4B, U+00AD, U+200B, entity forms), full-width 2, `[::1]@allowed` 1, `https:///` and `https:////` 2, empty port 2.

Regex flags: `i` only, no `u`. Without `u`, `/[a-z]/i` matches neither U+212A (Kelvin) nor U+017F (long s): non-ASCII characters never case-map to ASCII. With `/iu`, both match (`K` and `s` by simple case folding), so `https://Kiosk.example/` would pass the regex while Chromium loads `kiosk.example`. That host would be allowed, so `/iu` would still not leak, but the current flags keep the host string ASCII. `\d` without `u` does not match U+0661.

## Checklist

- Permission checks: no entry point changed. The sanitizer is pure; callers (`prepareFor`, `readableBody`) unchanged.
- Secret scan of added lines: 0 keys, tokens, secrets or addresses. Matches are `allowed.example` and `evil.example` (RFC 2606 reserved) inside test URLs.
- Scopes: 0 changed lines, `scopes:check` passes.
- Network: no new call. Test URLs are not fetched.
- Quality: strict TS passes, `hostOf` removed with no leftover caller, 42 tests for the pure rule, each kept URL also checked for idempotence. No UI change, so empty, loading, error and keyboard states do not apply.

## Must fix

None.

## Minors

1. Ports 65536 to 99999 pass the form. Chromium refuses the URL, so no request leaves. A `\d{1,5}` plus a range check would make the stored body honest (opinion).
2. ADR-0004 line 126 still says "unless `IMG_HOSTS` lists allowed hosts" with no word on the strict form. An admin reading it will not learn that `https:` without `//`, an empty port and Unicode hosts are dropped under a list. One sentence in the ADR or the admin guide fixes it.
3. The handoff's risk stands: with `IMG_HOSTS` set, `readableBody` re-sanitizes stored bodies, so images in the 45 safe-direction forms disappear on read. SF2 (one-time scan) should report them.

## Scratch

Scripts and outputs outside the repo in `/tmp/claude-0/-home-user/4542f351-8374-512d-8d29-9ff987e56767/scratchpad/review-28/` (`equiv.cjs`, `attack.cjs`, `attack.out`).
