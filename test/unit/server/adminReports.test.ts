/**
 * Slice 6b server side: audit log, usage report, export and import, config with job health, backups. Role matrix
 * per op for no grant, use, edit, manage, admin and the add-on surface.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AuditEvent,
  Folder,
  Grant,
  IndexDoc,
  Item,
} from "../../../src/shared/model/data";
import { readBuffer } from "../../../src/server/audit/buffer";
import { AUDIT_PAGE_SIZE, parseLines } from "../../../src/server/audit/query";
import { INDEX_REV_KEY } from "../../../src/server/cache/indexCache";
import type { AuditQueryResult } from "../../../src/server/handlers/audit";
import {
  INDEX_WARN_BYTES,
  jobStatus,
  type ConfigView,
} from "../../../src/server/handlers/config";
import {
  EXPORT_PAGE,
  type ExportPage,
  type ImportReport,
} from "../../../src/server/handlers/transfer";
import { runDaily } from "../../../src/server/jobs/daily";
import { lastErrorKey, lastOkKey } from "../../../src/server/jobs/health";
import { runTick } from "../../../src/server/jobs/tick";
import { ADMIN_GROUP_KEY } from "../../../src/server/membership/snapshot";
import {
  IMPORT_ITEMS_MAX,
  IMPORT_MAX_BYTES,
} from "../../../src/shared/model/validate";
import type { Surface } from "../../../src/shared/log/logger";
import { requireStoreIds } from "../../../src/server/storage/setupStore";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
const HOUR_MS = 60 * 60 * 1000;
let world: World;

beforeEach(() => {
  world = setupWorld();
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
});

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

function codeOf(
  caller: string,
  op: string,
  args: unknown = {},
  surface: Surface = "webapp",
): string {
  const response = world.call(caller, op, args, surface);
  return response.ok ? "ok" : response.error.code;
}

function errorOf(caller: string, op: string, args: unknown): string {
  const response = world.call(caller, op, args);
  return response.ok ? "ok" : response.error.message;
}

function folder(name: string, parentId = ""): Folder {
  return world.ok<Folder>(OWNER, "folder.create", { name, parentId });
}

function grant(folderId: string, principalKey: string, level: string): Grant {
  return world.ok<Grant>(OWNER, "grant.add", {
    folderId,
    principalType: "user",
    principalKey,
    level,
  });
}

function template(
  folderId: string,
  title = "T",
  subject = "",
  html = "<p>x</p>",
): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId,
    title,
    subject,
    html,
  });
}

/** `calls` of the last log line. */
function lastCalls(): { drive: number; lock: number } {
  const line = JSON.parse(world.lines.at(-1) ?? "{}") as {
    calls: { drive: number; lock: number };
  };
  return line.calls;
}

type Role = "none" | "use" | "edit" | "manage" | "admin" | "addon";
const ROLES: readonly Role[] = [
  "none",
  "use",
  "edit",
  "manage",
  "admin",
  "addon",
];

interface Fixture {
  readonly sales: Folder;
  readonly quotes: Folder;
  readonly file: string;
}

/** Sales > Quotes with one template; a role grant on Sales; a small export file for import. */
function fixture(role: Role): { caller: string; surface: Surface } & Fixture {
  const sales = folder("Sales");
  const quotes = folder("Quotes", sales.id);
  template(quotes.id);
  runDaily(world.services);
  if (role === "use" || role === "edit" || role === "manage")
    grant(sales.id, ANA, role);
  const admin = role === "admin" || role === "addon";
  const file = JSON.stringify({
    schemaVersion: 1,
    folders: [],
    items: [{ meta: { title: "Imported" }, html: "<p>i</p>" }],
  });
  return {
    caller: admin ? OWNER : ANA,
    surface: role === "addon" ? "addon" : "webapp",
    sales,
    quotes,
    file,
  };
}

type Case = (f: Fixture) => [string, unknown];

const OPS: Readonly<Record<string, Case>> = {
  "audit.query": () => ["audit.query", {}],
  "usage.report": () => ["usage.report", {}],
  "export.folder": (f) => ["export.folder", { folderId: f.quotes.id }],
  "export.library": () => ["export.library", {}],
  "import (validate)": (f) => [
    "import",
    { folderId: f.quotes.id, file: f.file, dryRun: true },
  ],
  import: (f) => ["import", { folderId: f.quotes.id, file: f.file }],
  "config.get": () => ["config.get", {}],
  "config.set": () => [
    "config.set",
    { name: "personalTemplates", value: "on", baseAt: "", baseBy: "" },
  ],
  "backup.list": () => ["backup.list", {}],
  "backup.restore": () => [
    "backup.restore",
    { date: new Date(world.clock.now).toISOString().slice(0, 10) },
  ],
};

