import { describe, expect, it } from "vitest";
import {
  editDistance,
  closest,
} from "../../../src/shared/placeholders/distance";
import {
  TOKEN_PATTERN,
  parseText,
  promptKey,
  promptToken,
  variableToken,
  type Segment,
} from "../../../src/shared/placeholders/grammar";
import {
  PLACEHOLDER_NAMES,
  isKnownName,
  placeholderInfo,
} from "../../../src/shared/placeholders/registry";
import {
  formatValue,
  promptsFor,
  renderBody,
} from "../../../src/shared/placeholders/render";
import { scanBody } from "../../../src/shared/placeholders/validate";
import { sanitize } from "../../../src/shared/sanitize/sanitize";

/** Compact form of a segment list: T(text) E V(name) V(name|fallback) P(label). */
function shape(segments: readonly Segment[]): string {
  return segments
    .map((segment) => {
      switch (segment.kind) {
        case "text":
          return `T(${segment.text})`;
        case "escape":
          return "E";
        case "variable":
          return segment.fallback === null
            ? `V(${segment.name})`
            : `V(${segment.name}|${segment.fallback})`;
        case "prompt":
          return `P(${segment.label})`;
      }
    })
    .join(" ");
}

const ADR_SAMPLES: readonly [string, string][] = [
  ["{{sender.name}}", "V(sender.name)"],
  [
    "Hi {{recipient.first_name|there}},",
    "T(Hi ) V(recipient.first_name|there) T(,)",
  ],
  ["Date: {{ask:Meeting date}}", "T(Date: ) P(Meeting date)"],
  ["\\{{sender.name}}", "E T(sender.name}})"],
  ["{{ sender.title }}", "V(sender.title)"],
  ["{{ask:X|y}}", "T({{ask:X|y}})"],
];

const GRAMMAR: readonly [string, string][] = [
  ["", ""],
  ["plain text", "T(plain text)"],
  ["{{sender.phone}}", "V(sender.phone)"],
  ["{{sender.department}}", "V(sender.department)"],
  ["{{recipient.first_name}}", "V(recipient.first_name)"],
  ["{{   sender.name   }}", "V(sender.name)"],
  ["{{sender.name |  Ana  }}", "V(sender.name|Ana)"],
  ["{{sender.name|}}", "V(sender.name|)"],
  ["{{sender.name| }}", "V(sender.name|)"],
  ["{{a.b}}", "V(a.b)"],
  ["{{a_b.c_d}}", "V(a_b.c_d)"],
  ["{{Sender.name}}", "T({{Sender.name}})"],
  ["{{sender.Name}}", "T({{sender.Name}})"],
  ["{{sender}}", "T({{sender}})"],
  ["{{sender.name.x}}", "T({{sender.name.x}})"],
  ["{{_sender.name}}", "T({{_sender.name}})"],
  ["{{1sender.name}}", "T({{1sender.name}})"],
  ["{{sender.name}", "T({{sender.name})"],
  ["{sender.name}}", "T({sender.name}})"],
  ["{{{sender.name}}}", "T({) V(sender.name) T(})"],
  ["{{ask:Name}}", "P(Name)"],
  ["{{ask:  Name  }}", "P(Name)"],
  ["{{ ask:Name }}", "P(Name)"],
  ["{{ask:}}", "T({{ask:}})"],
  ["{{ask:   }}", "P()"],
  [`{{ask:${"x".repeat(40)}}}`, `P(${"x".repeat(40)})`],
  [`{{ask:${"x".repeat(41)}}}`, `T({{ask:${"x".repeat(41)}}})`],
  ["{{ask:a<b}}", "T({{ask:a<b}})"],
  ["{{ask:a\\b}}", "T({{ask:a\\b}})"],
  ["{{ask:Line\nbreak}}", "T({{ask:Line\nbreak}})"],
  ["{{ASK:Name}}", "T({{ASK:Name}})"],
  ["{{ask:Café ünïcode}}", "P(Café ünïcode)"],
  [`{{sender.name|${"f".repeat(80)}}}`, `V(sender.name|${"f".repeat(80)})`],
  [`{{sender.name|${"f".repeat(81)}}}`, `T({{sender.name|${"f".repeat(81)}}})`],
  ["{{sender.name|a|b}}", "V(sender.name|a|b)"],
  ["{{sender.name|a{b}}", "T({{sender.name|a{b}})"],
  ["\\{{", "E"],
  ["\\{{ask:Name}}", "E T(ask:Name}})"],
  ["\\\\{{sender.name}}", "T(\\) E T(sender.name}})"],
  ["a {{sender.name}} b {{ask:X}} c", "T(a ) V(sender.name) T( b ) P(X) T( c)"],
  ["{{sender.name}}{{sender.name}}", "V(sender.name) V(sender.name)"],
  ["}} stray", "T(}} stray)"],
  ["{{ unknown.thing }}", "V(unknown.thing)"],
];

