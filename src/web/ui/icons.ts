/**
 * Icon sprite (design system "Icons"): 16 px symbols drawn with `currentColor` strokes. `iconSprite` goes into the
 * page once; `icon` returns a decorative `<use>` reference, hidden from assistive technology. A button whose only
 * content is an icon carries its own `aria-label`.
 */
const SYMBOLS = {
  files:
    '<path d="M3 2.5h6l4 4V13a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 13z"/><path d="M9 2.5v4h4"/>',
  star: '<path d="m8 2 1.8 3.8 4.2.6-3 2.9.7 4.1L8 11.4l-3.7 2 .7-4.1-3-2.9 4.2-.6z"/>',
  clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5"/>',
  gear: '<path d="M2.5 5h6M11.5 5h2M2.5 11h2M7.5 11h6"/><circle cx="10" cy="5" r="1.5"/><circle cx="6" cy="11" r="1.5"/>',
  folder:
    '<path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>',
  chev: '<path d="m6 4 4 4-4 4"/>',
  down: '<path d="m4 6 4 4 4-4"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  more: '<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>',
  check: '<path d="m3.5 8.5 3 3 6-7"/>',
  undo: '<path d="M5.5 3 2.5 6l3 3"/><path d="M2.5 6h7a4 4 0 0 1 0 8H7"/>',
  redo: '<path d="m10.5 3 3 3-3 3"/><path d="M13.5 6h-7a4 4 0 0 0 0 8H9"/>',
  ul: '<path d="M6 4h8M6 8h8M6 12h8"/><circle cx="2.8" cy="4" r=".5"/><circle cx="2.8" cy="8" r=".5"/><circle cx="2.8" cy="12" r=".5"/>',
  ol: '<path d="M7 4h7M7 8h7M7 12h7M2.5 3h1v3M2.3 10h1.6l-1.7 2.5h1.9"/>',
  quote: '<path d="M3 3v10M6.5 5h7M6.5 8h7M6.5 11h4"/>',
  link: '<path d="M6.8 9.2a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8"/><path d="M9.2 6.8a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8"/>',
  image:
    '<rect x="2" y="3" width="12" height="10" rx="1.2"/><circle cx="5.8" cy="6.5" r="1"/><path d="m3 12 3.5-3.5 2.5 2.5 2-2 2.5 2.5"/>',
  table:
    '<rect x="2" y="3" width="12" height="10" rx="1.2"/><path d="M2 6.5h12M2 9.8h12M6.5 3v10"/>',
  align: '<path d="M2.5 4h11M2.5 8h7M2.5 12h9"/>',
  rule: '<path d="M2 8h12"/>',
  field:
    '<path d="M5.5 3C4 3 4 4.5 4 5.5S3.5 8 2.5 8C3.5 8 4 9.5 4 10.5S4 13 5.5 13M10.5 3C12 3 12 4.5 12 5.5s.5 2.5 1.5 2.5c-1 0-1.5 1.5-1.5 2.5S12 13 10.5 13"/>',
  drop: '<path d="M8 2.5c2 2.5 3.5 4.3 3.5 6.3a3.5 3.5 0 0 1-7 0c0-2 1.5-3.8 3.5-6.3z"/>',
  menu: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
} as const;

export type IconName = keyof typeof SYMBOLS;

const SVG = "http://www.w3.org/2000/svg";

/** The hidden sprite with every symbol, as `#i-<name>`. */
export function iconSprite(): SVGSVGElement {
  const sprite = document.createElementNS(SVG, "svg");
  sprite.setAttribute("class", "sprite");
  sprite.setAttribute("aria-hidden", "true");
  // Static markup from this module only; no caller text reaches innerHTML.
  sprite.innerHTML = Object.entries(SYMBOLS)
    .map(
      ([name, paths]) =>
        `<symbol id="i-${name}" viewBox="0 0 16 16">${paths}</symbol>`,
    )
    .join("");
  return sprite;
}

/** A decorative 16 px icon. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "i");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}
