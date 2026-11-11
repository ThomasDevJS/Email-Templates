import type { MarkType, NodeType } from "prosemirror-model";
import { redo, undo } from "prosemirror-history";
import type { Command, EditorState } from "prosemirror-state";
import { h } from "../ui/dom";
import { icon, type IconName } from "../ui/icons";
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
import { ALIGNMENTS, COLORS, FONT_SIZES, HIGHLIGHTS, schema } from "./schema";

/**
 * Formatting toolbar (spec section 8, design system "Editor"): icon buttons in groups with dividers, one tab stop,
 * arrow keys move between buttons (ARIA toolbar pattern), toggles carry `aria-pressed`, menus carry
 * `aria-haspopup`, every tooltip names its shortcut. Buttons act on the editor through `ToolbarHost`.
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
  /** Accessible name and tooltip. */
  readonly label: string;
  readonly icon?: IconName;
  /** B, I, U, S stay letters (design system "Icons"). */
  readonly letter?: string;
  /** A picker shows the current value as its text ("Paragraph"). */
  readonly value?: (state: EditorState) => string;
  readonly shortcut?: string;
  readonly pressed?: (state: EditorState) => boolean;
  readonly menu?: MenuBuilder;
  readonly act?: (host: ToolbarHost) => void;
}

const mark = (name: string): MarkType => schema.marks[name] as MarkType;
const node = (name: string): NodeType => schema.nodes[name] as NodeType;

