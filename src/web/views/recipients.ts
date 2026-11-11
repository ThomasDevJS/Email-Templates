import {
  FIELD_LABELS,
  isAddress,
  isOutside,
  type RecipientField,
  type RecipientProblem,
  type Recipients,
} from "../../shared/model/recipients";
import { h, replace } from "../ui/dom";
import { icon } from "../ui/icons";
import { recipientLines } from "./preview";

/**
 * Recipient fields of the editor (spec 5.7 and 7.1, wireframe 04 Details panel): addresses as chips. Enter, comma,
 * semicolon, space, paste and leaving the field turn the typed text into chips; Backspace in the empty input removes
 * the last chip. An address outside the caller's domain carries "outside <domain>". The editor validates the three
 * lists together and hands each field its problems; the server's answer is shown the same way.
 */
export interface ChipField {
  readonly element: HTMLElement;
  values(): string[];
  set(list: readonly string[]): void;
  /** Turns the text still in the input into chips (before a save). */
  commit(): void;
  /** The field's problems: their texts under the field, the addresses they name marked. */
  show(problems: readonly RecipientProblem[]): void;
}

export interface ChipOptions {
  /** The caller's domain, "" while unknown (no outside marks then). */
  readonly domain: () => string;
  readonly readOnly: boolean;
  readonly onChange: () => void;
  /** IDs of help text that describes every recipient field. */
  readonly describedBy: string;
  /** Says a change in the page's live region: "Added a@x.com to Cc". */
  readonly announce: (text: string) => void;
}

const SEPARATORS = new Set(["Enter", ",", ";", " "]);

/** Typed or pasted text as addresses: split on commas, semicolons, spaces and line breaks; trimmed, lower case. */
export function splitAddresses(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((address) => address.toLowerCase())
    .filter((address) => address !== "");
}

/** Positions (1-based) of the addresses a problem names; a count problem names no single address. */
function markedPositions(
  problems: readonly RecipientProblem[],
): ReadonlySet<number> {
  return new Set(
    problems
      .filter((problem) => problem.code !== "RCPT_TOO_MANY")
      .map((problem) => problem.position),
  );
}

export function recipientField(
  field: RecipientField,
  options: ChipOptions,
): ChipField {
  const name = FIELD_LABELS[field];
  const id = `rcpt-${field}`;
  let addresses: string[] = [];
  let problems: readonly RecipientProblem[] = [];
  const input = h("input", {
    type: "text",
    id,
    autocomplete: "off",
    spellcheck: "false",
    "aria-describedby": [
      `${id}-error`,
      field === "bcc" ? `${id}-note` : "",
      options.describedBy,
    ]
      .filter((part) => part !== "")
      .join(" "),
  });
  input.hidden = options.readOnly;
  const list = h("ul", { class: "chips", "aria-label": `${name} addresses` });
  const errors = h("div", { id: `${id}-error`, class: "error" });
  const none = h("span", { class: "hint" }, "None");
  const note =
    field === "bcc"
      ? h(
          "p",
          { id: `${id}-note`, class: "hint" },
          "Hidden from the other recipients of the email.",
        )
      : null;

  /** The pill with the address and its remove button; the outside mark goes under it. */
  const chip = (address: string, position: number, marked: boolean) =>
    h(
      "li",
      { class: "chip-item" },
      h(
        "span",
        { class: marked ? "chip bad" : "chip" },
        h("span", { class: "chip-text" }, address),
        options.readOnly
          ? null
          : h(
              "button",
              {
                type: "button",
                class: "chip-remove",
                "aria-label": `Remove ${address} from ${name}`,
                onclick: () => {
                  remove(position - 1);
                  input.focus();
                },
              },
              "×",
            ),
      ),
      options.domain() !== "" &&
        isAddress(address) &&
        isOutside(address, options.domain())
        ? h(
            "span",
            { class: "chip-mark" },
            icon("domain"),
            `outside ${options.domain()}`,
          )
        : null,
    );

  const draw = () => {
    const marked = markedPositions(problems);
    replace(
      list,
      ...addresses.map((address, i) => chip(address, i + 1, marked.has(i + 1))),
    );
    list.hidden = addresses.length === 0;
    none.hidden = !(options.readOnly && addresses.length === 0);
    // "None" needs no note about hidden addresses (8b minor 5).
    if (note !== null) note.hidden = !none.hidden;
    replace(errors, ...problems.map((problem) => h("p", {}, problem.message)));
    input.setAttribute("aria-invalid", String(problems.length > 0));
  };

  const changed = () => {
    draw();
    options.onChange();
  };

  const remove = (index: number) => {
    options.announce(`Removed ${addresses[index] ?? ""} from ${name}.`);
    addresses = addresses.filter((_, i) => i !== index);
    changed();
  };

  const add = (text: string) => {
    const fresh = splitAddresses(text).filter(
      (address, i, all) =>
        !addresses.includes(address) && all.indexOf(address) === i,
    );
    input.value = "";
    if (fresh.length === 0) return;
    addresses = [...addresses, ...fresh];
    options.announce(`Added ${fresh.join(", ")} to ${name}.`);
    changed();
  };

  input.addEventListener("keydown", (event) => {
    if (SEPARATORS.has(event.key)) {
      if (event.key !== "Enter" || input.value.trim() !== "")
        event.preventDefault();
      add(input.value);
    } else if (
      event.key === "Backspace" &&
      input.value === "" &&
      addresses.length > 0
    ) {
      event.preventDefault();
      remove(addresses.length - 1);
    }
  });
  input.addEventListener("paste", (event) => {
    event.preventDefault();
    add(`${input.value} ${event.clipboardData?.getData("text") ?? ""}`);
  });
  input.addEventListener("blur", () => {
    add(input.value);
  });

  const box = h(
    "div",
    { class: options.readOnly ? "chips-box readonly" : "chips-box" },
    list,
    none,
    input,
  );
  box.addEventListener("click", (event) => {
    if (event.target === box) input.focus();
  });
  draw();
  return {
    element: h(
      "div",
      { class: "panel-row" },
      h("label", { for: id }, name),
      h("div", { class: "panel-control" }, box, note, errors),
    ),
    values: () => [...addresses],
    set: (next) => {
      addresses = [...next];
      problems = [];
      draw();
    },
    commit: () => {
      add(input.value);
    },
    show: (next) => {
      problems = next;
      draw();
    },
  };
}

/** "To a@x.com" lines above the subject of a preview; null when the template has no recipients. */
export function recipientBlock(lists: Recipients): HTMLElement | null {
  const lines = recipientLines(lists);
  if (lines.length === 0) return null;
  return h(
    "div",
    { class: "rcpt-lines" },
    ...lines.map((line) =>
      h(
        "p",
        {},
        h("span", { class: "rcpt-label" }, line.field),
        line.addresses,
      ),
    ),
  );
}
