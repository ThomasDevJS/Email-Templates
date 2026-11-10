/**
 * Template subject (spec 5.6, ADR-0004 Amendment 2026-11-10 subject): one plain-text line, 0 to 200 characters
 * after trim, the body's token grammar on one text run. Rendered values are plain text, never HTML-escaped.
 */
export const SUBJECT_MAX = 200;

/** CR, LF, tab and the other C0 controls, DEL, and the Unicode line and paragraph separators. */
export function isControlChar(code: number): boolean {
  return code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029;
}

/** Offset of the first control character, or -1. */
export function controlIndex(text: string): number {
  for (let i = 0; i < text.length; i += 1)
    if (isControlChar(text.charCodeAt(i))) return i;
  return -1;
}

/** Every control character becomes one space, runs of spaces collapse, the result is trimmed. */
export function oneLine(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1)
    out += isControlChar(text.charCodeAt(i)) ? " " : text.charAt(i);
  return out.replace(/ {2,}/g, " ").trim();
}
