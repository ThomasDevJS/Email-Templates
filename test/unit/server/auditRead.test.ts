/**
 * Slice 19: audit month files are JSON Lines, which the Advanced Drive service cannot return (it parses media as
 * JSON and throws with HTTP status 200 once a file has 2 lines). Query and roll read them through Drive REST.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuditEvent, IndexDoc } from "../../../src/shared/model/data";
import type { AuditQueryResult } from "../../../src/server/handlers/audit";
import type { ConfigView } from "../../../src/server/handlers/config";
import { runDaily } from "../../../src/server/jobs/daily";
import { lastErrorKey, runJob } from "../../../src/server/jobs/health";
import { EARLY_FLUSH_BYTES, runTick } from "../../../src/server/jobs/tick";
import { requireStoreIds } from "../../../src/server/storage/setupStore";
import { mutateIndex } from "../../../src/server/storage/writer";
import { driveRestResponder } from "../../fakes/drive";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const MONTH = "2026-11";
const ACTION = "folder.rename";
let world: World;

beforeEach(() => {
  world = setupWorld();
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
});

function event(id: string, note = ""): AuditEvent {
  return {
    id,
    ts: `${MONTH}-05T10:00:00.000Z`,
    actor: "a@example.com",
    actorRoles: "admin",
    surface: "webapp",
    action: ACTION,
    targetType: "folder",
    targetId: "f",
    targetPath: "/f",
    before: null,
    after: note === "" ? null : { note },
    result: "ok",
    errorCode: "",
    durationMs: 0,
    requestId: "r",
    appVersion: "v",
  };
}

function ids(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, n) => `${prefix}${String(n).padStart(3, "0")}`,
  );
}

function lines(events: readonly AuditEvent[]): string {
  return events.map((e) => `${JSON.stringify(e)}\n`).join("");
}

/** A month file as an earlier roll left it. */
function seedMonth(text: string): string {
  const parent = requireStoreIds(world.props).auditId;
  return world.drive.add(
    { name: `${MONTH}.jsonl`, parents: [parent], mimeType: "application/json" },
    text,
  ).id;
}

function fileIds(fileId: string): string[] {
  return world.drive
    .text(fileId)
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => (JSON.parse(line) as AuditEvent).id);
}

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

function addPending(events: readonly AuditEvent[]): void {
  mutateIndex(world.services, (current) => ({
    doc: { ...current, pendingAudit: [...current.pendingAudit, ...events] },
    events: [],
    result: undefined,
  }));
}

function query(args: object = {}): AuditQueryResult {
  return world.ok<AuditQueryResult>(OWNER, "audit.query", {
    action: ACTION,
    ...args,
  });
}

function mediaReads(): number {
  return world.urlFetch.requests.filter((r) => r.url.endsWith("?alt=media"))
    .length;
}

function failReads(status: number): void {
  world.urlFetch.respondWith(() => ({ status, body: "" }));
}

describe("audit.query over a month file", () => {
  it.each([1, 2, 500])("shows every line of a %i-line file", (count) => {
    const all = ids("L", count).map((id) => event(id));
    seedMonth(lines(all));
    const data = query();
    expect(data.total).toBe(count);
    expect(data.rows).toHaveLength(Math.min(count, 50));
    const last = all.at(-1)?.id ?? "";
    expect(
      world.ok<{ event: AuditEvent }>(OWNER, "audit.query", { id: last }).event
        .id,
    ).toBe(last);
  });

  it("skips a blank line and a broken line", () => {
    seedMonth(`${lines([event("A")])}\n{broken\n${lines([event("B")])}`);
    expect(query().total).toBe(2);
  });

  it("reads the file once per size: 1 media read, then the cache", () => {
    seedMonth(lines([event("A"), event("B")]));
    query();
    expect(mediaReads()).toBe(1);
    query();
    query({ id: "A" });
    expect(mediaReads()).toBe(1);
  });

  it.each([403, 500])(
    "answers a clean INTERNAL error when the read fails with HTTP %i",
    (status) => {
      seedMonth(lines([event("SECRETID1"), event("SECRETID2")]));
      failReads(status);
      const response = world.call(OWNER, "audit.query", {});
      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error).toMatchObject({
        code: "INTERNAL",
        retryable: true,
      });
      expect(response.error.message).toBe(
        `Drive REST get failed with HTTP ${String(status)}`,
      );
      expect(world.lines.join("\n")).not.toContain("SECRETID");
    },
  );
});

