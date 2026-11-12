/**
 * Plain text from stored HTML, for `snippet` and search text. Not a sanitizer: output is text only and
 * never rendered as HTML. The slice 3 sanitizer replaces the input with its canonical output.
 */
export const SNIPPET_LENGTH = 140;

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => {
    return ENTITIES[entity] ?? entity;
  });
}

export function plainTextOf(html: string): string {
  const withoutBlocks = html.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    " ",
  );
  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

export function snippetOf(text: string): string {
  return text.length <= SNIPPET_LENGTH
    ? text
    : `${text.slice(0, SNIPPET_LENGTH - 1)}…`;
}

/** UTF-8 byte count of one code point. */
export function utf8CharBytes(code: number): number {
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) bytes += utf8CharBytes(char.codePointAt(0) ?? 0);
  return bytes;
}
