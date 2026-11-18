import { escapeText, escapeValue, mapTextRuns, textRuns } from "../html/escape";
import {
  collapse,
  fieldLabel,
  parseText,
  promptKey,
  type PromptType,
  type Segment,
} from "./grammar";
import { placeholderInfo } from "./registry";
import { capSubject, oneLine } from "./subject";

/**
 * Apply semantics (ADR-0004 and its Amendment 2026-11-11): tokens in sanitized HTML become escaped values. Value
 * order: a typed answer, else the variable's value, else its fallback, else "". A token that renders as "" leaves a
 * gap that `closeGaps` tidies. Prompts with the same identity share one answer. `\{{` renders as `{{`.
 */
export interface PromptField {
  /** Identity: `promptKey(label)` for explicit prompts, `{var}<name>` for implicit ones (labels cannot hold `{`). */
  readonly key: string;
  /** First spelling, whitespace collapsed. */
  readonly label: string;
  readonly implicit: boolean;
  /** The type of the first token with this identity; implicit prompts are text (spec 5.9). */
  readonly type: PromptType;
  /** A choice's options, as written in the first token with this identity; [] for other types (spec 5.10). */
  readonly options: readonly string[];
}

export interface RenderInput {
  /** Resolved variable values by name. Missing or blank means unresolved. */
  readonly values: Readonly<Record<string, string>>;
  /** Prompt answers by `PromptField.key`. A non-blank answer wins over a variable's value. */
  readonly answers: Readonly<Record<string, string>>;
}

export interface Rendered {
  readonly html: string;
}

const implicitKey = (name: string): string => `{var}${name}`;

const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== "";

/** Value escaping plus newline to `<br>` (ADR-0004 Apply semantics 5). */
export function formatValue(value: string): string {
  return escapeValue(value).replace(/\r\n|\r|\n/g, "<br>");
}

type Token = Exclude<Segment, { kind: "text" | "escape" }>;

/** The prompt field a token needs, or null when the token resolves without asking. */
function fieldOf(
  segment: Segment,
  values: RenderInput["values"],
): PromptField | null {
  if (segment.kind === "prompt") {
    const label = collapse(segment.label);
    return {
      key: promptKey(label),
      label,
      implicit: false,
      type: segment.type,
      options: segment.options,
    };
  }
  if (segment.kind !== "variable") return null;
  if (present(values[segment.name]) || segment.fallback !== null) return null;
  const label = placeholderInfo(segment.name)?.promptLabel ?? segment.name;
  return {
    key: implicitKey(segment.name),
    label,
    implicit: true,
    type: "text",
    options: [],
  };
}

function segmentsOf(html: string): Segment[] {
  return textRuns(html).flatMap((run) => parseText(run.text));
}

/**
 * Prompt fields for one apply, explicit and implicit, one per identity over subject and body (spec 5.6), in order
 * of first use, subject first.
 */
export function promptsFor(
  html: string,
  values: RenderInput["values"],
  subject = "",
): PromptField[] {
  const fields = new Map<string, PromptField>();
  for (const segment of [...parseText(subject), ...segmentsOf(html)]) {
    const field = fieldOf(segment, values);
    if (field === null) continue;
    const first = fields.get(field.key) ?? field;
    fields.set(field.key, {
      ...first,
      label: fieldLabel(first.label, field.label),
    });
  }
  return [...fields.values()];
}

/** Plain value of a token in the value order; a field without a value renders as "" (removed, D31). */
function tokenValue(segment: Token, input: RenderInput): string {
  const key =
    segment.kind === "prompt"
      ? promptKey(collapse(segment.label))
      : implicitKey(segment.name);
  const answer = input.answers[key];
  if (present(answer)) return answer;
  if (fieldOf(segment, input.values) !== null) return "";
  const variable = segment as Extract<Segment, { kind: "variable" }>;
  const value = input.values[variable.name];
  return present(value) ? value : (variable.fallback ?? "");
}

/** A piece of one rendered text run; null marks a gap, the place of a token that rendered as "". */
type Part = string | null;

/** Characters right after a gap that drop the space before it (rule 2). */
const CLOSING = ",.;:!?";

/**
 * The 4 gap rules of ADR-0004 Amendment 2026-11-11 on one text run, gaps left to right; "space" is U+0020 only.
 * 1. Space on both sides: drop the space after. 2. Space before and one of `, . ; : ! ?` after: drop the space
 * before. 3. Gap at the start with a space after: drop that space. 4. Gap at the end with a space before: drop it.
 */
export function closeGaps(parts: readonly Part[]): string {
  const rest = [...parts];
  let out = "";
  rest.forEach((part, index) => {
    if (part !== null) {
      out += part;
      return;
    }
    const next = rest.findIndex((p, n) => n > index && p !== null && p !== "");
    const after = next < 0 ? "" : (rest[next] ?? "");
    const spaceBefore = out.endsWith(" ");
    if (after.startsWith(" ") && (spaceBefore || out === ""))
      rest[next] = after.slice(1);
    else if (spaceBefore && (after === "" || CLOSING.includes(after.charAt(0))))
      out = out.slice(0, -1);
  });
  return out;
}

/** One text run as parts: `text` formats literal text, `value` formats a non-empty token value. */
function runParts(
  run: string,
  input: RenderInput,
  format: { text(t: string): string; value(v: string): string },
): Part[] {
  return parseText(run).map((segment) => {
    if (segment.kind === "text") return format.text(segment.text);
    if (segment.kind === "escape") return "{{";
    const value = tokenValue(segment, input);
    return value === "" ? null : format.value(value);
  });
}

const HTML_FORMAT = { text: escapeText, value: formatValue };
const PLAIN_FORMAT = { text: (t: string) => t, value: (v: string) => v };

/**
 * An empty paragraph or heading of the template is a blank row in the editor, but mail clients give an empty block
 * no height. A `<br>` keeps the row. Only rows empty in the template: a row whose field rendered as "" still closes.
 */
export function keepBlankRows(html: string): string {
  return html.replace(/<(p|h[1-6])( [^>]*)?><\/\1>/g, "<$1$2><br></$1>");
}

export function renderBody(html: string, input: RenderInput): Rendered {
  const out = mapTextRuns(html, (text) =>
    closeGaps(runParts(text, input, HTML_FORMAT)),
  );
  return { html: out };
}

/**
 * Subject for the draft (spec 5.6): values as plain text, never HTML-escaped; gaps closed as in the body; every
 * control character becomes one space, runs of spaces collapse, the result is trimmed and cut to `SUBJECT_MAX`.
 * The string goes to Card Service and Gmail as plain text.
 */
export function renderSubject(
  subject: string,
  input: RenderInput,
): { text: string } {
  const raw = closeGaps(runParts(subject, input, PLAIN_FORMAT));
  return { text: capSubject(oneLine(raw)) };
}
