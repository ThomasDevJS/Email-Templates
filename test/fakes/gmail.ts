import type { S7Gmail } from "../../src/addon/spikeS7";
import type { RecordedCall } from "./output";

/**
 * TEMPORARY (spike S7): GmailApp and GmailMessage stand-ins. Every call is recorded as `{ method, args }`; a
 * message ID call records `getMessageById` and the message's own calls in the same list. Drafts are plain markers.
 */
export function createRecordingGmail(): {
  gmail: S7Gmail;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return { draft: method };
    };
  const message = {
    createDraftReply: record("createDraftReply"),
    createDraftReplyAll: record("createDraftReplyAll"),
  };
  const gmail = {
    setCurrentMessageAccessToken: record("setCurrentMessageAccessToken"),
    createDraft: record("createDraft"),
    getMessageById: (id: string) => {
      calls.push({ method: "getMessageById", args: [id] });
      return message;
    },
  };
  return { gmail: gmail as unknown as S7Gmail, calls };
}