const ADMIN_ONLY = ["DENIED", "DENIED", "DENIED", "DENIED", "ok", "DENIED"];
const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  "audit.query": ADMIN_ONLY,
  "usage.report": ADMIN_ONLY,
  "export.folder": ["DENIED", "DENIED", "DENIED", "ok", "ok", "DENIED"],
  "export.library": ADMIN_ONLY,
  "import (validate)": ADMIN_ONLY,
  import: ADMIN_ONLY,
  "config.get": ADMIN_ONLY,
  "config.set": ADMIN_ONLY,
  "backup.list": ADMIN_ONLY,
  "backup.restore": ADMIN_ONLY,
};

describe("role matrix of the slice 6b ops", () => {
  const cases = Object.keys(OPS).flatMap((name) =>
    ROLES.map((role, column) => [name, role, EXPECTED[name]?.[column]]),
  );

  it.each(cases)("%s as %s: %s", (name, role, expected) => {
    const f = fixture(role as Role);
    const [op, args] = (OPS[name as string] as Case)(f);
    const before = JSON.stringify(fileIndex());
    world.lines.length = 0;
    expect(codeOf(f.caller, op, args, f.surface)).toBe(expected);
    if (expected === "DENIED") {
      expect(lastCalls().drive).toBe(0);
      expect(JSON.stringify(fileIndex())).toBe(before);
      const denied = readBuffer(world.cache).events.filter(
        (entry) => entry.kind === "denied",
      );
      expect(denied.length).toBeGreaterThan(0);
    }
  });

  it("re-checks the admin inside the lock on backup.restore, import and config.set", () => {
    const f = fixture("admin");
    const date = new Date(world.clock.now).toISOString().slice(0, 10);
    const tryLock = world.lock.tryLock.bind(world.lock);
    world.lock.tryLock = (ms: number) => {
      world.props.setProperty("ADMIN_EMAILS", "nobody@example.com");
      return tryLock(ms);
    };
    expect(codeOf(OWNER, "backup.restore", { date })).toBe("DENIED");
    expect(
      codeOf(OWNER, "import", { folderId: f.quotes.id, file: f.file }),
    ).toBe("DENIED");
    world.props.setProperty("ADMIN_EMAILS", OWNER);
    expect(
      codeOf(OWNER, "config.set", {
        name: "personalTemplates",
        value: "on",
        baseAt: "",
        baseBy: "",
      }),
    ).toBe("DENIED");
    expect(fileIndex().settings).toBeUndefined();
  });
});

