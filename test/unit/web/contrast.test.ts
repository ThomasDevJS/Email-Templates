/**
 * Contrast of the design tokens in src/web/styles.css, light and dark (spec section 8, design system "Principles"):
 * 4.5:1 for text, 3:1 for icons that carry meaning, focus rings and control borders. Every token is either in
 * `PAIRS` or in `NOT_PAIRED` with its reason, so a new token cannot skip this check.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "src", "web", "styles.css"),
  "utf8",
);

const TEXT = 4.5;
const UI = 3;

/** [foreground, background, minimum, where]. */
const PAIRS: readonly (readonly [string, string, number, string])[] = [
  ["ink", "paper", TEXT, "body text"],
  ["ink", "canvas", TEXT, "sidebar, hovered rows"],
  ["ink", "select", TEXT, "selected nav, menu focus"],
  ["ink", "hover", TEXT, "hovered nav item"],
  ["ink", "blank-bg", TEXT, "value placeholder"],
  ["ink-2", "paper", TEXT, "secondary text"],
  ["ink-2", "canvas", TEXT, "kbd, history preview label"],
  ["ink-2", "select", TEXT, "tags, counts on selected rows"],
  ["ink-2", "hover", TEXT, "counts and owner on hovered rows"],
  ["ink-2", "blank-bg", TEXT, "the 'or' of a blank with a fallback"],
  ["ink-3", "paper", TEXT, "column heads, counts, subject lines"],
  ["ink-3", "canvas", TEXT, "sidebar headings, subject on hovered rows"],
  ["on-slate", "slate", TEXT, "primary button, avatar"],
  ["on-slate", "slate-dark", TEXT, "primary button hover"],
  ["on-slate", "avatar-2", TEXT, "table avatars"],
  ["on-red", "red", TEXT, "destructive button"],
  ["red", "paper", TEXT, "errors, toasts, Delete menu item"],
  ["red", "select", TEXT, "focused Delete menu item"],
  ["blank-ink", "paper", TEXT, "prompt placeholder"],
  ["blank-ink", "blank-bg", TEXT, "Placeholder tool button"],
  ["ok", "paper", TEXT, "ok results"],
  ["warn", "paper", TEXT, "warnings"],
  ["warn", "canvas", TEXT, "membership warning row on hover"],
  ["ok", "ok-bg", TEXT, "OK result tag"],
  ["warn", "warn-bg", TEXT, "Late, Conflict and Skipped tags"],
  ["red", "red-bg", TEXT, "Denied, Error and Failed tags"],
  ["slate", "paper", UI, "focus ring"],
  ["slate", "canvas", UI, "focus ring in the sidebar"],
  ["slate", "select", UI, "focus ring on selected rows"],
  ["slate", "hover", UI, "focus ring on hovered rows"],
  ["field-line", "paper", UI, "input, select and button borders"],
  ["field-line", "canvas", UI, "button border on hover"],
  ["red", "canvas", UI, "error border"],
  ["star", "paper", UI, "pressed star outline"],
  ["star", "canvas", UI, "pressed star on a hovered row"],
  ["star", "select", UI, "pressed star on its button hover"],
  ["star-fill", "paper", UI, "pressed star fill"],
  ["star-fill", "canvas", UI, "pressed star fill on a hovered row"],
  ["star-fill", "select", UI, "pressed star fill on its button hover"],
  ["star-off", "paper", UI, "star outline"],
  ["star-off", "canvas", UI, "star outline on a hovered row"],
  ["star-off", "select", UI, "star outline on its button hover"],
  ["blank-line", "paper", UI, "prompt placeholder border"],
  ["logo-red", "logo-plate", UI, "logo letters"],
  ["logo-slate", "logo-plate", UI, "logo letters"],
];

const NOT_PAIRED: Readonly<Record<string, string>> = {
  line: "hairlines between rows, decorative",
  "line-strong": "table head rule and dividers, decorative",
  "shadow-sheet": "shadow",
  "shadow-pop": "shadow",
  backdrop: "dialog backdrop",
  "logo-pad": "spacing",
  radius: "shape",
};

/** Custom properties of the first `:root { ... }` block after `from`. */
function tokens(from: number): Map<string, string> {
  const start = CSS.indexOf(":root {", from);
  const body = CSS.slice(start, CSS.indexOf("}", start));
  return new Map(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1] ?? "",
      (match[2] ?? "").trim(),
    ]),
  );
}

const LIGHT = tokens(0);
const DARK = new Map([
  ...LIGHT,
  ...tokens(CSS.indexOf("@media (prefers-color-scheme: dark)")),
]);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** A hex color for `name`; a transparent logo plate shows the sidebar canvas behind it. */
function color(theme: Map<string, string>, name: string): string {
  const value = theme.get(name);
  if (value === "transparent") return color(theme, "canvas");
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`--${name} is not a 6-digit hex color: ${String(value)}`);
  return value;
}

describe("design token contrast", () => {
  it("computes ratios like WCAG", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(ratio("#a87400", "#e8edf1")).toBeCloseTo(3.45, 2);
  });

  for (const [name, theme] of [
    ["light", LIGHT],
    ["dark", DARK],
  ] as const)
    it(`meets 4.5:1 for text and 3:1 for icons, rings and borders (${name})`, () => {
      const failing = PAIRS.flatMap(([fg, bg, min, where]) => {
        const value = ratio(color(theme, fg), color(theme, bg));
        return value >= min
          ? []
          : [`${fg} on ${bg} (${where}): ${value.toFixed(2)} < ${String(min)}`];
      });
      expect(failing).toEqual([]);
    });

  it("lists every token in the pair table or with a reason", () => {
    const paired = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]));
    const missing = [...DARK.keys()].filter(
      (name) => !paired.has(name) && NOT_PAIRED[name] === undefined,
    );
    expect(missing).toEqual([]);
  });
});
