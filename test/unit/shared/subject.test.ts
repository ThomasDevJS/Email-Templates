import { describe, expect, it } from "vitest";
import {
  promptsFor,
  renderSubject,
} from "../../../src/shared/placeholders/render";
import {
  SUBJECT_MAX,
  controlIndex,
  oneLine,
} from "../../../src/shared/placeholders/subject";
import { scanBody } from "../../../src/shared/placeholders/validate";

describe("rendered subject length (slice 15 review minor 4)", () => {
  // "Load " + answer + " for Ann": 13 characters around the answer.
  const ask = (answer: string) =>
    renderSubject("Load {{ask:Number}} for {{ask:Driver}}", {
      values: {},
      answers: { number: answer, driver: "Ann" },
    }).text;

  it("cuts a long rendered subject to SUBJECT_MAX characters", () => {
    const text = ask("7".repeat(500));
    expect(text).toHaveLength(SUBJECT_MAX);
    expect(text.startsWith("Load 777")).toBe(true);
  });

  it("never splits an emoji at the cut and drops a trailing space", () => {
    const emoji = ask(`${"x".repeat(SUBJECT_MAX - 6)}\u{1F600}y`);
    expect(emoji).toHaveLength(SUBJECT_MAX - 1);
    expect(emoji.endsWith("x")).toBe(true);
    expect(ask(`${"x".repeat(SUBJECT_MAX - 6)} yy`)).toHaveLength(
      SUBJECT_MAX - 1,
    );
  });

  it("leaves a subject at the limit unchanged", () => {
    const text = ask("x".repeat(SUBJECT_MAX - 13));
    expect(text).toHaveLength(SUBJECT_MAX);
    expect(text.endsWith(" for Ann")).toBe(true);
  });
});

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
    });
  });

  it("removes prompts and unresolved values without fallback", () => {
    const rendered = renderSubject("{{ask:Product}} {{recipient.first_name}}", {
      values: {},
      answers: {},
    });
    expect(rendered.text).toBe("");
    expect(
      promptsFor("", {}, "{{ask:Product}} {{recipient.first_name}}").map(
        (field) => field.key,
      ),
    ).toEqual(["product", "{var}recipient.first_name"]);
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
