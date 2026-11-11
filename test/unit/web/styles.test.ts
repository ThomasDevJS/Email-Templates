/**
 * CSS rules that jsdom cannot lay out or match (`:focus-visible`, generated content, media queries), checked in the
 * text of src/web/styles.css. The screenshots under docs/design/screens/8d show the result in Chromium.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "src", "web", "styles.css"),
  "utf8",
);

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  return CSS.slice(start, CSS.indexOf("}", start));
}

describe("styles (slice 8d)", () => {
  it("draws the focus ring on the active version row, not around the whole list", () => {
    expect(rule(".versions:focus-visible")).toContain("outline: none");
    const ring = rule(
      '.versions:focus-visible .version[aria-selected="true"],\n.tree-item:focus-visible,\n.grid td:focus-visible,\n.admin-table tr:focus-visible',
    );
    expect(ring).toContain("outline: 2px solid var(--slate)");
    expect(ring).toContain("outline-offset: -2px");
  });

  it("hides the visible column label of stacked tables from screen readers", () => {
    expect(rule("  .admin-table td[data-label]::before")).toContain(
      'content: attr(data-label) / "";',
    );
  });

  it("wraps the folder actions as one 2 by 2 group under 860 px", () => {
    const narrow = CSS.slice(CSS.indexOf("@media (max-width: 859px)"));
    expect(narrow).toContain(".folder-actions {\n    display: grid;");
    expect(narrow).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    );
  });

  it("gives Settings, Jobs and Backups one width and one first column", () => {
    expect(rule(".config")).toContain("max-width: 760px");
    expect(rule(".config .facts")).toContain("200px minmax(0, 1fr)");
    expect(rule(".config .admin-table th:first-child")).toContain(
      "width: 200px",
    );
  });
});

describe("styles (slice 8b editor)", () => {
  it("hides elements with the hidden attribute inside the editor, buttons included", () => {
    expect(rule(".editor-page [hidden]")).toContain("display: none");
  });

  it("puts the email on a 680 px sheet over the canvas with 15 px body text at 1.6", () => {
    expect(rule(".editor-sheet")).toContain("width: 680px");
    expect(rule(".doc")).toContain("background: var(--canvas)");
    const body = rule(".editor");
    expect(body).toContain("font-size: 15px");
    expect(body).toContain("line-height: 1.6");
    expect(rule(".editor-work")).toContain(
      "grid-template-columns: minmax(0, 1fr) 340px",
    );
  });

  it("stacks the panel under the sheet and scrolls the toolbar in its row under 860 px", () => {
    const narrow = CSS.slice(CSS.indexOf("/* Under 860 px the panel moves"));
    expect(narrow).toContain(
      ".editor-work {\n    grid-template-columns: minmax(0, 1fr);",
    );
    expect(narrow).toContain(
      "flex-wrap: nowrap;\n    padding: 6px 12px;\n    overflow-x: auto;",
    );
    expect(narrow).toContain(
      ".tool:focus-visible {\n    outline-offset: -2px;",
    );
    expect(narrow).toContain(".section-body.collapsed {\n    display: none;");
  });
  it("gives detail fields the full panel width and aligns the read-only note with the sheet (retry 1)", () => {
    expect(rule(".details .panel-row")).toContain(
      "grid-template-columns: minmax(0, 1fr)",
    );
    const note = rule(".read-only-note");
    expect(note).toContain("width: 680px");
    expect(note).toContain("margin: 20px auto -8px");
  });

  it("gives the tree chevron a 24 by 24 px pointer target with no layout shift (slice 23)", () => {
    expect(rule(".tree-toggle::before")).toContain("inset: -4px");
    expect(rule(".tree-toggle::before")).toContain("position: absolute");
  });

  it("draws no border around a read-only Title (8b minor 5)", () => {
    expect(rule(".panel-control input[readonly]")).toContain(
      "border-color: transparent",
    );
  });
});