describe("token grammar (ADR-0004 EBNF and regex)", () => {
  it("uses the ADR regex character for character", () => {
    expect(TOKEN_PATTERN.source).toBe(
      String.raw`\\\{\{|\{\{ *(?:ask: *([^{}|\\<>\r\n]{1,40}?)|([a-z][a-z_]*\.[a-z][a-z_]*)(?: *\|([^{}\\<>\r\n]{0,80}?))?) *\}\}`,
    );
    expect(TOKEN_PATTERN.flags).toBe("g");
  });

  it.each(ADR_SAMPLES)("ADR sample %j", (input, expected) => {
    expect(shape(parseText(input))).toBe(expected);
  });

  it.each(GRAMMAR)("parses %j", (input, expected) => {
    expect(shape(parseText(input))).toBe(expected);
  });

  it("has at least 40 grammar cases including the 6 ADR samples", () => {
    expect(ADR_SAMPLES.length + GRAMMAR.length).toBeGreaterThanOrEqual(40);
  });

  it("reports offsets from the base", () => {
    const segments = parseText("ab{{sender.name}}", 10);
    expect(segments.map((segment) => segment.offset)).toEqual([10, 12]);
  });

  it("writes canonical tokens and prompt keys", () => {
    expect(variableToken("sender.name", null)).toBe("{{sender.name}}");
    expect(variableToken("sender.name", "there")).toBe("{{sender.name|there}}");
    expect(promptToken("Date")).toBe("{{ask:Date}}");
    expect(promptKey("  Meeting   DATE ")).toBe("meeting date");
  });
});

describe("registry", () => {
  it("holds the 5 v1 names", () => {
    expect(PLACEHOLDER_NAMES).toEqual([
      "sender.name",
      "sender.title",
      "sender.phone",
      "sender.department",
      "recipient.first_name",
    ]);
    expect(isKnownName("sender.email")).toBe(false);
    expect(placeholderInfo("sender.phone")?.promptLabel).toBe("Your phone");
  });

  it("measures edit distance", () => {
    expect(editDistance("sender.nmae", "sender.name")).toBe(2);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(closest("sender.titel", PLACEHOLDER_NAMES, 2)).toBe("sender.title");
    expect(closest("foo.bar", PLACEHOLDER_NAMES, 2)).toBeNull();
  });
});

function codes(html: string): string[] {
  return scanBody(html).problems.map((problem) => problem.code);
}

