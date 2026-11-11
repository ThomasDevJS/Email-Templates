// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { toggleMark } from "prosemirror-commands";
import { DOMParser as PMDOMParser } from "prosemirror-model";
import {
  imageWidth,
  insertPlaceholder,
  markActive,
  newTable,
  selectedPlaceholder,
  setAlign,
  setFallback,
  setLink,
  setMark,
  setTextStyle,
  toggleBlockquote,
  toggleList,
  insertNode,
} from "../../../src/web/editor/commands";
import {
  fallbackProblem,
  labelProblem,
  pickerItems,
} from "../../../src/web/editor/picker";
import {
  FONT_FAMILIES,
  chipLabel,
  chipText,
  placeholderAttrs,
  schema,
  styleProperty,
} from "../../../src/web/editor/schema";
import {
  backslashProblems,
  escapeBraces,
  serializeDoc,
} from "../../../src/web/editor/serialize";
import { createEditor, type Editor } from "../../../src/web/editor/setup";
import { createToolbar, tooltip } from "../../../src/web/editor/toolbar";
import { stubLayout } from "./domStubs";

let editor: Editor | null = null;

beforeAll(stubLayout);

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.replaceChildren();
});

function open(html: string, onBraces = () => undefined): Editor {
  const mount = document.createElement("div");
  document.body.append(mount);
  editor = createEditor(
    mount,
    html,
    { onChange: () => undefined, onBraces, onLink: () => undefined },
    { id: "ed" },
  );
  return editor;
}

/** Position just after the first placeholder chip. */
function chipPos(ed: Editor): number {
  let found = -1;
  ed.view.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === "placeholder") found = pos;
  });
  return found;
}

describe("placeholder atom in the editor", () => {
  it("renders a chip with data-ph, contenteditable=false and an aria-label", () => {
    const ed = open("<p>Hi {{sender.name}}</p>");
    const chip = ed.view.dom.querySelector(".ph");
    expect(chip?.getAttribute("data-ph")).toBe("{{sender.name}}");
    expect(chip?.getAttribute("contenteditable")).toBe("false");
    expect(chip?.getAttribute("aria-label")).toBe("Field: Sender name");
    expect(chip?.textContent).toBe("Sender name");
    expect(chip?.className).toBe("ph");
  });

  it("draws prompts with the ask look and a fallback as name or fallback", () => {
    const ed = open(
      "<p>{{ask:Load number}} {{recipient.first_name|there}}</p>",
    );
    const [prompt, value] = [...ed.view.dom.querySelectorAll(".ph")];
    expect(prompt?.className).toBe("ph ask");
    expect(prompt?.textContent).toBe("Load number");
    expect(prompt?.getAttribute("aria-label")).toBe(
      "Field: Load number, asked at insert",
    );
    expect(value?.textContent).toBe("Recipient first name or there");
    expect(value?.querySelector(".ph-or")?.textContent).toBe(" or ");
    expect(value?.getAttribute("aria-label")).toBe(
      "Field: Recipient first name, fallback there",
    );
    expect(ed.html()).toBe(
      "<p>{{ask:Load number}} {{recipient.first_name|there}}</p>",
    );
  });

  it("bold across a token yields <strong>{{sender.name}}</strong>", () => {
    const ed = open("<p>Hi {{sender.name}}</p>");
    const pos = chipPos(ed);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        NodeSelection.create(ed.view.state.doc, pos),
      ),
    );
    ed.run(toggleMark(schema.marks["strong"]));
    expect(ed.html()).toBe("<p>Hi <strong>{{sender.name}}</strong></p>");
    expect(markActive(ed.view.state, schema.marks["strong"])).toBe(true);
  });

  it("deleting a chip removes the whole token", () => {
    const ed = open("<p>Hi {{sender.name}}!</p>");
    const pos = chipPos(ed);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        NodeSelection.create(ed.view.state.doc, pos),
      ),
    );
    const backspace = new KeyboardEvent("keydown", {
      key: "Backspace",
      keyCode: 8,
      bubbles: true,
    });
    ed.view.someProp("handleKeyDown", (handler) => handler(ed.view, backspace));
    expect(ed.html()).toBe("<p>Hi !</p>");
    expect(ed.view.state.doc.textContent).toBe("Hi !");
  });

  it("a text selection over a chip deletes the chip whole, never part of the token", () => {
    const ed = open("<p>a {{sender.name}} b</p>");
    const pos = chipPos(ed);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        TextSelection.create(ed.view.state.doc, pos - 1, pos + 2),
      ),
    );
    ed.view.dispatch(ed.view.state.tr.deleteSelection());
    expect(ed.html()).toBe("<p>ab</p>");
  });

  it("typing {{ removes the braces and opens the picker", () => {
    vi.useFakeTimers();
    const onBraces = vi.fn();
    const ed = open("<p>Hi</p>", onBraces);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 3)),
    );
    const type = (text: string) => {
      const { from, to } = ed.view.state.selection;
      const handled = ed.view.someProp("handleTextInput", (handler) =>
        handler(ed.view, from, to, text, () =>
          ed.view.state.tr.insertText(text, from, to),
        ),
      );
      if (handled !== true)
        ed.view.dispatch(ed.view.state.tr.insertText(text, from, to));
    };
    type("{");
    type("{");
    vi.runAllTimers();
    vi.useRealTimers();
    expect(onBraces).toHaveBeenCalledTimes(1);
    expect(ed.html()).toBe("<p>Hi</p>");
  });

  it("copy and paste keep the token", () => {
    const ed = open("<p>A {{ask:Date}} B</p>");
    const slice = ed.view.state.doc.slice(
      1,
      ed.view.state.doc.content.size - 1,
    );
    const { dom } = ed.view.serializeForClipboard(slice);
    const parsed = PMDOMParser.fromSchema(schema).parse(dom);
    expect(serializeDoc(parsed)).toBe("<p>A {{ask:Date}} B</p>");
  });

  it("serializes literal {{ as \\{{ and reads it back", () => {
    const ed = open("<p>x</p>");
    ed.run((state, dispatch) => {
      dispatch?.(state.tr.insertText("{{a}} ", 1));
      return true;
    });
    expect(ed.html()).toBe("<p>\\{{a}} x</p>");
    expect(escapeBraces("{{{")).toBe("\\{{{");
  });
});

