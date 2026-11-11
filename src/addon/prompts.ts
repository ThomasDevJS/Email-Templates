import type { PromptField } from "../shared/placeholders/render";

/**
 * Details card fields (spec 7.4, ADR-0004 Apply semantics 5 and Amendment 2026-11-11): at most 20 inputs named
 * `p-<n>`, every value optional and at most 500 characters. The Insert callback is the enforcement point.
 */
export const MAX_FIELDS = 20;
export const MAX_VALUE_CHARS = 500;

export function inputName(index: number): string {
  return `p-${String(index + 1)}`;
}

/** Field indexes with a value over 500 characters. */
export function tooLong(entered: readonly string[]): number[] {
  return entered.flatMap((value, index) =>
    value.length > MAX_VALUE_CHARS ? [index] : [],
  );
}

/** "Shorten to 500 characters: Driver name" (spec 7.4). */
export function shortenText(
  fields: readonly PromptField[],
  indexes: readonly number[],
): string {
  const labels = indexes.map((index) => fields[index]?.label ?? "").join(", ");
  return `Shorten to ${String(MAX_VALUE_CHARS)} characters: ${labels}`;
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

/** Answers keyed by `PromptField.key` for `renderBody`; a blank answer leaves the field to its value or removal. */
export function answersByKey(
  fields: readonly PromptField[],
  entered: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field, index) => [field.key, entered[index] ?? ""]),
  );
}
