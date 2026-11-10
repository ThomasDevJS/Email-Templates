/**
 * TEMPORARY (spike S6, spec 14.1): the dev-only harness that tests Gmail's recipient actions. Removed in slice 9
 * with its callbacks `onS6Card` and `onS6Apply`, the `s6` Reply kind, the home section and docs/ops/smoke.md
 * "Spike S6". No server call, no cache, no log line: recipient strings stay on the card in the user's Gmail.
 */
import type { AddonEvent } from "./event";
import {
  action,
  type CardSpec,
  type Params,
  type Reply,
  type SectionSpec,
} from "./cards/spec";

export const S6_ENV = "dev";
export const S6_FIELDS = ["to", "cc", "bcc"] as const;
export type S6Field = (typeof S6_FIELDS)[number];
export const S6_ADDRESSES: Readonly<Record<S6Field, string>> = {
  to: "s6-to@migway.com",
  cc: "s6-cc@migway.com",
  bcc: "s6-bcc@migway.com",
};
export const S6_BODY = "S6 body";
export const S6_SUBJECT = "S6 test";

const EVENT_KEYS: Readonly<Record<S6Field, string>> = {
  to: "toRecipients",
  cc: "ccRecipients",
  bcc: "bccRecipients",
};
const LABELS: Readonly<Record<S6Field, string>> = {
  to: "To",
  cc: "Cc",
  bcc: "Bcc",
};

export const S6_BUTTONS = {
  body: "Body only",
  bs: "Body and subject",
  new: "New only",
  plus: "Draft plus new",
  raw: "Raw Cc again",
  rcpt: "Recipients only",
} as const;
export type S6Button = keyof typeof S6_BUTTONS;

/** The draft's recipient lists as the event carries them; `undefined` when the field is missing or not a list. */
export type S6Recipients = Readonly<
  Record<S6Field, readonly string[] | undefined>
>;

/** One `UpdateDraftActionResponse`: each non-null part is one action. */
export interface S6Draft {
  readonly body: string | null;
  readonly subject: string | null;
  readonly to: readonly string[] | null;
  readonly cc: readonly string[] | null;
  readonly bcc: readonly string[] | null;
}

function listOf(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? value
    : undefined;
}

/** First list found per field, `draftMetadata` before `gmail`. Values unchanged. */
export function s6Recipients(event: AddonEvent | undefined): S6Recipients {
  const sources = [event?.draftMetadata, event?.gmail];
  const read = (field: S6Field) =>
    sources
      .map((source) => listOf(source?.[EVENT_KEYS[field]]))
      .find((list) => list !== undefined);
  return { to: read("to"), cc: read("cc"), bcc: read("bcc") };
}

/** Which actions each button sends, and the addresses of each recipient action in order. */
export function s6Draft(button: S6Button, draft: S6Recipients): S6Draft {
  const only = (field: S6Field) => [S6_ADDRESSES[field]];
  const plus = (field: S6Field) => [
    ...(draft[field] ?? []),
    S6_ADDRESSES[field],
  ];
  switch (button) {
    case "body":
      return { body: S6_BODY, subject: null, to: null, cc: null, bcc: null };
    case "bs":
      return {
        body: S6_BODY,
        subject: S6_SUBJECT,
        to: null,
        cc: null,
        bcc: null,
      };
    case "new":
      return {
        body: S6_BODY,
        subject: S6_SUBJECT,
        to: only("to"),
        cc: only("cc"),
        bcc: only("bcc"),
      };
    case "plus":
      return {
        body: S6_BODY,
        subject: S6_SUBJECT,
        to: plus("to"),
        cc: plus("cc"),
        bcc: plus("bcc"),
      };
    case "raw":
      return { body: null, subject: null, to: null, cc: only("cc"), bcc: null };
    case "rcpt":
      return {
        body: null,
        subject: null,
        to: only("to"),
        cc: only("cc"),
        bcc: only("bcc"),
      };
  }
}

/** For example "body, subject, To 2, Cc 1, Bcc 1". */
export function s6Summary(draft: S6Draft): string {
  return [
    ...(draft.body === null ? [] : ["body"]),
    ...(draft.subject === null ? [] : ["subject"]),
    ...S6_FIELDS.flatMap((field) => {
      const list = draft[field];
      return list === null ? [] : [`${LABELS[field]} ${String(list.length)}`];
    }),
  ].join(", ");
}

