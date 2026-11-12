import { describe, expect, it } from "vitest";
import {
  closeGaps,
  renderBody,
  renderSubject,
} from "../../../src/shared/placeholders/render";

/** Fields without a value are removed (D31); ADR-0004 Amendment 2026-11-11. No field has a value; no phone. */
const none = { values: {}, answers: {} };
const body = (html: string) => renderBody(html, none).html;
const subject = (text: string) => renderSubject(text, none).text;

describe("the 8 test pairs of ADR-0004 Amendment 2026-11-11", () => {
  it.each([
    ["Hi {{ask:Name}}, thanks", "Hi, thanks"],
    ["Load {{ask:Load number}} is ready", "Load is ready"],
    ["Your load {{ask:Load}}.", "Your load."],
    ["{{ask:Greeting}} team,", "team,"],
    ["Thanks {{ask:Name}}", "Thanks"],
    ["Hi {{ask:A}} {{ask:B}}, ok", "Hi, ok"],
    ["Call {{sender.phone|the office}} today", "Call the office today"],
  ])("body %s gives %s", (input, output) => {
    expect(body(`<p>${input}</p>`)).toBe(`<p>${output}</p>`);
  });

  it("subject Quote {{ask:Product}} for {{ask:Client}} gives Quote for; {{ask:Topic}} gives empty", () => {
    expect(subject("Quote {{ask:Product}} for {{ask:Client}}")).toBe(
      "Quote for",
    );
    expect(subject("{{ask:Topic}}")).toBe("");
  });

  it("the same pairs hold in the subject", () => {
    expect(subject("Hi {{ask:Name}}, thanks")).toBe("Hi, thanks");
    expect(subject("{{ask:Greeting}} team,")).toBe("team,");
    expect(subject("Hi {{ask:A}} {{ask:B}}, ok")).toBe("Hi, ok");
  });
});

describe("an unpicked date field (spec 5.9 example 2)", () => {
  it("is removed with the gap rules, as an unfilled ask field", () => {
    expect(body("<p>Pickup on {{date:Pickup date}}.</p>")).toBe(
      "<p>Pickup on.</p>",
    );
    expect(subject("Load ready {{date:Pickup date}}")).toBe("Load ready");
  });
});

describe("left alone on purpose (ADR-0004 Amendment 2026-11-11)", () => {
  it("spaces across inline tags", () => {
    expect(body("<p>Hi <b>{{ask:Name}}</b>, thanks</p>")).toBe(
      "<p>Hi <b></b>, thanks</p>",
    );
  });

  it("non-breaking spaces, tabs and line breaks", () => {
    expect(body("<p>Hi&nbsp;{{ask:Name}}, thanks</p>")).toBe(
      body("<p>Hi&nbsp;, thanks</p>"),
    );
    expect(body("<p>Hi\t{{ask:Name}} ok</p>")).toBe("<p>Hi\t ok</p>");
    expect(body("<p>Hi\n{{ask:Name}} ok</p>")).toBe("<p>Hi\n ok</p>");
  });

  it("the template's own double spaces away from a gap", () => {
    expect(body("<p>Hi  there {{ask:Name}}</p>")).toBe("<p>Hi  there</p>");
  });

  it("other punctuation: brackets, quotes, dashes", () => {
    expect(body("<p>Ref ({{ask:Ref}}) ok</p>")).toBe("<p>Ref () ok</p>");
    expect(body("<p>Say {{ask:Word}}) now</p>")).toBe("<p>Say ) now</p>");
    expect(subject('Say "{{ask:Word}}" now')).toBe('Say "" now');
    expect(body("<p>Hi {{ask:Name}} - ok</p>")).toBe("<p>Hi - ok</p>");
  });

  it("a paragraph, list item or table cell left empty stays", () => {
    expect(body("<p>Hi team,</p><p>{{ask:PS}}</p><p>Thanks</p>")).toBe(
      "<p>Hi team,</p><p></p><p>Thanks</p>",
    );
    expect(body("<ul><li>{{ask:A}}</li></ul>")).toBe("<ul><li></li></ul>");
    expect(body("<table><tr><td>{{ask:A}}</td></tr></table>")).toBe(
      "<table><tr><td></td></tr></table>",
    );
  });

  it("words that read wrong without the value", () => {
    expect(body("<p>Call me at {{sender.phone}}.</p>")).toBe(
      "<p>Call me at.</p>",
    );
  });
});

describe("value order (AC 3): value, fallback, else empty text", () => {
  it.each([
    [{ "sender.name": "Ana" }, "Hi Ana, ok"],
    [{}, "Hi, ok"],
  ])("body and subject with values %j give %s", (values, expected) => {
    const input = { values, answers: {} };
    expect(renderBody("<p>Hi {{sender.name}}, ok</p>", input).html).toBe(
      `<p>${expected}</p>`,
    );
    expect(renderSubject("Hi {{sender.name}}, ok", input).text).toBe(expected);
  });

  it("a fallback renders the fallback; an empty fallback is a gap", () => {
    const input = { values: {}, answers: {} };
    expect(renderBody("<p>Hi {{sender.name|team}}!</p>", input).html).toBe(
      "<p>Hi team!</p>",
    );
    expect(renderSubject("Hi {{sender.name|team}}!", input).text).toBe(
      "Hi team!",
    );
    expect(renderBody("<p>Hi {{sender.name|}}!</p>", input).html).toBe(
      "<p>Hi!</p>",
    );
  });

  it("a typed answer wins over the variable's value", () => {
    const input = {
      values: { "recipient.first_name": "Bob" },
      answers: { "{var}recipient.first_name": "Robert" },
    };
    expect(renderBody("<p>Hi {{recipient.first_name}}</p>", input).html).toBe(
      "<p>Hi Robert</p>",
    );
    expect(
      renderBody("<p>Hi {{recipient.first_name}}</p>", {
        ...input,
        answers: { "{var}recipient.first_name": " " },
      }).html,
    ).toBe("<p>Hi Bob</p>");
  });

  it("removes an explicit field and an unresolved variable alike", () => {
    expect(body("<p>{{ask:A}} {{sender.phone}} x</p>")).toBe("<p>x</p>");
  });
});

describe("closeGaps", () => {
  it.each([
    [["a ", null, " b"], "a b"],
    [["a ", null, "."], "a."],
    [[null, " b"], "b"],
    [["a ", null], "a"],
    [["a", null, "b"], "ab"],
    [[null, null, " b"], "b"],
    [["a ", null, "", " b"], "a b"],
    [[null], ""],
  ])("%j gives %s", (parts, expected) => {
    expect(closeGaps(parts)).toBe(expected);
  });
});
