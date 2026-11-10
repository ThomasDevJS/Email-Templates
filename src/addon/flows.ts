import { ErrorCode } from "../shared/errors/codes";
import type { CacheStore } from "../shared/cache/store";
import {
  variableValues,
  type ApplyResult,
  type SidebarHome,
  type SidebarTemplate,
} from "../shared/model/sidebar";
import { previewText, subjectPreview } from "../shared/placeholders/preview";
import {
  promptsFor,
  renderBody,
  renderSubject,
} from "../shared/placeholders/render";
import { folderCard } from "./cards/folder";
import { homeCard, searchCard } from "./cards/home";
import { previewCard } from "./cards/preview";
import { promptCard, tooManyFieldsCard } from "./cards/prompt";
import {
  SEARCH_INPUT,
  SKIP_SUBJECT,
  SUBJECT_SWITCH,
  SWITCH_ON,
  WITH_SUBJECT,
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
  formValue,
  internalRecipient,
  draftHasSubject,
  type AddonEvent,
  type Entry,
} from "./event";
import {
  MAX_FIELDS,
  answersByKey,
  checkAnswers,
  displayOrder,
  inputName,
  isClean,
  problemText,
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
}

type Loaded<T> =
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

const notFound: Failure = {
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

interface BodyReply {
  readonly id: string;
  readonly version: number;
  readonly subject: string;
  readonly html: string;
}

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
  const body = load<BodyReply>(ports, "template.getBody", { id });
  if (!body.ok) return failed(ports, body.failure, retry);
  const { version, html, subject } = body.data;
  writeBody(ports.cache, id, { version, html, subject });
  return {
    kind: "push",
    card: previewCard(
      template,
      previewText(html),
      subjectPreview(subject),
      draftHasSubject(event),
      ports.entry,
    ),
  };
}

interface Ready {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly html: string;
  /** Template subject, or "" when it has none or the user chose "Insert body only". */
  readonly subject: string;
  /** Whether the subject goes into the draft: `replacesSubject` of the Insert; the prompt card switch starts here. */
  readonly replaceSubject: boolean;
  readonly values: Readonly<Record<string, string>>;
}

/** Spec 4.1 steps 4 and 5: insert at once when nothing needs asking, else the prompt card. */
function insertOrAsk(ready: Ready): Reply {
  const fields = promptsFor(ready.html, ready.values, ready.subject);
  if (fields.length === 0) {
    const input = { values: ready.values, answers: {} };
    return insertReply(
      renderBody(ready.html, input).html,
      ready.replaceSubject ? renderSubject(ready.subject, input).text : "",
    );
  }
  if (fields.length > MAX_FIELDS)
    return {
      kind: "push",
      card: tooManyFieldsCard(ready.title, fields.length),
    };
  return {
    kind: "push",
    card: promptCard({
      ...ready,
      fields,
      entered: [],
      order: fields.map((_, n) => n),
      problem: "",
    }),
  };
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

export function insertFlow(
  ports: Ports,
  event: AddonEvent | undefined,
  params: Readonly<Record<string, string>>,
): Reply {
  const id = params["id"] ?? "";
  const choice = params["subject"];
  const skip = choice === SKIP_SUBJECT;
  const known = skip || choice === WITH_SUBJECT;
  const retry = action("onInsert", known ? { id, subject: choice } : { id });
  const cached = readBody(ports.cache, id);
  const applied = load<ApplyResult>(ports, "template.apply", {
    id,
    knownVersion: cached?.version ?? 0,
    recipientEmailIfInternal: internalRecipient(event, ports.userEmail),
  });
  if (!applied.ok) return failed(ports, applied.failure, retry);
  const result = applied.data;
  const body = appliedBody(ports, result, cached);
  if (body === null) return failed(ports, notFound, retry);
  return insertOrAsk({
    id,
    title: result.title,
    version: result.version,
    html: body.html,
    subject: skip ? "" : body.subject,
    replaceSubject: replacesSubject(choice, draftHasSubject(event)),
    values: variableValues(result.sender, result.recipientFirstName),
  });
}

function parseValues(raw: string): Record<string, string> {
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
 * Body for the prompt card's Insert. `template.apply` with `followUp: true` re-checks `use` on the server (a removed
 * grant gives DENIED) and buffers no second event. The body travels only when the cached copy is gone or stale.
 */
function bodyFor(ports: Ports, id: string, version: number): Loaded<BodyReply> {
  const cached = readBody(ports.cache, id);
  const usable = cached?.version === version ? cached : null;
  const applied = load<ApplyResult>(ports, "template.apply", {
    id,
    knownVersion: usable?.version ?? 0,
    followUp: true,
  });
  if (!applied.ok) return applied;
  const body = appliedBody(ports, applied.data, usable);
  if (body === null) return { ok: false, failure: notFound };
  return { ok: true, data: { id, ...body } };
}

/**
 * Prompt card Insert (wireframe 02). Blank or over-long values re-render the card with the error line and those
 * fields first; the draft does not change. A new template version since the card opened re-renders it too.
 * The subject goes into the draft only while the "Replace the subject" switch is on.
 */
export function promptInsertFlow(
  ports: Ports,
  event: AddonEvent | undefined,
  params: Readonly<Record<string, string>>,
): Reply {
  const id = params["id"] ?? "";
  const version = Number(params["version"] ?? "0");
  const values = parseValues(params["values"] ?? "{}");
  const body = bodyFor(ports, id, version);
  if (!body.ok) return failed(ports, body.failure, action("onBack"));
  const { html } = body.data;
  const subject = params["subject"] === SKIP_SUBJECT ? "" : body.data.subject;
  const replaceSubject = formValue(event, SUBJECT_SWITCH) === SWITCH_ON;
  const fields = promptsFor(html, values, subject);
  const entered = fields.map((_, n) => formValue(event, inputName(n)));
  const check = checkAnswers(fields, entered);
  const changed = body.data.version !== version;
  if (!changed && isClean(check)) {
    const input = { values, answers: answersByKey(fields, entered) };
    return insertReply(
      renderBody(html, input).html,
      replaceSubject ? renderSubject(subject, input).text : "",
    );
  }
  const problem = changed
    ? "The template changed. Check the fields and insert again."
    : problemText(fields, check);
  return {
    kind: "update",
    card: promptCard({
      id,
      title: params["title"] ?? "",
      version: body.data.version,
      subject,
      // A changed template shows the switch at its default: off when the draft has a subject (D24).
      replaceSubject: replaceSubject || (changed && !draftHasSubject(event)),
      values,
      fields,
      entered,
      order: displayOrder(fields.length, check),
      problem,
    }),
  };
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
