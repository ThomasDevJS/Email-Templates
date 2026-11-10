import type { Tone } from "../admin/actions";
import { h, type Child } from "../ui/dom";
import { icon, type IconName } from "../ui/icons";

/**
 * Tables and tags of the admin view (design system "Table", "Tag"). Every cell carries its column label in
 * `data-label`, so under 860 px a row stacks as "label value" lines and the page never scrolls sideways.
 */
export interface Column {
  readonly label: string;
  /** Right aligned, for numbers. */
  readonly num?: boolean;
  /** Head read by screen readers only (an actions column). */
  readonly hidden?: boolean;
}

/** A tag whose word carries the meaning; the tint repeats it. */
export function toneTag(word: string, tone: Tone): HTMLElement {
  return h("span", { class: tone === "plain" ? "tag" : `tag ${tone}` }, word);
}

/** One body row; `cells` follow `columns`. */
export function tableRow(
  columns: readonly Column[],
  cells: readonly Child[],
  props: Record<string, string> = {},
): HTMLTableRowElement {
  return h(
    "tr",
    props,
    ...cells.map((cell, index) => {
      const column = columns[index];
      return h(
        "td",
        {
          class: column?.num === true ? "num" : null,
          "data-label": column?.hidden === true ? null : column?.label,
        },
        cell,
      );
    }),
  );
}

/** A row across all columns (warnings), with its icon. */
export function noteRow(
  columns: readonly Column[],
  name: IconName,
  text: string,
  className: string,
): HTMLTableRowElement {
  return h(
    "tr",
    { class: className },
    h(
      "td",
      { colspan: String(columns.length) },
      h("span", { class: "note-line" }, icon(name), text),
    ),
  );
}

export function adminTable(
  columns: readonly Column[],
  rows: readonly HTMLTableRowElement[],
  label: { caption?: string; labelledBy?: string },
): HTMLTableElement {
  return h(
    "table",
    { class: "admin-table", "aria-labelledby": label.labelledBy },
    label.caption === undefined
      ? null
      : h("caption", { class: "sr-only" }, label.caption),
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        ...columns.map((column) =>
          h(
            "th",
            { scope: "col", class: column.num === true ? "num" : null },
            column.hidden === true
              ? h("span", { class: "sr-only" }, column.label)
              : column.label,
          ),
        ),
      ),
    ),
    h("tbody", {}, ...rows),
  );
}
