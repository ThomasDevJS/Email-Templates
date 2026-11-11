import { h, replace } from "../ui/dom";

/**
 * Tag input (wireframe 04, Details panel): visible label, Enter or "Add tag" adds, each tag has a labelled remove
 * button. Read-only shows the tags alone.
 */
export interface TagEditor {
  readonly element: HTMLElement;
  values(): string[];
  set(tags: readonly string[]): void;
}

export function tagEditor(
  max: number,
  maxLength: number,
  onChange: () => void = () => undefined,
  readOnly = false,
): TagEditor {
  let tags: string[] = [];
  const input = h("input", {
    type: "text",
    id: "tag-input",
    maxlength: maxLength,
    autocomplete: "off",
    "aria-describedby": "tag-hint",
  });
  const list = h("ul", { class: "tags", "aria-label": "Tags" });
  const none = h("span", { class: "hint" }, "None");

  const remove = (tag: string) => {
    tags = tags.filter((other) => other !== tag);
    draw();
    onChange();
    input.focus();
  };

  const draw = () => {
    replace(
      list,
      ...tags.map((tag) =>
        h(
          "li",
          { class: "tag" },
          tag,
          readOnly
            ? null
            : h(
                "button",
                {
                  type: "button",
                  class: "tag-remove",
                  "aria-label": `Remove tag ${tag}`,
                  onclick: () => {
                    remove(tag);
                  },
                },
                "×",
              ),
        ),
      ),
    );
    list.hidden = tags.length === 0;
    none.hidden = !readOnly || tags.length > 0;
    input.disabled = tags.length >= max;
  };

  const add = () => {
    const tag = input.value.trim();
    if (tag === "" || tags.length >= max) return;
    if (!tags.some((other) => other.toLowerCase() === tag.toLowerCase()))
      tags = [...tags, tag];
    input.value = "";
    draw();
    onChange();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  });

  const entry = readOnly
    ? null
    : h(
        "div",
        { class: "tag-entry" },
        input,
        h("button", { type: "button", onclick: add }, "Add tag"),
      );
  return {
    element: h(
      "div",
      { class: "panel-row tag-field" },
      readOnly
        ? h("span", { class: "row-label" }, "Tags")
        : h("label", { for: "tag-input" }, "Tags"),
      h(
        "div",
        { class: "panel-control" },
        list,
        none,
        entry,
        readOnly
          ? null
          : h(
              "p",
              { class: "hint", id: "tag-hint" },
              `Up to ${String(max)} tags.`,
            ),
      ),
    ),
    values: () => [...tags],
    set: (next) => {
      tags = [...next];
      draw();
    },
  };
}
