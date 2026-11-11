import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, IndexDoc, Item } from "../../../src/shared/model/data";
import type {
  ApplyResult,
  SidebarHome,
  SidebarTemplate,
} from "../../../src/shared/model/sidebar";
import type {
  ExportPage,
  ImportReport,
} from "../../../src/server/handlers/transfer";
import { mutateIndex } from "../../../src/server/storage/writer";
import { OWNER, setupWorld, type World } from "../../fakes/world";

/** Template recipients on the server (D26, spec 5.7, section 6): write paths, apply view, counts, switch. */
const ANA = "ana@example.com";
const TO = "payroll@example.com";
const CC = "safety@example.com";
const OUT = "records@partner.com";
let world: World;
let sales: Folder;

beforeEach(() => {
  world = setupWorld();
  sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
  world.ok(OWNER, "grant.add", {
    folderId: sales.id,
    principalType: "user",
    principalKey: ANA,
    level: "use",
  });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
});

function deny(): void {
  world.props.setProperty("RECIPIENTS_EXTERNAL", "deny");
}

function create(fields: Record<string, unknown> = {}): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId: sales.id,
    title: "Driver leaving",
    html: "<p>Hi</p>",
    to: [TO],
    cc: [` ${CC.toUpperCase()} `, OUT],
    bcc: [],
    ...fields,
  });
}

function fileIndex(): IndexDoc {
  return world.services.store().readIndex();
}

function bodyFile(item: Item): Record<string, unknown> {
  return JSON.parse(
    world.drive.files.get(item.bodyFileId)?.content ?? "{}",
  ) as Record<string, unknown>;
}

function problemCodes(op: string, args: unknown): string[] {
  const response = world.call(OWNER, op, args);
  if (response.ok) throw new Error(`${op} unexpectedly succeeded`);
  expect(response.error.code).toBe("VALIDATION");
  const details = response.error.details as { problems: { code: string }[] };
  return details.problems.map((p) => p.code);
}

function update(item: Item, fields: Record<string, unknown>): Item {
  return world.ok<Item>(OWNER, "template.update", {
    id: item.id,
    baseVersion: item.currentVersion,
    title: item.title,
    html: "<p>Hi</p>",
    ...fields,
  });
}

/** An item saved before slice 9: no `to`, `cc`, `bcc` keys in the index or the version file. */
function legacyItem(): Item {
  const item = world.ok<Item>(OWNER, "template.create", {
    folderId: sales.id,
    title: "Old",
    html: "<p>Old</p>",
  });
  mutateIndex(world.services, (current) => ({
    doc: {
      ...current,
      items: current.items.map((i) => {
        if (i.id !== item.id) return i;
        return Object.fromEntries(
          Object.entries(i).filter(
            ([key]) => !["to", "cc", "bcc"].includes(key),
          ),
        ) as unknown as Item;
      }),
    },
    events: [],
    result: null,
  }));
  return item;
}

describe("save (create, update)", () => {
  it("stores normalized lists on the item, in the version file and in the audit event", () => {
    const item = create();
    expect(item).toMatchObject({ to: [TO], cc: [CC, OUT], bcc: [] });
    expect(bodyFile(item)).toMatchObject({ to: [TO], cc: [CC, OUT], bcc: [] });
    expect(fileIndex().pendingAudit.at(-1)?.after).toMatchObject({
      to: [TO],
      cc: [CC, OUT],
    });
  });

  it("returns recipient problems with the body problems in one VALIDATION", () => {
    expect(
      problemCodes("template.create", {
        folderId: sales.id,
        title: "T",
        html: "<p>{{sender.nmae}}</p>",
        to: ["nope", TO],
        cc: [TO],
      }),
    ).toEqual(["PH_UNKNOWN", "RCPT_FORMAT", "RCPT_DUPLICATE"]);
  });

  it("refuses a non-list argument", () => {
    const response = world.call(OWNER, "template.create", {
      folderId: sales.id,
      title: "T",
      cc: "a@example.com",
    });
    expect(response.ok ? "" : response.error.message).toBe(
      "cc: expected a list of strings",
    );
  });

  it("an update changes the lists and the audit event shows before and after", () => {
    const item = create();
    const next = update(item, { to: [], cc: [CC], bcc: [OUT] });
    expect(next).toMatchObject({ to: [], cc: [CC], bcc: [OUT] });
    expect(fileIndex().pendingAudit.at(-1)).toMatchObject({
      action: "template.update",
      before: { to: [TO], cc: [CC, OUT], bcc: [] },
      after: { to: [], cc: [CC], bcc: [OUT] },
    });
  });

  it("an update without recipient arguments keeps the stored lists (the editor before slice 8b)", () => {
    const item = create();
    const next = update(item, { cc: [CC] });
    expect(next).toMatchObject({ to: [TO], cc: [CC], bcc: [] });
  });

  it("a use holder cannot change recipients", () => {
    const item = create();
    const response = world.call(ANA, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "x",
      to: [],
    });
    expect(response.ok ? "" : response.error.code).toBe("DENIED");
    expect(fileIndex().items.find((i) => i.id === item.id)?.to).toEqual([TO]);
  });
});

