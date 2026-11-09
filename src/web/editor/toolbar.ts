import type { MarkType, NodeType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";
import { h } from "../ui/dom";
import { openMenu, type MenuItem } from "../ui/menu";
import {
  inList,
  markActive,
  setAlign,
  setMark,
  setTextStyle,
  toggle,
  toggleBlockquote,
  toggleList,
} from "./commands";
import {
  ALIGNMENTS,
  COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  HIGHLIGHTS,
  schema,
} from "./schema";

/**
 * Formatting toolbar (spec section 8): one tab stop, arrow keys move between buttons, toggles carry
 * `aria-pressed`, menus carry `aria-haspopup`. Buttons act on the editor through `ToolbarHost`.
 */
export interface ToolbarHost {
  state(): EditorState;
  run(command: Command): void;
  focus(): void;
  insertLink(): void;
  insertImage(): void;
  insertTable(): void;
  insertRule(): void;
  openPicker(anchor: HTMLElement): void;
}

type MenuBuilder = (state: EditorState, host: ToolbarHost) => MenuItem[];

interface Tool {
  readonly text: string;
  readonly label: string;
  readonly shortcut?: string;
  readonly pressed?: (state: EditorState) => boolean;
  readonly menu?: MenuBuilder;
  readonly act?: (host: ToolbarHost) => void;
}

const mark = (name: string): MarkType => schema.marks[name] as MarkType;
const node = (name: string): NodeType => schema.nodes[name] as NodeType;

function markTool(
  text: string,
  label: string,
  name: string,
  shortcut: string,
): Tool {
  return {
    text,
    label,
    shortcut,
    pressed: (state) => markActive(state, mark(name)),
    act: (host) => {
      host.run(toggle(mark(name)));
    },
  };
}

function currentAttr(state: EditorState, name: string, attr: string): string {
  const { $from } = state.selection;
  const found = mark(name).isInSet(state.storedMarks ?? $from.marks());
  return found === undefined ? "" : String(found.attrs[attr]);
}

function styleMenu(
  name: string,
  attr: string,
  options: readonly { label: string; value: string }[],
  withDefault: boolean,
): MenuBuilder {
  return (state, host) => {
    const current = currentAttr(state, name, attr);
    const items = options.map((option) => ({
      label: option.label,
      checked: option.value === current,
      run: () => {
        host.run(
          setMark(
            mark(name),
            option.value === "" ? null : { [attr]: option.value },
          ),
        );
      },
    }));
    if (!withDefault) return items;
    return [
      ...items,
      {
        label: "Default",
        checked: current === "",
        run: () => {
          host.run(setMark(mark(name), null));
        },
      },
    ];
  };
}

function blockLevel(state: EditorState): number {
  const parent = state.selection.$from.parent;
  return parent.type === node("heading") ? Number(parent.attrs["level"]) : 0;
}

function currentAlign(state: EditorState): string {
  const align: unknown = state.selection.$from.parent.attrs["align"];
  return typeof align === "string" ? align : "";
}

const TOOLS: readonly Tool[] = [
  markTool("B", "Bold", "strong", "Control+B"),
  markTool("I", "Italic", "em", "Control+I"),
  markTool("U", "Underline", "underline", "Control+U"),
  markTool("S", "Strikethrough", "strike", "Control+Shift+X"),
  {
    text: "Text",
    label: "Text style",
    menu: (state, host) =>
      ["Paragraph", "Heading 1", "Heading 2", "Heading 3"].map(
        (label, level) => ({
          label,
          checked: blockLevel(state) === level,
          run: () => {
            host.run(setTextStyle(level));
          },
        }),
      ),
  },
  {
    text: "Color",
    label: "Text color",
    menu: styleMenu("color", "color", COLORS, true),
  },
  {
    text: "Highlight",
    label: "Highlight color",
    menu: styleMenu("background", "color", HIGHLIGHTS, true),
  },
  {
    text: "Size",
    label: "Font size",
    menu: styleMenu("font_size", "size", FONT_SIZES, false),
  },
  {
    text: "Font",
    label: "Font family",
    menu: styleMenu("font_family", "family", FONT_FAMILIES, true),
  },
  {
    text: "Align",
    label: "Align text",
    menu: (state, host) =>
      ALIGNMENTS.map((align) => ({
        label: `${align.charAt(0).toUpperCase()}${align.slice(1)}`,
        checked: currentAlign(state) === align,
        run: () => {
          host.run(setAlign(align === "left" ? null : align));
        },
      })),
  },
  {
    text: "• List",
    label: "Bulleted list",
    pressed: (state) => inList(state, node("bullet_list")),
    act: (host) => {
      host.run(toggleList(node("bullet_list")));
    },
  },
  {
    text: "1. List",
    label: "1. List, numbered",
    pressed: (state) => inList(state, node("ordered_list")),
    act: (host) => {
      host.run(toggleList(node("ordered_list")));
    },
  },
  {
    text: "Quote",
    label: "Quote",
    pressed: (state) => inList(state, node("blockquote")),
    act: (host) => {
      host.run(toggleBlockquote());
    },
  },
  {
    text: "Line",
    label: "Horizontal line",
    act: (host) => {
      host.insertRule();
    },
  },
  {
    text: "Link",
    label: "Link",
    shortcut: "Control+K",
    act: (host) => {
      host.insertLink();
    },
  },
  {
    text: "Image",
    label: "Image by URL",
    act: (host) => {
      host.insertImage();
    },
  },
  {
    text: "Table",
    label: "Table",
    act: (host) => {
      host.insertTable();
    },
  },
];

export interface Toolbar {
  readonly element: HTMLElement;
  update(state: EditorState): void;
}

function roving(buttons: HTMLButtonElement[]): void {
  buttons.forEach((button, i) => {
    button.tabIndex = i === 0 ? 0 : -1;
    button.addEventListener("focus", () => {
      for (const other of buttons) other.tabIndex = other === button ? 0 : -1;
    });
  });
}

function arrowKeys(element: HTMLElement, buttons: HTMLButtonElement[]): void {
  element.addEventListener("keydown", (event) => {
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (current < 0) return;
    const last = buttons.length - 1;
    const next: Record<string, number> = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    buttons[target]?.focus();
  });
}

function toolButton(tool: Tool, host: ToolbarHost): HTMLButtonElement {
  const button = h(
    "button",
    {
      type: "button",
      class: "tool",
      "aria-label": tool.label,
      title:
        tool.shortcut === undefined
          ? tool.label
          : `${tool.label} (${tool.shortcut.replace("Control", "Ctrl")})`,
      "aria-keyshortcuts": tool.shortcut,
      "aria-pressed": tool.pressed === undefined ? undefined : "false",
      "aria-haspopup": tool.menu === undefined ? undefined : "menu",
      "aria-expanded": tool.menu === undefined ? undefined : "false",
    },
    tool.text,
  );
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", () => {
    if (tool.menu !== undefined) {
      openMenu({
        label: tool.label,
        anchor: button,
        items: tool.menu(host.state(), host),
        returnFocus: () => {
          host.focus();
        },
      });
    } else {
      tool.act?.(host);
    }
  });
  return button;
}

export function createToolbar(host: ToolbarHost, editorId: string): Toolbar {
  const buttons = TOOLS.map((tool) => toolButton(tool, host));
  const placeholder = h(
    "button",
    {
      type: "button",
      class: "tool tool-ph",
      "aria-label": "Insert placeholder",
      title: "Insert placeholder (type {{)",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    },
    "{{ Placeholder",
  );
  placeholder.addEventListener("click", () => {
    host.openPicker(placeholder);
  });
  const all = [...buttons, placeholder];
  const element = h(
    "div",
    {
      class: "toolbar",
      role: "toolbar",
      "aria-label": "Formatting",
      "aria-controls": editorId,
    },
    ...all,
  );
  roving(all);
  arrowKeys(element, all);
  return {
    element,
    update: (state) => {
      TOOLS.forEach((tool, i) => {
        if (tool.pressed !== undefined)
          buttons[i]?.setAttribute("aria-pressed", String(tool.pressed(state)));
      });
    },
  };
}
