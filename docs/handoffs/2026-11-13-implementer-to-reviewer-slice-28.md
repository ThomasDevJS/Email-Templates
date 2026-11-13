# Handoff: implementer to reviewer, slice 28 (SF1 image host userinfo)

Date: 2026-11-13. Branch `slice/28-img-host-userinfo`, base c0564bc. Fix commit a79cdda.

## Done

- `src/shared/sanitize/attrs.ts`: `hostOf` replaced by `strictHostOf` with `STRICT_IMG_URL = /^https:\/\/([a-z0-9.-]+)(?::\d{1,5})?(?=$|[/?#])/i`.
- With a non-empty `imgHosts`, a `src` (after `cleanUrl`) is kept only when it matches that form and the lower-case host is in the list. Any other authority character (`@`, `\`, `%`, space, second `:`, non-ASCII) drops the attribute.
- With an empty `imgHosts`, `src` returns before the regex, so output is byte-identical to c0564bc (D20).
- `test/unit/shared/sanitize.test.ts`: 42 new tests in "image host allowlist reads the real host (SF1)". 31 refused URLs, 6 kept URLs (each also idempotent), 1 tab/newline test, 4 empty-list tests.
- ADR-0004 left unchanged. Its text ("any `https` host unless `IMG_HOSTS` lists allowed hosts") is still true.

## Verified (how)

- Fail before: with the c0564bc `attrs.ts`, 11 of the new tests fail (every `@` userinfo form, `:x@`, `:99999999`, `:80:80`, `:/`, `HTTPS://...@`). The other 20 refused URLs were already refused by the old regex.
- Old bodies test (`test/fixtures/oldBodies*`) passes unchanged.
- Tab/newline: `cleanUrl` removes them, so `https://allowed.ex<TAB>am<LF>ple/a.png` becomes `https://allowed.example/a.png` and is kept in that cleaned form. Browsers strip tab and newline the same way, so the loaded host matches. `https://evil.ex<TAB>ample/a.png` is refused.
- `npm run lint`: clean. `npm run format:check`: all files use Prettier style. `npm run typecheck`: clean.
- `npm test`: 76 files, 2,161 tests passed (baseline 2,119 plus 42).
- `npm run build -- --env dev`: Code.js 385.9 KB of 800 KB, index.html 390.3 KB of 400 KB.

## Bypasses tried against WHATWG special-scheme parsing (all refused with list `allowed.example`)

- Userinfo: `@`, `:x@`, `%40`, full-width `＠` (U+FF20), `&#64;` entity, leading space, `HTTPS://` upper case, U+0001, tab or newline before `@`, empty userinfo `https://@allowed.example`.
- Backslash: `evil\@allowed`, `allowed\@evil`, `&#x5c;@`, `https:\\allowed`. Browsers treat `\` as `/`; the strict form refuses it anyway.
- Slashes: `https:allowed`, `https:/allowed`, `https:///allowed` (browsers accept all three as host `allowed.example`; refused here).
- Port: `:99999999`, `:80:80`, empty port `:/` (browsers accept empty; refused here).
- IDNA mapping: ideographic full stop U+3002 and soft hyphen U+00AD (browsers map both to `allowed.example`; refused as non-ASCII), full-width solidus U+FF0F.
- Host tricks: suffix `allowed.example.evil.example`, trailing dot, host in path, query or fragment, space in host, IPv6 literal `[::1]`.

## Left

- SF2 (scan stored bodies once with the fixed check) is not in this slice.
- Ports above 65535 with 5 digits (`:99999`) pass the form. Browsers refuse to parse them, so no request leaves.
- Hosts with `_` and IDN hosts in Unicode form are refused under a list. An admin must list the `xn--` form.

## Risks

- A deployment with `IMG_HOSTS` set loses images whose `src` uses `https:` without `//`, an empty port, or a Unicode host. Stored bodies are re-sanitized on read (`readableBody`), so such images disappear from existing templates there too.
- The extension must copy `src/shared/sanitize/` again from a79cdda.

## Files touched

- `src/shared/sanitize/attrs.ts`
- `test/unit/shared/sanitize.test.ts`
- `docs/handoffs/2026-11-13-implementer-to-reviewer-slice-28.md`

## Commands to reproduce

- `npm run lint && npm run format:check && npm run typecheck`
- `npm test`
- `npx vitest run test/unit/shared/sanitize.test.ts -t SF1`
- `npm run build -- --env dev`
- Fail before: `git show c0564bc:src/shared/sanitize/attrs.ts > src/shared/sanitize/attrs.ts`, run the SF1 tests (11 fail), then `git checkout -- src`.