/** The draft with its body line extended by the action list and the callback time (the card cannot update). */
export function s6Timed(draft: S6Draft, button: S6Button, ms: number): S6Draft {
  if (draft.body === null) return draft;
  const line = `S6 ${S6_BUTTONS[button]}: ${s6Summary(draft)}. Callback ${String(ms)} ms.`;
  return { ...draft, body: `${draft.body}<br>${line}` };
}

function isButton(value: string | undefined): value is S6Button {
  return (
    value !== undefined &&
    Object.prototype.hasOwnProperty.call(S6_BUTTONS, value)
  );
}

/** Home card section; empty outside the dev build. */
export function s6Sections(env: string): SectionSpec[] {
  return env !== S6_ENV
    ? []
    : [
        {
          header: "Spike S6 (temporary)",
          widgets: [
            {
              kind: "buttons",
              buttons: [
                { text: "Open S6 harness", action: action("onS6Card") },
              ],
            },
          ],
        },
      ];
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) {
    const kinds = [...new Set(value.map((item) => typeof item))].join("|");
    return `array(${String(value.length)}${kinds === "" ? "" : ` of ${kinds}`})`;
  }
  return value === null ? "null" : typeof value;
}

/**
 * Key names and value types of the event, never a value: the first S6 run showed "(missing)" for every list and
 * no draft change, with no way to tell why.
 */
export function s6Shape(env: string, event: AddonEvent | undefined): string {
  const record = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const keys = (value: unknown) =>
    value === undefined ? "(none)" : Object.keys(record(value)).join(", ");
  const types = (value: unknown) =>
    S6_FIELDS.map(
      (field) => `${LABELS[field]} ${typeOf(record(value)[EVENT_KEYS[field]])}`,
    ).join(", ");
  return [
    `env: ${env}`,
    `event: ${keys(event)}`,
    `gmail: ${keys(event?.gmail)}`,
    `gmail types: ${types(event?.gmail)}`,
    `draftMetadata: ${keys(event?.draftMetadata)}`,
    `draftMetadata types: ${types(event?.draftMetadata)}`,
  ].join("\n");
}

export function s6Card(draft: S6Recipients, shape = ""): CardSpec {
  const received = S6_FIELDS.map((field) => {
    const list = draft[field];
    return `${LABELS[field]}: ${list === undefined ? "(missing)" : JSON.stringify(list)}`;
  }).join("\n");
  return {
    name: "s6",
    title: "Spike S6 (temporary)",
    sections: [
      {
        header: "Draft recipients as received",
        widgets: [{ kind: "text", text: received }],
      },
      ...(shape === ""
        ? []
        : [
            {
              header: "Event shape (names and types only)",
              widgets: [{ kind: "text" as const, text: shape }],
            },
          ]),
      {
        header: "Buttons",
        widgets: [
          {
            kind: "text",
            text: "Each button changes the draft only. Buttons with a body action add the action list and the callback time to the body.",
          },
          ...(Object.keys(S6_BUTTONS) as S6Button[]).map((button) => ({
            kind: "item" as const,
            text: S6_BUTTONS[button],
            bottomLabel: s6Summary(s6Draft(button, draft)),
            button: {
              text: S6_BUTTONS[button],
              action: action("onS6Apply", { b: button }),
            },
          })),
        ],
      },
    ],
  };
}

/** `onS6Card`: outside the dev build it returns a pop and reads nothing. */
export function s6CardFlow(env: string, event: AddonEvent | undefined): Reply {
  return env !== S6_ENV
    ? { kind: "pop" }
    : {
        kind: "push",
        card: s6Card(s6Recipients(event), s6Shape(env, event)),
      };
}

/** `onS6Apply`: one draft response, timed from `startedMs` (callback start). */
export function s6ApplyFlow(
  env: string,
  event: AddonEvent | undefined,
  params: Params,
  startedMs: number,
  nowMs: () => number,
): Reply {
  const button = params["b"];
  if (env !== S6_ENV) return { kind: "pop" };
  // A silent pop hid this case in the first S6 run.
  if (!isButton(button))
    return {
      kind: "notify",
      text: `S6: no button parameter. Parameters: ${Object.keys(params).join(", ") || "(none)"}`,
    };
  const draft = s6Draft(button, s6Recipients(event));
  return { kind: "s6", draft: s6Timed(draft, button, nowMs() - startedMs) };
}
