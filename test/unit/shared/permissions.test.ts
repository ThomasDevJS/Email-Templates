import { describe, expect, it } from "vitest";
import type {
  Folder,
  Grant,
  Level,
  MembersDoc,
} from "../../../src/shared/model/data";
import {
  levelResolver,
  PRIVATE_OWNER_LEVEL,
  type PermissionData,
  type Subject,
} from "../../../src/shared/permissions/effective";
import {
  atLeast,
  higher,
  isLevel,
} from "../../../src/shared/permissions/levels";
import {
  ANY_CALLER,
  checkNeed,
  needOf,
  ROLE_MATRIX,
  ROOT,
  type MatrixAction,
} from "../../../src/shared/permissions/matrix";
import type { StoredSettings } from "../../../src/shared/model/settings";
import { adminEntriesOf, appAdminsOf } from "../../../src/shared/model/admins";
import {
  domainOf,
  isAdminEmail,
  principalKey,
  principalsFor,
} from "../../../src/shared/permissions/principals";

/** Personal templates on (D11 rules); absent settings read as off (D29). */
const ON: StoredSettings = {
  personalTemplates: { value: "on", updatedAt: "", updatedBy: "" },
};

function folder(
  id: string,
  parentId = "",
  extra: Partial<Folder> = {},
): Folder {
  return {
    id,
    parentId,
    name: id,
    kind: "shared",
    ownerEmail: "",
    sortOrder: 0,
    createdAt: "",
    createdBy: "",
    updatedAt: "",
    updatedBy: "",
    deletedAt: "",
    deletedBy: "",
    version: 1,
    ...extra,
  };
}

function grant(
  folderId: string,
  principalType: Grant["principalType"],
  principalKey: string,
  level: Level,
): Grant {
  return {
    id: `g-${folderId}-${principalKey}`,
    folderId,
    principalType,
    principalKey,
    principalId: "",
    level,
    createdAt: "",
    createdBy: "",
  };
}

const SNAPSHOT: MembersDoc = {
  refreshedAt: "",
  resolver: "groupsapp_direct",
  groups: {
    "sales@example.com": {
      members: ["ana@example.com"],
      childGroups: [],
      status: "ok",
    },
    "admins@example.com": {
      members: ["boss@example.com"],
      childGroups: [],
      status: "ok",
    },
  },
  warnings: [],
};

function subject(email: string, isAdmin = false): Subject {
  return { email, principals: principalsFor(email, SNAPSHOT), isAdmin };
}

describe("levels", () => {
  it("orders none < use < edit < manage", () => {
    expect(atLeast("manage", "edit")).toBe(true);
    expect(atLeast("use", "edit")).toBe(false);
    expect(atLeast("none", "use")).toBe(false);
    expect(higher("use", "edit")).toBe("edit");
    expect(higher("manage", "none")).toBe("manage");
    expect(isLevel("edit")).toBe(true);
    expect(isLevel("admin")).toBe(false);
  });
});