describe("PH_BACKSLASH (backslash before a chip)", () => {
  it("reports the backslash with its body-text position", () => {
    const ed = open("<p>ab</p><p>x\\</p>");
    expect(backslashProblems(ed.view.state.doc)).toEqual([]);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 7)),
    );
    ed.run(
      insertPlaceholder({ name: "sender.name", label: "", fallback: null }),
    );
    expect(ed.html()).toBe("<p>ab</p><p>x\\{{sender.name}}</p>");
    expect(backslashProblems(ed.view.state.doc)).toEqual([
      {
        code: "PH_BACKSLASH",
        message: "Remove the backslash before the placeholder at character 4",
        offset: 3,
      },
    ]);
  });

  it("passes backslashes elsewhere", () => {
    const ed = open("<p>a\\ {{sender.name}} \\{{ {{ask:X}}</p>");
    expect(backslashProblems(ed.view.state.doc)).toEqual([]);
  });

  it("passes a backslash in other marks than the chip: it serializes to a working token", () => {
    const ed = open("<p><strong>a\\</strong>{{sender.name}}</p>");
    expect(ed.html()).toBe("<p><strong>a\\</strong>{{sender.name}}</p>");
    expect(backslashProblems(ed.view.state.doc)).toEqual([]);
  });
});

describe("editor commands", () => {
  it("inserts every placeholder kind and sets a fallback", () => {
    const ed = open("<p></p>");
    ed.run(
      insertPlaceholder({
        name: "recipient.first_name",
        label: "",
        fallback: null,
      }),
    );
    ed.run(
      insertPlaceholder({ name: "", label: "Meeting date", fallback: null }),
    );
    expect(ed.html()).toBe(
      "<p>{{recipient.first_name}}{{ask:Meeting date}}</p>",
    );
    const pos = chipPos(ed);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        NodeSelection.create(ed.view.state.doc, pos),
      ),
    );
    expect(selectedPlaceholder(ed.view.state)?.attrs.name).toBe(
      "recipient.first_name",
    );
    ed.run(setFallback(pos, "there"));
    expect(ed.html()).toBe(
      "<p>{{recipient.first_name|there}}{{ask:Meeting date}}</p>",
    );
    expect(setFallback(0, null)(ed.view.state)).toBe(false);
  });

  it("applies colors, sizes, fonts and removes them", () => {
    const ed = open("<p>word</p>");
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        TextSelection.create(ed.view.state.doc, 1, 5),
      ),
    );
    ed.run(setMark(schema.marks["color"], { color: "#c5221f" }));
    ed.run(setMark(schema.marks["font_size"], { size: "18px" }));
    expect(ed.html()).toBe(
      '<p><span style="color: #c5221f"><span style="font-size: 18px">word</span></span></p>',
    );
    ed.run(setMark(schema.marks["color"], null));
    ed.run(setMark(schema.marks["font_size"], null));
    expect(ed.html()).toBe("<p>word</p>");
    ed.view.dispatch(
      ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 5)),
    );
    ed.run(setMark(schema.marks["font_family"], { family: "Georgia, serif" }));
    expect(markActive(ed.view.state, schema.marks["font_family"])).toBe(true);
    ed.run(setMark(schema.marks["font_family"], null));
    expect(markActive(ed.view.state, schema.marks["font_family"])).toBe(false);
  });

  it("sets alignment, headings, lists, quotes, links, tables and rules", () => {
    const ed = open("<p>one</p>");
    ed.view.dispatch(
      ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 2)),
    );
    ed.run(setAlign("center"));
    ed.run(setTextStyle(2));
    expect(ed.html()).toBe('<h2 style="text-align: center">one</h2>');
    ed.run(setTextStyle(0));
    ed.run(setAlign(null));
    ed.run(toggleList(schema.nodes["bullet_list"]));
    expect(ed.html()).toBe("<ul><li>one</li></ul>");
    ed.run(toggleList(schema.nodes["bullet_list"]));
    ed.run(toggleBlockquote());
    expect(ed.html()).toBe("<blockquote><p>one</p></blockquote>");
    ed.run(toggleBlockquote());
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        TextSelection.create(ed.view.state.doc, 1, 4),
      ),
    );
    ed.run(setLink("https://example.com"));
    expect(ed.html()).toBe(
      '<p><a href="https://example.com" rel="noopener noreferrer" target="_blank">one</a></p>',
    );
    ed.view.dispatch(
      ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 4)),
    );
    ed.run(setLink("tel:+1"));
    ed.run(insertNode(newTable()));
    ed.run(insertNode(schema.nodes["horizontal_rule"].create()));
    expect(ed.html()).toContain(
      '<a href="tel:+1" rel="noopener noreferrer" target="_blank">tel:+1</a>',
    );
    expect(ed.html()).toContain(
      '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse"><tbody><tr><th>Item</th><th>Value</th></tr><tr><td></td><td></td></tr></tbody></table>',
    );
    expect(ed.html()).toContain("<hr>");
  });

  it("drops unsafe links and images on paste", () => {
    const ed = open(
      '<p><a href="javascript:alert(1)">x</a><img src="http://x.com/a.png"><img src="https://x.com/b.png" alt="B" width="50"></p>',
    );
    expect(ed.html()).toBe(
      '<p>x<img alt="B" src="https://x.com/b.png" width="50"></p>',
    );
  });

  it("reads Gmail font tags and div paragraphs", () => {
    const ed = open(
      '<div align="right"><font color="#ff0000" face="Arial">red</font></div><ol start="2"><li><p style="text-align: center">c</p></li></ol>',
    );
    expect(ed.html()).toBe(
      '<p style="text-align: right"><span style="color: #ff0000"><span style="font-family: Arial">red</span></span></p><ol start="2"><li><p style="text-align: center">c</p></li></ol>',
    );
  });
});

