import {
  Schema,
  type DOMOutputSpec,
  type MarkSpec,
  type NodeSpec,
  type TagParseRule,
} from "prosemirror-model";
import {
  marks as basicMarks,
  nodes as basicNodes,
} from "prosemirror-schema-basic";
import { bulletList, listItem, orderedList } from "prosemirror-schema-list";
import { placeholderInfo } from "../../shared/placeholders/registry";
import {
  collapse,
  choiceToken,
  dateToken,
  parseText,
  promptToken,
  requiredLabel,
  variableToken,
  type PromptType,
} from "../../shared/placeholders/grammar";

/**
 * Editor schema, a subset of the sanitizer allowlist (ADR-0004 "Token atomicity"). Style values are read from
 * the `style` attribute text, never from `element.style`, so colors keep their spelling (`#d93025`, not `rgb()`).
 */

export const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export const FONT_SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "" },
  { label: "Large", value: "18px" },
  { label: "Huge", value: "24px" },
] as const;
export const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
] as const;
export const COLORS = [
  { label: "Black", value: "#202124" },
  { label: "Gray", value: "#5f6368" },
  { label: "Red", value: "#c5221f" },
  { label: "Orange", value: "#b06000" },
  { label: "Green", value: "#137333" },
  { label: "Blue", value: "#1a73e8" },
  { label: "Purple", value: "#8430ce" },
] as const;
export const HIGHLIGHTS = [
  { label: "Yellow", value: "#fef7c6" },
  { label: "Green", value: "#e6f4ea" },
  { label: "Blue", value: "#e8f0fe" },
  { label: "Pink", value: "#fce8e6" },
] as const;

/** One property from the element's `style` attribute text, or "" when absent. */
export function styleProperty(dom: HTMLElement, name: string): string {
  const style = dom.getAttribute("style") ?? "";
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon > 0 && part.slice(0, colon).trim().toLowerCase() === name)
      return part.slice(colon + 1).trim();
  }
  return "";
}

function alignOf(dom: HTMLElement): string | null {
  const value = (
    styleProperty(dom, "text-align") ||
    dom.getAttribute("align") ||
    ""
  ).toLowerCase();
  return (ALIGNMENTS as readonly string[]).includes(value) ? value : null;
}

const alignAttrs = (align: unknown): Record<string, string> =>
  typeof align === "string" ? { style: `text-align: ${align}` } : {};

const paragraph: NodeSpec = {
  content: "inline*",
  group: "block",
  attrs: { align: { default: null } },
  parseDOM: [
    { tag: "p", getAttrs: (dom) => ({ align: alignOf(dom) }) },
    { tag: "div", getAttrs: (dom) => ({ align: alignOf(dom) }) },
  ],
  toDOM: (node) => ["p", alignAttrs(node.attrs["align"]), 0],
};

const heading: NodeSpec = {
  content: "inline*",
  group: "block",
  defining: true,
  attrs: { level: { default: 1 }, align: { default: null } },
  parseDOM: [1, 2, 3].map((level) => ({
    tag: `h${String(level)}`,
    getAttrs: (dom: HTMLElement) => ({ level, align: alignOf(dom) }),
  })),
  toDOM: (node) => [
    `h${String(node.attrs["level"])}`,
    alignAttrs(node.attrs["align"]),
    0,
  ],
};

const image: NodeSpec = {
  inline: true,
  group: "inline",
  draggable: true,
  attrs: { src: {}, alt: { default: "" }, width: { default: null } },
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs: (dom) => {
        const src = (dom.getAttribute("src") ?? "").trim();
        if (!/^https:/i.test(src)) return false;
        return {
          src,
          alt: dom.getAttribute("alt") ?? "",
          width: dom.getAttribute("width"),
        };
      },
    },
  ],
  toDOM: (node) => ["img", imageAttrs(node.attrs)],
};

export function imageAttrs(
  attrs: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const out: Record<string, string> = { src: String(attrs["src"]) };
  if (typeof attrs["alt"] === "string" && attrs["alt"] !== "")
    out["alt"] = attrs["alt"];
  if (typeof attrs["width"] === "string" && attrs["width"] !== "")
    out["width"] = attrs["width"];
  return out;
}

