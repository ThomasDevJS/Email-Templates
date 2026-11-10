import { h, uid } from "./dom";

/**
 * Modal dialog (spec section 8): `role="dialog"`, `aria-modal`, focus trapped inside, Esc closes, focus returns
 * to the element that had it when the dialog opened.
 */
export interface DialogAction {
  readonly label: string;
  readonly primary?: boolean;
  /** Red: the action destroys data (Delete, Empty trash). */
  readonly destructive?: boolean;
  /** Gets the focus when the dialog opens; default: the first focusable element. */
  readonly autofocus?: boolean;
  /** Return false to keep the dialog open (for example on a validation message). */
  readonly run: () => boolean | undefined | Promise<void>;
}

export interface DialogOptions {
  readonly title: string;
  readonly body: Node;
  readonly actions: readonly DialogAction[];
  /** Runs on Esc and on the backdrop; the dialog closes either way. */
  readonly onCancel?: () => void;
  /** Gets focus on close; default: the element that had focus when the dialog opened. */
  readonly returnFocus?: HTMLElement;
  /** `drawer`: a full-height panel at the right edge (audit details), same focus rules. */
  readonly variant?: "drawer";
}

export interface OpenDialog {
  readonly element: HTMLElement;
  close(): void;
}

// `a[href]`, not `[href]`: an icon's SVG `<use href>` is not focusable.
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Keeps Tab and Shift+Tab inside `root`, wrapping at both ends (dialogs and the narrow-screen panel). */
export function trapTab(root: HTMLElement, event: KeyboardEvent): void {
  const items = focusables(root);
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !root.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function openDialog(options: DialogOptions): OpenDialog {
  const opener = document.activeElement as HTMLElement | null;
  const titleId = uid("dialog-title");
  let closed = false;
  const buttons = options.actions.map((action) =>
    h(
      "button",
      {
        type: "button",
        class:
          action.destructive === true
            ? "destructive"
            : action.primary === true
              ? "primary"
              : "",
        onclick: () => {
          void Promise.resolve(action.run()).then((keep) => {
            if (keep !== false) close();
          });
        },
      },
      action.label,
    ),
  );
  const panel = h(
    "div",
    {
      class: options.variant === "drawer" ? "dialog drawer" : "dialog",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
    },
    h("h2", { id: titleId }, options.title),
    options.body,
    h("div", { class: "dialog-actions" }, ...buttons),
  );
  const backdrop = h("div", { class: "backdrop" }, panel);
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    (options.returnFocus ?? opener)?.focus();
  };
  const cancel = () => {
    options.onCancel?.();
    close();
  };
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) cancel();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Tab") {
      trapTab(panel, event);
    }
  });
  document.body.append(backdrop);
  const initial = buttons[options.actions.findIndex((a) => a.autofocus)];
  (initial ?? focusables(panel)[0] ?? panel).focus();
  return { element: panel, close };
}

/** A labelled text input for dialogs; `hint` is linked with `aria-describedby`. */
export function field(
  label: string,
  input: HTMLInputElement,
  hint = "",
): HTMLElement {
  const id = uid("field");
  input.id = id;
  const hintId = `${id}-hint`;
  if (hint !== "") input.setAttribute("aria-describedby", hintId);
  return h(
    "div",
    { class: "field" },
    h("label", { for: id }, label),
    input,
    hint === "" ? null : h("p", { id: hintId, class: "hint" }, hint),
  );
}

/** Asks for one text value. Resolves null on Cancel. `check` returns an error message or "". */
export function promptText(options: {
  title: string;
  label: string;
  hint?: string;
  value?: string;
  maxLength?: number;
  check: (value: string) => string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h("input", {
      type: "text",
      value: options.value ?? "",
      maxlength: options.maxLength ?? 500,
    });
    const error = h("p", { class: "error", role: "alert" });
    const submit = (): boolean => {
      const problem = options.check(input.value);
      error.textContent = problem;
      if (problem !== "") return false;
      resolve(input.value.trim());
      return true;
    };
    const dialog = openDialog({
      title: options.title,
      body: h(
        "div",
        {},
        field(options.label, input, options.hint ?? ""),
        error,
      ),
      actions: [
        { label: "OK", primary: true, run: submit },
        {
          label: "Cancel",
          run: () => {
            resolve(null);
            return true;
          },
        },
      ],
      onCancel: () => {
        resolve(null);
      },
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (submit()) dialog.close();
      }
    });
    input.focus();
  });
}
