import { describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../../src/shared/errors/codes";
import {
  DEFAULT_TABLES,
  dispatch,
  type DispatchTables,
} from "../../../src/server/dispatch/dispatch";
import { HANDLERS } from "../../../src/server/dispatch/handlers";
import { POLICY } from "../../../src/server/dispatch/policy";

const USER = { email: "user@example.com" };

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  throw new Error("expected an AppError");
}

describe("dispatch", () => {
  it.each(["", "   "])(
    "denies a blank caller (%j) before reading the policy table",
    (email) => {
      let handlerRan = false;
      const tables: DispatchTables = {
        policy: { ping: { requiredLevel: "none" } },
        handlers: {
          ping: () => {
            handlerRan = true;
          },
        },
      };
      expect(codeOf(() => dispatch({ email }, "ping", {}, tables))).toBe(
        ErrorCode.AUTH_NO_USER,
      );
      expect(handlerRan).toBe(false);
    },
  );

  it("denies a blank caller even for an unknown op", () => {
    expect(codeOf(() => dispatch({ email: "" }, "nope", {}))).toBe(
      ErrorCode.AUTH_NO_USER,
    );
  });

  it.each(["nope", "toString", "__proto__", "constructor", "hasOwnProperty"])(
    "rejects unknown op %s",
    (op) => {
      expect(codeOf(() => dispatch(USER, op, {}))).toBe(ErrorCode.UNKNOWN_OP);
    },
  );

  it("runs ping for an identified caller and echoes the caller", () => {
    expect(dispatch(USER, "ping", {})).toEqual({
      pong: true,
      caller: "user@example.com",
      env: "test",
    });
  });

  it.each(["use", "edit", "manage", "admin"] as const)(
    "denies level %s while no permission layer exists",
    (level) => {
      const tables: DispatchTables = {
        policy: { op: { requiredLevel: level } },
        handlers: { op: () => "ran" },
      };
      expect(codeOf(() => dispatch(USER, "op", {}, tables))).toBe(
        ErrorCode.DENIED,
      );
    },
  );

  it("fails closed with INTERNAL when a policy row has no handler", () => {
    const tables: DispatchTables = {
      policy: { orphan: { requiredLevel: "none" } },
      handlers: {},
    };
    expect(codeOf(() => dispatch(USER, "orphan", {}, tables))).toBe(
      ErrorCode.INTERNAL,
    );
  });
});

describe("policy table completeness (ADR-0003 Part C)", () => {
  it("has a policy row for every handler and a handler for every row", () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(Object.keys(POLICY).sort());
  });

  it("is the table dispatch uses by default", () => {
    expect(DEFAULT_TABLES).toEqual({ policy: POLICY, handlers: HANDLERS });
  });

  it("holds only ping in slice 1, open to any identified caller", () => {
    expect(POLICY).toEqual({ ping: { requiredLevel: "none" } });
  });
});
