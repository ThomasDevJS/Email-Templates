# Design system: direction A (owner direction 2026-11-10)

Reference: `docs/design/mockups/direction-a.html` with `direction-a-library.png` and `direction-a-editor.png`. Today's screens: `before-library.png`, `before-editor.png`. The mockup is the visual target; this file states the rules behind it. Where the two differ, ask.

Brief from the owner: classic, quiet, high quality, built to last without a redesign. Notion, Gmail and Linear are acceptable references. Brand: the Migway logo (`docs/design/migway-logo.svg`), red `#b32025`, slate `#2a3c49`.

## Principles

1. Content first. Chrome is quiet: white pages, a cool gray sidebar, hairlines in place of boxes.
2. One primary color, the logo's slate. Brand red appears in the logo only. In the interface red means error or delete, nothing else.
3. One distinctive element: a placeholder looks like a blank on a form (amber, dotted or dashed). Nothing else is decorated.
4. System fonts. The app loads nothing from outside Google, and system type matches Gmail and never dates.
5. Dense enough for daily work: 14 px base, 30 to 32 px controls, 52 px two-line table rows.
6. Every state is designed: loading, empty, error, denied, busy, saved.
7. Accessibility stays at Lighthouse 100. Contrast 4.5:1 for text, 3:1 for focus rings and control borders that carry meaning.

## Tokens (light)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1c262e` | text |
| `--ink-2` | `#48555f` | secondary text, icons in controls |
| `--ink-3` | `#66727b` | meta text, column heads, counts (on white only) |
| `--slate` | `#2a3c49` | primary button, avatar, focus ring |
| `--slate-dark` | `#1f2d37` | primary button hover and active |
| `--paper` | `#ffffff` | page, cards, inputs |
| `--canvas` | `#f4f5f6` | sidebar, editor backdrop, table head of content tables, row hover |
| `--line` | `#e2e6e9` | hairlines |
| `--line-strong` | `#c8cfd4` | table head rule, dividers (never a control border) |
| `--field-line` | `#7f8b93` | borders of inputs, selects, the search field and default buttons (3:1 or more, WCAG 1.4.11) |
| `--star` | `#a87400` | filled star, outline and fill (3:1 or more on white, hover and selected) |
| `--star-off` | `#78838b` | empty star |
| `--select` | `#e8edf1` | selected nav item, selected row, active toggle, tag background |
| `--red` | `#b32025` | error text, destructive button, error border |
| `--blank-bg` | `#fdf2d0` | placeholder background |
| `--blank-line` | `#a9770a` | placeholder dotted or dashed line |
| `--blank-ink` | `#5c4300` | text on the "Insert field" button and in prompt blanks |
| `--ok` | `#1d6b45` | saved check, "ok" result |
| `--warn` | `#7a4f01` | warnings |

Dark theme: keep `prefers-color-scheme: dark`. Derive every token; check each text pair at 4.5:1. Suggested base: paper `#171c20`, canvas `#1e2429`, ink `#e6eaed`, ink-2 `#b4bec6`, ink-3 `#93a0a9`, line `#2c353c`, line-strong `#45515a`, select `#2a343c`, primary button background `#dfe6eb` with ink `#171c20`, blank-bg `#3d3215`, blank-line `#d9a93a`, red `#f0958f`, ok `#6fcf9b`. The logo's slate letters are dark; on the dark sidebar show the logo on a small light plate, or render the slate paths in `--ink`.

## Type

- Family: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. `font-variant-numeric: tabular-nums` on the root.
- Scale: 12 (meta, column heads, counts), 13 (secondary lines, panel labels), 14 (base), 15 (email body in the editor and previews), 20 (page title). Weights 400, 500 (buttons, names), 600 (titles, selected nav, row titles), 700 (toolbar B only).
- Line height 1.45 for interface text, 1.6 for email body.
- Sentence case everywhere. No all caps. No letterspacing except -0.01em on the 20 px title.

## Space, shape, depth

- Spacing steps: 2, 4, 6, 8, 12, 16, 20, 28. Page gutter 28. Sidebar padding 12, items 8.
- Radius: 6 for controls and nav items, 8 for the editor sheet and dialogs, 10 for tags, 50% for avatars.
- Borders do the work. One shadow only: `0 1px 2px rgba(28,38,46,.06)` on the editor sheet; menus and dialogs use `0 8px 24px rgba(28,38,46,.14)` with a 1 px `--line-strong` border.
- Motion: none on load. 120 ms ease-out on menu and dialog open, respecting `prefers-reduced-motion`.

## Icons

Inline SVG symbols in one sprite, 16 px box, `fill: none`, `stroke: currentColor`, width 1.6, round caps and joins. The mockup holds the starting set (files, star, clock, trash, gear, folder, chevron right, chevron down, search, plus, more, check, undo, redo, bulleted list, numbered list, quote, link, image, table, align, rule, field, color). Add what a screen needs in the same style. Icons that are the only content of a button need an accessible name; decorative icons get `aria-hidden="true"`. B, I, U, S in the toolbar stay letters.

## Components

