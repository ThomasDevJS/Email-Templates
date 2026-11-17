import { collapse, parseText, type Segment } from "./grammar";
import { placeholderInfo } from "./registry";
import { oneLine } from "./subject";

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

/** Subject with tokens as [Label], on one line (wireframe 02). Output is text, never HTML. */
export function subjectPreview(subject: string): string {
  return oneLine(parseText(subject).map(segmentText).join(""));
}
