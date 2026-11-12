import { textRuns } from "../html/escape";
import { closest } from "./distance";
import {
  FALLBACK_MAX,
  LABEL_MAX,
  collapse,
  parseText,
  promptKey,
  type PromptType,
  type Segment,
} from "./grammar";
import { invalidChoiceText, optionsProblem } from "./choice";
import { PLACEHOLDER_NAMES, isKnownName } from "./registry";
import { joinedBraces, type TextRun } from "./skeleton";
import { SUBJECT_MAX, controlIndex } from "./subject";

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
  /** One prompt identity used in two kinds: text, date, choice (spec 5.9, 5.10). */
  | "PH_FIELD_TYPE"
  /** A choice token breaks an option rule (spec 5.10). */
  | "PH_CHOICE"
  /** One choice label with two different option lists (spec 5.10). */
  | "PH_CHOICE_MISMATCH"
  /** Editor only: a `\` typed right before a chip would turn the token into the `\{{` escape. */
  | "PH_BACKSLASH"
  /** Subject only (spec 5.6). */
  | "SUBJ_TOO_LONG"
  | "SUBJ_LINEBREAK";

/** Problems and warnings in the subject carry `field: "subject"`; body ones carry no field. */
export type Field = "subject";

export interface Problem {
  readonly code: ProblemCode;
  readonly message: string;
  /** Character offset in the body text (or the subject), or null when the problem has no text position. */
  readonly offset: number | null;
  readonly field?: Field;
}

export interface Warning {
  readonly code: "PH_NO_FALLBACK";
  readonly message: string;
  readonly offset: number;
  readonly field?: Field;
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
const LABEL_RULE = `A field name must be 1 to ${String(LABEL_MAX)} characters, without { } | \\ < >`;

const at = (offset: number): string => `at character ${String(offset + 1)}`;

function unknownName(name: string, offset: number): Problem {
  const hint = closest(name, PLACEHOLDER_NAMES, DID_YOU_MEAN_DISTANCE);
  const suffix = hint === null ? "" : ` Did you mean ${hint}?`;
  return {
    code: "PH_UNKNOWN",
    message: `Unknown field ${name} ${at(offset)}.${suffix}`,
    offset,
  };
}

/** A closed `{{choice:...}}` the strict regex did not take (lenient pass). */
function choiceLeftover(body: string, offset: number): Problem {
  if (!/^choice *:/.test(body))
    return {
      code: "PH_CASE",
      message: `Use lower case: choice: (${at(offset)}).`,
      offset,
    };
  const [head = "", ...options] = body.slice(body.indexOf(":") + 1).split("|");
  const label = collapse(head);
  if (
    options.length > 0 &&
    (label.length < 1 || label.length > LABEL_MAX || /[{}\\<>]/.test(label))
  )
    return {
      code: "PH_LABEL",
      message: `${LABEL_RULE} (${at(offset)}).`,
      offset,
    };
  return { code: "PH_CHOICE", message: invalidChoiceText(at(offset)), offset };
}

function classifyClosed(inner: string, offset: number): Problem {
  const body = inner.trim();
  if (/^choice *:/i.test(body)) return choiceLeftover(body, offset);
  const kind = /^(ask|date) *:/i.exec(body)?.[1];
  if (kind !== undefined) {
    if (kind !== kind.toLowerCase())
      return {
        code: "PH_CASE",
        message: `Use lower case: ${kind.toLowerCase()}: (${at(offset)}).`,
        offset,
      };
    if (body.includes("|"))
      return {
        code: "PH_FALLBACK_ASK",
        message: `A field the sender fills in cannot have default text (${at(offset)}).`,
        offset,
      };
    return {
      code: "PH_LABEL",
      message: `${LABEL_RULE} (${at(offset)}).`,
      offset,
    };
  }
  const [rawName = "", ...rest] = body.split("|");
  const name = rawName.trim();
  if (ANY_CASE_NAME.test(name) && name !== name.toLowerCase())
    return {
      code: "PH_CASE",
      message: `Use lower case: ${name.toLowerCase()} (${at(offset)}).`,
      offset,
    };
  if (ANY_CASE_NAME.test(name) && rest.join("|").trim().length > FALLBACK_MAX)
    return {
      code: "PH_MALFORMED",
      message: `The default text must be at most ${String(FALLBACK_MAX)} characters, without { } \\ < > (${at(offset)}).`,
      offset,
    };
  return {
    code: "PH_MALFORMED",
    message: `The field ${at(offset)} is not valid. Delete it and use Insert field.`,
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
    // A `}` inside a choice's options cuts the lenient match short; the token still closes later (spec 5.10).
    const choiceBrace =
      /^ *choice *:/i.test(match?.[1] ?? "") && text.includes("}}", from);
    const closed = match?.[0].endsWith("}}") === true || choiceBrace;
    problems.push(
      match !== null && closed
        ? classifyClosed(match[1] ?? "", offset)
        : {
            code: "PH_MALFORMED",
            message: `The field ${at(offset)} is not closed. Add }} after it.`,
            offset,
          },
    );
    from = text.indexOf("{{", from + (match?.[0].length ?? 2));
  }
  return problems;
}

interface FirstUse {
  readonly label: string;
  readonly type: PromptType;
  readonly options: readonly string[];
}

const KIND_WORD: Readonly<Record<PromptType, string>> = {
  text: "text",
  date: "a date",
  choice: "a choice",
};

/** `PH_FIELD_TYPE` or `PH_CHOICE_MISMATCH` for a later token of a known identity, or null when it matches. */
function sameIdentity(
  first: FirstUse,
  segment: Extract<Segment, { kind: "prompt" }>,
): Problem | null {
  const offset = segment.offset;
  if (first.type !== segment.type)
    return {
      code: "PH_FIELD_TYPE",
      message: `The field "${first.label}" is used as ${KIND_WORD[first.type]} and as ${KIND_WORD[segment.type]} (${at(offset)}). Rename one of them.`,
      offset,
    };
  if (first.options.join("|") !== segment.options.join("|"))
    return {
      code: "PH_CHOICE_MISMATCH",
      message: `The field "${first.label}" lists other options ${at(offset)}. Use the same options, or rename one of them.`,
      offset,
    };
  return null;
}

interface Collector {
  readonly names: Set<string>;
  /** First spelling, type and options per prompt identity. */
  readonly prompts: Map<string, FirstUse>;
  readonly problems: Problem[];
  readonly warnings: Warning[];
}

function visit(segment: Segment, into: Collector): void {
  if (segment.kind === "text") {
    into.problems.push(...leftoverProblems(segment.text, segment.offset));
  } else if (segment.kind === "variable") {
    visitVariable(segment, into);
  } else if (segment.kind === "prompt") {
    visitPrompt(segment, into);
  }
}

function visitPrompt(
  segment: Extract<Segment, { kind: "prompt" }>,
  into: Collector,
): void {
  const label = collapse(segment.label);
  if (label.length < 1 || label.length > LABEL_MAX) {
    into.problems.push({
      code: "PH_LABEL",
      message: `${LABEL_RULE} (${at(segment.offset)}).`,
      offset: segment.offset,
    });
    return;
  }
  const choice =
    segment.type === "choice"
      ? optionsProblem(
          label,
          segment.options,
          segment.raw.length,
          at(segment.offset),
        )
      : null;
  if (choice !== null) {
    into.problems.push({
      code: "PH_CHOICE",
      message: choice,
      offset: segment.offset,
    });
    return;
  }
  const first = into.prompts.get(promptKey(label));
  const { type, options } = segment;
  if (first === undefined)
    into.prompts.set(promptKey(label), { label, type, options });
  else {
    const problem = sameIdentity(first, segment);
    if (problem !== null) into.problems.push(problem);
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
      message: `Recipient first name has no default text (${at(segment.offset)}). The sender is asked for it when it is unknown.`,
      offset: segment.offset,
    });
}

