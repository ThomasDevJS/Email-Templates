import { filterStyle } from "./css";
import { HREF_SCHEMES, SRC_SCHEMES } from "./policy";

/** Attribute allowlist per tag (ADR-0004). A rule returns the canonical value, or null to drop the attribute. */
export type AttrRule = (value: string, options: AttrOptions) => string | null;

export interface AttrOptions {
  /** Allowed image hosts (Script Property `IMG_HOSTS`); empty allows any `https` host. */
  readonly imgHosts: readonly string[];
}

const oneOf =
  (...allowed: string[]): AttrRule =>
  (value) => {
    const lower = value.trim().toLowerCase();
    return allowed.includes(lower) ? lower : null;
  };

const intRange =
  (min: number, max: number): AttrRule =>
  (value) => {
    const trimmed = value.trim();
    if (!/^\d{1,5}$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return n >= min && n <= max ? String(n) : null;
  };

const lengthValue: AttrRule = (value) => {
  const trimmed = value.trim();
  return /^\d{1,4}%?$/.test(trimmed) ? trimmed : null;
};

const COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]{5,40}\))$/i;
const color: AttrRule = (value) => {
  const trimmed = value.trim();
  return COLOR.test(trimmed) ? trimmed : null;
};

const fontFace: AttrRule = (value) => {
  const trimmed = value.trim();
  return /^[\w ,'"-]{1,100}$/.test(trimmed) ? trimmed : null;
};

const text: AttrRule = (value) => value;

/** Control characters (tab, newline and the C0 and C1 ranges) are removed before the scheme check. */
function cleanUrl(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
}

function hasScheme(url: string, schemes: readonly string[]): boolean {
  const lower = url.toLowerCase();
  return schemes.some((scheme) => lower.startsWith(scheme));
}

const href: AttrRule = (value) => {
  const url = cleanUrl(value);
  return hasScheme(url, HREF_SCHEMES) ? url : null;
};

function hostOf(url: string): string {
  return (/^https:\/\/([^/?#:@]+)/i.exec(url)?.[1] ?? "").toLowerCase();
}

const src: AttrRule = (value, options) => {
  const url = cleanUrl(value);
  if (!hasScheme(url, SRC_SCHEMES)) return null;
  if (options.imgHosts.length === 0) return url;
  return options.imgHosts.includes(hostOf(url)) ? url : null;
};

const style: AttrRule = (value) => {
  const filtered = filterStyle(value);
  return filtered === "" ? null : filtered;
};

const ALIGN = oneOf("left", "center", "right", "justify");
const ALIGNED = ["p", "div", "h1", "h2", "h3", "h4", "td", "th"];

const GLOBAL_RULES: Readonly<Record<string, AttrRule>> = {
  style,
  dir: oneOf("ltr", "rtl"),
};

const TAG_RULES: Readonly<Record<string, Readonly<Record<string, AttrRule>>>> =
  {
    a: { href, title: text },
    img: {
      src,
      alt: text,
      width: intRange(1, 2000),
      height: intRange(1, 2000),
    },
    font: { color, face: fontFace, size: intRange(1, 7) },
    table: {
      border: intRange(0, 100),
      cellpadding: intRange(0, 100),
      cellspacing: intRange(0, 100),
      width: lengthValue,
      align: ALIGN,
    },
    td: {
      colspan: intRange(1, 100),
      rowspan: intRange(1, 100),
      width: lengthValue,
      valign: oneOf("top", "middle", "bottom", "baseline"),
      bgcolor: color,
    },
    col: { span: intRange(1, 100), width: lengthValue },
    colgroup: { span: intRange(1, 100), width: lengthValue },
    ol: {
      start: intRange(0, 100000),
      type: (value) => (/^[1aAiI]$/.test(value.trim()) ? value.trim() : null),
    },
  };

/** Own-property lookup, so names like `constructor` or `__proto__` never reach Object.prototype. */
function own<T>(
  table: Readonly<Record<string, T>>,
  key: string,
): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? table[key]
    : undefined;
}

/** Rule for one attribute of one tag, or undefined when the attribute is not allowed there. */
export function ruleFor(tag: string, attr: string): AttrRule | undefined {
  if (attr === "align" && ALIGNED.includes(tag)) return ALIGN;
  const rules = own(TAG_RULES, tag === "th" ? "td" : tag) ?? {};
  return own(rules, attr) ?? own(GLOBAL_RULES, attr);
}

/** Forced on every link (ADR-0004). */
export const LINK_FORCED: Readonly<Record<string, string>> = {
  target: "_blank",
  rel: "noopener noreferrer",
};
