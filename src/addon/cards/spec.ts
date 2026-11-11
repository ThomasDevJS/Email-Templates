/**
 * Plain-data description of sidebar cards and callback replies. Builders in this folder are pure functions that
 * return these values; render.ts is the only code that turns them into Card Service objects. All text is plain
 * text: the renderer escapes it.
 */
import type { RecipientActions } from "./recipients";

/** Top-level add-on callbacks a card may name. Each one is an export of src/entry.ts and an ENTRY_POINTS row. */
export const CALLBACKS = [
  "onOpenFolder",
  "onPreview",
  "onInsert",
  "onPromptInsert",
  "onRefresh",
  "onBack",
  "onOpenLink",
  "onSearch",
  "onCompose",
  "onPromptCompose",
] as const;
export type Callback = (typeof CALLBACKS)[number];

export type Params = Readonly<Record<string, string>>;

/** Form value of a selected switch. */
export const SWITCH_ON = "on";
/** Details card switch "Replace the subject" (wireframe 02). */
export const SUBJECT_SWITCH = "subj";
/** Home card search input (wireframe 01). */
export const SEARCH_INPUT = "q";

/**
 * D24 truth table, the one place: whether a row Insert sends the subject action, and where the details card switch
 * starts. A new subject moves a reply out of its conversation, so a filled draft subject is kept.
 *
 * | Draft subject | Row Insert | Details card switch |
 * |---------------|------------|---------------------|
 * | empty         | sets it    | on                  |
 * | filled        | keeps it   | off                 |
 */
export function replacesSubject(draftHasSubject: boolean): boolean {
  return !draftHasSubject;
}

export interface ActionSpec {
  readonly fn: Callback;
  readonly params?: Params;
}

export interface ButtonSpec {
  readonly text: string;
  readonly action: ActionSpec;
  /** Screen reader text naming the target ("Insert Welcome email"), spec section 8. */
  readonly alt?: string;
  readonly disabled?: boolean;
  /** "filled": the one main action, in slate; "outlined": a secondary action. Absent: Gmail's default style. */
  readonly style?: "filled" | "outlined";
  /** `setComposeAction` with this `ComposedEmailType` in place of a click action; the callback returns a draft. */
  readonly compose?: "STANDALONE_DRAFT" | "REPLY_AS_DRAFT";
  /** Material icon before the text. */
  readonly icon?: IconName;
}

/** A hint line (D36). */
export function hint(text: string): Widget {
  return { kind: "text", text, tone: "hint" };
}

/** Material icon names (`newMaterialIcon().setName`): no image URL, so the add-on loads nothing from outside Google. */
export type IconName =
  "star" | "schedule" | "description" | "folder" | "info" | "search";

export type Widget =
  | {
      readonly kind: "text";
      readonly text: string;
      /**
       * "error": a line that reports a problem, shown in brand red; it keeps its words ("(!)"), so color is extra.
       * "hint": guidance on what to do next (no error, no empty state, no fact about the template), shown grey with
       * the info icon (D36).
       */
      readonly tone?: "error" | "hint";
    }
  | {
      readonly kind: "item";
      readonly text: string;
      /** Start icon of a list row, by the kind of section it sits in. */
      readonly icon?: IconName;
      readonly topLabel?: string;
      readonly bottomLabel?: string;
      readonly onClick?: ActionSpec;
      readonly button?: ButtonSpec;
      /** A switch in place of the button; its form value is "on" while selected. */
      readonly toggle?: { readonly name: string; readonly selected: boolean };
    }
  | { readonly kind: "buttons"; readonly buttons: readonly ButtonSpec[] }
  | {
      readonly kind: "input";
      readonly name: string;
      readonly title: string;
      readonly value: string;
      readonly multiline: boolean;
      readonly hint?: string;
      /** Runs when the user changes the value (sidebar search). */
      readonly onChange?: ActionSpec;
    };

export interface SectionSpec {
  readonly header?: string;
  /** Never empty: Card Service rejects a section without widgets. */
  readonly widgets: readonly Widget[];
  /** Collapsible, with this many widgets shown while collapsed. */
  readonly collapseAfter?: number;
}

export interface CardSpec {
  readonly name: string;
  /** Header title, only where it carries information (folder path, template title): Gmail's bar names the add-on. */
  readonly title?: string;
  readonly sections: readonly SectionSpec[];
  readonly footer?: {
    readonly primary: ButtonSpec;
    readonly secondary?: ButtonSpec;
  };
}

/** What a callback returns, before rendering. */
export type Reply =
  | { readonly kind: "push"; readonly card: CardSpec }
  | { readonly kind: "update"; readonly card: CardSpec }
  /** Pop to the home card and replace it (Refresh). */
  | { readonly kind: "root"; readonly card: CardSpec }
  | { readonly kind: "pop" }
  | { readonly kind: "notify"; readonly text: string }
  /** Open a web app URL in an overlay; the add-on reloads when it closes. */
  | { readonly kind: "open"; readonly url: string }
  /**
   * One `UpdateDraftActionResponse`: the body action (`IN_PLACE_INSERT`, `MUTABLE_HTML`) always, the subject action
   * only when `subject` is not null, one recipient action per field in `recipients`. Built by `insertReply`.
   */
  | {
      readonly kind: "insert";
      readonly html: string;
      readonly subject: string | null;
      readonly recipients: RecipientActions;
    }
  /** Side panel (spec 4.1a step 6): one `ComposeActionResponse`; Gmail opens `draft` in a compose window. */
  | {
      readonly kind: "compose";
      readonly draft: GoogleAppsScript.Gmail.GmailDraft;
    };

/**
 * Spec 4.1 step 4, 5.6 and 5.7: the rendered body, plus the rendered subject when it is not empty, plus the
 * recipient actions of `recipientActions`. An empty subject (none in the template, only fields without a value, or the
 * switch off) sends no
 * subject action, so the draft subject is never cleared.
 */
export function insertReply(
  html: string,
  subject: string,
  recipients: RecipientActions = {},
): Reply {
  return {
    kind: "insert",
    html,
    subject: subject === "" ? null : subject,
    recipients,
  };
}

export const action = (fn: Callback, params?: Params): ActionSpec =>
  params === undefined ? { fn } : { fn, params };

/** Home, folder and search cards: "Open library" in the fixed footer, filled slate (a footer primary must be filled). */
export const LIBRARY_FOOTER: NonNullable<CardSpec["footer"]> = {
  primary: {
    text: "Open library",
    action: action("onOpenLink"),
    style: "filled",
  },
};
