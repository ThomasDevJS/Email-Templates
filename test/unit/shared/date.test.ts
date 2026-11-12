import { afterAll, describe, expect, it } from "vitest";
import { dateText, typedDateMs } from "../../../src/shared/placeholders/date";

const HOUR = 3_600_000;
/** 12 Nov 2026 00:00 UTC (spec 5.9 example 1). */
const NOV_12 = 1794441600000;
/** Local midnight of 12 Nov 2026 in a zone `offset` hours from UTC. */
const localMidnight = (offset: number) => NOV_12 - offset * HOUR;

const ZONES = ["America/New_York", "Pacific/Auckland"];
const zoneBefore = process.env["TZ"];
afterAll(() => {
  process.env["TZ"] = zoneBefore;
});

describe.each(ZONES)("dateText under TZ=%s (spec 5.9)", (zone) => {
  it("reads the UTC day, whatever the process zone", () => {
    process.env["TZ"] = zone;
    expect(dateText(NOV_12)).toBe("11/12/2026");
    expect(dateText(1799107200000)).toBe("01/05/2027");
    expect(dateText("1794441600000")).toBe("11/12/2026");
    expect(dateText(localMidnight(-8))).toBe("11/12/2026");
    expect(dateText(localMidnight(9))).toBe("11/12/2026");
    expect(dateText(1794409200000)).toBe("11/12/2026");
    expect(dateText(localMidnight(13))).toBe("11/11/2026");
    expect(dateText(1794394800000)).toBe("11/11/2026");
  });

  it("gives the picked day at UTC-11 and UTC+11, at local midnight and at UTC midnight", () => {
    process.env["TZ"] = zone;
    expect(dateText(localMidnight(-11))).toBe("11/12/2026");
    expect(dateText(localMidnight(11))).toBe("11/12/2026");
    // The rounding edge: half a day either side of UTC midnight.
    expect(dateText(NOV_12 + 12 * HOUR - 1)).toBe("11/12/2026");
    expect(dateText(NOV_12 - 12 * HOUR)).toBe("11/12/2026");
    expect(dateText(NOV_12 + 12 * HOUR)).toBe("11/13/2026");
  });
});

describe("dateText edge values", () => {
  it("is empty for no finite number", () => {
    for (const raw of ["", "  ", "abc", NaN, Infinity, undefined, null, {}, []])
      expect(dateText(raw)).toBe("");
  });

  it("is empty for a year outside 1000 to 9999", () => {
    expect(dateText(Date.UTC(10000, 0, 1))).toBe("");
    expect(dateText(Date.UTC(999, 11, 31))).toBe("");
    expect(dateText(Date.UTC(9999, 11, 31))).toBe("12/31/9999");
    expect(dateText(8.64e15 + 1)).toBe("");
  });

  it("writes 02/29 of a leap year and the 1st of a month", () => {
    expect(dateText(Date.UTC(2028, 1, 29))).toBe("02/29/2028");
    expect(dateText(Date.UTC(2027, 0, 1))).toBe("01/01/2027");
  });
});

describe("typedDateMs (the text-box fallback)", () => {
  it("reads M/D/YYYY and MM/DD/YYYY as UTC midnight", () => {
    expect(typedDateMs("11/12/2026")).toBe(NOV_12);
    expect(typedDateMs(" 1/5/2027 ")).toBe(1799107200000);
    expect(typedDateMs("02/29/2028")).toBe(Date.UTC(2028, 1, 29));
  });

  it("refuses days that do not exist and other shapes", () => {
    for (const text of [
      "",
      "02/29/2027",
      "02/30/2028",
      "13/01/2026",
      "00/10/2026",
      "11/12/26",
      "2026-11-12",
      "11/12/0999",
      "1794441600000",
    ])
      expect(typedDateMs(text)).toBeNull();
  });
});
