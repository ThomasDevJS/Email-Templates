import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import type { ApplyResult } from "../../../src/shared/model/sidebar";
import { OWNER, setupWorld, type World } from "../../fakes/world";

/** Template subject on the server (spec 5.6, D21): save validation, storage, history, duplicate, apply. */
const ANA = "ana@example.com";
let world: World;
let folder: Folder;

beforeEach(() => {
  world = setupWorld();
  folder = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
  world.ok(OWNER, "grant.add", {
    folderId: folder.id,
    principalType: "user",
    principalKey: ANA,
    level: "use",
  });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
});

function create(subject: string, html = "<p>Hi {{ask:Product}}</p>"): Item {
  return world.ok<Item>(OWNER, "template.create", {
    folderId: folder.id,
    title: "Quote",
    subject,
    html,
  });
}

function problemsOf(op: string, args: unknown) {
  const response = world.call(OWNER, op, args);
  if (response.ok) throw new Error(`${op} unexpectedly succeeded`);
  expect(response.error.code).toBe("VALIDATION");
  const details = response.error.details as {
    problems: { code: string; field?: string; offset: number | null }[];
  };
  return details.problems;
}

function bodyFile(item: Item): Record<string, unknown> {
  const text = world.drive.files.get(item.bodyFileId)?.content ?? "{}";
  return JSON.parse(text) as Record<string, unknown>;
}

describe("subject on save", () => {
  it("stores the trimmed subject on the item and in the version file; prompts are shared with the body", () => {
    const item = create("  Quote for {{ask:product}} {{sender.name}} ");
    expect(item.subject).toBe("Quote for {{ask:product}} {{sender.name}}");
    expect(item.prompts).toEqual(["product"]);
    expect(item.placeholders).toEqual(["sender.name"]);
    expect(bodyFile(item)["subject"]).toBe(item.subject);
  });

  it.each([
    ["x".repeat(201), "SUBJ_TOO_LONG", 200],
    ["one\ntwo", "SUBJ_LINEBREAK", 3],
    ["tab\there", "SUBJ_LINEBREAK", 3],
    ["sep x", "SUBJ_LINEBREAK", 3],
    ["{{sender.nmae}}", "PH_UNKNOWN", 0],
    ["ab {{Sender.name}}", "PH_CASE", 3],
    ["{{ask:}}", "PH_LABEL", 0],
    ["{{ask:A|b}}", "PH_FALLBACK_ASK", 0],
    ["open {{sender.name", "PH_MALFORMED", 5],
  ])(
    "create rejects %j with %s at %d, field subject",
    (subject, code, offset) => {
      expect(
        problemsOf("template.create", {
          folderId: folder.id,
          title: "T",
          subject,
          html: "<p>x</p>",
        }),
      ).toEqual([expect.objectContaining({ code, offset, field: "subject" })]);
    },
  );

  it("accepts 200 characters and the \\{{ escape", () => {
    expect(create("y".repeat(200)).subject).toHaveLength(200);
    expect(create("\\{{literal}}").subject).toBe("\\{{literal}}");
  });

  it("counts PH_TOO_MANY over subject and body together", () => {
    const asks = (from: number, to: number) =>
      Array.from(
        { length: to - from },
        (_, n) => `{{ask:P${String(from + n)}}}`,
      ).join(" ");
    expect(create(asks(0, 10), `<p>${asks(10, 20)}</p>`).prompts).toHaveLength(
      20,
    );
    expect(
      problemsOf("template.create", {
        folderId: folder.id,
        title: "T",
        subject: asks(0, 11),
        html: `<p>${asks(11, 21)}</p>`,
      }).map((p) => p.code),
    ).toEqual(["PH_TOO_MANY"]);
  });

  it("update validates and replaces the subject; omitted means empty", () => {
    const item = create("Old");
    expect(
      problemsOf("template.update", {
        id: item.id,
        baseVersion: 1,
        title: "Quote",
        subject: "a\r\nb",
        html: "<p>x</p>",
      })[0],
    ).toMatchObject({ code: "SUBJ_LINEBREAK", field: "subject" });
    const next = world.ok<Item>(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "Quote",
      subject: "New",
      html: "<p>x</p>",
    });
    expect(next.subject).toBe("New");
    const cleared = world.ok<Item>(OWNER, "template.update", {
      id: item.id,
      baseVersion: 2,
      title: "Quote",
      html: "<p>x</p>",
    });
    expect(cleared.subject).toBe("");
  });

  it("duplicate carries the subject into version 1 of the copy", () => {
    const item = create("Quote for {{ask:Product}}");
    const copy = world.ok<Item>(OWNER, "template.duplicate", { id: item.id });
    expect(copy.subject).toBe(item.subject);
    expect(bodyFile(copy)["subject"]).toBe(item.subject);
  });
});

describe("subject in history", () => {
  it("version.get returns each version's subject and restore copies it", () => {
    const item = create("First");
    world.ok(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "Quote",
      subject: "Second",
      html: "<p>two</p>",
    });
    const v1 = world.ok<{ subject: string }>(OWNER, "version.get", {
      id: item.id,
      version: 1,
    });
    expect(v1.subject).toBe("First");
    const restored = world.ok<Item>(OWNER, "version.restore", {
      id: item.id,
      version: 1,
      baseVersion: 2,
    });
    expect(restored.subject).toBe("First");
    expect(restored.prompts).toEqual(["Product"]);
    expect(bodyFile(restored)["subject"]).toBe("First");
  });

  it("restore of a version file without subject gives an empty subject", () => {
    const item = create("Set later");
    const file = world.drive.files.get(item.bodyFileId);
    if (file === undefined) throw new Error("no body file");
    const stored = JSON.parse(file.content) as Record<string, unknown>;
    Reflect.deleteProperty(stored, "subject");
    file.content = JSON.stringify(stored);
    expect(
      world.ok<{ subject: string }>(OWNER, "version.get", {
        id: item.id,
        version: 1,
      }).subject,
    ).toBe("");
    expect(
      world.ok<Item>(OWNER, "version.restore", {
        id: item.id,
        version: 1,
        baseVersion: 1,
      }).subject,
    ).toBe("");
  });
});

describe("subject on read", () => {
  it("template.getBody and template.apply return it with the body, prompts over both", () => {
    const item = create("Quote for {{ask:Total}}");
    expect(
      world.ok(ANA, "template.getBody", { id: item.id }, "addon"),
    ).toMatchObject({ subject: item.subject, prompts: ["Total", "Product"] });
    const applied = world.ok<ApplyResult>(
      ANA,
      "template.apply",
      { id: item.id, knownVersion: 0 },
      "addon",
    );
    expect(applied.subject).toBe(item.subject);
    const known = world.ok<ApplyResult>(
      ANA,
      "template.apply",
      { id: item.id, knownVersion: 1 },
      "addon",
    );
    expect(known).toMatchObject({ html: null, subject: null });
  });

  it("never logs the subject", () => {
    const item = create("Secret subject line");
    world.ok(ANA, "template.apply", { id: item.id, knownVersion: 0 }, "addon");
    world.ok(ANA, "template.getBody", { id: item.id }, "addon");
    expect(world.lines.length).toBeGreaterThan(2);
    expect(world.lines.join("\n")).not.toContain("Secret subject");
  });
});
