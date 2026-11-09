/** Allowlists of ADR-0004 "HTML sanitizer". Anything not listed here is removed. */

export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  "p",
  "br",
  "div",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "sub",
  "sup",
  "font",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "colgroup",
  "col",
  "img",
]);

/** Removed together with their content. Every other unlisted tag is unwrapped (children kept). */
export const DROPPED_TAGS: ReadonlySet<string> = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "template",
  "noscript",
  "svg",
  "math",
  "head",
  "title",
  "textarea",
  "select",
  "option",
  "button",
  "input",
  "form",
  "meta",
  "link",
  "base",
]);

/** Elements written without a closing tag. */
export const VOID_TAGS: ReadonlySet<string> = new Set([
  "br",
  "hr",
  "img",
  "col",
]);

export const MAX_DEPTH = 32;

/** Raw input above this size is refused before parsing, to bound the work per request. */
export const MAX_INPUT_BYTES = 1024 * 1024;

export const HREF_SCHEMES = ["https:", "http:", "mailto:", "tel:"] as const;
export const SRC_SCHEMES = ["https:"] as const;

export const STYLE_PROPERTIES: ReadonlySet<string> = new Set([
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "line-height",
  "vertical-align",
  "width",
  "height",
  "max-width",
  "display",
  "border-collapse",
]);

/** `margin`, `padding` and the `border` family with their sides. */
export const STYLE_PROPERTY_PATTERNS: readonly RegExp[] = [
  /^margin(?:-(?:top|right|bottom|left))?$/,
  /^padding(?:-(?:top|right|bottom|left))?$/,
  /^border(?:-(?:top|right|bottom|left))?(?:-(?:width|style|color))?$/,
  /^border-(?:width|style|color|radius)$/,
];

export const DISPLAY_VALUES: ReadonlySet<string> = new Set([
  "block",
  "inline",
  "inline-block",
  "table",
  "table-cell",
]);

/** A declaration whose value (whitespace removed, lower case) contains one of these is dropped. */
export const FORBIDDEN_STYLE_VALUE =
  /url\(|expression\(|@import|javascript:|\\|<|>|\/\*|\*\//;
