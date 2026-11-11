import { recipientCount } from "../../shared/model/recipients";
import type { SidebarTemplate } from "../../shared/model/sidebar";
import { atLeast } from "../../shared/permissions/levels";
import type { Entry } from "../event";
import { insertButton } from "./folder";
import { sidePanelHint } from "./sidePanel";
import {
  RECIPIENTS_CHANGED,
  addsLine,
  recipientWidgets,
  type RecipientPlan,
} from "./recipients";
import {
  SKIP_SUBJECT,
  WITH_SUBJECT,
  action,
  type ButtonSpec,
  type CardSpec,
  type SectionSpec,
  type Widget,
} from "./spec";

/** Preview of a template without body text. */
export const EMPTY_TEMPLATE = "This template has no text.";

/** What the preview card shows of the recipients (spec 5.7) and the hash its Insert buttons carry. */
export interface PreviewRecipients {
  readonly plan: RecipientPlan;
  /** `rh`: first 16 hex of the SHA-256 of the lists shown; Insert compares it with the lists at insert time. */
  readonly rh: string;
  /** The caller's domain, for the "outside" marker. */
  readonly domain: string;
  /** True when an Insert found other lists than the card showed: the card says so. */
  readonly changed: boolean;
}

/** "Insert body only" (wireframe 02, D26): the same Insert without the subject and recipient actions. */
function bodyOnlyButton(template: SidebarTemplate): ButtonSpec {
  return {
    text: "Insert body only",
    alt: `Insert ${template.title} without its subject and recipients`,
    action: action("onInsert", { id: template.id, subject: SKIP_SUBJECT }),
  };
}

/** "Insert with subject" (D24): the override when the draft has a subject, which a plain Insert keeps. */
function withSubjectButton(template: SidebarTemplate, rh: string): ButtonSpec {
  return {
    text: "Insert with subject",
    alt: `Insert ${template.title} with its subject`,
    action: action("onInsert", { id: template.id, subject: WITH_SUBJECT, rh }),
  };
}

/**
 * Insert, "Insert with subject" when both the template and the draft have a subject, and "Insert body only" when
 * plain Insert would set the subject or add an address. Callers show them in the compose toolbar only: from the
 * side panel a draft response does nothing (ADR-0007, interim fix of spec 13.7).
 */
function insertButtons(
  template: SidebarTemplate,
  hasSubject: boolean,
  draftHasSubject: boolean,
  adds: boolean,
  rh: string,
): ButtonSpec[] {
  const plain: ButtonSpec = {
    ...insertButton(template),
    action: action("onInsert", { id: template.id, rh }),
  };
  const bodyOnly = (hasSubject && !draftHasSubject) || adds;
  return [
    plain,
    ...(hasSubject && draftHasSubject ? [withSubjectButton(template, rh)] : []),
    ...(bodyOnly ? [bodyOnlyButton(template)] : []),
  ];
}

/** The lines above the buttons: what Insert does to the subject, and how many recipients it adds. */
function notes(
  hasSubject: boolean,
  draftHasSubject: boolean,
  plan: RecipientPlan,
): Widget[] {
  const lines = [
    ...(!hasSubject
      ? []
      : [
          draftHasSubject
            ? "The draft already has a subject. It is kept."
            : "Sets the draft subject.",
        ]),
    ...(recipientCount(plan.added) > 0 ? [addsLine(plan)] : []),
  ];
  return lines.map((text) => ({ kind: "text", text }));
}

/** "Edit in library" only when the caller holds edit or manage on the folder. */
function editButtons(template: SidebarTemplate): ButtonSpec[] {
  return atLeast(template.level, "edit")
    ? [
        {
          text: "Edit in library",
          alt: `Edit ${template.title} in the library`,
          action: action("onOpenLink", { id: template.id }),
        },
      ]
    : [];
}

/**
 * Preview card (wireframes 01, 02): the subject with placeholders as [Label] when the template has one, the
 * recipients (every address with its field and markers, then the ones not added and why), plain text of the body,
 * the explicit prompts as "Fields to fill", the Insert buttons (compose toolbar only), and "Edit in library". When
 * the draft has a subject (`draftHasSubject`) Insert keeps it and "Insert with subject" overrides.
 */
export function previewCard(
  template: SidebarTemplate,
  text: string,
  subject: string,
  draftHasSubject: boolean,
  entry: Entry,
  recipients: PreviewRecipients,
): CardSpec {
  const hasSubject = subject !== "";
  const compose = entry === "compose";
  const { plan, rh, domain, changed } = recipients;
  const head: Widget[] = [
    ...(changed
      ? [{ kind: "text", text: `(!) ${RECIPIENTS_CHANGED}` } as const]
      : []),
    ...(hasSubject
      ? [{ kind: "item", topLabel: "Subject", text: subject } as const]
      : []),
  ];
  const listed = recipientWidgets(plan, domain);
  const fields: Widget[] =
    template.prompts.length === 0
      ? []
      : [
          {
            kind: "text",
            text: `Fields to fill: ${template.prompts.join(", ")}`,
          },
        ];
  const adds = recipientCount(plan.added) > 0;
  const buttons = [
    ...(compose
      ? insertButtons(template, hasSubject, draftHasSubject, adds, rh)
      : []),
    ...editButtons(template),
  ];
  const actions: Widget[] = [
    ...fields,
    ...(compose ? notes(hasSubject, draftHasSubject, plan) : []),
    ...(buttons.length === 0 ? [] : [{ kind: "buttons" as const, buttons }]),
  ];
  const preview: Widget = {
    kind: "text",
    text: text === "" ? EMPTY_TEMPLATE : text,
  };
  // Card Service rejects a section without widgets.
  const top: SectionSpec[] =
    listed.length === 0
      ? [{ widgets: [...head, preview] }]
      : [
          ...(head.length === 0 ? [] : [{ widgets: head }]),
          { header: "Recipients", widgets: listed },
          { widgets: [preview] },
        ];
  return {
    name: `preview-${template.id}`,
    title: template.title,
    sections: [
      ...top,
      ...(actions.length === 0 ? [] : [{ widgets: actions }]),
      ...sidePanelHint(entry),
    ],
  };
}