describe("validator (every ADR-0004 error code)", () => {
  it("accepts every registry name and collects names and prompts", () => {
    const scan = scanBody(
      "<p>{{sender.name}} {{sender.title}} {{ask:Date}} {{ask: date }} {{ask:Product}}</p>",
    );
    expect(scan.problems).toEqual([]);
    expect(scan.placeholders).toEqual(["sender.name", "sender.title"]);
    expect(scan.prompts).toEqual(["Date", "Product"]);
  });

  it("PH_UNKNOWN with a did-you-mean hint at distance 2", () => {
    const [problem] = scanBody("<p>Hi {{sender.nmae}}</p>").problems;
    expect(problem).toEqual({
      code: "PH_UNKNOWN",
      message:
        "Unknown placeholder sender.nmae at character 4. Did you mean sender.name?",
      offset: 3,
    });
  });

  it("PH_UNKNOWN without a hint when nothing is close", () => {
    expect(scanBody("{{company.name}}").problems[0]?.message).toBe(
      "Unknown placeholder company.name at character 1.",
    );
  });

  it("PH_CASE for upper-case names and ask", () => {
    expect(codes("{{Sender.Name}}")).toEqual(["PH_CASE"]);
    expect(scanBody("{{Sender.Name}}").problems[0]?.message).toContain(
      "Use lower case: sender.name",
    );
    expect(codes("{{ASK:Date}}")).toEqual(["PH_CASE"]);
  });

  it("PH_MALFORMED for unclosed, split and invalid tokens", () => {
    expect(codes("<p>{{sender.name</p>")).toEqual(["PH_MALFORMED"]);
    expect(codes("<p>{{sender.name}</p>")).toEqual(["PH_MALFORMED"]);
    expect(codes("<p>{{<b>sender</b>.name}}</p>")).toEqual(["PH_MALFORMED"]);
    expect(codes("{{sender}}")).toEqual(["PH_MALFORMED"]);
    expect(codes(`{{sender.name|${"f".repeat(81)}}}`)).toEqual([
      "PH_MALFORMED",
    ]);
    expect(scanBody("x {{sender.name").problems[0]?.message).toBe(
      "Placeholder at character 3 is not closed",
    );
  });

  it("PH_LABEL for empty, blank, long and invalid labels", () => {
    expect(codes("{{ask:}}")).toEqual(["PH_LABEL"]);
    expect(codes("{{ask:   }}")).toEqual(["PH_LABEL"]);
    expect(codes(`{{ask:${"x".repeat(41)}}}`)).toEqual(["PH_LABEL"]);
    expect(codes("{{ask:a&lt;b}}")).toEqual(["PH_LABEL"]);
  });

  it("PH_FALLBACK_ASK for prompts with a fallback", () => {
    expect(codes("{{ask:Date|today}}")).toEqual(["PH_FALLBACK_ASK"]);
  });

  it("PH_ATTR for tokens inside attribute values", () => {
    const scan = scanBody("<p>x</p>", [{ tag: "a", attr: "href" }]);
    expect(scan.problems).toEqual([
      {
        code: "PH_ATTR",
        message: "Placeholders work in text only (href of a)",
        offset: null,
      },
    ]);
  });

  it("PH_TOO_MANY above 20 distinct prompts; repeats count once", () => {
    const twenty = Array.from(
      { length: 20 },
      (_, i) => `{{ask:Q${String(i)}}}`,
    ).join(" ");
    expect(codes(`${twenty} {{ask:q0}} {{ask:Q1}}`)).toEqual([]);
    expect(codes(`${twenty} {{ask:Q20}}`)).toEqual(["PH_TOO_MANY"]);
  });

  it("warns for recipient.first_name without a fallback", () => {
    const scan = scanBody(
      "<p>Hi {{recipient.first_name}}, {{recipient.first_name|there}}</p>",
    );
    expect(scan.problems).toEqual([]);
    expect(scan.warnings).toEqual([
      {
        code: "PH_NO_FALLBACK",
        message:
          "recipient.first_name has no fallback (at character 4); users will be asked for it",
        offset: 3,
      },
    ]);
  });

  it("ignores escapes and counts offsets across text nodes", () => {
    expect(codes("<p>\\{{not a token</p>")).toEqual([]);
    const [problem] = scanBody("<p>ab</p><p>cd {{x.y}}</p>").problems;
    expect(problem?.offset).toBe(5);
  });
});