function attrProblem(token: AttrToken): Problem {
  return {
    code: "PH_ATTR",
    message: `Fields work in text only, not inside a link or image address (${token.attr} of ${token.tag}).`,
    offset: null,
  };
}

/** Spec 5.6: length after trim and control characters. The caller passes the trimmed subject. */
function subjectRules(subject: string): Problem[] {
  const problems: Problem[] = [];
  if (subject.length > SUBJECT_MAX)
    problems.push({
      code: "SUBJ_TOO_LONG",
      message: `The subject must be ${String(SUBJECT_MAX)} characters or fewer.`,
      offset: SUBJECT_MAX,
    });
  const control = controlIndex(subject);
  if (control !== -1)
    problems.push({
      code: "SUBJ_LINEBREAK",
      message: `The subject must be one line (${at(control)}).`,
      offset: control,
    });
  return problems;
}

/** The subject as one text run. Names and prompts join the body's, so one label is asked once (spec 5.6). */
/** Q78 skeleton rule: braces that would join into `{{` once the fields between them are removed. */
function braceProblems(runs: readonly TextRun[]): Problem[] {
  return joinedBraces(runs).map((offset) => ({
    code: "PH_MALFORMED",
    message: `The braces ${at(offset)} would show as {{ in the email. Delete one of them.`,
    offset,
  }));
}

function scanSubject(subject: string, into: Collector): void {
  const own: Collector = { ...into, problems: [], warnings: [] };
  for (const segment of parseText(subject)) visit(segment, own);
  const field: Field = "subject";
  const braces = braceProblems([{ text: subject, base: 0 }]);
  into.problems.push(
    ...[...subjectRules(subject), ...own.problems, ...braces].map((p) => ({
      ...p,
      field,
    })),
  );
  into.warnings.push(...own.warnings.map((w) => ({ ...w, field })));
}

/**
 * Parses the subject, then every text node of sanitized HTML, and applies the ADR-0004 rules. Names and prompts
 * are in order of first use, subject first; `PH_TOO_MANY` counts distinct prompts over both.
 */
export function scanBody(
  html: string,
  attrTokens: readonly AttrToken[] = [],
  subject = "",
): Scan {
  const into: Collector = {
    names: new Set(),
    prompts: new Map(),
    problems: [],
    warnings: [],
  };
  scanSubject(subject, into);
  const runs: TextRun[] = [];
  let base = 0;
  for (const run of textRuns(html)) {
    for (const segment of parseText(run.text, base)) visit(segment, into);
    runs.push({ text: run.text, base });
    base += run.text.length;
  }
  into.problems.push(...braceProblems(runs), ...attrTokens.map(attrProblem));
  if (into.prompts.size > PROMPTS_MAX)
    into.problems.push({
      code: "PH_TOO_MANY",
      message: `A template can ask the sender for at most ${String(PROMPTS_MAX)} fields (found ${String(into.prompts.size)}).`,
      offset: null,
    });
  return {
    placeholders: [...into.names],
    prompts: [...into.prompts.values()].map((prompt) => prompt.label),
    problems: into.problems,
    warnings: into.warnings,
  };
}
