import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEvent, BodyFile } from "../../../src/shared/model/data";
import {
  advancedDriveClient,
  type AdvancedFiles,
} from "../../../src/server/storage/advancedDrive";
import {
  appPropertyQuery,
  childQuery,
  quote,
  toDriveFile,
  type DriveClient,
} from "../../../src/server/storage/driveClient";
import { bodyName, driveStore } from "../../../src/server/storage/driveStore";
import {
  restDriveClient,
  restMediaReader,
} from "../../../src/server/storage/restDrive";
import {
  DATA_FOLDER_NAME,
  ensureStore,
  readStoreIds,
  requireStoreIds,
  STORE_KEY,
} from "../../../src/server/storage/setupStore";
import {
  createDrive,
  driveRestResponder,
  FOLDER_MIME,
  type FakeDrive,
} from "../../fakes/drive";
import { createUtilities, fakeBlob } from "../../fakes/output";
import { FakeProperties } from "../../fakes/properties";
import { createUrlFetchApp } from "../../fakes/urlFetch";

const NOW = "2026-11-09T12:00:00.000Z";

/** Advanced client as runtime.ts builds it: raw media through Drive REST on the fake UrlFetchApp. */
function advanced(
  drive: FakeDrive,
  files: AdvancedFiles = drive.Files,
): DriveClient {
  const fetchApp = createUrlFetchApp();
  fetchApp.respondWith(driveRestResponder(drive));
  return advancedDriveClient(
    files,
    createUtilities(),
    restMediaReader(
      (url, options) => fetchApp.fetch(url, options),
      () => "token",
    ),
  );
}

function clients(drive: FakeDrive): [string, () => DriveClient][] {
  return [
    ["advanced", () => advanced(drive)],
    [
      "rest",
      () => {
        const fetchApp = createUrlFetchApp();
        fetchApp.respondWith(driveRestResponder(drive));
        return restDriveClient(
          (url, options) => fetchApp.fetch(url, options),
          () => "token",
        );
      },
    ],
  ];
}

describe.each(["advanced", "rest"] as const)(
  "Drive client %s on the fake Drive",
  (kind) => {
    let drive: FakeDrive;
    let client: DriveClient;

    beforeEach(() => {
      drive = createDrive(() => Date.parse(NOW));
      const entry = clients(drive).find(([name]) => name === kind);
      client = entry?.[1]() as DriveClient;
    });

    it("creates folders and files, round-trips media and reports sizes", () => {
      const folder = client.createFolder("data", "");
      const text = JSON.stringify({ greeting: "Grüße 😀", list: [1, 2, 3] });
      const id = client.createFile({
        name: "a.json",
        parentId: folder,
        text,
        appProperties: { rev: "1" },
      });
      expect(client.readText(id)).toBe(text);
      const meta = client.getMeta(id);
      expect(meta).toMatchObject({
        id,
        name: "a.json",
        mimeType: "application/json",
        appProperties: { rev: "1" },
      });
      expect(meta.size).toBe(Buffer.byteLength(text, "utf8"));
      expect(drive.files.get(folder)?.mimeType).toBe(FOLDER_MIME);
    });

    it("updates media and merges appProperties", () => {
      const id = client.createFile({
        name: "b.json",
        parentId: "p",
        text: '{"n":1}',
        appProperties: { a: "1", b: "1" },
      });
      client.updateFile(id, '{"n":2}', { b: "2" });
      client.updateFile(id, '{"n":3}');
      expect(client.readText(id)).toBe('{"n":3}');
      expect(client.getMeta(id).appProperties).toEqual({ a: "1", b: "2" });
    });

    it("lists by parent and appProperties, skips trashed files, follows pages", () => {
      for (let n = 0; n < 5; n++)
        client.createFile({
          name: `v${String(n)}`,
          parentId: "bodies",
          text: "x",
          appProperties: { itemId: n < 3 ? "A" : "B" },
        });
      const trashed = client.createFile({
        name: "gone",
        parentId: "bodies",
        text: "x",
        appProperties: { itemId: "A" },
      });
      client.trash(trashed);
      expect(
        client.list(childQuery("bodies", appPropertyQuery("itemId", "A"))),
      ).toHaveLength(3);
      expect(client.list(childQuery("bodies"))).toHaveLength(5);
    });

    it("copies a file with content into another folder", () => {
      const id = client.createFile({
        name: "c.json",
        parentId: "p",
        text: '{"copy":"me"}',
      });
      const copy = client.copy(id, "c.json", "backup");
      expect(copy).not.toBe(id);
      expect(client.readText(copy)).toBe('{"copy":"me"}');
      expect(drive.files.get(copy)?.parents).toEqual(["backup"]);
    });

    it("reads JSON Lines exactly through readRawText; readText fails on 2 lines only with the Advanced service", () => {
      const one = '{"id":"a"}\n';
      const two = '{"id":"a"}\n\n{broken\n{"id":"b"}\n';
      const oneId = client.createFile({
        name: "1.jsonl",
        parentId: "p",
        text: one,
      });
      const twoId = client.createFile({
        name: "2.jsonl",
        parentId: "p",
        text: two,
      });
      expect([client.readRawText(oneId), client.readRawText(twoId)]).toEqual([
        one,
        two,
      ]);
      expect(client.readText(oneId)).toBe(
        kind === "advanced" ? '{"id":"a"}' : one,
      );
      if (kind === "advanced")
        expect(() => client.readText(twoId)).toThrow(
          "HttpResponseException: Response Code: 200.",
        );
      else expect(client.readText(twoId)).toBe(two);
    });
  },
);

