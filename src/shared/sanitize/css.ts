import {
  DISPLAY_VALUES,
  FORBIDDEN_STYLE_VALUE,
  STYLE_PROPERTIES,
  STYLE_PROPERTY_PATTERNS,
} from "./policy";

/** Inline style filter (ADR-0004). Output is canonical: `name: value` pairs joined by `; `, in input order. */

function allowedProperty(name: string): boolean {
  return (
    STYLE_PROPERTIES.has(name) ||
    STYLE_PROPERTY_PATTERNS.some((pattern) => pattern.test(name))
  );
}

function allowedValue(name: string, value: string): boolean {
  if (value === "") return false;
  const compact = value.replace(/\s+/g, "").toLowerCase();
  if (FORBIDDEN_STYLE_VALUE.test(compact)) return false;
  return name !== "display" || DISPLAY_VALUES.has(compact);
}

/** One `name: value` declaration, or null when it is not allowed. */
function declaration(text: string): string | null {
  const colon = text.indexOf(":");
  if (colon < 0) return null;
  const name = text.slice(0, colon).trim().toLowerCase();
  const value = text
    .slice(colon + 1)
    .trim()
    .replace(/\s+/g, " ");
  if (!allowedProperty(name) || !allowedValue(name, value)) return null;
  return `${name}: ${value}`;
}

/** Comments and CSS escapes can hide a forbidden value across declarations; such a style is dropped whole. */
const OBFUSCATION = /\/\*|\*\/|\\/;

/** Filtered style text, empty when nothing survives. */
export function filterStyle(style: string): string {
  if (OBFUSCATION.test(style)) return "";
  return style
    .split(";")
    .map(declaration)
    .filter((entry): entry is string => entry !== null)
    .join("; ");
}
