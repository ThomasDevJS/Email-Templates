import { describe, expect, it } from "vitest";
import {
  meterCache,
  meterDrive,
  meterLock,
  meterProps,
  newStats,
  snapshotProps,
} from "../../../src/server/metrics";
import type { DriveClient } from "../../../src/server/storage/driveClient";
import { requestTiming } from "../../../src/shared/model/protocol";
import { FakeCache } from "../../fakes/cache";
import { FakeLock } from "../../fakes/lock";
import { FakeProperties } from "../../fakes/properties";

/** A clock that moves 5 ms on every read, so every metered call takes 5 ms. */
function ticking(): () => number {
  let now = 0;
  return () => (now += 5);
}

describe("request metrics", () => {
  it("counts calls and adds their time per service", () => {
    const stats = newStats("webapp");
    const now = ticking();
    const cache = meterCache(new FakeCache(() => 0), stats, now);
    cache.put("k", "v");
    expect(cache.get("k")).toBe("v");
    const lock = meterLock(new FakeLock(), stats, now);
    expect(lock.tryLock(10)).toBe(true);
    lock.releaseLock();
    expect(stats.calls).toMatchObject({ cache: 2, lock: 1 });
    expect(stats.ms).toMatchObject({ cacheMs: 10, lockMs: 5 });
  });

  it("splits Drive time into reads and writes", () => {
    const stats = newStats("addon");
    const fake = {
      readText: () => "text",
      updateFile: () => undefined,
    } as unknown as DriveClient;
    const drive = meterDrive(fake, stats, ticking());
    expect(drive.readText("f")).toBe("text");
    drive.updateFile("f", "x");
    expect(stats.calls.drive).toBe(2);
    expect(stats.ms).toMatchObject({ driveReadMs: 5, driveWriteMs: 5 });
  });

  it("counts a failing call and passes the error on", () => {
    const stats = newStats("webapp");
    const props = new FakeProperties();
    const metered = meterProps(props, stats, ticking());
    expect(() => metered.setProperty("k", "x".repeat(10000))).toThrow(
      "Argument too large",
    );
    expect(stats.calls.props).toBe(1);
  });

  it("reads Script Properties once per execution and writes through", () => {
    const stats = newStats("webapp");
    const props = new FakeProperties();
    props.setProperty("A", "1");
    const snapshot = snapshotProps(meterProps(props, stats, ticking()));
    expect(snapshot.getProperty("A")).toBe("1");
    expect(snapshot.getProperty("B")).toBeNull();
    snapshot.setProperty("B", "2");
    snapshot.deleteProperty("A");
    expect(snapshot.getProperty("B")).toBe("2");
    expect(snapshot.getProperty("A")).toBeNull();
    expect(props.getProperties()).toEqual({ B: "2" });
    expect(stats.calls.props).toBe(3);
  });
});

describe("add-on timing in a request", () => {
  it("keeps known keys with whole ms from 0 to 10 min", () => {
    expect(
      requestTiming({
        timing: {
          addonPreMs: 0,
          addonTokenMs: 600000,
          prevFetchMs: 600001,
          prevTotalMs: "5",
          other: 1,
        },
      }),
    ).toEqual({ addonPreMs: 0, addonTokenMs: 600000 });
    expect(requestTiming({ timing: [1] })).toEqual({});
    expect(requestTiming(null)).toEqual({});
  });
});