describe("Drive client details", () => {
  it("advanced client pages through list results of 1,000", () => {
    const drive = createDrive();
    for (let n = 0; n < 1001; n++)
      drive.add({ name: `f${String(n)}`, parents: ["p"] }, "");
    const client = advanced(drive);
    expect(client.list(childQuery("p"))).toHaveLength(1001);
    expect(drive.calls.filter((call) => call === "list")).toHaveLength(2);
  });

  it("advanced client reads media returned as bytes or as a blob", () => {
    const bytes = [...Buffer.from("héllo", "utf8")];
    const asBytes = advanced(createDrive(), {
      ...createDrive().Files,
      get: () => bytes,
    });
    const asBlob = advanced(createDrive(), {
      ...createDrive().Files,
      get: () => fakeBlob("blob text"),
    });
    const asNumber = advanced(createDrive(), {
      ...createDrive().Files,
      get: () => 42,
    });
    expect(asBytes.readText("x")).toBe("héllo");
    expect(asBlob.readText("x")).toBe("blob text");
    expect(() => asNumber.readText("x")).toThrow("Unreadable Drive media");
  });

  it("rest client sends the bearer token and fails on HTTP errors", () => {
    const fetchApp = createUrlFetchApp();
    fetchApp.respondWith(() => ({ status: 403, body: "" }));
    const client = restDriveClient(
      (url, options) => fetchApp.fetch(url, options),
      () => "tok",
    );
    expect(() => client.readText("x")).toThrow(
      "Drive REST get failed with HTTP 403",
    );
    expect(fetchApp.requests[0]?.params.headers).toEqual({
      Authorization: "Bearer tok",
    });
    expect(fetchApp.requests[0]?.url).toBe(
      "https://www.googleapis.com/drive/v3/files/x?alt=media",
    );
  });

  it("quotes query literals and normalizes resources", () => {
    expect(quote("it's a\\b")).toBe("'it\\'s a\\\\b'");
    expect(toDriveFile(null)).toEqual({
      id: "",
      name: "",
      mimeType: "",
      appProperties: {},
      createdTime: "",
      size: 0,
    });
    expect(
      toDriveFile({ appProperties: { a: "1", b: 2 } }).appProperties,
    ).toEqual({ a: "1" });
  });
});

