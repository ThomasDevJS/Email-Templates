import {
  DRAFT_COUNT_MAX,
  DRAFT_FIELDS,
  type DraftField,
  type DraftInfo,
} from "../shared/model/protocol";
import type { Recipients } from "../shared/model/recipients";
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
  /** Gmail fields of the event (recipients, subject, `messageId`, `accessToken`). */
  readonly gmail?: Readonly<Record<string, unknown>>;
  /** Deprecated twin of `gmail` (`messageId`, `accessToken`); side-panel events carry the key (spike S6 runs). */
  readonly messageMetadata?: Readonly<Record<string, unknown>>;
}

/**
 * Where Gmail opened the add-on (ADR-0007 section 4): `compose` from a draft's toolbar (`draftMetadata` present),
 * `message` from the right side panel with a message open, `inbox` from the side panel with none.
 */
export type Entry = "compose" | "message" | "inbox";

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The open message's ID: `gmail.messageId`, else the deprecated `messageMetadata.messageId`; "" when none. */
export function messageIdOf(event: AddonEvent | undefined): string {
  return (
    trimmed(event?.gmail?.["messageId"]) ||
    trimmed(event?.messageMetadata?.["messageId"])
  );
}

/** The one place that decides the entry; every callback derives it from its own event. */
export function entryOf(event: AddonEvent | undefined): Entry {
  if (event?.draftMetadata !== undefined) return "compose";
  return messageIdOf(event) === "" ? "inbox" : "message";
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

function stringList(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? value
    : undefined;
}

/**
 * The draft's To, Cc and Bcc as the tap's event carries them (spike S6: arrays of bare addresses in `draftMetadata`;
 * `gmail` repeats the non-empty ones). A missing list reads as empty. Values stay in the add-on: they only go back
 * to Gmail in the recipient actions.
 */
export function draftRecipients(event: AddonEvent | undefined): Recipients {
  const read = (name: string) =>
    sourcesOf(event)
      .reverse()
      .map((source) => stringList(source[name]))
      .find((list) => list !== undefined) ?? [];
  return {
    to: read("toRecipients"),
    cc: read("ccRecipients"),
    bcc: read("bccRecipients"),
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
