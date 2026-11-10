import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import type { VersionEntry } from "../../../src/server/handlers/history";
import { mutateIndex } from "../../../src/server/storage/writer";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
const BOB = "bob@example.com";
let world: World;
let folder: Folder;

beforeEach(() => {
  world = setupWorld();
  folder = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
  expect(world.lock.hasLock()).toBe(false);
});

function grant(email: string, level: string): void {
  world.ok(OWNER, "grant.add", {
    folderId: folder.id,
    principalType: "user",
    principalKey: email,
    level,
  });
}

function errorOf(caller: string, op: string, args: unknown) {
  const response = world.call(caller, op, args);
  if (response.ok) throw new Error(`${op} unexpectedly succeeded`);
  return response.error;
}

/** Template with 3 versions: v1 has a prompt, v2 a sender name, v3 plain text. */
function threeVersions(): Item {
  const item = world.ok<Item>(OWNER, "template.create", {
    folderId: folder.id,
    title: "Quote",
    html: "<p>{{ask:Date}}</p>",
  });
  for (const [baseVersion, html] of [
    [1, "<p>{{sender.name}}</p>"],
    [2, "<p>plain</p>"],
  ] as const) {
    world.clock.now += 60000;
    world.ok(OWNER, "template.update", {
      id: item.id,
      baseVersion,
      title: "Quote",
      html,
    });
  }
  return item;
}

interface VersionList {
  currentVersion: number;
  versions: VersionEntry[];
}

describe("template.getBody (level use)", () => {
  it("returns sanitized HTML, names and prompts to a use holder on both surfaces", () => {
    const item = threeVersions();
    grant(ANA, "use");
    for (const surface of ["webapp", "addon"] as const) {
      expect(
        world.ok(ANA, "template.getBody", { id: item.id }, surface),
      ).toEqual({
        id: item.id,
        version: 3,
        html: "<p>plain</p>",
        placeholders: [],
        prompts: [],
      });
    }
    expect(errorOf(BOB, "template.getBody", { id: item.id }).code).toBe(
      "DENIED",
    );
  });

  it("sanitizes bodies stored before slice 3 on read", () => {
    const item = threeVersions();
    const store = world.services.store();
    const old = store.readBody(item.bodyFileId);
    const fileId = store.createBody({
      ...old,
      version: 4,
      html: '<p onclick="x">{{ask:Old}}</p><script>x</script>',
    });
    mutateIndex(world.services, (current) => ({
      doc: {
        ...current,
        items: current.items.map((entry) =>
          entry.id === item.id ? { ...entry, bodyFileId: fileId } : entry,
        ),
      },
      events: [],
      result: undefined,
    }));
    expect(world.ok(OWNER, "template.getBody", { id: item.id })).toMatchObject({
      html: "<p>{{ask:Old}}</p>",
      prompts: ["Old"],
    });
    expect(world.ok(OWNER, "template.get", { id: item.id })).toMatchObject({
      html: "<p>{{ask:Old}}</p>",
    });
  });
});

describe("version.list and version.get (level edit)", () => {
  it("lists committed versions newest first with the current flag", () => {
    const item = threeVersions();
    grant(ANA, "edit");
    const list = world.ok<VersionList>(ANA, "version.list", { id: item.id });
    expect(list.currentVersion).toBe(3);
    expect(list.versions.map((v) => [v.version, v.current])).toEqual([
      [3, true],
      [2, false],
      [1, false],
    ]);
    expect(list.versions[0]).toMatchObject({
      savedBy: OWNER,
      restoredFrom: 0,
    });
  });

  it("denies use holders and hides orphan files of uncommitted saves", () => {
    const item = threeVersions();
    grant(ANA, "use");
    expect(errorOf(ANA, "version.list", { id: item.id }).code).toBe("DENIED");
    expect(errorOf(ANA, "version.get", { id: item.id, version: 1 }).code).toBe(
      "DENIED",
    );
    const store = world.services.store();
    const current = store.readBody(item.bodyFileId);
    world.clock.now += 60000;
    store.createBody({ ...current, version: 3, html: "<p>orphan</p>" });
    store.createBody({ ...current, version: 4, html: "<p>future</p>" });
    const list = world.ok<VersionList>(OWNER, "version.list", { id: item.id });
    expect(list.versions.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(
      world.ok(OWNER, "version.get", { id: item.id, version: 3 }),
    ).toMatchObject({ html: "<p>plain</p>" });
  });

  it("reads one version with its prompts; unknown versions are NOT_FOUND", () => {
    const item = threeVersions();
    expect(
      world.ok(OWNER, "version.get", { id: item.id, version: 1 }),
    ).toMatchObject({
      version: 1,
      html: "<p>{{ask:Date}}</p>",
      savedBy: OWNER,
      restoredFrom: 0,
      prompts: ["Date"],
    });
    expect(
      errorOf(OWNER, "version.get", { id: item.id, version: 9 }).code,
    ).toBe("NOT_FOUND");
  });
});

describe("version.restore (level edit)", () => {
  it("creates version N+1 from version K with an audit row", () => {
    const item = threeVersions();
    grant(ANA, "edit");
    const restored = world.ok<Item>(ANA, "version.restore", {
      id: item.id,
      version: 1,
      baseVersion: 3,
    });
    expect(restored).toMatchObject({
      currentVersion: 4,
      version: 4,
      prompts: ["Date"],
      placeholders: [],
      updatedBy: ANA,
    });
    const body = world.services.store().readBody(restored.bodyFileId);
    expect(body).toMatchObject({
      version: 4,
      html: "<p>{{ask:Date}}</p>",
      restoredFrom: 1,
      savedBy: ANA,
    });
    const index = world.services.store().readIndex();
    expect(index.pendingAudit.at(-1)).toMatchObject({
      action: "version.restore",
      actor: ANA,
      targetId: item.id,
    });
    expect(JSON.parse(world.lines.at(-1) ?? "{}")).toMatchObject({
      action: "version.restore",
      targetId: item.id,
    });
    const list = world.ok<VersionList>(ANA, "version.list", { id: item.id });
    expect(list.versions[0]).toMatchObject({ version: 4, restoredFrom: 1 });
  });

  it("answers CONFLICT on a stale baseVersion and writes no body", () => {
    const item = threeVersions();
    const before = world.services.store().listBodies(item.id).length;
    expect(
      errorOf(OWNER, "version.restore", {
        id: item.id,
        version: 1,
        baseVersion: 2,
      }),
    ).toMatchObject({
      code: "CONFLICT",
      details: { currentVersion: 3, updatedBy: OWNER },
    });
    expect(world.services.store().listBodies(item.id)).toHaveLength(before);
  });

  it("denies use holders", () => {
    const item = threeVersions();
    grant(ANA, "use");
    expect(
      errorOf(ANA, "version.restore", {
        id: item.id,
        version: 1,
        baseVersion: 3,
      }).code,
    ).toBe("DENIED");
  });
});

describe("IMG_HOSTS (ADR-0004 Q12)", () => {
  it("restricts image hosts on save when the property lists hosts", () => {
    world.props.setProperty("IMG_HOSTS", " CDN.example.com, ,other.com");
    const item = world.ok<Item>(OWNER, "template.create", {
      folderId: folder.id,
      title: "Img",
      html: '<img src="https://cdn.example.com/a.png"><img src="https://evil.example/b.png">',
    });
    expect(world.ok(OWNER, "template.getBody", { id: item.id })).toMatchObject({
      html: '<img src="https://cdn.example.com/a.png"><img>',
    });
  });
});
