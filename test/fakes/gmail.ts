import type { GmailPort } from "../../src/addon/flows";
import type { RecordedCall } from "./output";

/** Header strings of the fake open message, as GmailMessage returns them (display names included). */
export interface FakeHeaders {
  readonly from?: string;
  readonly replyTo?: string;
  readonly to?: string;
  readonly cc?: string;
}

/**
 * GmailApp and GmailMessage stand-ins for the side-panel actions. Every call is recorded as `{ method, args }`, the
 * message's own calls in the same list. `message` null makes `getMessageById` return null; the method named in
 * `fail` throws "Gmail says no". Drafts are plain markers `{ draft: <method> }`.
 */
export function createRecordingGmail(
  message: FakeHeaders | null = {},
  fail = "",
): { gmail: GmailPort; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const record =
    (method: string, value: unknown = { draft: method }) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      if (method === fail) throw new Error("Gmail says no");
      return value;
    };
  const headers = message ?? {};
  const fakeMessage = {
    getFrom: record("getFrom", headers.from ?? ""),
    getReplyTo: record("getReplyTo", headers.replyTo ?? ""),
    getTo: record("getTo", headers.to ?? ""),
    getCc: record("getCc", headers.cc ?? ""),
    createDraftReply: record("createDraftReply"),
    createDraftReplyAll: record("createDraftReplyAll"),
  };
  const gmail = {
    setCurrentMessageAccessToken: record("setCurrentMessageAccessToken"),
    createDraft: record("createDraft"),
    getMessageById: record(
      "getMessageById",
      message === null ? null : fakeMessage,
    ),
  };
  return { gmail: gmail as unknown as GmailPort, calls };
}
