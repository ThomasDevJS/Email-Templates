import { ErrorCode } from "../shared/errors/codes";
import type { CacheStore } from "../shared/cache/store";
import {
  variableValues,
  type ApplyResult,
  type SidebarHome,
  type SidebarTemplate,
} from "../shared/model/sidebar";
import {
  recipientCount,
  type AppliedRecipients,
} from "../shared/model/recipients";
import { domainOf } from "../shared/permissions/principals";
import { subjectPreview } from "../shared/placeholders/preview";
import {
  keepBlankRows,
  promptsFor,
  renderBody,
  renderSubject,
  type RenderInput,
} from "../shared/placeholders/render";
import {
  VERSION_CHANGED,
  detailsCard,
  panelDetailsCard,
  type DetailsState,
} from "./cards/details";
import { folderCard } from "./cards/folder";
import { homeCard, searchCard } from "./cards/home";
import {
  RECIPIENTS_CHANGED,
  RECIPIENT_SWITCH,
  recipientActions,
  recipientPlan,
  recipientsText,
} from "./cards/recipients";
import {
  SEARCH_INPUT,
  SUBJECT_SWITCH,
  SWITCH_ON,
  action,
  insertReply,
  replacesSubject,
  type ActionSpec,
  type CardSpec,
  type Reply,
} from "./cards/spec";
import { stateCard } from "./cards/states";
import {
  failureOf,
  type Failure,
  type ServerCall,
} from "./client/serverClient";
import {
  draftRecipients,
  fieldValue,
  formValue,
  internalRecipient,
  draftHasSubject,
  type AddonEvent,
  type DraftRecipients,
  type Entry,
} from "./event";
import {
  answersByKey,
  displayOrder,
  enteredProblem,
  inputName,
  missingRequired,
} from "./prompts";
import {
  clearView,
  readBody,
  readView,
  writeBody,
  writeView,
  type CachedBody,
} from "./view";

/**
 * Sidebar flows (spec 4.1). Each takes its ports and the callback parameters and returns a card or a reply as
 * plain data; src/addon/entry.ts renders it. No flow reads Script Cache, Script Properties or storage.
 */
export interface Ports {
  call(op: string, args: unknown): ServerCall;
  /** The add-on User Cache. */
  readonly cache: CacheStore;
  nowMs(): number;
  readonly userEmail: string;
  readonly execUrl: string;
  /** `entryOf` of the callback's own event; decides the row and preview buttons and the hint. */
  readonly entry: Entry;
  /** First 16 hex characters of the SHA-256 of `text` (`rh`, spec 5.7). */
  hash(text: string): string;
  /** HTML of the user's default Gmail signature; "" when there is none or Gmail does not give it. */
  signature(): string;
  /** The GmailApp calls of the side-panel actions (spec 4.1a); tests pass a recording fake. Never a send method. */
  readonly gmail: GmailPort;
}

export type GmailPort = Pick<
  GoogleAppsScript.Gmail.GmailApp,
  "setCurrentMessageAccessToken" | "createDraft" | "getMessageById"
>;

export type Loaded<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly failure: Failure };

/** One server call. `T` is the op's documented payload; the server builds it from the shared model types. */
function load<T>(ports: Ports, op: string, args: unknown): Loaded<T> {
  const { requestId, response } = ports.call(op, args);
  return response.ok
    ? { ok: true, data: response.data as T }
    : { ok: false, failure: failureOf(requestId, response.error) };
}

/** Spec 4.1 step 1: User Cache first, `sidebar.home` on a miss. */
function loadView(ports: Ports): Loaded<SidebarHome> {
  const cached = readView(ports.cache);
  if (cached !== null) return { ok: true, data: cached };
  const loaded = load<SidebarHome>(ports, "sidebar.home", {});
  if (loaded.ok) writeView(ports.cache, loaded.data, ports.nowMs());
  return loaded;
}

/** Failure state pushed over the current card. DENIED and NOT_FOUND mean the cached view is stale. */
function failed(ports: Ports, failure: Failure, retry: ActionSpec): Reply {
  if (failure.code === ErrorCode.DENIED || failure.code === ErrorCode.NOT_FOUND)
    clearView(ports.cache);
  return {
    kind: "push",
    card: stateCard(failure, { retry, canGoBack: true, nowMs: ports.nowMs() }),
  };
}

export const notFound: Failure = {
  code: ErrorCode.NOT_FOUND,
  message: "",
  requestId: "",
};

