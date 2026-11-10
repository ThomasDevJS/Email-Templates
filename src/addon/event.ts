import {
  DRAFT_COUNT_MAX,
  DRAFT_FIELDS,
  type DraftField,
  type DraftInfo,
} from "../shared/model/protocol";
import { domainOf } from "../shared/permissions/principals";

/**
 * The parts of the Gmail add-on event object this add-on reads (developers.google.com/workspace/add-ons/concepts/
 * event-objects): action parameters, text inputs, and the draft's To recipients (`draftAccess: METADATA`).
 */
export interface AddonEvent {
  readonly parameters?: Readonly<Record<string, string>>;
  readonly formInput?: Readonly<Record<string, string>>;
  readonly commonEventObject?: {
    readonly parameters?: Readonly<Record<string, string>>;
    readonly formInputs?: Readonly<
      Record<string, { readonly stringInputs?: { readonly value?: string[] } }>
    >;
  };
  readonly draftMetadata?: {
    readonly toRecipients?: readonly string[];
    readonly [field: string]: unknown;
  };
  /** Gmail fields of the event (recipients, subject); read by `draftInfo` and `draftHasSubject`. */
  readonly gmail?: Readonly<Record<string, unknown>>;
}

function sourcesOf(event: AddonEvent | undefined) {
  return [event?.gmail, event?.draftMetadata].filter(
    (source) => source !== undefined,
  );
}

/**
 * D24, the only place that decides it: the draft has a subject when the event's `subject` is a string with a
 * non-space character. A missing or non-string value counts as no subject (the behavior of build 32a446c).
 */
export function draftHasSubject(event: AddonEvent | undefined): boolean {
  return sourcesOf(event).some((source) => {
    const subject = source["subject"];
    return typeof subject === "string" && subject.trim() !== "";
  });
}

function presentValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/**
 * Draft diagnostics: which `DRAFT_FIELDS` the event carries in `gmail` or `draftMetadata`, the To, Cc and Bcc
 * counts, and `hasSubject` (D24). Names, numbers and one boolean: no value leaves the add-on.
 */
export function draftInfo(event: AddonEvent | undefined): DraftInfo {
  const sources = sourcesOf(event);
  const has = (name: DraftField) =>
    name === "draftMetadata"
      ? event?.draftMetadata !== undefined
      : sources.some((source) => presentValue(source[name]));
  const count = (name: DraftField) =>
    Math.min(
      DRAFT_COUNT_MAX,
      Math.max(
        0,
        ...sources.map((source) => {
          const list = source[name];
          return Array.isArray(list) ? list.length : 0;
        }),
      ),
    );
  return {
    fields: DRAFT_FIELDS.filter(has),
    to: count("toRecipients"),
    cc: count("ccRecipients"),
    bcc: count("bccRecipients"),
    hasSubject: draftHasSubject(event),
  };
}

export function paramsOf(
  event: AddonEvent | undefined,
): Record<string, string> {
  return { ...(event?.commonEventObject?.parameters ?? event?.parameters) };
}

export function formValue(event: AddonEvent | undefined, name: string): string {
  const common =
    event?.commonEventObject?.formInputs?.[name]?.stringInputs?.value?.[0];
  return common ?? event?.formInput?.[name] ?? "";
}

/**
 * The one To recipient when it is in the caller's own domain (ADR-0004 Apply semantics 2). Zero or several
 * recipients, or an external address, give "": external addresses never leave the add-on.
 */
export function internalRecipient(
  event: AddonEvent | undefined,
  userEmail: string,
): string {
  const to = event?.draftMetadata?.toRecipients ?? [];
  const [only] = to;
  if (to.length !== 1 || only === undefined) return "";
  const domain = domainOf(userEmail);
  return domain !== "" && domainOf(only) === domain
    ? only.trim().toLowerCase()
    : "";
}
