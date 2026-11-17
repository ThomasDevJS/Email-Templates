import { describe, expect, it, vi } from "vitest";
import {
  accessRows,
  daysLeft,
  displayPath,
  exportFileName,
  folderMoveTargets,
  folderNameProblem,
  formatBytes,
  importSummary,
  localDayStart,
  principalHint,
  conflictText,
  lastChangeText,
  addedByText,
  fixedAdminTexts,
  settingTexts,
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
      ["group sales@example.com", "Sales / Quotes (parent folder)", ""],
      [
        "org unit /field",
        "this folder",
        "Not active yet. Org units do not give access in this version.",
      ],
      ["domain example.com", "this folder", ""],
      ["group sales@example.com", "a parent folder", ""],
    ]);
    expect(rows.map((row) => row.typeLabel)).toEqual([
      "group",
      "group",
      "org unit",
      "domain",
      "group",
    ]);
  });

  it("words the settings of spec 7.3 with the domain", () => {
    const personal = settingTexts("personalTemplates", "example.com");
    expect(personal.options).toEqual([
      ["on", "On"],
      ["off", "Off"],
      ["hidden", "Hidden"],
    ]);
    expect(personal.confirms[1]).toMatchObject({
      value: "hidden",
      title: "Hide personal templates?",
      action: "Hide",
    });
    expect(personal.saved("off")).toBe(
      "Saved. Personal templates are off for every user from their next action.",
    );
    expect(personal.confirms[0]).toMatchObject({
      value: "off",
      title: "Turn off personal templates?",
      action: "Turn off",
    });
    const outside = settingTexts("recipientsExternal", "example.com");
    expect(outside.explanation).toBe(
      'Templates can add addresses outside example.com to To, Cc and Bcc. With "example.com only", a template with an outside address cannot be saved and Insert skips the address.',
    );
    expect(outside.options).toEqual([
      ["allow", "Allowed"],
      ["deny", "example.com only"],
    ]);
    expect(outside.saved("deny")).toBe(
      "Saved. Only example.com recipients are allowed.",
    );
    expect(outside.saved("allow")).toBe(
      "Saved. Outside recipients are allowed.",
    );
    expect(outside.confirms[0]).toMatchObject({
      value: "deny",
      title: "Allow only example.com recipients?",
      action: "Allow only example.com",
    });
  });

  it("shows the last change and the conflict in local time", () => {
    const now = new Date("2026-11-10T20:00:00");
    const entry = {
      value: "on" as const,
      updatedAt: new Date("2026-11-10T14:05:00").toISOString(),
      updatedBy: "ana@example.com",
    };
    expect(
      lastChangeText({ value: "off", updatedAt: "", updatedBy: "" }, now),
    ).toBe("Default, never changed.");
    expect(lastChangeText(entry, now)).toBe(
      "Last change: ana on Nov 10, 2:05 PM.",
    );
    expect(conflictText(entry, now)).toBe(
      "ana changed this setting on Nov 10, 2:05 PM. The page now shows the current value.",
    );
  });

  it("words the Admins rows: added by, owner list, group (D32, spec 7.3)", () => {
    const now = new Date("2026-11-10T20:00:00");
    expect(
      addedByText(
        {
          addedAt: new Date("2026-11-10T14:05:00").toISOString(),
          addedBy: "ana@example.com",
        },
        now,
      ),
    ).toBe("Added by ana on Nov 10, 2:05 PM.");
    expect(
      fixedAdminTexts(
        ["owner@example.com", "it@example.com"],
        "admins@example.com",
      ),
    ).toEqual([
      "Set by the owner: owner@example.com, it@example.com. These cannot be removed here.",
      "Members of admins@example.com.",
    ]);
    expect(fixedAdminTexts([], "")).toEqual([]);
  });

  it("names what each principal type takes and shows paths with spaces", () => {
    expect(principalHint("group")).toContain("Group email");
    expect(principalHint("user")).toBe("User email");
    expect(principalHint("domain")).toContain("Domain");
    expect(principalHint("ou")).toContain("not active yet");
    expect(displayPath("/Sales/Quotes")).toBe("Sales / Quotes");
    expect(displayPath("/")).toBe("");
  });
});

describe("export, import and config helpers (slice 6b)", () => {
  it("names the download after the scope and the local date", () => {
    const now = new Date(2026, 10, 9, 23, 30);
    expect(exportFileName({ kind: "library", name: "" }, now)).toBe(
      "migway-templates-library-2026-11-09.json",
    );
    expect(
      exportFileName({ kind: "folder", name: "Sales / Quotes!" }, now),
    ).toBe("migway-templates-sales-quotes-2026-11-09.json");
    expect(exportFileName({ kind: "folder", name: "Été" }, now)).toBe(
      "migway-templates-ete-2026-11-09.json",
    );
    expect(exportFileName({ kind: "folder", name: "!!" }, now)).toBe(
      "migway-templates-folder-2026-11-09.json",
    );
  });

  it("turns a date input into the local midnight instant", () => {
    vi.stubEnv("TZ", "Europe/Berlin");
    expect(localDayStart("2026-11-09")).toBe("2026-11-08T23:00:00.000Z");
    expect(localDayStart("2026-11-09", true)).toBe("2026-11-09T23:00:00.000Z");
    expect(localDayStart("")).toBe("");
    expect(localDayStart("9.11.2026")).toBe("");
    vi.unstubAllEnvs();
  });

  it("formats sizes and import reports", () => {
    expect(formatBytes(870400)).toBe("850 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 MB");
    const counts = {
      dryRun: true,
      created: 40,
      skipped: 2,
      failed: 1,
      foldersCreated: 3,
      foldersReused: 0,
      subjectsFlattened: 0,
    };
    expect(importSummary(counts)).toBe(
      "Checked. Import would create 40 templates, 2 skipped, 1 failed. Folders: 3 new, 0 existing.",
    );
    expect(
      importSummary({ ...counts, dryRun: false, subjectsFlattened: 2 }),
    ).toBe(
      "Imported 40 templates, 2 skipped, 1 failed. Folders: 3 new, 0 existing. 2 subjects had line breaks, replaced by a space.",
    );
  });
});
