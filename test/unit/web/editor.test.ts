// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { toggleMark } from "prosemirror-commands";
import { DOMParser as PMDOMParser } from "prosemirror-model";
import {
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
import { createToolbar } from "../../../src/web/editor/toolbar";
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
    expect(chip?.getAttribute("aria-label")).toBe("Placeholder: sender name");
    expect(chip?.textContent).toBe("Sender name");
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
    expect(chipLabel({ name: "", label: "Date", fallback: null })).toBe(
      "Placeholder: ask: date",
    );
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
    expect(toolbar.element.getAttribute("role")).toBe("toolbar");
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    buttons[0]?.focus();
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons.at(-1));
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
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
    buttons[1]?.click();
    expect(ed.view.state.storedMarks?.map((mark) => mark.type.name)).toContain(
      "em",
    );
    const color = buttons.find((button) => button.textContent === "Color");
    color?.click();
    const menu = document.querySelector('[role="menu"]');
    expect(menu?.getAttribute("aria-label")).toBe("Text color");
    expect(color?.getAttribute("aria-expanded")).toBe("true");
    menu?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
