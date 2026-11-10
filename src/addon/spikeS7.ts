/**
 * TEMPORARY (spike S7, spec 14.2): the dev-only side-panel harness that tests compose actions (ADR-0007). Removed
 * in the Gmail panel pass with its callbacks `onS7Card`, `onS7Compose`, `onS7Notify`, the `s7` and `s7Error` Reply
 * kinds, the home section and docs/ops/smoke.md "Spike S7". No server call, no cache, no log line, no send: the
 * only write is the draft Gmail opens for the tester.
 */
import { entryOf, messageIdOf, type AddonEvent, type Entry } from "./event";
import {
  action,
  type ButtonSpec,
  type CardSpec,
  type Params,
  type Reply,
  type SectionSpec,
} from "./cards/spec";

export const S7_ENV = "dev";
export const S7_SUBJECT = "S7 test";
export const S7_TO = "s7-to@migway.com";
export const S7_CC = "s7-cc@migway.com";
export const S7_BCC = "s7-bcc@migway.com";
/** Bold text, a 2-item list, a link and one https image (spec 14.2 setup). */
export const S7_HTML = [
  "<p><b>S7 bold text</b></p>",
  "<ul><li>S7 item one</li><li>S7 item two</li></ul>",
  '<p><a href="https://www.google.com">S7 link</a></p>',
  '<p><img src="https://www.gstatic.com/images/icons/material/system/1x/description_googblue_48dp.png" alt="S7 image"></p>',
].join("");

export const S7_BUTTONS = {
  new: "New email",
  reply: "Reply",
  replyAll: "Reply all",
} as const;
export type S7Button = keyof typeof S7_BUTTONS;

/** The GmailApp methods the harness calls; tests pass a recording fake. Never a send method. */
export type S7Gmail = Pick<
  GoogleAppsScript.Gmail.GmailApp,
  "setCurrentMessageAccessToken" | "createDraft" | "getMessageById"
>;

export interface S7Options {
  readonly htmlBody: string;
  readonly cc: string;
  readonly bcc: string;
}

/** The one Gmail call of a button, with its arguments. Body is "": `htmlBody` replaces it (ADR-0007 section 1). */
export type S7Call =
  | {
      readonly method: "createDraft";
      readonly args: readonly [string, string, string, S7Options];
    }
  | {
      readonly method: "createDraftReply" | "createDraftReplyAll";
      readonly messageId: string;
      readonly args: readonly [string, S7Options];
    };

const OPTIONS: S7Options = { htmlBody: S7_HTML, cc: S7_CC, bcc: S7_BCC };

/** New email: To, subject and options. Reply, Reply all: no To and no `subject` option; Gmail sets both (D24). */
export function s7Call(button: S7Button, messageId: string): S7Call {
  switch (button) {
    case "new":
      return { method: "createDraft", args: [S7_TO, S7_SUBJECT, "", OPTIONS] };
    case "reply":
      return { method: "createDraftReply", messageId, args: ["", OPTIONS] };
    case "replyAll":
      return { method: "createDraftReplyAll", messageId, args: ["", OPTIONS] };
  }
}

/** Sets the event's access token (ADR-0007 section 1, [A29]), then makes the one call. */
export function s7Run(
  call: S7Call,
  gmail: S7Gmail,
  token: string,
): GoogleAppsScript.Gmail.GmailDraft {
  gmail.setCurrentMessageAccessToken(token);
  if (call.method === "createDraft") return gmail.createDraft(...call.args);
  const message = gmail.getMessageById(call.messageId);
  return call.method === "createDraftReply"
    ? message.createDraftReply(...call.args)
    : message.createDraftReplyAll(...call.args);
}

/** `gmail.accessToken`, else the deprecated `messageMetadata.accessToken`; "" when none. Never shown or logged. */
function tokenOf(event: AddonEvent | undefined): string {
  const token =
    event?.gmail?.["accessToken"] ?? event?.messageMetadata?.["accessToken"];
  return typeof token === "string" ? token : "";
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return "array";
  return value === null ? "null" : typeof value;
}

function namesAndTypes(value: unknown): string {
  if (typeof value !== "object" || value === null) return "(none)";
  const entries = Object.entries(value);
  return entries.length === 0
    ? "(empty)"
    : entries.map(([key, item]) => `${key} ${typeOf(item)}`).join(", ");
}

/** Key names and value types of the event and its Gmail parts, never a value. */
export function s7Shape(env: string, event: AddonEvent | undefined): string {
  return [
    `env: ${env}`,
    `entry: ${entryOf(event)}`,
    `message ID present: ${messageIdOf(event) === "" ? "no" : "yes"}`,
    `access token present: ${tokenOf(event) === "" ? "no" : "yes"}`,
    `event: ${namesAndTypes(event)}`,
    `gmail: ${namesAndTypes(event?.gmail)}`,
    `messageMetadata: ${namesAndTypes(event?.messageMetadata)}`,
    `commonEventObject: ${namesAndTypes(event?.commonEventObject)}`,
  ].join("\n");
}

