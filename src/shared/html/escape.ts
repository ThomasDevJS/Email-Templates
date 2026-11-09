/**
 * Canonical HTML text and attribute escaping, shared by the sanitizer, the placeholder scanner and the editor
 * serializer. Canonical text escapes `& < >`; canonical attribute values escape `& " < >` and are double-quoted.
 * Because `<` and `>` never appear raw inside canonical attribute values, `<[^>]*>` finds every tag.
 */

const TEXT_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const ATTR_ESCAPES: Readonly<Record<string, string>> = {
  ...TEXT_ESCAPES,
  '"': "&quot;",
};

const DECODES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
};

export function escapeText(text: string): string {
  return text.replace(/[&<>]/g, (char) => TEXT_ESCAPES[char] ?? char);
}

export function escapeAttr(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ATTR_ESCAPES[char] ?? char);
}

/** Value escaping for rendered placeholder values (ADR-0004 Apply semantics 5): `& < > " '`. */
export function escapeValue(value: string): string {
  return escapeAttr(value).replace(/'/g, "&#39;");
}

/** Inverse of `escapeText` and `escapeAttr` on canonical output. */
export function decodeCanonical(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot);/g, (entity) => {
    return DECODES[entity] ?? entity;
  });
}

/** One text run of canonical HTML: source span and decoded text. */
export interface TextRun {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Text between tags of canonical (sanitized) HTML, decoded. Empty runs are skipped. */
export function textRuns(html: string): TextRun[] {
  const runs: TextRun[] = [];
  let cursor = 0;
  const push = (end: number) => {
    if (end > cursor)
      runs.push({
        start: cursor,
        end,
        text: decodeCanonical(html.slice(cursor, end)),
      });
  };
  for (const tag of html.matchAll(/<[^>]*>/g)) {
    push(tag.index);
    cursor = tag.index + tag[0].length;
  }
  push(html.length);
  return runs;
}

/** Rebuilds canonical HTML with every text run replaced by `rewrite(decodedText)` (already escaped HTML). */
export function mapTextRuns(
  html: string,
  rewrite: (text: string) => string,
): string {
  let out = "";
  let cursor = 0;
  for (const run of textRuns(html)) {
    out += html.slice(cursor, run.start) + rewrite(run.text);
    cursor = run.end;
  }
  return out + html.slice(cursor);
}