describe("audit.query", () => {
  it("shows a change from the month file and the events not yet rolled, newest first", () => {
    const sales = folder("Sales");
    runDaily(world.services);
    world.clock.now += HOUR_MS;
    template(sales.id, "Welcome");
    const data = world.ok<AuditQueryResult>(OWNER, "audit.query", {
      month: "2026-11",
    });
    expect(data.rows.map((row) => row.action).slice(0, 2)).toEqual([
      "template.create",
      "folder.create",
    ]);
    expect(data.rows[0]).toMatchObject({ actor: OWNER, result: "ok" });
    expect(data.rows[0]).not.toHaveProperty("after");
    expect(data.months).toEqual(["2026-11"]);
    expect(data.actions).toContain("template.create");
  });

  it("returns before and after of one event for the details drawer", () => {
    const sales = folder("Sales");
    world.ok(OWNER, "folder.rename", { folderId: sales.id, name: "Sales EU" });
    const { rows } = world.ok<AuditQueryResult>(OWNER, "audit.query", {
      action: "folder.rename",
    });
    const id = rows[0]?.id ?? "";
    const { event } = world.ok<{ event: AuditEvent }>(OWNER, "audit.query", {
      id,
    });
    expect(event).toMatchObject({
      before: { name: "Sales" },
      after: { name: "Sales EU" },
      requestId: "TESTREQ0-000001",
      appVersion: "test-testsha",
    });
    expect(codeOf(OWNER, "audit.query", { id: "nope" })).toBe("NOT_FOUND");
  });

  it("shows a denied row after the 5-min tick", () => {
    const hr = folder("HR");
    expect(codeOf(ANA, "grant.list", { folderId: hr.id })).toBe("DENIED");
    runTick(world.services);
    const { rows } = world.ok<AuditQueryResult>(OWNER, "audit.query", {
      result: "denied",
    });
    expect(rows.map((row) => [row.action, row.actor])).toEqual([
      ["grant.list", ANA],
    ]);
  });

  it("filters by date range, actor, action, result and target", () => {
    const sales = folder("Sales");
    world.clock.now += 24 * HOUR_MS;
    const hr = folder("HR");
    const query = (args: object) =>
      world
        .ok<AuditQueryResult>(OWNER, "audit.query", args)
        .rows.map((row) => row.targetPath);
    expect(
      query({ from: "2026-11-10T00:00:00.000Z", action: "folder.create" }),
    ).toEqual(["/HR"]);
    expect(
      query({ to: "2026-11-10T00:00:00.000Z", action: "folder.create" }),
    ).toEqual(expect.arrayContaining(["/Sales"]));
    expect(query({ target: "hr" })).toEqual(["/HR"]);
    expect(query({ target: sales.id })).toEqual(["/Sales"]);
    expect(query({ actor: "ANA@" })).toEqual([]);
    expect(query({ result: "error" })).toEqual([]);
    expect(hr.id).not.toBe(sales.id);
  });

  it(`pages ${String(AUDIT_PAGE_SIZE)} rows at a time`, () => {
    const events = Array.from({ length: 60 }, (_, n) => ({
      id: `E${String(n).padStart(3, "0")}`,
      ts: `2026-11-01T00:00:${String(n % 60).padStart(2, "0")}.000Z`,
      action: "template.update",
    }));
    world.services.store().appendAudit(
      "2026-11",
      events.map(
        (e) => ({ ...fileIndex().pendingAudit[0], ...e }) as AuditEvent,
      ),
    );
    const first = world.ok<AuditQueryResult>(OWNER, "audit.query", {
      action: "template.update",
    });
    const second = world.ok<AuditQueryResult>(OWNER, "audit.query", {
      action: "template.update",
      page: 1,
    });
    expect([first.total, first.rows.length, second.rows.length]).toEqual([
      60, 50, 10,
    ]);
    expect(first.rows[0]?.id).toBe("E059");
  });

  it("reads Drive at most twice per call and once with the month file cached", () => {
    folder("Sales");
    runDaily(world.services);
    world.ok(OWNER, "audit.query", {});
    expect(lastCalls().drive).toBe(2);
    world.ok(OWNER, "audit.query", {});
    expect(lastCalls().drive).toBe(1);
    folder("HR");
    runDaily(world.services);
    world.ok(OWNER, "audit.query", {});
    expect(lastCalls().drive).toBe(2);
  });

  it("counts a duplicated event once (crash between roll steps)", () => {
    folder("Sales");
    const pending = fileIndex().pendingAudit;
    world.services.store().appendAudit("2026-11", pending);
    const data = world.ok<AuditQueryResult>(OWNER, "audit.query", {});
    expect(data.total).toBe(new Set(pending.map((e) => e.id)).size);
  });

  it("skips blank, broken and foreign lines of a month file", () => {
    const good = JSON.stringify({ id: "A", ts: "2026-11-01T00:00:00Z" });
    expect(
      parseLines(`${good}\n\n{broken\n{"id":1}\n`).map((e) => e.id),
    ).toEqual(["A"]);
  });

  it("refuses malformed filters", () => {
    expect(codeOf(OWNER, "audit.query", { month: "2026-13" })).toBe(
      "VALIDATION",
    );
    expect(codeOf(OWNER, "audit.query", { from: "soon" })).toBe("VALIDATION");
    expect(codeOf(OWNER, "audit.query", { result: "maybe" })).toBe(
      "VALIDATION",
    );
    expect(codeOf(OWNER, "audit.query", { actor: "a".repeat(300) })).toBe(
      "VALIDATION",
    );
    expect(codeOf(OWNER, "audit.query", { page: -1 })).toBe("VALIDATION");
  });
});

describe("usage.report", () => {
  it("lists every live template with applies in 30 days and the last use, most applied first", () => {
    const sales = folder("Sales");
    const quote = template(sales.id, "Quote");
    const other = template(sales.id, "Other");
    const gone = template(sales.id, "Gone");
    world.ok(OWNER, "template.delete", { id: gone.id });
    world.ok(
      OWNER,
      "template.apply",
      { id: quote.id, knownVersion: 0 },
      "addon",
    );
    world.ok(
      OWNER,
      "template.apply",
      { id: quote.id, knownVersion: 0 },
      "addon",
    );
    runTick(world.services);
    world.lines.length = 0;
    const data = world.ok<{
      since: string;
      rows: { title: string; applies30d: number; folderPath: string }[];
    }>(OWNER, "usage.report");
    expect(lastCalls().drive).toBe(0);
    expect(data.since).toBe("2026-10-11");
    expect(
      data.rows.map((row) => [row.title, row.folderPath, row.applies30d]),
    ).toEqual([
      ["Quote", "/Sales", 2],
      ["Other", "/Sales", 0],
    ]);
    expect(other.id).not.toBe(quote.id);
  });
});

