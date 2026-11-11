import { escapeText, escapeValue, mapTextRuns, textRuns } from "../html/escape";
import { collapse, parseText, promptKey, type Segment } from "./grammar";
import { placeholderInfo } from "./registry";
import { oneLine } from "./subject";

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
}

export interface RenderInput {
  /** Resolved variable values by name. Missing or blank means unresolved. */
  readonly values: Readonly<Record<string, string>>;
  /** Prompt answers by `PromptField.key`. A non-blank answer wins over a variable's value. */
  readonly answers: Readonly<Record<string, string>>;
}

export interface Rendered {
  readonly html: string;
  /** Fields without a value: removed from the text (D31). */
  readonly missing: PromptField[];
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

/** Plain value of a token in the value order; a field without a value goes to `missing` and renders as "". */
function tokenValue(
  segment: Token,
  input: RenderInput,
  missing: Map<string, PromptField>,
): string {
  const key =
    segment.kind === "prompt"
      ? promptKey(collapse(segment.label))
      : implicitKey(segment.name);
  const answer = input.answers[key];
  if (present(answer)) return answer;
  const field = fieldOf(segment, input.values);
  if (field !== null) {
    missing.set(field.key, field);
    return "";
  }
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
  missing: Map<string, PromptField>,
  format: { text(t: string): string; value(v: string): string },
): Part[] {
  return parseText(run).map((segment) => {
    if (segment.kind === "text") return format.text(segment.text);
    if (segment.kind === "escape") return "{{";
    const value = tokenValue(segment, input, missing);
    return value === "" ? null : format.value(value);
  });
}

const HTML_FORMAT = { text: escapeText, value: formatValue };
const PLAIN_FORMAT = { text: (t: string) => t, value: (v: string) => v };

export function renderBody(html: string, input: RenderInput): Rendered {
  const missing = new Map<string, PromptField>();
  const out = mapTextRuns(html, (text) =>
    closeGaps(runParts(text, input, missing, HTML_FORMAT)),
  );
  return { html: out, missing: [...missing.values()] };
}

/**
 * Subject for the draft (spec 5.6): values as plain text, never HTML-escaped; gaps closed as in the body; every
 * control character becomes one space, runs of spaces collapse, the result is trimmed. The string goes to Card
 * Service as plain text.
 */
export function renderSubject(
  subject: string,
  input: RenderInput,
): { text: string; missing: PromptField[] } {
  const missing = new Map<string, PromptField>();
  const raw = closeGaps(runParts(subject, input, missing, PLAIN_FORMAT));
  return { text: oneLine(raw), missing: [...missing.values()] };
}
