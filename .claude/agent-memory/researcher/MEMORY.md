# Researcher memory (Migway Gmail templates)

## Conventions
- Write only under docs/research/. Memory file here is the one exception (BRIEF section 4).
- Every claim: source ID [Sn] mapping to URL plus date read in a Sources list.
- Mark third-party, community and search-excerpt-only claims "unverified".
- No em or en dashes. Short sentences. Answer first.
- Report cap 600 words, delivered via SubagentHandback.

## Runs done
- 2026-11-09 R3: docs/research/r3-snippet-and-crm-templates.md (TextExpander, Briskine, Gmelius, Streak brief, HubSpot, Salesforce).

## Sources that worked (WebFetch)
- textexpander.com/pricing, textexpander.com/learn/... help pages, textexpander.com/blog.
- help.briskine.com (all pages), www.briskine.com/pricing.
- help.gmelius.com, gmelius.com/pricing.
- knowledge.hubspot.com articles, www.hubspot.com/pricing/sales.
- chromewebstore.google.com/detail/<id> (rating, users, version; no review text).
- salesforce.com/sales/pricing.
- trustedinstitute.com (third-party Salesforce admin notes).

## Pitfalls
- HTTP 403 on WebFetch: g2.com, capterra.com, trustradius.com, salesforceben.com, admin.salesforce.com, developer.salesforce.com, community.hubspot.com.
- help.salesforce.com returns an empty JavaScript shell.
- docs.briskine.com does not resolve; use help.briskine.com.
- curl with a browser user agent to bypass 403 is denied by the auto-mode classifier. Do not retry.
- Review quotes then only come from WebSearch excerpts. Label them "search-result excerpt, unverified".
- TextExpander pricing page shows conflicting annual vs monthly figures ($5/$6, $10/$12).

## Open questions
- Official Salesforce wording for Lightning folder levels (Viewer, Editor, Manager) not confirmed.
- HubSpot sales template token syntax and version history not documented publicly.
- Can Migway "user" role create private templates? Not stated in BRIEF.
- Attachments in v1: BRIEF silent. Briskine-style public links conflict with data rules.