function exportAll(
  caller: string,
  op: string,
  args: object = {},
): { header: ExportPage["header"]; items: ExportPage["items"] } {
  let page = world.ok<ExportPage>(caller, op, args);
  const items = [...page.items];
  while (page.next !== null) {
    page = world.ok<ExportPage>(caller, op, { ...args, offset: page.next });
    items.push(...page.items);
  }
  return { header: page.header, items };
}

describe("export", () => {
  beforeEach(() => {
    // D11 rules: personal templates on (D29 default is off).
    setSetting(world, "personalTemplates", "on");
  });

  it("exports the folder subtree with subjects and only the grants inside it", () => {
    const sales = folder("Sales");
    const quotes = folder("Quotes", sales.id);
    const q1 = folder("Q1", quotes.id);
    const hr = folder("HR");
    template(quotes.id, "Price", "Your quote {{ask:Number}}");
    template(q1.id, "Q1 offer");
    template(sales.id, "Outside");
    template(hr.id, "Salary");
    grant(sales.id, BOB, "use");
    grant(q1.id, "carl@example.com", "use");
    grant(quotes.id, ANA, "manage");
    const data = exportAll(ANA, "export.folder", { folderId: quotes.id });
    expect(data.header).toMatchObject({
      schemaVersion: 1,
      exportedBy: ANA,
      scope: { kind: "folder", folderId: quotes.id, name: "Quotes" },
    });
    expect(data.header.folders).toEqual([
      { id: quotes.id, parentId: "", name: "Quotes" },
      { id: q1.id, parentId: quotes.id, name: "Q1" },
    ]);
    expect(data.items.map((item) => item.meta.title).sort()).toEqual([
      "Price",
      "Q1 offer",
    ]);
    expect(data.items.find((i) => i.meta.title === "Price")).toMatchObject({
      meta: { subject: "Your quote {{ask:Number}}" },
      html: "<p>x</p>",
    });
    const text = JSON.stringify(data);
    expect(text).not.toContain(BOB);
    expect(text).not.toContain("Salary");
    expect(text).not.toContain("Outside");
    expect(text).not.toContain("pendingAudit");
    expect(data.header.grants.map((g) => g.principalKey).sort()).toEqual([
      ANA,
      "carl@example.com",
    ]);
  });

  it("exports the library without private folders, in pages of 20 bodies at most", () => {
    const sales = folder("Sales");
    for (let n = 0; n < EXPORT_PAGE + 3; n++)
      template(sales.id, `T${String(n)}`);
    const mine = world
      .ok<{ folders: Folder[] }>(ANA, "folder.list")
      .folders.find((f) => f.kind === "private") as Folder;
    world.ok(ANA, "template.create", {
      folderId: mine.id,
      title: "Private note",
      html: "<p>p</p>",
    });
    world.cache.removeAll(fileIndex().items.map((i) => `bd:${i.bodyFileId}`));
    world.ok(OWNER, "config.get");
    const first = world.ok<ExportPage>(OWNER, "export.library");
    expect(first.items).toHaveLength(EXPORT_PAGE);
    expect(lastCalls().drive).toBe(EXPORT_PAGE);
    expect(first.next).toBe(EXPORT_PAGE);
    const data = exportAll(OWNER, "export.library");
    expect(data.items).toHaveLength(EXPORT_PAGE + 3);
    expect(JSON.stringify(data)).not.toContain("Private note");
    expect(data.header.folders.map((f) => f.name)).toEqual(["Sales"]);
  });
});

function importFile(file: object): string {
  return JSON.stringify({ schemaVersion: 1, folders: [], grants: [], ...file });
}

