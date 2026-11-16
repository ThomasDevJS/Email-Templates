/**
 * Token grammar of ADR-0004, applied to one decoded HTML text node. The regex is the ADR's, character for
 * character: group 1 kind of `ask`/`date`, group 2 its label, group 3 choice label, group 4 choice options text,
 * group 5 variable name, group 6 fallback; a bare `\{{` is an escape.
 */
export const TOKEN_PATTERN =
  /\\\{\{|\{\{ *(?:(ask|date): *([^{}|\\<>\r\n]{1,40}?)|choice: *([^{}|\\<>\r\n]{1,40}?) *\|([^{}\\<>\r\n]*?)|([a-z][a-z_]*\.[a-z][a-z_]*)(?: *\|([^{}\\<>\r\n]{0,80}?))?) *\}\}/g;

export const LABEL_MAX = 40;
export const FALLBACK_MAX = 80;

/**
 * What a prompt asks for: free text (`ask:`), a date picked in a calendar (`date:`, spec 5.9), or one of the
 * template's options (`choice:`, spec 5.10).
 */
export type PromptType = "text" | "date" | "choice";

export type Segment =
  | { readonly kind: "text"; readonly text: string; readonly offset: number }
  | { readonly kind: "escape"; readonly offset: number }
  | {
      readonly kind: "variable";
      readonly name: string;
      /** Trimmed fallback, or null when the token has no `|`. */
      readonly fallback: string | null;
      readonly raw: string;
      readonly offset: number;
    }
  | {
      readonly kind: "prompt";
      /** Label as written, trimmed. May be empty (a validation error). */
      readonly label: string;
      readonly type: PromptType;
      /** A choice's options as written, each trimmed and collapsed, empty ones kept for the save check; else []. */
      readonly options: readonly string[];
      readonly raw: string;
      readonly offset: number;
    };

function tokenSegment(match: RegExpExecArray, offset: number): Segment {
  const [raw, type, label, choice, options, name, fallback] = match;
  if (raw === "\\{{") return { kind: "escape", offset };
  if (label !== undefined)
    return {
      kind: "prompt",
      label: label.trim(),
      type: type === "date" ? "date" : "text",
      options: [],
      raw,
      offset,
    };
  if (choice !== undefined)
    return {
      kind: "prompt",
      label: choice.trim(),
      type: "choice",
      options: (options ?? "").split("|").map(collapse),
      raw,
      offset,
    };
  return {
    kind: "variable",
    name: name ?? "",
    fallback: fallback === undefined ? null : fallback.trim(),
    raw,
    offset,
  };
}

/** Splits one text node into literal text, escapes and tokens. `base` is the node's offset in the body text. */
export function parseText(text: string, base = 0): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index > cursor)
      segments.push({
        kind: "text",
        text: text.slice(cursor, match.index),
        offset: base + cursor,
      });
    segments.push(tokenSegment(match, base + match.index));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length)
    segments.push({
      kind: "text",
      text: text.slice(cursor),
      offset: base + cursor,
    });
  return segments;
}

/** Token text for a variable or prompt, in the canonical spelling the editor writes. */
export function variableToken(name: string, fallback: string | null): string {
  return fallback === null ? `{{${name}}}` : `{{${name}|${fallback}}}`;
}

export function promptToken(label: string): string {
  return `{{ask:${label}}}`;
}

export function dateToken(label: string): string {
  return `{{date:${label}}}`;
}

export function choiceToken(label: string, options: readonly string[]): string {
  return `{{choice:${label}|${options.join("|")}}}`;
}

/** Prompt identity (ADR-0004 Apply semantics 1): trimmed, inner whitespace collapsed, case-insensitive. */
export function promptKey(label: string): string {
  return collapse(label).toLowerCase();
}

/** A prompt whose label ends with `*` is required: no insert while it is blank (spec 5.11). */
export function requiredLabel(label: string): boolean {
  return label.endsWith("*");
}

export function collapse(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}