export function homeFlow(ports: Ports): CardSpec {
  const loaded = loadView(ports);
  return loaded.ok
    ? homeCard(loaded.data, ports.entry)
    : stateCard(loaded.failure, {
        retry: action("onRefresh"),
        canGoBack: false,
        nowMs: ports.nowMs(),
      });
}

/**
 * Sidebar search (spec 4.4, wireframe 01): the home card's input calls this on change. An empty query shows Home;
 * any other query asks the server's `search` op and shows its results in place of Home.
 */
export function searchFlow(ports: Ports, event: AddonEvent | undefined): Reply {
  const query = formValue(event, SEARCH_INPUT).trim();
  const retry = action("onRefresh");
  const view = loadView(ports);
  if (!view.ok) return failed(ports, view.failure, retry);
  if (query === "")
    return { kind: "update", card: homeCard(view.data, ports.entry) };
  const found = load<{ results: SidebarTemplate[] }>(ports, "search", {
    query,
  });
  if (!found.ok) return failed(ports, found.failure, retry);
  return {
    kind: "update",
    card: searchCard(view.data, query, found.data.results, ports.entry),
  };
}

export function refreshFlow(ports: Ports): Reply {
  clearView(ports.cache);
  return { kind: "root", card: homeFlow(ports) };
}

export function folderFlow(
  ports: Ports,
  params: Readonly<Record<string, string>>,
): Reply {
  const retry = action("onOpenFolder", params);
  const loaded = loadView(ports);
  if (!loaded.ok) return failed(ports, loaded.failure, retry);
  const card = folderCard(
    loaded.data,
    params["folderId"] ?? "",
    params["page"] ?? "1",
    ports.entry,
  );
  if (card === null) return failed(ports, notFound, retry);
  return { kind: params["nav"] === "page" ? "update" : "push", card };
}

function templateOf(view: SidebarHome, id: string): SidebarTemplate | null {
  return view.templates.find((template) => template.id === id) ?? null;
}

/** The lists a server reply carries (spec 5.7); everything else in the reply is dropped. */
export function listsOf(reply: AppliedRecipients): AppliedRecipients {
  return {
    to: reply.to,
    cc: reply.cc,
    bcc: reply.bcc,
    blocked: reply.blocked,
  };
}

const NO_DRAFT: DraftRecipients = { to: [], cc: [], bcc: [] };

export function rhOf(ports: Ports, lists: AppliedRecipients): string {
  return ports.hash(recipientsText(lists));
}

/** Body and subject from an apply result, else from the add-on's cached copy of the same version. */
function appliedBody(
  ports: Ports,
  result: ApplyResult,
  cached: CachedBody | null,
): CachedBody | null {
  if (result.html === null || result.subject === null) return cached;
  const fresh = {
    version: result.version,
    html: result.html,
    subject: result.subject,
  };
  writeBody(ports.cache, result.id, fresh);
  return fresh;
}

export interface Applied {
  readonly result: ApplyResult;
  readonly body: CachedBody;
}

/**
 * One `template.apply`: the server re-checks `use` (a removed grant gives DENIED) and buffers one apply event
 * unless `extra` holds `followUp: true`. The body travels only when the cached copy is gone or stale; the lists
 * travel on every call.
 */
export function applyNow(
  ports: Ports,
  id: string,
  extra: Readonly<Record<string, unknown>>,
): Loaded<Applied> {
  const cached = readBody(ports.cache, id);
  const applied = load<ApplyResult>(ports, "template.apply", {
    id,
    knownVersion: cached?.version ?? 0,
    ...extra,
  });
  if (!applied.ok) return applied;
  const body = appliedBody(ports, applied.data, cached);
  if (body === null) return { ok: false, failure: notFound };
  return { ok: true, data: { result: applied.data, body } };
}

/**
 * The cached row of the template, else a minimal one from the apply result (no "Edit in library"). Reads the
 * User Cache only: no server call.
 */
function rowOf(ports: Ports, result: ApplyResult, body: CachedBody) {
  const cached = readView(ports.cache);
  const row = cached === null ? null : templateOf(cached, result.id);
  return (
    row ?? {
      id: result.id,
      folderId: "",
      title: result.title,
      subject: body.subject,
      snippet: "",
      version: result.version,
      prompts: [],
      level: "use" as const,
    }
  );
}

/**
 * Fields of a details card. The recipient first name counts as a field whatever a call resolved, because a
 * `followUp` call never resolves it: the card's inputs stay the same on every render, and a blank box takes the
 * name the values carry.
 */