export const TABLE_ATTRS: Readonly<Record<string, string>> = {
  border: "1",
  cellpadding: "6",
  cellspacing: "0",
  style: "border-collapse: collapse",
};

const table: NodeSpec = {
  content: "table_row+",
  group: "block",
  isolating: true,
  parseDOM: [{ tag: "table" }],
  toDOM: () => ["table", { ...TABLE_ATTRS }, ["tbody", 0]],
};

const tableRow: NodeSpec = {
  content: "table_cell+",
  parseDOM: [{ tag: "tr" }],
  toDOM: () => ["tr", 0],
};

const tableCell: NodeSpec = {
  content: "inline*",
  attrs: { header: { default: false } },
  isolating: true,
  parseDOM: [
    { tag: "td", attrs: { header: false } },
    { tag: "th", attrs: { header: true } },
  ],
  toDOM: (node) => [node.attrs["header"] === true ? "th" : "td", 0],
};

/** Attributes of the placeholder atom. `name` is empty for an `ask:` or `date:` prompt. */
export interface PlaceholderAttrs {
  readonly name: string;
  readonly label: string;
  readonly fallback: string | null;
  /** A prompt's type (spec 5.9); absent means text. */
  readonly type?: PromptType;
  /** A choice's options (spec 5.10); absent for other kinds. */
  readonly options?: readonly string[];
}

/** Attributes of the single token in `token`, or null when `token` is not exactly one token. */
export function placeholderAttrs(token: string): PlaceholderAttrs | null {
  const segments = parseText(token);
  const [only] = segments;
  if (segments.length !== 1 || only === undefined) return null;
  if (only.kind === "variable")
    return { name: only.name, label: "", fallback: only.fallback };
  if (only.kind === "prompt")
    return {
      name: "",
      label: collapse(only.label),
      fallback: null,
      type: only.type,
      ...(only.type === "choice" ? { options: only.options } : {}),
    };
  return null;
}

export function tokenOf(attrs: PlaceholderAttrs): string {
  if (attrs.name !== "") return variableToken(attrs.name, attrs.fallback);
  if (attrs.type === "choice")
    return choiceToken(attrs.label, attrs.options ?? []);
  return attrs.type === "date"
    ? dateToken(attrs.label)
    : promptToken(attrs.label);
}

/**
 * A placeholder drawn as a blank (design system "Placeholder"): its class, its label, then muted text and what
 * follows it: " or " and the fallback, " (date)" for a date field (spec 5.9), " (choice)" for a choice (spec 5.10).
 */
export interface BlankParts {
  /** "ph", "ph ask", "ph ask date", "ph ask choice"; a required prompt adds " required" (spec 5.11). */
  readonly className: string;
  readonly label: string;
  readonly fallback: string | null;
  readonly muted: string | null;
}

export function blankParts(attrs: PlaceholderAttrs): BlankParts {
  const required = requiredLabel(attrs.label) ? " required" : "";
  if (attrs.name === "" && (attrs.type === "date" || attrs.type === "choice"))
    return {
      className: `ph ask ${attrs.type}${required}`,
      label: attrs.label,
      fallback: null,
      muted: ` (${attrs.type})`,
    };
  if (attrs.name === "")
    return {
      className: `ph ask${required}`,
      label: attrs.label,
      fallback: null,
      muted: null,
    };
  return {
    className: "ph",
    label: placeholderInfo(attrs.name)?.label ?? attrs.name,
    fallback: attrs.fallback,
    muted: attrs.fallback === null ? null : " or ",
  };
}

/**
 * Accessible name: "Field: Load number, the sender fills it in", "Field: Pickup date, a date the sender picks",
 * "Field: Status, the sender chooses from 3 options", "Field: Recipient first name, default text there".
 */
export function chipLabel(attrs: PlaceholderAttrs): string {
  const { label, fallback } = blankParts(attrs);
  const must = requiredLabel(attrs.label) ? ", required" : "";
  if (attrs.name === "" && attrs.type === "choice")
    return `Field: ${label}, the sender chooses from ${String(attrs.options?.length ?? 0)} options${must}`;
  if (attrs.name === "" && attrs.type === "date")
    return `Field: ${label}, a date the sender picks${must}`;
  if (attrs.name === "")
    return `Field: ${label}, the sender fills it in${must}`;
  return fallback === null
    ? `Field: ${label}`
    : `Field: ${label}, default text ${fallback}`;
}

