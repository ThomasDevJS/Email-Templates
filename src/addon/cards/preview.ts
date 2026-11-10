import type { SidebarTemplate } from "../../shared/model/sidebar";
import { atLeast } from "../../shared/permissions/levels";
import { insertButton } from "./folder";
import {
  SKIP_SUBJECT,
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

/**
 * Preview card (wireframes 01, 02): the subject with placeholders as [Label] when the template has one, plain text
 * of the body, the explicit prompts as "Fields to fill", Insert ("Insert body only" next to it when there is a
 * subject), and "Edit in library" only when the caller holds edit or manage on the folder.
 */
export function previewCard(
  template: SidebarTemplate,
  text: string,
  subject: string,
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
  const insert: ButtonSpec[] = [
    { ...insertButton(template), filled: true },
    ...(hasSubject ? [bodyOnlyButton(template)] : []),
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
      {
        widgets: [
          ...fields,
          ...(hasSubject
            ? [{ kind: "text", text: "Replaces the draft subject." } as const]
            : []),
          { kind: "buttons", buttons: [...insert, ...edit] },
        ],
      },
    ],
  };
}