export function cardFields(
  body: CachedBody,
  values: Readonly<Record<string, string>>,
) {
  return promptsFor(
    body.html,
    { ...values, "recipient.first_name": "" },
    body.subject,
  );
}

/** What a details card needs beyond the apply result; the defaults are the state of a freshly opened card. */
interface DetailsInput {
  readonly template: SidebarTemplate;
  readonly applied: Applied;
  readonly values: Readonly<Record<string, string>>;
  readonly problem: string;
  readonly counted: boolean;
  readonly entered?: readonly string[];
  readonly flagged?: readonly number[];
  readonly replaceSubject?: boolean;
  readonly addRecipients?: boolean;
}

function detailsOf(
  ports: Ports,
  event: AddonEvent | undefined,
  input: DetailsInput,
): CardSpec {
  const { body, result } = input.applied;
  const lists = listsOf(result);
  const fields = cardFields(body, input.values);
  const state: DetailsState = {
    template: input.template,
    subject: subjectPreview(body.subject),
    // A side-panel press makes a new draft: list the addresses as for an empty one.
    plan: recipientPlan(
      lists,
      ports.entry === "compose" ? draftRecipients(event) : NO_DRAFT,
    ),
    domain: domainOf(ports.userEmail),
    version: result.version,
    values: input.values,
    fields,
    entered: input.entered ?? [],
    order: displayOrder(fields.length, input.flagged ?? []),
    problem: input.problem,
    replaceSubject:
      input.replaceSubject ?? replacesSubject(draftHasSubject(event)),
    addRecipients: input.addRecipients ?? true,
    rh: rhOf(ports, lists),
    counted: input.counted,
  };
  return ports.entry === "compose"
    ? detailsCard(state)
    : panelDetailsCard(state, ports.entry);
}

/**
 * Row tap (spec 7.4 Flow B, 4.1a step 4), every entry: `template.apply` with `followUp: true` (no apply event, no
 * first-name lookup), then the details card of the entry with inputs only for fields without a value.
 */
export function previewFlow(
  ports: Ports,
  event: AddonEvent | undefined,
  params: Readonly<Record<string, string>>,
): Reply {
  const id = params["id"] ?? "";
  const retry = action("onPreview", { id });
  const view = loadView(ports);
  if (!view.ok) return failed(ports, view.failure, retry);
  const template = templateOf(view.data, id);
  if (template === null) return failed(ports, notFound, retry);
  const applied = applyNow(ports, id, { followUp: true });
  if (!applied.ok) return failed(ports, applied.failure, retry);
  const { sender, recipientFirstName } = applied.data.result;
  const card = detailsOf(ports, event, {
    template,
    applied: applied.data,
    values: variableValues(sender, recipientFirstName),
    problem: "",
    counted: false,
  });
  return { kind: "push", card };
}

/** "<to>,<cc>,<bcc>": the form of `rc` on a row button. */
export function countsOf(lists: AppliedRecipients): string {
  return [lists.to.length, lists.cc.length, lists.bcc.length].join(",");
}

/**
 * Row Insert (spec 7.4 Flow A): one `template.apply` (one apply event), then one insert reply. Fields without a
 * value are removed with the gap rules; the subject follows D24; recipients are added by spec 5.7. Other counts than
 * the row's `rc`, a required field, or a template address in a draft field the event does not give as a list, push
 * the details card and insert nothing.
 */
export function insertFlow(
  ports: Ports,
  event: AddonEvent | undefined,
  params: Readonly<Record<string, string>>,
): Reply {
  const id = params["id"] ?? "";
  const rc = params["rc"];
  const retry = action("onInsert", rc === undefined ? { id } : { id, rc });
  const applied = applyNow(ports, id, {
    recipientEmailIfInternal: internalRecipient(event, ports.userEmail),
  });
  if (!applied.ok) return failed(ports, applied.failure, retry);
  const { result, body } = applied.data;
  const values = variableValues(result.sender, result.recipientFirstName);
  const lists = listsOf(result);
  const draft = draftRecipients(event);
  const countsDiffer = (rc ?? "0,0,0") !== countsOf(lists);
  // A required field (spec 5.11) needs the card's boxes: a stale row can still carry the one-click button.
  const required = missingRequired(cardFields(body, values)).length > 0;
  if (
    countsDiffer ||
    required ||
    recipientCount(recipientPlan(lists, draft).unknown) > 0
  ) {
    const card = detailsOf(ports, event, {
      template: rowOf(ports, result, body),
      applied: applied.data,
      values,
      problem: countsDiffer ? RECIPIENTS_CHANGED : "",
      // This call buffered the apply event: the card's Insert must not add a second one.
      counted: true,
    });
    return { kind: "push", card };
  }
  const { html, subject } = rendered(body, { values, answers: {} });
  return insertReply(
    html,
    replacesSubject(draftHasSubject(event)) ? subject : "",
    recipientActions(lists, draft, true),
  );
}

