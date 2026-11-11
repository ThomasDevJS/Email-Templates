# ADR-0009: Compose card for one-click insert and optional pre-fill (D31)

Status: Proposed (2026-11-11)
Date: 2026-11-11
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
| Manifest `addOns.common.layoutProperties`: `primaryColor` "Toolbar color. Defaults to grey (#424242)"; `secondaryColor` "Default button color. Defaults to the primary color if set; otherwise defaults to blue (#2196F3)". The manifest sets neither | [A42], appsscript.json |
| An insert callback returns `UpdateDraftActionResponse` (body, subject, To, Cc, Bcc only); notifications and navigation live on `ActionResponse` | [A15], [A44] |
| The compose card closed after an insert tap on Gmail web (spike S6 step 0); not stated in Google's compose guide | docs/spikes/slice-09-s6.md, [A14] |
| Row `FILLED` buttons with `setBackgroundColor("#2a3c49")` render slate on Gmail web | owner screenshot 2026-11-11 |

So the footer is blue because the primary is built `OUTLINED` against the rule and no manifest color is set; Gmail falls back to the default blue #2196F3 (likely; the exact path inside Gmail is not documented).

## 1. Row: one button, one tap target

Options:
1. Insert button inserts in one click; a tap on the row opens the details card. Uses the 2 actions a `DecoratedText` allows (button, `onClick`).
2. Two buttons per row ("Insert", "Fill in"). Not possible: one button per `DecoratedText` [A43]. A `ButtonSet` under each row doubles the card height.
3. Insert opens a menu. Card Service has no menu widget; a pushed card is one more click.

Decision: option 1. The button reads "Insert" on every row (Home, folder, search results), screen reader "Insert <title>". "Review" goes away. The row `onClick` opens the details card. Side panel: rows keep today's behavior until spike S7 (ADR-0007), see section 6.

## 2. Details card: one card for preview and pre-fill

Options:
1. Merge preview card and prompt card into one details card: the fields as optional inputs, the subject switch, the recipient switch and lines, the text preview, footer Insert. One card, one Insert path.
2. Keep both cards: preview card with a "Fill in" button that pushes the prompt card. Two cards and two Insert paths stay; 2 taps to pre-fill.

Decision: option 1. Mechanism:
- Opened by the row tap (`onPreview`, name kept). Data: `template.apply` with `followUp: true`, which returns body, subject, lists, sender values and buffers no apply event (spec 4.1 step 3; src/server/handlers/sidebar.ts). So the card knows which variables resolve and shows inputs only for fields that would be markers. Opening the card does not count a use. `template.getBody` stays for the side panel until S7.
- Content, top to bottom: change line (when any); "Fields" section only when the template has fields: line "Fill in now, or leave blank and type in the draft.", one input per field (title = label, no asterisk), at most 20 (`MAX_FIELDS`); with more, the line "This template has <n> fields. The first 20 are here; the rest go into the draft as [Label]."; switch "Replace the subject" with the subject preview (only when the template has a subject; default by D24); "Recipients" section when the template has any: switch "Add recipients" (only when Insert would add one) and the lines of `recipientWidgets`; then the text preview (600 characters, `[Label]` tokens).
- Footer: primary "Insert" (`FILLED`, slate), secondary "Edit in library" (`OUTLINED`) when the caller holds `edit`; else no secondary. Gmail's back arrow returns to the list; no Cancel.
- "Insert with subject" and "Insert body only" go away: the two switches cover them (subject on, or both off). D24 truth table: spec 5.6.
- Insert (`onPromptInsert`, name kept): `template.apply` without `followUp` (one event), unless the card carries `counted=1` (set on a card re-rendered after a blocked Insert, so a second press does not count twice). Values: the card's values, then each non-blank value of the Insert call (recipient first name resolves here). Answers by field key. A typed value wins; a blank field takes the Insert call's value when it resolves, else the marker. Over 500 characters: re-render with "Shorten to 500 characters: <labels>". New template version: re-render with "The template changed. Check the fields and press Insert again." Other lists: `rh` check as today.
- `tooManyFieldsCard` goes away: one-click needs no cap, and the details card shows 20 inputs.

## 3. Home card

