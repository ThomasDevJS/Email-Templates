import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/shared/errors/codes";
import { isId, makeId } from "../../../src/shared/ids";
import type { Folder } from "../../../src/shared/model/data";
import {
  folderName,
  tagList,
  templateTitle,
  uniqueSiblingName,
} from "../../../src/shared/model/validate";
import { plainTextOf, snippetOf, utf8Length } from "../../../src/shared/text";

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  return "none";
}

describe("ids", () => {
  it("makes 26-character IDs that sort by time", () => {
    const early = makeId(Date.parse("2026-01-01T00:00:00Z"), () => 31);
    const late = makeId(Date.parse("2026-01-01T00:00:01Z"), () => 0);
    expect(early).toHaveLength(26);
    expect(isId(early)).toBe(true);
    expect(early < late).toBe(true);
    expect(isId("lowercase-not-an-id-000000")).toBe(false);
    expect(isId(42)).toBe(false);
  });
});

describe("text", () => {
  it("turns HTML into plain text without script or style content", () => {
    expect(
      plainTextOf(
        "<p>Hi&nbsp;<b>Ana</b> &amp; team</p><script>x()</script><style>p{}</style>&lt;3 &quot;q&quot; &#39;s&#39;",
      ),
    ).toBe(`Hi Ana & team <3 "q" 's'`);
  });

  it("cuts snippets at 140 characters", () => {
    expect(snippetOf("short")).toBe("short");
    const long = snippetOf("a".repeat(200));
    expect(long).toHaveLength(140);
    expect(long.endsWith("…")).toBe(true);
  });

  it("counts UTF-8 bytes", () => {
    expect(utf8Length("aé€😀")).toBe(1 + 2 + 3 + 4);
  });
});

function folder(id: string, extra: Partial<Folder> = {}): Folder {
  return {
    id,
    parentId: "",
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

describe("validation (spec section 5)", () => {
  it("bounds names, titles and tags", () => {
    expect(folderName("  Sales ")).toBe("Sales");
    expect(codeOf(() => folderName(" "))).toBe("VALIDATION");
    expect(codeOf(() => folderName("x".repeat(81)))).toBe("VALIDATION");
    expect(templateTitle("x".repeat(120))).toHaveLength(120);
    expect(codeOf(() => templateTitle("x".repeat(121)))).toBe("VALIDATION");
    expect(tagList(["a", "a", " b "])).toEqual(["a", "b"]);
    expect(
      codeOf(() => tagList(Array.from({ length: 11 }, (_, i) => String(i)))),
    ).toBe("VALIDATION");
    expect(codeOf(() => tagList(["x".repeat(31)]))).toBe("VALIDATION");
  });

  it("keeps sibling names unique among live folders of the same kind and owner", () => {
    const folders = [
      folder("a", { name: "Sales" }),
      folder("b", { name: "Old", deletedAt: "2026-01-01" }),
      folder("p", {
        name: "My templates",
        kind: "private",
        ownerEmail: "ana@example.com",
      }),
    ];
    const unique = (c: Parameters<typeof uniqueSiblingName>[1]) =>
      codeOf(() => {
        uniqueSiblingName(folders, c);
      });
    const candidate = {
      id: "new",
      parentId: "",
      kind: "shared" as const,
      ownerEmail: "",
    };
    expect(unique({ ...candidate, name: "sales" })).toBe("VALIDATION");
    expect(unique({ ...candidate, name: "Old" })).toBe("none");
    expect(unique({ ...candidate, id: "a", name: "Sales" })).toBe("none");
    expect(
      unique({
        ...candidate,
        kind: "private",
        ownerEmail: "bob@example.com",
        name: "My templates",
      }),
    ).toBe("none");
  });
});
