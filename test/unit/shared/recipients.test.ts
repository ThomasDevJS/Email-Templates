import { describe, expect, it } from "vitest";
import {
  NO_RECIPIENTS,
  externalRule,
  importRecipients,
  isAddress,
  isOutside,
  normalizeRecipients,
  recipientsOf,
  splitBlocked,
  unreadableRecipients,
  validateRecipients,
  type RecipientPolicy,
  type Recipients,
} from "../../../src/shared/model/recipients";
import { indexProblem } from "../../../src/shared/model/shape";

/** Template recipients (spec 5.7, 7.1): syntax, limits, normalization, the outside rule. */
const ALLOW: RecipientPolicy = { domain: "migway.com", external: "allow" };
const DENY: RecipientPolicy = { domain: "migway.com", external: "deny" };

const lists = (fields: Partial<Recipients>): Recipients => ({
  ...NO_RECIPIENTS,
  ...fields,
});
const many = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => `${tag}${String(i)}@migway.com`);

describe("normalization", () => {
  it("trims, lower cases, drops blanks and repeats inside a field, keeps order", () => {
    expect(
      normalizeRecipients(
        lists({
          to: ["  B@Migway.com ", "a@migway.com", "b@migway.com", " "],
          cc: ["A@MIGWAY.COM"],
        }),
      ),
    ).toEqual({
      to: ["b@migway.com", "a@migway.com"],
      cc: ["a@migway.com"],
      bcc: [],
    });
  });

  it("reads absent lists as empty", () => {
    expect(recipientsOf({})).toEqual(NO_RECIPIENTS);
    expect(recipientsOf({ cc: ["x@migway.com"] }).cc).toEqual(["x@migway.com"]);
  });

  it("reads a list failing the shape rule as empty and names it", () => {
    const stored = { to: ["a@migway.com"], cc: "x@y.zz", bcc: [1] };
    expect(recipientsOf(stored)).toEqual({
      to: ["a@migway.com"],
      cc: [],
      bcc: [],
    });
    expect(unreadableRecipients(stored)).toEqual(["cc", "bcc"]);
    expect(unreadableRecipients({})).toEqual([]);
  });

  it("treats only `deny` (any case, spaces) as deny", () => {
    expect(externalRule(null)).toBe("allow");
    expect(externalRule("")).toBe("allow");
    expect(externalRule("no")).toBe("allow");
    expect(externalRule(" DENY ")).toBe("deny");
  });
});

describe("syntax (spec 5.7)", () => {
  it.each([
    "a@migway.com",
    "first.last+tag@mail.migway.com",
    "o'neil@x-y.co",
    "a_b%c-d@a1.b2",
  ])("accepts %s", (address) => {
    expect(isAddress(address)).toBe(true);
  });

  it.each([
    "plain",
    "a@localhost",
    "a..b@migway.com",
    "a@migway..com",
    "a@-migway.com",
    "a@migway-.com",
    "Name <a@migway.com>",
    "{{sender.email}}",
    "a@mïgway.com",
    `${"x".repeat(65)}@migway.com`,
  ])("refuses %s", (address) => {
    expect(isAddress(address)).toBe(false);
  });

  it("calls a subdomain outside and compares the domain without case", () => {
    expect(isOutside("a@migway.com", "Migway.COM")).toBe(false);
    expect(isOutside("a@eu.migway.com", "migway.com")).toBe(true);
  });
});

