# Handoff: orchestrator to the extension session

Date: 2026-11-13. From: the orchestrator of `ThomasDevJS/Email-Templates`. To: the orchestrator of the new extension repo.

## Goal

A browser extension for Chromium browsers (Chrome first, then Edge and Brave) that shows the company's templates inside Gmail and inserts one into a draft in one click, or after the sender fills its fields. It replaces the Gmail side only. The server built in `ThomasDevJS/Email-Templates` stays the single source of templates, access, editing, admin and audit.

Owner's words (2026-11-13): "when u inside gmail some popup can be seen with company-set templates that would allow to insert templates as drafts in 1 click or let users pre-fill set fields/options/dates/etc and then paste in draft". "my current concern is that in-gmail app runs on an aged app script infrastructure and loads too long". "We need high quality extension UI/UX and optimization."

## Why

Measured on the dev add-on: the popup opens in 2 to 3 s and a one-click insert takes 3 to 8 s. Handler code on the server takes 0.15 to 0.26 s per call; Google's transport adds about 2 s per call, and every add-on click is one Apps Script run. An extension draws its own UI and can keep a local copy of the templates, so both waits can fall under 0.2 s.

## Roles and models (owner's instruction)

- Orchestrator: plans, briefs, merges after a review PASS, keeps `PLAN.md`.
- Builders (implementer, researcher, designer): Opus 5.5 subagents (`model: opus`).
- Advisor and auditor: Fable 5.2 (`model: fable`) for critical decisions and changes: architecture, sign-in and identity, permissions requested from the browser, HTML safety, anything that touches the server contract, and the review gate of every slice that handles template HTML or tokens.
- Process as in this repo: architect writes the spec and ADRs first; one slice per worktree; reviewer gate before every merge; real commands (lint, typecheck, tests, build) before a PASS.

## What exists and can be reused

Read `ThomasDevJS/Email-Templates` (attach it read-only). Copy code into the new repo; do not import across repos.

| Area | Where | Reuse |
| --- | --- | --- |
| Field grammar: `{{ask:}}`, `{{date:}}`, `{{choice:}}`, sender and recipient variables, the brace rule | `src/shared/placeholders/` | copy with its tests; the extension must render exactly as the add-on does |
| Rendering rules: unfilled fields removed with 4 gap rules, subject cut at 200, MM/DD/YYYY by UTC day | `src/shared/placeholders/render.ts`, `date.ts`, `choice.ts` | copy |
| HTML safety | `src/shared/sanitize/`, `src/shared/html/` | copy; the server already sanitizes on save, the extension must not weaken it |
| Recipient rules (To, Cc, Bcc, outside addresses, skipped To) | `src/addon/cards/recipients.ts`, spec 4.1a | port the rules, new UI |
| Search, favorites, recent, folder tree | `src/shared/search/`, `src/web/library/` | copy or port |
| Design tokens and wording | `docs/design/wording.md`, `src/web/styles.css` (slate #2a3c49, red #b32025 for errors only) | keep the words; the look is new |
| Decisions | `PLAN.md` D1 to D40, `docs/spec.md`, `docs/adr/` | read first; ADR-0001 rejected an extension on 2026-11-09 (store fee, Gmail DOM coupling, Chrome management per org unit, no mobile); the owner reopened it for speed |
| Test habits | `docs/ops/test-round-1.md`, reviews in `docs/reviews/` | same style: short owner tests, one at a time |

## Server contract

The web app is an Apps Script deployment, "execute as me", open to the domain. The add-on reaches it with `UrlFetch` and the user's identity token. The extension needs its own way in. This is the first critical decision for the advisor:

1. How the extension proves who the user is to the existing server (options to compare: `chrome.identity` with an OAuth client and an ID token checked by the server; a call to the web app with the user's Google session; a thin proxy). No long-lived secret in the extension.
2. Which calls it needs: the home list (`sidebar.home`), `template.apply` (body, recipients, audit event), search, favorites. A new read that returns every template the user may use, with bodies, for the local copy, is likely needed. Server changes are made in `ThomasDevJS/Email-Templates` by its own session; write the request as a handoff there, do not fork the server.
3. Access must stay enforced by the server on every read. The local copy holds only what the server returned for that user, is cleared on sign-out or account change, and is refreshed so a removed access disappears (state the maximum staleness).
4. Every insert still writes the usage and audit event, without blocking the insert.

## Spike before any build (3 points, each with a proof)

1. Sign-in to the existing dev server from an extension, as a domain user, with no stored secret.
2. Insert at the cursor of a Gmail draft as editable HTML, with subject and recipients, in a new draft, a reply and a pop-out window; undo works; Gmail's own formatting survives.
3. Org rollout: a private Chrome Web Store listing for the domain and a force install for one org unit; what Edge and Brave need.

## Quality bars

- Speed budgets: popup visible in 200 ms from a warm local copy; one-click insert in 200 ms; first sync after sign-in under 3 s; no layout shift in Gmail; no work on pages that are not Gmail.
- Smallest browser permissions that work: host access to `mail.google.com` only, plus what sign-in needs. Manifest V3. No remote code.
- Gmail page coupling kept in one adapter module with its own tests and a self-check that reports a broken selector instead of failing silently.
- Accessibility: keyboard for everything, focus management, WCAG 2.1 AA contrast, screen reader names.
- UI: a designed popup or panel, a field form with text, date picker and dropdown, search, favorites, recent, folders; light and dark; no visual clash with Gmail.

## Rules that carry over

- Never commit tokens, keys, client secrets or real template content. Warn the owner if a file holds one.
- Never put a real person's address in repo files.
- The repo is private. No pull request unless the owner asks. Push only to the session's work branch.
- Do not use HOS (hours of service) as a reference unless the owner asks.
- Replies to the owner: answer first, short sentences, numbers and names, under 150 words; end with what was skipped or not checked.

## State of this repo at handoff

`main` holds slices 1 to 27 (merged by pull request 1). The dev deployment serves the same code. The org pilot of the add-on (phase 2.5b) is next here and runs in parallel with the extension work. The add-on stays as the surface for Gmail mobile and other browsers.
