# Researcher memory

Shared by R1 to R4 runs. Keep under 150 lines.

## R2 signature managers (2026-11-09)

Conventions
- Output docs/research/r2-*.md: summary, per-tool facts table, comparison table, reviews, lessons, numbered sources [Sn] with date read.
- Mark search-excerpt-only sources "(search excerpt only)". Mark inferences "unverified".

Sources that worked (WebFetch)
- Vendor marketing and pricing pages (exclaimer.com, wisestamp.com, signitic.com, bulksignature.com, rocketseed.com, codetwo.com).
- Intercom help centers: support.wisestamp.com, support.signitic.com, help.patronum.io, help.rocketseed.com.
- kbsupport.exclaimer.com (some pages 503).
- workspace.google.com/marketplace listings: permissions verbatim, rating, installs, updated date.
- developers.google.com Gmail API reference.

Pitfalls
- 403 on WebFetch and curl: support.exclaimer.com (Zendesk), g2.com, capterra.com. Use WebSearch excerpts.
- curl to Zendesk API and the proxy status endpoint were denied by the auto-mode classifier. Do not retry.
- support.google.com/a/answer/1346934 redirects to knowledge.workspace.google.com (content compliance, not footer). Footer article is answer/2364576.
- CodeTwo has no Google Workspace product (announced 2024-06-27, not shipped).
- Writing MEMORY.md is outside docs/research/; system prompt allows it.

Facts to reuse
- sendAs.update: gmail.settings.basic or .sharing. Non-primary send-as needs DWD service account.
- Gmail API cannot set reply/forward default signature (Patronum; Google confirmation unverified).
- Gmail signature limit 10,000 chars; silent failure on push (WiseStamp).

Open questions
- Exact OAuth scope strings Exclaimer, BulkSignature, Signitic request (Marketplace shows plain-language only).
- Does Marketplace admin install alone permit writing other users' signatures, or do vendors also use DWD? (R4)
- Gmail mobile signature behaviour from Google docs (only vendor sources so far).
