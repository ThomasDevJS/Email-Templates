/**
 * Plain-data description of sidebar cards and callback replies. Builders in this folder are pure functions that
 * return these values; render.ts is the only code that turns them into Card Service objects. All text is plain
 * text: the renderer escapes it.
 */

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
  // TEMPORARY (spike S7)
  "onS7Card",
  "onS7Compose",
  "onS7Notify",
] as const;
export type Callback = (typeof CALLBACKS)[number];

export type Params = Readonly<Record<string, string>>;

/** Form value of a selected switch. */
export const SWITCH_ON = "on";
/** Prompt card switch "Replace the subject" (wireframe 02). */
export const SUBJECT_SWITCH = "subj";
/** Home card search input (wireframe 01). */
export const SEARCH_INPUT = "q";
/** Callback parameter `subject` of "Insert body only": the draft subject stays as it is. */
export const SKIP_SUBJECT = "skip";
/** Callback parameter `subject` of "Insert with subject": overrides a draft subject (D24). */
export const WITH_SUBJECT = "use";

/**
 * D24 truth table, the one place: whether an Insert sends the subject action (and where the prompt card switch
 * starts). A new subject moves a reply out of its conversation, so a plain Insert keeps any draft subject.
 *
 * | Insert choice         | draft subject empty | draft subject filled |
 * |-----------------------|---------------------|----------------------|
 * | plain Insert          | sets it             | keeps it             |
 * | "Insert with subject" | sets it             | replaces it          |
 * | "Insert body only"    | keeps it            | keeps it             |
 */
export function replacesSubject(
  choice: string | undefined,
  draftHasSubject: boolean,
): boolean {
  if (choice === SKIP_SUBJECT) return false;
  return choice === WITH_SUBJECT || !draftHasSubject;
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
  readonly filled?: boolean;
  /** `setComposeAction` with this `ComposedEmailType` in place of a click action; the callback returns a draft. */
  readonly compose?: "STANDALONE_DRAFT" | "REPLY_AS_DRAFT";
}

export type Widget =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "item";
      readonly text: string;
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
}

export interface CardSpec {
  readonly name: string;
  readonly title: string;
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
   * only when `subject` is not null. Built by `insertReply`.
   */
  | {
      readonly kind: "insert";
      readonly html: string;
      readonly subject: string | null;
    }
  /** TEMPORARY (spike S7): one `ComposeActionResponse` that opens `draft` in a compose window. */
  | { readonly kind: "s7"; readonly draft: GoogleAppsScript.Gmail.GmailDraft }
  /** TEMPORARY (spike S7): a failed harness callback, as a notification and a pushed card. */
  | {
      readonly kind: "s7Error";
      readonly text: string;
      readonly card: CardSpec;
    };

/**
 * Spec 4.1 step 4 and 5.6: the rendered body, plus the rendered subject when it is not empty. An empty subject
 * (none in the template, or the user opted out) sends no subject action, so the draft subject is never cleared.
 */
export function insertReply(html: string, subject: string): Reply {
  return { kind: "insert", html, subject: subject === "" ? null : subject };
}

export const action = (fn: Callback, params?: Params): ActionSpec =>
  params === undefined ? { fn } : { fn, params };
