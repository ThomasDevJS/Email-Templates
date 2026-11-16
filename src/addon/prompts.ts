import { dateText, typedDateMs } from "../shared/placeholders/date";
import { requiredLabel } from "../shared/placeholders/grammar";
import type { PromptField } from "../shared/placeholders/render";

/**
 * Details card fields (spec 7.4, ADR-0004 Apply semantics 5 and Amendments 2026-11-11 and 2026-11-12): at most 20
 * inputs named `p-<n>`, every value optional; text at most 500 characters, a date a real day as MM/DD/YYYY. The
 * Insert callback is the enforcement point.
 */
export const MAX_FIELDS = 20;
export const MAX_VALUE_CHARS = 500;

export function inputName(index: number): string {
  return `p-${String(index + 1)}`;
}

const isDate = (fields: readonly PromptField[], index: number): boolean =>
  fields[index]?.type === "date";

/** Field indexes with a value over 500 characters; date and choice fields are skipped (spec 5.9, 5.10). */
export function tooLong(
  entered: readonly string[],
  fields: readonly PromptField[] = [],
): number[] {
  return entered.flatMap((value, index) =>
    value.length > MAX_VALUE_CHARS && (fields[index]?.type ?? "text") === "text"
      ? [index]
      : [],
  );
}

/** Date field indexes holding text that is not a day as MM/DD/YYYY (the text-box fallback of the picker). */
export function badDates(
  fields: readonly PromptField[],
  entered: readonly string[],
): number[] {
  return entered.flatMap((value, index) =>
    isDate(fields, index) && value.trim() !== "" && typedDateMs(value) === null
      ? [index]
      : [],
  );
}

/**
 * Indexes of required fields (label ending `*`, spec 5.11) left blank; every field when `entered` is empty.
 * shortcut: only the first 20 fields have a box, so a required field past them is not enforced; upgrade if a
 * template ever shows more than 20 fields.
 */
export function missingRequired(
  fields: readonly PromptField[],
  entered: readonly string[] = [],
): number[] {
  return fields.flatMap((field, index) =>
    requiredLabel(field.label) &&
    index < MAX_FIELDS &&
    (entered[index] ?? "").trim() === ""
      ? [index]
      : [],
  );
}

/** "Fill in the required fields: Driver name*, Pickup date*". */
export function requiredText(
  fields: readonly PromptField[],
  indexes: readonly number[],
): string {
  return `Fill in the required fields: ${labelsOf(fields, indexes)}`;
}

const labelsOf = (
  fields: readonly PromptField[],
  indexes: readonly number[],
): string => indexes.map((index) => fields[index]?.label ?? "").join(", ");

/** "Shorten to 500 characters: Driver name" (spec 7.4). */
export function shortenText(
  fields: readonly PromptField[],
  indexes: readonly number[],
): string {
  return `Shorten to ${String(MAX_VALUE_CHARS)} characters: ${labelsOf(fields, indexes)}`;
}

/** "Enter a date as MM/DD/YYYY: Pickup date" (the spec has no text; the style of `shortenText`). */
export function badDateText(
  fields: readonly PromptField[],
  indexes: readonly number[],
): string {
  return `Enter a date as MM/DD/YYYY: ${labelsOf(fields, indexes)}`;
}

/** "Choose again from the list: Status." (spec 5.10): a choice value that is not a position of the token. */
export function chooseAgainText(
  fields: readonly PromptField[],
  indexes: readonly number[],
): string {
  return `Choose again from the list: ${labelsOf(fields, indexes)}.`;
}

/**
 * What stops a details Insert, in this order: a refused choice (`fieldValue` null), a value over 500 characters, a
 * wrongly typed date, a blank required field. `flagged` are the field indexes shown first; null when nothing stops it.
 */
export function enteredProblem(
  fields: readonly PromptField[],
  read: readonly (string | null)[],
): { flagged: number[]; text: string } | null {
  const refused = read.flatMap((value, index) =>
    value === null ? [index] : [],
  );
  if (refused.length > 0)
    return { flagged: refused, text: chooseAgainText(fields, refused) };
  const entered = read.map((value) => value ?? "");
  const long = tooLong(entered, fields);
  if (long.length > 0)
    return { flagged: long, text: shortenText(fields, long) };
  const bad = badDates(fields, entered);
  if (bad.length > 0) return { flagged: bad, text: badDateText(fields, bad) };
  const missing = missingRequired(fields, entered);
  return missing.length > 0
    ? { flagged: missing, text: requiredText(fields, missing) }
    : null;
}

/** "This template has 23 fields. The first 20 are here. The rest are left out of the draft." */
export function moreFieldsText(count: number): string {
  return `This template has ${String(count)} fields. The first ${String(MAX_FIELDS)} are here. The rest are left out of the draft.`;
}

/** Field indexes in display order: fields with a problem first (wireframe 02), the rest in template order. */
export function displayOrder(
  count: number,
  flagged: readonly number[],
): number[] {
  const rest = Array.from({ length: count }, (_, n) => n).filter(
    (n) => !flagged.includes(n),
  );
  return [...flagged, ...rest];
}

/** A date field's answer: the day as MM/DD/YYYY, or "" (removed, D31) when none was picked or typed. */
function dateAnswer(value: string): string {
  const ms = typedDateMs(value);
  return ms === null ? "" : dateText(ms);
}

/** Answers keyed by `PromptField.key` for `renderBody`; a blank answer leaves the field to its value or removal. */
export function answersByKey(
  fields: readonly PromptField[],
  entered: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field, index) => {
      const value = entered[index] ?? "";
      return [field.key, field.type === "date" ? dateAnswer(value) : value];
    }),
  );
}
