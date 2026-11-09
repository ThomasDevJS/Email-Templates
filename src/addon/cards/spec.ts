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
  "onSpikeCard",
  "onSpikeInsert",
] as const;
export type Callback = (typeof CALLBACKS)[number];

export type Params = Readonly<Record<string, string>>;

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
    }
  | { readonly kind: "buttons"; readonly buttons: readonly ButtonSpec[] }
  | {
      readonly kind: "input";
      readonly name: string;
      readonly title: string;
      readonly value: string;
      readonly multiline: boolean;
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
  /** `UpdateDraftActionResponse`, `IN_PLACE_INSERT`, `MUTABLE_HTML`. */
  | { readonly kind: "insert"; readonly html: string };

export const action = (fn: Callback, params?: Params): ActionSpec =>
  params === undefined ? { fn } : { fn, params };
