# Gmail add-on card UI: what a card can look like today (R5)

Researcher, 2026-11-11. All sources read 2026-11-11; IDs [Sn] map to the list at the end. "Unconfirmed" means no primary Google source states it. "Dev preview" means Google lists it in the Workspace Developer Preview Program, which needs an application and a registered Cloud project [S3].

## Answer first

- Cards can look newer with GA features alone: one filled button per card, outlined row buttons, bold titles, card header subtitles, counts in section headers, Grid, search suggestions, load spinners.
- 5 add-on UI features are still Developer Preview on 2026-11-06: Material button style (tonal, borderless), collapsible text paragraph (`setMaxLines`), custom collapse control, overflow menu, chips [S3]. Release notes announced them as preview on 2024-12-13 and list no GA since [S2].
- Google's own references disagree on 3 points. The card JSON reference (updated 2026-11-05) marks Chip, ChipList, CollapseControl and OverflowMenu "available for add-ons" with no preview label, but marks `MaterialIcon` and `Button.type` "unavailable for Google Workspace add-ons" [S1]. The Apps Script reference (updated 2026-04-13) says `MaterialIcon` is available for add-ons [S31] and marks chips and overflow menus as preview [S20]. The preview page [S3] is the newest; this file follows it.
- Carousel is Chat only for add-ons [S1]. Columns work in the compose dialog, not in the side panel list [S1].
- Fonts, paddings, row heights, divider lines between sections and the compose dialog frame are drawn by Gmail. No API sets them in Apps Script.

## 1. Widget set

