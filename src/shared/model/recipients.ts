import { domainOf } from "../permissions/principals";

/**
 * Template recipients (D26, spec 5.7 and 7.1, ADR-0006): fixed To, Cc and Bcc addresses. One validation for every
 * write (server) and the editor's inline hints; the server result is authoritative.
 */
export const RECIPIENT_FIELDS = ["to", "cc", "bcc"] as const;
export type RecipientField = (typeof RECIPIENT_FIELDS)[number];
export type Recipients = Readonly<Record<RecipientField, readonly string[]>>;

export const RCPT_FIELD_MAX = 10;
export const RCPT_TOTAL_MAX = 20;
/** The email address limit, as `PRINCIPAL_KEY_MAX`. */
export const RCPT_ADDRESS_MAX = 254;

/** Admin setting `recipientsExternal` (D29, spec 5.8): `allow` (default) or `deny` (outside addresses refused). */
export type ExternalRule = "allow" | "deny";

export interface RecipientPolicy {
  /** Script Property `DOMAIN`; the only inside domain in v1 (Q36). */
  readonly domain: string;
  readonly external: ExternalRule;
}

export type RecipientCode =
  | "RCPT_FORMAT"
  | "RCPT_TOO_LONG"
  | "RCPT_TOO_MANY"
  | "RCPT_DUPLICATE"
  | "RCPT_EXTERNAL";

/** Shaped like a placeholder problem (`offset` null) so one Problems list shows both. */
export interface RecipientProblem {
  readonly code: RecipientCode;
  readonly message: string;
  readonly offset: null;
  readonly field: RecipientField;
  /** 1-based, in the field after normalization. */
  readonly position: number;
}

export const FIELD_LABELS: Readonly<Record<RecipientField, string>> = {
  to: "To",
  cc: "Cc",
  bcc: "Bcc",
};

export const NO_RECIPIENTS: Recipients = { to: [], cc: [], bcc: [] };

type StoredLists = Readonly<Partial<Record<RecipientField, unknown>>>;

/** Shape rule of a stored list (spec 5.7, shared with the index check): absent, or an array of strings. */
export function isStoredList(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((v) => typeof v === "string"))
  );
}

/**
 * A stored item or version file: absent lists (records before slice 9) read as `[]`, with no write. A list that
 * fails the shape rule (version files have no file-level check) also reads as `[]`; `unreadableRecipients` names it.
 */
export function recipientsOf(record: StoredLists): Recipients {
  const read = (field: RecipientField): readonly string[] => {
    const value = record[field];
    return Array.isArray(value) && isStoredList(value)
      ? (value as string[])
      : [];
  };
  return { to: read("to"), cc: read("cc"), bcc: read("bcc") };
}

/** Fields of a stored record whose list fails the shape rule. */
export function unreadableRecipients(record: StoredLists): RecipientField[] {
  return RECIPIENT_FIELDS.filter((field) => !isStoredList(record[field]));
}

export function recipientCount(lists: Recipients): number {
  return lists.to.length + lists.cc.length + lists.bcc.length;
}

/** Trim, lower case, drop blanks and repeats inside one field; order kept. */
export function normalizeRecipients(raw: Recipients): Recipients {
  const clean = (list: readonly string[]) => [
    ...new Set(list.map((a) => a.trim().toLowerCase()).filter((a) => a !== "")),
  ];
  return { to: clean(raw.to), cc: clean(raw.cc), bcc: clean(raw.bcc) };
}

const ADDRESS = /^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Spec 5.7 syntax on a normalized address: plain `local@domain`, no `..`, no label starting or ending with `-`. */
export function isAddress(address: string): boolean {
  if (!ADDRESS.test(address) || address.includes("..")) return false;
  return domainOf(address)
    .split(".")
    .every((label) => !label.startsWith("-") && !label.endsWith("-"));
}

/** Domain part differs from `domain` (exact, case-insensitive; subdomains are outside). */
export function isOutside(address: string, domain: string): boolean {
  return domainOf(address) !== domain.trim().toLowerCase();
}

function problem(
  code: RecipientCode,
  field: RecipientField,
  position: number,
  message: string,
): RecipientProblem {
  return { code, message, offset: null, field, position };
}

/** Per-address rules: length, syntax, the `deny` rule. One problem per address at most. */
function addressProblem(
  address: string,
  field: RecipientField,
  position: number,
  policy: RecipientPolicy,
): RecipientProblem | null {
  const where = `${FIELD_LABELS[field]}, address ${String(position)}`;
  if (address.length > RCPT_ADDRESS_MAX)
    return problem(
      "RCPT_TOO_LONG",
      field,
      position,
      `${where} is longer than ${String(RCPT_ADDRESS_MAX)} characters.`,
    );
  if (!isAddress(address))
    return problem(
      "RCPT_FORMAT",
      field,
      position,
      `${where} is not an email address. Use the form name@company.com.`,
    );
  if (policy.external === "deny" && isOutside(address, policy.domain))
    return problem(
      "RCPT_EXTERNAL",
      field,
      position,
      `${where} is outside ${policy.domain}. Your admin allows only ${policy.domain} addresses. Remove it to save.`,
    );
  return null;
}

