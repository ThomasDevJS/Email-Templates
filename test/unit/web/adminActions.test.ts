/** Audit log wording and the Empty trash result (slice 8c), pure functions of src/web/admin/actions.ts. */
import { describe, expect, it } from "vitest";
import {
  actionWords,
  emptyTrashQuestion,
  rowActionWords,
  purgeText,
  resultTag,
} from "../../../src/web/admin/actions";
import { POLICY } from "../../../src/server/dispatch/policy";

describe("actionWords", () => {
  it("names operations in words and keeps an unknown name as it is", () => {
    expect(actionWords("template.update")).toBe("Template updated");
    expect(actionWords("grant.add")).toBe("Grant added");
    expect(actionWords("backup.restore")).toBe("Backup restored");
    expect(actionWords("export.library")).toBe("Library export started");
    expect(actionWords("future.op")).toBe("future.op");
    expect(actionWords("toString")).toBe("toString");
    expect(actionWords("")).toBe("");
  });

  it("has words for every audited write operation", () => {
    const writes = Object.keys(POLICY).filter((op) =>
      /\.(create|update|duplicate|delete|move|rename|restore|restoreFromTrash|add|remove|purge|set|unset|apply)$|^import$/.test(
        op,
      ),
    );
    expect(writes.length).toBeGreaterThan(15);
    expect(writes.filter((op) => actionWords(op) === op)).toEqual([]);
  });
});

describe("resultTag", () => {
  it("gives a word and a tint for each result", () => {
    expect(resultTag("ok")).toEqual({ word: "OK", tone: "ok" });
    expect(resultTag("denied")).toEqual({ word: "Denied", tone: "bad" });
    expect(resultTag("error")).toEqual({ word: "Error", tone: "bad" });
    expect(resultTag("conflict")).toEqual({ word: "Conflict", tone: "warn" });
    expect(resultTag("other")).toEqual({ word: "other", tone: "plain" });
  });
});

describe("purgeText", () => {
  it("counts templates like the dialog and names deleted folders apart", () => {
    expect(purgeText(4, 0)).toBe(
      "Emptied the trash: 4 templates removed for good.",
    );
    expect(purgeText(1, 0)).toBe(
      "Emptied the trash: 1 template removed for good.",
    );
    expect(purgeText(4, 1)).toBe(
      "Emptied the trash: 4 templates and 1 deleted folder removed for good.",
    );
    expect(purgeText(0, 2)).toBe(
      "Emptied the trash: 0 templates and 2 deleted folders removed for good.",
    );
  });

  it("takes the server's counts, whatever the list showed", () => {
    expect(purgeText(2, 0)).toBe(
      "Emptied the trash: 2 templates removed for good.",
    );
    expect(purgeText(0, 0)).toBe(
      "Emptied the trash: 0 templates removed for good.",
    );
  });
});

describe("rowActionWords", () => {
  it("labels an export start with its count and folder path, other rows with the action words", () => {
    expect(
      rowActionWords({
        action: "export.library",
        targetPath: "",
        exportTemplates: 25,
      }),
    ).toBe("Library export started, 25 templates");
    expect(
      rowActionWords({
        action: "export.folder",
        targetPath: "/Sales/Quotes",
        exportTemplates: 1,
      }),
    ).toBe("Folder export started: Sales / Quotes, 1 template");
    expect(rowActionWords({ action: "export.folder", targetPath: "/S" })).toBe(
      "Folder export started",
    );
    expect(rowActionWords({ action: "grant.add", targetPath: "/S" })).toBe(
      "Grant added",
    );
  });
});

describe("emptyTrashQuestion", () => {
  it("uses the singular for one template and the plural otherwise", () => {
    expect(emptyTrashQuestion(1)).toBe(
      "Empty the trash? The 1 template in it is removed for good, and deleted folders go too. This cannot be undone.",
    );
    expect(emptyTrashQuestion(3)).toBe(
      "Empty the trash? All 3 templates in it are removed for good, and deleted folders go too. This cannot be undone.",
    );
  });
});