describe("principal set (ADR-0003 Part B)", () => {
  it("holds user, domain and every snapshot group listing the email, case-insensitively", () => {
    expect([...principalsFor("Ana@Example.com", SNAPSHOT)].sort()).toEqual([
      "domain:example.com",
      "group:sales@example.com",
      "user:ana@example.com",
    ]);
  });

  it("adds ou only when the resolver supplies an org unit", () => {
    expect(principalsFor("x@example.com", SNAPSHOT, "/Sales")).toContain(
      "ou:/sales",
    );
    expect([...principalsFor("x@example.com", SNAPSHOT)]).toHaveLength(2);
  });

  it("normalizes keys and domains", () => {
    expect(principalKey("group", " Sales@Example.com ")).toBe(
      "group:sales@example.com",
    );
    expect(domainOf("a@B.com")).toBe("b.com");
    expect(domainOf("nobody")).toBe("");
  });

  it("finds admins in ADMIN_EMAILS or the ADMIN_GROUP snapshot", () => {
    expect(
      isAdminEmail(
        "Owner@example.com",
        "owner@example.com, x@example.com",
        "",
        SNAPSHOT,
      ),
    ).toBe(true);
    expect(
      isAdminEmail("boss@example.com", "", "Admins@example.com", SNAPSHOT),
    ).toBe(true);
    expect(
      isAdminEmail(
        "ana@example.com",
        "owner@example.com",
        "admins@example.com",
        SNAPSHOT,
      ),
    ).toBe(false);
    expect(isAdminEmail("ana@example.com", "", "", SNAPSHOT)).toBe(false);
  });

  it("finds in-app admins (D32), reading the list only when both properties say no", () => {
    let reads = 0;
    const list = () => {
      reads++;
      return appAdminsOf(
        {
          admins: [
            { email: " Ana@Example.com", addedAt: "", addedBy: "" },
            { email: "eve@other.org", addedAt: "", addedBy: "" },
            { email: 7, addedAt: "", addedBy: "" },
          ],
        },
        "example.com",
      );
    };
    expect(
      isAdminEmail(
        "owner@example.com",
        "owner@example.com",
        "",
        SNAPSHOT,
        list,
      ),
    ).toBe(true);
    expect(
      isAdminEmail(
        "boss@example.com",
        "",
        "admins@example.com",
        SNAPSHOT,
        list,
      ),
    ).toBe(true);
    expect(reads).toBe(0);
    expect(isAdminEmail(" ANA@example.com ", "", "", SNAPSHOT, list)).toBe(
      true,
    );
    expect(isAdminEmail("eve@other.org", "", "", SNAPSHOT, list)).toBe(false);
    expect(isAdminEmail("", "", "", SNAPSHOT, () => [""])).toBe(false);
    expect(reads).toBe(2);
  });
});

describe("adminEntriesOf (D32, spec 5.8)", () => {
  const ok = {
    email: "ana@example.com",
    addedAt: "t",
    addedBy: "o@example.com",
  };

  it("keeps well-formed entries, lower case, and drops the rest", () => {
    expect(
      adminEntriesOf(
        [
          { ...ok, email: " Ana@Example.COM " },
          { ...ok, email: "ana@sub.example.com" },
          { ...ok, email: "a..b@example.com" },
          { ...ok, email: `${"a".repeat(250)}@example.com` },
          { ...ok, addedAt: 1 },
          { email: "bob@example.com" },
          "bob@example.com",
          null,
        ],
        "Example.com",
      ),
    ).toEqual([ok]);
  });

  it("reads anything but a list, or a blank domain, as no admins", () => {
    for (const stored of [undefined, null, "ana@example.com", { 0: ok }, 3])
      expect(adminEntriesOf(stored, "example.com")).toEqual([]);
    expect(adminEntriesOf([ok], "")).toEqual([]);
    expect(appAdminsOf({}, "example.com")).toEqual([]);
  });
});

/**
 * ADR-0003 Part C role matrix, copied cell by cell. Roles: user holds `use`, manager-editor holds `edit`, manage
 * holds `manage` (each through one grant on the parent P), admin is global. Targets: F and G are children of P.
 */
type Role = "user" | "editor" | "manage" | "admin";
const ROLES: readonly Role[] = ["user", "editor", "manage", "admin"];
const ROLE_GRANT: Readonly<Record<Exclude<Role, "admin">, Level>> = {
  user: "use",
  editor: "edit",
  manage: "manage",
};

const EXPECTED: Readonly<
  Record<MatrixAction, readonly [boolean, boolean, boolean, boolean]>
> = {
  "template.read": [true, true, true, true],
  "template.apply": [true, true, true, true],
  favorite: [true, true, true, true],
  "template.write": [false, true, true, true],
  "template.move": [false, true, true, true],
  "template.trash": [false, true, true, true],
  "version.history": [false, true, true, true],
  "trash.purge": [false, false, false, true],
  "folder.edit": [false, false, true, true],
  "folder.moveDelete": [false, false, true, true],
  "folder.createTop": [false, false, false, true],
  "grant.manage": [false, false, true, true],
  "export.folder": [false, false, true, true],
  "library.transfer": [false, false, false, true],
  "audit.view": [false, false, false, true],
  "admin.ops": [false, false, false, true],
  "private.self": [true, true, true, true],
};

