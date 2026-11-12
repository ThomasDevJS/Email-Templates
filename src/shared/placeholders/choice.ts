/**
 * A dropdown answer of a choice field (spec 5.10, ADR-0004 Amendment 2026-11-12 "choice fields" section 4). `raw` is
 * the item value Gmail sends: a position as a string or a number, alone or first in an array, or nothing. "0" and
 * nothing mean not chosen (""); "1" to the option count give that option; anything else is refused (null).
 */
export const NOT_CHOSEN = "0";
/** Field name suffix of the card text box that stands in for a dropdown, so a typed option never reads as a position. */
export const TYPED_SUFFIX = "-text";
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 20;
export const OPTION_MAX = 100;
export const CHOICE_TOKEN_MAX = 2200;

/** The last `PH_CHOICE` text (spec 5.10): a forbidden character, or a token over 2,200 characters. */
export function invalidChoiceText(where: string): string {
  return `The field ${where} is not a valid choice. Options cannot contain { } | \\ < >, and a field holds at most ${String(OPTIONS_MAX)} options of ${String(OPTION_MAX)} characters.`;
}

/**
 * The first option rule a choice token breaks (spec 5.10 `PH_CHOICE`, in table order), or null. `options` are the
 * trimmed, collapsed parts after the label, empty ones kept; `where` is "at character <n>".
 */
export function optionsProblem(
  label: string,
  options: readonly string[],
  rawLength: number,
  where: string,
): string | null {
  if (rawLength > CHOICE_TOKEN_MAX) return invalidChoiceText(where);
  if (options.length < OPTIONS_MIN)
    return `The field "${label}" needs at least ${String(OPTIONS_MIN)} options (${where}).`;
  if (options.length > OPTIONS_MAX)
    return `The field "${label}" has ${String(options.length)} options. Use at most ${String(OPTIONS_MAX)} (${where}).`;
  if (options.includes(""))
    return `The field "${label}" has an empty option (${where}). Remove the extra |.`;
  if (options.some((option) => option.length > OPTION_MAX))
    return `An option of "${label}" is longer than ${String(OPTION_MAX)} characters (${where}).`;
  const twice = options.find((option, index) =>
    options
      .slice(0, index)
      .some((before) => before.toLowerCase() === option.toLowerCase()),
  );
  if (twice === undefined) return null;
  const first = options.find((o) => o.toLowerCase() === twice.toLowerCase());
  return `The field "${label}" lists "${first ?? twice}" twice (${where}).`;
}

const POSITION = /^[1-9][0-9]?$/;

export function chosenOption(
  raw: unknown,
  options: readonly string[],
): string | null {
  const value: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  if (value === undefined || value === null) return "";
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string") return null;
  if (text === "" || text === NOT_CHOSEN) return "";
  return POSITION.test(text) ? (options[Number(text) - 1] ?? null) : null;
}

/**
 * The position of a typed option (the text box that stands in for a dropdown): the trimmed text must equal one
 * option as written. "" gives "0" (not chosen); any other text gives null (refused).
 */
export function typedPosition(
  text: string,
  options: readonly string[],
): string | null {
  const typed = text.trim();
  if (typed === "") return NOT_CHOSEN;
  const index = options.indexOf(typed);
  return index === -1 ? null : String(index + 1);
}
