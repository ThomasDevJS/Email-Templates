import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTime } from "../../../src/web/ui/dom";
import { ErrorCode } from "../../../src/shared/errors/codes";
import type { FolderRow, ItemRow } from "../../../src/web/rpc/api";
import {
  buildTree,
  editableFolders,
  searchItems,
  folderPath,
  moveTargets,
  rowActions,
  subtreeIds,
  visibleNodes,
} from "../../../src/web/library/model";
import {
  LIBRARY,
  overlayRoute,
  parseRoute,
  routeHash,
  startRoute,
} from "../../../src/web/router";
import {
  RpcError,
  createClient,
  settle,
  transportError,
  type Runner,
} from "../../../src/web/rpc/client";
import { createApi } from "../../../src/web/rpc/api";
import {
  messageOf,
  presentationOf,
  toRpcError,
} from "../../../src/web/ui/status";
import {
  previewAsMe,
  senderValues,
  withChips,
} from "../../../src/web/views/preview";

function folder(
  id: string,
  name: string,
  parentId = "",
  level: FolderRow["level"] = "edit",
  kind: FolderRow["kind"] = "shared",
): FolderRow {
  return {
    id,
    name,
    parentId,
    level,
    kind,
    ownerEmail: "",
    sortOrder: 0,
    createdAt: "",
    createdBy: "",
    updatedAt: "",
    updatedBy: "",
    deletedAt: "",
    deletedBy: "",
    version: 1,
  };
}

function item(
  id: string,
  title: string,
  folderId: string,
  tags: string[] = [],
): ItemRow {
  return {
    id,
    title,
    folderId,
    tags,
    level: "edit",
    kind: "template",
    subject: "",
    status: "published",
    currentVersion: 1,
    bodyFileId: "",
    snippet: "",
    placeholders: [],
    prompts: [],
    sizeBytes: 0,
    createdAt: "",
    createdBy: "",
    updatedAt: "",
    updatedBy: "",
    deletedAt: "",
    deletedBy: "",
    version: 1,
  };
}

const FOLDERS = [
  folder("S", "Sales"),
  folder("Q", "Quotes", "S"),
  folder("O", "Onboarding", "S", "use"),
  folder("M", "My templates", "", "edit", "private"),
  folder("X", "Orphan", "HIDDEN", "use"),
];

