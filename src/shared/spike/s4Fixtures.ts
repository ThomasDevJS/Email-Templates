import { renderBody } from "../placeholders/render";

/**
 * TEMPORARY (slice 4, spike S4, ADR-0004 "Slice 4 spike plan"). Fixtures F1 to F9 for the draft insert test on
 * Gmail web, Android and iOS. Remove with `spike.s4` and the sidebar harness once the owner has recorded the
 * results in docs/spikes/slice-04-insert.md and ADR-0004 has the final allowlist and size cap.
 * Bodies are static and built here, not read from storage, so they bypass the sanitizer and the 100 KB cap on
 * purpose (F7 is 200 KB).
 */
export const S4_FIXTURES = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
] as const;
export type S4Fixture = (typeof S4_FIXTURES)[number];

export function isS4Fixture(value: string): value is S4Fixture {
  return (S4_FIXTURES as readonly string[]).includes(value);
}

/** One-line description per fixture for the harness card (ADR-0004 table). */
export const S4_LABELS: Readonly<Record<S4Fixture, string>> = {
  F1: "3 paragraphs, bold, italic, underline, link",
  F2: "Colors, font sizes, font families inline",
  F3: "Bullet and ordered lists, blockquote",
  F4: "3x3 table, borders, cell padding, widths",
  F5: "https image 600 px wide",
  F6: "50 KB body",
  F7: "200 KB body",
  F8: "All 5 placeholders and 2 prompts filled",
  F9: "Short text: put the cursor mid-line or select text first",
};

const F1 = [
  "<p>F1 paragraph one with <strong>bold</strong>, <em>italic</em> and <u>underline</u> text.</p>",
  '<p>F1 paragraph two with a <a href="https://www.google.com/" rel="noopener noreferrer" target="_blank">link to google.com</a>.</p>',
  "<p>F1 paragraph three, plain.</p>",
].join("");

const F2 = [
  '<p><span style="color: #c5221f">red text</span>, <span style="background-color: #fce8b2">yellow background</span>, <span style="color: rgb(26, 115, 232)">rgb blue</span></p>',
  '<p><span style="font-size: 10px">10px</span> <span style="font-size: 16px">16px</span> <span style="font-size: 24px">24px</span> <span style="font-size: large">large</span></p>',
  '<p><span style="font-family: Arial, sans-serif">Arial</span> <span style="font-family: Georgia, serif">Georgia</span> <span style="font-family: &quot;Courier New&quot;, monospace">Courier New</span> <span style="font-family: Verdana, sans-serif">Verdana</span></p>',
  '<p><font color="#188038" face="Georgia" size="4">font tag green Georgia size 4</font></p>',
  '<p><span style="font-weight: bold; font-style: italic; text-decoration: line-through">bold italic strike via style</span> <span style="line-height: 2">line-height 2</span></p>',
  '<p style="text-align: center">centered paragraph</p>',
  '<p style="margin-left: 40px; padding: 4px; border: 1px solid #999999">indent 40px, padding, border</p>',
].join("");

const F3 = [
  "<ul><li>bullet one</li><li>bullet two<ul><li>nested bullet</li></ul></li><li>bullet three</li></ul>",
  '<ol><li>first</li><li>second</li><li>third</li></ol><ol start="5" type="a"><li>start 5, type a</li></ol>',
  "<blockquote>A quoted paragraph inside blockquote.</blockquote>",
].join("");

const cell = (row: number, col: number): string =>
  `<td style="border: 1px solid #999999; padding: 6px; width: 120px">R${String(row)}C${String(col)}</td>`;

const F4 = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 360px"><tbody>${[
  1, 2, 3,
]
  .map((row) => `<tr>${[1, 2, 3].map((col) => cell(row, col)).join("")}</tr>`)
  .join("")}</tbody></table>`;

const F5 =
  '<p>F5 image below, width 600:</p><p><img alt="Google logo" height="203" src="https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png" width="600"></p>';

const FILLER =
  "<p>Filler paragraph with <strong>bold</strong> and <em>italic</em> words to reach the target size of this fixture body.</p>";

/** Repeats the filler paragraph until the body reaches `bytes` (ASCII, so length equals bytes). */
function sized(label: string, bytes: number): string {
  const head = `<p>${label} start</p>`;
  const tail = `<p>${label} end</p>`;
  const count = Math.ceil((bytes - head.length - tail.length) / FILLER.length);
  return head + FILLER.repeat(Math.max(0, count)) + tail;
}

const F8_BODY = [
  "<p>Name: {{sender.name|no name}}</p>",
  "<p>Title: {{sender.title|no title}}</p>",
  "<p>Phone: {{sender.phone|no phone}}</p>",
  "<p>Department: {{sender.department|no department}}</p>",
  "<p>Hi {{recipient.first_name|there}},</p>",
  "<p>Topic: <strong>{{ask:Topic}}</strong></p>",
  "<p>Notes: {{ask:Notes}}</p>",
].join("");

/** Prompt answers with characters that must arrive escaped, and a newline that must become `<br>`. */
export const F8_ANSWERS: Readonly<Record<string, string>> = {
  topic: 'Q3 <review> & "plan"',
  notes: "Line one\nLine two",
};

/** Fixture HTML. `values` fills F8 like a real apply (sender and recipient values by placeholder name). */
export function s4Fixture(
  id: S4Fixture,
  values: Readonly<Record<string, string>>,
): string {
  switch (id) {
    case "F1":
      return F1;
    case "F2":
      return F2;
    case "F3":
      return F3;
    case "F4":
      return F4;
    case "F5":
      return F5;
    case "F6":
      return sized("F6 50 KB", 50 * 1024);
    case "F7":
      return sized("F7 200 KB", 200 * 1024);
    case "F8":
      return renderBody(F8_BODY, { values, answers: F8_ANSWERS }).html;
    case "F9":
      return "<p>F9 inserted here.</p>";
  }
}
