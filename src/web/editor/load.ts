import {
  DOMParser as PMDOMParser,
  type Node as PMNode,
} from "prosemirror-model";
import { parseText, type Segment } from "../../shared/placeholders/grammar";
import { placeholderAttrs, schema, tokenOf } from "./schema";

/**
 * Stored HTML to an editor document (ADR-0004 "Load"). The HTML is parsed into an inert document (no image
 * loads, no scripts), every token in a text node becomes a `span[data-ph]` that the schema reads as a
 * placeholder atom, and `\{{` becomes literal `{{` text.
 */

function segmentNode(doc: Document, segment: Segment): Node {
  if (segment.kind === "text") return doc.createTextNode(segment.text);
  if (segment.kind === "escape") return doc.createTextNode("{{");
  const attrs = placeholderAttrs(segment.raw);
  if (attrs === null) return doc.createTextNode(segment.raw);
  const span = doc.createElement("span");
  span.setAttribute("data-ph", tokenOf(attrs));
  return span;
}

function tokenizeText(doc: Document, node: Text): void {
  const segments = parseText(node.data);
  if (segments.every((segment) => segment.kind === "text")) return;
  const fragment = doc.createDocumentFragment();
  for (const segment of segments) fragment.append(segmentNode(doc, segment));
  node.replaceWith(fragment);
}

function textNodes(doc: Document, root: Node): Text[] {
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const found: Text[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
    found.push(node as Text);
  return found;
}

/** Parsed and tokenized `<body>` of `html`, in an inert document. */
export function tokenizedBody(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    "text/html",
  );
  for (const node of textNodes(doc, doc.body)) tokenizeText(doc, node);
  return doc.body;
}

export function parseHtml(html: string): PMNode {
  return PMDOMParser.fromSchema(schema).parse(tokenizedBody(html));
}
