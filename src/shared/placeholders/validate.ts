import { textRuns } from "../html/escape";
import { closest } from "./distance";
import {
  FALLBACK_MAX,
  LABEL_MAX,
  collapse,
  parseText,
  promptKey,
  type Segment,
} from "./grammar";
import { PLACEHOLDER_NAMES, isKnownName } from "./registry";

/**
 * Save-time placeholder validation (ADR-0004 table). Runs on sanitized HTML. Offsets count characters of the
 * body text (decoded text nodes joined), from 0; messages show them from 1.
 */
export type ProblemCode =
  | "PH_UNKNOWN"
  | "PH_CASE"
  | "PH_MALFORMED"
  | "PH_LABEL"
  | "PH_FALLBACK_ASK"
  | "PH_ATTR"
  | "PH_TOO_MANY"
  /** Editor only: a `\` typed right before a chip would turn the token into the `\{{` escape. */
  | "PH_BACKSLASH";

export interface Problem {
  readonly code: ProblemCode;
  readonly message: string;
  /** Character offset in the body text, or null when the problem has no text position. */
  readonly offset: number | null;
}

export interface Warning {
  readonly code: "PH_NO_FALLBACK";
  readonly message: string;
  readonly offset: number;
}

/** An attribute value that contains `{{`, reported by the sanitizer. */
export interface AttrToken {
  readonly tag: string;
  readonly attr: string;
}

export interface Scan {
  /** Distinct registry names, in order of first use. */
  readonly placeholders: string[];
  /** Distinct prompt labels (first spelling, whitespace collapsed), in order of first use. */
  readonly prompts: string[];
  readonly problems: Problem[];
  readonly warnings: Warning[];
}

export const PROMPTS_MAX = 20;
const DID_YOU_MEAN_DISTANCE = 2;
const LENIENT = /\{\{([^}]*)\}\}?/y;
const ANY_CASE_NAME = /^[a-z][a-z_]*\.[a-z][a-z_]*$/i;
const LABEL_RULE = `Prompt label must be 1 to ${String(LABEL_MAX)} characters, without { } | \\ < >`;

const at = (offset: number): string => `at character ${String(offset + 1)}`;

function unknownName(name: string, offset: number): Problem {
  const hint = closest(name, PLACEHOLDER_NAMES, DID_YOU_MEAN_DISTANCE);
  const suffix = hint === null ? "" : ` Did you mean ${hint}?`;
  return {
    code: "PH_UNKNOWN",
    message: `Unknown placeholder ${name} ${at(offset)}.${suffix}`,
    offset,
  };
}

function classifyClosed(inner: string, offset: number): Problem {
  const body = inner.trim();
  if (/^ask *:/i.test(body)) {
    if (!/^ask *:/.test(body))
      return {
        code: "PH_CASE",
        message: `Use lower case: ask: ${at(offset)}`,
        offset,
      };
    if (body.includes("|"))
      return {
        code: "PH_FALLBACK_ASK",
        message: `Prompts take no fallback in v1 (${at(offset)})`,
        offset,
      };
    return {
      code: "PH_LABEL",
      message: `${LABEL_RULE} (${at(offset)})`,
      offset,
    };
  }
  const [rawName = "", ...rest] = body.split("|");
  const name = rawName.trim();
  if (ANY_CASE_NAME.test(name) && name !== name.toLowerCase())
    return {
      code: "PH_CASE",
      message: `Use lower case: ${name.toLowerCase()} (${at(offset)})`,
      offset,
    };
  if (ANY_CASE_NAME.test(name) && rest.join("|").trim().length > FALLBACK_MAX)
    return {
      code: "PH_MALFORMED",
      message: `Fallback must be at most ${String(FALLBACK_MAX)} characters, without { } \\ < > (${at(offset)})`,
      offset,
    };
  return {
    code: "PH_MALFORMED",
    message: `Placeholder ${at(offset)} is not valid`,
    offset,
  };
}

/** Second, lenient pass (ADR-0004): every `{{` left in literal text is an error. */
function leftoverProblems(text: string, base: number): Problem[] {
  const problems: Problem[] = [];
  let from = text.indexOf("{{");
  while (from !== -1) {
    LENIENT.lastIndex = from;
    const match = LENIENT.exec(text);
    const offset = base + from;
    const closed = match?.[0].endsWith("}}") === true;
    problems.push(
      match !== null && closed
        ? classifyClosed(match[1] ?? "", offset)
        : {
            code: "PH_MALFORMED",
            message: `Placeholder ${at(offset)} is not closed`,
            offset,
          },
    );
    from = text.indexOf("{{", from + (match?.[0].length ?? 2));
  }
  return problems;
}

interface Collector {
  readonly names: Set<string>;
  readonly prompts: Map<string, string>;
  readonly problems: Problem[];
  readonly warnings: Warning[];
}

function visit(segment: Segment, into: Collector): void {
  if (segment.kind === "text") {
    into.problems.push(...leftoverProblems(segment.text, segment.offset));
  } else if (segment.kind === "variable") {
    visitVariable(segment, into);
  } else if (segment.kind === "prompt") {
    const label = collapse(segment.label);
    if (label.length < 1 || label.length > LABEL_MAX)
      into.problems.push({
        code: "PH_LABEL",
        message: `${LABEL_RULE} (${at(segment.offset)})`,
        offset: segment.offset,
      });
    else if (!into.prompts.has(promptKey(label)))
      into.prompts.set(promptKey(label), label);
  }
}

function visitVariable(
  segment: Extract<Segment, { kind: "variable" }>,
  into: Collector,
): void {
  if (!isKnownName(segment.name)) {
    into.problems.push(unknownName(segment.name, segment.offset));
    return;
  }
  into.names.add(segment.name);
  if (segment.name === "recipient.first_name" && segment.fallback === null)
    into.warnings.push({
      code: "PH_NO_FALLBACK",
      message: `recipient.first_name has no fallback (${at(segment.offset)}); users will be asked for it`,
      offset: segment.offset,
    });
}

function attrProblem(token: AttrToken): Problem {
  return {
    code: "PH_ATTR",
    message: `Placeholders work in text only (${token.attr} of ${token.tag})`,
    offset: null,
  };
}

/** Parses every text node of sanitized HTML and applies the ADR-0004 rules. */
export function scanBody(
  html: string,
  attrTokens: readonly AttrToken[] = [],
): Scan {
  const into: Collector = {
    names: new Set(),
    prompts: new Map(),
    problems: [],
    warnings: [],
  };
  let base = 0;
  for (const run of textRuns(html)) {
    for (const segment of parseText(run.text, base)) visit(segment, into);
    base += run.text.length;
  }
  into.problems.push(...attrTokens.map(attrProblem));
  if (into.prompts.size > PROMPTS_MAX)
    into.problems.push({
      code: "PH_TOO_MANY",
      message: `At most ${String(PROMPTS_MAX)} prompts per template (found ${String(into.prompts.size)})`,
      offset: null,
    });
  return {
    placeholders: [...into.names],
    prompts: [...into.prompts.values()],
    problems: into.problems,
    warnings: into.warnings,
  };
}
