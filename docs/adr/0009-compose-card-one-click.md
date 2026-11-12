# ADR-0009: Compose card for one-click insert and optional pre-fill (D31)

Status: Accepted 2026-11-11 (owner decision D31; built in slice 15, review PASS with follow-up 1; side panel in slice 18). Was Proposed 2026-11-11. Q58 to Q61 are built at their defaults and covered by D31. Section "As built 2026-11-11" holds the facts of the build and of the owner's test round 1. Amendment 2026-11-12 (D34, D35, D36; slices 20b, 21, 22 with follow-up 1): card look, list caps, spinner, colors, hint and error lines, Search button. Accepted 2026-11-12 on the owner decisions D34, D35 and D36 (PLAN.md), as built at 8e82a07.
Date: 2026-11-11, accepted 2026-11-11
Deciders: owner (thomas@migway.com), architect

## Context

Owner request 2026-11-11, with a screenshot of the compose card (Search, Favorites, Recent, Folders, slate Insert buttons, blue "Open library" footer): "can we also improve ui/ux in this modal. idea is to let users insert template in 1 click (or help pre-fill if they want to (or they do it themselves in the gmail, we just insert template and remove placeholders))". PLAN D31.

As built (slice 12, src/addon/flows.ts, src/addon/cards/): a row Insert inserts at once only when the template has no field to fill and no recipient. Fields open the prompt card; recipients turn the button into "Review" and open the preview card. A tap on the title opens the preview card (subject, recipients, text, "Fields to fill", Insert, "Insert with subject", "Insert body only", "Edit in library"). Favorites and Recent can list one template twice. The search input carries the hint "Tip: add folder:Sales or tag:pricing to narrow the search." The footer "Open library" is built as an `OUTLINED` primary button.

Field rule: ADR-0004 Amendment 2026-11-11. Recipient disclosure: ADR-0006 Amendment 2026-11-11. This ADR sets the cards.

### Platform facts (read 2026-11-11)