describe("old data (no recipient fields)", () => {
  it("reads as no recipients with no write", () => {
    const item = legacyItem();
    const rev = fileIndex().rev;
    expect(
      world.ok<{ item: Item }>(OWNER, "template.get", { id: item.id }).item,
    ).toMatchObject({ to: [], cc: [], bcc: [] });
    expect(
      world.ok<ApplyResult>(ANA, "template.apply", {
        id: item.id,
        knownVersion: 0,
      }),
    ).toMatchObject({ to: [], cc: [], bcc: [], blocked: [] });
    const row = world
      .ok<SidebarHome>(ANA, "sidebar.home")
      .templates.find((t) => t.id === item.id);
    expect(row?.rc).toBeUndefined();
    expect(fileIndex().rev).toBe(rev);
  });
});

describe("version file shape", () => {
  it("a malformed list in a version file reads as empty, restore names it, nothing is written on read", () => {
    const item = create();
    const file = world.drive.files.get(item.bodyFileId);
    if (file === undefined) throw new Error("no body file");
    file.content = JSON.stringify({
      ...bodyFile(item),
      cc: "x@y.zz",
      bcc: [1],
    });
    const v2 = update(item, { cc: [] });
    const rev = fileIndex().rev;
    expect(
      world.ok(OWNER, "version.get", { id: item.id, version: 1 }),
    ).toMatchObject({ to: [TO], cc: [], bcc: [] });
    expect(fileIndex().rev).toBe(rev);
    const restored = world.ok<Item & { recipientsUnreadable: string[] }>(
      OWNER,
      "version.restore",
      { id: item.id, version: 1, baseVersion: v2.currentVersion },
    );
    expect(restored).toMatchObject({
      to: [TO],
      cc: [],
      bcc: [],
      recipientsUnreadable: ["cc", "bcc"],
    });
  });
});

describe("duplicate, restore, version.get", () => {
  it("duplicate copies the lists; restore copies the lists of version K", () => {
    const item = create();
    const copy = world.ok<Item>(OWNER, "template.duplicate", { id: item.id });
    expect(copy).toMatchObject({ to: [TO], cc: [CC, OUT], bcc: [] });
    const v2 = update(item, { to: [], cc: [], bcc: [] });
    expect(
      world.ok(OWNER, "version.get", { id: item.id, version: 1 }),
    ).toMatchObject({ to: [TO], cc: [CC, OUT], bcc: [] });
    const v3 = world.ok<Item>(OWNER, "version.restore", {
      id: item.id,
      version: 1,
      baseVersion: v2.currentVersion,
    });
    expect(v3).toMatchObject({ currentVersion: 3, to: [TO], cc: [CC, OUT] });
    expect(bodyFile(v3)).toMatchObject({ to: [TO], cc: [CC, OUT] });
  });
});

describe("RECIPIENTS_EXTERNAL=deny", () => {
  it("refuses outside addresses on create; inside ones save", () => {
    deny();
    expect(
      problemCodes("template.create", {
        folderId: sales.id,
        title: "T",
        bcc: [OUT],
      }),
    ).toEqual(["RCPT_EXTERNAL"]);
    expect(create({ cc: [CC] }).cc).toEqual([CC]);
  });

  it("keeps stored outside addresses, returns them as blocked, refuses the next save, duplicate and restore", () => {
    const item = create();
    deny();
    const applied = world.ok<ApplyResult>(ANA, "template.apply", {
      id: item.id,
      knownVersion: 1,
    });
    expect(applied).toMatchObject({
      to: [TO],
      cc: [CC],
      bcc: [],
      blocked: [OUT],
      html: null,
    });
    expect(
      world.ok(ANA, "template.getBody", { id: item.id }, "addon"),
    ).toMatchObject({ cc: [CC], blocked: [OUT] });
    expect(fileIndex().items.find((i) => i.id === item.id)?.cc).toEqual([
      CC,
      OUT,
    ]);
    expect(
      problemCodes("template.update", {
        id: item.id,
        baseVersion: 1,
        title: "x",
      }),
    ).toEqual(["RCPT_EXTERNAL"]);
    expect(problemCodes("template.duplicate", { id: item.id })).toEqual([
      "RCPT_EXTERNAL",
    ]);
    const v2 = update(item, { cc: [CC] });
    expect(
      problemCodes("version.restore", {
        id: item.id,
        version: 1,
        baseVersion: v2.currentVersion,
      }),
    ).toEqual(["RCPT_EXTERNAL"]);
  });
});