| Feature | In Gmail add-ons | Source | Note |
|---|---|---|---|
| Card limit | Yes | [S1] [S5] | [S1]: 100 widgets per card; past 100, "that entire section and all following sections are ignored". [S5]: 100 sections per card and 100 widgets per section. The project already caps at 100 per card (worst card 84). |
| DecoratedText text | Yes | [S1] [S23] | Supports basic HTML. `wrapText` true wraps; false truncates. Wrap applies to text only. |
| DecoratedText top label | Yes | [S1] [S4] | Plain text. "Always truncates" (one line). |
| DecoratedText bottom label | Yes | [S1] [S4] | Plain text. "Always wraps". |
| DecoratedText `topLabelText`, `bottomLabelText`, `contentText` (formatted labels) | No | [S1] | Chat only. |
| DecoratedText start icon | Yes | [S1] [S23] | `IconImage`. Start icon vertical alignment is Chat only [S1]; Gmail centers it. |
| DecoratedText end icon | Yes | [S1] [S23] | One of: button, switch, end icon. "A DecoratedText can only support one button, one switch or one icon" [S23]. |
| DecoratedText button | Yes | [S23] | One `Button` (TextButton or ImageButton). |
| DecoratedText switch or checkbox | Yes | [S1] [S4] | `SWITCH` or `CHECK_BOX`. |
| DecoratedText row click | Yes | [S1] | Fires on text, labels and icons, not on the button or switch. |
| TextParagraph HTML | Yes | [S4] | 8 tags: `<b> <i> <u> <s> <font color="#rrggbb"> <a href> <time> <br>`. No lists, headings or font size. |
| TextParagraph Markdown (`textSyntax`) | No | [S1] | Chat only. |
| TextParagraph `setMaxLines` (show more) | Dev preview | [S3] [S24] | Hides text past n lines behind "show more". |
| TextInput title, hint, multiline | Yes | [S1] [S40] | Hint shows below the box, always visible. |
| TextInput placeholder text | No | [S1] | Chat only. |
| TextInput suggestions | Yes | [S1] [S40] | Static list filters as the user types; forces single line. `setSuggestionsAction` for server suggestions. |
| TextInput validation | Yes, since 2024-12-27 | [S2] [S41] | Character limit; input type TEXT, INTEGER, FLOAT, EMAIL. Required widgets via `Action.addRequiredWidget` and `setAllWidgetsAreRequired`. |
| SelectionInput CHECK_BOX, RADIO_BUTTON, SWITCH, DROPDOWN | Yes | [S1] [S39] | Up to 100 items. |
| SelectionInput MULTI_SELECT | Yes, GA 2024-07-25 | [S2] [S1] | Add-ons: static items only. Default max 3 selected. Platform and external data sources are Chat only. Look of chosen items (chips or not) unconfirmed. |
| ButtonList (ButtonSet) | Yes | [S1] | Horizontal row. Wrap behavior in a narrow panel unconfirmed. |
| TextButton OUTLINED (default), FILLED | Yes | [S21] [S22] | FILLED takes `setBackgroundColor("#rrggbb")`; unset uses the manifest `secondaryColor` [S21]. `TEXT` renamed `OUTLINED` 2024-03-15 [S2]. [S1] marks `Button.type` unavailable for add-ons; FILLED works in Google's Gmail samples [S60] [S61]. |
| TextButton FILLED_TONAL, BORDERLESS | Dev preview ("Material button style") | [S3] [S22] | In the Apps Script enum without a label [S22]; preview list names the style [S3]. |
| TextButton disabled | Yes | [S21] | Greyed out, not clickable. |
| TextButton alt text | Yes | [S21] | Defaults to the button text. |
| TextButton icon (`setIcon`, `setIconUrl`, `setMaterialIcon`) | Yes per [S21]; conflict | [S21] [S1] [S60] | Icon shows before text [S1]. Google's Gmail sample "Email Classifier" uses `setMaterialIcon` on FILLED buttons [S60]. [S1] says MaterialIcon unavailable for add-ons. Needs a test. |
| TextButton overflow menu | Dev preview | [S3] [S21] | |
| ImageButton with `setIcon` or `setIconUrl` | Yes | [S29] | Icon-only button; alt text shows as hover text [S1]. |
| ImageButton `setMaterialIcon`, `setImageButtonStyle` | Dev preview | [S29] | Styles BORDERLESS (default), OUTLINED, FILLED, FILLED_TONAL [S30]. |
| Image | Yes | [S1] | HTTPS URL, alt text, click action. |
| Grid | Yes | [S1] [S43] | Items: image, title, subtitle; one click action with `grid_item_identifier`. Column count default differs "dialog versus companion" [S1]. |
| Columns | Yes, GA 2024-07-25, compose dialog only | [S2] [S1] | Max 2 columns. Add-on surfaces listed: the dialog opened from an email draft and the Calendar attachment dialog. Second column wraps at 480 px or less on web. |
| Divider | Yes | [S1] [S45] | Horizontal line between widgets; counts as a widget. |
| Section divider style NO_DIVIDER | JSON only | [S1] [S2] [S28] | Added 2023-07-13 [S2]. Apps Script `CardBuilder` has no setter [S28]. |
| ChipList and Chip | Dev preview | [S3] [S35] [S36] | Layout WRAPPED or HORIZONTAL_SCROLLABLE. Chip: label, icon, disabled, alt text, action. |
| Carousel | No | [S1] [S44] | "Available for Google Chat apps and unavailable for Google Workspace add-ons" [S1]. Google's travel sample renders it in Chat only [S63]. |
| Collapsible section (`setCollapsible`, `setNumUncollapsibleWidgets`) | Yes | [S1] [S25] | Default controls read "Show more" and "Show less" [S1]. Large sections may auto-collapse [S5]. |
| CollapseControl (custom expand and collapse buttons) | Dev preview | [S3] [S37] | Both buttons must be set [S1]. |
| OverflowMenu | Dev preview | [S3] [S38] | No nested menus. |
| DateTimePicker | Yes | [S1] [S4] | Not needed here. |
| Card header | Yes | [S1] [S26] | Title, subtitle, image URL, image style SQUARE or CIRCLE, alt text. Fixed height of 2 lines: title alone takes both lines. |
| Section header | Yes | [S1] [S25] | One string; "Supports simple HTML formatted text" [S1]. No icon, no button, no action field. |
| Fixed footer | Yes | [S1] [S27] | Primary must be FILLED; secondary must be OUTLINED; secondary needs a primary [S27]. Unset primary color: manifest primary color [S27]. |
| Peek card, `DisplayStyle.PEEK`, `setPeekCardHeader` | Yes, side panel | [S4] [S1] | Only for a contextual trigger that returns one card. Not on mobile. |
| Card actions (header menu) | Yes | [S1] [S50] | Up to 10 per card [S1]. Universal actions share the same menu [S4]. |
| Notification | Yes | [S1] [S47] | Plain text, no HTML [S1]. |
| Action load indicator SPINNER or NONE | Yes | [S1] | Used by Google's Gmail sample [S60]. |
| Material 3 look | Yes, since 2023-08-15 | [S2] | Every add-on card on web got the GM3 style automatically. |

