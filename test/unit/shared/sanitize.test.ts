import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareBody } from "../../../src/shared/body/prepare";
import { AppError } from "../../../src/shared/errors/codes";
import { filterStyle } from "../../../src/shared/sanitize/css";
import { sanitize, sanitizeHtml } from "../../../src/shared/sanitize/sanitize";

const DIR = join(import.meta.dirname, "..", "..", "fixtures", "sanitizer");
const NAMES = readdirSync(DIR)
  .filter((file) => file.endsWith(".input.html"))
  .map((file) => file.replace(".input.html", ""))
  .sort();

const read = (name: string, kind: "input" | "expected"): string =>
  readFileSync(join(DIR, `${name}.${kind}.html`), "utf8");

function thrown(run: () => unknown): AppError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) return error;
  }
  throw new Error("expected an AppError");
}

describe("sanitizer fixtures (ADR-0004 list)", () => {
  it("has 26 malicious and 15 benign cases", () => {
    expect(NAMES.filter((name) => name.startsWith("m"))).toHaveLength(26);
    expect(NAMES.filter((name) => name.startsWith("b"))).toHaveLength(15);
  });

  it.each(NAMES)("%s matches its expected output", (name) => {
    expect(sanitize(read(name, "input"))).toBe(read(name, "expected"));
  });

  it.each(NAMES)("%s is idempotent", (name) => {
    const once = sanitize(read(name, "input"));
    expect(sanitize(once)).toBe(once);
  });

  it.each(NAMES.filter((name) => name.startsWith("m")))(
    "%s output holds no script vector",
    (name) => {
      const out = read(name, "expected").toLowerCase();
      expect(out).not.toMatch(
        /<script|<style|<iframe|<svg|<math|<object|<embed|<form|<meta|<base|<link|\son\w+=|javascript:|vbscript:|data:|expression\(|url\(|srcset|xlink/,
      );
    },
  );

  it("flattens nesting beyond 32 levels", () => {
    const out = read("m25-nesting-33", "expected");
    expect(out.match(/<div>/g)).toHaveLength(32);
  });
});

describe("sanitizer rules", () => {
  it("keeps tokens inside text and reports tokens inside attributes as PH_ATTR", () => {
    const result = sanitizeHtml(
      '<p title="x">Hi {{sender.name}}</p><a href="https://x.com/{{sender.name}}" title="{{ask:T}}">x</a>',
    );
    expect(result.html).toContain("<p>Hi {{sender.name}}</p>");
    expect(result.attrTokens).toEqual([
      { tag: "a", attr: "href" },
      { tag: "a", attr: "title" },
    ]);
    const error = thrown(() =>
      prepareBody('<a href="https://x.com/{{sender.name}}">x</a>'),
    );
    expect(error.code).toBe("VALIDATION");
    expect(error.details?.["problems"]).toEqual([
      {
        code: "PH_ATTR",
        message: "Placeholders work in text only (href of a)",
        offset: null,
      },
    ]);
  });

  it("restricts image hosts when IMG_HOSTS is set", () => {
    const html =
      '<img src="https://cdn.example.com/a.png"><img src="https://evil.example/b.png">';
    expect(sanitize(html, { imgHosts: ["cdn.example.com"] })).toBe(
      '<img src="https://cdn.example.com/a.png"><img>',
    );
    expect(sanitize('<img src="http://cdn.example.com/a.png">')).toBe("<img>");
  });

  it("validates numeric and enumerated attributes", () => {
    expect(
      sanitize(
        '<img src="https://a.com/x" width="2001" height="0"><ol start="x" type="z"><li>a</li></ol><p align="middle" dir="up">x</p>',
      ),
    ).toBe('<img src="https://a.com/x"><ol><li>a</li></ol><p>x</p>');
    expect(
      sanitize(
        '<td bgcolor="red;x" width="50px">a</td><col span="2" width="10"><font color="rgb(1, 2, 3)" face="<x>">t</font>',
      ),
    ).toBe(
      '<td>a</td><col span="2" width="10"><font color="rgb(1, 2, 3)">t</font>',
    );
  });

  it("ignores prototype names as attributes", () => {
    expect(
      sanitize('<a constructor="x" toString="y" __proto__="z">a</a>'),
    ).toBe('<a rel="noopener noreferrer" target="_blank">a</a>');
  });

  it("filters inline styles", () => {
    expect(
      filterStyle(
        "COLOR: Red ; position: fixed; display: flex; display: block",
      ),
    ).toBe("color: Red; display: block");
    expect(filterStyle("color: red /* x */")).toBe("");
    expect(
      filterStyle("behavior: url(x.htc); -moz-binding: x; float: left"),
    ).toBe("");
    expect(
      filterStyle(
        "border-top-color: red; margin-left: 2px; padding: 1px 2px; font-size:",
      ),
    ).toBe("border-top-color: red; margin-left: 2px; padding: 1px 2px");
    expect(filterStyle("color: red; @import x; noColon")).toBe("color: red");
  });

  it("escapes text and attribute values canonically", () => {
    expect(
      sanitize(
        '<a href="https://x.com/?a=1&amp;b=&quot;2&quot;" title="a<b>">1 &lt; 2 &amp; 3 > 2</a>',
      ),
    ).toBe(
      '<a href="https://x.com/?a=1&amp;b=&quot;2&quot;" rel="noopener noreferrer" target="_blank" title="a&lt;b&gt;">1 &lt; 2 &amp; 3 &gt; 2</a>',
    );
  });

  it("regroups implied closes until the output is stable", () => {
    const once = sanitize("<p><foo><div>x</div></foo></p>");
    expect(once).toBe("<p></p><div>x</div><p></p>");
    expect(sanitize(once)).toBe(once);
  });

  it("refuses bodies over 100 KB after sanitizing and input over 1 MB", () => {
    const big = `<p>${"a".repeat(100 * 1024)}</p>`;
    const error = thrown(() => sanitize(big));
    expect(error.code).toBe("VALIDATION");
    expect(error.message).toBe(
      `Body is ${String(100 * 1024 + 7)} bytes; the limit is 102400`,
    );
    const huge = `<script>${"a".repeat(1024 * 1024)}</script>`;
    expect(thrown(() => sanitize(huge)).message).toContain("Pasted HTML");
    expect(sanitize(`<script>${"a".repeat(200 * 1024)}</script>ok`)).toBe("ok");
  });
});

describe("prepareBody (save path)", () => {
  it("returns sanitized HTML, text, snippet, size, names and prompts", () => {
    const body = prepareBody(read("b12-prompt-reused", "input"));
    expect(body.prompts).toEqual(["Meeting date"]);
    expect(body.placeholders).toEqual([]);
    expect(body.plainText).toBe(
      "Meeting on {{ask:Meeting date}}. Confirm {{ask:meeting date}}? See you {{ask: Meeting Date }}.",
    );
    expect(body.snippet).toBe(body.plainText);
    expect(body.sizeBytes).toBe(body.html.length);
    const named = prepareBody(read("b09-placeholders-in-bold", "input"));
    expect(named.placeholders).toHaveLength(5);
    expect(named.warnings).toEqual([]);
  });

  it("rejects the split token fixture with PH_MALFORMED", () => {
    const error = thrown(() => prepareBody(read("b10-split-token", "input")));
    expect(error.message).toBe("1 placeholder problem");
    expect(error.details?.["problems"]).toEqual([
      expect.objectContaining({ code: "PH_MALFORMED", offset: 0 }),
    ]);
  });

  it("accepts the 100 KB fixture and the escape fixture", () => {
    expect(
      prepareBody(read("b13-body-100kb", "input")).sizeBytes,
    ).toBeGreaterThanOrEqual(99 * 1024);
    expect(prepareBody(read("b11-escape", "input")).placeholders).toEqual([]);
  });

  it("counts several problems in the message", () => {
    expect(thrown(() => prepareBody("{{a.b}} {{c.d}}")).message).toBe(
      "2 placeholder problems",
    );
  });
});
