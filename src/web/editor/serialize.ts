import type { Mark, Node as PMNode } from "prosemirror-model";
import { escapeAttr, escapeText } from "../../shared/html/escape";
import {
  TABLE_ATTRS,
  imageAttrs,
  linkAttrs,
  tokenOf,
  type PlaceholderAttrs,
} from "./schema";

/**
 * Document to stored HTML, in the sanitizer's canonical form: attributes sorted and double-quoted, text escaped.
 * Placeholders write their token text. A literal `{{` in text becomes `\{{`, so it never turns into a token.
 * Written by hand, not with DOMSerializer, because `element.style` would rewrite colors to `rgb()`.
 */
type Attrs = Readonly<Record<string, string>>;

function openTag(tag: string, attrs: Attrs = {}): string {
  const list = Object.keys(attrs)
    .sort()
    .map((name) => ` ${name}="${escapeAttr(attrs[name] ?? "")}"`)
    .join("");
  return `<${tag}${list}>`;
}

const STYLE_MARKS: Readonly<Record<string, [string, string]>> = {
  color: ["color", "color"],
  background: ["background-color", "color"],
  font_size: ["font-size", "size"],
  font_family: ["font-family", "family"],
};

const SIMPLE_MARKS: Readonly<Record<string, string>> = {
  strong: "strong",
  em: "em",
  underline: "u",
  strike: "s",
};

function markTag(mark: Mark): [string, Attrs] {
  const name = mark.type.name;
  const simple = SIMPLE_MARKS[name];
  if (simple !== undefined) return [simple, {}];
  if (name === "link") return ["a", linkAttrs(mark.attrs)];
  const [property, attr] = STYLE_MARKS[name] ?? ["", ""];
  return ["span", { style: `${property}: ${String(mark.attrs[attr])}` }];
}

export function escapeBraces(text: string): string {
  return text.replace(/\{\{/g, "\\{{");
}

function inlineNode(node: PMNode): string {
  switch (node.type.name) {
    case "text":
      return escapeText(escapeBraces(node.text ?? ""));
    case "placeholder":
      return escapeText(tokenOf(node.attrs as PlaceholderAttrs));
    case "image":
      return openTag("img", imageAttrs(node.attrs));
    default:
      return "<br>";
  }
}

/** Inline content with marks opened and closed around runs, outermost mark first. */
function inlineContent(parent: PMNode): string {
  let out = "";
  let active: readonly Mark[] = [];
  const closeFrom = (keep: number) => {
    for (let i = active.length - 1; i >= keep; i -= 1) {
      const mark = active[i];
      if (mark !== undefined) out += `</${markTag(mark)[0]}>`;
    }
  };
  parent.forEach((child) => {
    let keep = 0;
    while (
      keep < active.length &&
      keep < child.marks.length &&
      active[keep]?.eq(child.marks[keep] as Mark) === true
    )
      keep += 1;
    closeFrom(keep);
    for (const mark of child.marks.slice(keep))
      out += openTag(...markTag(mark));
    active = child.marks;
    out += inlineNode(child);
  });
  closeFrom(0);
  return out;
}

function alignAttrs(node: PMNode): Attrs {
  const align: unknown = node.attrs["align"];
  return typeof align === "string" ? { style: `text-align: ${align}` } : {};
}

function blocks(parent: PMNode): string {
  let out = "";
  parent.forEach((child) => {
    out += block(child);
  });
  return out;
}

/** A list item's first paragraph is written without `<p>` (tight lists, no extra margins in mail clients). */
function listItem(node: PMNode): string {
  let out = "<li>";
  node.forEach((child, _offset, index) => {
    const plain =
      index === 0 &&
      child.type.name === "paragraph" &&
      child.attrs["align"] === null;
    out += plain ? inlineContent(child) : block(child);
  });
  return `${out}</li>`;
}

function block(node: PMNode): string {
  switch (node.type.name) {
    case "paragraph":
      return `${openTag("p", alignAttrs(node))}${inlineContent(node)}</p>`;
    case "heading": {
      const tag = `h${String(node.attrs["level"])}`;
      return `${openTag(tag, alignAttrs(node))}${inlineContent(node)}</${tag}>`;
    }
    case "blockquote":
      return `<blockquote>${blocks(node)}</blockquote>`;
    case "horizontal_rule":
      return "<hr>";
    case "bullet_list":
      return `<ul>${blocks(node)}</ul>`;
    case "ordered_list": {
      const order = Number(node.attrs["order"]);
      return `${openTag("ol", order === 1 ? {} : { start: String(order) })}${blocks(node)}</ol>`;
    }
    case "list_item":
      return listItem(node);
    case "table":
      return `${openTag("table", TABLE_ATTRS)}<tbody>${blocks(node)}</tbody></table>`;
    case "table_row":
      return `<tr>${blocks(node)}</tr>`;
    default: {
      const tag = node.attrs["header"] === true ? "th" : "td";
      return `<${tag}>${inlineContent(node)}</${tag}>`;
    }
  }
}

export function serializeDoc(doc: PMNode): string {
  return blocks(doc);
}
