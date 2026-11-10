import type { SidebarTemplate } from "../../shared/model/sidebar";
import { atLeast } from "../../shared/permissions/levels";
import type { Entry } from "../event";
import { insertButton } from "./folder";
import {
  SKIP_SUBJECT,
  WITH_SUBJECT,
  action,
  type ButtonSpec,
  type CardSpec,
  type Widget,
} from "./spec";

/** "Insert body only" (wireframe 02): the same Insert without the subject action. */
function bodyOnlyButton(template: SidebarTemplate): ButtonSpec {
  return {
    text: "Insert body only",
    alt: `Insert ${template.title} without its subject`,
    action: action("onInsert", { id: template.id, subject: SKIP_SUBJECT }),
  };
}

/** "Insert with subject" (D24): the override when the draft has a subject, which a plain Insert keeps. */
function withSubjectButton(template: SidebarTemplate): ButtonSpec {
  return {
    text: "Insert with subject",
    alt: `Insert ${template.title} with its subject`,
    action: action("onInsert", { id: template.id, subject: WITH_SUBJECT }),
  };
}

/**
 * Insert, plus "Insert body only" or "Insert with subject" when the template has a subject. None in the side panel:
 * a draft response does nothing there (ADR-0007, interim fix of spec 13.7).
 */
function insertButtons(
  template: SidebarTemplate,
  hasSubject: boolean,
  draftHasSubject: boolean,
  entry: Entry,
): ButtonSpec[] {
  if (entry !== "compose") return [];
  return [
    { ...insertButton(template), filled: true },
    ...(hasSubject
      ? [
          draftHasSubject
            ? withSubjectButton(template)
            : bodyOnlyButton(template),
        ]
      : []),
  ];
}

/**
 * Preview card (wireframes 01, 02): the subject with placeholders as [Label] when the template has one, plain text
 * of the body, the explicit prompts as "Fields to fill", the Insert buttons (compose toolbar only), and "Edit in
 * library" only when the caller holds edit or manage on the folder. When the draft has a subject
 * (`draftHasSubject`) Insert keeps it and "Insert with subject" overrides.
 */
export function previewCard(
  template: SidebarTemplate,
  text: string,
  subject: string,
  draftHasSubject: boolean,
  entry: Entry,
): CardSpec {
  const hasSubject = subject !== "";
  const subjectWidgets: Widget[] = hasSubject
    ? [{ kind: "item", topLabel: "Subject", text: subject }]
    : [];
  const fields: Widget[] =
    template.prompts.length === 0
      ? []
      : [
          {
            kind: "text",
            text: `Fields to fill: ${template.prompts.join(", ")}`,
          },
        ];
  const edit: ButtonSpec[] = atLeast(template.level, "edit")
    ? [
        {
          text: "Edit in library",
          alt: `Edit ${template.title} in the library`,
          action: action("onOpenLink", { id: template.id }),
        },
      ]
    : [];
  const buttons = [
    ...insertButtons(template, hasSubject, draftHasSubject, entry),
    ...edit,
  ];
  const note: Widget[] =
    hasSubject && entry === "compose"
      ? [
          {
            kind: "text",
            text: draftHasSubject
              ? "The draft already has a subject. It is kept."
              : "Sets the draft subject.",
          },
        ]
      : [];
  const actions: Widget[] = [
    ...fields,
    ...note,
    ...(buttons.length === 0 ? [] : [{ kind: "buttons" as const, buttons }]),
  ];
  return {
    name: `preview-${template.id}`,
    title: template.title,
    sections: [
      {
        widgets: [
          ...subjectWidgets,
          { kind: "text", text: text === "" ? "(Empty template)" : text },
        ],
      },
      // Card Service rejects a section without widgets.
      ...(actions.length === 0 ? [] : [{ widgets: actions }]),
    ],
  };
}
