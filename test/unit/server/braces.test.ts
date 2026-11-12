import { beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import type { ImportReport } from "../../../src/server/handlers/transfer";
import { OWNER, setupWorld, type World } from "../../fakes/world";

/** Q78 skeleton rule on every write path (ADR-0004 Amendment 2026-11-12 "braces"). */
const JOINED = "<p>{{{ask:N}}{ask:M}}</p>";
const MESSAGE =
  "The braces at character 1 would show as {{ in the email. Delete one of them.";
let world: World;
let sales: Folder;

beforeEach(() => {
  world = setupWorld();
  sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
});

function problems(op: string, args: unknown): unknown {
  const response = world.call(OWNER, op, args);
  if (response.ok) throw new Error(`${op} unexpectedly succeeded`);
  expect(response.error.code).toBe("VALIDATION");
  return (response.error.details as { problems: unknown }).problems;
}

/** A template stored by a build before the rule: its body file holds the joined braces. */
function oldTemplate(): Item {
  const item = world.ok<Item>(OWNER, "template.create", {
    folderId: sales.id,
    title: "Old",
    html: "<p>x</p>",
  });
  const file = world.drive.files.get(item.bodyFileId);
  if (file === undefined) throw new Error("no body file");
  file.content = file.content.replace("<p>x</p>", JOINED);
  for (const key of world.cache.keys()) world.cache.remove(key);
  return item;
}

describe("braces that join around a field", () => {
  it("template.create refuses them with the ADR sentence", () => {
    expect(
      problems("template.create", {
        folderId: sales.id,
        title: "T",
        html: JOINED,
      }),
    ).toEqual([{ code: "PH_MALFORMED", message: MESSAGE, offset: 0 }]);
  });

  it("an old template still opens and inserts as before; its next save and duplicate are refused", () => {
    const item = oldTemplate();
    expect(
      world.ok<{ html: string }>(OWNER, "template.get", { id: item.id }).html,
    ).toBe(JOINED);
    const applied = world.ok(
      OWNER,
      "template.apply",
      { id: item.id, knownVersion: 0, recipientEmailIfInternal: "" },
      "addon",
    );
    expect(JSON.stringify(applied)).toContain("{{{ask:N}}{ask:M}}");
    expect(
      problems("template.update", {
        id: item.id,
        baseVersion: item.version,
        title: "Old",
        html: JOINED,
      }),
    ).toEqual([{ code: "PH_MALFORMED", message: MESSAGE, offset: 0 }]);
    expect(
      problems("template.duplicate", { id: item.id, folderId: sales.id }),
    ).toEqual([{ code: "PH_MALFORMED", message: MESSAGE, offset: 0 }]);
  });

  it("import reports the template as failed; export carries it unchanged", () => {
    const item = oldTemplate();
    const exported = world.ok<{ items: { html: string }[] }>(
      OWNER,
      "export.folder",
      { folderId: sales.id, start: true },
    );
    expect(JSON.stringify(exported)).not.toContain("PH_MALFORMED");
    expect(item.id).not.toBe("");
    const report = world.ok<ImportReport>(OWNER, "import", {
      folderId: sales.id,
      file: JSON.stringify({
        schemaVersion: 1,
        folders: [],
        items: [
          { meta: { title: "Joined" }, html: JOINED },
          { meta: { title: "Fine" }, html: "<p>{{{ask:N}}</p>" },
        ],
      }),
    });
    expect(report).toMatchObject({ created: 1, failed: 1 });
    expect(JSON.stringify(report.lines)).toContain("would show as {{");
  });
});