/** Home card section: dev build and side panel only. */
export function s7Sections(env: string, entry: Entry): SectionSpec[] {
  return env !== S7_ENV || entry === "compose"
    ? []
    : [
        {
          header: "Spike S7 (temporary)",
          widgets: [
            {
              kind: "buttons",
              buttons: [
                { text: "Open S7 harness", action: action("onS7Card") },
              ],
            },
          ],
        },
      ];
}

function composeButton(button: S7Button, hasMessage: boolean): ButtonSpec {
  return {
    text: S7_BUTTONS[button],
    action: action("onS7Compose", { b: button }),
    compose: button === "new" ? "STANDALONE_DRAFT" : "REPLY_AS_DRAFT",
    ...(button === "new" || hasMessage ? {} : { disabled: true }),
  };
}

export function s7Card(event: AddonEvent | undefined, env: string): CardSpec {
  const hasMessage = messageIdOf(event) !== "";
  return {
    name: "s7",
    title: "Spike S7 (temporary)",
    sections: [
      {
        header: "Event shape (names and types only)",
        widgets: [{ kind: "text", text: s7Shape(env, event) }],
      },
      {
        header: "Buttons",
        widgets: [
          {
            kind: "text",
            text: `Each button opens a draft in a compose window. Nothing is sent. Discard every draft.${hasMessage ? "" : "\nReply and Reply all need an open message."}`,
          },
          {
            kind: "buttons",
            buttons: [
              composeButton("new", hasMessage),
              composeButton("reply", hasMessage),
              composeButton("replyAll", hasMessage),
              {
                text: "Notify",
                action: action("onS7Notify"),
                compose: "STANDALONE_DRAFT",
              },
            ],
          },
        ],
      },
    ],
  };
}

const OFF: Reply = {
  kind: "notify",
  text: "S7: the harness is off in this build.",
};

function isButton(value: string | undefined): value is S7Button {
  return (
    value !== undefined &&
    Object.prototype.hasOwnProperty.call(S7_BUTTONS, value)
  );
}

/** `onS7Card`: outside the dev build it says so and reads nothing. */
export function s7CardFlow(env: string, event: AddonEvent | undefined): Reply {
  return env !== S7_ENV ? OFF : { kind: "push", card: s7Card(event, env) };
}

/** Why a compose tap is refused, or "" when it may call Gmail. */
function refusal(button: S7Button, event: AddonEvent | undefined): string {
  const name = `S7 ${S7_BUTTONS[button]}`;
  if (entryOf(event) === "compose")
    return `${name}: run the harness from the side panel, not from a draft's toolbar.`;
  if (tokenOf(event) === "")
    return `${name}: the event has no gmail.accessToken.`;
  if (button !== "new" && messageIdOf(event) === "")
    return `${name}: no message is open. Open a message, then the harness.`;
  return "";
}

/** `onS7Compose`: one draft from the button's Gmail call; every refusal says why and calls nothing. */
export function s7ComposeFlow(
  env: string,
  event: AddonEvent | undefined,
  params: Params,
  gmail: S7Gmail,
): Reply {
  if (env !== S7_ENV) return OFF;
  const button = params["b"];
  if (!isButton(button))
    return {
      kind: "notify",
      text: `S7: no button parameter. Parameters: ${Object.keys(params).join(", ") || "(none)"}`,
    };
  const refused = refusal(button, event);
  if (refused !== "") return { kind: "notify", text: refused };
  const call = s7Call(button, messageIdOf(event));
  return { kind: "s7", draft: s7Run(call, gmail, tokenOf(event)) };
}

/** `onS7Notify`: a compose-action callback that returns a notification and no draft (S7 step 6). */
export function s7NotifyFlow(env: string): Reply {
  return env !== S7_ENV
    ? OFF
    : {
        kind: "notify",
        text: "S7 Notify: the callback ran. No draft was made.",
      };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A failure as a notification plus a card: the first S6 run failed silently and cost two test sessions. */
export function s7Failure(error: unknown): Reply {
  const text = `S7 failed: ${messageOf(error)}`;
  return {
    kind: "s7Error",
    text,
    card: {
      name: "s7-error",
      title: "Spike S7 failed",
      sections: [{ widgets: [{ kind: "text", text }] }],
    },
  };
}

/** Runs a harness callback; any exception becomes `fail(error)`. */
export function s7Visible<T>(run: () => T, fail: (error: unknown) => T): T {
  try {
    return run();
  } catch (error) {
    return fail(error);
  }
}
