import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Item } from "../../../src/shared/model/data";
import type { SidebarHome } from "../../../src/shared/model/sidebar";
import { createContext } from "../../../src/server/dispatch/context";
import {
  visibleLibrary,
  type VisibleLibrary,
} from "../../../src/server/handlers/visible";
import { OWNER, setSetting, setupWorld, type World } from "../../fakes/world";

/** Slice 31 (spec 5.11, ADR-0010 Decision 3): the visible set behind `sidebar.home` and `search`. */
const ANA = "ana@example.com";
const BOB = "bob@example.com";
const EVE = "eve@example.com";
let world: World;
let sales: Folder;
let quotes: Folder;
let hr: Folder;
let archive: Folder;
let anaPrivate: Folder;

beforeEach(() => {
  world = setupWorld();
  setSetting(world, "personalTemplates", "on");
  sales = world.ok<Folder>(OWNER, "folder.create", { name: "Sales" });
  quotes = world.ok<Folder>(OWNER, "folder.create", {
    name: "Quotes",
    parentId: sales.id,
  });
  hr = world.ok<Folder>(OWNER, "folder.create", { name: "HR" });
  archive = world.ok<Folder>(OWNER, "folder.create", { name: "Archive" });
  create(OWNER, sales.id, "Beta");
  create(OWNER, quotes.id, "Alpha");
  create(OWNER, hr.id, "Leave");
  const trashed = create(OWNER, sales.id, "Trashed");
  world.ok(OWNER, "template.delete", { id: trashed.id });
  world.ok(OWNER, "folder.delete", { folderId: archive.id });
  world.ok(OWNER, "folder.list");
  anaPrivate = privateFolderOf(ANA);
  create(ANA, anaPrivate.id, "Mine");
  world.ok(OWNER, "grant.add", {
    folderId: quotes.id,
    principalType: "user",
    principalKey: BOB,
    level: "use",
  });
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
  expect(world.lock.hasLock()).toBe(false);
});

function create(caller: string, folderId: string, title: string): Item {
  return world.ok<Item>(caller, "template.create", {
    folderId,
    title,
    html: "<p>Hello</p>",
  });
}

function privateFolderOf(caller: string): Folder {
  const { folders } = world.ok<{ folders: Folder[] }>(caller, "folder.list");
  const own = folders.find((folder) => folder.kind === "private");
  if (own === undefined) throw new Error("no private folder");
  return own;
}

function libraryOf(caller: string): VisibleLibrary {
  return visibleLibrary(
    createContext({
      caller: { email: caller },
      args: {},
      surface: "addon",
      requestId: "TESTREQ0-000001",
      services: world.as("addon"),
      recheck: () => undefined,
    }),
  );
}

function home(caller: string): SidebarHome {
  return world.ok<SidebarHome>(caller, "sidebar.home", {}, "addon");
}

const titles = (library: VisibleLibrary) =>
  library.templates.map(({ item }) => item.title);

describe("visibleLibrary (spec 5.11)", () => {
  it("returns folders in display order (sort order, then name) with the nearest visible parent", () => {
    const library = libraryOf(OWNER);
    expect(library.folders.map((f) => [f.name, f.parentId])).toEqual([
      ["Quotes", sales.id],
      ["Sales", ""],
      ["HR", ""],
      ["My templates", ""],
    ]);
    expect(library.folderById.get(quotes.id)).toBe(library.folders[0]);
  });

  it("returns templates in title order with their folder and level", () => {
    const library = libraryOf(OWNER);
    expect(titles(library)).toEqual(["Alpha", "Beta", "Leave"]);
    expect(
      library.templates.map((t) => [t.folder.id, t.item.folderId, t.level]),
    ).toEqual([
      [quotes.id, quotes.id, "manage"],
      [sales.id, sales.id, "manage"],
      [hr.id, hr.id, "manage"],
    ]);
  });

  it("gives the owner of a private folder that folder and its templates", () => {
    const library = libraryOf(ANA);
    expect(library.folders).toEqual([
      { id: anaPrivate.id, name: "My templates", parentId: "" },
    ]);
    expect(titles(library)).toEqual(["Mine"]);
    expect(library.templates[0]?.level).toBe("edit");
  });
});

describe("visibleLibrary security (spec 13.12 slice 31)", () => {
  it("gives an admin no other user's private folder or its templates", () => {
    const library = libraryOf(OWNER);
    expect(library.folderById.has(anaPrivate.id)).toBe(false);
    expect(titles(library)).not.toContain("Mine");
  });

  it("leaves out deleted folders and trashed templates", () => {
    const library = libraryOf(OWNER);
    expect(library.folderById.has(archive.id)).toBe(false);
    expect(titles(library)).not.toContain("Trashed");
  });

  it("leaves out a folder without use and shows its visible child at the top", () => {
    const library = libraryOf(BOB);
    expect(library.folders).toEqual([
      { id: quotes.id, name: "Quotes", parentId: "" },
    ]);
    expect(
      library.templates.map((t) => [t.item.title, t.folder.id, t.level]),
    ).toEqual([["Alpha", quotes.id, "use"]]);
  });

  it("gives a caller without grants nothing", () => {
    const library = libraryOf(EVE);
    expect(library.folders).toEqual([]);
    expect(library.templates).toEqual([]);
  });

  it.each([
    ["an admin", OWNER],
    ["a user with one grant", BOB],
    ["a user with none", EVE],
  ])(
    "returns the template and folder ID sets of sidebar.home for %s",
    (_name, caller) => {
      const library = libraryOf(caller);
      const view = home(caller);
      expect(new Set(library.templates.map(({ item }) => item.id))).toEqual(
        new Set(view.templates.map((template) => template.id)),
      );
      expect(new Set(library.folders.map((folder) => folder.id))).toEqual(
        new Set([...view.folders, ...view.subfolders].map((f) => f.id)),
      );
    },
  );
});