describe("validateRecipients codes and texts (spec 7.1)", () => {
  const only = (raw: Partial<Recipients>, policy = ALLOW) =>
    validateRecipients(lists(raw), policy).problems;

  it("RCPT_FORMAT with field and 1-based position", () => {
    expect(only({ cc: ["a@migway.com", "nope"] })).toEqual([
      {
        code: "RCPT_FORMAT",
        message:
          "Cc, address 2 is not an email address. Use the form name@company.com.",
        offset: null,
        field: "cc",
        position: 2,
      },
    ]);
  });

  it("RCPT_TOO_LONG before the format check", () => {
    const long = `${"a".repeat(60)}@${"b".repeat(200)}.com`;
    expect(only({ to: [long] })).toEqual([
      expect.objectContaining({
        code: "RCPT_TOO_LONG",
        message: "To, address 1 is longer than 254 characters.",
        field: "to",
        position: 1,
      }),
    ]);
  });

  it("RCPT_TOO_MANY per field", () => {
    expect(only({ cc: many(11, "c") })).toEqual([
      expect.objectContaining({
        code: "RCPT_TOO_MANY",
        message: "Cc holds 11 addresses. Use at most 10 per field.",
        field: "cc",
      }),
    ]);
  });

  it("RCPT_TOO_MANY over the three fields", () => {
    expect(
      only({ to: many(10, "t"), cc: many(10, "c"), bcc: ["b@migway.com"] }),
    ).toEqual([
      expect.objectContaining({
        code: "RCPT_TOO_MANY",
        message: "To, Cc and Bcc hold 21 addresses together. Use at most 20.",
      }),
    ]);
    expect(only({ to: many(10, "t"), cc: many(10, "c") })).toEqual([]);
  });

  it("counts after removing repeats", () => {
    expect(only({ cc: [...many(10, "c"), "C0@migway.com"] })).toEqual([]);
  });

  it("RCPT_DUPLICATE names both fields, in any case", () => {
    expect(
      only({ to: ["Safety@migway.com"], cc: ["safety@MIGWAY.com"] }),
    ).toEqual([
      expect.objectContaining({
        code: "RCPT_DUPLICATE",
        message:
          "safety@migway.com is in both To and Cc. Keep it in one field.",
        field: "cc",
        position: 1,
      }),
    ]);
  });

  it("RCPT_EXTERNAL only with deny", () => {
    const raw = { bcc: ["records@partner.com"] };
    expect(only(raw)).toEqual([]);
    expect(only(raw, DENY)).toEqual([
      expect.objectContaining({
        code: "RCPT_EXTERNAL",
        message:
          "Bcc, address 1 is outside migway.com. Your admin allows only migway.com addresses. Remove it to save.",
        field: "bcc",
        position: 1,
      }),
    ]);
  });

  it("returns the normalized lists", () => {
    expect(
      validateRecipients(lists({ to: [" A@Migway.com"] }), ALLOW).recipients.to,
    ).toEqual(["a@migway.com"]);
  });
});

describe("importRecipients (spec 5.7 import rule)", () => {
  it("drops bad, outside (deny) and repeated addresses, keeps the first of To, Cc, Bcc", () => {
    const result = importRecipients(
      lists({
        to: ["a@migway.com", "bad"],
        cc: ["A@migway.com", "x@partner.com"],
        bcc: ["b@migway.com"],
      }),
      DENY,
    );
    expect(result.recipients).toEqual({
      to: ["a@migway.com"],
      cc: [],
      bcc: ["b@migway.com"],
    });
    expect(result.dropped).toEqual([
      "RCPT_FORMAT",
      "RCPT_DUPLICATE",
      "RCPT_EXTERNAL",
    ]);
    expect(result.problems).toEqual([]);
  });

  it("keeps outside addresses with allow, and reports too many", () => {
    const result = importRecipients(
      lists({ cc: [...many(11, "c"), "x@partner.com"] }),
      ALLOW,
    );
    expect(result.dropped).toEqual([]);
    expect(result.problems).toEqual([
      expect.objectContaining({ code: "RCPT_TOO_MANY", field: "cc" }),
    ]);
  });
});

describe("splitBlocked (apply under the switch)", () => {
  const stored = lists({
    to: ["payroll@migway.com"],
    cc: ["safety@migway.com", "x@partner.com"],
    bcc: ["records@partner.com"],
  });

  it("returns every list unchanged with allow", () => {
    expect(splitBlocked(stored, ALLOW)).toEqual({ ...stored, blocked: [] });
  });

  it("moves outside addresses to blocked with deny", () => {
    expect(splitBlocked(stored, DENY)).toEqual({
      to: ["payroll@migway.com"],
      cc: ["safety@migway.com"],
      bcc: [],
      blocked: ["x@partner.com", "records@partner.com"],
    });
  });
});

describe("index shape check", () => {
  const doc = (item: Record<string, unknown>) => ({
    schemaVersion: 1,
    rev: 1,
    folders: [],
    grants: [],
    pendingAudit: [],
    items: [
      {
        id: "I",
        folderId: "F",
        title: "T",
        tags: [],
        currentVersion: 1,
        bodyFileId: "B",
        deletedAt: "",
        version: 1,
        ...item,
      },
    ],
  });

  it("accepts items without recipient lists and with string lists", () => {
    expect(indexProblem(doc({}))).toBe("");
    expect(indexProblem(doc({ to: ["a@migway.com"], cc: [], bcc: [] }))).toBe(
      "",
    );
  });

  it("refuses a present non-list", () => {
    expect(indexProblem(doc({ cc: "a@migway.com" }))).toBe("item 1 needs cc");
    expect(indexProblem(doc({ bcc: [1] }))).toBe("item 1 needs bcc");
  });
});
