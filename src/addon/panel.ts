import { ErrorCode } from "../shared/errors/codes";
import type { Recipients } from "../shared/model/recipients";
import { PERSONAL_OFF_TEXT } from "../shared/model/settings";
import { variableValues } from "../shared/model/sidebar";
import { RECIPIENT_SWITCH, recipientPlan } from "./cards/recipients";
import { isComposeAs, type ComposeAs } from "./cards/sidePanel";
import { SWITCH_ON, action, type Reply } from "./cards/spec";
import { stateCard } from "./cards/states";
import type { Failure } from "./client/serverClient";
import {
  addressesOf,
  formValue,
  internalAddress,
  messageIdOf,
  tokenOf,
  type AddonEvent,
  type DraftRecipients,
} from "./event";
import {
  applyNow,
  cardFields,
  countsOf,
  listsOf,
  mergedValues,
  parseValues,
  rendered,
  rhOf,
  type Applied,
  type GmailPort,
  type Loaded,
  type Ports,
} from "./flows";
import {
  MAX_FIELDS,
  MAX_VALUE_CHARS,
  answersByKey,
  inputName,
  tooLong,
} from "./prompts";
import { clearView } from "./view";

/**
 * Side-panel actions (spec 4.1a, ADR-0007 A3 to A8): New email, Reply and Reply all make one new Gmail draft through
 * a compose action. Same pipeline as compose (`applyNow`, `rendered`, `recipientPlan`); only the last step differs.
 * Every refusal is a notification and makes no draft. No address, value or subject reaches a log or a parameter.
 */
export const NO_MESSAGE =
  "Open the email you want to answer, then press Reply again.";
export const UNREADABLE =
  "This email can no longer be read. Open it again, or use New email.";
export const TOO_LONG = `Each box takes up to ${String(MAX_VALUE_CHARS)} characters. Shorten the long one and try again.`;
export const TEMPLATE_CHANGED =
  "This template changed. Go back and open it again.";
export const LISTS_CHANGED =
  "The recipients of this template changed. Go back and open it again.";
export const COUNTS_CHANGED =
  "The recipients of this template changed. Tap its name to see them.";
export const DRAFT_NOT_OPENED =
  "The email is in your Drafts, but Gmail could not open it. Open Drafts to find it.";
export const PANEL_NOT_FOUND =
  "This template was deleted or moved. Open the panel again to update the list.";
export const PANEL_DENIED =
  "You don't have access to this template. Ask a folder manager.";
const WRONG = "Something went wrong. Try again.";

type GmailMessage = GoogleAppsScript.Gmail.GmailMessage;

const notify = (text: string): Reply => ({ kind: "notify", text });

function withId(text: string, failure: Failure): string {
  return failure.requestId === ""
    ? text
    : `${text} Request ID ${failure.requestId}`;
}

/** Text lines of the state card, for the codes whose card has no Retry worth showing in a notification. */
function stateLines(failure: Failure): string {
  return stateCard(failure, {
    retry: action("onRefresh"),
    canGoBack: false,
    nowMs: 0,
  })
    .sections.flatMap((section) => section.widgets)
    .flatMap((widget) => (widget.kind === "text" ? [widget.text] : []))
    .join(" ");
}

/** The notification of a failed `template.apply` (spec 7.2). */
export function failureText(failure: Failure): string {
  switch (failure.code) {
    case ErrorCode.QUOTA:
      return "Service is busy. Try again in a minute.";
    case ErrorCode.BUSY:
      return withId(
        "The library is busy. Try again in a few seconds.",
        failure,
      );
    case ErrorCode.DENIED:
      return failure.message === PERSONAL_OFF_TEXT
        ? PERSONAL_OFF_TEXT
        : PANEL_DENIED;
    case ErrorCode.NOT_FOUND:
      return PANEL_NOT_FOUND;
    case ErrorCode.NOT_CONFIGURED:
    case ErrorCode.AUTH_NO_USER:
    case ErrorCode.AUTH_DOMAIN:
      return stateLines(failure);
    default:
      return failure.code === ErrorCode.NETWORK
        ? `${withId(WRONG, failure)} Details for your admin: ${failure.message}`
        : withId(WRONG, failure);
  }
}

/** DENIED and NOT_FOUND mean the cached view is stale. */
function refused(ports: Ports, failure: Failure): Reply {
  if (failure.code === ErrorCode.DENIED || failure.code === ErrorCode.NOT_FOUND)
    clearView(ports.cache);
  return notify(failureText(failure));
}

/** A press that passed its checks: the action, the open message (null for New email) and the computed draft. */
interface Started {
  readonly as: ComposeAs;
  readonly message: GmailMessage | null;
  /** The address a reply goes to; "" for New email. */
  readonly replyTo: string;
  /** The recipients the new draft has before the template's (ADR-0007 A4). */
  readonly draft: DraftRecipients;
}

const EMPTY: Recipients = { to: [], cc: [], bcc: [] };

/**
 * Reply: reply-to when not blank, else From. Reply all: also every To and Cc address. Any throw or a null message
 * gives null. Header strings carry display names; the last address of a single-address header is the address.
 */
function readMessage(
  gmail: GmailPort,
  id: string,
  all: boolean,
): Omit<Started, "as"> | null {
  try {
    const message = gmail.getMessageById(id) as GmailMessage | null;
    if (message === null) return null;
    const replyTo =
      addressesOf(message.getReplyTo()).at(-1) ??
      addressesOf(message.getFrom()).at(-1) ??
      "";
    const others = all
      ? [...addressesOf(message.getTo()), ...addressesOf(message.getCc())]
      : [];
    const to = [replyTo, ...others].filter((address) => address !== "");
    return { message, replyTo, draft: { to, cc: [], bcc: [] } };
  } catch {
    return null;
  }
}

