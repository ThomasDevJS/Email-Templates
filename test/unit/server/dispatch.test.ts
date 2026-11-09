import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../../src/shared/errors/codes";
import { ENTRY_POINTS } from "../../../src/shared/entryPoints";
import {
  ANY_CALLER,
  ROLE_MATRIX,
} from "../../../src/shared/permissions/matrix";
import { readBuffer } from "../../../src/server/audit/buffer";
import {
  DEFAULT_TABLES,
  dispatch,
  type DispatchTables,
} from "../../../src/server/dispatch/dispatch";
import {
  HANDLERS,
  LATER_SLICE_OPS,
} from "../../../src/server/dispatch/handlers";
import { POLICY } from "../../../src/server/dispatch/policy";
import { DOMAIN_KEY } from "../../../src/server/guards";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const USER = "user@example.com";
let world: World;

beforeEach(() => {
  world = setupWorld();
});

afterEach(() => {
  expect(world.lock.nestedAcquisitions).toBe(0);
});

function run(
  caller: string,
  op: string,
  args: unknown = {},
  tables?: DispatchTables,
  surface: "addon" | "webapp" = "webapp",
) {
  return dispatch(
    { caller: { email: caller }, op, args, surface, requestId: "r1" },
    world.services,
    tables,
  );
}

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error: unknown) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  throw new Error("expected an AppError");
}

function deniedEvents() {
  return readBuffer(world.cache).events.flatMap((entry) =>
    entry.kind === "denied" ? [entry.event] : [],
  );
}

describe("dispatch: identity and domain", () => {
  it.each(["", "   "])(
    "denies a blank caller (%j) before reading the policy table",
    (email) => {
      let ran = false;
      const tables: DispatchTables = {
        policy: { ping: { action: ANY_CALLER, surface: "both" } },
        handlers: { ping: () => (ran = true) },
      };
      expect(codeOf(() => run(email, "ping", {}, tables))).toBe(
        ErrorCode.AUTH_NO_USER,
      );
      expect(codeOf(() => run(email, "nope"))).toBe(ErrorCode.AUTH_NO_USER);
      expect(ran).toBe(false);
    },
  );

  it("denies a caller outside DOMAIN with AUTH_DOMAIN and buffers a denied event", () => {
    expect(codeOf(() => run("intruder@other.com", "ping"))).toBe(
      ErrorCode.AUTH_DOMAIN,
    );
    expect(codeOf(() => run("x@example.com.evil.com", "ping"))).toBe(
      ErrorCode.AUTH_DOMAIN,
    );
    expect(deniedEvents()).toHaveLength(2);
    expect(deniedEvents()[0]).toMatchObject({
      actor: "intruder@other.com",
      result: "denied",
      errorCode: "AUTH_DOMAIN",
    });
  });

  it("denies everyone while DOMAIN is unset (setup not run)", () => {
    world.props.deleteProperty(DOMAIN_KEY);
    expect(codeOf(() => run(USER, "ping"))).toBe(ErrorCode.AUTH_DOMAIN);
  });

  it("accepts the domain case-insensitively", () => {
    expect(run("Ana@EXAMPLE.com", "ping")).toMatchObject({
      pong: true,
      caller: "Ana@EXAMPLE.com",
    });
  });

  it.each(["nope", "toString", "__proto__", "constructor", "hasOwnProperty"])(
    "rejects unknown op %s",
    (op) => {
      expect(codeOf(() => run(USER, op))).toBe(ErrorCode.UNKNOWN_OP);
    },
  );

  it("fails closed with INTERNAL when a policy row has no handler", () => {
    const tables: DispatchTables = {
      policy: { orphan: { action: ANY_CALLER, surface: "both" } },
      handlers: {},
    };
    expect(codeOf(() => run(USER, "orphan", {}, tables))).toBe(
      ErrorCode.INTERNAL,
    );
  });
});

describe("dispatch: authorization before the handler", () => {
  it("denies a level op on a folder without a grant, never runs the handler, buffers the denial", () => {
    let ran = false;
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Sales",
    });
    const tables: DispatchTables = {
      policy: POLICY,
      handlers: { ...HANDLERS, "template.create": () => (ran = true) },
    };
    expect(
      codeOf(() =>
        run(USER, "template.create", { folderId: folder.id }, tables),
      ),
    ).toBe(ErrorCode.DENIED);
    expect(ran).toBe(false);
    expect(deniedEvents().at(-1)).toMatchObject({
      action: "template.create",
      actor: USER,
      targetType: "folder",
      targetId: folder.id,
      errorCode: "DENIED",
      actorRoles: "none",
    });
  });

  it("denies admin ops to non-admins and allows them to ADMIN_EMAILS", () => {
    expect(codeOf(() => run(USER, "spike.s2"))).toBe(ErrorCode.DENIED);
    expect(run(OWNER, "spike.s2")).toMatchObject({ activeUser: OWNER });
    expect(deniedEvents().at(-1)).toMatchObject({
      targetType: "library",
      action: "spike.s2",
    });
  });

  it("refuses web-only ops on the add-on surface, even for admins", () => {
    expect(
      codeOf(() =>
        run(OWNER, "folder.create", { name: "X" }, undefined, "addon"),
      ),
    ).toBe(ErrorCode.DENIED);
  });

  it("returns NOT_FOUND for an unknown target", () => {
    expect(codeOf(() => run(OWNER, "template.get", { id: "missing" }))).toBe(
      ErrorCode.NOT_FOUND,
    );
  });

  it("routes top-level folder creation to the admin-only matrix row", () => {
    expect(codeOf(() => run(USER, "folder.create", { name: "Top" }))).toBe(
      ErrorCode.DENIED,
    );
  });
});