/** Target folders each matrix row is checked on, as the policy table resolves them. */
const TARGETS: Readonly<Record<MatrixAction, readonly string[]>> = {
  "template.read": ["F"],
  "template.apply": ["F"],
  favorite: ["F"],
  "template.write": ["F"],
  "template.move": ["F", "G"],
  "template.trash": ["F"],
  "version.history": ["F"],
  "trash.purge": [],
  "folder.edit": ["F"],
  "folder.moveDelete": ["F", "P"],
  "folder.createTop": [ROOT],
  "grant.manage": ["F"],
  "export.folder": ["F"],
  "library.transfer": [],
  "audit.view": [],
  "admin.ops": [],
  "private.self": ["MINE"],
};

function worldFor(
  role: Role,
  settings: StoredSettings = ON,
): { subject: Subject; data: PermissionData } {
  const email = `${role}@example.com`;
  const data: PermissionData = {
    settings,
    folders: [
      folder("P"),
      folder("F", "P"),
      folder("G", "P"),
      folder("MINE", "", { kind: "private", ownerEmail: email }),
    ],
    grants:
      role === "admin" ? [] : [grant("P", "user", email, ROLE_GRANT[role])],
  };
  return { subject: subject(email, role === "admin"), data };
}

describe("role matrix (ADR-0003 Part C): 17 actions x 4 roles", () => {
  it("has exactly the 17 rows of the ADR", () => {
    expect(Object.keys(ROLE_MATRIX)).toHaveLength(17);
    expect(Object.keys(EXPECTED).sort()).toEqual(
      Object.keys(ROLE_MATRIX).sort(),
    );
  });

  const cells = (Object.keys(EXPECTED) as MatrixAction[]).flatMap((action) =>
    ROLES.map(
      (role, column) => [action, role, EXPECTED[action][column]] as const,
    ),
  );

  it.each(cells)("%s for %s is %s", (action, role, allowed) => {
    const { subject: who, data } = worldFor(role);
    const levelOf = levelResolver(who, data);
    expect(
      checkNeed(ROLE_MATRIX[action], who.isAdmin, levelOf, TARGETS[action]),
    ).toBe(allowed);
  });

  it("gives the owner `edit` on the private folder of self, admins `manage`", () => {
    for (const role of ROLES) {
      const { subject: who, data } = worldFor(role);
      expect(levelResolver(who, data)("MINE")).toBe(
        role === "admin" ? "manage" : PRIVATE_OWNER_LEVEL,
      );
    }
    expect(PRIVATE_OWNER_LEVEL).toBe("edit");
  });

  it("while personal templates are off, gives owner and admins `use` on a private tree, nothing above (D29)", () => {
    for (const role of ROLES) {
      const { subject: who, data } = worldFor(role, {});
      const levelOf = levelResolver(who, data);
      expect(levelOf("MINE")).toBe("use");
      expect(levelOf("F")).toBe(
        worldFor(role).data.grants[0]?.level ?? "manage",
      );
      for (const action of Object.keys(ROLE_MATRIX) as MatrixAction[]) {
        const need = ROLE_MATRIX[action];
        if (need.kind !== "level") continue;
        expect(checkNeed(need, who.isAdmin, levelOf, ["MINE"])).toBe(
          need.level === "use",
        );
      }
    }
  });
});