describe("import", () => {
  beforeEach(() => {
    // D11 rules: personal templates on (D29 default is off).
    setSetting(world, "personalTemplates", "on");
  });

  it("re-imports an exported folder into a new folder with its subject, then skips it the second time", () => {
    const sales = folder("Sales");
    const sub = folder("Sub", sales.id);
    template(sales.id, "Price", "Quote for {{ask:Customer}}");
    template(sub.id, "Deep");
    const exported = exportAll(OWNER, "export.folder", { folderId: sales.id });
    const target = folder("Imports");
    const file = JSON.stringify({ ...exported.header, items: exported.items });
    const revBefore = fileIndex().rev;
    const check = world.ok<ImportReport>(OWNER, "import", {
      folderId: target.id,
      file,
      dryRun: true,
    });
    expect(check).toMatchObject({
      dryRun: true,
      created: 2,
      skipped: 0,
      failed: 0,
      foldersCreated: 2,
    });
    expect(fileIndex().rev).toBe(revBefore);
    const done = world.ok<ImportReport>(OWNER, "import", {
      folderId: target.id,
      file,
    });
    expect(done).toMatchObject({
      dryRun: false,
      created: 2,
      foldersCreated: 2,
    });
    const index = fileIndex();
    const imported = index.folders.find(
      (f) => f.parentId === target.id && f.name === "Sales",
    );
    const price = index.items.find(
      (i) => i.title === "Price" && i.folderId === imported?.id,
    );
    expect(price?.subject).toBe("Quote for {{ask:Customer}}");
    expect(price?.prompts).toEqual(["Customer"]);
    expect(
      index.pendingAudit.filter((e) => e.action === "import"),
    ).toHaveLength(4);
    const again = world.ok<ImportReport>(OWNER, "import", {
      folderId: target.id,
      file,
    });
    expect(again).toMatchObject({
      created: 0,
      skipped: 2,
      foldersCreated: 0,
      foldersReused: 2,
    });
  });

  it("sanitizes bodies, flattens subject line breaks and fails long subjects and bad placeholders", () => {
    const target = folder("Imports");
    const file = importFile({
      items: [
        {
          meta: { title: "Script", subject: "Line one\r\nline two" },
          html: '<p onclick="x()">ok</p><script>alert(1)</script>',
        },
        { meta: { title: "Long", subject: "s".repeat(201) }, html: "<p>x</p>" },
        { meta: { title: "Unknown" }, html: "<p>{{nope.name}}</p>" },
        { meta: { title: "" }, html: "<p>x</p>" },
        { meta: { title: "Script" }, html: "<p>dup</p>" },
        "garbage",
      ],
    });
    const report = world.ok<ImportReport>(OWNER, "import", {
      folderId: target.id,
      file,
    });
    expect(report).toMatchObject({
      created: 1,
      skipped: 1,
      failed: 4,
      subjectsFlattened: 1,
    });
    expect(report.lines.map((l) => [l.name, l.outcome])).toEqual([
      ["Long", "failed"],
      ["Unknown", "failed"],
      ["#4", "failed"],
      ["Script", "skipped"],
      ["#6", "failed"],
    ]);
    expect(report.lines[0]?.reason).toContain("SUBJ_TOO_LONG");
    expect(report.lines[1]?.reason).toContain("PH_");
    const item = fileIndex().items.find((i) => i.title === "Script") as Item;
    expect(item.subject).toBe("Line one line two");
    const body = world.services.store().readBody(item.bodyFileId);
    expect(body.html).toBe("<p>ok</p>");
  });

  it("places nested folders, reuses a same-name sibling and fails folders past the depth limit", () => {
    const top = folder("Top");
    const target = folder("Target", top.id);
    folder("Existing", target.id);
    const chain = ["A", "B", "C", "D"].map((name, n, all) => ({
      id: name,
      parentId: n === 0 ? "" : (all[n - 1] ?? ""),
      name,
    }));
    const file = importFile({
      folders: [
        ...chain.reverse(),
        { id: "E", parentId: "", name: "existing" },
        { id: "X", parentId: "Y", name: "Loop" },
        { id: "Y", parentId: "X", name: "Loop2" },
      ],
      items: [
        { meta: { title: "In D", folderId: "D" }, html: "<p>d</p>" },
        { meta: { title: "In E", folderId: "E" }, html: "<p>e</p>" },
      ],
    });
    const report = world.ok<ImportReport>(OWNER, "import", {
      folderId: target.id,
      file,
    });
    expect(report).toMatchObject({
      foldersCreated: 3,
      foldersReused: 1,
      created: 1,
      failed: 1,
    });
    expect(
      report.lines.filter((l) => l.kind === "folder").map((l) => l.name),
    ).toEqual(["D", "Loop", "Loop2"]);
  });

  it("fails bad folder and template records with a reason, children of failed folders too", () => {
    const target = folder("Imports");
    const report = world.ok<ImportReport>(OWNER, "import", {
      folderId: target.id,
      file: importFile({
        folders: [
          { id: "L", parentId: "", name: "x".repeat(81) },
          { id: "K", parentId: "L", name: "Kid" },
          { name: "No id" },
          7,
        ],
        items: [
          { meta: { title: "In kid", folderId: "K" }, html: "<p>k</p>" },
          { meta: { title: "Bad tags", tags: [1] }, html: "<p>t</p>" },
          { meta: { title: "No html" } },
        ],
      }),
    });
    expect(report.lines.map((l) => [l.name, l.reason])).toEqual([
      ["No id", "Folder needs an id and a name"],
      ["#4", "Not a folder record"],
      ["x".repeat(81), "Folder name must be 1 to 80 characters"],
      ["Kid", "Its parent folder was not imported"],
      ["In kid", "Its folder was not imported"],
      ["Bad tags", "Template needs a title and text tags"],
      ["No html", "Template needs meta and html"],
    ]);
    expect(
      errorOf(OWNER, "import", {
        folderId: target.id,
        file: importFile({ folders: {} }),
      }),
    ).toBe("folders must be a list");
    expect(errorOf(OWNER, "import", { folderId: target.id, file: "[]" })).toBe(
      "The file is not a Migway export",
    );
  });

  it("enforces the schema version, size and count limits before anything is read", () => {
    const target = folder("Imports");
    const run = (file: string) =>
      errorOf(OWNER, "import", { folderId: target.id, file });
    expect(run("{")).toBe("The file is not valid JSON");
    expect(run(JSON.stringify({ schemaVersion: 2 }))).toContain(
      "Unsupported schema version",
    );
    expect(run("x".repeat(IMPORT_MAX_BYTES + 1))).toContain("larger than");
    const many = importFile({
      items: Array.from({ length: IMPORT_ITEMS_MAX + 1 }, () => ({})),
    });
    expect(run(many)).toContain("more than");
    expect(codeOf(OWNER, "import", { folderId: "missing", file: "{}" })).toBe(
      "VALIDATION",
    );
  });

  it("names the template and keeps the code when a body write fails; nothing enters the library", () => {
    const target = folder("Imports");
    const before = fileIndex();
    world.drive.failNext("create");
    const response = world.call(OWNER, "import", {
      folderId: target.id,
      file: importFile({
        items: [
          { meta: { title: "First" }, html: "<p>1</p>" },
          { meta: { title: "Second" }, html: "<p>2</p>" },
        ],
      }),
    });
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "INTERNAL",
        message:
          "Nothing was imported: the template First could not be saved. Run the import again.",
      },
    });
    expect(fileIndex()).toEqual(before);
  });

  it("keeps BUSY when the lock is taken and says nothing was imported", () => {
    const target = folder("Imports");
    world.lock.tryLock = () => false;
    expect(
      world.call(OWNER, "import", {
        folderId: target.id,
        file: importFile({
          items: [{ meta: { title: "A" }, html: "<p>a</p>" }],
        }),
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: "BUSY",
        message:
          "Nothing was imported: the library could not be written: Busy, try again. Run the import again.",
      },
    });
  });

  it("refuses duplicate folder ids in Validate", () => {
    const target = folder("Imports");
    const file = importFile({
      folders: [
        { id: "A", parentId: "", name: "One" },
        { id: "A", parentId: "", name: "Two" },
      ],
    });
    expect(
      errorOf(OWNER, "import", { folderId: target.id, file, dryRun: true }),
    ).toBe("Folders #1 and #2 of the file have the same id");
  });

  it("refuses a private folder as the import target", () => {
    const mine = world
      .ok<{ folders: Folder[] }>(ANA, "folder.list")
      .folders.find((f) => f.kind === "private") as Folder;
    const own = world
      .ok<{ folders: Folder[] }>(OWNER, "folder.list")
      .folders.find(
        (f) => f.kind === "private" && f.ownerEmail === OWNER,
      ) as Folder;
    const file = importFile({
      items: [{ meta: { title: "A" }, html: "<p>a</p>" }],
    });
    for (const target of [mine, own])
      expect(
        errorOf(OWNER, "import", { folderId: target.id, file, dryRun: true }),
      ).toBe(
        "Templates cannot be imported into a private folder. Pick a shared folder.",
      );
  });

  it("logs no title, subject or body of the import file", () => {
    const target = folder("Imports");
    world.lines.length = 0;
    world.ok(OWNER, "import", {
      folderId: target.id,
      file: importFile({
        items: [
          {
            meta: { title: "SecretTitle", subject: "SecretSubject" },
            html: "<p>SecretBody</p>",
          },
        ],
      }),
    });
    const line = world.lines.join("\n");
    expect(line).not.toMatch(/Secret/);
    expect(JSON.parse(world.lines.at(-1) ?? "{}")).toMatchObject({
      action: "import",
      actor: OWNER,
      targetId: target.id,
      result: "ok",
    });
  });
});

