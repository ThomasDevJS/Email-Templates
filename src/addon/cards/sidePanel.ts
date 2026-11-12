import type { Entry } from "../event";
import {
  action,
  hint,
  type ButtonSpec,
  type Params,
  type SectionSpec,
} from "./spec";

/** Where to insert into an email already being written (spec 7.2): the side panel only starts new drafts. */
export const TOOLBAR_HINT =
  "To insert a template into an email you are already writing, use the Migway Templates button in that email's toolbar.";

/** Every side-panel card that lists or shows templates ends with the hint; compose cards do not. */
export function sidePanelHint(entry: Entry): SectionSpec[] {
  return entry === "compose" ? [] : [{ widgets: [hint(TOOLBAR_HINT)] }];
}

/** The three side-panel actions (spec 7.2): button text, screen reader prefix, Gmail compose type. */
export const COMPOSE_AS = {
  new: { text: "New email", alt: "New email from", type: "STANDALONE_DRAFT" },
  reply: { text: "Reply", alt: "Reply with", type: "REPLY_AS_DRAFT" },
  replyAll: {
    text: "Reply all",
    alt: "Reply all with",
    type: "REPLY_AS_DRAFT",
  },
} as const;
export type ComposeAs = keyof typeof COMPOSE_AS;

export function isComposeAs(value: string | undefined): value is ComposeAs {
  return (
    value !== undefined &&
    Object.prototype.hasOwnProperty.call(COMPOSE_AS, value)
  );
}

/** A compose-action button (`setComposeAction`); `params` gets `as`. */
export function composeButton(
  as: ComposeAs,
  title: string,
  fn: "onCompose" | "onPromptCompose",
  params: Params,
  style: "filled" | "outlined",
): ButtonSpec {
  const { text, alt, type } = COMPOSE_AS[as];
  return {
    text,
    alt: `${alt} ${title}`,
    style,
    action: action(fn, { ...params, as }),
    compose: type,
  };
}