## 2. Icons

| Feature | In Gmail add-ons | Source | Note |
|---|---|---|---|
| `MaterialIcon` name, fill, weight, grade | Conflict | [S31] [S1] | [S31]: "Available for Google Workspace add-ons and Google Chat apps". [S1]: "unavailable for Google Workspace add-ons". Weight 100 to 700 in steps of 100 (default 400); grade -25, 0 or 200 (default 0); fill default false. An invalid name renders no icon. |
| Material icon in DecoratedText start or end icon | Unconfirmed | [S32] | Project uses it now (`star`, `schedule`, `description`, `folder`). The owner's test part E step 1 checks it; not run yet. |
| Material icon in TextButton | Probably yes | [S21] [S60] | Google's Gmail sample uses it [S60]. |
| Material icon in ImageButton or Chip | Dev preview | [S29] [S35] | |
| `CardService.Icon` enum | Yes | [S33] | 31 values: AIRPLANE, BOOKMARK, BUS, CAR, CLOCK, CONFIRMATION_NUMBER_ICON, DOLLAR, DESCRIPTION, EMAIL, EVENT_PERFORMER, EVENT_SEAT, FLIGHT_ARRIVAL, FLIGHT_DEPARTURE, HOTEL, HOTEL_ROOM_TYPE, INVITE, MAP_PIN, MEMBERSHIP, MULTIPLE_PEOPLE, OFFER, PERSON, PHONE, RESTAURANT_ICON, SHOPPING_CART, STAR, STORE, TICKET, TRAIN, VIDEO_CAMERA, VIDEO_PLAY, NONE. No folder, no chevron, no send. |
| Custom icon URL | Yes | [S1] [S32] [S34] | HTTPS, PNG or JPG. IconImage crop: SQUARE or CIRCLE only. CIRCLE "can draw the image larger than a built-in icon" [S1]. Must be reachable by every user [S6]. |
| Dark theme | Unconfirmed | none | No Google page describes card rendering in Gmail's dark theme. Probably: Material icons follow the text color; PNG icons keep their pixels. Test both. |
| `darkModeLogoUrl` | No (Meet only) | [S9b] | Appears only in the Meet add-on manifest example. |

## 3. Colors and theming

