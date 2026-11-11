# Handoff: architect to implementer, slice 16 (in-app admins, D32)

Date: 2026-11-11. Runs in parallel with slice 15. Design status: Proposed (ADR-0003 and ADR-0008 Amendments 2026-11-11, D32).

## Read first

- docs/adr/0003-identity-and-permissions.md, "Amendment 2026-11-11 (D32)": options, mechanism, threats.
- docs/adr/0008-admin-settings.md, "Amendment 2026-11-11 (D32)": storage, `appAdminsOf`.
- docs/spec.md: 5.8 last bullet, 6 (policy rows, `admin.add`, `admin.remove`, `config.get`), 7.3 Admins texts, 11.1, 13.10 (files, 16 criteria, smoke, guide and runbook text), 15 Q62 to Q66.
- docs/wireframes/06-web-admin.txt, section "Admins".

## Decided

1. Admin = `ADMIN_EMAILS` or `ADMIN_GROUP` member or in `index.json` `admins` (trim, lower case, exact).
2. Own ops `admin.add { email }`, `admin.remove { email }`: admin, web, through `commit`, in-lock re-check on the in-lock index. Deltas, so no `baseAt`; repeats answer `changed: false`.
3. Add checks: form, domain = `DOMAIN`, Directory `users.get` (`domain_public`, `basic`, existing scope) for existence; store `primaryEmail` lower case. Cap 20.
4. No self-removal. No op writes a Script Property. Break-glass and group admins cannot be removed in the app.
5. One audit event per change (`targetType: admin`, `targetId` the address); log `targetId: ""`.
6. `backup.restore` keeps live `admins`; malformed entries grant nothing and never fail the index.
7. `subjectFor` reads the index only when both properties say no.

## Changed from the orchestrator's reading

- Own ops in place of a `config.set` setting: per-person audit target, no false conflicts between two adds.
- No base or stale-write refusal: a delta in the lock cannot overwrite another change.
- The list sits in its own index field next to `settings`, not in the `settings` map (fixed values only).
- Existence check added (Q64), unlike recipients (Q38).

## Files this slice owns

- src/shared/permissions/**, src/shared/model/**, src/shared/errors/**, src/server/**.
- src/web/** except src/web/views/editor.ts (slice 15 changes one help string there).
- docs/guide/admin-guide.md, docs/ops/runbook.md (text in spec 13.10), section "Slice 16" of docs/ops/smoke.md.
- Do not touch src/addon/**, src/shared/placeholders/**, appsscript.json, docs/guide/user-quick-start.md, docs/guide/editor-guide.md (slice 15).
- docs/ops/smoke.md: whoever merges second keeps both sections.

## Unverified, record in the smoke

- The Directory error text for an unknown address (map "not found" to `ADMIN_NO_ACCOUNT`, any other error to SERVER). Test with a made-up address and a group address.
- Whether `domain_public` returns suspended users. Not blocking.

## Open questions (spec 15)

Q62 cap 20; Q63 no self-removal; Q64 Directory check; Q65 one admin level; Q66 no email to the new admin. Defaults are the build.