describe("config.get", () => {
  it("returns the wireframe values only, with job health", () => {
    world.props.setProperty(ADMIN_GROUP_KEY, "admins@example.com");
    world.props.setProperty("SOME_TOKEN", "do-not-show");
    world.props.setProperty(lastOkKey("tick"), "2026-11-09T11:58:00.000Z");
    world.props.setProperty(
      lastOkKey("refreshMembers"),
      "2026-11-09T11:00:00.000Z",
    );
    world.props.setProperty(lastErrorKey("refreshMembers"), "x GroupsApp down");
    world.props.setProperty(lastErrorKey("tick"), "old error");
    world.ok(OWNER, "config.get");
    const data = world.ok<ConfigView>(OWNER, "config.get");
    expect(lastCalls().drive).toBe(0);
    expect(data).toMatchObject({
      domain: "example.com",
      adminGroup: "admins@example.com",
      resolver: "groupsapp_direct",
      callerIdentity: "active_user",
      indexRev: world.props.getProperty(INDEX_REV_KEY),
      appVersion: "test-testsha",
      indexWarnBytes: INDEX_WARN_BYTES,
    });
    expect(data.indexBytes).toBeGreaterThan(0);
    expect(data.jobs).toEqual([
      expect.objectContaining({ name: "tick", status: "ok", lastError: "" }),
      expect.objectContaining({
        name: "refreshMembers",
        status: "late",
        lastError: "x GroupsApp down",
      }),
      expect.objectContaining({ name: "daily", status: "never" }),
    ]);
    const text = JSON.stringify(data);
    expect(text).not.toContain("do-not-show");
    expect(text).not.toContain("STORE");
    expect(text).not.toContain(OWNER);
  });

  it("shows the trigger reinstall error only while the reinstall is pending", () => {
    world.props.setProperty(lastErrorKey("triggers"), "x Trigger quota");
    expect(world.ok<ConfigView>(OWNER, "config.get").triggersError).toBe("");
    world.props.setProperty("TRIGGERS_VERSION", "0");
    expect(world.ok<ConfigView>(OWNER, "config.get").triggersError).toBe(
      "x Trigger quota",
    );
  });

  it("flags a job late only after 2 intervals", () => {
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(jobStatus("2026-11-09T11:50:00Z", 5 * 60 * 1000, now)).toBe("ok");
    expect(jobStatus("2026-11-09T11:49:59Z", 5 * 60 * 1000, now)).toBe("late");
    expect(jobStatus("", 5 * 60 * 1000, now)).toBe("never");
  });
});