describe("setup of the data folder (ADR-0002 Layout)", () => {
  it("creates the folder, 3 subfolders and 4 files with index schemaVersion 1, rev 1, then nothing on rerun", () => {
    const drive = createDrive();
    const props = new FakeProperties();
    const client = advanced(drive);
    const first = ensureStore(client, props, NOW, "groupsapp_direct");
    expect(first.created).toBe(8);
    const ids = requireStoreIds(props);
    expect(drive.files.get(ids.rootId)?.name).toBe(DATA_FOLDER_NAME);
    for (const sub of ["bodiesId", "auditId", "backupsId"] as const)
      expect(drive.files.get(ids[sub])?.parents).toEqual([ids.rootId]);
    expect(JSON.parse(drive.text(ids.indexId))).toEqual({
      schemaVersion: 1,
      rev: 1,
      updatedAt: NOW,
      folders: [],
      grants: [],
      items: [],
      pendingAudit: [],
    });
    expect(drive.files.get(ids.indexId)?.appProperties).toEqual({ rev: "1" });
    expect(JSON.parse(drive.text(ids.favoritesId))).toEqual({
      rev: 1,
      byUser: {},
    });
    expect(JSON.parse(drive.text(ids.usageId))).toEqual({
      rev: 1,
      items: {},
      recent: {},
    });
    expect(JSON.parse(drive.text(ids.membersId))).toMatchObject({
      resolver: "groupsapp_direct",
      groups: {},
    });
    const before = drive.files.size;
    expect(ensureStore(client, props, NOW, "groupsapp_direct").created).toBe(0);
    expect(drive.files.size).toBe(before);
  });

  it("continues after a crash halfway without duplicating what exists", () => {
    const drive = createDrive();
    const props = new FakeProperties();
    const client = advanced(drive);
    let calls = 0;
    const flaky: DriveClient = {
      ...client,
      createFile: (file) => {
        if (++calls === 2) throw new Error("Drive hiccup");
        return client.createFile(file);
      },
    };
    expect(() => ensureStore(flaky, props, NOW, "groupsapp_direct")).toThrow(
      "Drive hiccup",
    );
    expect(Object.keys(readStoreIds(props))).toHaveLength(5);
    expect(ensureStore(client, props, NOW, "groupsapp_direct").created).toBe(3);
    expect(drive.byName(DATA_FOLDER_NAME)).toHaveLength(1);
    expect(drive.byName("index.json")).toHaveLength(1);
  });

  it("requires setup before use", () => {
    const props = new FakeProperties();
    expect(() => requireStoreIds(props)).toThrow(
      "Migway Templates is not set up yet",
    );
    props.setProperty(STORE_KEY, "");
    expect(readStoreIds(props)).toEqual({});
  });
});

function event(id: string, ts: string): AuditEvent {
  return {
    id,
    ts,
    actor: "a@example.com",
    actorRoles: "admin",
    surface: "webapp",
    action: "folder.create",
    targetType: "folder",
    targetId: "f",
    targetPath: "/f",
    before: null,
    after: null,
    result: "ok",
    errorCode: "",
    durationMs: 0,
    requestId: "r",
    appVersion: "v",
  };
}