describe("renderer (ADR-0004 apply semantics)", () => {
  const values = { "sender.name": "Ana <Lopez>", "sender.title": "" };

  it("escapes values and turns newlines into <br>", () => {
    expect(formatValue(`a & b < c > d " e ' f\ng\r\nh`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &#39; f<br>g<br>h",
    );
    const out = renderBody("<p>{{sender.name}}</p>", { values, answers: {} });
    expect(out).toEqual({ html: "<p>Ana &lt;Lopez&gt;</p>", missing: [] });
  });

  it("uses the fallback for blank values and renders \\{{ as {{", () => {
    const out = renderBody("<p>{{sender.title|Team}} \\{{x}}</p>", {
      values,
      answers: {},
    });
    expect(out.html).toBe("<p>Team {{x}}</p>");
  });

  it("fills same-name prompts once, case and space insensitive", () => {
    const html = "<p>{{ask:Date}} and {{ask: date }} and {{ask:DATE}}</p>";
    expect(promptsFor(html, values)).toEqual([
      { key: "date", label: "Date", implicit: false },
    ]);
    const out = renderBody(html, { values, answers: { date: "Monday" } });
    expect(out.html).toBe("<p>Monday and Monday and Monday</p>");
  });

  it("turns an unresolved variable without fallback into an implicit prompt", () => {
    const html =
      "<p>{{sender.phone}} {{sender.title}} {{recipient.first_name|there}}</p>";
    expect(promptsFor(html, values)).toEqual([
      { key: "{var}sender.phone", label: "Your phone", implicit: true },
      { key: "{var}sender.title", label: "Your title", implicit: true },
    ]);
    const blocked = renderBody(html, {
      values,
      answers: { "{var}sender.phone": " " },
    });
    expect(blocked.missing.map((field) => field.label)).toEqual([
      "Your phone",
      "Your title",
    ]);
    const done = renderBody(html, {
      values,
      answers: { "{var}sender.phone": "+1 555", "{var}sender.title": "Lead" },
    });
    expect(done).toEqual({ html: "<p>+1 555 Lead there</p>", missing: [] });
  });

  it("never creates markup from values or fallbacks", () => {
    const html = sanitize(`<p>{{sender.name|Tom &amp; 'Jerry'}}</p>`);
    expect(renderBody(html, { values: {}, answers: {} }).html).toBe(
      "<p>Tom &amp; &#39;Jerry&#39;</p>",
    );
    const answers = { "{var}sender.phone": "<img src=x onerror=alert(1)>" };
    expect(
      renderBody("<p>{{sender.phone}}</p>", { values: {}, answers }).html,
    ).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
  });

  it("keeps markup around tokens", () => {
    const out = renderBody(
      '<p><strong>{{sender.name}}</strong> <a href="https://x.com" rel="noopener noreferrer" target="_blank">x</a></p>',
      {
        values,
        answers: {},
      },
    );
    expect(out.html).toBe(
      '<p><strong>Ana &lt;Lopez&gt;</strong> <a href="https://x.com" rel="noopener noreferrer" target="_blank">x</a></p>',
    );
  });
});

/** Seeded generator for the property test (no dependency on Math.random). */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return Math.floor(state / 65536);
  };
}

const PIECES = [
  "<p>",
  "</p>",
  "<b>",
  "</b>",
  "<a href='https://x.com'>",
  "</a>",
  "<br>",
  "&amp;",
  "&lt;",
  "&gt;",
  "&quot;",
  "&nbsp;",
  '"',
  "'",
  "{",
  "}",
  "|",
  "\\",
  "text",
  " ",
  "\n",
  "é",
  "😀",
  "<span style='color:red'>",
  "</span>",
  "<ul><li>",
  "</li></ul>",
  "<td>",
  "<table>",
  "</table>",
];

describe("property: render(parse(x)) equals x without tokens", () => {
  it("holds for 300 generated sanitized bodies", () => {
    const next = generator(7);
    let checked = 0;
    for (let n = 0; n < 300; n += 1) {
      const length = 1 + (next() % 30);
      const raw = Array.from(
        { length },
        () => PIECES[next() % PIECES.length] ?? "",
      ).join("");
      const html = sanitize(raw);
      if (html.includes("{{")) continue;
      expect(renderBody(html, { values: {}, answers: {} })).toEqual({
        html,
        missing: [],
      });
      expect(scanBody(html).problems).toEqual([]);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(250);
  });
});
