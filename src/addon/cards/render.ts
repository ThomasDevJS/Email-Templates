import { escapeText } from "../../shared/html/escape";
import { dateText } from "../../shared/placeholders/date";
import type { RecipientActions } from "./recipients";
import {
  SWITCH_ON,
  type ActionSpec,
  type ButtonSpec,
  type Callback,
  type CardSpec,
  type IconName,
  type Reply,
  type SectionSpec,
  type Single,
  type Widget,
} from "./spec";

/**
 * The only Card Service adapter. Text widgets accept a few HTML tags, so every plain-text value is escaped
 * and newlines become `<br>`. Template titles and prompt labels never become markup.
 */
type Card = GoogleAppsScript.Card_Service.Card;
type ActionResponse = GoogleAppsScript.Card_Service.ActionResponse;
type DraftResponse = GoogleAppsScript.Card_Service.UpdateDraftActionResponse;
type ComposeResponse = GoogleAppsScript.Card_Service.ComposeActionResponse;

/** Brand slate of docs/design/design-system.md: the fill of the one main button. */
export const SLATE = "#2a3c49";
/** Brand red: error lines only (design system principle 2). */
export const RED = "#b32025";
/** Grey of hint lines (D36). */
export const GREY = "#5f6368";

/** Escaped text in a color: only the wrapper tag is markup, the text inside is escaped as everywhere. */
function colored(color: string, text: string): string {
  return `<font color="${color}">${markup(text)}</font>`;
}

function markup(text: string): string {
  return escapeText(text).replace(/\n/g, "<br>");
}

/**
 * Callbacks that answer at once with no server or Gmail call: Back pops a card, the library link opens a window.
 * A spinner there would only flash. Every other action waits on the server or Gmail and shows the spinner.
 */
const INSTANT: ReadonlySet<Callback> = new Set(["onBack", "onOpenLink"]);

/** The one place that builds actions: click, change and compose actions all get their load indicator here. */
function toAction(spec: ActionSpec): GoogleAppsScript.Card_Service.Action {
  const built = CardService.newAction()
    .setFunctionName(spec.fn)
    .setLoadIndicator(
      INSTANT.has(spec.fn)
        ? CardService.LoadIndicator.NONE
        : CardService.LoadIndicator.SPINNER,
    );
  return spec.params === undefined
    ? built
    : built.setParameters({ ...spec.params });
}

function toButton(spec: ButtonSpec): GoogleAppsScript.Card_Service.TextButton {
  const text = CardService.newTextButton().setText(spec.text);
  let button =
    spec.compose === undefined
      ? text.setOnClickAction(toAction(spec.action))
      : text.setComposeAction(
          toAction(spec.action),
          CardService.ComposedEmailType[spec.compose],
        );
  if (spec.alt !== undefined) button = button.setAltText(spec.alt);
  if (spec.disabled === true) button = button.setDisabled(true);
  if (spec.style === "filled")
    button = button
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(SLATE);
  if (spec.style === "outlined")
    button = button.setTextButtonStyle(CardService.TextButtonStyle.OUTLINED);
  // shortcut: the typings lack TextButton.setMaterialIcon (Google documents it); skipped where the runtime lacks it.
  const withIcon = button as typeof button & {
    setMaterialIcon?: (
      icon: GoogleAppsScript.Card_Service.MaterialIcon,
    ) => unknown;
  };
  try {
    if (
      spec.icon !== undefined &&
      typeof withIcon.setMaterialIcon === "function"
    )
      withIcon.setMaterialIcon(
        CardService.newMaterialIcon().setName(spec.icon),
      );
  } catch {
    // A runtime that refuses the icon keeps the button, without the icon.
  }
  return button;
}

function toIcon(
  name: IconName,
  alt?: string,
): GoogleAppsScript.Card_Service.IconImage {
  const icon = CardService.newIconImage().setMaterialIcon(
    CardService.newMaterialIcon().setName(name),
  );
  return alt === undefined ? icon : icon.setAltText(alt);
}

/** Hint and error lines (D36): a wrapped DecoratedText, the tone's icon at the start, the escaped text in its color. */
const TONES = {
  hint: { color: GREY, icon: "info", alt: undefined },
  // The icon's alt text says "Error" to screen readers, so the line needs no "(!)" (slice 22b).
  error: { color: RED, icon: "error", alt: "Error" },
} as const;

