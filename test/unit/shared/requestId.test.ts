import { describe, expect, it } from "vitest";
import { newRequestId, requestIdNow } from "../../../src/shared/requestId";

const FORMAT = /^[0-9A-Z]{8}-[0-9A-Z]{6}$/;

describe("request IDs (one format on both surfaces)", () => {
  it("pads the time to 8 and the random part to 6 base-36 characters", () => {
    expect(newRequestId(1000, () => 0)).toBe("000000RS-000000");
    expect(newRequestId(Date.parse("2026-11-10T00:00:00Z"), () => 0.5)).toMatch(
      FORMAT,
    );
    expect(newRequestId(-5, () => 0.999999)).toMatch(FORMAT);
  });

  it("uses the clock at call time", () => {
    expect(requestIdNow()).toMatch(FORMAT);
  });
});
