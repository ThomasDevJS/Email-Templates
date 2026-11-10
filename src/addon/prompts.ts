import type { PromptField } from "../shared/placeholders/render";

/**
 * Prompt card rules (wireframe 02, ADR-0004 Apply semantics 4 and 5): at most 20 inputs named `p-<n>`, every
 * value non-blank and at most 500 characters. The Insert callback is the enforcement point.
 */
export const MAX_FIELDS = 20;
export const MAX_VALUE_CHARS = 500;

export function inputName(index: number): string {
  return `p-${String(index + 1)}`;
}

export interface AnswerCheck {
  /** Field indexes with a blank value. */
  readonly blank: readonly number[];
  /** Field indexes with a value over 500 characters. */
  readonly tooLong: readonly number[];
}

export function checkAnswers(
  fields: readonly PromptField[],
  entered: readonly string[],
): AnswerCheck {
  const blank: number[] = [];
  const tooLong: number[] = [];
  fields.forEach((_, index) => {
    const value = entered[index] ?? "";
    if (value.trim() === "") blank.push(index);
    else if (value.length > MAX_VALUE_CHARS) tooLong.push(index);
  });
  return { blank, tooLong };
}

export function isClean(check: AnswerCheck): boolean {
  return check.blank.length === 0 && check.tooLong.length === 0;
}

function labels(fields: readonly PromptField[], indexes: readonly number[]) {
  return indexes.map((index) => fields[index]?.label ?? "").join(", ");
}

/** "Fill 2 fields: Meeting date, Your phone" (ADR-0004), plus a line for values over the limit. */
export function problemText(
  fields: readonly PromptField[],
  check: AnswerCheck,
): string {
  const lines: string[] = [];
  const blank = check.blank.length;
  if (blank > 0)
    lines.push(
      `Fill ${String(blank)} field${blank === 1 ? "" : "s"}: ${labels(fields, check.blank)}`,
    );
  if (check.tooLong.length > 0)
    lines.push(
      `Shorten to ${String(MAX_VALUE_CHARS)} characters: ${labels(fields, check.tooLong)}`,
    );
  return lines.join("\n");
}

/** Field indexes in display order: fields with a problem first (wireframe 02), the rest in template order. */
export function displayOrder(count: number, check: AnswerCheck): number[] {
  const flagged = [...check.blank, ...check.tooLong].sort((a, b) => a - b);
  const rest = Array.from({ length: count }, (_, n) => n).filter(
    (n) => !flagged.includes(n),
  );
  return [...flagged, ...rest];
}

/** Answers keyed by `PromptField.key` for `renderBody`. */
export function answersByKey(
  fields: readonly PromptField[],
  entered: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field, index) => [field.key, entered[index] ?? ""]),
  );
}