/** An address already in an earlier field (To before Cc before Bcc). */
function duplicateProblems(lists: Recipients): RecipientProblem[] {
  const firstField = new Map<string, RecipientField>();
  const problems: RecipientProblem[] = [];
  for (const field of RECIPIENT_FIELDS)
    for (const [n, address] of lists[field].entries()) {
      const earlier = firstField.get(address);
      if (earlier === undefined) firstField.set(address, field);
      else
        problems.push(
          problem(
            "RCPT_DUPLICATE",
            field,
            n + 1,
            `${address} is in both ${FIELD_LABELS[earlier]} and ${FIELD_LABELS[field]}. Keep it in one of them.`,
          ),
        );
    }
  return problems;
}

function countProblems(lists: Recipients): RecipientProblem[] {
  const problems = RECIPIENT_FIELDS.filter(
    (field) => lists[field].length > RCPT_FIELD_MAX,
  ).map((field) =>
    problem(
      "RCPT_TOO_MANY",
      field,
      RCPT_FIELD_MAX + 1,
      `${FIELD_LABELS[field]} holds ${String(lists[field].length)} addresses. Use at most ${String(RCPT_FIELD_MAX)} in ${FIELD_LABELS[field]}.`,
    ),
  );
  const total = recipientCount(lists);
  if (problems.length === 0 && total > RCPT_TOTAL_MAX)
    problems.push(
      problem(
        "RCPT_TOO_MANY",
        "to",
        1,
        `To, Cc and Bcc hold ${String(total)} addresses together. Use at most ${String(RCPT_TOTAL_MAX)}.`,
      ),
    );
  return problems;
}

/** Normalized lists and every problem: counts, then per address, then addresses in two fields. */
export function validateRecipients(
  raw: Recipients,
  policy: RecipientPolicy,
): { recipients: Recipients; problems: RecipientProblem[] } {
  const recipients = normalizeRecipients(raw);
  const each = RECIPIENT_FIELDS.flatMap((field) =>
    recipients[field].flatMap((address, n) => {
      const found = addressProblem(address, field, n + 1, policy);
      return found === null ? [] : [found];
    }),
  );
  return {
    recipients,
    problems: [
      ...countProblems(recipients),
      ...each,
      ...duplicateProblems(recipients),
    ],
  };
}

/**
 * Import rule (spec 5.7): addresses failing format, length or `deny` are dropped, an address in two fields keeps
 * the first of To, Cc, Bcc. `dropped` holds the code of each dropped address. Count limits stay as problems: the
 * caller refuses the whole file.
 */
export function importRecipients(
  raw: Recipients,
  policy: RecipientPolicy,
): {
  recipients: Recipients;
  dropped: RecipientCode[];
  problems: RecipientProblem[];
} {
  const normalized = normalizeRecipients(raw);
  const seen = new Set<string>();
  const dropped: RecipientCode[] = [];
  const keep = (field: RecipientField) =>
    normalized[field].filter((address, n) => {
      const code = seen.has(address)
        ? "RCPT_DUPLICATE"
        : addressProblem(address, field, n + 1, policy)?.code;
      seen.add(address);
      if (code !== undefined) dropped.push(code);
      return code === undefined;
    });
  const recipients = { to: keep("to"), cc: keep("cc"), bcc: keep("bcc") };
  return { recipients, dropped, problems: countProblems(recipients) };
}

/** What `template.apply` and `template.getBody` return: the lists Insert may add and the addresses `deny` skips. */
export type AppliedRecipients = Recipients & {
  readonly blocked: readonly string[];
};

/** Apply view under the switch (spec 5.7): with `deny`, outside addresses move to `blocked`. */
export function splitBlocked(
  lists: Recipients,
  policy: RecipientPolicy,
): AppliedRecipients {
  if (policy.external === "allow") return { ...lists, blocked: [] };
  const inside = (list: readonly string[]) =>
    list.filter((address) => !isOutside(address, policy.domain));
  return {
    to: inside(lists.to),
    cc: inside(lists.cc),
    bcc: inside(lists.bcc),
    blocked: RECIPIENT_FIELDS.flatMap((field) =>
      lists[field].filter((address) => isOutside(address, policy.domain)),
    ),
  };
}
