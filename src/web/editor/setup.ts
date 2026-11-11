import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { InputRule, inputRules } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import type { MarkType } from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list";
import { EditorState, type Command } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { parseHtml } from "./load";
import { schema } from "./schema";
import { serializeDoc } from "./serialize";

/**
 * ProseMirror editor with the template schema. Typing `{{` removes the braces and opens the placeholder picker
 * (`onBraces`); the view handles Ctrl+S on the whole page. Tab is left to the browser so keyboard users can leave the editor;
 * list indent uses Ctrl+] and Ctrl+[.
 */
export interface EditorCallbacks {
  readonly onChange: () => void;
  readonly onBraces: () => void;
  readonly onLink: () => void;
}

export interface Editor {
  readonly view: EditorView;
  html(): string;
  run(command: Command): void;
  focus(): void;
  destroy(): void;
}

/** `{{` typed in text: drop both braces and ask for a placeholder. */
export function bracesRule(onBraces: () => void): InputRule {
  return new InputRule(/\{\{$/, (state, _match, start, end) => {
    setTimeout(onBraces, 0);
    return state.tr.delete(start, end);
  });
}

function keys(callbacks: EditorCallbacks) {
  const mark = (name: string) => toggleMark(schema.marks[name] as MarkType);
  const item = schema.nodes["list_item"];
  const link: Command = () => {
    callbacks.onLink();
    return true;
  };
  return keymap({
    "Mod-z": undo,
    "Mod-y": redo,
    "Shift-Mod-z": redo,
    "Mod-b": mark("strong"),
    "Mod-i": mark("em"),
    "Mod-u": mark("underline"),
    "Mod-Shift-x": mark("strike"),
    "Mod-k": link,
    Enter: splitListItem(item),
    "Mod-]": sinkListItem(item),
    "Mod-[": liftListItem(item),
  });
}

export function createEditor(
  mount: HTMLElement,
  html: string,
  callbacks: EditorCallbacks,
  attributes: Record<string, string>,
  readOnly = false,
): Editor {
  const state = EditorState.create({
    doc: parseHtml(html),
    plugins: [
      inputRules({ rules: [bracesRule(callbacks.onBraces)] }),
      keys(callbacks),
      keymap(baseKeymap),
      history(),
    ],
  });
  const view = new EditorView(mount, {
    state,
    attributes,
    // A caller with `use` only reads the body (spec 5.7 "who sets them").
    editable: () => !readOnly,
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr));
      callbacks.onChange();
    },
  });
  return {
    view,
    html: () => serializeDoc(view.state.doc),
    run: (command) => {
      command(view.state, view.dispatch);
      view.focus();
    },
    focus: () => {
      view.focus();
    },
    destroy: () => {
      view.destroy();
    },
  };
}
