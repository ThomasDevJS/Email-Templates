import { h, replace } from "../ui/dom";

/** Tag input (wireframe 04): visible label, Enter or Add adds, each tag has a labelled remove button. */
export interface TagEditor {
  readonly element: HTMLElement;
  values(): string[];
  set(tags: readonly string[]): void;
}

export function tagEditor(max: number, maxLength: number): TagEditor {
  let tags: string[] = [];
  const input = h("input", {
    type: "text",
    id: "tag-input",
    maxlength: maxLength,
    autocomplete: "off",
  });
  const list = h("ul", { class: "tags", "aria-label": "Tags" });
  const note = h(
    "p",
    { class: "hint", id: "tag-hint" },
    `Up to ${String(max)} tags.`,
  );
  input.setAttribute("aria-describedby", "tag-hint");

  const draw = () => {
    replace(
      list,
      ...tags.map((tag) =>
        h(
          "li",
          { class: "tag" },
          tag,
          h(
            "button",
            {
              type: "button",
              class: "tag-remove",
              "aria-label": `Remove tag ${tag}`,
              onclick: () => {
                tags = tags.filter((other) => other !== tag);
                draw();
                input.focus();
              },
            },
            "×",
          ),
        ),
      ),
    );
    input.disabled = tags.length >= max;
  };

  const add = () => {
    const tag = input.value.trim();
    if (tag === "" || tags.length >= max) return;
    if (!tags.some((other) => other.toLowerCase() === tag.toLowerCase()))
      tags = [...tags, tag];
    input.value = "";
    draw();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  });

  return {
    element: h(
      "div",
      { class: "field tag-field" },
      h("label", { for: "tag-input" }, "Tags"),
      h(
        "div",
        { class: "tag-row" },
        list,
        input,
        h("button", { type: "button", onclick: add }, "Add tag"),
      ),
      note,
    ),
    values: () => [...tags],
    set: (next) => {
      tags = [...next];
      draw();
    },
  };
}
