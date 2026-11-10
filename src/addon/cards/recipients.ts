import {
  FIELD_LABELS,
  RECIPIENT_FIELDS,
  isOutside,
  recipientCount,
  type AppliedRecipients,
  type RecipientField,
  type Recipients,
} from "../../shared/model/recipients";
import type { Widget } from "./spec";

/**
 * Template recipients at Insert (D26, spec 5.7, ADR-0006 section 4, spike S6). The one place that decides which
 * addresses reach the draft. Gmail's recipient actions replace a field (S6 step 2), so each action carries the
 * draft's list from the tap's event followed by the new addresses.
 */

/** Prompt card switch "Add recipients" (wireframe 02). */
export const RECIPIENT_SWITCH = "rcpt";
export const RECIPIENTS_CHANGED =
  "The recipients of this template changed. Check them and press Insert again.";

export type NotAddedReason = "to" | "present" | "blocked";

export interface RecipientPlan {
  /** Template addresses Insert adds, per field. */
  readonly added: Recipients;
  readonly notAdded: readonly {
    readonly address: string;
    readonly reason: NotAddedReason;
  }[];
}

/** One recipient action per field that gains an address; a field without one gets no action. */
export type RecipientActions = Partial<
  Record<RecipientField, readonly string[]>
>;

/** Compare key: the part inside `<...>` when present, trimmed, lower case. */
function keyOf(address: string): string {
  return (/<([^>]*)>/.exec(address)?.[1] ?? address).trim().toLowerCase();
}

/**
 * Truth table (spec 5.7):
 *
 * | Template address                      | Draft To empty | Draft To filled            |
 * |---------------------------------------|----------------|----------------------------|
 * | To                                    | added          | not added (`to`)           |
 * | Cc, Bcc                               | added          | added                      |
 * | already in any draft field, any case  | not added (`present`)                       |
 * | in `blocked` (switch `deny`)          | not added (`blocked`)                       |
 */
export function recipientPlan(
  template: AppliedRecipients,
  draft: Recipients,
): RecipientPlan {
  const present = new Set(RECIPIENT_FIELDS.flatMap((f) => draft[f].map(keyOf)));
  const notAdded: RecipientPlan["notAdded"][number][] = [];
  const keep = (field: RecipientField) =>
    template[field].filter((address) => {
      if (present.has(keyOf(address)))
        notAdded.push({ address, reason: "present" });
      else if (field === "to" && draft.to.length > 0)
        notAdded.push({ address, reason: "to" });
      else return true;
      return false;
    });
  const added = { to: keep("to"), cc: keep("cc"), bcc: keep("bcc") };
  for (const address of template.blocked)
    notAdded.push({ address, reason: "blocked" });
  return { added, notAdded };
}

/** `add` false ("Insert body only", the switch off): no action at all. */
export function recipientActions(
  template: AppliedRecipients,
  draft: Recipients,
  add: boolean,
): RecipientActions {
  if (!add) return {};
  const { added } = recipientPlan(template, draft);
  return Object.fromEntries(
    RECIPIENT_FIELDS.filter((field) => added[field].length > 0).map((field) => [
      field,
      [...draft[field], ...added[field]],
    ]),
  );
}

/** Text `rh` hashes (first 16 hex of its SHA-256): the lists a card showed. */
export function recipientsText(template: AppliedRecipients): string {
  return JSON.stringify([
    template.to,
    template.cc,
    template.bcc,
    template.blocked,
  ]);
}

export function hasRecipients(template: AppliedRecipients): boolean {
  return recipientCount(template) > 0;
}

/** "Adds To 1, Cc 1, Bcc 1": fields with addresses only; "" when none. */
export function rowHint(rc: readonly number[] | undefined): string {
  const parts = RECIPIENT_FIELDS.flatMap((field, n) => {
    const count = rc?.[n] ?? 0;
    return count > 0 ? [`${FIELD_LABELS[field]} ${String(count)}`] : [];
  });
  return parts.length === 0 ? "" : `Adds ${parts.join(", ")}`;
}

export function addsLine(plan: RecipientPlan): string {
  const n = recipientCount(plan.added);
  return `Adds ${String(n)} recipient${n === 1 ? "" : "s"}.`;
}

function markers(address: string, field: RecipientField, domain: string) {
  return [
    ...(isOutside(address, domain) ? [`outside ${domain}`] : []),
    ...(field === "bcc" ? ["hidden from other recipients"] : []),
  ];
}

const REASONS: Readonly<Record<NotAddedReason, (domain: string) => string>> = {
  to: () => "The draft already has a To recipient.",
  present: () => "It is already in the draft.",
  blocked: (domain) => `Outside ${domain}, turned off by your admin.`,
};

/** Preview card "Recipients" (spec 7.1): one line per added address with its field and markers, then "Not added". */
export function recipientWidgets(
  plan: RecipientPlan,
  domain: string,
): Widget[] {
  const lines: Widget[] = RECIPIENT_FIELDS.flatMap((field) =>
    plan.added[field].map((address): Widget => {
      const marks = markers(address, field, domain);
      return {
        kind: "item",
        topLabel: FIELD_LABELS[field],
        text: address,
        ...(marks.length === 0 ? {} : { bottomLabel: marks.join("\n") }),
      };
    }),
  );
  const skipped: Widget[] = plan.notAdded.map(({ address, reason }) => ({
    kind: "text",
    text: `Not added: ${address}. ${REASONS[reason](domain)}`,
  }));
  return [...lines, ...skipped];
}

/** Prompt card switch label: "Cc safety@migway.com, Bcc records@partner.com (outside migway.com)". */
export function switchLabel(plan: RecipientPlan, domain: string): string {
  return RECIPIENT_FIELDS.flatMap((field) =>
    plan.added[field].map((address) => {
      const outside = isOutside(address, domain) ? ` (outside ${domain})` : "";
      return `${FIELD_LABELS[field]} ${address}${outside}`;
    }),
  ).join(", ");
}
