import {
  escapeAttr,
  escapeText,
  mapTextRuns,
  textRuns,
} from "../../shared/html/escape";
import {
  FIELD_LABELS,
  RECIPIENT_FIELDS,
  type Recipients,
} from "../../shared/model/recipients";
import {
  collapse,
  parseText,
  promptKey,
  type PromptType,
} from "../../shared/placeholders/grammar";
import {
  promptsFor,
  renderBody,
  renderSubject,
  type PromptField,
} from "../../shared/placeholders/render";
import type { Profile } from "../rpc/api";
import {
  blankParts,
  chipLabel,
  placeholderAttrs,
  type PlaceholderAttrs,
} from "../editor/schema";

/**
 * "Preview as me" (wireframe 04) and the history preview (wireframe 05). Inputs are canonical HTML from the
 * editor serializer or the server sanitizer; every inserted value is escaped by the shared renderer.
 */
export function senderValues(profile: Profile | null): Record<string, string> {
  if (profile === null) return {};
  return {
    "sender.name": profile.name,
    "sender.title": profile.title,
    "sender.phone": profile.phone,
    "sender.department": profile.department,
  };
}

/** Today in the browser's local time as MM/DD/YYYY: the sample a date field shows in "Preview as me" (spec 5.9). */
export function sampleDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${String(now.getFullYear())}`;
}

/** A field's sample in "Preview as me": today for a date, the first option for a choice, else `[Label]`. */
function sample(field: PromptField): string {
  if (field.type === "date") return sampleDate();
  return field.type === "choice"
    ? (field.options[0] ?? `[${field.label}]`)
    : `[${field.label}]`;
}

function sampleAnswers(fields: readonly PromptField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, sample(field)]));
}

/** Body rendered with the caller's sender values; prompts and unknown values show as `[Label]`, dates as today. */
export function previewAsMe(html: string, profile: Profile | null): string {
  const values = senderValues(profile);
  const answers = sampleAnswers(promptsFor(html, values));
  return renderBody(html, { values, answers }).html;
}

/** Subject rendered the same way, as plain text (wireframe 04 "Preview as me subject"). */
export function subjectAsMe(subject: string, profile: Profile | null): string {
  const values = senderValues(profile);
  const answers = sampleAnswers(promptsFor("", values, subject));
  return renderSubject(subject, { values, answers }).text;
}

/** One blank as HTML, the same markup the editor draws (design system "Placeholder"). */
export function blankHtml(attrs: PlaceholderAttrs): string {
  const { className, label, fallback, muted } = blankParts(attrs);
  const after =
    (muted === null ? "" : `<span class="ph-or">${escapeText(muted)}</span>`) +
    (fallback === null ? "" : escapeText(fallback));
  return `<span class="${className}" role="img" aria-label="${escapeAttr(chipLabel(attrs))}">${escapeText(label)}${after}</span>`;
}

/** Body with every token shown as a read-only blank, for the history preview. */
export function withChips(html: string): string {
  return mapTextRuns(html, (text) =>
    parseText(text)
      .map((segment) => {
        if (segment.kind === "text") return escapeText(segment.text);
        if (segment.kind === "escape") return "{{";
        const attrs = placeholderAttrs(segment.raw);
        return attrs === null ? escapeText(segment.raw) : blankHtml(attrs);
      })
      .join(""),
  );
}

export interface PromptUse {
  label: string;
  count: number;
  readonly type: PromptType;
  readonly options: readonly string[];
}

/**
 * "The sender fills in": each prompt of subject and body (by identity, first spelling and type) and how often it
 * is used.
 */
export function promptUses(html: string, subject: string): PromptUse[] {
  const uses = new Map<string, PromptUse>();
  const texts = [subject, ...textRuns(html).map((run) => run.text)];
  for (const segment of texts.flatMap((text) => parseText(text))) {
    if (segment.kind !== "prompt") continue;
    const key = promptKey(segment.label);
    const found = uses.get(key);
    if (found === undefined)
      uses.set(key, {
        label: collapse(segment.label),
        count: 1,
        type: segment.type,
        options: segment.options,
      });
    else found.count += 1;
  }
  return [...uses.values()];
}

const OPTIONS_SHOWN = 60;

/**
 * "used once", "used 3 times"; a date adds "date, " in front (spec 5.9), a choice "choice: A, B, " with the options
 * cut to 60 characters and "..." (spec 5.10).
 */
export function usedText(
  count: number,
  type: PromptType = "text",
  options: readonly string[] = [],
): string {
  const used = count === 1 ? "used once" : `used ${String(count)} times`;
  if (type === "date") return `date, ${used}`;
  if (type !== "choice") return used;
  const list = options.join(", ");
  const shown =
    list.length > OPTIONS_SHOWN ? `${list.slice(0, OPTIONS_SHOWN)}...` : list;
  return `choice: ${shown}, ${used}`;
}

/** One line per field with addresses ("To", "a@x.com, b@x.com"), for previews and the history sheet. */
export function recipientLines(
  lists: Recipients,
): { field: string; addresses: string }[] {
  return RECIPIENT_FIELDS.filter((field) => lists[field].length > 0).map(
    (field) => ({
      field: FIELD_LABELS[field],
      addresses: lists[field].join(", "),
    }),
  );
}
