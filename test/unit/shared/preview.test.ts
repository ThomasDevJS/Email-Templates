import { describe, expect, it } from "vitest";
import { previewText } from "../../../src/shared/placeholders/preview";
import { variableValues } from "../../../src/shared/model/sidebar";

describe("sidebar preview text (wireframe 01)", () => {
  it("puts blocks on lines, drops inline tags, decodes entities, shows tokens as [Label]", () => {
    expect(
      previewText(
        "<p>Hi {{recipient.first_name|there}},</p><ul><li><b>Date</b>: {{ask: Meeting   date }}</li><li>a &amp; b &lt;c&gt;</li></ul><p>\\{{literal}} {{sender.name}}<br>end</p>",
      ),
    ).toBe(
      "Hi [Recipient first name],\nDate: [Meeting date]\na & b <c>\n{{literal}} [Sender name]\nend",
    );
  });

  it("caps the text with an ellipsis", () => {
    const text = previewText(`<p>${"x".repeat(700)}</p>`);
    expect(text).toHaveLength(600);
    expect(text.endsWith("…")).toBe(true);
    expect(previewText("<p>abc</p>", 3)).toBe("abc");
    expect(previewText("")).toBe("");
  });

  it("collapses whitespace and empty blocks", () => {
    expect(previewText("<p>  a   b </p><p> </p><div><p>c</p></div>")).toBe(
      "a b\nc",
    );
  });
});

describe("variableValues", () => {
  it("maps sender fields and the recipient first name to registry names", () => {
    expect(
      variableValues(
        { name: "N", title: "T", phone: "P", department: "D" },
        "R",
      ),
    ).toEqual({
      "sender.name": "N",
      "sender.title": "T",
      "sender.phone": "P",
      "sender.department": "D",
      "recipient.first_name": "R",
    });
  });
});
