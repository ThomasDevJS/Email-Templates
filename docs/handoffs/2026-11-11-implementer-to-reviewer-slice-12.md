# Implementer to reviewer: slice 12, add-on cards layout and wording (2026-11-11)

Branch `slice/12-panel-layout`, base 3e78c62. Add-on only. No callback changes what it does to a draft. Server calls, D24, slice 9 recipient rules and `rh` are unchanged; their tests pass with layout fields only.

## Done

- Card model (`src/addon/cards/spec.ts`): `CardSpec.title` optional; `ButtonSpec.style` `"filled" | "outlined"` (replaces `filled: boolean`); item `icon` (`IconName`: `star`, `schedule`, `description`, `folder`); `SectionSpec.collapseAfter`; `LIBRARY_FOOTER`.
- Renderer (`render.ts`, still the only Card Service caller): no `CardHeader` without a title; `newIconImage().setMaterialIcon(newMaterialIcon().setName(name))` into `DecoratedText.setStartIcon`; filled buttons get `TextButtonStyle.FILLED` and `setBackgroundColor("#2a3c49")` (`SLATE`); outlined get `TextButtonStyle.OUTLINED`; `setCollapsible(true).setNumUncollapsibleWidgets(n)`.
- One row layout (`templateItem(template, entry, path, icon)` in folder.ts): title; bottom label line 1 the folder path, line 2 the hints that apply joined by " · ". Folder rows: folder icon, name, "n templates" below.
- `listSection(header, rows)` drops an empty section and collapses past `VISIBLE_ROWS` = 5 (Favorites max 10, Folders). Recent (max 5) and search Results stay open.
- Header only on folder (path), preview, prompt and too-many-fields cards (template title). Home, search and state cards have none.
- Fixed footer "Open library" (outlined) on home, folder and search. The empty home keeps its own button and gets no footer.
- `src/addon/cards/sidePanel.ts`: `sidePanelHint(entry)` is the one place for the side-panel line; home, folder, search and preview end with it.
- Smoke: docs/ops/smoke.md "Slice 12", 7 steps. Quick start and runbook quote the new texts.

## Changed texts (old, new)

| Place | Old | New |
|---|---|---|
| Home and search header | "Migway Templates" | none |
| State card header | "Migway Templates" | none |
| Search hint | "folder:Sales  tag:pricing" | "Tip: add folder:Sales or tag:pricing to narrow the search." |
| Search, no result | "No templates match zzz. Try folder: or tag:." | `No templates match "zzz". Try fewer words, or remove folder: and tag: from the search.` |
| Favorites, none | "Star templates in the library to pin them here." | section not shown |
| Folder row | "Sales (3)" | "Sales", below "3 templates" (or "1 template") |
| Template row, prompts | top label "2 fields to fill" | bottom label line 2 "2 fields to fill" |
| Template row, folder card | below: snippet | below: folder path |
| Template row, both hints | "Adds Cc 1" (fields hint dropped from the line) | "2 fields to fill · Adds Cc 1" |
| Pager | "< Prev", "Next >" | "Previous", "Next" |
| Side-panel hint | "Writing an email? Open Migway Templates from the toolbar at the bottom of the draft to insert at the cursor." | "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar." |
| Preview, empty body | "(Empty template)" | "This template has no text." |
| Too many fields | "This template needs 23 fields; the sidebar fills at most 20. Ask an editor to reduce its prompts." | "This template needs 23 fields. The sidebar fills at most 20. Ask an editor to remove some fields." |
| Prompt card, template changed | "The template changed. Check the fields and insert again." | "The template changed. Check the fields and press Insert again." |
| BUSY | "Busy, try again." | "Busy right now. Press Retry in a few seconds." |
| SERVER, NETWORK | "Something went wrong." | "Something went wrong. Press Retry." |
| NOT_CONFIGURED line 2 | "The owner runs setup once and deploys; then reopen the sidebar." | "Ask the owner to finish setup, then press Retry." |
| NOT_FOUND | "This template was removed or moved." | "This template was removed or moved. Press Refresh to update the list." |
| QUOTA wait notification | "Service is busy. Try again in 30 s." | "Service is busy. Try again in 30 seconds." |

