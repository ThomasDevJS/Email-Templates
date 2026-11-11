# Review: slice 12, Gmail add-on cards, layout and wording pass

Date: 2026-11-11. Branch `slice/12-panel-layout`, base 3e78c62, head 00c91a3 (7afdda1, 602c739, 5bea9bc, 00c91a3).

## Verdict: PASS

All 9 asked items are built. A probe on base and head gave the same reply for every draft-changing callback on a 6-event matrix. No blocker. 7 gaps below. Gap 1 needs smoke "Slice 12" step 1 in Gmail before merge to prod.

## Commands (clean install, worktree root)

| Command | Result |
|---|---|
| `rm -rf node_modules && npm ci` | pass, 559 packages, audit 16 (14 moderate, 2 high), same as earlier slices |
| `npm run lint` | pass, 0 problems |
| `npm run typecheck` | pass |
| `npm run test:coverage` | pass, 62 files, 1437 tests; statements 95.72%, branches 89.64%, lines 96.67% (5499/5688); addon/cards 100% lines |
| `npm run build -- --env dev` | pass, Code.js 347.8 KB of 800 KB, index.html 355.1 KB |
| `npm run scopes:check` | pass, "10 scopes, all approved" |
| `npm run format:check` | pass |

Secret scan of added lines (AIza, ya29., GOCSPX, client_secret, refresh_token, PRIVATE KEY, ghp_, AKIA, xox, eyJ): 0 hits. Emails added: `a@migway.com` (test). URLs added: none. URLs in built Code.js, base and head, dev and prod: the same set (dev /exec URL from deploy/dev.json, www.google.com, googleapis.com drive v3 and upload, the S7 gstatic image, w3.org XML text). Unchanged: src/web, src/server, test/unit/web, scripts/, package files, appsscript.json, src/addon/spikeS7.ts.

## Checks

a. Behavior freeze. Test diff: no test removed. Removed assertions were replaced by stricter ones (`toMatchObject` became `toEqual` for the search Results section and the prompt Cancel button; the Insert row button is now checked whole). Assertions on draft responses, D24, recipient actions, `rh`, `entryOf`, server ops and callback params are unchanged or gained `style`/`icon` only. Probe: base and head copies, same script, flows `homeFlow`, `folderFlow`, `searchFlow`, `previewFlow`, `insertFlow` (plain, `subject: use`, `subject: skip`, every Insert button of the preview), `promptInsertFlow` (4 switch combinations plus blank answers); 5 templates (plain, subject, prompts, recipients, recipients plus prompt); 6 events (side panel inbox, message, new draft, draft with subject, reply, unknown Cc with non-string subject). 526 replies per build; 502 identical including all 322 draft responses, every card action, toggle and server op list. The 24 differing lines are home, folder and search cards: "Open library" moved from a section into the fixed footer, and the folder card gained that footer.

b. Disclosure. Compose preview and prompt card texts are identical to base in the probe: To, Cc, Bcc lines, "outside example.com", "hidden from other recipients", "Not added", the unknown-field "Add by hand" lines, the finish-typing line. `rowButton` (folder.ts:46) gives "Review" for any template with `rc`; every list (Favorites, Recent, Folder, search Results) builds rows through `templateItem`, so no list has a one-click Insert for a template with recipients (recipientFlows.test.ts, cards.test.ts layout test, probe folder rows).

c. Side panel. Probe callbacks on inbox and message cards: onSearch, onOpenFolder, onPreview, onOpenLink, onBack only; no Insert, Review or prompt Insert reachable. `sidePanelHint` (sidePanel.ts) is the one source; home, folder, search (results and no-match) and preview end with it. In the dev build the side-panel home card shows the S7 section after the hint (home.ts:102).

d. Snippet. Rows now show the folder path; the snippet is gone. Wireframe 01 folder card specifies `snippet, 80 chars` under each title; spec 7 does not mention it. The owner's item 2 asks for the path, so the wireframe is out of date (handoff lists it for the planner). Two similar titles are told apart by tapping the title: the preview (1 `template.getBody` call) shows subject, recipients and text. In a folder card the path under every row repeats the card header (folder.ts:173). Search matches the snippet (slice 5), so a row can match on text the row no longer shows.

