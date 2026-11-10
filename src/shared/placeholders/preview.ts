import { decodeCanonical } from "../html/escape";
import { collapse, parseText, type Segment } from "./grammar";
import { placeholderInfo } from "./registry";
import { oneLine } from "./subject";

/**
 * Plain-text preview of a sanitized body for the sidebar (wireframe 01): block tags become line breaks, tokens
 * become `[Label]`, at most `max` characters. Output is text, never HTML.
 */
export const PREVIEW_CHARS = 600;

const BLOCK_TAG =
  /^<\/?(?:p|div|br|li|ul|ol|h[1-4]|tr|table|blockquote|hr|pre)\b/i;

function segmentText(segment: Segment): string {
  switch (segment.kind) {
    case "text":
      return segment.text;
    case "escape":
      return "{{";
    case "prompt":
      return `[${collapse(segment.label)}]`;
    case "variable":
      return `[${placeholderInfo(segment.name)?.label ?? segment.name}]`;
  }
}

function runText(html: string): string {
  return parseText(decodeCanonical(html)).map(segmentText).join("");
}

/** Text with one line per block; inline tags vanish. */
function linesOf(html: string): string {
  let out = "";
  let cursor = 0;
  for (const tag of html.matchAll(/<[^>]*>/g)) {
    out += runText(html.slice(cursor, tag.index));
    if (BLOCK_TAG.test(tag[0])) out += "\n";
    cursor = tag.index + tag[0].length;
  }
  return out + runText(html.slice(cursor));
}

export function previewText(html: string, max = PREVIEW_CHARS): string {
  const text = linesOf(html)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Subject with tokens as [Label], on one line (wireframe 02). Output is text, never HTML. */
export function subjectPreview(subject: string): string {
  return oneLine(parseText(subject).map(segmentText).join(""));
}