describe("schema helpers and picker rules", () => {
  it("reads style properties from attribute text", () => {
    const span = document.createElement("span");
    span.setAttribute("style", "COLOR: #ABC ; font-size:12px");
    expect(styleProperty(span, "color")).toBe("#ABC");
    expect(styleProperty(span, "font-size")).toBe("12px");
    expect(styleProperty(span, "width")).toBe("");
  });

  it("labels chips", () => {
    expect(placeholderAttrs("{{sender.phone|n/a}}")).toEqual({
      name: "sender.phone",
      label: "",
      fallback: "n/a",
    });
    expect(placeholderAttrs("{{ask:  Date  }}")).toEqual({
      name: "",
      label: "Date",
      fallback: null,
    });
    expect(placeholderAttrs("x {{sender.name}}")).toBeNull();
    expect(placeholderAttrs("\\{{")).toBeNull();
    expect(chipText({ name: "foo.bar", label: "", fallback: null })).toBe(
      "foo.bar",
    );
    expect(chipText({ name: "", label: "Date", fallback: null })).toBe("Date");
    expect(chipText({ name: "sender.phone", label: "", fallback: "n/a" })).toBe(
      "Sender phone or n/a",
    );
    expect(chipLabel({ name: "", label: "Date", fallback: null })).toBe(
      "Field: Date, asked at insert",
    );
    expect(
      chipLabel({ name: "sender.phone", label: "", fallback: "n/a" }),
    ).toBe("Field: Sender phone, fallback n/a");
  });

  it("checks labels and fallbacks", () => {
    expect(labelProblem("")).toBe("Label must be 1 to 40 characters.");
    expect(labelProblem("a|b")).toBe("Label cannot contain { } | \\ < >.");
    expect(labelProblem("Meeting date")).toBe("");
    expect(fallbackProblem("x".repeat(81))).toBe(
      "Fallback must be at most 80 characters.",
    );
    expect(fallbackProblem("a<b")).toBe("Fallback cannot contain { } \\ < >.");
    expect(fallbackProblem("there")).toBe("");
  });

  it("lists the 5 names, Ask the user and, on a selected variable, Add fallback", () => {
    const ed = open("<p>{{sender.name}}</p>");
    expect(pickerItems(ed).map((item) => item.label)).toEqual([
      "Sender name",
      "Sender title",
      "Sender phone",
      "Sender department",
      "Recipient first name",
      "Ask the user...",
    ]);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        NodeSelection.create(ed.view.state.doc, chipPos(ed)),
      ),
    );
    expect(pickerItems(ed).at(-1)?.label).toBe("Add fallback...");
    pickerItems(ed)[1]?.run();
    expect(ed.html()).toBe("<p>{{sender.title}}</p>");
  });
});

