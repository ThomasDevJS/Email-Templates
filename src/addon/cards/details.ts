import { recipientCount } from "../../shared/model/recipients";
import type { SidebarTemplate } from "../../shared/model/sidebar";
import { atLeast } from "../../shared/permissions/levels";
import type { PromptField } from "../../shared/placeholders/render";
import type { Entry } from "../event";
import { MAX_FIELDS, inputName, moreFieldsText } from "../prompts";
import {
  RECIPIENT_SWITCH,
  addsLine,
  recipientWidgets,
  type RecipientPlan,
} from "./recipients";
import { sidePanelHint } from "./sidePanel";
import {
  SUBJECT_SWITCH,
  action,
  type ButtonSpec,
  type CardSpec,
  type SectionSpec,
  type Widget,
} from "./spec";

/** Preview of a template without body text. */
export const EMPTY_TEMPLATE = "This template has no text.";
export const FIELDS_LINE = "Fill in now, or leave blank and type in the draft.";
export const FIRST_NAME_HINT =
  "Leave blank to use the To recipient's first name, when known.";
export const VERSION_CHANGED =
  "The template changed. Check the fields and press Insert again.";
const FIRST_NAME_KEY = "{var}recipient.first_name";

/** What every details card shows: the template, its text, its subject and its recipients (spec 7.4 Flow B). */
export interface DetailsView {
  readonly template: SidebarTemplate;
  /** Plain-text preview, tokens as `[Label]`. */
  readonly text: string;
  /** Subject preview, tokens as `[Label]`; "" when the template has none. */
  readonly subject: string;
  readonly plan: RecipientPlan;
  /** The caller's domain, for the "outside" marker. */
  readonly domain: string;
}

/** The compose details card: the view plus the pre-fill state its Insert (`onPromptInsert`) carries. */
export interface DetailsState extends DetailsView {
  readonly version: number;
  /** Resolved variable values of the call that opened the card. */
  readonly values: Readonly<Record<string, string>>;
  /** Fields without a value, in template order; `entered` and `order` index into it. */
  readonly fields: readonly PromptField[];
  readonly entered: readonly string[];
  readonly order: readonly number[];
  /** Change or error line after a blocked Insert, or from a row Insert; "" for none. */
  readonly problem: string;
  readonly replaceSubject: boolean;
  readonly addRecipients: boolean;
  /** `rh` of the lists shown (spec 5.7). */
  readonly rh: string;
  /** True when an apply event was already buffered for this card: its Insert sends `followUp: true`. */
  readonly counted: boolean;
}

const line = (text: string): Widget => ({ kind: "text", text });

function fieldInput(state: DetailsState, index: number): Widget[] {
  const field = state.fields[index];
  if (field === undefined || index >= MAX_FIELDS) return [];
  return [
    {
      kind: "input",
      name: inputName(index),
      title: field.label,
      value: state.entered[index] ?? "",
      multiline: true,
      ...(field.key === FIRST_NAME_KEY ? { hint: FIRST_NAME_HINT } : {}),
    },
  ];
}

/** Section "Fields", only when a field has no value: the line, at most 20 inputs, the more-than-20 line. */
function fieldsSection(state: DetailsState): SectionSpec[] {
  const count = state.fields.length;
  if (count === 0) return [];
  return [
    {
      header: "Fields",
      widgets: [
        line(FIELDS_LINE),
        ...state.order.flatMap((index) => fieldInput(state, index)),
        ...(count > MAX_FIELDS ? [line(moreFieldsText(count))] : []),
      ],
    },
  ];
}

/** "Replace the subject" with the subject preview as bottom label, only when the template has a subject. */
function subjectSection(state: DetailsState): SectionSpec[] {
  if (state.subject === "") return [];
  return [
    {
      widgets: [
        {
          kind: "item",
          text: "Replace the subject",
          bottomLabel: state.subject,
          toggle: { name: SUBJECT_SWITCH, selected: state.replaceSubject },
        },
      ],
    },
  ];
}

/** Section "Recipients": "Add recipients" when Insert adds one, then the lines of `recipientWidgets`. */
function recipientSection(
  view: DetailsView,
  toggle: boolean | null,
): SectionSpec[] {
  const { plan } = view;
  const adds = recipientCount(plan.added) > 0;
  const widgets: Widget[] = [
    ...(toggle === null || !adds
      ? []
      : [
          {
            kind: "item",
            text: "Add recipients",
            bottomLabel: addsLine(plan),
            toggle: { name: RECIPIENT_SWITCH, selected: toggle },
          } as const,
        ]),
    ...recipientWidgets(plan, view.domain),
  ];
  return widgets.length === 0 ? [] : [{ header: "Recipients", widgets }];
}

function previewSection(view: DetailsView): SectionSpec {
  return { widgets: [line(view.text === "" ? EMPTY_TEMPLATE : view.text)] };
}

/** "Edit in library" only when the caller holds edit or manage on the folder. */
function editButton(template: SidebarTemplate): ButtonSpec | null {
  return atLeast(template.level, "edit")
    ? {
        text: "Edit in library",
        alt: `Edit ${template.title} in the library`,
        style: "outlined",
        action: action("onOpenLink", { id: template.id }),
      }
    : null;
}

/**
 * Details card in the compose toolbar (spec 7.4 Flow B, wireframe 02): change line, Fields, subject switch,
 * Recipients, text preview; footer Insert (filled slate) and "Edit in library" at edit or manage.
 */
export function detailsCard(state: DetailsState): CardSpec {
  const { template } = state;
  const edit = editButton(template);
  return {
    name: `details-${template.id}`,
    title: template.title,
    sections: [
      ...(state.problem === ""
        ? []
        : [{ widgets: [line(`(!) ${state.problem}`)] }]),
      ...fieldsSection(state),
      ...subjectSection(state),
      ...recipientSection(state, state.addRecipients),
      previewSection(state),
    ],
    footer: {
      primary: {
        text: "Insert",
        alt: `Insert ${template.title}`,
        style: "filled",
        action: action("onPromptInsert", {
          id: template.id,
          version: String(state.version),
          values: JSON.stringify(state.values),
          rh: state.rh,
          ...(state.counted ? { counted: "1" } : {}),
        }),
      },
      ...(edit === null ? {} : { secondary: edit }),
    },
  };
}

/**
 * Details card in the side panel (until spike S7, ADR-0009 section 6): no fields, no switches, no Insert. The
 * subject, the recipient lines as for an empty draft, the text, "Edit in library", then the toolbar hint last.
 */
export function panelDetailsCard(view: DetailsView, entry: Entry): CardSpec {
  const edit = editButton(view.template);
  return {
    name: `details-${view.template.id}`,
    title: view.template.title,
    sections: [
      ...(view.subject === ""
        ? []
        : [
            {
              widgets: [
                { kind: "item", topLabel: "Subject", text: view.subject },
              ],
            } as const,
          ]),
      ...recipientSection(view, null),
      previewSection(view),
      ...(edit === null
        ? []
        : [{ widgets: [{ kind: "buttons", buttons: [edit] } as const] }]),
      ...sidePanelHint(entry),
    ],
  };
}