function markTool(
  letter: string,
  label: string,
  name: string,
  shortcut: string,
): Tool {
  return {
    letter,
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

const BLOCK_STYLES = ["Paragraph", "Heading 1", "Heading 2", "Heading 3"];

function blockLevel(state: EditorState): number {
  const parent = state.selection.$from.parent;
  return parent.type === node("heading") ? Number(parent.attrs["level"]) : 0;
}

function currentAlign(state: EditorState): string {
  const align: unknown = state.selection.$from.parent.attrs["align"];
  return typeof align === "string" ? align : "";
}

function sizeLabel(state: EditorState): string {
  const size = currentAttr(state, "font_size", "size");
  return FONT_SIZES.find((option) => option.value === size)?.label ?? "Normal";
}

function listTool(label: string, icon: IconName, name: string): Tool {
  return {
    label,
    icon,
    pressed: (state) => inList(state, node(name)),
    act: (host) => {
      host.run(toggleList(node(name)));
    },
  };
}

function actTool(
  label: string,
  icon: IconName,
  act: (host: ToolbarHost) => void,
  shortcut?: string,
): Tool {
  return shortcut === undefined
    ? { label, icon, act }
    : { label, icon, act, shortcut };
}

/** Groups in the order of the mockup; a divider goes between two groups. */
const GROUPS: readonly (readonly Tool[])[] = [
  [
    actTool(
      "Undo",
      "undo",
      (host) => {
        host.run(undo);
      },
      "Control+Z",
    ),
    actTool(
      "Redo",
      "redo",
      (host) => {
        host.run(redo);
      },
      "Control+Y",
    ),
  ],
  [
    {
      label: "Block style",
      value: (state) => BLOCK_STYLES[blockLevel(state)] ?? "Paragraph",
      menu: (state, host) =>
        BLOCK_STYLES.map((label, level) => ({
          label,
          checked: blockLevel(state) === level,
          run: () => {
            host.run(setTextStyle(level));
          },
        })),
    },
    {
      label: "Text size",
      value: sizeLabel,
      menu: styleMenu("font_size", "size", FONT_SIZES, false),
    },
  ],
  [
    markTool("B", "Bold", "strong", "Control+B"),
    markTool("I", "Italic", "em", "Control+I"),
    markTool("U", "Underline", "underline", "Control+U"),
    markTool("S", "Strikethrough", "strike", "Control+Shift+X"),
    {
      label: "Text color",
      icon: "drop",
      menu: styleMenu("color", "color", COLORS, true),
    },
    {
      label: "Highlight color",
      icon: "highlight",
      menu: styleMenu("background", "color", HIGHLIGHTS, true),
    },
  ],
  [
    {
      label: "Align text",
      icon: "align",
      menu: (state, host) =>
        ALIGNMENTS.map((align) => ({
          label: `${align.charAt(0).toUpperCase()}${align.slice(1)}`,
          checked: currentAlign(state) === align,
          run: () => {
            host.run(setAlign(align === "left" ? null : align));
          },
        })),
    },
    listTool("Bulleted list", "ul", "bullet_list"),
    listTool("Numbered list", "ol", "ordered_list"),
    {
      label: "Quote",
      icon: "quote",
      pressed: (state) => inList(state, node("blockquote")),
      act: (host) => {
        host.run(toggleBlockquote());
      },
    },
  ],
  [
    actTool(
      "Link",
      "link",
      (host) => {
        host.insertLink();
      },
      "Control+K",
    ),
    actTool("Image", "image", (host) => {
      host.insertImage();
    }),
    actTool("Table", "table", (host) => {
      host.insertTable();
    }),
    actTool("Horizontal line", "rule", (host) => {
      host.insertRule();
    }),
  ],
];

const TOOLS: readonly Tool[] = GROUPS.flat();

export interface Toolbar {
  readonly element: HTMLElement;
  /** The "Insert field" button, the anchor of the placeholder menu. */
  readonly placeholder: HTMLButtonElement;
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

/** "Bold (Ctrl+B)": the tooltip names the shortcut. */
export function tooltip(label: string, shortcut?: string): string {
  return shortcut === undefined
    ? label
    : `${label} (${shortcut.replace("Control", "Ctrl")})`;
}

function buttonClass(tool: Tool): string {
  if (tool.value !== undefined) return "tool picker";
  return tool.letter === undefined ? "tool" : "tool letter";
}

/** Keeps the focus in the editor when a button is pressed with the mouse. */
function keepFocus(button: HTMLButtonElement): void {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
}

function toolButton(tool: Tool, host: ToolbarHost): HTMLButtonElement {
  const picker = tool.value !== undefined;
  const button = h(
    "button",
    {
      type: "button",
      class: buttonClass(tool),
      // A picker gets its name in `update`, with its visible value in it.
      "aria-label": picker ? undefined : tool.label,
      title: tooltip(tool.label, tool.shortcut),
      "aria-keyshortcuts": tool.shortcut,
      "aria-pressed": tool.pressed === undefined ? undefined : "false",
      "aria-haspopup": tool.menu === undefined ? undefined : "menu",
      "aria-expanded": tool.menu === undefined ? undefined : "false",
    },
    tool.letter ?? (tool.icon === undefined ? null : icon(tool.icon)),
    picker ? h("span", { class: "picker-value" }) : null,
    picker ? icon("down") : null,
  );
  keepFocus(button);
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

/** The buttons with a divider before every group but the first. */
function grouped(buttons: readonly HTMLButtonElement[]): HTMLElement[] {
  let next = 0;
  return GROUPS.flatMap((group, i) => {
    const members = buttons.slice(next, next + group.length);
    next += group.length;
    const divider = h("span", {
      class: "tool-sep",
      role: "separator",
      "aria-orientation": "vertical",
    });
    return i === 0 ? members : [divider, ...members];
  });
}

export function createToolbar(host: ToolbarHost, editorId: string): Toolbar {
  const buttons = TOOLS.map((tool) => toolButton(tool, host));
  const placeholder = h(
    "button",
    {
      type: "button",
      class: "tool tool-ph",
      title: "Insert field (type {{)",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    },
    icon("field"),
    "Insert field",
  );
  keepFocus(placeholder);
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
    ...grouped(buttons),
    placeholder,
  );
  roving(all);
  arrowKeys(element, all);
  return {
    element,
    placeholder,
    update: (state) => {
      TOOLS.forEach((tool, i) => {
        const button = buttons[i];
        if (button === undefined) return;
        if (tool.pressed !== undefined)
          button.setAttribute("aria-pressed", String(tool.pressed(state)));
        if (tool.value === undefined) return;
        const value = tool.value(state);
        button.setAttribute("aria-label", `${tool.label}: ${value}`);
        const text = button.querySelector(".picker-value");
        if (text !== null) text.textContent = value;
      });
    },
  };
}
