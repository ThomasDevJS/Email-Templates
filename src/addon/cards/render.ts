import { escapeText } from "../../shared/html/escape";
import {
  SWITCH_ON,
  type ActionSpec,
  type ButtonSpec,
  type CardSpec,
  type Reply,
  type SectionSpec,
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

function markup(text: string): string {
  return escapeText(text).replace(/\n/g, "<br>");
}

function toAction(spec: ActionSpec): GoogleAppsScript.Card_Service.Action {
  const built = CardService.newAction().setFunctionName(spec.fn);
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
  if (spec.filled === true)
    button = button.setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  return button;
}

function toItem(spec: Extract<Widget, { kind: "item" }>) {
  let item = CardService.newDecoratedText()
    .setText(markup(spec.text))
    .setWrapText(true);
  if (spec.topLabel !== undefined)
    item = item.setTopLabel(markup(spec.topLabel));
  if (spec.bottomLabel !== undefined)
    item = item.setBottomLabel(markup(spec.bottomLabel));
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

function toWidget(spec: Widget): GoogleAppsScript.Card_Service.Widget {
  switch (spec.kind) {
    case "text":
      return CardService.newTextParagraph().setText(markup(spec.text));
    case "item":
      return toItem(spec);
    case "buttons":
      return spec.buttons.reduce(
        (set, button) => set.addButton(toButton(button)),
        CardService.newButtonSet(),
      );
    case "input":
      return toInput(spec);
  }
}

function toSection(spec: SectionSpec) {
  const section = CardService.newCardSection();
  if (spec.header !== undefined) section.setHeader(markup(spec.header));
  for (const widget of spec.widgets) section.addWidget(toWidget(widget));
  return section;
}

export function renderCard(spec: CardSpec): Card {
  const card = CardService.newCardBuilder()
    .setName(spec.name)
    .setHeader(CardService.newCardHeader().setTitle(spec.title));
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

/** Body and, when present, subject in one response (spec 4.1 step 4; spike S5 checks Gmail accepts both). */
function insertResponse(html: string, subject: string | null): DraftResponse {
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
      return insertResponse(reply.html, reply.subject);
    case "s7":
      return CardService.newComposeActionResponseBuilder()
        .setGmailDraft(reply.draft)
        .build();
    case "s7Error":
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(reply.text))
        .setNavigation(
          CardService.newNavigation().pushCard(renderCard(reply.card)),
        )
        .build();
  }
}