// Labels are plain text in Gmail (add-on widget guide): escaped like every value, never given markup such as `<br>`.
function toItem(spec: Extract<Widget, { kind: "item" }>) {
  let item = CardService.newDecoratedText()
    .setText(markup(spec.text))
    .setWrapText(true);
  if (spec.icon !== undefined) item = item.setStartIcon(toIcon(spec.icon));
  if (spec.topLabel !== undefined)
    item = item.setTopLabel(escapeText(spec.topLabel));
  if (spec.bottomLabel !== undefined)
    item = item.setBottomLabel(escapeText(spec.bottomLabel));
  if (spec.onClick !== undefined)
    item = item.setOnClickAction(toAction(spec.onClick));
  if (spec.button !== undefined) item = item.setButton(toButton(spec.button));
  if (spec.toggle !== undefined)
    item = item.setSwitchControl(
      CardService.newSwitch()
        .setFieldName(spec.toggle.name)
        .setValue(SWITCH_ON)
        .setSelected(spec.toggle.selected)
        .setControlType(CardService.SwitchControlType.SWITCH),
    );
  return item;
}

function toInput(spec: Extract<Widget, { kind: "input" }>) {
  let input = CardService.newTextInput()
    .setFieldName(spec.name)
    .setTitle(spec.title)
    .setValue(spec.value)
    .setMultiline(spec.multiline);
  if (spec.hint !== undefined) input = input.setHint(spec.hint);
  if (spec.onChange !== undefined)
    input = input.setOnChangeAction(toAction(spec.onChange));
  return input;
}

type CardWidget = GoogleAppsScript.Card_Service.Widget;

/** Hint of the text box that stands in for a date picker. */
export const DATE_HINT = "MM/DD/YYYY";

/**
 * A date field's picker; no start value when `valueMs` is null (Q85). shortcut: a build without `newDatePicker`, or
 * one that throws, gets a text box with the hint MM/DD/YYYY and the date as text; a Gmail that refuses the picker
 * while drawing the card cannot be caught here (Q86).
 */
function toDate(spec: Extract<Widget, { kind: "date" }>): CardWidget {
  try {
    const picker = CardService.newDatePicker()
      .setFieldName(spec.name)
      .setTitle(spec.title);
    return spec.valueMs === null
      ? picker
      : picker.setValueInMsSinceEpoch(spec.valueMs);
  } catch {
    return toInput({
      kind: "input",
      name: spec.name,
      title: spec.title,
      value: spec.valueMs === null ? "" : dateText(spec.valueMs),
      multiline: false,
      hint: DATE_HINT,
    });
  }
}

/** The part of Card Service Columns this file uses. */
interface ColumnsApi {
  newColumns(): {
    addColumn(column: Column): ReturnType<ColumnsApi["newColumns"]>;
  };
  newColumn(): Column;
  HorizontalSizeStyle: Readonly<Record<string, unknown>>;
  VerticalAlignment: Readonly<Record<string, unknown>>;
}
interface Column {
  setHorizontalSizeStyle(style: unknown): Column;
  setVerticalAlignment(alignment: unknown): Column;
  addWidget(widget: CardWidget): Column;
}

function enumValue(values: Readonly<Record<string, unknown>>, name: string) {
  const value = values[name];
  if (value === undefined) throw new Error("no such Card Service value");
  return value;
}

/**
 * shortcut: the typings lack Columns (GA 2024-07, compose dialog only). A build that throws (method or enum missing)
 * falls back to the two widgets stacked; a Gmail that refuses Columns while drawing the card cannot be caught here.
 */
function toColumns(spec: Extract<Widget, { kind: "columns" }>): CardWidget[] {
  try {
    const api = CardService as unknown as ColumnsApi;
    const column = (widget: Single, size: string) =>
      api
        .newColumn()
        .setHorizontalSizeStyle(enumValue(api.HorizontalSizeStyle, size))
        .setVerticalAlignment(enumValue(api.VerticalAlignment, "CENTER"))
        .addWidget(toWidget(widget));
    const row = api
      .newColumns()
      .addColumn(column(spec.fill, "FILL_AVAILABLE_SPACE"))
      .addColumn(column(spec.fit, "FILL_MINIMUM_SPACE"));
    return [row];
  } catch {
    return [toWidget(spec.fill), toWidget(spec.fit)];
  }
}

