/** Audit log wording and the Empty trash result (slice 8c), pure functions of src/web/admin/actions.ts. */
import { describe, expect, it } from "vitest";
import {
  actionWords,
  purgeText,
  resultTag,
} from "../../../src/web/admin/actions";
import { POLICY } from "../../../src/server/dispatch/policy";

describe("actionWords", () => {
  it("names operations in words and keeps an unknown name as it is", () => {
    expect(actionWords("template.update")).toBe("Template updated");
    expect(actionWords("grant.add")).toBe("Grant added");
    expect(actionWords("backup.restore")).toBe("Backup restored");
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
    expect(purgeText(4, 0, 4)).toBe("Removed 4 templates for good.");
    expect(purgeText(1, 0, 1)).toBe("Removed 1 template for good.");
    expect(purgeText(4, 0, 5)).toBe(
      "Removed 4 templates and 1 deleted folder for good.",
    );
    expect(purgeText(0, 0, 2)).toBe(
      "Removed 0 templates and 2 deleted folders for good.",
    );
  });

  it("never counts more templates than the server removed", () => {
    expect(purgeText(3, 0, 2)).toBe("Removed 2 templates for good.");
    expect(purgeText(1, 2, 0)).toBe("Removed 0 templates for good.");
  });
});
