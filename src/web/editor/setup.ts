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
import {
  EditorState,
  type Command,
  type SelectionBookmark,
} from "prosemirror-state";
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

/** The selection saved before a dialog opens. It follows later edits, so the insert lands where the user was. */
export interface HeldSelection {
  /** Puts the saved selection back, then runs the command there. */
  run(command: Command): void;
  /** Forgets the selection (dialog cancelled) and focuses the editor. */
  release(): void;
}

export interface Editor {
  readonly view: EditorView;
  html(): string;
  run(command: Command): void;
  focus(): void;
  /** Saves the selection before a dialog takes focus (focus moves can reset the caret meanwhile). */
  hold(): HeldSelection;
  destroy(): void;
}

/** True while the page loader blocks the page (D37): shortcuts that open a menu or a dialog then do nothing. */
function pageBusy(element: Element | undefined): boolean {
  return element?.closest("[data-blocked]") != null;
}

/** `{{` typed in text: drop both braces and ask for a placeholder. While the page is busy the braces stay as text. */
export function bracesRule(onBraces: () => void, mount?: Element): InputRule {
  return new InputRule(/\{\{$/, (state, _match, start, end) => {
    if (pageBusy(mount)) return null;
    setTimeout(onBraces, 0);
    return state.tr.delete(start, end);
  });
}

function keys(callbacks: EditorCallbacks) {
  const mark = (name: string) => toggleMark(schema.marks[name] as MarkType);
  const item = schema.nodes["list_item"];
  const link: Command = (_state, _dispatch, view) => {
    if (!pageBusy(view?.dom)) callbacks.onLink();
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
      inputRules({ rules: [bracesRule(callbacks.onBraces, mount)] }),
      keys(callbacks),
      keymap(baseKeymap),
      history(),
    ],
  });
  const held = new Set<{ bookmark: SelectionBookmark }>();
  const view = new EditorView(mount, {
    state,
    attributes,
    // A caller with `use` only reads the body (spec 5.7 "who sets them").
    editable: () => !readOnly,
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr));
      for (const mark of held) mark.bookmark = mark.bookmark.map(tr.mapping);
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
    hold: () => {
      const mark = { bookmark: view.state.selection.getBookmark() };
      held.add(mark);
      return {
        run: (command) => {
          held.delete(mark);
          if (view.isDestroyed) return;
          // Chromium keeps its own caret from before the dialog when the DOM position looks the same, so the next
          // keystroke after a node inserted at a paragraph start went before it; an empty selection forces a new one.
          document.getSelection()?.removeAllRanges();
          const { tr } = view.state;
          view.dispatch(tr.setSelection(mark.bookmark.resolve(tr.doc)));
          command(view.state, view.dispatch);
          view.focus();
        },
        release: () => {
          held.delete(mark);
          if (!view.isDestroyed) view.focus();
        },
      };
    },
    destroy: () => {
      view.destroy();
    },
  };
}