describe("toolbar", () => {
  it("is one tab stop with arrow keys and aria-pressed", () => {
    const ed = open("<p><strong>bold</strong></p>");
    const toolbar = createToolbar(
      {
        state: () => ed.view.state,
        run: (command) => {
          ed.run(command);
        },
        focus: () => {
          ed.focus();
        },
        insertLink: () => undefined,
        insertImage: () => undefined,
        insertTable: () => undefined,
        insertRule: () => undefined,
        openPicker: () => undefined,
      },
      "ed",
    );
    document.body.append(toolbar.element);
    const buttons = [...toolbar.element.querySelectorAll("button")];
    const named = (name: string) =>
      buttons.find(
        (button) => button.getAttribute("aria-label") === name,
      ) as HTMLButtonElement;
    expect(toolbar.element.getAttribute("role")).toBe("toolbar");
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    buttons[0]?.focus();
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons.at(-1));
    expect(buttons.at(-1)?.textContent).toBe("Insert field");
    buttons
      .at(-1)
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      );
    expect(document.activeElement).toBe(buttons[0]);
    ed.view.dispatch(
      ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 2)),
    );
    toolbar.update(ed.view.state);
    expect(named("Bold").getAttribute("aria-pressed")).toBe("true");
    expect(named("Italic").getAttribute("aria-pressed")).toBe("false");
    named("Italic").click();
    expect(ed.view.state.storedMarks?.map((mark) => mark.type.name)).toContain(
      "em",
    );
    const color = named("Text color");
    color.click();
    const menu = document.querySelector('[role="menu"]');
    expect(menu?.getAttribute("aria-label")).toBe("Text color");
    expect(color.getAttribute("aria-expanded")).toBe("true");
    menu?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("groups icon buttons with dividers, names every button and puts the shortcut in the tooltip", () => {
    const ed = open("<p>one</p>");
    const toolbar = createToolbar(
      {
        state: () => ed.view.state,
        run: (command) => {
          ed.run(command);
        },
        focus: () => undefined,
        insertLink: () => undefined,
        insertImage: () => undefined,
        insertTable: () => undefined,
        insertRule: () => undefined,
        openPicker: () => undefined,
      },
      "ed",
    );
    toolbar.update(ed.view.state);
    const element = toolbar.element;
    const names = [...element.querySelectorAll("button")].map(
      (button) => button.getAttribute("aria-label") ?? button.textContent,
    );
    expect(names).toEqual([
      "Undo",
      "Redo",
      "Block style: Paragraph",
      "Text size: Normal",
      "Font: Default",
      "Bold",
      "Italic",
      "Underline",
      "Strikethrough",
      "Text color",
      "Highlight color",
      "Align text",
      "Bulleted list",
      "Numbered list",
      "Quote",
      "Link",
      "Image",
      "Table",
      "Horizontal line",
      "Insert field",
    ]);
    expect(element.querySelectorAll('[role="separator"]')).toHaveLength(4);
    const bold = element.querySelector('[aria-label="Bold"]');
    expect(bold?.textContent).toBe("B");
    expect(bold?.getAttribute("title")).toBe("Bold (Ctrl+B)");
    expect(
      element.querySelector('[aria-label="Undo"]')?.getAttribute("title"),
    ).toBe("Undo (Ctrl+Z)");
    expect(toolbar.placeholder.getAttribute("title")).toBe(
      "Insert field (type {{)",
    );
    expect(tooltip("Quote")).toBe("Quote");
    const picker = element.querySelector(".picker") as HTMLButtonElement;
    expect(picker.textContent).toBe("Paragraph");
    ed.run(setTextStyle(2));
    toolbar.update(ed.view.state);
    expect(picker.getAttribute("aria-label")).toBe("Block style: Heading 2");
    expect(picker.textContent).toBe("Heading 2");
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        TextSelection.create(ed.view.state.doc, 1, 4),
      ),
    );
    ed.run(setMark(schema.marks["font_size"], { size: "18px" }));
    toolbar.update(ed.view.state);
    expect(
      element.querySelectorAll(".picker")[1]?.getAttribute("aria-label"),
    ).toBe("Text size: Large");
    (element.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click();
    expect(ed.html()).toBe("<h2>one</h2>");
    (element.querySelector('[aria-label="Redo"]') as HTMLButtonElement).click();
    expect(ed.html()).toBe('<h2><span style="font-size: 18px">one</span></h2>');
  });

  it("sets and reads back each font family from the Font picker, shown in its own face", () => {
    const ed = open("<p>word</p>");
    const toolbar = createToolbar(
      {
        state: () => ed.view.state,
        run: (command) => {
          ed.run(command);
        },
        focus: () => undefined,
        insertLink: () => undefined,
        insertImage: () => undefined,
        insertTable: () => undefined,
        insertRule: () => undefined,
        openPicker: () => undefined,
      },
      "ed",
    );
    document.body.append(toolbar.element);
    const font = toolbar.element.querySelectorAll<HTMLButtonElement>(
      ".picker",
    )[2] as HTMLButtonElement;
    const pick = (label: string) => {
      font.click();
      const items = [
        ...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
      ];
      const item = items.find((entry) => entry.textContent === label);
      if (item === undefined) throw new Error(`no item ${label}`);
      item.click();
      toolbar.update(ed.view.state);
      return items;
    };
    ed.view.dispatch(
      ed.view.state.tr.setSelection(
        TextSelection.create(ed.view.state.doc, 1, 5),
      ),
    );
    toolbar.update(ed.view.state);
    expect(font.textContent).toBe("Font");
    expect(font.getAttribute("aria-haspopup")).toBe("menu");
    for (const family of FONT_FAMILIES) {
      const items = pick(family.label);
      expect(items.map((entry) => entry.getAttribute("style"))).toEqual(
        FONT_FAMILIES.map((f) => `font-family: ${f.value}`).concat([null]),
      );
      expect(ed.html()).toBe(
        `<p><span style="font-family: ${family.value}">word</span></p>`,
      );
      expect(font.getAttribute("aria-label")).toBe(`Font: ${family.label}`);
      expect(font.textContent).toBe("Font");
      font.click();
      expect(
        document.querySelector('[role="menuitemradio"][aria-checked="true"]')
          ?.textContent,
      ).toBe(family.label);
      document
        .querySelector('[role="menu"]')
        ?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
    }
    pick("Default");
    expect(ed.html()).toBe("<p>word</p>");
    expect(font.getAttribute("aria-label")).toBe("Font: Default");
    const pasted = open('<p><span style="font-family: Calibri">x</span></p>');
    pasted.view.dispatch(
      pasted.view.state.tr.setSelection(
        TextSelection.create(pasted.view.state.doc, 2),
      ),
    );
    const other = createToolbar(
      {
        state: () => pasted.view.state,
        run: () => undefined,
        focus: () => undefined,
        insertLink: () => undefined,
        insertImage: () => undefined,
        insertTable: () => undefined,
        insertRule: () => undefined,
        openPicker: () => undefined,
      },
      "ed",
    );
    other.update(pasted.view.state);
    expect(
      other.element.querySelectorAll(".picker")[2]?.getAttribute("aria-label"),
    ).toBe("Font: Other font");
  });
});

describe("images (slice 8b fix)", () => {
  it("keeps the image's own width up to 600 px and never stretches it", () => {
    expect(imageWidth(240)).toBe("240");
    expect(imageWidth(600)).toBe("600");
    expect(imageWidth(1800)).toBe("600");
    expect(imageWidth(320.4)).toBe("320");
    expect(imageWidth(0)).toBeNull();
    expect(imageWidth(Number.NaN)).toBeNull();
  });
});
