import { setBlockType, toggleMark, wrapIn, lift } from "prosemirror-commands";
import type { MarkType, Node as PMNode, NodeType } from "prosemirror-model";
import {
  NodeSelection,
  type Command,
  type EditorState,
} from "prosemirror-state";
import { liftListItem, wrapInList } from "prosemirror-schema-list";
import { schema, type PlaceholderAttrs } from "./schema";

/** Editor commands used by the toolbar, the keymap and the placeholder picker. */

export function markActive(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection;
  if (empty)
    return type.isInSet(state.storedMarks ?? $from.marks()) !== undefined;
  return state.doc.rangeHasMark(from, to, type);
}

/** Sets (or with an empty value removes) an attributed mark such as a text color. */
export function setMark(
  type: MarkType,
  attrs: Record<string, string> | null,
): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch === undefined) return true;
    if (empty) {
      const marks = type.removeFromSet(
        state.storedMarks ?? state.selection.$from.marks(),
      );
      dispatch(
        state.tr.setStoredMarks(
          attrs === null ? marks : type.create(attrs).addToSet(marks),
        ),
      );
      return true;
    }
    const tr = state.tr.removeMark(from, to, type);
    dispatch(attrs === null ? tr : tr.addMark(from, to, type.create(attrs)));
    return true;
  };
}

export const toggle = (type: MarkType): Command => toggleMark(type);

/** Alignment on every paragraph and heading in the selection; null clears it. */
export function setAlign(align: string | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (
        node.type === schema.nodes["paragraph"] ||
        node.type === schema.nodes["heading"]
      )
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
    });
    if (dispatch !== undefined) dispatch(tr);
    return true;
  };
}

/** Paragraph, or heading 1 to 3. */
export function setTextStyle(level: number): Command {
  return (state, dispatch) => {
    const align: unknown = state.selection.$from.parent.attrs["align"];
    const keep = { align: typeof align === "string" ? align : null };
    return level === 0
      ? setBlockType(schema.nodes["paragraph"], keep)(state, dispatch)
      : setBlockType(schema.nodes["heading"], { ...keep, level })(
          state,
          dispatch,
        );
  };
}

export function inList(state: EditorState, type: NodeType): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1)
    if ($from.node(depth).type === type) return true;
  return false;
}

/** Wraps the selection in a list, or lifts it out when it is already in that list. */
export function toggleList(type: NodeType): Command {
  return (state, dispatch) =>
    inList(state, type)
      ? liftListItem(schema.nodes["list_item"])(state, dispatch)
      : wrapInList(type)(state, dispatch);
}

export function toggleBlockquote(): Command {
  const quote = schema.nodes["blockquote"];
  return (state, dispatch) =>
    inList(state, quote)
      ? lift(state, dispatch)
      : wrapIn(quote)(state, dispatch);
}

export function insertNode(node: PMNode): Command {
  return (state, dispatch) => {
    if (dispatch !== undefined)
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };
}

export function insertPlaceholder(attrs: PlaceholderAttrs): Command {
  const type = schema.nodes["placeholder"];
  return insertNode(type.create(attrs));
}

export const IMAGE_MAX_WIDTH = 600;

/**
 * Width attribute of an inserted image: its own width up to 600 pixels, never wider and never stretched; null when
 * the width is unknown (the image did not load), so the email shows it at its own size.
 */
export function imageWidth(natural: number): string | null {
  if (!(natural > 0)) return null;
  return String(Math.min(Math.round(natural), IMAGE_MAX_WIDTH));
}

/** 2 by 2 table with a header row. */
export function newTable(): PMNode {
  const {
    table,
    table_row: row,
    table_cell: cell,
  } = schema.nodes as Record<string, NodeType>;
  const header = (row as NodeType).create(null, [
    (cell as NodeType).create({ header: true }, schema.text("Item")),
    (cell as NodeType).create({ header: true }, schema.text("Value")),
  ]);
  const body = (row as NodeType).create(null, [
    (cell as NodeType).create(),
    (cell as NodeType).create(),
  ]);
  return (table as NodeType).create(null, [header, body]);
}

/** Link on the selection; an empty selection inserts the URL as linked text. */
export function setLink(href: string): Command {
  const link = schema.marks["link"];
  return (state, dispatch) => {
    if (dispatch === undefined) return true;
    const { from, to, empty } = state.selection;
    const mark = link.create({ href, title: "" });
    if (empty) dispatch(state.tr.insert(from, schema.text(href, [mark])));
    else dispatch(state.tr.removeMark(from, to, link).addMark(from, to, mark));
    return true;
  };
}

/** The selected placeholder chip, or null. */
export function selectedPlaceholder(
  state: EditorState,
): { pos: number; attrs: PlaceholderAttrs } | null {
  const selection = state.selection;
  if (!(selection instanceof NodeSelection)) return null;
  if (selection.node.type !== schema.nodes["placeholder"]) return null;
  return {
    pos: selection.from,
    attrs: selection.node.attrs as PlaceholderAttrs,
  };
}

/** Changes some attributes of the chip at `pos`. */
function updatePlaceholder(
  pos: number,
  patch: Partial<PlaceholderAttrs>,
): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node?.type !== schema.nodes["placeholder"]) return false;
    if (dispatch !== undefined)
      dispatch(
        state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch }),
      );
    return true;
  };
}

export function setFallback(pos: number, fallback: string | null): Command {
  return updatePlaceholder(pos, { fallback });
}

/** "Edit choices..." (spec 5.10, Q94): a choice chip's field name and options. */
export function setOptions(
  pos: number,
  label: string,
  options: readonly string[],
): Command {
  return updatePlaceholder(pos, { label, options });
}