Options for the lists:
1. Favorites, then Recent without the favorites, then Folders. One template appears once.
2. Recent first. Recent changes on every insert, so rows move under the pointer between opens.
3. One merged "Your templates" list. Loses the meaning of the star.

Decision: option 1. Recent drops any ID in Favorites in the add-on (`byIds` filter); the server keeps sending at most 5, so Recent may show fewer, and hides when empty. Search results list each template once already.

Row content: start icon of the section (star, clock, document), title as text, one bottom label. Label order: recipient hint, fields hint, folder path, joined by " · " ("Adds Cc 1 · 2 fields to fill · Sales / Quotes"). Reason: the recipient hint is the disclosure of ADR-0006 Amendment 2026-11-11 and must survive if Gmail cuts a long label; the title stays first for scanning. Folder cards show no path (the header has it).

Search hint options: (1) drop it; (2) "Try folder:Sales or tag:pricing" (32 characters). Decision: drop it. The input title "Search templates" says what it does; the no-match text and the quick start teach `folder:` and `tag:`. Owner question Q60.

## 4. Footer "Open library"

Options:
1. Footer primary `FILLED` with `setBackgroundColor("#2a3c49")`, as the API requires. Same slate as the row buttons, which already render slate.
2. Manifest `layoutProperties.secondaryColor: "#2a3c49"`. Changes the default color of every button without its own color, outlined ones included ("Edit in library", Previous, Next). Unverified that Gmail web honors it.
3. Drop the footer on the compose card. "Open library" stays in the add-on's menu (universal action, built) and on the empty card. Gains one row of height; editors lose a visible way into the library.

Decision: options 1 and 2 together. Option 1 makes the footer slate by a documented rule. Option 2 colors the outlined buttons, at the cost of one manifest key and no scope. A smoke step checks both; if Gmail ignores option 2, outlined buttons stay blue and nothing breaks. Owner question Q59 (default: footer kept, slate).

## 5. After the insert

The card closes (S6 step 0). The draft is the result: body at the cursor, subject per D24, chips in To, Cc, Bcc. No notification is possible in the same response ([A15], [A44]). Slice 15 smoke records card behavior per path (row Insert, details Insert); if the card stays open on some path, the card shows nothing new and the user closes it.

## 6. Side panel (ADR-0007, decision unchanged)

Until spike S7: panel rows and the details card show no Insert, as built. After S7: the row button ("New email", "Reply") is a compose action with the same one-click rules (markers, row `rc` check, `recipientActions` on the computed draft); the row tap opens the details card whose footer button is the compose action and reads its inputs from the event's form inputs (S7 records that a compose-action callback receives them). The blank-field notification and the "Check" fallback of ADR-0007 section 3 drop, since a blank field inserts its marker.

## Consequences

- Easier: every template in one tap; one card instead of two; 3 buttons fewer on the card; one Insert path for pre-fill.
- Harder: an unfilled field or an added address is caught in the draft, not on a card (ADR-0004 and ADR-0006 Amendments 2026-11-11). Usage counts inserts only: a details card closed without Insert no longer counts (it did as a prompt card, Q14).
- Code: `rowButton`, `insertButtons`, `withSubjectButton`, `bodyOnlyButton`, `tooManyFieldsCard`, `needsReview` and the "Review" text go away; `insertOrAsk` becomes insert or details card (count check, unknown field). No server change.
- Revisit after the slice 15 smoke (label cut, card close, manifest color) and after S7.

## Open questions

Spec section 15: Q56 to Q62.

## Sources

Read 2026-11-11:
- [A14] https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui (no statement on the card after an insert; the "can't silently add" sentence is about Dropbox file sharing).
- [A15] https://developers.google.com/apps-script/reference/card-service/update-draft-action-response-builder
- [A40] https://developers.google.com/apps-script/reference/card-service/fixed-footer
- [A41] https://developers.google.com/apps-script/reference/card-service/text-button-style
- [A42] https://developers.google.com/apps-script/manifest/addons (`layoutProperties`)
- [A43] https://developers.google.com/apps-script/reference/card-service/decorated-text
- [A44] https://developers.google.com/apps-script/reference/card-service/action-response-builder
