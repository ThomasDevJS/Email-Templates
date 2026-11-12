import {
  FALLBACK_MAX,
  LABEL_MAX,
  collapse,
  dateToken,
  promptToken,
  variableToken,
  type PromptType,
} from "../../shared/placeholders/grammar";
import { REGISTRY } from "../../shared/placeholders/registry";
import { promptText } from "../ui/dialog";
import type { MenuItem } from "../ui/menu";
import {
  insertPlaceholder,
  selectedPlaceholder,
  setFallback,
} from "./commands";
import type { Editor } from "./setup";

/**
 * Placeholder picker (wireframe 04): the 5 registry names, "Ask the sender..." and "Ask the sender for a date..."
 * (label dialog) and, on a selected variable chip, "Add default text...". Opened from the toolbar and when the user
 * types `{{`.
 */
const FORBIDDEN = /[{}|\\<>\r\n]/;

export function labelProblem(value: string): string {
  const label = collapse(value);
  if (label.length < 1 || label.length > LABEL_MAX)
    return `The field name must be 1 to ${String(LABEL_MAX)} characters.`;
  return FORBIDDEN.test(label)
    ? "The field name cannot contain { } | \\ < >."
    : "";
}

export function fallbackProblem(value: string): string {
  const fallback = value.trim();
  if (fallback.length > FALLBACK_MAX)
    return `The default text must be at most ${String(FALLBACK_MAX)} characters.`;
  return /[{}\\<>\r\n]/.test(fallback)
    ? "The default text cannot contain { } \\ < >."
    : "";
}

/** Menu item and dialog texts of each field type (spec 5.9). */
const ASK = {
  text: {
    item: "Ask the sender...",
    title: "Ask the sender",
    hint: "1 to 40 characters, for example Meeting date.",
  },
  date: {
    item: "Ask the sender for a date...",
    title: "Ask the sender for a date",
    hint: "1 to 40 characters, for example Pickup date. The sender picks a date; it goes in as MM/DD/YYYY.",
  },
} as const;
const TYPES: readonly PromptType[] = ["text", "date"];

/** The "Ask the sender" dialog of one field type; null when cancelled. */
async function askLabel(type: PromptType): Promise<string | null> {
  const label = await promptText({
    title: ASK[type].title,
    label: "Field name the sender sees",
    hint: ASK[type].hint,
    maxLength: LABEL_MAX,
    check: labelProblem,
  });
  return label === null ? null : collapse(label);
}

async function askPrompt(editor: Editor, type: PromptType): Promise<void> {
  const held = editor.hold();
  const label = await askLabel(type);
  if (label !== null)
    held.run(insertPlaceholder({ name: "", label, fallback: null, type }));
  else held.release();
}

async function askFallback(
  editor: Editor,
  pos: number,
  current: string | null,
): Promise<void> {
  const fallback = await promptText({
    title: "Default text",
    label: "Text used when the value is unknown",
    hint: "Up to 80 characters. Leave empty to remove the default text.",
    value: current ?? "",
    maxLength: FALLBACK_MAX,
    check: fallbackProblem,
  });
  if (fallback !== null)
    editor.run(setFallback(pos, fallback === "" ? null : fallback));
  else editor.focus();
}

/** Inserts text at the caret of a plain input and reports the change like typing would. */
function insertAtCaret(input: HTMLInputElement, text: string): void {
  const end = input.value.length;
  input.setRangeText(
    text,
    input.selectionStart ?? end,
    input.selectionEnd ?? end,
    "end",
  );
  input.dispatchEvent(new Event("input"));
  input.focus();
}

/** The picker for the plain-text subject input (wireframe 04): token text at the caret, no chips. */
export function subjectPickerItems(input: HTMLInputElement): MenuItem[] {
  const ask = async (type: PromptType) => {
    const label = await askLabel(type);
    if (label === null) input.focus();
    else
      insertAtCaret(
        input,
        type === "date" ? dateToken(label) : promptToken(label),
      );
  };
  return [
    ...REGISTRY.map((entry) => ({
      label: entry.label,
      run: () => {
        insertAtCaret(input, variableToken(entry.name, null));
      },
    })),
    ...TYPES.map((type) => ({
      label: ASK[type].item,
      run: () => void ask(type),
    })),
  ];
}

export function pickerItems(editor: Editor): MenuItem[] {
  const items: MenuItem[] = REGISTRY.map((entry) => ({
    label: entry.label,
    run: () => {
      editor.run(
        insertPlaceholder({ name: entry.name, label: "", fallback: null }),
      );
    },
  }));
  for (const type of TYPES)
    items.push({
      label: ASK[type].item,
      run: () => void askPrompt(editor, type),
    });
  const chip = selectedPlaceholder(editor.view.state);
  if (chip !== null && chip.attrs.name !== "")
    items.push({
      label:
        chip.attrs.fallback === null
          ? "Add default text..."
          : "Edit default text...",
      run: () => void askFallback(editor, chip.pos, chip.attrs.fallback),
    });
  return items;
}