describe("effective level: inheritance, private folders, moves", () => {
  const folders = [
    folder("A"),
    folder("B", "A"),
    folder("C", "B"),
    folder("X"),
    folder("PRIV", "", { kind: "private", ownerEmail: "ana@example.com" }),
    folder("PRIVSUB", "PRIV"),
  ];

  it("takes the maximum over the folder and all ancestors", () => {
    const data = {
      folders,
      grants: [
        grant("A", "group", "sales@example.com", "use"),
        grant("B", "user", "ana@example.com", "edit"),
      ],
    };
    const levelOf = levelResolver(subject("ana@example.com"), data);
    expect(levelOf("A")).toBe("use");
    expect(levelOf("B")).toBe("edit");
    expect(levelOf("C")).toBe("edit");
    expect(levelOf("X")).toBe("none");
  });

  it("does not let a child grant leak to the parent", () => {
    const data = {
      folders,
      grants: [grant("C", "domain", "example.com", "manage")],
    };
    const levelOf = levelResolver(subject("ana@example.com"), data);
    expect(levelOf("C")).toBe("manage");
    expect(levelOf("B")).toBe("none");
  });

  it("ignores grants whose principal the caller lacks (default deny)", () => {
    const data = {
      folders,
      grants: [grant("A", "group", "sales@example.com", "manage")],
    };
    expect(levelResolver(subject("bob@example.com"), data)("C")).toBe("none");
  });

  it("recomputes levels from the new ancestors after a move", () => {
    const grants = [grant("A", "user", "ana@example.com", "edit")];
    const before = levelResolver(subject("ana@example.com"), {
      folders,
      grants,
    });
    const moved = folders.map((f) =>
      f.id === "C" ? { ...f, parentId: "X" } : f,
    );
    const after = levelResolver(subject("ana@example.com"), {
      folders: moved,
      grants,
    });
    expect(before("C")).toBe("edit");
    expect(after("C")).toBe("none");
  });

  it("checks both source and target for a template move", () => {
    const data = {
      folders,
      grants: [grant("A", "user", "ana@example.com", "edit")],
    };
    const levelOf = levelResolver(subject("ana@example.com"), data);
    expect(
      checkNeed(ROLE_MATRIX["template.move"], false, levelOf, ["C", "B"]),
    ).toBe(true);
    expect(
      checkNeed(ROLE_MATRIX["template.move"], false, levelOf, ["C", "X"]),
    ).toBe(false);
    expect(
      checkNeed(ROLE_MATRIX["template.move"], false, levelOf, ["X", "C"]),
    ).toBe(false);
  });

  it("gives the private folder owner `edit` on the folder and its subfolders, ignores grants there (D11)", () => {
    const data = {
      settings: ON,
      folders,
      grants: [grant("PRIV", "domain", "example.com", "manage")],
    };
    expect(levelResolver(subject("ana@example.com"), data)("PRIVSUB")).toBe(
      "edit",
    );
    expect(levelResolver(subject("bob@example.com"), data)("PRIV")).toBe(
      "none",
    );
    expect(levelResolver(subject("bob@example.com", true), data)("PRIV")).toBe(
      "manage",
    );
  });

  it("while personal templates are off: owner and admin `use`, others none, grants still ignored (D29)", () => {
    const data = {
      folders,
      grants: [grant("PRIV", "domain", "example.com", "manage")],
    };
    expect(levelResolver(subject("ana@example.com"), data)("PRIVSUB")).toBe(
      "use",
    );
    expect(levelResolver(subject("bob@example.com"), data)("PRIV")).toBe(
      "none",
    );
    expect(levelResolver(subject("bob@example.com", true), data)("PRIV")).toBe(
      "use",
    );
    expect(levelResolver(subject("bob@example.com", true), data)("A")).toBe(
      "manage",
    );
  });

  it("returns none for unknown folders, also for admins, and survives a parent cycle", () => {
    const cyclic = [folder("L1", "L2"), folder("L2", "L1")];
    expect(
      levelResolver(subject("x@example.com", true), { folders, grants: [] })(
        "nope",
      ),
    ).toBe("none");
    expect(
      levelResolver(subject("x@example.com"), { folders: cyclic, grants: [] })(
        "L1",
      ),
    ).toBe("none");
  });

  it("memoizes per folder", () => {
    const data = {
      folders,
      grants: [grant("A", "user", "ana@example.com", "use")],
    };
    const levelOf = levelResolver(subject("ana@example.com"), data);
    expect(levelOf("C")).toBe(levelOf("C"));
  });
});

describe("checkNeed", () => {
  const levelOf = () => "manage" as const;

  it("lets any identified caller through `any`", () => {
    expect(checkNeed(needOf(ANY_CALLER), false, levelOf, [])).toBe(true);
  });

  it("passes a level need with no targets (list ops filter instead)", () => {
    expect(checkNeed(needOf("template.read"), false, () => "none", [])).toBe(
      true,
    );
  });

  it("requires admin on ROOT", () => {
    expect(checkNeed(needOf("folder.edit"), false, levelOf, [ROOT])).toBe(
      false,
    );
    expect(checkNeed(needOf("folder.edit"), true, levelOf, [ROOT])).toBe(true);
  });
});