const placeholder: NodeSpec = {
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: true,
  attrs: {
    name: { default: "" },
    label: { default: "" },
    fallback: { default: null },
    type: { default: "text" },
    options: { default: [] },
  },
  parseDOM: [
    {
      tag: "span[data-ph]",
      getAttrs: (dom) =>
        placeholderAttrs(dom.getAttribute("data-ph") ?? "") ?? false,
    },
  ],
  toDOM: (node): DOMOutputSpec => {
    const attrs = node.attrs as PlaceholderAttrs;
    const { className, label, fallback, muted } = blankParts(attrs);
    return [
      "span",
      {
        class: className,
        "data-ph": tokenOf(attrs),
        contenteditable: "false",
        role: "img",
        "aria-label": chipLabel(attrs),
      },
      label,
      ...(muted === null ? [] : [["span", { class: "ph-or" }, muted]]),
      ...(fallback === null ? [] : [fallback]),
    ] as DOMOutputSpec;
  },
};

function styleMark(
  property: string,
  attr: string,
  fontAttr?: string,
): MarkSpec {
  const rules: TagParseRule[] = [
    {
      tag: "span[style]",
      consuming: false,
      getAttrs: (dom) => {
        const value = styleProperty(dom, property);
        return value === "" ? false : { [attr]: value };
      },
    },
  ];
  if (fontAttr !== undefined)
    rules.push({
      tag: `font[${fontAttr}]`,
      consuming: false,
      getAttrs: (dom: HTMLElement) => ({
        [attr]: dom.getAttribute(fontAttr) ?? "",
      }),
    });
  return {
    attrs: { [attr]: {} },
    parseDOM: rules,
    toDOM: (mark) => [
      "span",
      { style: `${property}: ${String(mark.attrs[attr])}` },
      0,
    ],
  };
}

/** Link schemes the sanitizer keeps; pasted links with other schemes lose the link mark. */
export function safeHref(href: string): boolean {
  return /^(?:https?:|mailto:|tel:)/i.test(href.trim());
}

const link: MarkSpec = {
  attrs: { href: {}, title: { default: "" } },
  inclusive: false,
  parseDOM: [
    {
      tag: "a[href]",
      getAttrs: (dom) => {
        const href = dom.getAttribute("href") ?? "";
        return safeHref(href)
          ? { href: href.trim(), title: dom.getAttribute("title") ?? "" }
          : false;
      },
    },
  ],
  toDOM: (mark) => ["a", linkAttrs(mark.attrs), 0],
};

export function linkAttrs(
  attrs: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const out: Record<string, string> = {
    href: String(attrs["href"]),
    rel: "noopener noreferrer",
    target: "_blank",
  };
  if (typeof attrs["title"] === "string" && attrs["title"] !== "")
    out["title"] = attrs["title"];
  return out;
}

export const schema = new Schema({
  nodes: {
    doc: basicNodes.doc,
    paragraph,
    heading,
    blockquote: basicNodes.blockquote,
    horizontal_rule: basicNodes.horizontal_rule,
    bullet_list: { ...bulletList, content: "list_item+", group: "block" },
    ordered_list: { ...orderedList, content: "list_item+", group: "block" },
    list_item: { ...listItem, content: "paragraph block*" },
    table,
    table_row: tableRow,
    table_cell: tableCell,
    text: basicNodes.text,
    placeholder,
    image,
    hard_break: basicNodes.hard_break,
  },
  marks: {
    link,
    strong: basicMarks.strong,
    em: basicMarks.em,
    underline: { parseDOM: [{ tag: "u" }], toDOM: () => ["u", 0] },
    strike: {
      parseDOM: [{ tag: "s" }, { tag: "strike" }, { tag: "del" }],
      toDOM: () => ["s", 0],
    },
    color: styleMark("color", "color", "color"),
    background: styleMark("background-color", "color"),
    font_size: styleMark("font-size", "size"),
    font_family: styleMark("font-family", "family", "face"),
  },
});
