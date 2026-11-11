import {
  FALLBACK_MAX,
  LABEL_MAX,
  collapse,
  promptToken,
  variableToken,
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
 * Placeholder picker (wireframe 04): the 5 registry names, "Ask the user..." (label dialog) and, on a selected
 * variable chip, "Add fallback...". Opened from the toolbar and when the user types `{{`.
 */
const FORBIDDEN = /[{}|\\<>\r\n]/;

export function labelProblem(value: string): string {
  const label = collapse(value);
  if (label.length < 1 || label.length > LABEL_MAX)
    return `Label must be 1 to ${String(LABEL_MAX)} characters.`;
  return FORBIDDEN.test(label) ? "Label cannot contain { } | \\ < >." : "";
}

export function fallbackProblem(value: string): string {
  const fallback = value.trim();
  if (fallback.length > FALLBACK_MAX)
    return `Fallback must be at most ${String(FALLBACK_MAX)} characters.`;
  return /[{}\\<>\r\n]/.test(fallback)
    ? "Fallback cannot contain { } \\ < >."
    : "";
}

/** The "Ask the user" dialog; null when cancelled. */
async function askLabel(): Promise<string | null> {
  const label = await promptText({
    title: "Ask the user",
    label: "Question shown when the template is used",
    hint: "1 to 40 characters, for example Meeting date.",
    maxLength: LABEL_MAX,
    check: labelProblem,
  });
  return label === null ? null : collapse(label);
}

async function askPrompt(editor: Editor): Promise<void> {
  const held = editor.hold();
  const label = await askLabel();
  if (label !== null)
    held.run(insertPlaceholder({ name: "", label, fallback: null }));
  else held.release();
}

async function askFallback(
  editor: Editor,
  pos: number,
  current: string | null,
): Promise<void> {
  const fallback = await promptText({
    title: "Fallback text",
    label: "Text used when the value is unknown",
    hint: "Up to 80 characters. Leave empty to remove the fallback.",
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
  const ask = async () => {
    const label = await askLabel();
    if (label === null) input.focus();
    else insertAtCaret(input, promptToken(label));
  };
  return [
    ...REGISTRY.map((entry) => ({
      label: entry.label,
      run: () => {
        insertAtCaret(input, variableToken(entry.name, null));
      },
    })),
    { label: "Ask the user...", run: () => void ask() },
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
  items.push({ label: "Ask the user...", run: () => void askPrompt(editor) });
  const chip = selectedPlaceholder(editor.view.state);
  if (chip !== null && chip.attrs.name !== "")
    items.push({
      label:
        chip.attrs.fallback === null ? "Add fallback..." : "Edit fallback...",
      run: () => void askFallback(editor, chip.pos, chip.attrs.fallback),
    });
  return items;
}