| Fact | Source |
|---|---|
| `DecoratedText` holds one button, or one switch, or one end icon; a start icon; top and bottom labels; `setOnClickAction` on the whole widget; text "supports basic HTML formatting" | [A43] |
| `FixedFooter`: "The primary button must be a FILLED button"; the secondary "must be a OUTLINED button"; an unset primary background falls back to the manifest color | [A40] |
| `TextButtonStyle`: `OUTLINED` (default), `FILLED` (colored background, `setBackgroundColor`), `FILLED_TONAL`, `BORDERLESS`; `TEXT` deprecated | [A41] |
| Manifest `addOns.common.layoutProperties`: `primaryColor` "Toolbar color. Defaults to grey (#424242)"; `secondaryColor` "Default button color. Defaults to the primary color if set; otherwise defaults to blue (#2196F3)". The manifest sets neither [slice 15 set `secondaryColor`, slice 21 `primaryColor`, both #2a3c49] | [A42], appsscript.json |
| An insert callback returns `UpdateDraftActionResponse` (body, subject, To, Cc, Bcc only); notifications and navigation live on `ActionResponse` | [A15], [A44] |
| The compose card closed after an insert tap on Gmail web (spike S6 step 0); not stated in Google's compose guide | docs/spikes/slice-09-s6.md, [A14] |
| Row `FILLED` buttons with `setBackgroundColor("#2a3c49")` render slate on Gmail web | owner screenshot 2026-11-11 |

So the footer is blue because the primary is built `OUTLINED` against the rule and no manifest color is set; Gmail falls back to the default blue #2196F3 (likely; the exact path inside Gmail is not documented).

## 1. Row: one button, one tap target

Options:
1. Insert button inserts in one click; a tap on the row opens the details card. Uses the 2 actions a `DecoratedText` allows (button, `onClick`).
2. Two buttons per row ("Insert", "Fill in"). Not possible: one button per `DecoratedText` [A43]. A `ButtonSet` under each row doubles the card height.
3. Insert opens a menu. Card Service has no menu widget; a pushed card is one more click.

Decision: option 1. The button reads "Insert" on every row (Home, folder, search results), screen reader "Insert <title>". "Review" goes away. The row `onClick` opens the details card. Side panel: rows keep today's behavior until spike S7 (ADR-0007), see section 6. [Side panel as built: ADR-0007 A2 and its Amendment 2026-11-11 (D33).]

## 2. Details card: one card for preview and pre-fill

Options:
1. Merge preview card and prompt card into one details card: the fields as optional inputs, the subject switch, the recipient switch and lines, the text preview, footer Insert. One card, one Insert path.
2. Keep both cards: preview card with a "Fill in" button that pushes the prompt card. Two cards and two Insert paths stay; 2 taps to pre-fill.

Decision: option 1. Mechanism:
- Opened by the row tap (`onPreview`, name kept). Data: `template.apply` with `followUp: true`, which returns body, subject, lists, sender values and buffers no apply event (spec 4.1 step 3; src/server/handlers/sidebar.ts). So the card knows which variables resolve and shows inputs only for fields without a value. Opening the card does not count a use. `template.getBody` stays for the side panel until S7.
- Content, top to bottom: change line (when any); "Fields" section only when the template has fields: line "Fill in now, or leave blank and type in the draft.", one input per field (title = label, no asterisk), at most 20 (`MAX_FIELDS`); with more, the line "This template has <n> fields. The first 20 are here; the rest are left out of the draft."; switch "Replace the subject" with the subject preview (only when the template has a subject; default by D24); "Recipients" section when the template has any: switch "Add recipients" (only when Insert would add one) and the lines of `recipientWidgets`; then the text preview (600 characters, `[Label]` tokens).
- Footer: primary "Insert" (`FILLED`, slate), secondary "Edit in library" (`OUTLINED`) when the caller holds `edit`; else no secondary. Gmail's back arrow returns to the list; no Cancel.
- "Insert with subject" and "Insert body only" go away: the two switches cover them (subject on, or both off). D24 truth table: spec 5.6.
- Insert (`onPromptInsert`, name kept): `template.apply` without `followUp` (one event), unless the card carries `counted=1` (set on a card re-rendered after a blocked Insert, so a second press does not count twice). Values: the card's values, then each non-blank value of the Insert call (recipient first name resolves here). Answers by field key. A typed value wins; a blank field takes the Insert call's value when it resolves, else it is removed (ADR-0004 Amendment 2026-11-11). Over 500 characters: re-render with "Shorten to 500 characters: <labels>". New template version: re-render with "The template changed. Check the fields and press Insert again." Other lists: `rh` check as today.
- `tooManyFieldsCard` goes away: one-click needs no cap, and the details card shows 20 inputs.

## 3. Home card

Options for the lists:
1. Favorites, then Recent without the favorites, then Folders. One template appears once.
2. Recent first. Recent changes on every insert, so rows move under the pointer between opens.
3. One merged "Your templates" list. Loses the meaning of the star.

Decision: option 1. Recent drops any ID in Favorites in the add-on (`byIds` filter); the server keeps sending at most 5, so Recent may show fewer, and hides when empty. Search results list each template once already.

Row content: start icon of the section (star, clock, document), title as text, one bottom label. Label order: recipient hint, fields hint, folder path, joined by " · " ("Adds Cc 1 · 2 fields to fill · Sales / Quotes"). Reason: the recipient hint is the disclosure of ADR-0006 Amendment 2026-11-11 and must survive if Gmail cuts a long label; the title stays first for scanning. Folder cards show no path (the header has it).

Search hint options: (1) drop it; (2) "Try folder:Sales or tag:pricing" (32 characters). Decision: drop it. The input title "Search templates" says what it does; the no-match text and the quick start teach `folder:` and `tag:`. Owner question Q59.

## 4. Footer "Open library"

Options:
1. Footer primary `FILLED` with `setBackgroundColor("#2a3c49")`, as the API requires. Same slate as the row buttons, which already render slate.
2. Manifest `layoutProperties.secondaryColor: "#2a3c49"`. Changes the default color of every button without its own color, outlined ones included ("Edit in library", Previous, Next). Unverified that Gmail web honors it.
3. Drop the footer on the compose card. "Open library" stays in the add-on's menu (universal action, built) and on the empty card. Gains one row of height; editors lose a visible way into the library.

Decision: options 1 and 2 together. Option 1 makes the footer slate by a documented rule. Option 2 colors the outlined buttons, at the cost of one manifest key and no scope. A smoke step checks both; if Gmail ignores option 2, outlined buttons stay blue and nothing breaks. Owner question Q58 (default: footer kept, slate).

## 5. After the insert

The card closes (S6 step 0). The draft is the result: body at the cursor, subject per D24, chips in To, Cc, Bcc. No notification is possible in the same response ([A15], [A44]). Slice 15 smoke records card behavior per path (row Insert, details Insert); if the card stays open on some path, the card shows nothing new and the user closes it.

## 6. Side panel (ADR-0007, decision unchanged)

[Superseded by ADR-0007 "Acceptance 2026-11-11" and its Amendment 2026-11-11.] Until spike S7: panel rows and the details card show no Insert, as built. After S7: the row button ("New email", "Reply") is a compose action with the same one-click rules (removal of blank fields, row `rc` check, `recipientActions` on the computed draft); the row tap opens the details card whose footer button is the compose action and reads its inputs from the event's form inputs (S7 records that a compose-action callback receives them). The blank-field notification and the "Check" fallback of ADR-0007 section 3 drop, since a blank field is removed. [2026-11-11, S7 passed: the panel details card is set in ADR-0007 "Acceptance 2026-11-11" section A2: no subject switch, "Add recipients" kept, footer "Reply" and "Reply all" with a message open. Form inputs in a compose callback are checked in the slice 18 smoke (Q68).]

## As built 2026-11-11 (slices 15 and 18, test round 1)

Facts checked in src at 16df87a and in the owner's Gmail (test round 1, dev-56bf795 and dev-5065ba1):
- The compose card closes after Insert, from a row (part B steps 1 and 3) and from the details card. Section 5 holds.
- "Open library" and "Edit in library" open the library in a new Chrome window. The code asks for `OpenAs.OVERLAY` with `OnClose.RELOAD_ADD_ON`; Gmail web opens a window. Whether closing it reloads the card is unverified.
- In a narrow draft Gmail moves the add-on icon into the "⋮" menu of the draft toolbar (part B).
- Details Insert parameters: `id`, `version`, `values`, `rh`, `counted`; no `title` (section 2 named it). The card takes the title from the cached row or the apply result.
- A card pushed by a row Insert (count change, unknown draft field) carries `counted=1`: the row call already buffered the apply event.
- `replacesSubject(draftHasSubject)` takes one argument.
- Follow-up 1: a re-rendered card carries the merged values of each call, so the row Insert, the first details Insert and a re-rendered Insert give the same body and subject (reviewer: 18 of 18). The recipient first name is a field on every details card when the template holds it without default text, because a `followUp` call never resolves it; the box starts empty with the hint "Leave blank to use the To recipient's first name, when known."
- The change line is the first section, prefixed "(!) ". [Slice 22 follow-up 1 removed the prefix: the line is an error line, red with the `error` icon and alt text "Error". See Amendment 2026-11-12.]
- Slice 18: one render function `rendered(body, input)` serves `insertFlow`, `promptInsertFlow` and both side-panel flows.
- Open: rule 2 punctuation (Q76); no cap on the rendered subject (slice 20b) [capped in slice 20b, `renderSubject`]; row Insert gives no notice for a left-out outside address or a skipped To (Q77, ADR-0006 Amendment 2026-11-11).

## Amendment 2026-11-12: card look, list caps, feedback and search (D34, D35, D36)

Status: Accepted 2026-11-12. Owner decisions in PLAN.md: D34 (2026-11-11, "todays ui/ux looks best of these proposals"), D35 (2026-11-11, spinner yes, brand colors where appropriate), D36 (2026-11-11, hints should look like hints, the search box is too plain, the error line can be improved). Built in slices 20b, 21, 22 and 22 follow-up 1, reviews PASS (docs/reviews/slice-20b.md, slice-21.md, slice-22.md). Facts checked in `src/addon/cards/render.ts`, `home.ts`, `folder.ts`, `details.ts`, `states.ts`, `appsscript.json` at 8e82a07 and in the owner's Gmail on dev (2026-11-11). Texts: spec 7.4 "Look and list caps of the Gmail cards".

### A. List caps (slice 20b)

Gmail refuses a card of more than 100 widgets. With an email open a row is 2 widgets (D33), so a home card broke at 69 top-level folders.

Options:
1. Cap each list and end it with a line that says where the rest is.
2. Page every list as the folder card does (Previous, Next). 2 more widgets and 1 more click per list, and more state in callbacks.
3. Leave as is. A large library breaks the home card for every user.

Decision: option 1. Mechanism: `LIST_MAX` (Favorites 10, Recent 5, Folders 40, results 20) and `capped` in `folder.ts`: whole rows only, then the hint "Showing <shown> of <total> <noun>. Use Search or Open library for the rest." Worst cards: folder card with an email open 84 widgets, home 76, search 44 (180 cards probed). Only the Folders cap can fire today; the server caps the other lists first.

### B. Spinner (D35, slice 21)

Options:
1. One rule in the one builder of actions: `toAction` sets `LoadIndicator.SPINNER` on every action except `onBack` and `onOpenLink`, which make no server or Gmail call.
2. Set the indicator per button. 10 callbacks in 6 files; a new button can miss it.

Decision: option 1. Owner saw the spinner on compose Insert, search and side-panel actions (dev, 2026-11-11).

### C. Colors (D35, slice 21)

- Filled buttons: `setBackgroundColor("#2a3c49")` in `toButton`, the one place.
- Manifest `layoutProperties.primaryColor` "#2a3c49" (top bar) next to `secondaryColor` "#2a3c49". Owner measured the bar at #2A3B48 (dev, 2026-11-11). One manifest key, no scope.

### D. Hint and error lines (D36, slice 22 and follow-up 1)

Options for the look:
1. A `DecoratedText` with a start icon (`info` for hints, `error` with alt text "Error" for errors) and the escaped text inside one `<font color>` tag: grey #5f6368 for hints, red #b32025 for errors.
2. Plain `TextParagraph` with a text prefix ("Tip:", "(!)"). The color alone would carry the tone; the prefix costs words on a 300 px card.
3. Chips or tonal buttons. Need Google's preview program (research R5); D34 keeps today's look.

Decision: option 1. Error lines lost the "(!) " prefix in follow-up 1; the icon's alt text gives screen readers the word "Error". The finish-typing line stays plain text, because it warns that an address can be lost. Gmail's dark theme keeps add-on cards white, and the owner read both colors there (dev, 2026-11-11); red is 6.67:1 and grey 6.05:1 on white. Open: whether Gmail draws the `error` icon (Q83); `toIcon` has no try/catch (Q80).

### E. Search button (D36, slice 22 and follow-up 1)

Options:
1. An outlined "Search" button with the `search` icon on the same `onSearch` callback as the box. Compose popup: box and button in one row (Card Service Columns, which Google supports in the dialog opened from a draft). Side panel: stacked. A row that cannot be built falls back to stacked (`toColumns` try/catch).
2. Keep the box alone. Enter or leaving the box searches, but nothing on the card says so (owner: "too plain").
3. Columns in the side panel too. Google documents Columns for the compose dialog; the panel is not named.

Decision: option 1. The owner saw the row render in the popup (dev, 2026-11-11). Cost: a press right after typing can run `onSearch` twice, 2 read-only calls (Q79).

## Consequences

- Easier: every template in one tap; one card instead of two; 3 buttons fewer on the card; one Insert path for pre-fill.
- Harder: an unfilled field (removed, so a sentence may have a hole) or an added address is caught in the draft, not on a card (ADR-0004 and ADR-0006 Amendments 2026-11-11). Usage counts inserts only: a details card closed without Insert no longer counts (it did as a prompt card, Q14).
- Code: `rowButton`, `insertButtons`, `withSubjectButton`, `bodyOnlyButton`, `tooManyFieldsCard`, `needsReview` and the "Review" text go away; `insertOrAsk` becomes insert or details card (count check, unknown field). No server change.
- Revisit after the slice 15 smoke (label cut, card close, manifest color) and after S7.

## Open questions

Spec section 15: Q56 to Q61 (built at their defaults), Q76, Q77. Amendment 2026-11-12: Q79, Q80, Q83.

## Sources

Read 2026-11-11:
- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui (no statement on the card after an insert; the "can't silently add" sentence is about Dropbox file sharing).
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder
- [A40] https://developers.google.com/apps-script/reference/card-service/fixed-footer
- [A41] https://developers.google.com/apps-script/reference/card-service/text-button-style
- [A42] https://developers.google.com/apps-script/manifest/addons (`layoutProperties`)
- [A43] https://developers.google.com/apps-script/reference/card-service/decorated-text
- [A44] https://developers.google.com/apps-script/reference/card-service/action-response-builder
