import { parseText } from "./grammar";

/**
 * The skeleton rule of ADR-0004 Amendment 2026-11-12 "braces that join around a field" (Q78, option 1). The
 * skeleton is every run's literal text in order, each escape `\{{` as U+E000, each token removed with the U+0020
 * spaces right before and after it in the same run, all runs joined with nothing between them. A `{{` whose two
 * braces come from different literal segments could show in a draft; a `{{` inside one segment is the leftover
 * pass's and is not returned twice.
 */
export interface TextRun {
  readonly text: string;
  /** Offset of the run's first character in the body text (or the subject). */
  readonly base: number;
}

interface Piece {
  readonly char: string;
  readonly segment: number;
  readonly offset: number;
}

const MARKER = "\uE000";

function skeletonOf(runs: readonly TextRun[]): Piece[] {
  const pieces: Piece[] = [];
  let segment = 0;
  for (const run of runs) {
    const start = pieces.length;
    let afterToken = false;
    for (const part of parseText(run.text, run.base)) {
      segment += 1;
      if (part.kind === "text") {
        const skip = afterToken ? (/^ */.exec(part.text)?.[0].length ?? 0) : 0;
        part.text
          .slice(skip)
          .split("")
          .forEach((char, n) => {
            pieces.push({ char, segment, offset: part.offset + skip + n });
          });
      } else if (part.kind === "escape") {
        pieces.push({ char: MARKER, segment, offset: part.offset });
      } else {
        while (pieces.length > start && pieces.at(-1)?.char === " ")
          pieces.pop();
      }
      afterToken = part.kind === "variable" || part.kind === "prompt";
    }
  }
  return pieces;
}

/** Offsets of the first brace of each `{{` the rule refuses, in text order. */
export function joinedBraces(runs: readonly TextRun[]): number[] {
  const pieces = skeletonOf(runs);
  return pieces.flatMap((piece, index) => {
    const next = pieces[index + 1];
    return piece.char === "{" &&
      next?.char === "{" &&
      next.segment !== piece.segment
      ? [piece.offset]
      : [];
  });
}