function toWidget(spec: Single): CardWidget {
  switch (spec.kind) {
    case "text":
      if (spec.tone === undefined)
        return CardService.newTextParagraph().setText(markup(spec.text));
      return CardService.newDecoratedText()
        .setText(colored(TONES[spec.tone].color, spec.text))
        .setWrapText(true)
        .setStartIcon(toIcon(TONES[spec.tone].icon, TONES[spec.tone].alt));
    case "item":
      return toItem(spec);
    case "buttons":
      return spec.buttons.reduce(
        (set, button) => set.addButton(toButton(button)),
        CardService.newButtonSet(),
      );
    case "input":
      return toInput(spec);
    case "date":
      return toDate(spec);
  }
}

function toSection(spec: SectionSpec) {
  const section = CardService.newCardSection();
  if (spec.header !== undefined) section.setHeader(markup(spec.header));
  for (const widget of spec.widgets)
    for (const built of widget.kind === "columns"
      ? toColumns(widget)
      : [toWidget(widget)])
      section.addWidget(built);
  if (spec.collapseAfter !== undefined)
    section.setCollapsible(true).setNumUncollapsibleWidgets(spec.collapseAfter);
  return section;
}

export function renderCard(spec: CardSpec): Card {
  const card = CardService.newCardBuilder().setName(spec.name);
  if (spec.title !== undefined)
    card.setHeader(CardService.newCardHeader().setTitle(spec.title));
  for (const section of spec.sections) card.addSection(toSection(section));
  if (spec.footer !== undefined) {
    const footer = CardService.newFixedFooter().setPrimaryButton(
      toButton(spec.footer.primary),
    );
    if (spec.footer.secondary !== undefined)
      footer.setSecondaryButton(toButton(spec.footer.secondary));
    card.setFixedFooter(footer);
  }
  return card.build();
}

function navigate(
  build: (
    nav: GoogleAppsScript.Card_Service.Navigation,
  ) => GoogleAppsScript.Card_Service.Navigation,
): ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNavigation(build(CardService.newNavigation()))
    .build();
}

/**
 * Body, the subject when present, and one action per recipient field in one response (spec 4.1 step 4; spikes S5
 * and S6 showed Gmail applies all 5). Each recipient action replaces its field. Never `setSendStatus`.
 */
function insertResponse(
  html: string,
  subject: string | null,
  recipients: RecipientActions,
): DraftResponse {
  const body = CardService.newUpdateDraftBodyAction()
    .addUpdateContent(html, CardService.ContentType.MUTABLE_HTML)
    .setUpdateType(CardService.UpdateDraftBodyType.IN_PLACE_INSERT);
  const response =
    CardService.newUpdateDraftActionResponseBuilder().setUpdateDraftBodyAction(
      body,
    );
  if (subject !== null)
    response.setUpdateDraftSubjectAction(
      CardService.newUpdateDraftSubjectAction().addUpdateSubject(subject),
    );
  if (recipients.to !== undefined)
    response.setUpdateDraftToRecipientsAction(
      CardService.newUpdateDraftToRecipientsAction().addUpdateToRecipients([
        ...recipients.to,
      ]),
    );
  if (recipients.cc !== undefined)
    response.setUpdateDraftCcRecipientsAction(
      CardService.newUpdateDraftCcRecipientsAction().addUpdateCcRecipients([
        ...recipients.cc,
      ]),
    );
  if (recipients.bcc !== undefined)
    response.setUpdateDraftBccRecipientsAction(
      CardService.newUpdateDraftBccRecipientsAction().addUpdateBccRecipients([
        ...recipients.bcc,
      ]),
    );
  return response.build();
}

export function renderReply(
  reply: Reply,
): ActionResponse | DraftResponse | ComposeResponse {
  switch (reply.kind) {
    case "push":
      return navigate((nav) => nav.pushCard(renderCard(reply.card)));
    case "update":
      return navigate((nav) => nav.updateCard(renderCard(reply.card)));
    case "root":
      return navigate((nav) =>
        nav.popToRoot().updateCard(renderCard(reply.card)),
      );
    case "pop":
      return navigate((nav) => nav.popCard());
    case "notify":
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(reply.text))
        .build();
    case "open":
      return CardService.newActionResponseBuilder()
        .setOpenLink(
          CardService.newOpenLink()
            .setUrl(reply.url)
            .setOpenAs(CardService.OpenAs.OVERLAY)
            .setOnClose(CardService.OnClose.RELOAD_ADD_ON),
        )
        .build();
    case "insert":
      return insertResponse(reply.html, reply.subject, reply.recipients);
    case "compose":
      return CardService.newComposeActionResponseBuilder()
        .setGmailDraft(reply.draft)
        .build();
  }
}
