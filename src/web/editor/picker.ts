import {
  OPTIONS_MAX,
  OPTIONS_MIN,
  OPTION_MAX,
} from "../../shared/placeholders/choice";
import {
  FALLBACK_MAX,
  LABEL_MAX,
  collapse,
  variableToken,
  type PromptType,
} from "../../shared/placeholders/grammar";
import { REGISTRY } from "../../shared/placeholders/registry";
import { promptChoice, promptText } from "../ui/dialog";
import type { MenuItem } from "../ui/menu";
import {
  insertPlaceholder,
  selectedPlaceholder,
  setFallback,
  setOptions,
} from "./commands";
import { tokenOf, type PlaceholderAttrs } from "./schema";
import type { Editor } from "./setup";

/**
 * Placeholder picker (wireframe 04): the 5 registry names, "Ask the sender...", "Ask the sender for a date..." and
 * "Ask the sender to choose..." (dialogs); on a selected variable chip "Add default text...", on a choice chip
 * "Edit choices...". Opened from the toolbar and when the user
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

const REQUIRED_HINT = " End the name with * to make the field required.";

/** Menu item and dialog texts of each field type (spec 5.9, 5.10). */
const ASK = {
  text: {
    item: "Ask the sender...",
    title: "Ask the sender",
    hint: `1 to 40 characters, for example Meeting date.${REQUIRED_HINT}`,
  },
  date: {
    item: "Ask the sender for a date...",
    title: "Ask the sender for a date",
    hint: `1 to 40 characters, for example Pickup date. The sender picks a date; it goes in as MM/DD/YYYY.${REQUIRED_HINT}`,
  },
  choice: {
    item: "Ask the sender to choose...",
    title: "Ask the sender to choose",
    hint: `1 to 40 characters, for example Load status.${REQUIRED_HINT}`,
  },
} as const;
const TYPES: readonly PromptType[] = ["text", "date", "choice"];
const NAME_LABEL = "Field name the sender sees";

/** The options of the dialog's list: one per line, trimmed and collapsed, blank lines dropped. */
export function optionLines(list: string): string[] {
  return list
    .split(/\r\n|\r|\n/)
    .map(collapse)
    .filter((line) => line !== "");
}

/** The dialog's one error for an option list (spec 5.10), or "". */
export function listProblem(list: string): string {
  const options = optionLines(list);
  if (options.length < OPTIONS_MIN || options.length > OPTIONS_MAX)
    return `Enter ${String(OPTIONS_MIN)} to ${String(OPTIONS_MAX)} options, one per line.`;
  if (options.some((option) => option.length > OPTION_MAX))
    return `Each option can be up to ${String(OPTION_MAX)} characters.`;
  if (options.some((option) => /[|{}\\<>]/.test(option)))
    return "An option cannot contain | { } \\ < >.";
  const seen = new Set<string>();
  for (const option of options) {
    if (seen.has(option.toLowerCase()))
      return `The option "${option}" is listed twice.`;
    seen.add(option.toLowerCase());
  }
  return "";
}

/** "Ask the sender to choose" and "Edit choices" (spec 5.10); null when cancelled. */
async function askChoice(
  current: PlaceholderAttrs | null,
): Promise<PlaceholderAttrs | null> {
  const answer = await promptChoice({
    title: current === null ? ASK.choice.title : "Edit choices",
    ok: current === null ? "Insert" : "Save",
    label: NAME_LABEL,
    labelHint: ASK.choice.hint,
    listLabel: "Options, one per line",
    listHint:
      "2 to 20 options, each up to 100 characters. The sender picks one; the first is not chosen for them.",
    ...(current === null
      ? {}
      : {
          value: {
            label: current.label,
            list: (current.options ?? []).join("\n"),
          },
        }),
    maxLength: LABEL_MAX,
    check: (label, list) => labelProblem(label) || listProblem(list),
  });
  if (answer === null) return null;
  const label = collapse(answer.label);
  const options = optionLines(answer.list);
  return { name: "", label, fallback: null, type: "choice", options };
}

/** The dialog of one field type: the new field's attributes, or null when cancelled. */
async function askField(type: PromptType): Promise<PlaceholderAttrs | null> {
  if (type === "choice") return askChoice(null);
  const label = await promptText({
    title: ASK[type].title,
    label: NAME_LABEL,
    hint: ASK[type].hint,
    maxLength: LABEL_MAX,
    check: labelProblem,
  });
  return label === null
    ? null
    : { name: "", label: collapse(label), fallback: null, type };
}

async function askPrompt(editor: Editor, type: PromptType): Promise<void> {
  const held = editor.hold();
  const attrs = await askField(type);
  if (attrs !== null) held.run(insertPlaceholder(attrs));
  else held.release();
}

async function editChoices(
  editor: Editor,
  pos: number,
  current: PlaceholderAttrs,
): Promise<void> {
  const attrs = await askChoice(current);
  if (attrs !== null)
    editor.run(setOptions(pos, attrs.label, attrs.options ?? []));
  else editor.focus();
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
    const attrs = await askField(type);
    if (attrs === null) input.focus();
    else insertAtCaret(input, tokenOf(attrs));
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
  if (chip?.attrs.type === "choice")
    items.push({
      label: "Edit choices...",
      run: () => void editChoices(editor, chip.pos, chip.attrs),
    });
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
