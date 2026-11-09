import {
  FALLBACK_MAX,
  LABEL_MAX,
  collapse,
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

async function askLabel(editor: Editor): Promise<void> {
  const label = await promptText({
    title: "Ask the user",
    label: "Question shown when the template is used",
    hint: "1 to 40 characters, for example Meeting date.",
    maxLength: LABEL_MAX,
    check: labelProblem,
  });
  if (label !== null)
    editor.run(
      insertPlaceholder({ name: "", label: collapse(label), fallback: null }),
    );
  else editor.focus();
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

export function pickerItems(editor: Editor): MenuItem[] {
  const items: MenuItem[] = REGISTRY.map((entry) => ({
    label: entry.label,
    run: () => {
      editor.run(
        insertPlaceholder({ name: entry.name, label: "", fallback: null }),
      );
    },
  }));
  items.push({ label: "Ask the user...", run: () => void askLabel(editor) });
  const chip = selectedPlaceholder(editor.view.state);
  if (chip !== null && chip.attrs.name !== "")
    items.push({
      label:
        chip.attrs.fallback === null ? "Add fallback..." : "Edit fallback...",
      run: () => void askFallback(editor, chip.pos, chip.attrs.fallback),
    });
  return items;
}
