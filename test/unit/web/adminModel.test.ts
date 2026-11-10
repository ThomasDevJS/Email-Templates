import { describe, expect, it } from "vitest";
import {
  accessRows,
  daysLeft,
  displayPath,
  folderMoveTargets,
  folderNameProblem,
  principalHint,
} from "../../../src/web/admin/model";
import type { FolderRow, GrantRow } from "../../../src/web/rpc/api";

const DAY = 24 * 60 * 60 * 1000;

function folder(
  id: string,
  name: string,
  parentId = "",
  kind: "shared" | "private" = "shared",
): FolderRow {
  return {
    id,
    name,
    parentId,
    kind,
    ownerEmail: kind === "private" ? "ana@example.com" : "",
    sortOrder: 0,
    createdAt: "",
    createdBy: "",
    updatedAt: "",
    updatedBy: "",
    deletedAt: "",
    deletedBy: "",
    version: 1,
    level: "manage",
  };
}

function grant(fields: Partial<GrantRow>): GrantRow {
  return {
    id: "G",
    folderId: "F",
    principalType: "group",
    principalKey: "sales@example.com",
    level: "use",
    active: true,
    inherited: false,
    sourcePath: "/Sales",
    ...fields,
  };
}

describe("admin model", () => {
  it("counts the days left until the 30-day purge", () => {
    const deleted = Date.parse("2026-11-01T10:00:00Z");
    const iso = new Date(deleted).toISOString();
    expect(daysLeft(iso, deleted)).toBe(30);
    expect(daysLeft(iso, deleted + 9.5 * DAY)).toBe(21);
    expect(daysLeft(iso, deleted + 30 * DAY)).toBe(0);
    expect(daysLeft(iso, deleted + 40 * DAY)).toBe(0);
    expect(daysLeft("", deleted)).toBe(0);
  });

  it("checks folder names: 1 to 80 characters after trimming", () => {
    expect(folderNameProblem("Sales")).toBe("");
    expect(folderNameProblem("   ")).toContain("1 to 80");
    expect(folderNameProblem("x".repeat(81))).toContain("1 to 80");
    expect(folderNameProblem("x".repeat(80))).toBe("");
  });

  it("offers move targets outside the subtree, never private ones, Top level for admins", () => {
    const folders = [
      folder("S", "Sales"),
      folder("Q", "Quotes", "S"),
      folder("D", "Deep", "Q"),
      folder("H", "HR"),
      folder("M", "My templates", "", "private"),
    ];
    const quotes = folders[1] as FolderRow;
    expect(folderMoveTargets(folders, quotes, true)).toEqual([
      { id: "", label: "Top level" },
      { id: "H", label: "HR" },
    ]);
    expect(folderMoveTargets(folders, quotes, false)).toEqual([
      { id: "H", label: "HR" },
    ]);
    const sales = folders[0] as FolderRow;
    expect(folderMoveTargets(folders, sales, true)).toEqual([
      { id: "H", label: "HR" },
    ]);
  });

  it("builds access rows with the source folder and the OU note (D17)", () => {
    const rows = accessRows([
      grant({}),
      grant({ inherited: true, sourcePath: "/Sales/Quotes" }),
      grant({ principalType: "ou", principalKey: "/field", active: false }),
      grant({ principalType: "domain", principalKey: "example.com" }),
      grant({ inherited: true, sourcePath: "" }),
    ]);
    expect(rows.map((row) => [row.principal, row.source, row.note])).toEqual([
      ["group sales@example.com", "this folder", ""],
      ["group sales@example.com", "Sales / Quotes (inherited)", ""],
      [
        "OU /field",
        "this folder",
        "Inactive: OU resolution needs the Directory resolver",
      ],
      ["domain example.com", "this folder", ""],
      ["group sales@example.com", "a parent folder (inherited)", ""],
    ]);
  });

  it("names what each principal type takes and shows paths with spaces", () => {
    expect(principalHint("group")).toContain("Group email");
    expect(principalHint("user")).toBe("User email");
    expect(principalHint("domain")).toContain("Domain");
    expect(principalHint("ou")).toContain("inactive");
    expect(displayPath("/Sales/Quotes")).toBe("Sales / Quotes");
    expect(displayPath("/")).toBe("");
  });
});
