import type { PromptField } from "../../shared/placeholders/render";
import { inputName } from "../prompts";
import { action, type CardSpec, type Widget } from "./spec";

/**
 * Prompt card (wireframe 02). One input per field; `order` lists field indexes in display order and `problem`
 * is the error line after a blocked Insert. Insert carries the template version and the resolved variable
 * values, so the callback renders without another server call when the body is cached.
 */
export interface PromptState {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly values: Readonly<Record<string, string>>;
  readonly fields: readonly PromptField[];
  readonly entered: readonly string[];
  readonly order: readonly number[];
  readonly problem: string;
}

function input(state: PromptState, index: number): Widget[] {
  const field = state.fields[index];
  if (field === undefined) return [];
  return [
    {
      kind: "input",
      name: inputName(index),
      title: `${field.label} *`,
      value: state.entered[index] ?? "",
      multiline: true,
    },
  ];
}

export function promptCard(state: PromptState): CardSpec {
  const problem: Widget[] =
    state.problem === ""
      ? []
      : [{ kind: "text", text: `(!) ${state.problem}` }];
  return {
    name: `prompt-${state.id}`,
    title: state.title,
    sections: [
      {
        widgets: [
          { kind: "text", text: "Fill these fields to insert" },
          ...state.order.flatMap((index) => input(state, index)),
          ...problem,
        ],
      },
    ],
    footer: {
      primary: {
        text: "Insert",
        alt: `Insert ${state.title}`,
        filled: true,
        action: action("onPromptInsert", {
          id: state.id,
          title: state.title,
          version: String(state.version),
          values: JSON.stringify(state.values),
        }),
      },
      secondary: { text: "Cancel", action: action("onBack") },
    },
  };
}

/** Wireframe 02 caps a card at 20 inputs; a template that needs more cannot be inserted from the sidebar. */
export function tooManyFieldsCard(title: string, count: number): CardSpec {
  return {
    name: "too-many-fields",
    title,
    sections: [
      {
        widgets: [
          {
            kind: "text",
            text: `This template needs ${String(count)} fields; the sidebar fills at most 20. Ask an editor to reduce its prompts.`,
          },
          {
            kind: "buttons",
            buttons: [{ text: "Back", action: action("onBack") }],
          },
        ],
      },
    ],
  };
}
