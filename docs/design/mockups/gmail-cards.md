# Gmail card looks: legend

`gmail-cards.html` is the source of `gmail-cards-popup.png` (popup over a draft, 500 px) and `gmail-cards-panel.png` (side panel, 300 px). Light theme. Only GA options from `docs/research/2026-11-11-gmail-card-ui.md`.

| Look | What changes | Card Service widget |
|---|---|---|
| Today | Filled slate button on every row, star and clock icons, filled "Open library" footer | DecoratedText start icon and button (TextButton FILLED), FixedFooter |
| A, quiet | Bold template titles | `<b>` in DecoratedText text |
| A | Row buttons outlined: Insert, New email, Reply | TextButton OUTLINED |
| A | "Reply all" as blue text under the row (email open) | DecoratedText with `setComposeAction` and `<font color>` text |
| A | Counts in section headers: "Favorites (3)" | Section header text |
| A | No footer on list cards; "Open library" as blue text, last on the card | DecoratedText with onClick and `<font color>` text |
| A | Details card: folder path under the title, "Insert" the only filled button | CardHeader subtitle, FixedFooter primary FILLED #2a3c49 |
| B, icon rows | As A; the row action is an icon with a hover label | ImageButton with `setIconUrl` (hosted PNG) and alt text |
| B | Email open: reply and reply-all icons under the row | ButtonSet of 2 ImageButton (a DecoratedText holds one button) |
| B | Folders on one line, count after the name | DecoratedText start icon, `<font color>` count |

- TextButton BORDERLESS is Developer Preview, so the two text actions in A are clickable DecoratedText rows. No widget puts plain text at the right of a row, so B's folder count follows the name.
- Caveat 1: Gmail draws fonts, sizes and spacing itself. The mock copies the owner's screenshots (popup 500 px, rows 44 px) and is close, not exact. The 300 px panel frame, the switch and the card header are estimates: no screenshot shows them.
- Caveat 2: icons in buttons, `<font color>` text and the slate fill of a footer button need a check in the owner's Gmail (the screenshot's footer button is blue).
