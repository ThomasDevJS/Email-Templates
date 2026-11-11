import {
  DRAFT_COUNT_MAX,
  DRAFT_FIELDS,
  type DraftField,
  type DraftInfo,
} from "../shared/model/protocol";
import type { RecipientField } from "../shared/model/recipients";
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

/** A draft field's list as the event gives it, or null when unknown: the field is never rewritten then. */
export type DraftRecipients = Readonly<
  Record<RecipientField, readonly string[] | null>
>;

function stringList(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? value
    : null;
}

/**
 * The draft's To, Cc and Bcc as the tap's event carries them (spike S6: arrays of bare addresses in `draftMetadata`;
 * `gmail` repeats the non-empty ones). The first source holding the key decides: an array of strings (possibly
 * empty) is known; a missing key, null, a string, an object or an array with a non-string entry is unknown (null).
 * Gmail replaces a field on every recipient action, so an unknown field must never get one. Values stay in the
 * add-on: they only go back to Gmail in the recipient actions.
 */
export function draftRecipients(
  event: AddonEvent | undefined,
): DraftRecipients {
  const read = (name: string) => {
    const source = sourcesOf(event)
      .reverse()
      .find((s) => s[name] !== undefined);
    return source === undefined ? null : stringList(source[name]);
  };
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

/** `address` trimmed and lower case when its domain is the caller's, else "": outside addresses never leave the add-on. */
export function internalAddress(address: string, userEmail: string): string {
  const domain = domainOf(userEmail);
  const bare = address.trim().toLowerCase();
  return domain !== "" && domainOf(bare) === domain ? bare : "";
}

/**
 * The one To recipient when it is in the caller's own domain (ADR-0004 Apply semantics 2). Zero or several
 * recipients, or an external address, give "".
 */
export function internalRecipient(
  event: AddonEvent | undefined,
  userEmail: string,
): string {
  const to = event?.draftMetadata?.toRecipients ?? [];
  const [only] = to;
  return to.length !== 1 || only === undefined
    ? ""
    : internalAddress(only, userEmail);
}

/** `gmail.accessToken`, else the deprecated `messageMetadata.accessToken`; "" when none. Never shown or logged. */
export function tokenOf(event: AddonEvent | undefined): string {
  const token =
    event?.gmail?.["accessToken"] ?? event?.messageMetadata?.["accessToken"];
  return typeof token === "string" ? token : "";
}

const ADDRESS = /[^\s<>,;"]+@[^\s<>,;"]+/g;

/**
 * Bare addresses of a Gmail header string (`getTo`, `getCc`, `getFrom`, `getReplyTo`), lower case. One regex per
 * string (ADR-0007 A4): a display name with a comma ("Doe, Ann" <ann@example.com>) does not split an address.
 */
export function addressesOf(header: string): string[] {
  return (header.match(ADDRESS) ?? []).map((address) => address.toLowerCase());
}

/** One piece per mailbox: commas inside a quoted display name do not split. */
const MAILBOX = /(?:"[^"]*"|[^,"])+/g;

/**
 * One address per mailbox of a header, in header order: the last address of each piece, so a display name that
 * looks like an address ("bob@x" <bob@y>) never wins.
 */
export function mailboxesOf(header: string): string[] {
  return (header.match(MAILBOX) ?? []).flatMap(
    (piece) => addressesOf(piece).at(-1) ?? [],
  );
}
