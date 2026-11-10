import { describe, expect, it } from "vitest";
import {
  promptsFor,
  renderSubject,
} from "../../../src/shared/placeholders/render";
import {
  controlIndex,
  oneLine,
} from "../../../src/shared/placeholders/subject";
import { scanBody } from "../../../src/shared/placeholders/validate";

describe("subject text rules (spec 5.6)", () => {
  it("finds the first control character, line separators included", () => {
    expect(controlIndex("plain")).toBe(-1);
    expect(controlIndex("a\tb\nc")).toBe(1);
    expect(controlIndex("x\u007f")).toBe(1);
    expect(controlIndex("x ")).toBe(1);
    expect(controlIndex("\u0000")).toBe(0);
  });

  it("turns control characters into one space, collapses and trims", () => {
    expect(oneLine(" a\r\n\tb  c  ")).toBe("a b c");
    expect(oneLine("")).toBe("");
  });
});

describe("renderSubject", () => {
  const values = { "sender.name": "Ana <Lima> & Co" };

  it("inserts values as plain text, never escaped, and flattens line breaks in answers", () => {
    const rendered = renderSubject(
      "Quote for {{ask:Product}} from {{sender.name}} {{recipient.first_name|there}} \\{{x}}",
      { values, answers: { product: "Line one\nline <two>" } },
    );
    expect(rendered).toEqual({
      text: "Quote for Line one line <two> from Ana <Lima> & Co there {{x}}",
      missing: [],
    });
  });

  it("reports missing prompts and unresolved values without fallback", () => {
    const rendered = renderSubject("{{ask:Product}} {{recipient.first_name}}", {
      values: {},
      answers: {},
    });
    expect(rendered.text).toBe("");
    expect(rendered.missing.map((field) => field.key)).toEqual([
      "product",
      "{var}recipient.first_name",
    ]);
  });
});

describe("prompts shared by subject and body", () => {
  it("asks one label identity once, subject first", () => {
    const fields = promptsFor(
      "<p>{{ask:product}} {{ask:Date}} {{recipient.first_name}}</p>",
      {},
      "{{ask:Product}} {{recipient.first_name}}",
    );
    expect(fields.map((field) => field.label)).toEqual([
      "Product",
      "Recipient first name",
      "Date",
    ]);
  });

  it("scanBody tags subject problems and warnings with the field and keeps body offsets", () => {
    const scan = scanBody(
      "<p>{{sender.nmae}}</p>",
      [],
      "{{recipient.first_name}} {{ask:}}",
    );
    expect(scan.problems).toEqual([
      expect.objectContaining({
        code: "PH_LABEL",
        offset: 25,
        field: "subject",
      }),
      expect.not.objectContaining({ field: "subject" }),
    ]);
    expect(scan.problems[1]).toMatchObject({ code: "PH_UNKNOWN", offset: 0 });
    expect(scan.warnings).toEqual([
      expect.objectContaining({ code: "PH_NO_FALLBACK", field: "subject" }),
    ]);
  });
});
