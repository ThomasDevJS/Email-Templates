/**
 * 20 template bodies in the editor's canonical form (ADR-0004 slice 3 round-trip fixture): for each,
 * `serialize(parse(html))` equals `sanitize(html)` and the token count is unchanged.
 */
export const EDITOR_BODIES: readonly (readonly [string, string])[] = [
  ["plain paragraph", "<p>Hello team,</p>"],
  ["two paragraphs", "<p>First line.</p><p>Second line.</p>"],
  ["empty paragraph between", "<p>Top</p><p></p><p>Bottom</p>"],
  [
    "bold italic underline strike",
    "<p><strong>bold</strong> <em>italic</em> <u>under</u> <s>gone</s></p>",
  ],
  [
    "nested marks",
    "<p><strong><em>both</em></strong> and <strong>one</strong></p>",
  ],
  [
    "link with title",
    '<p>See <a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer" target="_blank" title="Docs">the docs</a>.</p>',
  ],
  [
    "mailto and tel links",
    '<p><a href="mailto:sales@example.com" rel="noopener noreferrer" target="_blank">Mail</a> or <a href="tel:+15550100" rel="noopener noreferrer" target="_blank">call</a></p>',
  ],
  [
    "text color and background",
    '<p><span style="color: #c5221f">red</span> <span style="background-color: #fef7c6">marked</span></p>',
  ],
  [
    "font size and family",
    '<p><span style="font-size: 18px">large</span> <span style="font-family: Georgia, serif">serif</span></p>',
  ],
  [
    "headings and alignment",
    '<h1>Title</h1><h2 style="text-align: center">Centered</h2><h3>Third</h3><p style="text-align: right">Right</p>',
  ],
  [
    "lists nested",
    '<ul><li>One<ul><li>One A</li></ul></li><li>Two</li></ul><ol><li>First</li></ol><ol start="3"><li>Third</li></ol>',
  ],
  [
    "blockquote and rule",
    "<blockquote><p>Quoted words</p></blockquote><hr><p>After</p>",
  ],
  [
    "image with width",
    '<p><img alt="Logo" src="https://cdn.example.com/logo.png" width="200"></p>',
  ],
  [
    "simple table",
    '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse"><tbody><tr><th>Item</th><th>Price</th></tr><tr><td>Plan</td><td>10</td></tr></tbody></table>',
  ],
  ["hard breaks", "<p>Ana Lopez<br>Sales<br>+1 555 0100</p>"],
  [
    "every placeholder",
    "<p>{{sender.name}} {{sender.title}} {{sender.phone}} {{sender.department}} {{recipient.first_name}}</p>",
  ],
  [
    "fallback and prompts",
    "<p>Hi {{recipient.first_name|there}}, about {{ask:Product name}} on {{ask:Meeting date}}.</p>",
  ],
  [
    "placeholders inside marks",
    '<p><strong>{{sender.name}}</strong><br><em><span style="color: #1a73e8">{{sender.title}}</span></em></p>',
  ],
  [
    "escaped braces",
    "<p>Type \\{{sender.name}} literally, or \\{{ and \\{{{.</p>",
  ],
  [
    "special characters",
    "<p>Fish &amp; chips &lt;3 &gt; \"quotes\" 'single' é 日本 😀</p>",
  ],
];
