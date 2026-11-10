import { escapeText, escapeValue, mapTextRuns, textRuns } from "../html/escape";
import { collapse, parseText, promptKey, type Segment } from "./grammar";
import { placeholderInfo } from "./registry";
import { oneLine } from "./subject";

/**
 * Apply semantics (ADR-0004): tokens in sanitized HTML become escaped values. A variable uses its value, else its
 * fallback, else an implicit prompt. Prompts with the same identity share one answer. `\{{` renders as `{{`.
 */
export interface PromptField {
  /** Identity: `promptKey(label)` for explicit prompts, `{var}<name>` for implicit ones (labels cannot hold `{`). */
  readonly key: string;
  /** First spelling, whitespace collapsed. */
  readonly label: string;
  readonly implicit: boolean;
}

export interface RenderInput {
  /** Resolved variable values by name. Missing or blank means unresolved. */
  readonly values: Readonly<Record<string, string>>;
  /** Prompt answers by `PromptField.key`. */
  readonly answers: Readonly<Record<string, string>>;
}

export interface Rendered {
  readonly html: string;
  /** Prompts without a non-blank answer. Apply is blocked while this is not empty. */
  readonly missing: PromptField[];
}

const implicitKey = (name: string): string => `{var}${name}`;

const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== "";

/** Value escaping plus newline to `<br>` (ADR-0004 Apply semantics 5). */
export function formatValue(value: string): string {
  return escapeValue(value).replace(/\r\n|\r|\n/g, "<br>");
}

/** The prompt field a token needs, or null when the token resolves without asking. */
function fieldOf(
  segment: Segment,
  values: RenderInput["values"],
): PromptField | null {
  if (segment.kind === "prompt") {
    const label = collapse(segment.label);
    return { key: promptKey(label), label, implicit: false };
  }
  if (segment.kind !== "variable") return null;
  if (present(values[segment.name]) || segment.fallback !== null) return null;
  const label = placeholderInfo(segment.name)?.promptLabel ?? segment.name;
  return { key: implicitKey(segment.name), label, implicit: true };
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
    if (field !== null && !fields.has(field.key)) fields.set(field.key, field);
  }
  return [...fields.values()];
}

/** Plain value of a token segment; a missing answer goes to `missing` and renders as "". */
function tokenValue(
  segment: Exclude<Segment, { kind: "text" | "escape" }>,
  input: RenderInput,
  missing: Map<string, PromptField>,
): string {
  const field = fieldOf(segment, input.values);
  if (field === null) {
    const variable = segment as Extract<Segment, { kind: "variable" }>;
    const value = input.values[variable.name];
    return present(value) ? value : (variable.fallback ?? "");
  }
  const answer = input.answers[field.key];
  if (present(answer)) return answer;
  missing.set(field.key, field);
  return "";
}

function renderSegment(
  segment: Segment,
  input: RenderInput,
  missing: Map<string, PromptField>,
): string {
  if (segment.kind === "text") return escapeText(segment.text);
  if (segment.kind === "escape") return "{{";
  return formatValue(tokenValue(segment, input, missing));
}

export function renderBody(html: string, input: RenderInput): Rendered {
  const missing = new Map<string, PromptField>();
  const out = mapTextRuns(html, (text) =>
    parseText(text)
      .map((segment) => renderSegment(segment, input, missing))
      .join(""),
  );
  return { html: out, missing: [...missing.values()] };
}

/**
 * Subject for the draft (spec 5.6): values as plain text, never HTML-escaped; every control character becomes one
 * space, runs of spaces collapse, the result is trimmed. The string goes to Card Service as plain text.
 */
export function renderSubject(
  subject: string,
  input: RenderInput,
): { text: string; missing: PromptField[] } {
  const missing = new Map<string, PromptField>();
  const raw = parseText(subject)
    .map((segment) => {
      if (segment.kind === "text") return segment.text;
      if (segment.kind === "escape") return "{{";
      return tokenValue(segment, input, missing);
    })
    .join("");
  return { text: oneLine(raw), missing: [...missing.values()] };
}