/** Spec section 6 op list, plus `ping` (slice 1), `profile.me` (ADR-0004) and the two spike ops. */
const SPEC_OPS = [
  "sidebar.home",
  "folder.list",
  "template.list",
  "search",
  "search.body",
  "template.get",
  "template.apply",
  "favorite.set",
  "favorite.unset",
  "template.create",
  "template.update",
  "template.duplicate",
  "template.delete",
  "template.restoreFromTrash",
  "template.move",
  "version.list",
  "version.get",
  "version.restore",
  "folder.create",
  "folder.rename",
  "folder.move",
  "folder.delete",
  "trash.purge",
  "grant.list",
  "grant.add",
  "grant.remove",
  "export.folder",
  "export.library",
  "import",
  "audit.query",
  "usage.report",
  "membership.refresh",
  "config.get",
  "backup.list",
  "backup.restore",
  "me",
];
const EXTRA_OPS = ["ping", "profile.me", "spike.s2", "spike.s2b"];
const LIST_OPS = [
  "sidebar.home",
  "folder.list",
  "template.list",
  "search",
  "search.body",
];

describe("policy table completeness (ADR-0003 Part C)", () => {
  it("has a policy row for every handler and a handler for every row", () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(Object.keys(POLICY).sort());
  });

  it("covers every op of spec section 6 and nothing else beyond the 4 extras", () => {
    expect(Object.keys(POLICY).sort()).toEqual(
      [...SPEC_OPS, ...EXTRA_OPS].sort(),
    );
  });

  it("names a role matrix row or `any` in every row", () => {
    for (const row of Object.values(POLICY)) {
      const action =
        typeof row.action === "function"
          ? row.action({ parentId: "x" })
          : row.action;
      expect(action === ANY_CALLER || action in ROLE_MATRIX).toBe(true);
    }
  });

  it("gives every level row a target resolver except the filtered list ops", () => {
    const untargeted = Object.entries(POLICY)
      .filter(([, row]) => {
        const action =
          typeof row.action === "function" ? row.action({}) : row.action;
        return (
          action !== ANY_CALLER &&
          ROLE_MATRIX[action].kind === "level" &&
          row.targets === undefined
        );
      })
      .map(([op]) => op);
    expect(untargeted.sort()).toEqual([...LIST_OPS].sort());
  });

  it("is the table dispatch uses by default", () => {
    expect(DEFAULT_TABLES).toEqual({ policy: POLICY, handlers: HANDLERS });
  });

  it("never exposes an entry point (add-on callback, trigger) as an op", () => {
    for (const name of Object.keys(ENTRY_POINTS))
      expect(Object.keys(POLICY)).not.toContain(name);
  });

  it.each([...LATER_SLICE_OPS])(
    "%s answers NOT_IMPLEMENTED after the policy check",
    (op) => {
      const handler = HANDLERS[op];
      expect(handler).toBeDefined();
      expect(codeOf(() => handler?.({} as never))).toBe(
        ErrorCode.NOT_IMPLEMENTED,
      );
    },
  );
});

/** Required level per op, copied from spec section 6 (`none` = any identified caller). */
const SPEC_LEVELS: Readonly<Record<string, string>> = {
  "sidebar.home": "use",
  "folder.list": "use",
  "template.list": "use",
  search: "use",
  "search.body": "use",
  "template.get": "use",
  "template.apply": "use",
  "favorite.set": "use",
  "favorite.unset": "use",
  "template.create": "edit",
  "template.update": "edit",
  "template.duplicate": "edit",
  "template.delete": "edit",
  "template.restoreFromTrash": "edit",
  "template.move": "edit",
  "version.list": "edit",
  "version.get": "edit",
  "version.restore": "edit",
  "folder.rename": "manage",
  "folder.move": "manage",
  "folder.delete": "manage",
  "trash.purge": "admin",
  "grant.list": "manage",
  "grant.add": "manage",
  "grant.remove": "manage",
  "export.folder": "manage",
  "export.library": "admin",
  import: "admin",
  "audit.query": "admin",
  "usage.report": "admin",
  "membership.refresh": "admin",
  "config.get": "admin",
  "backup.list": "admin",
  "backup.restore": "admin",
  me: "none",
  ping: "none",
  "profile.me": "none",
  "spike.s2": "admin",
  "spike.s2b": "admin",
};

function levelOfRow(op: string, args: unknown): string {
  const row = POLICY[op];
  if (row === undefined) return "missing";
  const action =
    typeof row.action === "function" ? row.action(args) : row.action;
  if (action === ANY_CALLER) return "none";
  const need = ROLE_MATRIX[action];
  return need.kind === "level" ? need.level : need.kind;
}

describe("policy levels match spec section 6", () => {
  it.each(Object.entries(SPEC_LEVELS))("%s needs %s", (op, level) => {
    expect(levelOfRow(op, {})).toBe(level);
  });

  it("folder.create needs manage on the parent for a sub-folder and admin at the top level", () => {
    expect(levelOfRow("folder.create", { parentId: "P" })).toBe("manage");
    expect(levelOfRow("folder.create", {})).toBe("admin");
  });

  it("covers every policy row", () => {
    expect([...Object.keys(SPEC_LEVELS), "folder.create"].sort()).toEqual(
      Object.keys(POLICY).sort(),
    );
  });
});
