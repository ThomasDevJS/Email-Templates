import { describe, expect, it } from "vitest";
import {
  AppError,
  ErrorCode,
  isErrorCode,
  isRetryable,
  toErrorBody,
} from "../../../src/shared/errors/codes";

describe("error codes", () => {
  it("maps an AppError to its code and message", () => {
    expect(toErrorBody(new AppError(ErrorCode.DENIED, "no"))).toEqual({
      code: "DENIED",
      message: "no",
      retryable: false,
    });
  });

  it("hides the message of unknown errors behind INTERNAL", () => {
    expect(toErrorBody(new Error("secret detail"))).toEqual({
      code: "INTERNAL",
      message: "Internal error",
      retryable: true,
    });
  });

  it("marks BUSY, QUOTA, INTERNAL and NETWORK as retryable", () => {
    const retryable = Object.values(ErrorCode).filter(isRetryable);
    expect(retryable).toEqual(["BUSY", "QUOTA", "INTERNAL", "NETWORK"]);
  });

  it("carries details of a conflict", () => {
    const error = new AppError(ErrorCode.CONFLICT, "stale", {
      currentVersion: 3,
    });
    expect(toErrorBody(error)).toEqual({
      code: "CONFLICT",
      message: "stale",
      retryable: false,
      details: { currentVersion: 3 },
    });
  });

  it.each([
    "Too many simultaneous invocations: Spreadsheets",
    "Service invoked too many times for one day: urlfetch.",
  ])("maps the platform quota error %j to QUOTA", (message) => {
    expect(toErrorBody(new Error(message))).toMatchObject({
      code: "QUOTA",
      retryable: true,
    });
  });

  it("recognises known codes only", () => {
    expect(isErrorCode("AUTH_NO_USER")).toBe(true);
    expect(isErrorCode("NOPE")).toBe(false);
    expect(isErrorCode(3)).toBe(false);
  });

  it("names AppError instances", () => {
    expect(new AppError(ErrorCode.INTERNAL, "x").name).toBe("AppError");
  });
});
