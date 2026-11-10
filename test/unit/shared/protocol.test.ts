import { describe, expect, it } from "vitest";
import {
  parseRpcRequest,
  parseRpcResponse,
  requestDraft,
} from "../../../src/shared/model/protocol";

describe("parseRpcRequest", () => {
  it("accepts the documented shape", () => {
    const request = {
      op: "ping",
      args: { a: 1 },
      requestId: "r1",
      clientVersion: "dev-abc",
    };
    expect(parseRpcRequest(request)).toEqual(request);
  });

  it("defaults missing args to an empty object", () => {
    expect(
      parseRpcRequest({ op: "ping", requestId: "r1", clientVersion: "" })?.args,
    ).toEqual({});
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "ping"],
    ["blank op", { op: "", requestId: "r1", clientVersion: "v" }],
    ["missing requestId", { op: "ping", clientVersion: "v" }],
    [
      "numeric clientVersion",
      { op: "ping", requestId: "r1", clientVersion: 1 },
    ],
  ])("rejects %s", (_label, value) => {
    expect(parseRpcRequest(value)).toBeNull();
  });
});

describe("parseRpcResponse", () => {
  it("accepts a success envelope", () => {
    const response = {
      ok: true,
      data: { pong: true },
      serverVersion: "dev-abc",
      durationMs: 5,
    };
    expect(parseRpcResponse(response)).toEqual(response);
  });

  it("accepts an error envelope", () => {
    const response = {
      ok: false,
      error: { code: "AUTH_NO_USER", message: "x", retryable: false },
      serverVersion: "dev-abc",
      durationMs: 1,
    };
    expect(parseRpcResponse(response)).toEqual(response);
  });

  it.each([
    ["non-object", 42],
    ["missing serverVersion", { ok: true, data: 1, durationMs: 1 }],
    [
      "string durationMs",
      { ok: true, data: 1, serverVersion: "v", durationMs: "1" },
    ],
    [
      "unknown error code",
      {
        ok: false,
        error: { code: "X", message: "m", retryable: false },
        serverVersion: "v",
        durationMs: 1,
      },
    ],
    ["ok not boolean", { ok: "yes", serverVersion: "v", durationMs: 1 }],
  ])("rejects %s", (_label, value) => {
    expect(parseRpcResponse(value)).toBeNull();
  });
});

describe("requestDraft (Q21 diagnostics)", () => {
  const draft = { fields: ["threadId", "messageId"], to: 1, cc: 0, bcc: 0 };

  it("accepts names from the fixed list and returns them in list order", () => {
    expect(requestDraft({ draft })).toEqual({
      fields: ["messageId", "threadId"],
      to: 1,
      cc: 0,
      bcc: 0,
    });
    expect(requestDraft({})).toBeUndefined();
    expect(requestDraft("x")).toBeUndefined();
  });

  it.each([
    ["an unknown name", { ...draft, fields: ["threadId", "Dear Bob"] }],
    ["a repeated name", { ...draft, fields: ["threadId", "threadId"] }],
    ["a name that is not a string", { ...draft, fields: [1] }],
    ["fields not a list", { ...draft, fields: "threadId" }],
    ["a negative count", { ...draft, to: -1 }],
    ["a fraction", { ...draft, cc: 0.5 }],
    ["a count over 1000", { ...draft, bcc: 1001 }],
    ["a text count", { ...draft, to: "1" }],
    ["an extra key", { ...draft, subject: "Hello" }],
    ["a missing key", { fields: [], to: 0, cc: 0 }],
    ["a list", []],
    ["null", null],
  ])("rejects %s", (_label, value) => {
    expect(requestDraft({ draft: value })).toBeNull();
  });
});
