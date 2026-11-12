/**
 * Token grammar of ADR-0004, applied to one decoded HTML text node. The regex is the ADR's, character for
 * character: group 1 prompt kind, group 2 prompt label, group 3 variable name, group 4 fallback; a bare `\{{` is an
 * escape.
 */
export const TOKEN_PATTERN =
  /\\\{\{|\{\{ *(?:(ask|date): *([^{}|\\<>\r\n]{1,40}?)|([a-z][a-z_]*\.[a-z][a-z_]*)(?: *\|([^{}\\<>\r\n]{0,80}?))?) *\}\}/g;

export const LABEL_MAX = 40;
export const FALLBACK_MAX = 80;

/** What a prompt asks for: free text (`ask:`) or a date picked in a calendar (`date:`, spec 5.9). */
export type PromptType = "text" | "date";

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
      readonly raw: string;
      readonly offset: number;
    };

function tokenSegment(match: RegExpExecArray, offset: number): Segment {
  const [raw, type, label, name, fallback] = match;
  if (raw === "\\{{") return { kind: "escape", offset };
  if (label !== undefined)
    return {
      kind: "prompt",
      label: label.trim(),
      type: type === "date" ? "date" : "text",
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

/** Prompt identity (ADR-0004 Apply semantics 1): trimmed, inner whitespace collapsed, case-insensitive. */
export function promptKey(label: string): string {
  return collapse(label).toLowerCase();
}

export function collapse(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}