describe("audit roll into an existing month file", () => {
  it("daily appends to a 2-line file and empties pendingAudit", () => {
    const fileId = seedMonth(lines([event("A"), event("B")]));
    addPending([event("C"), event("B")]);
    expect(runDaily(world.services).auditRolled).toBe(2);
    expect(fileIds(fileId)).toEqual(["A", "B", "C"]);
    expect(fileIndex().pendingAudit).toEqual([]);
  });

  it("tick appends 300 pending events (over 200 KB) to a 2-line file", () => {
    const fileId = seedMonth(lines([event("A"), event("B")]));
    const pending = ids("P", 300).map((id) => event(id, "x".repeat(700)));
    addPending(pending);
    expect(JSON.stringify(pending).length).toBeGreaterThan(EARLY_FLUSH_BYTES);
    expect(runTick(world.services).rolled).toBe(300);
    expect(fileIds(fileId)).toHaveLength(302);
    expect(fileIndex().pendingAudit).toEqual([]);
  });

  it.each([403, 500])(
    "keeps all 300 pending events when the read fails with HTTP %i, then the next run moves them",
    (status) => {
      const fileId = seedMonth(lines([event("A"), event("B")]));
      addPending(ids("P", 300).map((id) => event(id)));
      failReads(status);
      const trigger = world.as("trigger");
      expect(() => runJob(trigger, "daily", () => runDaily(trigger))).toThrow(
        "auditRolled",
      );
      expect(fileIndex().pendingAudit).toHaveLength(300);
      expect(fileIds(fileId)).toEqual(["A", "B"]);
      const lastError = world.props.getProperty(lastErrorKey("daily")) ?? "";
      expect(lastError).toBe(
        `${new Date(world.clock.now).toISOString()} daily steps failed: auditRolled (INTERNAL)`,
      );
      const daily = world
        .ok<ConfigView>(OWNER, "config.get")
        .jobs.find((job) => job.name === "daily");
      expect(daily).toMatchObject({ status: "never", lastError });
      world.urlFetch.respondWith(driveRestResponder(world.drive));
      expect(runDaily(world.as("trigger")).auditRolled).toBe(300);
      expect(fileIds(fileId)).toHaveLength(302);
      expect(fileIndex().pendingAudit).toEqual([]);
    },
  );
});

describe("job errors carry no file text (slice 19 retry 1)", () => {
  const LEAK = "leak@example.com";

  /** Every place a failed job writes: Script Properties, log lines, the rethrown message. */
  function written(run: () => unknown): string {
    let thrown = "";
    try {
      run();
    } catch (error: unknown) {
      thrown = error instanceof Error ? `${error.name}: ${error.message}` : "";
    }
    expect(thrown).not.toBe("");
    return [
      thrown,
      JSON.stringify(world.props.getProperties()),
      ...world.lines,
    ].join("\n");
  }

  it("a damaged live index.json with an address: daily and tick write it nowhere", () => {
    const { indexId } = requireStoreIds(world.props);
    world.drive.patch(indexId, {}, `{"x": "${LEAK}"\n{`);
    world.cache.removeAll(world.cache.keys());
    for (const name of ["daily", "tick"] as const) {
      const trigger = world.as("trigger");
      const work = name === "daily" ? runDaily : runTick;
      const text = written(() => runJob(trigger, name, () => work(trigger)));
      expect(text).not.toContain(LEAK);
    }
    expect(world.props.getProperty(lastErrorKey("tick"))).toContain(
      "INTERNAL AppError",
    );
    expect(() => world.services.store().readIndex()).toThrow(
      "index.json is not valid JSON",
    );
  });

  it("a platform error quoting file text is stored as code and name, and a success clears it", () => {
    const trigger = world.as("trigger");
    const text = written(() =>
      runJob(trigger, "tick", () => {
        throw new Error(`HttpResponseException: Message: {"actor":"${LEAK}"}`);
      }),
    );
    expect(text).not.toContain(LEAK);
    expect(world.props.getProperty(lastErrorKey("tick"))).toBe(
      `${new Date(world.clock.now).toISOString()} INTERNAL Error`,
    );
    runJob(trigger, "tick", () => runTick(trigger));
    expect(world.props.getProperty(lastErrorKey("tick"))).toBeNull();
  });
});
