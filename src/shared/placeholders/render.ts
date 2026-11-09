import { escapeText, escapeValue, mapTextRuns, textRuns } from "../html/escape";
import { collapse, parseText, promptKey, type Segment } from "./grammar";
import { placeholderInfo } from "./registry";

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

/** Prompt fields for one apply, explicit and implicit, one per identity, in order of first use. */
export function promptsFor(
  html: string,
  values: RenderInput["values"],
): PromptField[] {
  const fields = new Map<string, PromptField>();
  for (const segment of segmentsOf(html)) {
    const field = fieldOf(segment, values);
    if (field !== null && !fields.has(field.key)) fields.set(field.key, field);
  }
  return [...fields.values()];
}

function renderSegment(
  segment: Segment,
  input: RenderInput,
  missing: Map<string, PromptField>,
): string {
  if (segment.kind === "text") return escapeText(segment.text);
  if (segment.kind === "escape") return "{{";
  const field = fieldOf(segment, input.values);
  if (field === null) {
    const variable = segment as Extract<Segment, { kind: "variable" }>;
    const value = input.values[variable.name];
    return formatValue(present(value) ? value : (variable.fallback ?? ""));
  }
  const answer = input.answers[field.key];
  if (present(answer)) return formatValue(answer);
  missing.set(field.key, field);
  return "";
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
