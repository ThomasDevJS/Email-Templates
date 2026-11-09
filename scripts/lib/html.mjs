// Inlines the web bundle and styles into the HtmlService template (ADR-0005 Build, no runtime CDN).

export const SCRIPT_MARKER = "/* INLINE:script */";
export const STYLES_MARKER = "/* INLINE:styles */";

/**
 * HtmlService evaluates `<? ?>` scriptlets in the template, and `</script` would end the script tag early.
 * @param {string} script bundled browser JavaScript
 * @returns {string[]} problems; empty when the script is safe to inline
 */
export function scriptInlineProblems(script) {
  const problems = [];
  if (/<\/script/i.test(script)) problems.push("Web bundle contains </script.");
  if (script.includes("<?"))
    problems.push(
      "Web bundle contains <? which HtmlService treats as a scriptlet.",
    );
  return problems;
}

/**
 * @param {string} template src/web/index.html
 * @param {{ script: string, styles: string }} parts
 * @returns {string} the page with both markers replaced
 */
export function inlineHtml(template, parts) {
  for (const marker of [SCRIPT_MARKER, STYLES_MARKER]) {
    if (template.split(marker).length !== 2)
      throw new Error(`index.html must contain ${marker} exactly once.`);
  }
  const problems = scriptInlineProblems(parts.script);
  if (problems.length > 0) throw new Error(problems.join(" "));
  // Function replacers keep `$` sequences in the bundle literal.
  return template
    .replace(SCRIPT_MARKER, () => parts.script)
    .replace(STYLES_MARKER, () => parts.styles);
}

const SCRIPTLET = /<\?=\s*(\w+)\s*\?>/g;
/** @type {Readonly<Record<string, string>>} */
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/**
 * Local preview only (dev harness, Lighthouse): fills `<?= name ?>` scriptlets the way HtmlService would,
 * escaped, and adds the viewport tag that `doGet` sets with `addMetaTag`.
 * @param {string} html built index.html
 * @param {Record<string, string>} values scriptlet values
 * @returns {string} a page a plain HTTP server can serve
 */
export function localPage(html, values) {
  const filled = html.replace(SCRIPTLET, (_match, name) =>
    String(values[name] ?? "").replace(
      /[&<>"]/g,
      (char) => ESCAPES[char] ?? char,
    ),
  );
  return filled.replace(
    '<meta charset="utf-8" />',
    '<meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />',
  );
}
