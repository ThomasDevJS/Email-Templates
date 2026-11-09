import type { SidebarTemplate } from "../../shared/model/sidebar";
import { atLeast } from "../../shared/permissions/levels";
import { insertButton } from "./folder";
import { action, type ButtonSpec, type CardSpec, type Widget } from "./spec";

/**
 * Preview card (wireframe 01): plain text with placeholders as [Label], the explicit prompts as "Fields to
 * fill", Insert, and "Edit in library" only when the caller holds edit or manage on the folder.
 */
export function previewCard(template: SidebarTemplate, text: string): CardSpec {
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
  return {
    name: `preview-${template.id}`,
    title: template.title,
    sections: [
      {
        widgets: [
          { kind: "text", text: text === "" ? "(Empty template)" : text },
        ],
      },
      {
        widgets: [
          ...fields,
          {
            kind: "buttons",
            buttons: [{ ...insertButton(template), filled: true }, ...edit],
          },
        ],
      },
    ],
  };
}
