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
  readonly draftMetadata?: { readonly toRecipients?: readonly string[] };
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