describe("backups", () => {
  it("lists backup dates newest first", () => {
    runDaily(world.services);
    world.clock.now += 24 * HOUR_MS;
    runDaily(world.services);
    expect(world.ok(OWNER, "backup.list")).toEqual({
      dates: ["2026-11-10", "2026-11-09"],
    });
  });

  it("restores index, favorites and usage under the lock; readers see it; the audit trail is kept", () => {
    const sales = folder("Sales");
    const kept = template(sales.id, "Kept");
    world.ok(OWNER, "favorite.set", { id: kept.id });
    runDaily(world.services);
    world.clock.now += HOUR_MS;
    const later = template(sales.id, "Later");
    world.ok(OWNER, "favorite.unset", { id: kept.id });
    const pendingBefore = fileIndex().pendingAudit.map((e) => e.id);
    const revBefore = fileIndex().rev;
    world.lines.length = 0;
    const result = world.ok<{ date: string; rev: number }>(
      OWNER,
      "backup.restore",
      { date: "2026-11-09" },
    );
    expect(lastCalls().lock).toBe(1);
    expect(result).toEqual({ date: "2026-11-09", rev: revBefore + 1 });
    const index = fileIndex();
    expect(index.rev).toBe(revBefore + 1);
    expect(index.items.map((i) => i.id)).toEqual([kept.id]);
    expect(index.pendingAudit.map((e) => e.id).slice(0, -1)).toEqual(
      pendingBefore,
    );
    expect(index.pendingAudit.at(-1)).toMatchObject({
      action: "backup.restore",
      actor: OWNER,
      after: { date: "2026-11-09" },
    });
    expect(world.props.getProperty(INDEX_REV_KEY)).toBe(String(index.rev));
    const listed = world.ok<{ items: Item[]; favorites: string[] }>(
      OWNER,
      "template.list",
    );
    expect(listed.items.map((i) => i.id)).toEqual([kept.id]);
    expect(listed.favorites).toEqual([kept.id]);
    expect(later.id).not.toBe(kept.id);
    expect(JSON.parse(world.lines[0] ?? "{}")).toMatchObject({
      action: "backup.restore",
      targetId: "",
    });
  });

  /** The fake Drive files of the one backup folder, by name. */
  function backupCopies(): Map<string, { content: string; trashed: boolean }> {
    const folderId = world.services.store().listBackups()[0]?.id ?? "";
    return new Map(
      [...world.drive.files.values()]
        .filter((file) => file.parents.includes(folderId))
        .map((file) => [file.name, file]),
    );
  }

  /** Text of the live `index.json`, `favorites.json` and `usage.json`. */
  function liveFiles(): string[] {
    const ids = requireStoreIds(world.props);
    return [ids.indexId, ids.favoritesId, ids.usageId].map((id) =>
      world.drive.text(id),
    );
  }

  const today = () => new Date(world.clock.now).toISOString().slice(0, 10);

  it.each([
    [
      "index.json",
      '{"schemaVersion":1,"rev":3,"items":[]}',
      "folders must be a list",
    ],
    ["favorites.json", "{}", "rev must be an integer"],
    [
      "usage.json",
      '{"rev":2,"items":[],"recent":{}}',
      "items must be a record",
    ],
    ["index.json", "{not json", "is not valid JSON"],
  ])(
    "refuses a damaged %s copy with VALIDATION and leaves the live files alone",
    (name, content, problem) => {
      const sales = folder("Sales");
      const kept = template(sales.id, "Kept");
      world.ok(OWNER, "favorite.set", { id: kept.id });
      runDaily(world.services);
      const copy = backupCopies().get(name);
      if (copy === undefined) throw new Error(`no copy ${name}`);
      copy.content = content;
      const live = liveFiles();
      const response = world.call(OWNER, "backup.restore", { date: today() });
      expect(response).toMatchObject({
        ok: false,
        error: { code: "VALIDATION" },
      });
      const message = response.ok ? "" : response.error.message;
      expect(message).toContain(`This backup cannot be read: ${name}`);
      expect(message).toContain(problem);
      expect(liveFiles()).toEqual(live);
      expect(codeOf(OWNER, "template.list")).toBe("ok");
      expect(codeOf(OWNER, "sidebar.home", {}, "addon")).toBe("ok");
    },
  );

  it("refuses a backup with a missing copy, naming the file", () => {
    runDaily(world.services);
    const copy = backupCopies().get("favorites.json");
    if (copy !== undefined) copy.trashed = true;
    expect(errorOf(OWNER, "backup.restore", { date: today() })).toBe(
      "This backup cannot be read: favorites.json is missing",
    );
  });

  it("puts the side files back when the index write fails after them", () => {
    const sales = folder("Sales");
    const kept = template(sales.id, "Kept");
    runDaily(world.services);
    world.ok(OWNER, "favorite.set", { id: kept.id });
    const favoritesBefore = world.services.store().readSide("favorites");
    const indexBefore = fileIndex();
    const update = world.drive.Files.update.bind(world.drive.Files);
    let updates = 0;
    world.drive.Files.update = (...args: Parameters<typeof update>) => {
      updates += 1;
      if (updates === 3) throw new Error("Drive update failed");
      return update(...args);
    };
    expect(codeOf(OWNER, "backup.restore", { date: today() })).toBe("INTERNAL");
    world.drive.Files.update = update;
    expect(world.services.store().readSide("favorites").byUser).toEqual(
      favoritesBefore.byUser,
    );
    expect(fileIndex()).toEqual(indexBefore);
    expect(
      world.ok<{ favorites: string[] }>(OWNER, "template.list").favorites,
    ).toEqual([kept.id]);
  });

  it("refuses a backup whose live templates were emptied from the trash since, and drops purged trash", () => {
    const sales = folder("Sales");
    const live = template(sales.id, "Live then purged");
    const trashed = template(sales.id, "Trashed then purged");
    world.ok(OWNER, "template.delete", { id: trashed.id });
    runDaily(world.services);
    world.ok(OWNER, "trash.purge");
    expect(errorOf(OWNER, "backup.restore", { date: today() })).toBe("ok");
    expect(fileIndex().items.map((i) => i.id)).toEqual([live.id]);
    world.ok(OWNER, "template.delete", { id: live.id });
    world.ok(OWNER, "trash.purge");
    expect(errorOf(OWNER, "backup.restore", { date: today() })).toBe(
      `1 templates of the ${today()} backup were emptied from the trash after that date and would not open. Pick a newer backup.`,
    );
  });

  it("refuses a malformed or missing date", () => {
    expect(codeOf(OWNER, "backup.restore", { date: "yesterday" })).toBe(
      "VALIDATION",
    );
    expect(codeOf(OWNER, "backup.restore", { date: "2020-01-01" })).toBe(
      "NOT_FOUND",
    );
  });
});