/**
 * Spec 4.1a step 5 up to the server call: `as` in the list, a message ID for a reply, the caller's own refusal
 * (`refusal`, "" for none), the event token, then the message read. A Reply when refused, else the started press.
 */
function begin(
  ports: Ports,
  event: AddonEvent | undefined,
  as: string | undefined,
  refusal: string,
): Started | Reply {
  if (!isComposeAs(as)) return notify(WRONG);
  const messageId = messageIdOf(event);
  if (as !== "new" && messageId === "") return notify(NO_MESSAGE);
  if (refusal !== "") return notify(refusal);
  ports.gmail.setCurrentMessageAccessToken(tokenOf(event));
  if (as === "new") return { as, message: null, replyTo: "", draft: EMPTY };
  const read = readMessage(ports.gmail, messageId, as === "replyAll");
  return read === null ? notify(UNREADABLE) : { as, ...read };
}

function isReply(value: Started | Reply): value is Reply {
  return "kind" in value;
}

/** One `template.apply` (one use). The recipient first name only for Reply, only for an internal address. */
function applyFor(ports: Ports, id: string, started: Started): Loaded<Applied> {
  const recipient =
    started.as === "reply"
      ? internalAddress(started.replyTo, ports.userEmail)
      : "";
  return applyNow(ports, id, { recipientEmailIfInternal: recipient });
}

function listOptions(added: Recipients) {
  return {
    ...(added.cc.length === 0 ? {} : { cc: added.cc.join(",") }),
    ...(added.bcc.length === 0 ? {} : { bcc: added.bcc.join(",") }),
  };
}

/**
 * The one Gmail call (spec 4.1a step 6). Body "" because `htmlBody` replaces it. New email gets To and the subject;
 * a reply gets neither: Gmail sets To and keeps "Re:" (D24).
 */
function draftOf(
  gmail: GmailPort,
  started: Started,
  parts: { readonly html: string; readonly subject: string },
  added: Recipients,
): Reply {
  const options = { htmlBody: parts.html, ...listOptions(added) };
  const { message } = started;
  const draft =
    message === null
      ? gmail.createDraft(added.to.join(","), parts.subject, "", options)
      : started.as === "replyAll"
        ? message.createDraftReplyAll("", options)
        : message.createDraftReply("", options);
  return { kind: "compose", draft };
}

/** Row button (`onCompose`): fields without a value are removed, recipients are added; `rc` must still match. */
export function composeFlow(
  ports: Ports,
  event: AddonEvent | undefined,
  params: Readonly<Record<string, string>>,
): Reply {
  const started = begin(ports, event, params["as"], "");
  if (isReply(started)) return started;
  const applied = applyFor(ports, params["id"] ?? "", started);
  if (!applied.ok) return refused(ports, applied.failure);
  const { result, body } = applied.data;
  const lists = listsOf(result);
  if ((params["rc"] ?? "0,0,0") !== countsOf(lists)) {
    clearView(ports.cache);
    return notify(COUNTS_CHANGED);
  }
  const values = variableValues(result.sender, result.recipientFirstName);
  return draftOf(
    ports.gmail,
    started,
    rendered(body, { values, answers: {} }),
    recipientPlan(lists, started.draft).added,
  );
}

/**
 * Details card button (`onPromptCompose`): every box at most 500 characters before any call; the card's version
 * and `rh` must match the apply result. A typed value wins, a blank box takes the resolved value, else the field is
 * removed. "Add recipients" off adds none. Q68 fallback, if the boxes or the switch do not reach this callback: the
 * card drops them and this flow reads no form value (answers {}, recipients added).
 */
export function promptComposeFlow(
  ports: Ports,
  event: AddonEvent | undefined,
  params: Readonly<Record<string, string>>,
): Reply {
  const boxes = Array.from({ length: MAX_FIELDS }, (_, n) =>
    formValue(event, inputName(n)),
  );
  const long = tooLong(boxes).length > 0 ? TOO_LONG : "";
  const started = begin(ports, event, params["as"], long);
  if (isReply(started)) return started;
  const applied = applyFor(ports, params["id"] ?? "", started);
  if (!applied.ok) return refused(ports, applied.failure);
  const { result, body } = applied.data;
  const lists = listsOf(result);
  if (result.version !== Number(params["version"] ?? "0"))
    return notify(TEMPLATE_CHANGED);
  if (params["rh"] !== rhOf(ports, lists)) return notify(LISTS_CHANGED);
  const cardValues = parseValues(params["values"] ?? "{}");
  const parts = rendered(body, {
    values: mergedValues(cardValues, result),
    answers: answersByKey(cardFields(body, cardValues), boxes),
  });
  const add = formValue(event, RECIPIENT_SWITCH) === SWITCH_ON;
  return draftOf(
    ports.gmail,
    started,
    parts,
    add ? recipientPlan(lists, started.draft).added : EMPTY,
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The one catch around each panel action callback (ADR-0007 A8): no failure is silent. A throw after the draft
 * exists (rendering the response) says where the draft is; any other throw (a Gmail call) gives its message for the
 * admin. The message goes on the user's screen and into no log.
 */
export function panelVisible<T>(
  run: () => Reply,
  render: (reply: Reply) => T,
): T {
  let reply: Reply | null = null;
  try {
    reply = run();
    return render(reply);
  } catch (error) {
    return render(
      notify(
        reply?.kind === "compose"
          ? DRAFT_NOT_OPENED
          : `${WRONG} Details for your admin: ${messageOf(error)}`,
      ),
    );
  }
}