Unchanged on purpose: the empty home ("No templates shared with you yet." and its line and button; the admin-settings worktree owns it), DENIED, account texts, QUOTA card text, every slice 9 recipient line, "Fill these fields to insert", button names Insert, Review, "Insert with subject", "Insert body only", "Edit in library", Cancel, Back, Retry, Refresh.

## Card sketches

`[Insert]` is filled slate. `(Open library)` is outlined in the fixed footer. `*` star, `@` clock, `=` document, `#` folder icons.

Home, draft toolbar:
```
Search templates
[ ______________________________ ]
Tip: add folder:Sales or tag:pricing to narrow the search.
FAVORITES                          (only with rows; 5 shown, rest collapsed)
 * Welcome email           [Insert]
   Sales / Onboarding
 * Price quote 2026        [Insert]
   Sales / Quotes
   2 fields to fill
RECENT                             (only with rows)
 @ Driver leaving          [Review]
   HR
   Adds Cc 1, Bcc 1
FOLDERS                            (5 shown, rest collapsed)
 # Sales
   24 templates
 # Support
   41 templates
----------------------------------
(Open library)
```

Home, side panel: the same rows without `[Insert]` or `[Review]`, then before the footer:
```
To insert a template, open a draft and use the
Migway Templates button in the draft's toolbar.
```

Folder card (header "Sales / Quotes"): subfolder rows `#` as above, then `=` template rows with the path "Sales / Quotes" below each title, "Page 1 of 3" with `Previous` `Next` past 20, side-panel hint in the panel, `(Open library)` footer.

Search card: the search input with the query, "RESULTS" with `=` rows, or the no-match line; side-panel hint in the panel; `(Open library)` footer.

Preview card (header the template title): Subject, Recipients, body text, then `[Insert]` `Insert with subject` `Insert body only` `Edit in library` with only Insert filled. Side panel: no Insert buttons, then the hint.

Prompt card (header the title): unchanged fields; footer `[Insert]` filled, `Cancel` plain.

State card: no header; one or two lines and one button (Retry, Refresh or Back).

## Verified, from a clean install

`rm -rf node_modules && npm ci`, then:
- `npm run lint`: 0 problems.
- `npm run typecheck`: 0 errors.
- `npm run test:coverage`: 62 files, 1437 tests passed; all files 95.72 % statements, 89.64 % branches.
- `npm run build -- --env dev`: Code.js 347.8 KB of 800 KB.
- `npm run scopes:check`: 10 scopes, all approved.
- `npm run format:check`: clean.

New tests: `listSection` collapse and drop; row label order and empty path; home with 10 favorites, 5 recent, 30 folders stays under 100 widgets (compose and inbox) with Favorites and Folders collapsed; no button set holds two filled buttons on the preview card; renderer records `setMaterialIcon`, `setStartIcon`, `setCollapsible`, `setNumUncollapsibleWidgets`, `OUTLINED`, `setBackgroundColor("#2a3c49")`, no `newCardHeader` without a title, no `setIconUrl`.

## Not verified

Nothing renders outside Gmail. The tests pin the model and the recorded Card Service calls. The look needs the smoke "Slice 12" screenshots.

## Left for later

- `SidebarTemplate.snippet` is no longer shown in the add-on; the server still sends it (`sidebar.home`). Drop it in a server slice or show it again.
- spec.md 7 and 7.2 and wireframe 01 still quote the old texts above; the planner updates them.
- Side-panel line under the header ("Start a new email from a template.") and side-panel row buttons wait for the side-panel insert work (spec 13.7); `sidePanelHint` is the place it replaces.
- Merge point with the admin-settings worktree: `emptySection` in home.ts is untouched; `homeCard` reads `view.templates.length === 0` once more to skip the footer.

## Risks

- `setBackgroundColor` on a FILLED button in Gmail web: the type definitions list it; colour rendering not seen.
- Collapsed sections: Gmail picks the "Show more" wording.
- Material icon names `schedule` and `description` are assumed to exist in Gmail's icon set; a missing name probably renders no icon.

## Files touched

src/addon/cards/{spec,render,folder,home,preview,prompt,states,sidePanel}.ts, src/addon/flows.ts (one text), src/addon/entry.ts (one text), test/fakes/output.ts, test/unit/addon/{cards,render,addon,flows,recipientFlows}.test.ts, docs/ops/smoke.md, docs/ops/runbook.md, docs/guide/user-quick-start.md.