describe("sidebar counts and the switch value", () => {
  it("lists carry rc counts only, filtered by the switch; no address", () => {
    const item = create();
    const plain = world.ok<Item>(OWNER, "template.create", {
      folderId: sales.id,
      title: "Plain",
      html: "<p>x</p>",
    });
    const rowOf = (templates: readonly SidebarTemplate[], id: string) =>
      templates.find((t) => t.id === id);
    const home = world.ok<SidebarHome>(ANA, "sidebar.home");
    expect(rowOf(home.templates, item.id)?.rc).toEqual([1, 2, 0]);
    expect(rowOf(home.templates, plain.id)?.rc).toBeUndefined();
    expect(JSON.stringify(home)).not.toContain('@example.com"]');
    expect(JSON.stringify(home)).not.toContain(OUT);
    const found = world.ok<{ results: SidebarTemplate[] }>(ANA, "search", {
      query: "driver",
    });
    expect(found.results[0]?.rc).toEqual([1, 2, 0]);
    deny();
    expect(
      rowOf(world.ok<SidebarHome>(ANA, "sidebar.home").templates, item.id)?.rc,
    ).toEqual([1, 1, 0]);
  });

  it("me and config.get report the switch", () => {
    expect(world.ok(ANA, "me")).toMatchObject({ recipientsExternal: "allow" });
    deny();
    expect(world.ok(ANA, "me")).toMatchObject({ recipientsExternal: "deny" });
    expect(world.ok(OWNER, "config.get")).toMatchObject({
      recipientsExternal: "deny",
    });
  });
});

describe("export and import", () => {
  function exported(): string {
    const page = world.ok<ExportPage>(OWNER, "export.folder", {
      folderId: sales.id,
    });
    return JSON.stringify({ ...page.header, items: page.items });
  }

  function target(): Folder {
    return world.ok<Folder>(OWNER, "folder.create", { name: "Imports" });
  }

  it("exports the lists in meta and imports them back", () => {
    const original = create();
    const file = exported();
    expect(JSON.parse(file)).toMatchObject({
      items: [{ meta: { to: [TO], cc: [CC, OUT], bcc: [] } }],
    });
    const into = target();
    const report = world.ok<ImportReport>(OWNER, "import", {
      folderId: into.id,
      file,
    });
    expect(report).toMatchObject({ created: 1, addressesDropped: 0 });
    const imported = fileIndex().items.find(
      (i) => i.title === original.title && i.id !== original.id,
    );
    expect(imported).toMatchObject({ to: [TO], cc: [CC, OUT] });
  });

  it("drops bad, outside (deny) and repeated addresses and reports the count per template", () => {
    const into = target();
    deny();
    const file = JSON.stringify({
      schemaVersion: 1,
      folders: [],
      grants: [],
      items: [
        {
          meta: {
            title: "Mixed",
            to: [TO, "bad"],
            cc: [TO.toUpperCase(), OUT],
          },
          html: "<p>x</p>",
        },
      ],
    });
    const report = world.ok<ImportReport>(OWNER, "import", {
      folderId: into.id,
      file,
    });
    expect(report).toMatchObject({ created: 1, addressesDropped: 3 });
    expect(report.lines).toEqual([
      {
        kind: "template",
        name: "Mixed",
        outcome: "imported",
        reason:
          "3 addresses dropped: not an email address (1), already in an earlier field (1), outside the domain, turned off by the admin (1)",
      },
    ]);
    expect(fileIndex().items.find((i) => i.title === "Mixed")).toMatchObject({
      to: [TO],
      cc: [],
      bcc: [],
    });
    expect(world.lines.join("\n")).not.toContain(OUT);
  });

  it("refuses the whole file when a template has too many addresses", () => {
    const into = target();
    const rev = fileIndex().rev;
    const file = JSON.stringify({
      schemaVersion: 1,
      folders: [],
      grants: [],
      items: [
        { meta: { title: "Fine" }, html: "<p>x</p>" },
        {
          meta: {
            title: "Big",
            cc: Array.from(
              { length: 11 },
              (_, n) => `c${String(n)}@example.com`,
            ),
          },
          html: "<p>x</p>",
        },
      ],
    });
    const response = world.call(OWNER, "import", { folderId: into.id, file });
    expect(response.ok ? "" : response.error.message).toBe(
      "Nothing was imported: the template Big: Cc holds 11 addresses. Use at most 10 per field.",
    );
    expect(fileIndex().rev).toBe(rev);
  });

  it("fails one record whose lists are not lists of text", () => {
    const into = target();
    const file = JSON.stringify({
      schemaVersion: 1,
      folders: [],
      grants: [],
      items: [
        { meta: { title: "Odd", cc: "x@example.com" }, html: "<p>x</p>" },
      ],
    });
    expect(
      world.ok<ImportReport>(OWNER, "import", { folderId: into.id, file }),
    ).toMatchObject({
      failed: 1,
      lines: [
        expect.objectContaining({
          reason: "To, Cc and Bcc must be lists of text",
        }),
      ],
    });
  });
});

describe("logs", () => {
  it("no log line carries a template address", () => {
    const item = create();
    deny();
    world.ok(ANA, "template.apply", { id: item.id, knownVersion: 0 }, "addon");
    world.ok(ANA, "sidebar.home");
    problemCodes("template.create", {
      folderId: sales.id,
      title: "T",
      cc: [OUT],
    });
    const text = world.lines.join("\n");
    for (const address of [TO, CC, OUT]) expect(text).not.toContain(address);
  });
});