- Button: height 32, padding 0 12, radius 6, weight 500. Default: paper with `--field-line` border. Primary: slate, white text. Ghost: no border, `--ink-2`. Destructive: `--red` background, white text, only inside a confirm dialog. Disabled: 55% opacity, no pointer. Busy: label changes ("Saving..."), control disabled.
- Icon button: 28 by 28, radius 6, hover and pressed `--select`.
- Input and select: height 32 (30 in the side panel), `--field-line` border, radius 6, focus ring 2 px `--slate` with 2 px offset. Error: `--red` border and a one-sentence message under the field.
- Search: input with the search icon inside left and a `/` key hint inside right.
- Nav item (sidebar): height 30, radius 6, icon 16 in `--ink-3`, label, optional right-aligned count in 12 px `--ink-3`. Hover `#eaedef`, current `--select` with weight 600.
- Table (lists): head row 32 px, 12 px weight 600 `--ink-3`, bottom rule `--line-strong`. Body rows 52 px for two-line cells and 40 px for one-line cells, bottom rule `--line`, hover `--canvas`, selected `--select`. No zebra, no vertical rules.
- Tag: 12 px, padding 1 by 8, radius 10, `--select` background, `--ink-2` text.
- Avatar: circle with initials from the address (first letters of the first two parts of the local part), 22 px in tables, 24 px in the sidebar. Never a photo.
- Menu: paper, 1 px `--line-strong`, radius 8, item height 30, hover `--select`, destructive item in `--red`, divider before it.
- Dialog: paper, radius 8, width 420 to 520, title 16 px weight 600, body 14, actions right aligned with the safe choice focused. Backdrop `rgba(28,38,46,.35)`.
- Status line and toasts: one sentence, period at the end. Success with the check icon in `--ok`; error with `--red` text and the request ID in 12 px `--ink-3`.
- Empty state: one sentence that says what is here and one action button. No illustration.
- Skeleton: `--canvas` bars with the row heights of the real content.
- Placeholder (the "blank"): value placeholders have `--blank-bg`, a 1.5 px dotted `--blank-line` underline, radius 3 3 0 0, padding 1 by 5. Prompts ("Ask the user") have a paper background and a 1.5 px dashed `--blank-line` border, radius 4, text `--blank-ink`. A fallback shows as "name or fallback" with "or" in `--ink-3`. The same look in the editor, the history preview and the sidebar-facing previews of the web app.

## App shell

- Left sidebar, 248 px, `--canvas`, right hairline. Top: the logo (104 px wide) and the word "Templates" after a thin divider. Then "All templates", "Favorites". Then the heading "Folders" and the folder tree with counts. Then the heading "Manage" with "Trash" and, for callers who may see it, "Admin". Bottom: avatar, the name part of the signed-in address, the role ("Admin", "Editor" or nothing) and, in 12 px, the app version.
- The current top bar goes away. The page title sits in the main area: 20 px, weight 600, with the item count after it in `--ink-3`.
- Main header row: title and count left; search and the primary action right.
- Under 860 px: the sidebar becomes a top bar with the logo and a menu button that opens the sidebar as a panel; list tables drop to two-line rows (title and subject, then folder and date) with the row menu button kept.
- The folder tree keeps its tree roles and keyboard behavior. Other users' private folders keep their owner label in `--ink-3`.

## Screens

- Library: columns star, Template (title in weight 600 with the subject under it in 13 px `--ink-3`; a template without a subject shows the snippet), Folder (path with `/` in `--line-strong`), Tags, Updated (local time, format "Nov 9, 2:05 PM", this year without the year), By (avatar and name part), row menu button (the existing menu). "Favorites" in the sidebar replaces the "★ Favorites" toggle. Body search results keep their "Matches in text" group as a labelled section of the same table.
- Trash: the same table with Deleted and "Days left" columns, "Restore" as a row button, "Empty trash now" as a default button in the header.
- History: left, the version list as rows (version number in weight 600, local time, author, and a tag for "current" or "restored from N"); right, the version on a sheet like the editor's page with the subject line on top and the blanks styled as above; "Restore this version" as the primary button in the header.
- Editor (slice 8b): breadcrumb, saved status with the check, History, Save; icon toolbar in groups with "Insert field" in the blank colors at the right end; the email on a 680 px sheet over `--canvas` with the subject line on top; right panel 340 px with Details, "The sender fills in" and the preview and problems tabs.
- Admin (slice 8c): the tabs as an underlined tab row under the page title; tables and forms from the components above; results "ok" and "denied" as tags in `--ok` and `--red` tints; operation names shown in words with the raw name in the details drawer.

## Wording

Sentence case. Plain verbs. A button says what happens ("Save", "Move", "Delete template"). The same action keeps its name in the button, the busy text and the result ("Move", "Moving...", "Moved ..."). Errors say what happened and what to do, in one or two sentences, with no apology. Empty states invite the next action.

## Budget and rules for the build

- `index.html` stays under 400 KB (316.5 KB before this work). Fonts are never embedded. The logo SVG is inlined once.
- No new dependency. No change to `inlineHtml`. No server change unless a screen needs data an existing op already returns.
- Keyboard behavior, ARIA roles and focus handling keep working; tests are updated, not removed.
- Lighthouse accessibility 100 on every audited view, light and dark.

## Changes after the first build (slice 8a review, 2026-11-10)

- Control borders moved from `--line-strong` (1.58:1) to `--field-line` (3.49:1 on white). The mockup image still shows the lighter borders.
- Star colors darkened to reach 3:1; the filled star differs from the empty one by its fill.
- The folder separator, table avatars and owner labels are darker than in the mockup for 4.5:1.
- `test/unit/web/contrast.test.ts` holds the token pairs and their limits; a new token pair goes into that table.
- Under 860 px the menu panel is modal while open.
