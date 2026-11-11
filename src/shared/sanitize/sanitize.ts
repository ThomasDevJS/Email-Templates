import { Parser } from "htmlparser2";
import { AppError, ErrorCode } from "../errors/codes";
import { escapeAttr, escapeText } from "../html/escape";
import { BODY_MAX_BYTES } from "../model/validate";
import type { AttrToken } from "../placeholders/validate";
import { utf8Length } from "../text";
import { LINK_FORCED, ruleFor, type AttrOptions } from "./attrs";
import {
  ALLOWED_TAGS,
  DROPPED_TAGS,
  MAX_DEPTH,
  MAX_INPUT_BYTES,
  VOID_TAGS,
} from "./policy";

/**
 * Server-side allowlist sanitizer (ADR-0004 option 1) on the htmlparser2 tokenizer. It builds a tree of allowed
 * elements, then writes canonical HTML: attributes sorted by name, double-quoted and escaped; text escaped.
 * Output is idempotent: the pass repeats until its output stops changing, because removing a tag can let the
 * parser's implied-close rules regroup the remaining ones.
 */
export interface SanitizeOptions {
  readonly imgHosts?: readonly string[];
}

export interface SanitizeResult {
  readonly html: string;
  /** Kept attributes whose value contains `{{` (PH_ATTR). */
  readonly attrTokens: AttrToken[];
}

interface ElementNode {
  readonly name: string;
  readonly attrs: readonly (readonly [string, string])[];
  readonly children: TreeNode[];
}

type TreeNode = ElementNode | string;

type Frame =
  | { readonly kind: "keep"; readonly node: ElementNode }
  | { readonly kind: "unwrap" | "drop" };

const MAX_PASSES = 4;

function filterAttrs(
  name: string,
  raw: Readonly<Record<string, string>>,
  options: AttrOptions,
  tokens: AttrToken[],
): [string, string][] {
  const kept: [string, string][] = [];
  for (const [attr, value] of Object.entries(raw)) {
    const canonical = ruleFor(name, attr)?.(value, options) ?? null;
    if (canonical === null) continue;
    if (canonical.includes("{{")) tokens.push({ tag: name, attr });
    kept.push([attr, canonical]);
  }
  if (name === "a") kept.push(...Object.entries(LINK_FORCED));
  return kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

class TreeBuilder {
  readonly root: TreeNode[] = [];
  readonly attrTokens: AttrToken[] = [];
  private readonly stack: Frame[] = [];
  private depth = 0;

  constructor(private readonly options: AttrOptions) {}

  private dropping(): boolean {
    return this.stack.some((frame) => frame.kind === "drop");
  }

  private container(): TreeNode[] {
    for (let i = this.stack.length - 1; i >= 0; i -= 1) {
      const frame = this.stack[i];
      if (frame?.kind === "keep") return frame.node.children;
    }
    return this.root;
  }

  open(name: string, attribs: Readonly<Record<string, string>>): void {
    if (this.dropping() || DROPPED_TAGS.has(name)) {
      this.stack.push({ kind: "drop" });
      return;
    }
    if (!ALLOWED_TAGS.has(name) || this.depth >= MAX_DEPTH) {
      this.stack.push({ kind: "unwrap" });
      return;
    }
    const node: ElementNode = {
      name,
      attrs: filterAttrs(name, attribs, this.options, this.attrTokens),
      children: [],
    };
    this.container().push(node);
    this.stack.push({ kind: "keep", node });
    this.depth += 1;
  }

  close(): void {
    const frame = this.stack.pop();
    if (frame?.kind === "keep") this.depth -= 1;
  }

  text(value: string): void {
    if (this.dropping()) return;
    const children = this.container();
    const last = children.length - 1;
    const previous = children[last];
    if (typeof previous === "string") children[last] = previous + value;
    else children.push(value);
  }
}

function serialize(nodes: readonly TreeNode[]): string {
  return nodes.map(serializeNode).join("");
}

function serializeNode(node: TreeNode): string {
  if (typeof node === "string") return escapeText(node);
  const attrs = node.attrs
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
    .join("");
  const open = `<${node.name}${attrs}>`;
  if (VOID_TAGS.has(node.name)) return open;
  return `${open}${serialize(node.children)}</${node.name}>`;
}

function onePass(input: string, options: AttrOptions): SanitizeResult {
  const builder = new TreeBuilder(options);
  const parser = new Parser(
    {
      onopentag: (name, attribs) => {
        builder.open(name, attribs);
      },
      onclosetag: () => {
        builder.close();
      },
      ontext: (value) => {
        builder.text(value);
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      recognizeSelfClosing: false,
      recognizeCDATA: false,
    },
  );
  parser.end(input);
  return { html: serialize(builder.root), attrTokens: builder.attrTokens };
}

function tooLarge(what: string, bytes: number, limit: number): AppError {
  return new AppError(
    ErrorCode.VALIDATION,
    `${what} is too large (${String(bytes)} bytes, the limit is ${String(limit)}). Shorten it or remove some formatting.`,
    {
      problems: [
        {
          code: "SIZE",
          message: `${what} is too large. Shorten it or remove some formatting.`,
          offset: null,
        },
      ],
    },
  );
}

/** Sanitized canonical HTML and the attributes that hold tokens. Throws VALIDATION above the size caps. */
export function sanitizeHtml(
  input: string,
  options: SanitizeOptions = {},
): SanitizeResult {
  const inputBytes = utf8Length(input);
  if (inputBytes > MAX_INPUT_BYTES)
    throw tooLarge("The pasted text", inputBytes, MAX_INPUT_BYTES);
  const attrOptions: AttrOptions = { imgHosts: options.imgHosts ?? [] };
  let result = onePass(input, attrOptions);
  for (let pass = 1; pass < MAX_PASSES; pass += 1) {
    const next = onePass(result.html, attrOptions);
    if (next.html === result.html) break;
    result = next;
  }
  const bytes = utf8Length(result.html);
  if (bytes > BODY_MAX_BYTES)
    throw tooLarge("The template text", bytes, BODY_MAX_BYTES);
  return result;
}

export function sanitize(input: string, options: SanitizeOptions = {}): string {
  return sanitizeHtml(input, options).html;
}