| Feature | In Gmail add-ons | Source | Note |
|---|---|---|---|
| `layoutProperties.primaryColor` | Documented | [S9] | "Toolbar color", default #424242. Whether the GM3 toolbar still shows it is unconfirmed. |
| `layoutProperties.secondaryColor` | Yes | [S9] [S21] | "Default button color"; default is the primary color, else #2196F3. FILLED buttons without `setBackgroundColor` use it. Project sets #2a3c49. |
| FILLED fixed-footer primary without a color | Conflict | [S27] [S21] | [S27] says primary color; [S21] says secondary color. Project sets slate on every filled button, so both paths give slate. |
| `setBackgroundColor` on FILLED | Yes | [S21] | "#rgb format". No-op on OUTLINED. Text color on the fill is picked by Gmail for contrast [S1]. |
| Text color through `<font color>` | Yes | [S4] | Any hex color in text and paragraphs. Labels are plain text, so no color there [S4]. |
| Font size, weight other than `<b>`, font family | No | [S4] | Not in the tag list. |
| Dark theme behavior of `<font color>` and button fills | Unconfirmed | none | A dark slate (#2a3c49) text color may lose contrast on a dark background. Test before use. |

## 4. Surfaces

| Feature | Compose dialog (draft toolbar) | Side panel (homepage, contextual) | Source | Note |
|---|---|---|---|---|
| Frame | Dialog over the draft, modal on web | Right side panel | [S1] Columns note; PLAN 2026-11-10 | [S1] calls the compose UI "the dialog displayed when users open the add-on from an email draft". Modal: project observation. |
| Width | Unconfirmed | Unconfirmed (about 300 px, project wireframe) | none | Google publishes no pixel width. Columns wrap at 480 px or less on web [S1]. |
| Columns | Yes | Not listed | [S1] | |
| Grid default columns | Dialog default | Companion default | [S1] | Values not published. |
| Peek card | No (no contextual trigger) | Yes, contextual only | [S4] | |
| Notification after draft update | No | Yes for normal actions | project A15, A44; wireframe 01 | A compose action notification is not shown (owner test part J). |
| Card closes after insert | Yes | n/a | project spike S6 | |
| Universal actions and card actions menu | Unconfirmed in the dialog | Yes | [S4] | |
| Fixed footer, card header, navigation | Yes (built and used) | Yes | project slices 15 and 18 | |
| Gmail mobile | Out of scope | Out of scope | [S8] | Cards render on mobile; peek cards do not [S4]. Owner tests web only. |

## 5. Google design guidance and public examples

Guidance for card add-ons [S6] [S7]:
- Sentence case for buttons, labels and card actions. Start button labels with a verb.
- "Button rows should be limited to three or fewer buttons in most cases."
- DecoratedText "is truncated if it cannot fit"; keep it short.
- Keep the card action menu small.
- "Keep cards simple": too many widgets fill the screen; large sections collapse and hide information.
- "Use just a few cards."
- Use hints and suggestions on text inputs; use a dropdown when the value comes from a fixed set.
- Branding "brief and light"; no Google product names or icons.
- The editor add-on guide adds "Avoid displaying more than one blue, red, or green button at a time" [S6b]. That page covers HTML editor add-ons, so it is guidance by analogy only.
- No density, padding or text-length numbers are published for cards.

Public examples (Google samples; screenshots not checked, widget use read from source):

| Example | Surface | Uses | Source |
|---|---|---|---|
| Email Classifier (Gmail homepage) | Side panel | Header with CIRCLE image, FILLED buttons with custom colors and `setMaterialIcon` icons, SPINNER load indicator | [S60] |
| Gmail sentiment analysis | Side panel | Header with CIRCLE image, Image, FILLED button, fixed footer | [S61] |
| Cats quickstart | Side panel and compose | Header, Image, TextInput, FILLED buttons, fixed footer, navigation, draft insert | [S62] |
| Travel ADK agent | Gmail contextual and Chat | Disabled TextButton with a Material icon as a status line; carousel only when in Chat | [S63] |
| Card Builder | Design tool | Live preview of card JSON | [S64] |

Third-party Gmail add-ons (Asana, Trello, HubSpot) were not checked: their Marketplace pages and screenshots are not primary sources for widget use.

## 6. Rendering quirks for a template list (one action per row)

| Question | Answer | Source | Status |
|---|---|---|---|
| DecoratedText with a button and a long title | Title wraps with `wrapText(true)`; top label truncates to 1 line; bottom label wraps | [S1] | Confirmed. Width split between text and button unconfirmed. |
| Icon-only button in a row | `ImageButton` in `DecoratedText.setButton`, icon from `Icon` enum or URL | [S23] [S29] | GA. Material icon on ImageButton is preview. |
| Two actions in one row | Row click plus one button or switch. A second button needs a ButtonSet widget or an overflow menu (preview) | [S1] [S23] | Confirmed. |
| ButtonList in a 300 px panel | Not documented | none | Unconfirmed: wrap or clip. Guidance: 3 buttons max [S6]. |
| Collapsed section control | Default "Show more" and "Show less" below the shown widgets; custom labels via CollapseControl (preview) | [S1] [S37] | Default confirmed; position unconfirmed. |
| Count in a section header | Yes, as text ("Favorites (10)") | [S1] | Confirmed. |
| Action in a section header | No field exists | [S1] | Confirmed: not possible. |

## 7. Project cards against the widget set

Read: `src/addon/cards/render.ts`, `spec.ts`, `home.ts`, `folder.ts`, `details.ts`, wireframes 01 and 02.

Used now: DecoratedText (wrap, start icon, top and bottom label, row click, one button, switch), TextParagraph (escaped text, `<br>` only), TextInput (title, hint, multiline, on-change), ButtonSet, TextButton (FILLED slate, OUTLINED, disabled, alt text, compose action), collapsible sections, CardHeader (title only), fixed footer, notification, navigation, `secondaryColor`, one universal action "Open library".

Not used yet:
- GA: CardHeader subtitle, image and image style; DecoratedText end icon; ImageButton; TextButton icons; MaterialIcon fill and weight; any HTML other than `<br>` (`<b>`, `<font color>`); Divider; Grid; Columns (compose only); SelectionInput (dropdown, multi-select); TextInput suggestions and validation; card actions; peek card; Action load indicator; `primaryColor`; Image.
- Preview: FILLED_TONAL and BORDERLESS, chips, overflow menu, `setMaxLines`, CollapseControl.

## What we can change

Ranked by visual gain against risk. "Verified" means GA in Google docs for Gmail add-ons with no conflicting source. Widget counts refer to the 100-per-card cap; the worst card is at 84.

| # | Option | Widget | Visual gain | Risk | Status |
|---|---|---|---|---|---|
| 1 | One filled button per card. Row Insert, New email and Reply become OUTLINED; the footer keeps the one FILLED slate button | TextButton OUTLINED | High: the list stops reading as a column of dark blocks | Low; one style change in `folder.ts` | Verified |
| 2 | Drop the "Open library" footer on list cards. The header menu already holds the universal action "Open library"; add "Refresh" as a card action | Card actions, universal action | High: frees the bottom bar | Low; discoverability drops slightly | Verified |
| 3 | Bold template titles in rows with `<b>`; keep hints in the bottom label | DecoratedText text HTML | Medium-high: clear title and metadata levels | Low; escaping stays, only the wrapper tag is added | Verified |
| 4 | Card header subtitle: folder card "Sales / Quotes" plus "24 templates"; details card title plus folder path | CardHeader subtitle | Medium | Low; header height is fixed at 2 lines | Verified |
| 5 | Counts in section headers: "Favorites (10)", "Folders (12)" | Section header text | Medium | Low | Verified |
| 6 | Side panel with an email open: one "Reply" button in the row, "Reply all" only on the details card. Halves widgets and buttons per row | DecoratedText button | High: removes the 2-button row under every title | Medium: reverses owner decision D33; owner call | Verified |
| 7 | Folders as a 2-column Grid with a folder image, name and count | Grid | Medium-high | Medium: each item needs a hosted HTTPS image; one click action for the grid | Verified (GA); look needs a test |
| 8 | Spinner on Insert, Reply and folder taps | Action load indicator SPINNER | Low-medium: feedback during the 8 s waits | Low | Verified |
| 9 | Search suggestions: folder names and the `folder:` and `tag:` prefixes | TextInput suggestions | Low-medium | Low; suggestions force single line (already single line) | Verified |
| 10 | Peek card for the contextual (email open) card, so the home list stays in place | DisplayStyle.PEEK, peek header | Low-medium | Medium: one more tap to reach Reply rows | Verified |
| 11 | Muted grey hint text and the side-panel tip with `<font color="#5f6368">` | TextParagraph HTML | Medium | Medium: dark theme contrast unconfirmed | Needs test in the owner's Gmail |
| 12 | Material icons with fill and weight (filled star for Favorites, weight 300) and an icon inside the Insert button | MaterialIcon on IconImage and TextButton | Medium | Medium: references conflict [S1] vs [S31]; Google's Gmail sample works [S60] | Needs test |
| 13 | Row Insert as FILLED_TONAL (slate-tinted, lighter than filled) | TextButtonStyle FILLED_TONAL | High | High: Developer Preview [S3]; behavior without enrolment unknown | Needs test; enrolment likely |
| 14 | Folder and tag chips above the list for one-tap filters | ChipList, Chip | High | High: Developer Preview [S3] | Needs test; enrolment likely |
| 15 | Details card preview cut to 6 lines with "show more"; custom "Show 12 more" collapse labels | TextParagraph `setMaxLines`, CollapseControl | Medium | High: Developer Preview [S3] | Needs test; enrolment likely |

Next for the owner's Gmail (part E): options 11, 12 and one preview widget (13) in a dev build, light and dark theme, side panel and compose.

## What we cannot change

Gmail draws these; no Card Service field sets them:
- Font family, font size, line height; only `<b> <i> <u> <s>` and `<font color>` [S4].
- Paddings, margins, row heights, button shape and height, icon size.
- Lines between sections: Apps Script has no NO_DIVIDER setter [S28].
- The add-on toolbar: logo, add-on name, back arrow, the three-dot menu position [S4] [S9].
- The compose dialog frame, its size and its modal behavior; the card closing after a draft insert (project spike S6).
- No notification after a draft update or a compose action (project A15, A44, part J).
- Default "Show more" and "Show less" wording without the preview CollapseControl [S1].
- Placeholder text inside inputs (Chat only) [S1]; formatted labels (Chat only) [S1].
- Carousel (Chat only) [S1]; Columns in the side panel (not listed) [S1]; more than 2 columns [S1].
- Dark theme color mapping; no dark logo for Gmail [S9b].
- The 100-widget cap [S1].

## Open questions

- Q-R5-1. Does a Developer Preview method (`FILLED_TONAL`, `newChip`, `setMaxLines`) fail, get ignored or render in a project outside the program? Not documented.
- Q-R5-2. Does `MaterialIcon` render in Gmail add-ons? [S1] says no, [S31] and [S60] say yes. Part E step 1 answers it.
- Q-R5-3. Does Gmail's GM3 toolbar still use `primaryColor`?
- Q-R5-4. How does a ButtonSet with 3 buttons wrap in the side panel?
- Q-R5-5. Card rendering in Gmail dark theme: icon colors, `<font color>`, FILLED slate.
- Q-R5-6. Do card actions and universal actions show in the compose dialog?

## Sources (all read 2026-11-11)

- [S1] Card v1 reference (updated 2026-11-05): https://developers.google.com/workspace/add-ons/reference/rpc/google.apps.card.v1
- [S2] Add-ons release notes: https://developers.google.com/workspace/add-ons/release-notes
- [S3] Developer Preview Program, "Latest features" (updated 2026-11-06): https://developers.google.com/workspace/preview
- [S4] Widgets and text formatting: https://developers.google.com/workspace/add-ons/concepts/widgets
- [S5] Cards: https://developers.google.com/workspace/add-ons/concepts/cards
- [S6] Workspace add-on style guide: https://developers.google.com/workspace/add-ons/guides/workspace-style
- [S6b] Editor add-on style guide: https://developers.google.com/workspace/add-ons/guides/style
- [S7] Best practices: https://developers.google.com/workspace/add-ons/guides/workspace-best-practices
- [S8] Card-based interfaces: https://developers.google.com/workspace/add-ons/concepts/card-interfaces
- [S9] Manifest, LayoutProperties: https://developers.google.com/apps-script/manifest/addons
- [S9b] Manifests overview (Meet `darkModeLogoUrl`): https://developers.google.com/workspace/add-ons/concepts/workspace-manifests
- [S10] Compose UI: https://developers.google.com/workspace/add-ons/gmail/extending-compose-ui
- [S20] CardService: https://developers.google.com/apps-script/reference/card-service/card-service
- [S21] TextButton: https://developers.google.com/apps-script/reference/card-service/text-button
- [S22] TextButtonStyle: https://developers.google.com/apps-script/reference/card-service/text-button-style
- [S23] DecoratedText: https://developers.google.com/apps-script/reference/card-service/decorated-text
- [S24] TextParagraph: https://developers.google.com/apps-script/reference/card-service/text-paragraph
- [S25] CardSection: https://developers.google.com/apps-script/reference/card-service/card-section
- [S26] CardHeader: https://developers.google.com/apps-script/reference/card-service/card-header
- [S27] FixedFooter: https://developers.google.com/apps-script/reference/card-service/fixed-footer
- [S28] CardBuilder: https://developers.google.com/apps-script/reference/card-service/card-builder
- [S29] ImageButton: https://developers.google.com/apps-script/reference/card-service/image-button
- [S30] ImageButtonStyle: https://developers.google.com/apps-script/reference/card-service/image-button-style
- [S31] MaterialIcon: https://developers.google.com/apps-script/reference/card-service/material-icon
- [S32] IconImage: https://developers.google.com/apps-script/reference/card-service/icon-image
- [S33] Icon enum: https://developers.google.com/apps-script/reference/card-service/icon
- [S34] ImageCropType: https://developers.google.com/apps-script/reference/card-service/image-crop-type
- [S35] Chip: https://developers.google.com/apps-script/reference/card-service/chip
- [S36] ChipList: https://developers.google.com/apps-script/reference/card-service/chip-list
- [S37] CollapseControl: https://developers.google.com/apps-script/reference/card-service/collapse-control
- [S38] OverflowMenu: https://developers.google.com/apps-script/reference/card-service/overflow-menu
- [S39] SelectionInput: https://developers.google.com/apps-script/reference/card-service/selection-input
- [S40] TextInput: https://developers.google.com/apps-script/reference/card-service/text-input
- [S41] Validation: https://developers.google.com/apps-script/reference/card-service/validation
- [S43] Grid: https://developers.google.com/apps-script/reference/card-service/grid
- [S44] Carousel: https://developers.google.com/apps-script/reference/card-service/carousel
- [S45] Divider: https://developers.google.com/apps-script/reference/card-service/divider
- [S47] Notification: https://developers.google.com/apps-script/reference/card-service/notification
- [S50] CardAction: https://developers.google.com/apps-script/reference/card-service/card-action
- [S60] Email Classifier sample, Cards.gs (last change 2026-07-30): https://github.com/googleworkspace/apps-script-samples/blob/main/ai/email-classifier/Cards.gs
- [S61] Gmail sentiment analysis: https://developers.google.com/workspace/add-ons/samples/gmail-sentiment-analysis-ai and https://github.com/googleworkspace/apps-script-samples/blob/main/ai/gmail-sentiment-analysis/Cards.gs
- [S62] Cats quickstart: https://github.com/googleworkspace/add-ons-samples/tree/main/apps-script/cats
- [S63] Travel ADK agent (last change 2026-10-26): https://github.com/googleworkspace/add-ons-samples/blob/main/apps-script/travel-adk-ai-agent/TravelAgentUiRender.gs
- [S64] Card Builder: https://addons.gsuite.google.com/uikit/builder
- Project facts: PLAN.md log 2026-11-10 and 2026-11-11; docs/wireframes/01-sidebar-home.txt; docs/ops/test-round-1.md part E.