/**
 * Body and subject of a press, the one rendering step of every insert path (compose and side panel, spec 7.4): a
 * typed answer, else the value, else the default text, else the field is removed with the gap rules.
 */
export function rendered(
  body: CachedBody,
  input: RenderInput,
): { readonly html: string; readonly subject: string } {
  return {
    html: renderBody(keepBlankRows(body.html), input).html,
    subject: renderSubject(body.subject, input).text,
  };
}

export function parseValues(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Card values, then each non-blank value of this call. The first counting call resolves the recipient first name;
 * the card carries it from then on, so a `followUp` call (blank name) renders the same as a direct Insert.
 */
export function mergedValues(
  card: Readonly<Record<string, string>>,
  result: ApplyResult,
): Record<string, string> {
  const fresh = variableValues(result.sender, result.recipientFirstName);
  return {
    ...card,
    ...Object.fromEntries(
      Object.entries(fresh).filter(([, value]) => value.trim() !== ""),
    ),
  };
}

/**
 * Details card Insert (spec 7.4 Flow C): one `template.apply`, with `followUp: true` when the card carries
 * `counted=1`. A new version, other lists than the card showed (`rh`) or a value over 500 characters re-render the
 * card with its line and `counted=1`; the draft does not change. Else a typed value wins, a blank field takes the
 * resolved value, else it is removed. Subject only while "Replace the subject" is on, recipients only while "Add
 * recipients" is on.
 */
export function promptInsertFlow(
  ports: Ports,
  event: AddonEvent | undefined,
  params: Readonly<Record<string, string>>,
): Reply {
  const id = params["id"] ?? "";
  const version = Number(params["version"] ?? "0");
  const cardValues = parseValues(params["values"] ?? "{}");
  const applied = applyNow(
    ports,
    id,
    params["counted"] === "1"
      ? { followUp: true }
      : { recipientEmailIfInternal: internalRecipient(event, ports.userEmail) },
  );
  if (!applied.ok) return failed(ports, applied.failure, action("onBack"));
  const { result, body } = applied.data;
  const replaceSubject = formValue(event, SUBJECT_SWITCH) === SWITCH_ON;
  const addRecipients = formValue(event, RECIPIENT_SWITCH) === SWITCH_ON;
  const lists = listsOf(result);
  const values = mergedValues(cardValues, result);
  // The inputs on screen came from the card values.
  const fields = cardFields(body, cardValues);
  const read = fields.map((field, n) => fieldValue(event, field, inputName(n)));
  // A refused choice comes back at "Choose..." (spec 5.10).
  const entered = read.map((value) => value ?? "");
  const issue = enteredProblem(fields, read);
  const changed = result.version !== version;
  const listsChanged = params["rh"] !== rhOf(ports, lists);
  if (!changed && !listsChanged && issue === null) {
    const { html, subject } = rendered(body, {
      values,
      answers: answersByKey(fields, entered),
    });
    return insertReply(
      html,
      replaceSubject ? subject : "",
      recipientActions(lists, draftRecipients(event), addRecipients),
    );
  }
  const card = detailsOf(ports, event, {
    template: rowOf(ports, result, body),
    applied: applied.data,
    values,
    problem: changed
      ? VERSION_CHANGED
      : listsChanged
        ? RECIPIENTS_CHANGED
        : (issue?.text ?? ""),
    counted: true,
    entered,
    flagged: changed ? [] : (issue?.flagged ?? []),
    // A changed template shows the switches at their defaults (D24 for the subject).
    ...(changed ? {} : { replaceSubject }),
    addRecipients: addRecipients || changed || listsChanged,
  });
  return { kind: "update", card };
}

/** "Open library" and "Edit in library": the cached view may be stale after edits, so it is dropped. */
export function openLinkFlow(
  ports: Ports,
  params: Readonly<Record<string, string>>,
): Reply {
  clearView(ports.cache);
  const id = params["id"] ?? "";
  const url =
    id === ""
      ? ports.execUrl
      : `${ports.execUrl}?view=editor&id=${encodeURIComponent(id)}`;
  return { kind: "open", url };
}
