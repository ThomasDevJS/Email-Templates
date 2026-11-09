import { describe, expect, it } from "vitest";
import {
  parseRpcRequest,
  parseRpcResponse,
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
