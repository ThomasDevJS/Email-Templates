import {
  FIELD_LABELS,
  RECIPIENT_FIELDS,
  isOutside,
  recipientCount,
  type AppliedRecipients,
  type RecipientField,
  type Recipients,
} from "../../shared/model/recipients";
import type { DraftRecipients } from "../event";
import type { Widget } from "./spec";

/**
 * Template recipients at Insert (D26, spec 5.7, ADR-0006 section 4, spike S6). The one place that decides which
 * addresses reach the draft. Gmail's recipient actions replace a field (S6 step 2), so each action carries the
 * draft's list from the tap's event followed by the new addresses. A draft field the event does not give as a list
 * of strings is unknown and never gets an action.
 */

/** Details card switch "Add recipients" (wireframe 02). */
export const RECIPIENT_SWITCH = "rcpt";
export const RECIPIENTS_CHANGED =
  "The recipients of this template changed. Check them and press Insert again.";
/** Text typed in a recipient field that is not yet a chip is not in the event, and a replace drops it. */
export const FINISH_TYPING =
  "Finish typing addresses in the draft first: an address still being typed is lost.";

export type NotAddedReason = "to" | "present" | "blocked";

export interface RecipientPlan {
  /** Template addresses Insert adds, per field. */
  readonly added: Recipients;
  readonly notAdded: readonly {
    readonly address: string;
    readonly reason: NotAddedReason;
  }[];
  /** Template addresses of draft fields that could not be read: the user adds them by hand. */
  readonly unknown: Recipients;
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
 * Truth table (spec 5.7, plus unknown draft fields):
 *
 * | Template address                     | Draft To empty | Draft To filled  | Draft field unknown       |
 * |--------------------------------------|----------------|------------------|---------------------------|
 * | To                                   | added          | not added (`to`) | not added, add by hand    |
 * | Cc, Bcc                              | added          | added            | not added, add by hand    |
 * | already in a known draft field       | not added (`present`), any case                              |
 * | in `blocked` (switch `deny`)         | not added (`blocked`)                                        |
 */
export function recipientPlan(
  template: AppliedRecipients,
  draft: DraftRecipients,
): RecipientPlan {
  const present = new Set(
    RECIPIENT_FIELDS.flatMap((f) => (draft[f] ?? []).map(keyOf)),
  );
  const notAdded: RecipientPlan["notAdded"][number][] = [];
  const unknown: Record<RecipientField, string[]> = { to: [], cc: [], bcc: [] };
  const keep = (field: RecipientField) =>
    template[field].filter((address) => {
      if (present.has(keyOf(address)))
        notAdded.push({ address, reason: "present" });
      else if (draft[field] === null) unknown[field].push(address);
      else if (field === "to" && (draft.to ?? []).length > 0)
        notAdded.push({ address, reason: "to" });
      else return true;
      return false;
    });
  const added = { to: keep("to"), cc: keep("cc"), bcc: keep("bcc") };
  for (const address of template.blocked)
    notAdded.push({ address, reason: "blocked" });
  return { added, notAdded, unknown };
}

/** `add` false (the "Add recipients" switch off): no action at all. Unknown fields never get one. */
export function recipientActions(
  template: AppliedRecipients,
  draft: DraftRecipients,
  add: boolean,
): RecipientActions {
  if (!add) return {};
  const { added } = recipientPlan(template, draft);
  return Object.fromEntries(
    RECIPIENT_FIELDS.flatMap((field) => {
      const current = draft[field];
      return current === null || added[field].length === 0
        ? []
        : [[field, [...current, ...added[field]]]];
    }),
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

/**
 * Recipient lines of the details card (spec 7.1, 7.4) in the compose toolbar and the side panel:
 * one line per added address with its field and markers, the ones not added and why, one line per unreadable draft
 * field naming the addresses to add by hand, and the finish-typing line when Insert adds an address and `typing`
 * holds (false in the side panel: its drafts are new).
 */
export function recipientWidgets(
  plan: RecipientPlan,
  domain: string,
  typing = true,
): Widget[] {
  const lines: Widget[] = RECIPIENT_FIELDS.flatMap((field) =>
    plan.added[field].map((address): Widget => {
      const marks = markers(address, field, domain);
      return {
        kind: "item",
        topLabel: FIELD_LABELS[field],
        text: address,
        ...(marks.length === 0 ? {} : { bottomLabel: marks.join(" · ") }),
      };
    }),
  );
  const skipped: Widget[] = plan.notAdded.map(({ address, reason }) => ({
    kind: "text",
    text: `Not added: ${address}. ${REASONS[reason](domain)}`,
  }));
  const unread: Widget[] = RECIPIENT_FIELDS.filter(
    (field) => plan.unknown[field].length > 0,
  ).map((field) => ({
    kind: "text",
    text: `The draft's ${FIELD_LABELS[field]} recipients could not be read and were not changed. Add by hand: ${plan.unknown[field].join(", ")}.`,
  }));
  const finish: Widget[] =
    typing && recipientCount(plan.added) > 0
      ? [{ kind: "text", text: FINISH_TYPING }]
      : [];
  return [...lines, ...skipped, ...unread, ...finish];
}