describe("Drive store port", () => {
  let drive: FakeDrive;
  let props: FakeProperties;
  let store: ReturnType<typeof driveStore>;

  beforeEach(() => {
    drive = createDrive(() => Date.parse(NOW));
    props = new FakeProperties();
    const client = advanced(drive);
    ensureStore(client, props, NOW, "groupsapp_direct");
    store = driveStore(client, requireStoreIds(props));
  });

  it("reads and writes the index with its rev in appProperties", () => {
    const index = store.readIndex();
    store.writeIndex({ ...index, rev: 7 });
    expect(store.readIndexRev()).toBe(7);
    expect(store.readIndex().rev).toBe(7);
  });

  it("reads and writes side files", () => {
    store.writeSide("favorites", {
      rev: 2,
      byUser: { "a@example.com": ["x"] },
    });
    expect(store.readSide("favorites")).toEqual({
      rev: 2,
      byUser: { "a@example.com": ["x"] },
    });
  });

  it("creates immutable body files with appProperties and lists versions by item", () => {
    const body = (version: number): BodyFile => ({
      itemId: "ITEM",
      version,
      subject: "Hello",
      html: "<p>x</p>",
      plainText: "x",
      savedAt: NOW,
      savedBy: "a@example.com",
      note: "",
      restoredFrom: 0,
      sha256: "abc",
    });
    const v1 = store.createBody(body(1));
    store.createBody(body(2));
    store.createBody({ ...body(1), itemId: "OTHER" });
    expect(drive.files.get(v1)?.name).toBe(bodyName("ITEM", 1));
    expect(drive.files.get(v1)?.appProperties).toEqual({
      itemId: "ITEM",
      version: "1",
      savedBy: "a@example.com",
      restoredFrom: "0",
    });
    expect(store.readBody(v1)).toEqual(body(1));
    expect(
      store
        .listBodies("ITEM")
        .map((ref) => ref.version)
        .sort(),
    ).toEqual([1, 2]);
    expect(store.listBodies()).toHaveLength(3);
  });

  it("reads body files and index items written before slice 5 with an empty subject, without writing", () => {
    const old = { itemId: "ITEM", version: 1, html: "<p>x</p>" };
    const fileId = store.createBody(old as unknown as BodyFile);
    const index = store.readIndex();
    const item = {
      id: "I1",
      folderId: "F",
      title: "Old",
      tags: [],
      currentVersion: 1,
      bodyFileId: fileId,
      deletedAt: "",
      version: 1,
    };
    store.writeIndex({ ...index, items: [item] } as unknown as typeof index);
    const before = drive.calls.length;
    expect(store.readBody(fileId).subject).toBe("");
    expect(store.readIndex().items[0]?.subject).toBe("");
    expect(drive.calls.slice(before)).not.toContain("update");
    expect(drive.calls.slice(before)).not.toContain("create");
  });

  it("refuses a damaged index.json, favorites.json or usage.json on read", () => {
    const index = store.readIndex();
    store.writeIndex({
      ...index,
      folders: undefined,
    } as unknown as typeof index);
    expect(() => store.readIndex()).toThrow(
      "index.json is damaged: folders must be a list",
    );
    store.writeSide("favorites", {} as never);
    expect(() => store.readSide("favorites")).toThrow(
      "favorites.json is damaged: rev must be an integer",
    );
    store.writeSide("usage", { rev: 1, items: { a: {} }, recent: {} } as never);
    expect(() => store.readSide("usage")).toThrow(
      "usage.json is damaged: items has a bad entry",
    );
  });

  it("appends audit lines per month, skipping IDs already in the file", () => {
    expect(
      store.appendAudit("2026-11", [event("e1", NOW), event("e2", NOW)]),
    ).toBe(2);
    expect(
      store.appendAudit("2026-11", [event("e2", NOW), event("e3", NOW)]),
    ).toBe(1);
    expect(store.appendAudit("2026-11", [event("e3", NOW)])).toBe(0);
    const [file] = drive.byName("2026-11.jsonl");
    expect(
      file?.content
        .trim()
        .split("\n")
        .map((line) => (JSON.parse(line) as AuditEvent).id),
    ).toEqual(["e1", "e2", "e3"]);
    expect(store.listAuditFiles().map((f) => f.name)).toEqual([
      "2026-11.jsonl",
    ]);
  });

  it("copies the 3 mutable files into a dated backup folder once per day", () => {
    store.copyToBackup("2026-11-09");
    store.copyToBackup("2026-11-09");
    const backups = store.listBackups();
    expect(backups.map((b) => b.name)).toEqual(["2026-11-09"]);
    const copies = drive.query(childQuery(backups[0]?.id ?? ""));
    expect(copies.map((f) => f.name).sort()).toEqual([
      "favorites.json",
      "index.json",
      "usage.json",
    ]);
  });

  it("trashes files and rejects files that are not JSON", () => {
    const ids = requireStoreIds(props);
    drive.patch(ids.indexId, {}, "{not json");
    // The Advanced service fails before the store parses (slice 19 finding); INTERNAL either way.
    expect(() => store.readIndex()).toThrow("HttpResponseException");
    store.trash(ids.usageId);
    expect(drive.files.get(ids.usageId)?.trashed).toBe(true);
  });
});