e. Escaping. Probe through `renderCard` with title, folder name, query and subject `<b>x</b> <a href="https://example.com">x</a> &amp;`: TextParagraph and DecoratedText text get `&lt;b&gt;...&amp;amp;`; section headers escaped; CardHeader title, TextInput value and alt text get the raw string (plain-text fields, as on base). Tags are not shown on cards. The no-match text is escaped. Its length is not bounded: `searchFlow` (flows.ts:145) passes the full query, `parseQuery` matches only the first 200 characters (QUERY_MAX), and `noMatchText` (home.ts:111) echoes all of it. Same on base.

f. Icons: `star`, `schedule`, `description`, `folder`, by name through `newMaterialIcon().setName` (render.ts:57); no `setIconUrl`. Google's MaterialIcon reference: "Any invalid names are abandoned and replaced with an empty string and results in the icon failing to render." So an unknown name shows no icon and no error. All 4 are Google Font Icons names (fonts.google.com/icons); rendering in Gmail is unverified. Smoke "Slice 12" steps 1 (star, clock, folder), 3 and 4 (document) catch a missing icon on the screenshots.

g. Widget counts (renderer `addWidget` calls, footer button counted apart): home with 10 favorites, 5 recent, 30 folders: 46 compose, 47 side panel, plus 1 footer button. Folder with 30 subfolders and 20 rows: 52 and 53. Search with 20 results: 21 and 22. Preview with 20 recipient lines: 26. Preview with 10 added, 5 not added, 5 unknown: 22. Prompt card with 20 fields and 20 recipients: 44 plus 2 footer buttons. Largest section 44. All under 100.

h. Wording. The handoff table matches every changed string literal in src/addon (19 rows). New texts are plain and say which button to press. "Request ID ..." stays on BUSY, NETWORK, INTERNAL; the QUOTA notification gives the seconds; DENIED, account texts, the empty home (wireframe 07 A) and every slice 9 line are unchanged. "The sidebar fills at most 20" (prompt.ts:145) says "sidebar"; the quick start calls it the panel.

i. Smoke "Slice 12": 7 steps, both entry points (steps 1 to 5 draft toolbar, step 6 side panel without and with a message), one screenshot per step to compare with the handoff sketches. Missing: a tap on Insert to show the draft still changes; DENIED, QUOTA and request-ID states; a folder name with `&` (gap 1). Step 6 says each card ends with the hint; in dev the home card ends with the S7 section.

j. See Commands.

## Gaps

1. render.ts:70-71 escapes the bottom label and turns `\n` into `<br>`. Google's add-on widget guide says DecoratedText "top and bottom labels must use plain text". If Gmail shows labels as plain text, every row with a hint reads "Sales<br>2 fields to fill" and a folder "R&D" reads "R&amp;D". Escaping on labels predates this slice; the `<br>` on list rows is new. Unverified. Smoke step 1 shows the `<br>`; add a folder named with `&`. If it shows literally: join path and hints on one line with " · " and pass labels unescaped.
2. home.ts:111 echoes the whole query in the no-match text; flows.ts:145 has no length cap. Cut the echo at QUERY_MAX (200). Pre-existing.
3. folder.ts:173 puts the folder path, which equals the card header, under every folder-card row. Wireframe 01 had the snippet there. Owner choice; the wireframe needs an update.
4. Stale docs: smoke.md:47-48 (Slice 4 steps expect "Smoke 3 (1)" and "its snippet"), deploy.md:20 (home card "Migway Templates"). Spec 7, 7.2 and wireframe 01 are on the planner (handoff).
5. Smoke "Slice 12" lacks an Insert regression tap, the DENIED, QUOTA and request-ID states, and the dev S7 section order in step 6.
6. prompt.ts:145 "sidebar" against "panel" in the quick start.
7. home.ts:24 `openLibraryButton` is exported but used only in home.ts.

Probe scripts: removed after the run. No edit to src/, test/, scripts/ or config.