describe("router", () => {
  it.each([
    ["#/library", { name: "library", folderId: "" }],
    ["/library?folder=S", { name: "library", folderId: "S" }],
    ["#/edit/01ABC", { name: "edit", id: "01ABC" }],
    ["#/history/01ABC", { name: "history", id: "01ABC" }],
    ["#/new?folder=Q", { name: "new", folderId: "Q" }],
    ["#/new", { name: "new", folderId: "" }],
    ["#/edit/<script>", LIBRARY],
    ["#/library?folder=%3Cx%3E", { name: "library", folderId: "" }],
    ["#/library?other=1", { name: "library", folderId: "" }],
    ["#/nowhere", LIBRARY],
    ["", LIBRARY],
    ["#/trash", { name: "trash" }],
    ["#/admin", { name: "admin", tab: "folders" }],
    ["#/admin/memberships", { name: "admin", tab: "memberships" }],
    ["#/admin/audit", { name: "admin", tab: "audit" }],
    ["#/admin/config", { name: "admin", tab: "config" }],
    ["#/admin/nope", { name: "admin", tab: "folders" }],
  ])("parses %j", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it("writes hashes that parse back", () => {
    for (const route of [
      LIBRARY,
      { name: "library", folderId: "S" },
      { name: "edit", id: "A" },
      { name: "history", id: "B" },
      { name: "new", folderId: "Q" },
      { name: "trash" },
      { name: "admin", tab: "folders" },
      { name: "admin", tab: "memberships" },
    ] as const)
      expect(parseRoute(routeHash(route))).toEqual(route);
  });

  it("maps the OVERLAY URL form into hash routes", () => {
    expect(overlayRoute({ view: "editor", id: "01ABC" })).toEqual({
      name: "edit",
      id: "01ABC",
    });
    expect(overlayRoute({ view: "history", id: "01ABC" })).toEqual({
      name: "history",
      id: "01ABC",
    });
    expect(overlayRoute({ view: "admin" })).toEqual({
      name: "admin",
      tab: "folders",
    });
    expect(overlayRoute({ view: "trash", id: "01ABC" })).toBeNull();
    expect(overlayRoute({ view: "editor" })).toBeNull();
    expect(
      startRoute({ hash: "", parameter: { view: "editor", id: "X1" } }),
    ).toEqual({ name: "edit", id: "X1" });
    expect(
      startRoute({
        hash: "/history/Y",
        parameter: { view: "editor", id: "X1" },
      }),
    ).toEqual({ name: "history", id: "Y" });
    expect(startRoute({ hash: "", parameter: {} })).toBe(LIBRARY);
  });
});

describe("library model", () => {
  it("builds the tree with shared folders first and orphans at the top level", () => {
    const roots = buildTree(FOLDERS);
    expect(roots.map((node) => node.folder.name)).toEqual([
      "Orphan",
      "Sales",
      "My templates",
    ]);
    expect(roots[1]?.children.map((node) => node.folder.name)).toEqual([
      "Onboarding",
      "Quotes",
    ]);
    expect(
      visibleNodes(roots, new Set()).map((node) => node.folder.id),
    ).toEqual(["X", "S", "M"]);
    expect(
      visibleNodes(roots, new Set(["S"])).map((node) => node.depth),
    ).toEqual([1, 1, 2, 2, 1]);
  });

  it("names paths, subtrees and editable folders", () => {
    expect(folderPath(FOLDERS, "Q")).toBe("Sales / Quotes");
    expect(folderPath(FOLDERS, "missing")).toBe("");
    expect([...subtreeIds(FOLDERS, "S")].sort()).toEqual(["O", "Q", "S"]);
    expect(editableFolders(FOLDERS).map((option) => option.label)).toEqual([
      "My templates",
      "Sales",
      "Sales / Quotes",
    ]);
  });

  it("offers row actions by level and move targets with edit only", () => {
    const quote = item("1", "Price quote", "Q");
    expect(moveTargets(quote, FOLDERS).map((option) => option.id)).toEqual([
      "M",
      "S",
    ]);
    expect(rowActions(quote, FOLDERS)).toEqual([
      "edit",
      "duplicate",
      "move",
      "history",
      "delete",
    ]);
    expect(rowActions(quote, [FOLDERS[1] as FolderRow])).toEqual([
      "edit",
      "duplicate",
      "history",
      "delete",
    ]);
    expect(rowActions({ ...quote, level: "use" }, FOLDERS)).toEqual([]);
  });

  it("searches title, subject, folder path and tags, ranked, case and accent insensitive", () => {
    const items = [
      item("1", "Price quote", "Q", ["pricing"]),
      { ...item("2", "Café welcome", "O"), subject: "Your quote" },
      item("3", "Renewal", "M", ["Contract"]),
    ];
    const ids = (query: string, recent: string[] = []) =>
      searchItems(items, FOLDERS, query, recent).map((entry) => entry.id);
    expect(ids("")).toEqual(["2", "1", "3"]);
    expect(ids("cafe")).toEqual(["2"]);
    expect(ids("quote")).toEqual(["1", "2"]);
    expect(ids("sales quote")).toEqual(["1", "2"]);
    expect(ids("tag:contract")).toEqual(["3"]);
    expect(ids("nothing")).toEqual([]);
  });

  it("breaks equal scores by the caller's last use", () => {
    const items = [item("1", "Note A", "Q"), item("2", "Note B", "Q")];
    expect(
      searchItems(items, FOLDERS, "note", ["2"]).map((entry) => entry.id),
    ).toEqual(["2", "1"]);
  });
});

function envelope(data: unknown) {
  return { ok: true, data, serverVersion: "v", durationMs: 1 };
}

describe("rpc client", () => {
  it("returns data and maps error envelopes, malformed replies and transport failures", () => {
    expect(settle(envelope(3), "r")).toBe(3);
    const denied = {
      ok: false,
      error: {
        code: "DENIED",
        message: "no",
        retryable: false,
        details: { a: 1 },
      },
      serverVersion: "v",
      durationMs: 1,
    };
    expect(() => settle(denied, "r")).toThrow(RpcError);
    try {
      settle(denied, "r");
    } catch (error) {
      expect(error).toMatchObject({
        code: "DENIED",
        requestId: "r",
        retryable: false,
        details: { a: 1 },
      });
    }
    expect(() => settle("nonsense", "r")).toThrow(
      "Unexpected reply from the server",
    );
    expect(
      transportError(new Error("Too many simultaneous invocations"), "r"),
    ).toMatchObject({ code: "QUOTA", retryable: true });
    expect(transportError("offline", "r")).toMatchObject({
      code: "NETWORK",
      message: "offline",
    });
    expect(transportError(new Error(""), "r").message).toBe("Network error");
  });

  it("runs at most 4 calls at once and the rest in order", async () => {
    const pending: (() => void)[] = [];
    const started: string[] = [];
    const runner: Runner = {
      run: (op, _args, requestId, onReply) => {
        started.push(`${op}:${requestId}`);
        pending.push(() => {
          onReply(envelope(op));
        });
      },
    };
    let n = 0;
    const client = createClient(runner, () => `id${String((n += 1))}`);
    const calls = ["a", "b", "c", "d", "e", "f"].map((op) => client.call(op));
    await Promise.resolve();
    expect(started).toEqual(["a:id1", "b:id2", "c:id3", "d:id4"]);
    pending.shift()?.();
    await vi.waitFor(() => {
      expect(started).toHaveLength(5);
    });
    expect(started[4]).toBe("e:id5");
    while (pending.length > 0) {
      pending.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(await Promise.all(calls)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("rejects with the transport error and frees the slot", async () => {
    const runner: Runner = {
      run: (_op, _args, _id, _ok, onFailure) => {
        onFailure(new Error("boom"));
      },
    };
    const client = createClient(runner, () => "id", 1);
    await expect(client.call("a")).rejects.toMatchObject({
      code: "NETWORK",
      requestId: "id",
    });
    await expect(client.call("b")).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("sends the documented ops and arguments", async () => {
    const sent: unknown[] = [];
    const runner: Runner = {
      run: (op, args, _id, onReply) => {
        sent.push([op, args]);
        onReply(envelope({}));
      },
    };
    const api = createApi(createClient(runner, () => "id"));
    const save = {
      title: "T",
      subject: "S",
      folderId: "F",
      tags: ["a"],
      html: "<p>x</p>",
    };
    await Promise.all([
      api.profile(),
      api.folders(),
      api.templates(),
      api.template("I"),
      api.create(save),
      api.update("I", 2, save),
      api.versions("I"),
      api.version("I", 1),
      api.restore("I", 1, 2),
      api.setFavorite("I", true),
      api.setFavorite("I", false),
      api.searchBody("q"),
    ]);
    expect(sent).toEqual([
      ["profile.me", {}],
      ["folder.list", {}],
      ["template.list", {}],
      ["template.get", { id: "I" }],
      ["template.create", save],
      ["template.update", { ...save, id: "I", baseVersion: 2 }],
      ["version.list", { id: "I" }],
      ["version.get", { id: "I", version: 1 }],
      ["version.restore", { id: "I", version: 1, baseVersion: 2 }],
      ["favorite.set", { id: "I" }],
      ["favorite.unset", { id: "I" }],
      ["search.body", { query: "q" }],
    ]);
  });
});

describe("error presentation (spec section 7)", () => {
  it.each([
    [ErrorCode.AUTH_NO_USER, "auth"],
    [ErrorCode.AUTH_DOMAIN, "auth"],
    [ErrorCode.DENIED, "banner"],
    [ErrorCode.NOT_FOUND, "banner"],
    [ErrorCode.CONFLICT, "conflict"],
    [ErrorCode.VALIDATION, "inline"],
    [ErrorCode.BAD_REQUEST, "inline"],
    [ErrorCode.BUSY, "toast"],
    [ErrorCode.QUOTA, "toast"],
    [ErrorCode.INTERNAL, "toast"],
    [ErrorCode.NETWORK, "toast"],
    [ErrorCode.NOT_IMPLEMENTED, "toast"],
  ] as const)("%s is a %s", (code, presentation) => {
    expect(presentationOf(code)).toBe(presentation);
  });

  it("uses the spec texts", () => {
    const of = (code: ErrorCode, message = "raw") =>
      messageOf(new RpcError(code, message, "r", false));
    expect(of(ErrorCode.DENIED)).toBe(
      "You don't have access to this template. Ask a folder manager.",
    );
    expect(of(ErrorCode.NOT_FOUND)).toBe("This template was removed or moved.");
    expect(of(ErrorCode.BUSY)).toBe("Busy, try again.");
    expect(of(ErrorCode.QUOTA)).toBe("Service is busy. Try again in a minute.");
    expect(of(ErrorCode.INTERNAL)).toBe("Something went wrong. Retry.");
    expect(of(ErrorCode.NOT_IMPLEMENTED)).toBe(
      "This action arrives in a later release.",
    );
    vi.stubEnv("TZ", "America/New_York");
    expect(
      messageOf(
        new RpcError(ErrorCode.CONFLICT, "Changed by x", "r", false, {
          updatedBy: "bob@example.com",
          updatedAt: "2026-11-10T15:14:00.000Z",
        }),
      ),
    ).toBe("Changed by bob@example.com at 2026-11-10 10:14.");
    vi.unstubAllEnvs();
    expect(of(ErrorCode.CONFLICT, "Changed by x")).toBe("Changed by x");
    expect(of(ErrorCode.VALIDATION, "Title must be 1 to 120 characters")).toBe(
      "Title must be 1 to 120 characters",
    );
    expect(toRpcError(new Error("x"))).toMatchObject({
      code: "INTERNAL",
      message: "x",
      requestId: "",
    });
    expect(toRpcError("y").message).toBe("y");
  });
});

describe("previews", () => {
  const profile = {
    email: "a@example.com",
    name: "Ana <A>",
    givenName: "Ana",
    title: "",
    department: "Sales",
    phone: "+1",
  };

  it("renders as me with prompts and unknown values in brackets", () => {
    expect(senderValues(null)).toEqual({});
    expect(
      previewAsMe(
        "<p>{{sender.name}}, {{sender.title}}, {{ask:Date}}, {{recipient.first_name|there}}</p>",
        profile,
      ),
    ).toBe("<p>Ana &lt;A&gt;, [Your title], [Date], there</p>");
  });

  it("shows tokens as chips in history", () => {
    expect(withChips("<p>a {{sender.name}} \\{{ {{x.y}}</p>")).toBe(
      '<p>a <span class="ph" role="img" aria-label="Placeholder: sender name">Sender name</span> {{ <span class="ph" role="img" aria-label="Placeholder: x.y">x.y</span></p>',
    );
  });
});

describe("formatTime (local time, smoke 5b item 3)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the browser's time zone, not UTC", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(formatTime("2026-11-10T15:14:00.000Z")).toBe("2026-11-10 10:14");
    expect(formatTime("2026-01-01T03:05:00.000Z")).toBe("2025-12-31 22:05");
    vi.stubEnv("TZ", "Asia/Kolkata");
    expect(formatTime("2026-11-10T15:14:00.000Z")).toBe("2026-11-10 20:44");
    vi.stubEnv("TZ", "UTC");
    expect(formatTime("2026-11-10T15:14:00.000Z")).toBe("2026-11-10 15:14");
  });

  it("gives an empty text for a blank or bad time", () => {
    expect(formatTime("")).toBe("");
    expect(formatTime("not a time")).toBe("");
  });
});
